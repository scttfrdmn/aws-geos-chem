#!/bin/bash
# run_real_benchmark.sh - Run real GEOS-Chem benchmarks on all three processor types

set -e

# Parse arguments
PROFILE="aws"
REGION="us-west-2"
RUN_NAME="real-benchmark-$(date +%Y%m%d-%H%M%S)"
S3_BUCKET=""
DURATION_DAYS=7

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
    --days)
      DURATION_DAYS="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--profile aws-profile-name] [--region aws-region] [--bucket s3-bucket-name] [--name run-name] [--days simulation-days]"
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
echo "Simulation Duration: ${DURATION_DAYS} days"

# Create job definitions if they don't exist
echo "Creating job definitions for real benchmarks..."
./create_real_job_definition.sh --processor graviton
./create_real_job_definition.sh --processor intel
./create_real_job_definition.sh --processor amd

# Create benchmark configurations
mkdir -p sample-configs/real
cat > sample-configs/real/graviton3-real.json << EOF
{
  "id": "G3-C7G-REAL",
  "description": "Real GEOS-Chem benchmark on AWS Graviton3 c7g.4xlarge",
  "application": "gc-classic",
  "simulation_type": "transport",
  "domain": {
    "type": "global",
    "resolution": "4x5"
  },
  "duration": {
    "days": ${DURATION_DAYS}
  },
  "hardware": {
    "instance_type": "c7g.4xlarge",
    "processor_type": "Graviton3",
    "architecture": "arm64",
    "vcpus": 15,
    "memory_gb": 30
  },
  "metrics_focus": "Graviton3 ARM64 benchmark with real computation"
}
EOF

cat > sample-configs/real/intel-real.json << EOF
{
  "id": "IN-C7I-REAL",
  "description": "Real GEOS-Chem benchmark on Intel Sapphire Rapids c7i.4xlarge",
  "application": "gc-classic",
  "simulation_type": "transport",
  "domain": {
    "type": "global",
    "resolution": "4x5"
  },
  "duration": {
    "days": ${DURATION_DAYS}
  },
  "hardware": {
    "instance_type": "c7i.4xlarge",
    "processor_type": "Intel Sapphire Rapids",
    "architecture": "amd64",
    "vcpus": 15,
    "memory_gb": 30
  },
  "metrics_focus": "Intel x86 benchmark with real computation"
}
EOF

cat > sample-configs/real/amd-real.json << EOF
{
  "id": "AMD-C7A-REAL",
  "description": "Real GEOS-Chem benchmark on AMD EPYC Genoa c7a.4xlarge",
  "application": "gc-classic",
  "simulation_type": "transport",
  "domain": {
    "type": "global",
    "resolution": "4x5"
  },
  "duration": {
    "days": ${DURATION_DAYS}
  },
  "hardware": {
    "instance_type": "c7a.4xlarge",
    "processor_type": "AMD EPYC Genoa",
    "architecture": "amd64",
    "vcpus": 15,
    "memory_gb": 30
  },
  "metrics_focus": "AMD x86 benchmark with real computation"
}
EOF

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
  cat > ${params_file} << EOL
{
  "configJson": $(jq -c . ${config_file} | jq -R .),
  "outputPath": "${s3_path}"
}
EOL
  
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
echo "Starting real benchmarks for all three processor types with run name: ${RUN_NAME}"

# Run Graviton (ARM64) benchmark
echo "Submitting Graviton benchmark job..."
JOB_ID_GRAVITON=$(submit_benchmark "graviton" "sample-configs/real/graviton3-real.json" "geos-chem-benchmark-graviton-real")
echo "Graviton Job ID: ${JOB_ID_GRAVITON}"

# Run Intel (x86) benchmark
echo "Submitting Intel benchmark job..."
JOB_ID_INTEL=$(submit_benchmark "intel" "sample-configs/real/intel-real.json" "geos-chem-benchmark-intel-real")
echo "Intel Job ID: ${JOB_ID_INTEL}"

# Run AMD (x86) benchmark
echo "Submitting AMD benchmark job..."
JOB_ID_AMD=$(submit_benchmark "amd" "sample-configs/real/amd-real.json" "geos-chem-benchmark-amd-real")
echo "AMD Job ID: ${JOB_ID_AMD}"

# Create a status check script for these jobs
STATUS_SCRIPT="${RESULTS_DIR}/check_status.sh"
# Extract the job IDs from the output
GRAVITON_ID=$(echo "${JOB_ID_GRAVITON}" | awk 'END{print $NF}')
INTEL_ID=$(echo "${JOB_ID_INTEL}" | awk 'END{print $NF}')
AMD_ID=$(echo "${JOB_ID_AMD}" | awk 'END{print $NF}')

cat > ${STATUS_SCRIPT} << EOF
#!/bin/bash
# Auto-generated script to check the status of real benchmark jobs

cd \$(dirname \$0)/..
./check_benchmark_status.sh \\
  --name ${RUN_NAME} \\
  --graviton ${GRAVITON_ID} \\
  --intel ${INTEL_ID} \\
  --amd ${AMD_ID} \\
  "\$@"
EOF

chmod +x ${STATUS_SCRIPT}

# Provide instructions
echo ""
echo "Real benchmarks have been submitted."
echo ""
echo "Job Details:"
echo "  - Graviton Job ID: ${JOB_ID_GRAVITON}"
echo "  - Intel Job ID: ${JOB_ID_INTEL}"
echo "  - AMD Job ID: ${JOB_ID_AMD}"
echo ""
echo "To check job status, run:"
echo "  ${STATUS_SCRIPT}"
echo ""
echo "These jobs will run real computational benchmarks and the execution times"
echo "will reflect actual performance differences between processor architectures."
echo ""
echo "Real benchmark submission complete!"