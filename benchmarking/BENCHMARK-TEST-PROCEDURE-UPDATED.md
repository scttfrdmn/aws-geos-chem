# AWS GEOS-Chem Benchmarking Test Procedure

This document outlines the steps to run an initial benchmark test on AWS using the 'aws' profile. This procedure validates the benchmarking system with minimal costs before proceeding with a comprehensive benchmark suite.

## Prerequisites

- AWS CLI installed and configured with the 'aws' profile
- AWS CDK installed
- Docker installed and configured
- Python 3.7+ with required packages (`pip install boto3 pyyaml`)
- Appropriate AWS permissions:
  - AWS Batch
  - Amazon ECR
  - Amazon S3
  - AWS Lambda
  - Amazon DynamoDB
  - CloudWatch Logs
  - IAM permissions to deploy CloudFormation stacks

## Step 1: AWS Profile Configuration

Verify the 'aws' profile exists and has the required permissions, and ensure the region is set correctly:

```bash
# Verify the 'aws' profile exists and has required permissions
aws --profile aws sts get-caller-identity

# Ensure region is set to us-west-2 (or your preferred region)
aws configure set region us-west-2 --profile aws

# Verify the region setting
aws configure list --profile aws

# Set as default profile for this session
export AWS_PROFILE=aws
export AWS_REGION=us-west-2
```

> ⚠️ **Important**: Always ensure the AWS region is explicitly set for all commands to avoid "No region set" errors. Setting the region in the profile configuration prevents having to specify it in each command.

## Step 2: Infrastructure Deployment

Deploy the CDK stack with the benchmarking resources:

```bash
# Deploy the CDK stack with the benchmarking resources
cd aws-geos-chem-cdk
npm install
npm run build
cdk deploy BenchmarkingStack --profile aws
```

This will create:
- S3 bucket for benchmark results
- DynamoDB table for benchmark data
- Lambda functions for cost estimation, performance comparison, and instance recommendation
- API Gateway endpoints for the benchmarking API

> 📝 **Note**: If you encounter TypeScript errors in the CDK project, you may need to modify the code to match your specific AWS CDK version. The project was built with AWS CDK v2.115.0.

## Step 3: Set Up AWS Batch Resources

Create the necessary IAM role, instance profile, compute environment, job queue, and job definition:

```bash
# Create IAM role for EC2 instances
aws iam create-role --role-name AmazonECSContainerInstanceRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

# Attach policy to the role
aws iam attach-role-policy --role-name AmazonECSContainerInstanceRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role

# Create instance profile
aws iam create-instance-profile --instance-profile-name AmazonECSContainerInstanceProfile

# Add role to instance profile
aws iam add-role-to-instance-profile --instance-profile-name AmazonECSContainerInstanceProfile \
  --role-name AmazonECSContainerInstanceRole

# Get a subnet ID from your VPC
SUBNET_ID=$(aws ec2 describe-subnets --query "Subnets[0].SubnetId" --output text)

# Get a security group ID
SG_ID=$(aws ec2 describe-security-groups --query "SecurityGroups[0].GroupId" --output text)

# Create compute environment
aws batch create-compute-environment \
  --compute-environment-name geos-chem-graviton \
  --type MANAGED \
  --state ENABLED \
  --compute-resources type=EC2,allocationStrategy=BEST_FIT_PROGRESSIVE,minvCpus=0,maxvCpus=256,desiredvCpus=16,subnets=$SUBNET_ID,securityGroupIds=$SG_ID,instanceTypes=c7g.4xlarge,instanceRole=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):instance-profile/AmazonECSContainerInstanceProfile

# Create job queue
aws batch create-job-queue \
  --job-queue-name geos-chem-graviton-queue \
  --priority 1 \
  --compute-environment-order order=1,computeEnvironment=geos-chem-graviton
```

> ⚠️ **Important**: You cannot mix ARM (e.g., c7g.4xlarge) and x86 (e.g., c6i.4xlarge) instance types in the same compute environment. You need to create separate compute environments for different architectures. For testing, it's simplest to create a single compute environment with just Graviton (ARM64) instances and adapt your benchmark configurations accordingly.

## Step 4: Container Preparation

Build and push a simplified benchmarking container:

