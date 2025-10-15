#!/bin/bash
# create_intel_amd_environments.sh - Create Intel and AMD compute environments for GEOS-Chem benchmarking

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"

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
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--profile aws-profile-name] [--region aws-region]"
      exit 1
      ;;
  esac
done

# Set environment variables
export AWS_PROFILE=${PROFILE}
export AWS_REGION=${REGION}

echo "Using AWS Profile: ${AWS_PROFILE}"
echo "Using AWS Region: ${AWS_REGION}"

# Get a subnet ID from the Graviton compute environment
SUBNET_ID=$(aws batch describe-compute-environments --compute-environments geos-chem-graviton --query "computeEnvironments[0].computeResources.subnets[0]" --output text)
SG_ID=$(aws batch describe-compute-environments --compute-environments geos-chem-graviton --query "computeEnvironments[0].computeResources.securityGroupIds[0]" --output text)
INSTANCE_PROFILE_ARN=$(aws batch describe-compute-environments --compute-environments geos-chem-graviton --query "computeEnvironments[0].computeResources.instanceRole" --output text)

echo "Using Subnet ID: ${SUBNET_ID}"
echo "Using Security Group ID: ${SG_ID}"
echo "Using Instance Profile ARN: ${INSTANCE_PROFILE_ARN}"

# Function to wait for compute environment to become valid
wait_for_compute_environment() {
  local ce_name=$1
  local max_attempts=30
  local attempt=1
  local status="CREATING"

  echo "Waiting for compute environment ${ce_name} to become valid..."

  while [[ "${status}" != "VALID" && ${attempt} -le ${max_attempts} ]]; do
    status=$(aws batch describe-compute-environments --compute-environments ${ce_name} --query "computeEnvironments[0].status" --output text)
    echo "Attempt ${attempt}/${max_attempts}: ${ce_name} status is ${status}"

    if [[ "${status}" == "VALID" ]]; then
      echo "Compute environment ${ce_name} is now valid."
      return 0
    elif [[ "${status}" == "INVALID" ]]; then
      echo "Error: Compute environment ${ce_name} is invalid."
      aws batch describe-compute-environments --compute-environments ${ce_name} --query "computeEnvironments[0].statusReason" --output text
      return 1
    fi

    attempt=$((attempt+1))
    sleep 10
  done

  if [[ ${attempt} -gt ${max_attempts} ]]; then
    echo "Error: Timed out waiting for compute environment ${ce_name} to become valid."
    return 1
  fi
}

# Create compute environment for Intel instances
echo "Creating compute environment for Intel (x86) instances..."
aws batch create-compute-environment \
  --compute-environment-name geos-chem-intel-new \
  --type MANAGED \
  --state ENABLED \
  --compute-resources "type=EC2,allocationStrategy=BEST_FIT_PROGRESSIVE,minvCpus=0,maxvCpus=256,desiredvCpus=0,subnets=${SUBNET_ID},securityGroupIds=${SG_ID},instanceTypes=c7i.4xlarge,instanceRole=${INSTANCE_PROFILE_ARN}"

# Wait for Intel compute environment to become valid
wait_for_compute_environment "geos-chem-intel-new"

# Create job queue for Intel instances
echo "Creating job queue for Intel instances..."
aws batch create-job-queue \
  --job-queue-name geos-chem-intel-queue-new \
  --priority 1 \
  --compute-environment-order "order=1,computeEnvironment=geos-chem-intel-new"

# Create compute environment for AMD instances
echo "Creating compute environment for AMD (x86) instances..."
aws batch create-compute-environment \
  --compute-environment-name geos-chem-amd-new \
  --type MANAGED \
  --state ENABLED \
  --compute-resources "type=EC2,allocationStrategy=BEST_FIT_PROGRESSIVE,minvCpus=0,maxvCpus=256,desiredvCpus=0,subnets=${SUBNET_ID},securityGroupIds=${SG_ID},instanceTypes=c7a.4xlarge,instanceRole=${INSTANCE_PROFILE_ARN}"

# Wait for AMD compute environment to become valid
wait_for_compute_environment "geos-chem-amd-new"

# Create job queue for AMD instances
echo "Creating job queue for AMD instances..."
aws batch create-job-queue \
  --job-queue-name geos-chem-amd-queue-new \
  --priority 1 \
  --compute-environment-order "order=1,computeEnvironment=geos-chem-amd-new"

echo "Compute environments and job queues created successfully."