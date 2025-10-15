#!/bin/bash
# collect_environment_info.sh - Collect information about the AWS environment

set -e

# Set environment variables for AWS profile
export AWS_PROFILE=aws
export AWS_REGION=us-west-2

echo "Collecting AWS environment information..."
echo "Using AWS Profile: ${AWS_PROFILE}"
echo "Using AWS Region: ${AWS_REGION}"

# AWS account info
echo "=== AWS Account Info ==="
aws sts get-caller-identity

# List compute environments
echo "=== Compute Environments ==="
aws batch describe-compute-environments

# List job definitions
echo "=== Job Definitions ==="
aws batch describe-job-definitions --status ACTIVE

# Verify ECR repositories
echo "=== ECR Repositories ==="
aws ecr describe-repositories

# Check ECR images
echo "=== ECR Images ==="
repos=$(aws ecr describe-repositories --query "repositories[].repositoryName" --output text)
for repo in $repos; do
  echo "Repository: $repo"
  aws ecr describe-images --repository-name $repo --query "imageDetails[].{Tag:imageTags[0],Pushed:imagePushedAt,Size:imageSizeInBytes}" --output table
done

# Check S3 buckets
echo "=== S3 Buckets ==="
aws s3 ls

# Check CloudWatch status
echo "=== CloudWatch Logs Status ==="
aws logs describe-log-groups

echo "Environment information collection complete."