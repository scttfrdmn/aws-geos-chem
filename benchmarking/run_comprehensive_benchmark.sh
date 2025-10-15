#!/bin/bash
# run_comprehensive_benchmark.sh - Run benchmarks on all three processor types

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
RUN_NAME=$(date +%Y%m%d-%H%M%S)
S3_BUCKET=""

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
      echo "Usage: $0 [--profile aws-profile-name] [--region aws-region] [--bucket s3-bucket-name] [--name run-name]"
      exit 1
      ;;
  esac
done

# Set environment variables
export AWS_PROFILE=${PROFILE}
export AWS_REGION=${REGION}

echo "Using AWS Profile: ${AWS_PROFILE}"
echo "Using AWS Region: ${AWS_REGION}"
echo "Run Name: ${RUN_NAME}"

# Ensure the sample-configs directory exists
mkdir -p sample-configs

# Create sample benchmark configurations if they don't exist
if [[ ! -f "sample-configs/graviton3-c7g-transport.json" ]]; then
  cat > sample-configs/graviton3-c7g-transport.json << EOF
{
  "id": "G3-C7G-4-TRANSPORT",
  "description": "Transport simulation on AWS Graviton3 c7g.4xlarge",
  "application": "gc-classic",
  "simulation_type": "transport",
  "domain": {
    "type": "global",
    "resolution": "4x5"
  },
  "duration": {
    "days": 1
  },
  "hardware": {
    "instance_type": "c7g.4xlarge",
    "processor_type": "Graviton3",
    "architecture": "arm64",
    "vcpus": 15,
    "memory_gb": 30
  },
  "metrics_focus": "Graviton3 ARM64 baseline"
}
EOF
fi

if [[ ! -f "sample-configs/intel-c7i-transport.json" ]]; then
  cat > sample-configs/intel-c7i-transport.json << EOF
{
  "id": "IN-C7I-4-TRANSPORT",
  "description": "Transport simulation on Intel Sapphire Rapids c7i.4xlarge",
  "application": "gc-classic",
  "simulation_type": "transport",
  "domain": {
    "type": "global",
    "resolution": "4x5"
  },
  "duration": {
    "days": 1
  },
  "hardware": {
    "instance_type": "c7i.4xlarge",
    "processor_type": "Intel Sapphire Rapids",
    "architecture": "amd64",
    "vcpus": 15,
    "memory_gb": 30
  },
  "metrics_focus": "Intel x86 7th gen comparison"
}
EOF
fi

if [[ ! -f "sample-configs/amd-c7a-transport.json" ]]; then
  cat > sample-configs/amd-c7a-transport.json << EOF
{
  "id": "AMD-C7A-4-TRANSPORT",
  "description": "Transport simulation on AMD EPYC Genoa c7a.4xlarge",
  "application": "gc-classic",
  "simulation_type": "transport",
  "domain": {
    "type": "global",
    "resolution": "4x5"
  },
  "duration": {
    "days": 1
  },
  "hardware": {
    "instance_type": "c7a.4xlarge",
    "processor_type": "AMD EPYC Genoa",
    "architecture": "amd64",
    "vcpus": 15,
    "memory_gb": 30
  },
  "metrics_focus": "AMD x86 7th gen comparison"
}
EOF
fi

# Ensure the submission script is executable
chmod +x submit_benchmark.sh

# Function to wait for a job to complete
wait_for_job() {
  local job_id="$1"
  local job_status="SUBMITTED"
  local max_wait_time=300  # 5 minutes
  local waited=0

  echo "Waiting for job $job_id to complete (up to 5 minutes)..."

  while [[ "${job_status}" != "SUCCEEDED" && "${job_status}" != "FAILED" && ${waited} -lt ${max_wait_time} ]]; do
    sleep 10
    waited=$((waited + 10))
    job_status=$(aws batch describe-jobs --jobs "${job_id}" --query "jobs[0].status" --output text)
    echo "  Job Status: ${job_status} (waited ${waited}s / ${max_wait_time}s)"

    if [[ ${waited} -ge ${max_wait_time} ]]; then
      echo "  Reached max wait time. Job is still running."
      break
    fi
  done

  echo "Job $job_id status: ${job_status}"
  return 0
}

# Additional bucket parameter if provided
BUCKET_PARAM=""
if [[ -n "${S3_BUCKET}" ]]; then
  BUCKET_PARAM="--bucket ${S3_BUCKET}"
fi

# Submit jobs for all three processor types
echo "Starting benchmarks for all three processor types with run name: ${RUN_NAME}"

# Create a results directory
RESULTS_DIR="benchmark-results-${RUN_NAME}"
mkdir -p ${RESULTS_DIR}

# Run Graviton (ARM64) benchmark
echo "=== Running Graviton3 (ARM64) benchmark ==="
JOB_ID_GRAVITON=$(./submit_benchmark.sh --processor graviton --config sample-configs/graviton3-c7g-transport.json --name ${RUN_NAME} ${BUCKET_PARAM} | grep "Submitted job with ID:" | cut -d' ' -f5)
echo "Graviton Job ID: ${JOB_ID_GRAVITON}"

# Run Intel (x86) benchmark
echo "=== Running Intel Sapphire Rapids (x86) benchmark ==="
JOB_ID_INTEL=$(./submit_benchmark.sh --processor intel --config sample-configs/intel-c7i-transport.json --name ${RUN_NAME} ${BUCKET_PARAM} | grep "Submitted job with ID:" | cut -d' ' -f5)
echo "Intel Job ID: ${JOB_ID_INTEL}"

# Run AMD (x86) benchmark
echo "=== Running AMD EPYC Genoa (x86) benchmark ==="
JOB_ID_AMD=$(./submit_benchmark.sh --processor amd --config sample-configs/amd-c7a-transport.json --name ${RUN_NAME} ${BUCKET_PARAM} | grep "Submitted job with ID:" | cut -d' ' -f5)
echo "AMD Job ID: ${JOB_ID_AMD}"

# Wait for all jobs to complete
echo "Waiting for all benchmarks to complete..."
wait_for_job "${JOB_ID_GRAVITON}"
wait_for_job "${JOB_ID_INTEL}"
wait_for_job "${JOB_ID_AMD}"

# Since we're not waiting for jobs to complete, provide instructions to check results later
echo "Benchmarks have been submitted. Jobs may still be running."
echo ""
echo "Job Details:"
echo "  - Graviton Job ID: ${JOB_ID_GRAVITON}"
echo "  - Intel Job ID: ${JOB_ID_INTEL}"
echo "  - AMD Job ID: ${JOB_ID_AMD}"
echo ""
echo "To check job status, use these commands:"
echo "  aws batch describe-jobs --jobs ${JOB_ID_GRAVITON} --query \"jobs[0].status\" --output text"
echo "  aws batch describe-jobs --jobs ${JOB_ID_INTEL} --query \"jobs[0].status\" --output text"
echo "  aws batch describe-jobs --jobs ${JOB_ID_AMD} --query \"jobs[0].status\" --output text"
echo ""
echo "To collect results once all jobs are complete, run:"
echo "  aws s3 cp s3://${S3_BUCKET}/${RUN_NAME}/ ${RESULTS_DIR}/ --recursive"
echo ""
echo "Comprehensive benchmark submission complete!"