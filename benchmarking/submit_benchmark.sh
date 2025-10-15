#!/bin/bash
# submit_benchmark.sh - Submit a benchmark job to AWS Batch

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
ARCHITECTURE="arm64" # Options: arm64, amd64
PROCESSOR="" # Options: graviton, intel, amd
CONFIG_FILE=""
S3_BUCKET=""
RUN_NAME=$(date +%Y%m%d-%H%M%S)

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
    --config)
      CONFIG_FILE="$2"
      shift 2
      ;;
    --bucket)
      S3_BUCKET="$2"
      shift 2
      ;;
    --name)
      RUN_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 --config config.json [--profile aws-profile-name] [--region aws-region] [--architecture arm64|amd64] [--processor graviton|intel|amd] [--bucket s3-bucket-name] [--name run-name]"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "${CONFIG_FILE}" ]]; then
  echo "Error: --config argument is required"
  exit 1
fi

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
echo "Architecture: ${ARCHITECTURE}"
echo "Processor: ${PROCESSOR}"
echo "Config File: ${CONFIG_FILE}"
echo "Run Name: ${RUN_NAME}"

# Read the benchmark config file
if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "Error: Config file '${CONFIG_FILE}' not found"
  exit 1
fi

CONFIG_JSON=$(cat "${CONFIG_FILE}")

# Extract benchmark ID
BENCHMARK_ID=$(echo "${CONFIG_JSON}" | jq -r '.id // "benchmark"')

# Set S3 path
if [[ -z "${S3_BUCKET}" ]]; then
  # Use the CloudFormation output to get the bucket name
  S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name BenchmarkingStack \
    --query "Stacks[0].Outputs[?OutputKey=='BenchmarkBucketName'].OutputValue" \
    --output text)
  
  if [[ -z "${S3_BUCKET}" ]]; then
    echo "Warning: Could not determine S3 bucket name from CloudFormation. Using 'aws-geos-chem-benchmarking-results'"
    S3_BUCKET="aws-geos-chem-benchmarking-results"
  fi
fi

OUTPUT_PATH="s3://${S3_BUCKET}/${RUN_NAME}/${BENCHMARK_ID}"
echo "Output Path: ${OUTPUT_PATH}"

# Select job definition and queue based on processor
if [[ "${PROCESSOR}" == "graviton" ]]; then
  JOB_DEF="geos-chem-benchmark-graviton"
  JOB_QUEUE="geos-chem-graviton-queue"
elif [[ "${PROCESSOR}" == "intel" ]]; then
  JOB_DEF="geos-chem-benchmark-intel-new"
  JOB_QUEUE="geos-chem-intel-queue-new"
else
  JOB_DEF="geos-chem-benchmark-amd-new"
  JOB_QUEUE="geos-chem-amd-queue-new"
fi

# Submit job to AWS Batch
JOB_ID=$(aws batch submit-job \
  --job-name "${BENCHMARK_ID}-${RUN_NAME}" \
  --job-queue "${JOB_QUEUE}" \
  --job-definition "${JOB_DEF}" \
  --parameters "{\"configJson\":\"$(echo "${CONFIG_JSON}" | jq -c . | sed 's/"/\\"/g')\", \"outputPath\":\"${OUTPUT_PATH}\"}" \
  --query "jobId" \
  --output text)

echo "Submitted job with ID: ${JOB_ID}"
echo "Job Name: ${BENCHMARK_ID}-${RUN_NAME}"
echo "Job Queue: ${JOB_QUEUE}"
echo "Job Definition: ${JOB_DEF}"

# Monitor job status (max 60 seconds)
echo "Monitoring job status (up to 60 seconds)..."
JOB_STATUS="SUBMITTED"
MAX_WAIT_TIME=60
WAITED=0

while [[ "${JOB_STATUS}" != "SUCCEEDED" && "${JOB_STATUS}" != "FAILED" && ${WAITED} -lt ${MAX_WAIT_TIME} ]]; do
  sleep 10
  WAITED=$((WAITED + 10))
  JOB_STATUS=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].status" --output text)
  JOB_STATUS_REASON=$(aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].statusReason" --output text)

  if [[ "${JOB_STATUS_REASON}" == "None" ]]; then
    echo "Job Status: ${JOB_STATUS} (waited ${WAITED}s / ${MAX_WAIT_TIME}s)"
  else
    echo "Job Status: ${JOB_STATUS} - ${JOB_STATUS_REASON} (waited ${WAITED}s / ${MAX_WAIT_TIME}s)"
  fi

  if [[ ${WAITED} -ge ${MAX_WAIT_TIME} ]]; then
    echo "Reached max wait time. Job is still running."
    break
  fi
done

# Final status
if [[ "${JOB_STATUS}" == "SUCCEEDED" ]]; then
  echo "Job completed successfully!"
  echo "Results available at: ${OUTPUT_PATH}"
else
  echo "Job failed!"
  echo "Check CloudWatch logs for details:"
  echo "  /aws/batch/job"
fi