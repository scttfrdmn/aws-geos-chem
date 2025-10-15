#!/bin/bash
# cleanup_resources.sh - Clean up AWS Batch resources for GEOS-Chem benchmarking

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

# Confirm with user
echo "WARNING: This script will delete all compute environments and job queues for GEOS-Chem benchmarking."
echo "Are you sure you want to proceed? (y/n)"
read -r confirmation

if [[ "${confirmation}" != "y" && "${confirmation}" != "Y" ]]; then
  echo "Operation canceled."
  exit 0
fi

# First disable all job queues
echo "Disabling job queues..."
for QUEUE in geos-chem-graviton-queue geos-chem-intel-queue geos-chem-amd-queue; do
  if aws batch describe-job-queues --job-queues ${QUEUE} &>/dev/null; then
    echo "Disabling job queue: ${QUEUE}"
    aws batch update-job-queue --job-queue ${QUEUE} --state DISABLED
  else
    echo "Job queue not found: ${QUEUE}"
  fi
done

# Wait for job queues to be disabled
echo "Waiting for job queues to be disabled..."
sleep 30

# Delete job queues
echo "Deleting job queues..."
for QUEUE in geos-chem-graviton-queue geos-chem-intel-queue geos-chem-amd-queue; do
  if aws batch describe-job-queues --job-queues ${QUEUE} &>/dev/null; then
    echo "Deleting job queue: ${QUEUE}"
    aws batch delete-job-queue --job-queue ${QUEUE}
  fi
done

# Disable compute environments
echo "Disabling compute environments..."
for CE in geos-chem-graviton geos-chem-intel geos-chem-amd; do
  if aws batch describe-compute-environments --compute-environments ${CE} &>/dev/null; then
    echo "Disabling compute environment: ${CE}"
    aws batch update-compute-environment --compute-environment ${CE} --state DISABLED
  else
    echo "Compute environment not found: ${CE}"
  fi
done

# Wait for compute environments to be disabled
echo "Waiting for compute environments to be disabled..."
sleep 30

# Delete compute environments
echo "Deleting compute environments..."
for CE in geos-chem-graviton geos-chem-intel geos-chem-amd; do
  if aws batch describe-compute-environments --compute-environments ${CE} &>/dev/null; then
    echo "Deleting compute environment: ${CE}"
    aws batch delete-compute-environment --compute-environment ${CE}
  fi
done

# Delete job definitions
echo "Deregistering job definitions..."
for JD in geos-chem-benchmark-graviton geos-chem-benchmark-intel geos-chem-benchmark-amd; do
  # Get all active revisions
  REVISIONS=$(aws batch describe-job-definitions --job-definition-name ${JD} --status ACTIVE --query "jobDefinitions[].revision" --output text)
  if [[ -n "${REVISIONS}" ]]; then
    for REV in ${REVISIONS}; do
      echo "Deregistering job definition: ${JD}:${REV}"
      aws batch deregister-job-definition --job-definition ${JD}:${REV}
    done
  else
    echo "No active job definitions found for: ${JD}"
  fi
done

echo "Cleanup completed successfully!"