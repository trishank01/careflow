data "aws_availability_zones" "available" {
  state = "available"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.environment}-careflow-vpc"
  cidr = var.vpc_cidr

  # Use the first two availability zones
  azs             = slice(data.aws_availability_zones.available.names, 0, 2)
  private_subnets  = ["10.0.10.0/24", "10.0.11.0/24"]
  public_subnets   = ["10.0.1.0/24", "10.0.2.0/24"]
  database_subnets = ["10.0.20.0/24", "10.0.21.0/24"]

  # Isolated Database Subnets (no IGW route)
  create_database_subnet_group           = true
  create_database_subnet_route_table     = true
  create_database_internet_gateway_route = false

  # NAT Gateway for private subnets outbound access
  enable_nat_gateway     = true
  single_nat_gateway     = true
  one_nat_gateway_per_az = false

  enable_dns_hostnames = true
  enable_dns_support   = true

  public_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                      = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"             = "1"
  }

  database_subnet_tags = {
    "Name" = "${var.environment}-careflow-db-subnet"
  }
}
