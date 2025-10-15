#!/bin/bash
# create_7day_job_definition.sh - Create AWS Batch job definition for 7-day GEOS-Chem benchmarking

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
ARCHITECTURE="arm64" # Options: arm64, amd64

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
    --processor)
      PROCESSOR="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--profile aws-profile-name] [--region aws-region] [--architecture arm64|amd64] [--processor graviton|intel|amd]"
      exit 1
      ;;
  esac
done

# Validate architecture
if [[ "${ARCHITECTURE}" != "arm64" && "${ARCHITECTURE}" != "amd64" ]]; then
  echo "Error: Architecture must be 'arm64' or 'amd64'"
  exit 1
fi

# Default processor type based on architecture if not specified
if [[ -z "${PROCESSOR}" ]]; then
  if [[ "${ARCHITECTURE}" == "arm64" ]]; then
    PROCESSOR="graviton"
  else
    PROCESSOR="intel"
  fi
fi

# Validate processor
if [[ "${PROCESSOR}" != "graviton" && "${PROCESSOR}" != "intel" && "${PROCESSOR}" != "amd" ]]; then
  echo "Error: Processor must be 'graviton', 'intel', or 'amd'"
  exit 1
fi

# Set environment variables
export AWS_PROFILE=${PROFILE}
export AWS_REGION=${REGION}

echo "Using AWS Profile: ${AWS_PROFILE}"
echo "Using AWS Region: ${AWS_REGION}"
echo "Creating 7-day benchmark job definition for Architecture: ${ARCHITECTURE}, Processor: ${PROCESSOR}"

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Select job definition name and image tag based on architecture and processor
if [[ "${PROCESSOR}" == "graviton" ]]; then
  JOB_DEF_NAME="geos-chem-benchmark-graviton-7day"
  IMAGE_TAG="benchmark-7day-arm64"
elif [[ "${PROCESSOR}" == "intel" ]]; then
  JOB_DEF_NAME="geos-chem-benchmark-intel-7day"
  IMAGE_TAG="benchmark-7day-amd64"
else
  JOB_DEF_NAME="geos-chem-benchmark-amd-7day"
  IMAGE_TAG="benchmark-7day-amd64"
fi

echo "Job Definition Name: ${JOB_DEF_NAME}"
echo "ECR Image Tag: ${IMAGE_TAG}"

# Register job definition
aws batch register-job-definition \
  --job-definition-name ${JOB_DEF_NAME} \
  --type container \
  --container-properties "{
    \"image\": \"${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/geos-chem:${IMAGE_TAG}\",
    \"resourceRequirements\": [
      {\"type\": \"VCPU\", \"value\": \"15\"},
      {\"type\": \"MEMORY\", \"value\": \"30000\"}
    ],
    \"command\": [\"--benchmark\", \"Ref::configJson\", \"--output-path\", \"Ref::outputPath\"],
    \"environment\": [
      {\"name\": \"OMP_NUM_THREADS\", \"value\": \"15\"},
      {\"name\": \"AWS_REGION\", \"value\": \"${AWS_REGION}\"}
    ]
  }"

echo "7-day benchmark job definition ${JOB_DEF_NAME} created successfully."