```bash
cd ../container

# Create a simplified Dockerfile for benchmarking
cat > Dockerfile.benchmark << 'EOF'
# Base Image: Amazon Linux 2023 for ARM64
FROM --platform=linux/arm64 amazonlinux:2023

LABEL maintainer="GEOS-Chem Cloud Team <info@example.com>"
LABEL description="GEOS-Chem benchmarking container for AWS"
LABEL version="1.0.0"

# Install system dependencies
RUN dnf update -y && \
    dnf install -y \
    aws-cli \
    jq \
    bc \
    python3 \
    python3-pip \
    tar \
    gzip \
    --allowerasing && \
    dnf clean all

# Install Python packages
RUN pip3 install \
    boto3 \
    numpy \
    pandas

# Add benchmarking entrypoint script
COPY benchmarking_entrypoint.sh /usr/local/bin/

# Make script executable
RUN chmod +x /usr/local/bin/benchmarking_entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/benchmarking_entrypoint.sh"]
EOF

# Create entrypoint script that simulates GEOS-Chem execution
cat > benchmarking_entrypoint.sh << 'EOF'
#!/bin/bash
# benchmarking_entrypoint.sh - Entrypoint for benchmarking container

set -e

# Parse command line arguments
BENCHMARK_JSON=""
OUTPUT_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --benchmark)
      BENCHMARK_JSON="$2"
      shift 2
      ;;
    --output-path)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$BENCHMARK_JSON" ]; then
  echo "Error: --benchmark argument is required"
  exit 1
fi

if [ -z "$OUTPUT_PATH" ]; then
  echo "Error: --output-path argument is required"
  exit 1
fi

# Get instance metadata if running on EC2
INSTANCE_TYPE=$(curl -s http://169.254.169.254/latest/meta-data/instance-type || echo "unknown")
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id || echo "unknown")

echo "============================================"
echo "GEOS-Chem Benchmark on AWS"
echo "============================================"
echo "Instance Type: ${INSTANCE_TYPE}"
echo "Instance ID: ${INSTANCE_ID}"
echo "Benchmark Config: ${BENCHMARK_JSON}"
echo "Output Path: ${OUTPUT_PATH}"
echo "============================================"

# Write benchmark config to file
echo "${BENCHMARK_JSON}" > /tmp/benchmark_config.json
cat /tmp/benchmark_config.json

# Extract benchmark parameters
BENCHMARK_ID=$(echo "${BENCHMARK_JSON}" | jq -r '.id')
SIMULATION_TYPE=$(echo "${BENCHMARK_JSON}" | jq -r '.simulation_type')
RESOLUTION=$(echo "${BENCHMARK_JSON}" | jq -r '.domain.resolution')
DURATION_DAYS=$(echo "${BENCHMARK_JSON}" | jq -r '.duration.days')
PROCESSOR_TYPE=$(echo "${BENCHMARK_JSON}" | jq -r '.hardware.processor_type')
ARCHITECTURE=$(echo "${BENCHMARK_JSON}" | jq -r '.hardware.architecture')

echo "Benchmark ID: ${BENCHMARK_ID}"
echo "Simulation Type: ${SIMULATION_TYPE}"
echo "Resolution: ${RESOLUTION}"
echo "Duration (days): ${DURATION_DAYS}"
echo "Processor Type: ${PROCESSOR_TYPE}"
echo "Architecture: ${ARCHITECTURE}"

# Set OpenMP threads based on available CPUs or config
VCPUS=$(echo "${BENCHMARK_JSON}" | jq -r '.hardware.vcpus')
export OMP_NUM_THREADS=${VCPUS}
echo "Using ${OMP_NUM_THREADS} OpenMP threads"

# Set OpenMP environment variables for optimal performance
export OMP_STACKSIZE=500m
export OMP_WAIT_POLICY=active
export OMP_PROC_BIND=close
export OMP_PLACES=cores

# Perform a simulated benchmark (for testing)
echo "Starting benchmark simulation at $(date)"
START_TIME=$(date +%s)

# Sleep to simulate a benchmark run
# In a real benchmark, this would be replaced with an actual GEOS-Chem run
echo "Running simulated benchmark for ${DURATION_DAYS} days..."
SLEEP_SECONDS=$((DURATION_DAYS * 5))  # 5 seconds per simulation day for testing
sleep ${SLEEP_SECONDS}

# End time for benchmarking
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
HOURS=$(echo "scale=2; ${DURATION}/3600" | bc)

echo "Benchmark completed at $(date)"
echo "Total runtime: ${DURATION} seconds (${HOURS} hours)"

# Create a JSON manifest with benchmark results
MANIFEST_FILE="/tmp/manifest.json"
cat > ${MANIFEST_FILE} << EOL
{
  "benchmark_id": "${BENCHMARK_ID}",
  "configuration": $(cat /tmp/benchmark_config.json),
  "run_summary": {
    "start_time": "$(date -d @${START_TIME} -u +%Y-%m-%dT%H:%M:%SZ)",
    "end_time": "$(date -d @${END_TIME} -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": ${DURATION},
    "wall_time": "${HOURS} hours",
    "instance_type": "${INSTANCE_TYPE}",
    "architecture": "${ARCHITECTURE}",
    "processor_type": "${PROCESSOR_TYPE}",
    "omp_num_threads": "${OMP_NUM_THREADS}"
  },
  "performance_metrics": {
    "throughput_days_per_day": $(echo "scale=2; ${DURATION_DAYS} / (${DURATION} / 86400)" | bc),
    "cost_per_sim_day": 1.25,
    "memory_usage_gb": 24.5,
    "cpu_efficiency": 95.2
  },
  "simulation_details": {
    "simulation_type": "${SIMULATION_TYPE}",
    "resolution": "${RESOLUTION}",
    "duration_days": ${DURATION_DAYS}
  }
}
EOL

# Create results file
RESULTS_FILE="/tmp/results.json"
cat > ${RESULTS_FILE} << EOL
{
  "throughput_days_per_day": $(echo "scale=2; ${DURATION_DAYS} / (${DURATION} / 86400)" | bc),
  "cost_per_sim_day": 1.25,
  "memory_usage_gb": 24.5,
  "cpu_efficiency": 95.2
}
EOL

# Upload results to S3
echo "Uploading results to ${OUTPUT_PATH}"
aws s3 cp ${MANIFEST_FILE} ${OUTPUT_PATH}/manifest.json
aws s3 cp ${RESULTS_FILE} ${OUTPUT_PATH}/results.json
aws s3 cp /tmp/benchmark_config.json ${OUTPUT_PATH}/config.json

echo "Benchmark results uploaded to ${OUTPUT_PATH}"
echo "Benchmark completed successfully"
EOF

# Make script executable
chmod +x benchmarking_entrypoint.sh

# Create build script
cat > build_benchmark.sh << 'EOF'
#!/bin/bash
# build_benchmark.sh - Build and push the GEOS-Chem benchmarking container to ECR

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

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="geos-chem"
TAG="benchmark-v1"

echo "AWS Account ID: ${AWS_ACCOUNT_ID}"
echo "ECR Repository: ${ECR_REPOSITORY}"
echo "Image Tag: ${TAG}"

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} || \
  aws ecr create-repository --repository-name ${ECR_REPOSITORY}

# Get ECR login
echo "Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build the Docker image
echo "Building Docker image..."
docker build -t ${ECR_REPOSITORY}:${TAG} \
    -f Dockerfile.benchmark \
    --platform linux/arm64 \
    --progress=plain \
    .

# Tag and push the image
echo "Tagging and pushing image to ECR..."
docker tag ${ECR_REPOSITORY}:${TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}

# Tag as latest
echo "Tagging image as 'latest'..."
docker tag ${ECR_REPOSITORY}:${TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:latest

echo "Container built and pushed to ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}"
echo "Container also tagged as 'latest'"
EOF

# Make script executable
chmod +x build_benchmark.sh

# Build and push the container
./build_benchmark.sh
```

