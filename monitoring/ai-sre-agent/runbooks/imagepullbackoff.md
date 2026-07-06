# Runbook: Diagnosing K8s ImagePullBackOff / ErrImagePull

## Problem Details
* **Symptom**: Pod fails to pull the container image from the registry.
* **Status**: `ImagePullBackOff` or `ErrImagePull`.
* **RCA**: Kubernetes cannot retrieve the container image. Common causes: image name/tag typo, private registry permissions missing, or network issues connecting to ECR/Docker Hub.

## Standard Fixes
1. **Typo Correction**: Double-check the image repository and tag inside the deployment YAML.
2. **Registry Authentication Secrets**: If using a private registry, make sure to add `imagePullSecrets` configuration:
   - Fix: Create a `docker-registry` secret and reference it in the deployment's `imagePullSecrets` array.
3. **AWS IAM ECR Permissions**: If deploying to EKS and using AWS ECR:
   - Fix: Verify the node group IAM role has `AmazonEC2ContainerRegistryReadOnly` policy attached.
