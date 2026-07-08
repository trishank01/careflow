terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Note: Ensure this bucket and DynamoDB table are created beforehand or use a local backend if running locally.
  backend "s3" {
    bucket         = "careflow-terraform-state-bucket-925216254901"
    key            = "dev/careflow.tfstate"
    region         = "us-east-2"
    dynamodb_table = "careflow-terraform-state-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "CareFlow"
      ManagedBy   = "Terraform"
    }
  }
}
