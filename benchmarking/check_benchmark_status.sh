#!/bin/bash
# check_benchmark_status.sh - Check the status of benchmark jobs and collect results

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
RUN_NAME="7day-benchmark"  # Default run name for 7-day benchmarks
S3_BUCKET=""
GRAVITON_JOB_ID=""  # Will be provided when running 7-day benchmarks
INTEL_JOB_ID=""     # Will be provided when running 7-day benchmarks
AMD_JOB_ID=""       # Will be provided when running 7-day benchmarks

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
    --name)
      RUN_NAME="$2"
      shift 2
      ;;
    --bucket)
      S3_BUCKET="$2"
      shift 2
      ;;
    --graviton)
      GRAVITON_JOB_ID="$2"
      shift 2
      ;;
    --intel)
      INTEL_JOB_ID="$2"
      shift 2
      ;;
    --amd)
      AMD_JOB_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--profile aws-profile-name] [--region aws-region] [--name run-name] [--bucket s3-bucket-name] [--graviton job-id] [--intel job-id] [--amd job-id]"
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
echo "Checking status of jobs:"
echo "  - Graviton: ${GRAVITON_JOB_ID}"
echo "  - Intel: ${INTEL_JOB_ID}"
echo "  - AMD: ${AMD_JOB_ID}"

# Function to check job status
check_job_status() {
  local job_id="$1"
  local job_type="$2"
  
  if [[ -z "${job_id}" ]]; then
    echo "No ${job_type} job ID provided"
    return 1
  fi
  
  echo "Checking ${job_type} job status..."
  local job_status=$(aws batch describe-jobs --jobs "${job_id}" --query "jobs[0].status" --output text)
  local job_status_reason=$(aws batch describe-jobs --jobs "${job_id}" --query "jobs[0].statusReason" --output text)
  
  if [[ "${job_status_reason}" == "None" ]]; then
    echo "${job_type} Status: ${job_status}"
  else
    echo "${job_type} Status: ${job_status} - ${job_status_reason}"
  fi
  
  echo "${job_status}"
}

# Check status of all jobs
GRAVITON_STATUS=$(check_job_status "${GRAVITON_JOB_ID}" "Graviton")
INTEL_STATUS=$(check_job_status "${INTEL_JOB_ID}" "Intel")
AMD_STATUS=$(check_job_status "${AMD_JOB_ID}" "AMD")

# Collect results if all jobs are complete
if [[ "$GRAVITON_STATUS" == "SUCCEEDED" && "$INTEL_STATUS" == "SUCCEEDED" && "$AMD_STATUS" == "SUCCEEDED" ]]; then
  echo "All jobs completed successfully!"
  
  # Set S3 bucket if not provided
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
  
  echo "Using S3 Bucket: ${S3_BUCKET}"
  
  # Create results directory
  RESULTS_DIR="benchmark-results-${RUN_NAME}"
  mkdir -p ${RESULTS_DIR}
  
  # Download results from S3
  echo "Downloading results from S3..."
  aws s3 cp s3://${S3_BUCKET}/${RUN_NAME}/ ${RESULTS_DIR}/ --recursive
  
  # Extract throughput and hours per day metrics
  if [[ -f "${RESULTS_DIR}/G3-C7G-4-TRANSPORT/results.json" ]]; then
    G3_THROUGHPUT=$(cat ${RESULTS_DIR}/G3-C7G-4-TRANSPORT/results.json | jq -r '.throughput_days_per_day')
    G3_HOURS_PER_DAY=$(cat ${RESULTS_DIR}/G3-C7G-4-TRANSPORT/results.json | jq -r '.hours_per_sim_day')
  else
    G3_THROUGHPUT="N/A"
    G3_HOURS_PER_DAY="N/A"
  fi

  if [[ -f "${RESULTS_DIR}/IN-C7I-4-TRANSPORT/results.json" ]]; then
    IN_THROUGHPUT=$(cat ${RESULTS_DIR}/IN-C7I-4-TRANSPORT/results.json | jq -r '.throughput_days_per_day')
    IN_HOURS_PER_DAY=$(cat ${RESULTS_DIR}/IN-C7I-4-TRANSPORT/results.json | jq -r '.hours_per_sim_day')
  else
    IN_THROUGHPUT="N/A"
    IN_HOURS_PER_DAY="N/A"
  fi

  if [[ -f "${RESULTS_DIR}/AMD-C7A-4-TRANSPORT/results.json" ]]; then
    AMD_THROUGHPUT=$(cat ${RESULTS_DIR}/AMD-C7A-4-TRANSPORT/results.json | jq -r '.throughput_days_per_day')
    AMD_HOURS_PER_DAY=$(cat ${RESULTS_DIR}/AMD-C7A-4-TRANSPORT/results.json | jq -r '.hours_per_sim_day')
  else
    AMD_THROUGHPUT="N/A"
    AMD_HOURS_PER_DAY="N/A"
  fi
  
  # Generate comparison report
  REPORT_FILE="${RESULTS_DIR}/benchmark-comparison.md"
  cat > ${REPORT_FILE} << EOF
