# -----------------------------------------------------------------------------
# Terraform Configuration
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state (recommended for teams)
  # backend "s3" {
  #   bucket         = "llmhub-terraform-state"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "llmhub-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_availability_zones" "available" {
  state = "available"
}

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${var.project_name}-vpc" }
}

# -----------------------------------------------------------------------------
# Public Subnets (ALB lives here)
# -----------------------------------------------------------------------------

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public-${data.aws_availability_zones.available.names[count.index]}" }
}

# -----------------------------------------------------------------------------
# Private Subnets (ECS Fargate tasks live here)
# -----------------------------------------------------------------------------

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = { Name = "${var.project_name}-private-${data.aws_availability_zones.available.names[count.index]}" }
}

# -----------------------------------------------------------------------------
# Internet Gateway (outbound for public subnets)
# -----------------------------------------------------------------------------

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.project_name}-igw" }
}

# -----------------------------------------------------------------------------
# NAT Gateways (outbound for private subnets — ECR pulls, external APIs)
#
# One NAT per AZ — single-AZ NAT was the egress SPOF in the P1 audit:
# losing that AZ killed all ECR pulls / Supabase / Bedrock for every task,
# even ones in the surviving AZ.  Per-AZ NATs cost ~$32/mo each but remove
# the cross-zone failure domain and the cross-zone data transfer charge.
#
# To save cost in dev/staging, set var.nat_gateway_count = 1 and only the
# first AZ gets a NAT (legacy behaviour).
# -----------------------------------------------------------------------------

resource "aws_eip" "nat" {
  count  = var.nat_gateway_count
  domain = "vpc"

  tags = { Name = "${var.project_name}-nat-eip-${data.aws_availability_zones.available.names[count.index]}" }
}

resource "aws_nat_gateway" "main" {
  count         = var.nat_gateway_count
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = { Name = "${var.project_name}-nat-${data.aws_availability_zones.available.names[count.index]}" }

  depends_on = [aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# Route Tables
# -----------------------------------------------------------------------------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-public-rt" }
}

# Per-AZ private route tables.  Each private subnet routes 0/0 through the NAT
# in its own AZ when nat_gateway_count == 2 (HA), or falls back to the single
# NAT when nat_gateway_count == 1 (cost-saving mode).  The min() guards against
# index overflow when private subnets outnumber NATs.
resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[min(count.index, var.nat_gateway_count - 1)].id
  }

  tags = { Name = "${var.project_name}-private-rt-${data.aws_availability_zones.available.names[count.index]}" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# -----------------------------------------------------------------------------
# CloudWatch Log Group
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 30

  tags = { Name = "${var.project_name}-logs" }
}
