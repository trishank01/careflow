output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "eks_cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "Kubernetes Cluster Name"
  value       = module.eks.cluster_name
}

output "rds_endpoint" {
  description = "The connection endpoint of the RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "The address of the RDS instance"
  value       = aws_db_instance.postgres.address
}

output "oidc_provider_arn" {
  description = "The ARN of the OIDC Provider for EKS cluster"
  value       = module.eks.oidc_provider_arn
}