> 📝 **Note**: When building containers for different architectures, you may encounter issues with conflicting packages or platform compatibility. The `--allowerasing` flag for `dnf` helps resolve some package conflicts. If building ARM64 containers on an x86 machine, ensure your Docker setup supports multi-architecture builds.

## Step 5: Create and Register Job Definition

Register the AWS Batch job definition:

```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Register job definition
aws batch register-job-definition \
  --job-definition-name geos-chem-benchmark \
  --type container \
  --container-properties "{
    \"image\": \"${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/geos-chem:latest\",
    \"resourceRequirements\": [
      {\"type\": \"VCPU\", \"value\": \"16\"},
      {\"type\": \"MEMORY\", \"value\": \"32768\"}
    ],
    \"command\": [\"--benchmark\", \"Ref::configJson\", \"--output-path\", \"Ref::outputPath\"],
    \"environment\": [{\"name\": \"OMP_NUM_THREADS\", \"value\": \"16\"}]
  }"
```

> ⚠️ **Important**: Ensure the resource requirements in the job definition (vCPU and memory) don't exceed what the selected instance types can provide. If you specify 16 vCPUs, you'll need an instance type that has at least 16 vCPUs.

## Step 6: Create Minimal Test Configuration

Create a minimal benchmark configuration file that matches your compute environment's architecture:

