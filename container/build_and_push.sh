#!/bin/bash
# build_and_push.sh - Build and push the GEOS-Chem container to ECR

set -e

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPOSITORY=geos-chem
TAG=graviton-latest

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} || \
    aws ecr create-repository --repository-name ${ECR_REPOSITORY}

# Get ECR login
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Make scripts executable
chmod +x scripts/*.sh scripts/*.py

# Build the Docker image
docker build -t ${ECR_REPOSITORY}:${TAG} \
    --platform linux/arm64 \
    --progress=plain \
    .

# Tag and push the image
docker tag ${ECR_REPOSITORY}:${TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}

echo "Container built and pushed to ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}"