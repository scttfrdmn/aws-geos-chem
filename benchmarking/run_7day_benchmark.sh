#!/bin/bash
# run_7day_benchmark.sh - Run 7-day benchmarks on all three processor types

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
RUN_NAME="7day-benchmark-$(date +%Y%m%d-%H%M%S)"
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

# Create job definitions if they don't exist
echo "Creating job definitions for 7-day benchmarks..."
./create_7day_job_definition.sh --processor graviton
./create_7day_job_definition.sh --processor intel
./create_7day_job_definition.sh --processor amd

# Additional bucket parameter if provided
BUCKET_PARAM=""
if [[ -n "${S3_BUCKET}" ]]; then
  BUCKET_PARAM="--bucket ${S3_BUCKET}"
fi

# Create a results directory
RESULTS_DIR="benchmark-results-${RUN_NAME}"
mkdir -p ${RESULTS_DIR}

# Function to submit a benchmark job
submit_benchmark() {
  local processor="$1"
  local config_file="$2"
  local job_def_name="$3"

  echo "Submitting ${processor} benchmark job..."
  
  # Read and compress the JSON configuration to a single line
  local config_json=$(cat ${config_file} | jq -c .)

  # Create S3 output path
  local s3_path="s3://${S3_BUCKET}/${RUN_NAME}/$(echo ${config_json} | jq -r '.id')"
  if [[ -z "${S3_BUCKET}" ]]; then
    # Use CloudFormation stack output for bucket name if not provided
    local bucket_name=$(aws cloudformation describe-stacks \
      --stack-name BenchmarkingStack \
      --query "Stacks[0].Outputs[?OutputKey=='BenchmarkBucketName'].OutputValue" \
      --output text)
    
    if [[ -z "${bucket_name}" ]]; then
      echo "Warning: Could not determine S3 bucket name. Using default name."
      bucket_name="aws-geos-chem-benchmarking-results"
    fi
    
    s3_path="s3://${bucket_name}/${RUN_NAME}/$(echo ${config_json} | jq -r '.id')"
  fi
  
  echo "Output path: ${s3_path}"
  
  # Create a temporary file for the parameters JSON
  local params_file=$(mktemp)

  # Write properly escaped JSON parameters to the temporary file
  cat > ${params_file} << EOF
{
  "configJson": $(jq -c . ${config_file} | jq -R .),
  "outputPath": "${s3_path}"
}
EOF

  # Set the correct job queue name based on processor type
  local queue_name
  if [[ "${processor}" == "graviton" ]]; then
    queue_name="geos-chem-graviton-queue"
  elif [[ "${processor}" == "intel" ]]; then
    queue_name="geos-chem-intel-queue-new"
  else
    queue_name="geos-chem-amd-queue-new"
  fi

  # Submit the job using the parameters file
  local job_id=$(aws batch submit-job \
    --job-name "$(echo ${config_json} | jq -r '.id')-${RUN_NAME}" \
    --job-queue "${queue_name}" \
    --job-definition "${job_def_name}" \
    --parameters file://${params_file} \
    --query jobId --output text)

  # Clean up the temporary file
  rm -f ${params_file}
  
  echo "Submitted job with ID: ${job_id}"
  echo ${job_id}
}

# Submit jobs for all three processor types
echo "Starting 7-day benchmarks for all three processor types with run name: ${RUN_NAME}"

# Run Graviton (ARM64) benchmark
JOB_ID_GRAVITON=$(submit_benchmark "graviton" "sample-configs/7-day/graviton3-c7g-transport-7d.json" "geos-chem-benchmark-graviton-7day")
echo "Graviton Job ID: ${JOB_ID_GRAVITON}"

# Run Intel (x86) benchmark
JOB_ID_INTEL=$(submit_benchmark "intel" "sample-configs/7-day/intel-c7i-transport-7d.json" "geos-chem-benchmark-intel-7day")
echo "Intel Job ID: ${JOB_ID_INTEL}"

# Run AMD (x86) benchmark
JOB_ID_AMD=$(submit_benchmark "amd" "sample-configs/7-day/amd-c7a-transport-7d.json" "geos-chem-benchmark-amd-7day")
echo "AMD Job ID: ${JOB_ID_AMD}"

# Create a status check script for these jobs
STATUS_SCRIPT="${RESULTS_DIR}/check_status.sh"
cat > ${STATUS_SCRIPT} << EOF
#!/bin/bash
# Auto-generated script to check the status of 7-day benchmark jobs

cd \$(dirname \$0)/..
./check_benchmark_status.sh \\
  --name ${RUN_NAME} \\
  --graviton ${JOB_ID_GRAVITON} \\
  --intel ${JOB_ID_INTEL} \\
  --amd ${JOB_ID_AMD} \\
  "\$@"
EOF

chmod +x ${STATUS_SCRIPT}

# Provide instructions
echo ""
echo "7-day benchmarks have been submitted."
echo ""
echo "Job Details:"
echo "  - Graviton Job ID: ${JOB_ID_GRAVITON}"
echo "  - Intel Job ID: ${JOB_ID_INTEL}"
echo "  - AMD Job ID: ${JOB_ID_AMD}"
echo ""
echo "To check job status, run:"
echo "  ${STATUS_SCRIPT}"
echo ""
echo "These jobs will take longer to complete (7 minutes per job) due to the 7-day simulation time."
echo "The hours per day metric will be more meaningful in these longer benchmarks."
echo ""
echo "7-day benchmark submission complete!"