```bash
cd ../benchmarking

cat > mini-benchmark-config.yaml <<'EOF'
# Phase 1: Single-Node Benchmarks (GC Classic)
phase_1:
  - id: TEST-G3-C7G-4-TRANSPORT
    description: "Transport simulation on Graviton3 c7g.4xlarge"
    application: gc-classic
    simulation_type: transport
    domain:
      type: global
      resolution: 4x5
    duration:
      days: 1
    hardware:
      instance_type: c7g.4xlarge
      processor_type: Graviton3
      architecture: arm64
      vcpus: 16
      memory_gb: 32
    metrics_focus: "Graviton3 baseline"

  - id: TEST-G3-C7G-4-FC
    description: "Full Chemistry simulation on Graviton3 c7g.4xlarge"
    application: gc-classic
    simulation_type: fullchem
    domain:
      type: global
      resolution: 4x5
    duration:
      days: 1
    hardware:
      instance_type: c7g.4xlarge
      processor_type: Graviton3
      architecture: arm64
      vcpus: 16
      memory_gb: 32
    metrics_focus: "Chemistry complexity impact"

# Phase 2: Multi-Node Benchmarks (GCHP) - Empty for test
phase_2: []

# Phase 3: Specialized Benchmarks - Empty for test
phase_3: []

# Phase 4: Real-World Scenarios - Empty for test
phase_4: []
EOF
```

> ⚠️ **Important**: The benchmark configuration must include all four phases, even if they're empty. The configuration validation in the orchestrator script checks for the presence of all phases.

## Step 7: Update Benchmark Orchestrator

Ensure the benchmark orchestrator script has proper region handling:

```bash
# Open the script
nano benchmark-orchestrator.py

# Make sure boto3 clients include region_name
# For example, modify the boto3 client creation in submit_batch_job:

def submit_batch_job(job_params, args):
    """Submit a job to AWS Batch"""
    if args.dry_run:
        logger.info(f"DRY RUN: Would submit Batch job with parameters: {json.dumps(job_params, indent=2)}")
        return "dry-run-job-id"
    
    # Use the AWS_REGION environment variable or default to us-west-2
    region = os.environ.get('AWS_REGION', 'us-west-2')
    logger.info(f"Using AWS region: {region}")
    
    batch_client = boto3.client('batch', region_name=region)
    # ... rest of the function
```

> ⚠️ **Important**: Always provide an explicit region to all boto3 clients to avoid "No region" errors. You should modify similar patterns in the `wait_for_batch_jobs` and `save_benchmark_metadata` functions.

## Step 8: Run the Minimal Benchmark Test

Execute the benchmark orchestrator script with proper Python package dependencies:

```bash
# Install required Python packages
pip install boto3 pyyaml

# Make script executable
chmod +x benchmark-orchestrator.py

# Get the S3 bucket name from CloudFormation outputs
BENCHMARK_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name BenchmarkingStack \
  --query "Stacks[0].Outputs[?OutputKey=='BenchmarkBucketName'].OutputValue" \
  --output text)

# First do a dry run to validate configuration
./benchmark-orchestrator.py \
  --config mini-benchmark-config.yaml \
  --output-bucket $BENCHMARK_BUCKET \
  --job-queue geos-chem-graviton-queue \
  --job-definition geos-chem-benchmark \
  --dry-run

# If the dry run looks good, remove the --dry-run flag to submit the actual jobs
./benchmark-orchestrator.py \
  --config mini-benchmark-config.yaml \
  --output-bucket $BENCHMARK_BUCKET \
  --job-queue geos-chem-graviton-queue \
  --job-definition geos-chem-benchmark
```

> 📝 **Note**: When you submit jobs, the orchestrator script will wait for the jobs to complete. Be aware that AWS Batch may take some time to provision instances, especially when scaling from zero. You can set `--max-concurrent` to limit the number of jobs submitted at once.

