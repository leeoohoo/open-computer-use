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

  # During a rolling deploy the ALB stops forwarding new requests to the
  # deregistering target and waits this long for in-flight requests to finish
  # before yanking the target.  30 s was too short for long-running SSE /
  # streaming endpoints — clients saw truncated responses on every deploy.
  # 120 s drains almost all realistic requests while still letting a deploy
  # complete within a reasonable window.  The AWS default is 300 s.
  #
  # NOTE: ALB (HTTP/HTTPS) target groups do NOT support
  # `deregistration_delay.connection_termination.enabled` — that attribute is
  # NLB-only.  ALB will close idle keepalive connections at the listener's
  # `idle_timeout`, and open SSE streams will be severed when the target is
  # finally removed.  Mitigations live in the app: UvicornWorker gets 90 s
  # `timeout`, SSE handlers emit keepalives, and clients reconnect.
  deregistration_delay = 120

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

  # Backend handles the Electron WebSocket (long-lived) and SSE chat streams.
  # Bumped from 30 s → 120 s to avoid severing long requests mid-deploy.  See
  # the frontend target group above for the full rationale and the ALB vs NLB
  # note on `connection_termination` (ALB does not expose it).
  deregistration_delay = 120

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
