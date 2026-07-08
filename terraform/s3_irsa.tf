# Create S3 Bucket for App Storage (e.g. Patient Documents)
resource "aws_s3_bucket" "app_storage" {
  bucket        = "${var.environment}-careflow-app-storage-${random_string.bucket_suffix.result}"
  force_destroy = true

  tags = {
    Name = "${var.environment}-careflow-app-storage"
  }
}

# Random string for unique bucket name
resource "random_string" "bucket_suffix" {
  length  = 6
  special = false
  upper   = false
}

# IAM Policy for S3 Read access
resource "aws_iam_policy" "s3_read_policy" {
  name        = "${var.environment}-careflow-s3-read-policy"
  description = "Allows EKS pods to read objects from CareFlow S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.app_storage.arn,
          "${aws_s3_bucket.app_storage.arn}/*"
        ]
      }
    ]
  })
}

# EKS IRSA Role for Pods
module "irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "${var.environment}-careflow-s3-reader-role"

  role_policy_arns = {
    s3_read = aws_iam_policy.s3_read_policy.arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["default:careflow-s3-reader-sa"]
    }
  }
}

# GitHub Actions OIDC Provider for keyless deployments
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

# IAM Role for GitHub Actions (pushed directly from repo)
resource "aws_iam_role" "github_actions" {
  name = "${var.environment}-careflow-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:trishank01/careflow:*"
          }
        }
      }
    ]
  })
}

# IAM Policy for ECR registry access from GitHub Action builds
resource "aws_iam_policy" "github_ecr_policy" {
  name        = "${var.environment}-careflow-github-ecr-policy"
  description = "Allows GitHub Actions to push images to Amazon ECR"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_ecr" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_ecr_policy.arn
}

# IAM Policy for SSM Parameter Store read access
resource "aws_iam_policy" "ssm_read_policy" {
  name        = "${var.environment}-careflow-ssm-read-policy"
  description = "Allows EKS pods to read parameters from AWS SSM Parameter Store"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:us-east-2:925216254901:parameter/careflow/*"
        ]
      }
    ]
  })
}

# EKS IRSA Role for External Secrets Operator
module "external_secrets_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name = "${var.environment}-careflow-ssm-reader-role"

  role_policy_arns = {
    ssm_read = aws_iam_policy.ssm_read_policy.arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["external-secrets:external-secrets-sa"]
    }
  }
}

# EKS IRSA Role for EBS CSI Driver
module "ebs_csi_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"

  role_name             = "${var.environment}-careflow-ebs-csi-role"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
}