## Step 9: Monitor Job Progress

Track the progress of your benchmark jobs:

```bash
# List all jobs with their status
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status SUBMITTED
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status PENDING
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status RUNNABLE
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status STARTING
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status RUNNING
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status SUCCEEDED
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status FAILED

# Check compute environment status
aws batch describe-compute-environments --compute-environments geos-chem-graviton

# Check specific job details (replace with your job ID)
aws batch describe-jobs --jobs job-id-1 job-id-2

# Check S3 for result files
aws s3 ls s3://$BENCHMARK_BUCKET/ --recursive
```

> 📝 **Note**: If jobs remain in RUNNABLE state for a long time, check if the compute environment has successfully provisioned instances. You can increase the `desiredvCpus` to encourage faster provisioning: `aws batch update-compute-environment --compute-environment geos-chem-graviton --compute-resources "desiredvCpus=16"`

## Step 10: Analyze Benchmark Results

Once the jobs complete, analyze the benchmark results:

```bash
chmod +x benchmark-analyzer.py

# Analyze benchmark results
./benchmark-analyzer.py \
  --results-bucket $BENCHMARK_BUCKET \
  --output-dir ./benchmark-reports
```

> 📝 **Note**: If jobs fail to complete or produce results, check CloudWatch Logs for the specific job to identify any issues. Log groups are typically under `/aws/batch/job`.

## Step 11: Clean Up Resources

To avoid unnecessary costs, clean up resources after testing:

```bash
# Terminate any running jobs
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status RUNNING | \
  jq -r '.jobSummaryList[].jobId' | \
  xargs -I {} aws batch terminate-job --job-id {} --reason "Testing complete"

# Scale down compute environment to zero
aws batch update-compute-environment --compute-environment geos-chem-graviton --compute-resources "desiredvCpus=0"

# Option: Delete the CDK stack (only if you don't need these resources anymore)
cd ../aws-geos-chem-cdk
cdk destroy BenchmarkingStack
```

## Common Issues and Solutions

### 1. Region Configuration Issues

**Problem**: "You must specify a region" errors in AWS CLI or boto3 commands.

**Solution**:
- Always set the AWS_REGION environment variable: `export AWS_REGION=us-west-2`
- Configure your AWS profile with a default region: `aws configure set region us-west-2 --profile aws`
- Explicitly include the region in boto3 clients: `boto3.client('batch', region_name=region)`

### 2. Instance Architecture Mixing

**Problem**: Cannot mix ARM (Graviton) and x86 (Intel/AMD) instances in a compute environment.

**Solution**:
- Create separate compute environments for each architecture
- For testing, simplify to a single architecture
- Maintain separate job queues pointing to the appropriate compute environment

### 3. Resource Mismatch

**Problem**: Jobs stay in RUNNABLE state with "MISCONFIGURATION:JOB_RESOURCE_REQUIREMENT" error.

**Solution**:
- Ensure the job's resource requirements match what the instance can provide
- Check that vCPU and memory requirements don't exceed what the instance type can offer
- Update the job definition with appropriate resource requirements

### 4. Scaling Issues

**Problem**: Jobs remain in RUNNABLE state for a long time without starting.

**Solution**:
- Increase desiredvCpus: `aws batch update-compute-environment --compute-environment geos-chem-graviton --compute-resources "desiredvCpus=16"`
- Check if your account has service quotas limiting instance types or count
- Verify the security group and subnet configuration allows proper access

### 5. Container Build Errors

**Problem**: Package conflicts when building containers.

**Solution**:
- Use the `--allowerasing` flag with dnf/yum when there are package conflicts
- For multi-architecture builds, ensure Docker is set up with qemu-user-static
- Test container locally before pushing to ECR

## Expected Outcomes

After completing this procedure, you should have:

1. Validated the end-to-end benchmarking pipeline
2. Generated simulated performance data for benchmarking
3. Populated the DynamoDB table with benchmark metrics
4. Generated visualization reports to compare performance
5. Confirmed the integration with the web interface cost estimation

## Next Steps

After successful validation:

1. Replace the simulated container with a real GEOS-Chem container
2. Run the full benchmark suite defined in `benchmarking-plan.md`
3. Update the web interface with actual benchmark data
4. Document performance findings and cost optimization recommendations
5. Implement automated benchmark scheduling for regular updates