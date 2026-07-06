resource "aws_security_group" "rds" {
  name        = "${var.environment}-careflow-rds-sg"
  description = "Security group for CareFlow RDS instance restricting access to EKS worker nodes"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS node security group"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.environment}-careflow-rds-sg"
  }
}

resource "random_password" "db_password" {
  length  = 16
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier           = "${var.environment}-careflow-postgres"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.t3.micro"
  allocated_storage    = 20
  max_allocated_storage = 100
  storage_type         = "gp3"

  db_name  = var.db_name
  username = var.db_user
  password = random_password.db_password.result

  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  skip_final_snapshot = true
  multi_az            = false

  tags = {
    Name = "${var.environment}-careflow-postgres"
  }
}
