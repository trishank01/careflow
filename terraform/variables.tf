variable "aws_region" {
  description = "AWS region where resources will be deployed"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Environment name (e.g. dev, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "cluster_name" {
  description = "Name of the EKS Cluster"
  type        = string
  default     = "careflow-eks"
}

variable "db_name" {
  description = "Database name for the PostgreSQL instance"
  type        = string
  default     = "careflow_db"
}

variable "db_user" {
  description = "Database administrator username"
  type        = string
  default     = "dbadmin"
}
