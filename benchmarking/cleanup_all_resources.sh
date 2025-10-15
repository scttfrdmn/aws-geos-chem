#!/bin/bash
# cleanup_all_resources.sh - Clean up all AWS resources created for GEOS-Chem benchmarking

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
FORCE=false

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
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--profile aws-profile-name] [--region aws-region] [--force]"
      exit 1
      ;;
  esac
done

# Set environment variables
export AWS_PROFILE=${PROFILE}
export AWS_REGION=${REGION}

echo "Using AWS Profile: ${AWS_PROFILE}"
echo "Using AWS Region: ${AWS_REGION}"

if [[ "${FORCE}" != "true" ]]; then
  echo "WARNING: This script will delete ALL resources created for GEOS-Chem benchmarking."
  echo "This includes compute environments, job queues, job definitions, and CloudWatch logs."
  echo "This action CANNOT be undone."
  echo ""
  read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
  
  if [[ "${CONFIRM}" != "yes" ]]; then
    echo "Operation cancelled."
    exit 0
  fi
fi

echo "Cleaning up AWS Batch resources..."

# List all job queues
JOB_QUEUES=$(aws batch describe-job-queues --query "jobQueues[?contains(jobQueueName, 'geos-chem')].jobQueueName" --output text)

# Disable and delete job queues
if [[ -n "${JOB_QUEUES}" ]]; then
  echo "Disabling job queues: ${JOB_QUEUES}"
  for QUEUE in ${JOB_QUEUES}; do
    echo "Disabling job queue: ${QUEUE}"
    aws batch update-job-queue --job-queue ${QUEUE} --state DISABLED || true
  done
  
  echo "Waiting for job queues to be disabled..."
  sleep 10
  
  for QUEUE in ${JOB_QUEUES}; do
    echo "Deleting job queue: ${QUEUE}"
    aws batch delete-job-queue --job-queue ${QUEUE} || true
  done
else
  echo "No job queues found."
fi

# List all compute environments
COMPUTE_ENVS=$(aws batch describe-compute-environments --query "computeEnvironments[?contains(computeEnvironmentName, 'geos-chem')].computeEnvironmentName" --output text)

# Disable and delete compute environments
if [[ -n "${COMPUTE_ENVS}" ]]; then
  echo "Disabling compute environments: ${COMPUTE_ENVS}"
  for CE in ${COMPUTE_ENVS}; do
    echo "Disabling compute environment: ${CE}"
    aws batch update-compute-environment --compute-environment ${CE} --state DISABLED || true
  done
  
  echo "Waiting for compute environments to be disabled..."
  sleep 10
  
  for CE in ${COMPUTE_ENVS}; do
    echo "Deleting compute environment: ${CE}"
    aws batch delete-compute-environment --compute-environment ${CE} || true
  done
else
  echo "No compute environments found."
fi

# List all job definitions
JOB_DEFS=$(aws batch describe-job-definitions --status ACTIVE --query "jobDefinitions[?contains(jobDefinitionName, 'geos-chem')].jobDefinitionName" --output text)

# Deregister job definitions
if [[ -n "${JOB_DEFS}" ]]; then
  echo "Deregistering job definitions: ${JOB_DEFS}"
  for JD in ${JOB_DEFS}; do
    REVISIONS=$(aws batch describe-job-definitions --job-definition-name ${JD} --status ACTIVE --query "jobDefinitions[].revision" --output text)
    for REV in ${REVISIONS}; do
      echo "Deregistering job definition: ${JD}:${REV}"
      aws batch deregister-job-definition --job-definition ${JD}:${REV} || true
    done
  done
else
  echo "No job definitions found."
fi

echo "Cleanup complete!"
echo "Note: This script does not delete any ECR repositories or S3 buckets. If you want to delete those resources, use the AWS CLI or console."