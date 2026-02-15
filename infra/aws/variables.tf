# -----------------------------------------------------------------------------
# General
# -----------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "llmhub"
}

variable "environment" {
  description = "Environment name (production, staging, dev)"
  type        = string
  default     = "production"
}

# -----------------------------------------------------------------------------
# Networking
# -----------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# -----------------------------------------------------------------------------
# Container Images
# -----------------------------------------------------------------------------

variable "frontend_image" {
  description = "Full ECR image URI for the frontend (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/llmhub-frontend:latest)"
  type        = string
}

variable "backend_image" {
  description = "Full ECR image URI for the backend (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/llmhub-backend:latest)"
  type        = string
}

# -----------------------------------------------------------------------------
# Task Resources
# -----------------------------------------------------------------------------

variable "task_cpu" {
  description = "Total CPU units for the Fargate task (1024 = 1 vCPU). Must be >= sum of container CPUs."
  type        = number
  default     = 1024
}

variable "task_memory" {
  description = "Total memory (MiB) for the Fargate task. Must be >= sum of container memory."
  type        = number
  default     = 2048
}

variable "frontend_cpu" {
  description = "CPU units allocated to the frontend container"
  type        = number
  default     = 512
}

variable "frontend_memory" {
  description = "Memory (MiB) allocated to the frontend container"
  type        = number
  default     = 1024
}

variable "backend_cpu" {
  description = "CPU units allocated to the backend container"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Memory (MiB) allocated to the backend container"
  type        = number
  default     = 1024
}

# -----------------------------------------------------------------------------
# Scaling
# -----------------------------------------------------------------------------

variable "desired_count" {
  description = "Initial number of task instances to run"
  type        = number
  default     = 1
}

variable "min_capacity" {
  description = "Minimum number of tasks for auto-scaling"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks for auto-scaling"
  type        = number
  default     = 4
}

variable "cpu_scaling_target" {
  description = "Target CPU utilization (%) to trigger scale-out"
  type        = number
  default     = 70
}

variable "memory_scaling_target" {
  description = "Target memory utilization (%) to trigger scale-out"
  type        = number
  default     = 80
}

# -----------------------------------------------------------------------------
# Load Balancer & HTTPS
# -----------------------------------------------------------------------------

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS. Leave empty for HTTP-only mode."
  type        = string
  default     = ""
}

variable "health_check_path" {
  description = "HTTP path for ALB health checks against the frontend"
  type        = string
  default     = "/api/health"
}

# -----------------------------------------------------------------------------
# Environment Variables
# All config is passed as plain environment variables on the task definition.
# Mark sensitive values as sensitive = true if using Terraform Cloud.
# -----------------------------------------------------------------------------

variable "frontend_env_vars" {
  description = "Environment variables for the frontend container (key = value pairs)"
  type        = map(string)
  default     = {}
}

variable "backend_env_vars" {
  description = "Environment variables for the backend container (key = value pairs)"
  type        = map(string)
  default     = {}
}