# GEOS-Chem Benchmark Comparison Report

Run Name: ${RUN_NAME}
Date: $(date)

## Processor Comparison

| Processor | Instance Type | Throughput (days/day) | Hours per Simulation Day | Relative Performance |
|-----------|--------------|------------------------|--------------------------|----------------------|
| AWS Graviton3 (ARM64) | c7g.4xlarge | ${G3_THROUGHPUT} | ${G3_HOURS_PER_DAY} | 1.00x |
| Intel Sapphire Rapids (x86) | c7i.4xlarge | ${IN_THROUGHPUT} | ${IN_HOURS_PER_DAY} | $(echo "scale=2; ${IN_THROUGHPUT}/${G3_THROUGHPUT}" | bc 2>/dev/null || echo "N/A")x |
| AMD EPYC Genoa (x86) | c7a.4xlarge | ${AMD_THROUGHPUT} | ${AMD_HOURS_PER_DAY} | $(echo "scale=2; ${AMD_THROUGHPUT}/${G3_THROUGHPUT}" | bc 2>/dev/null || echo "N/A")x |

## Cost-Performance Comparison

Instance prices (On-Demand, us-west-2):
- c7g.4xlarge: $0.68 per hour
- c7i.4xlarge: $0.78 per hour
- c7a.4xlarge: $0.68 per hour

| Processor | Cost per Simulation Day ($) | Cost-Performance Ratio |
|-----------|------------------------------|------------------------|
| AWS Graviton3 (ARM64) | $(echo "scale=2; 0.68*24/${G3_THROUGHPUT}" | bc 2>/dev/null || echo "N/A") | 1.00x |
| Intel Sapphire Rapids (x86) | $(echo "scale=2; 0.78*24/${IN_THROUGHPUT}" | bc 2>/dev/null || echo "N/A") | $(echo "scale=2; (0.68*24/${G3_THROUGHPUT})/(0.78*24/${IN_THROUGHPUT})" | bc 2>/dev/null || echo "N/A")x |
| AMD EPYC Genoa (x86) | $(echo "scale=2; 0.68*24/${AMD_THROUGHPUT}" | bc 2>/dev/null || echo "N/A") | $(echo "scale=2; (0.68*24/${G3_THROUGHPUT})/(0.68*24/${AMD_THROUGHPUT})" | bc 2>/dev/null || echo "N/A")x |

*Note: Lower cost-performance ratio means better value (less cost per unit of performance).*

## Raw Data

- [Graviton3 Results](G3-C7G-4-TRANSPORT/results.json)
- [Intel Results](IN-C7I-4-TRANSPORT/results.json)
- [AMD Results](AMD-C7A-4-TRANSPORT/results.json)
EOF

  echo "Benchmark comparison report generated: ${REPORT_FILE}"
  cat ${REPORT_FILE}
else
  echo "Not all jobs are complete yet. Please check again later."
  echo "Currently: "
  echo "  - Graviton: ${GRAVITON_STATUS}"
  echo "  - Intel: ${INTEL_STATUS}"
  echo "  - AMD: ${AMD_STATUS}"
fi