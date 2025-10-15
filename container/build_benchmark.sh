#!/bin/bash
# build_benchmark.sh - Build and push the GEOS-Chem benchmarking container to ECR

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
ARCHITECTURE="arm64" # Options: arm64, amd64
TAG="benchmark"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --architecture)
      ARCHITECTURE="$2"
      shift 2
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--profile aws-profile-name] [--region aws-region] [--architecture arm64|amd64] [--tag image-tag]"
      exit 1
      ;;
  esac
done

# Validate architecture
if [[ "${ARCHITECTURE}" != "arm64" && "${ARCHITECTURE}" != "amd64" ]]; then
  echo "Error: Architecture must be 'arm64' or 'amd64'"
  exit 1
fi

# Set environment variables
export AWS_PROFILE=${PROFILE}
export AWS_REGION=${REGION}

echo "Using AWS Profile: ${AWS_PROFILE}"
echo "Using AWS Region: ${AWS_REGION}"
echo "Building for Architecture: ${ARCHITECTURE}"
echo "Image Tag: ${TAG}"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="geos-chem"

echo "AWS Account ID: ${AWS_ACCOUNT_ID}"
echo "ECR Repository: ${ECR_REPOSITORY}"

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} || \
  aws ecr create-repository --repository-name ${ECR_REPOSITORY}

# Get ECR login
echo "Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Make entrypoint script executable
chmod +x benchmarking_entrypoint.sh

# Determine platform flag and Dockerfile based on architecture
if [[ "${ARCHITECTURE}" == "arm64" ]]; then
  PLATFORM="linux/arm64"
  ARCH_TAG="${TAG}-arm64"
  DOCKERFILE="Dockerfile.benchmark.arm64"
else
  PLATFORM="linux/amd64"
  ARCH_TAG="${TAG}-amd64"
  DOCKERFILE="Dockerfile.benchmark.amd64"
fi

# Build the Docker image
echo "Building Docker image for ${PLATFORM} using ${DOCKERFILE}..."
docker buildx build -t ${ECR_REPOSITORY}:${ARCH_TAG} \
    -f ${DOCKERFILE} \
    --platform ${PLATFORM} \
    --progress=plain \
    --load \
    .

# Tag and push the image
echo "Tagging and pushing image to ECR..."
docker tag ${ECR_REPOSITORY}:${ARCH_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${ARCH_TAG}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${ARCH_TAG}

# Update latest tag for this architecture
echo "Updating 'latest-${ARCHITECTURE}' tag..."
docker tag ${ECR_REPOSITORY}:${ARCH_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest-${ARCHITECTURE}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest-${ARCHITECTURE}

# If this is the default architecture, also update the generic latest tag
if [[ "${ARCHITECTURE}" == "arm64" ]]; then
  echo "Updating generic 'latest' tag with ARM64 image..."
  docker tag ${ECR_REPOSITORY}:${ARCH_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest
  docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest
fi

echo "Container built and pushed to ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${ARCH_TAG}"
echo "Container also tagged as 'latest-${ARCHITECTURE}'"
if [[ "${ARCHITECTURE}" == "arm64" ]]; then
  echo "Container also tagged as 'latest'"
fi