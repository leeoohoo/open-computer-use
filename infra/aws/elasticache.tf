# =============================================================================
# ElastiCache (Valkey 7) replication group
# =============================================================================
# Backs the rate limiter, JWT-claim cache, image-compression LRU, screenshot
# hot cache, and circuit-breaker state shared across backend replicas.  Single
# shard (cluster mode disabled) with `redis_replica_count` read replicas in
# different AZs for HA.  Encryption in-transit + at-rest.
#
# Engine choice: Valkey 7 — open-source fork of Redis 7.2 that AWS introduced
# as the recommended replacement after the Redis 7.4 license change.  Same
# wire protocol; existing redis-py / redis.asyncio clients work unchanged.
# =============================================================================

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-cache-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${var.project_name}-cache-subnet" }
}

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Allow Redis access from ECS tasks only"
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${var.project_name}-redis-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_ecs" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis port from ECS service SG"
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.ecs.id
}

resource "aws_vpc_security_group_egress_rule" "redis_egress" {
  security_group_id = aws_security_group.redis.id
  description       = "Egress (required by AWS managed service)"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project_name}-cache"
  description          = "Coasty shared cache: rate limiter, JWT cache, hot images, circuit breaker"

  engine               = "valkey"
  engine_version       = "7.2"
  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = var.redis_parameter_group_name

  # 1 primary + N replicas.  Setting num_cache_clusters >= 2 enables Multi-AZ
  # automatic failover, which is required for prod.  Setting it to 1 is the
  # cost-saving dev/staging mode (no failover).
  num_cache_clusters         = 1 + var.redis_replica_count
  automatic_failover_enabled = var.redis_replica_count > 0
  multi_az_enabled           = var.redis_replica_count > 0

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Security: encrypt at rest + in transit.  Transit mode `preferred` accepts
  # both TLS and plaintext to permit a clients-don't-do-TLS-yet rolling
  # cutover; flip to `required` once all clients use rediss://.
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  transit_encryption_mode    = "preferred"

  # Maintenance batched into the next window — never apply changes immediately
  # because that can trigger a brief failover under load.
  apply_immediately       = false
  snapshot_retention_limit = var.redis_snapshot_retention_days
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "sun:05:00-sun:07:00"

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.ecs.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  tags = { Name = "${var.project_name}-cache" }
}
