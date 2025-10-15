#!/bin/bash
# get_job_logs.sh - Get logs for AWS Batch jobs

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
JOB_ID=""

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
    --job-id)
      JOB_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 --job-id job-id [--profile aws-profile-name] [--region aws-region]"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "${JOB_ID}" ]]; then
  echo "Error: --job-id argument is required"
  exit 1
fi

# Set environment variables
export AWS_PROFILE=${PROFILE}
export AWS_REGION=${REGION}

echo "Using AWS Profile: ${AWS_PROFILE}"
echo "Using AWS Region: ${AWS_REGION}"
echo "Job ID: ${JOB_ID}"

# Get job details
echo "Getting job details..."
JOB_NAME=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].jobName" --output text)
JOB_STATUS=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].status" --output text)
JOB_STATUS_REASON=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].statusReason" --output text)
JOB_DEFINITION=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].jobDefinition" --output text)
JOB_QUEUE=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].jobQueue" --output text)

echo "Job Name: ${JOB_NAME}"
echo "Job Status: ${JOB_STATUS}"
if [[ "${JOB_STATUS_REASON}" != "None" ]]; then
  echo "Status Reason: ${JOB_STATUS_REASON}"
fi
echo "Job Definition: ${JOB_DEFINITION}"
echo "Job Queue: ${JOB_QUEUE}"

# Get container details
CONTAINER_STATUS=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].container.exitCode" --output text)
CONTAINER_REASON=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].container.reason" --output text)

echo "Container Exit Code: ${CONTAINER_STATUS}"
if [[ "${CONTAINER_REASON}" != "None" ]]; then
  echo "Container Exit Reason: ${CONTAINER_REASON}"
fi

# Get log stream name
LOG_STREAM_NAME=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].container.logStreamName" --output text)

if [[ -z "${LOG_STREAM_NAME}" || "${LOG_STREAM_NAME}" == "None" ]]; then
  echo "No log stream available for this job"
  exit 0
fi

echo "Log Stream Name: ${LOG_STREAM_NAME}"

# Get logs from CloudWatch
echo "Fetching logs from CloudWatch..."
LOG_GROUP="/aws/batch/job"

# Create logs directory
LOGS_DIR="logs"
mkdir -p ${LOGS_DIR}

# Save logs to file
LOG_FILE="${LOGS_DIR}/${JOB_ID}.log"
aws logs get-log-events --log-group-name ${LOG_GROUP} --log-stream-name ${LOG_STREAM_NAME} --query "events[*].message" --output text > ${LOG_FILE}

echo "Logs saved to: ${LOG_FILE}"
echo "Last 20 lines of logs:"
echo "---------------------"
tail -n 20 ${LOG_FILE}
echo "---------------------"
echo "Full logs available in: ${LOG_FILE}"