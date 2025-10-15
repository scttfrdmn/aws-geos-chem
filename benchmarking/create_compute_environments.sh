#!/bin/bash
# create_compute_environments.sh - Create AWS Batch compute environments for GEOS-Chem benchmarking

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

# Create IAM role for EC2 instances if it doesn't exist
if ! aws iam get-role --role-name AmazonECSContainerInstanceRole &>/dev/null; then
  echo "Creating IAM role for EC2 instances..."
  aws iam create-role --role-name AmazonECSContainerInstanceRole \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  
  # Attach policy to the role
  aws iam attach-role-policy --role-name AmazonECSContainerInstanceRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role
fi

# Create instance profile if it doesn't exist
if ! aws iam get-instance-profile --instance-profile-name AmazonECSContainerInstanceProfile &>/dev/null; then
  echo "Creating instance profile..."
  aws iam create-instance-profile --instance-profile-name AmazonECSContainerInstanceProfile
  
  # Add role to instance profile
  aws iam add-role-to-instance-profile --instance-profile-name AmazonECSContainerInstanceProfile \
    --role-name AmazonECSContainerInstanceRole
fi

# Get a subnet ID
SUBNET_ID=$(aws ec2 describe-subnets --query "Subnets[0].SubnetId" --output text)
VPC_ID=$(aws ec2 describe-subnets --subnet-ids ${SUBNET_ID} --query "Subnets[0].VpcId" --output text)

echo "Using Subnet ID: ${SUBNET_ID}"
echo "Using VPC ID: ${VPC_ID}"

# Create security group for benchmark instances
SG_NAME="geos-chem-benchmark-sg"
if ! aws ec2 describe-security-groups --filters "Name=group-name,Values=${SG_NAME}" &>/dev/null; then
  echo "Creating security group..."
  SG_ID=$(aws ec2 create-security-group \
    --group-name ${SG_NAME} \
    --description "Security group for GEOS-Chem benchmarking" \
    --vpc-id ${VPC_ID} \
    --query "GroupId" --output text)
  
  # Add SSH access
  aws ec2 authorize-security-group-ingress \
    --group-id ${SG_ID} \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0
else
  SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=${SG_NAME}" --query "SecurityGroups[0].GroupId" --output text)
fi

echo "Using Security Group ID: ${SG_ID}"

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
INSTANCE_PROFILE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:instance-profile/AmazonECSContainerInstanceProfile"

echo "Using Instance Profile ARN: ${INSTANCE_PROFILE_ARN}"

# Create compute environment for Graviton instances
echo "Creating compute environment for Graviton3 (ARM64) instances..."
aws batch create-compute-environment \
  --compute-environment-name geos-chem-graviton \
  --type MANAGED \
  --state ENABLED \
  --compute-resources "type=EC2,allocationStrategy=BEST_FIT_PROGRESSIVE,minvCpus=0,maxvCpus=256,desiredvCpus=0,subnets=${SUBNET_ID},securityGroupIds=${SG_ID},instanceTypes=c7g.4xlarge,instanceRole=${INSTANCE_PROFILE_ARN}"

# Create job queue for Graviton instances
echo "Creating job queue for Graviton instances..."
aws batch create-job-queue \
  --job-queue-name geos-chem-graviton-queue \
  --priority 1 \
  --compute-environment-order "order=1,computeEnvironment=geos-chem-graviton"

# Create compute environment for Intel instances
echo "Creating compute environment for Intel (x86) instances..."
aws batch create-compute-environment \
  --compute-environment-name geos-chem-intel \
  --type MANAGED \
  --state ENABLED \
  --compute-resources "type=EC2,allocationStrategy=BEST_FIT_PROGRESSIVE,minvCpus=0,maxvCpus=256,desiredvCpus=0,subnets=${SUBNET_ID},securityGroupIds=${SG_ID},instanceTypes=c7i.4xlarge,instanceRole=${INSTANCE_PROFILE_ARN}"

# Create job queue for Intel instances
echo "Creating job queue for Intel instances..."
aws batch create-job-queue \
  --job-queue-name geos-chem-intel-queue \
  --priority 1 \
  --compute-environment-order "order=1,computeEnvironment=geos-chem-intel"

# Create compute environment for AMD instances
echo "Creating compute environment for AMD (x86) instances..."
aws batch create-compute-environment \
  --compute-environment-name geos-chem-amd \
  --type MANAGED \
  --state ENABLED \
  --compute-resources "type=EC2,allocationStrategy=BEST_FIT_PROGRESSIVE,minvCpus=0,maxvCpus=256,desiredvCpus=0,subnets=${SUBNET_ID},securityGroupIds=${SG_ID},instanceTypes=c7a.4xlarge,instanceRole=${INSTANCE_PROFILE_ARN}"

# Create job queue for AMD instances
echo "Creating job queue for AMD instances..."
aws batch create-job-queue \
  --job-queue-name geos-chem-amd-queue \
  --priority 1 \
  --compute-environment-order "order=1,computeEnvironment=geos-chem-amd"

echo "Compute environments and job queues created successfully."