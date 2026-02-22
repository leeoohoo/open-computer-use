# -----------------------------------------------------------------------------
# Application Load Balancer
# -----------------------------------------------------------------------------

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # Higher idle timeout for long-lived WebSocket connections (Electron bridge)
  idle_timeout = 3600

  # Enable access logs by uncommenting and configuring an S3 bucket
  # access_logs {
  #   bucket  = aws_s3_bucket.alb_logs.id
  #   prefix  = var.project_name
  #   enabled = true
  # }

  tags = { Name = "${var.project_name}-alb" }
}

# -----------------------------------------------------------------------------
# Target Group (routes to the frontend container on port 3000)
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "frontend" {
  name        = "${var.project_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # Required for Fargate awsvpc networking

  health_check {
    enabled             = true
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  # Speed up deployments — drain connections in 30s instead of default 300s
  deregistration_delay = 30

  # Sticky sessions (uncomment if your app needs session affinity)
  # stickiness {
  #   type            = "lb_cookie"
  #   cookie_duration = 86400
  #   enabled         = true
  # }

  tags = { Name = "${var.project_name}-tg" }
}

# -----------------------------------------------------------------------------
# Backend API Target Group (routes to the backend container on port 8001)
# Used by the Electron app to hit the FastAPI backend directly.
# -----------------------------------------------------------------------------

resource "aws_lb_target_group" "backend" {
  name        = "${var.project_name}-backend-tg"
  port        = 8001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = { Name = "${var.project_name}-backend-tg" }
}

# -----------------------------------------------------------------------------
# Backend API Listener (port 8001) — Electron app connects here
# HTTPS when certificate is available (required for wss:// WebSocket),
# falls back to HTTP otherwise.
# -----------------------------------------------------------------------------

resource "aws_lb_listener" "backend" {
  load_balancer_arn = aws_lb.main.arn
  port              = 8001
  protocol          = var.certificate_arn != "" ? "HTTPS" : "HTTP"
  ssl_policy        = var.certificate_arn != "" ? "ELBSecurityPolicy-TLS13-1-2-2021-06" : null
  certificate_arn   = var.certificate_arn != "" ? var.certificate_arn : null

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# -----------------------------------------------------------------------------
# HTTP Listener (port 80)
# When certificate_arn is set: redirects to HTTPS
# When certificate_arn is empty: forwards directly to target group
# -----------------------------------------------------------------------------

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Redirect rule — only added when HTTPS is enabled
resource "aws_lb_listener_rule" "http_redirect" {
  count        = var.certificate_arn != "" ? 1 : 0
  listener_arn = aws_lb_listener.http.arn
  priority     = 1

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# -----------------------------------------------------------------------------
# HTTPS Listener (port 443) — only created when certificate_arn is provided
# -----------------------------------------------------------------------------

resource "aws_lb_listener" "https" {
  count             = var.certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}
