#!/bin/bash
# test-graviton-optimization.sh
# Tests different compiler flags and optimizations for Graviton processors
# This script generates multiple container variants with different optimization settings
# and benchmarks them to find the optimal configuration.

set -e

# Configuration
ECR_REPO="your-ecr-repo"
REGION="us-east-1"
BASE_TAG="geos-chem-graviton-test"
TEST_DATA_PATH="s3://gcgrid-test/mini-test-data/"
OUTPUT_PATH="s3://gcgrid-test-output/graviton-optimization-tests/"
TEST_LENGTH_DAYS=1

# Log file
LOGFILE="graviton-optimization-test-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a ${LOGFILE}) 2>&1

echo "====================================================="
echo "GEOS-Chem Graviton Optimization Testing"
echo "Started at $(date)"
echo "====================================================="

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is required but not installed"
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is required but not installed"
    exit 1
fi

# Create test directory
TEST_DIR="graviton-tests-$(date +%Y%m%d)"
mkdir -p ${TEST_DIR}
cd ${TEST_DIR}

# Test cases - different optimization configurations
declare -A TEST_CASES
TEST_CASES["baseline"]="-O2 -ffast-math -fallow-argument-mismatch"
TEST_CASES["neoverse-v1"]="-O3 -mcpu=neoverse-v1 -ffast-math -fallow-argument-mismatch -march=armv8-a+crc"
TEST_CASES["neoverse-n1"]="-O3 -mcpu=neoverse-n1 -ffast-math -fallow-argument-mismatch -march=armv8-a+crc"
TEST_CASES["armv8-a-tune"]="-O3 -march=armv8-a+crc+simd -mtune=neoverse-v1 -ffast-math -fallow-argument-mismatch"
TEST_CASES["armv8-2a"]="-O3 -march=armv8.2-a+crc+simd -ffast-math -fallow-argument-mismatch"
TEST_CASES["aggressive"]="-O3 -mcpu=neoverse-v1 -ffast-math -funroll-loops -fallow-argument-mismatch -march=armv8-a+crc"
TEST_CASES["vectorize"]="-O3 -mcpu=neoverse-v1 -ffast-math -fallow-argument-mismatch -march=armv8-a+crc -ftree-vectorize"

# Function to create Dockerfile with specific optimization flags
create_dockerfile() {
    local test_name=$1
    local flags=$2
    local dockerfile="Dockerfile.${test_name}"
    
    echo "Creating Dockerfile for test case: ${test_name} with flags: ${flags}"
    
    cat > ${dockerfile} << EOF
# Base Image: Amazon Linux 2023 for ARM64
FROM --platform=linux/arm64 amazonlinux:2023

LABEL maintainer="GEOS-Chem Cloud Team <info@example.com>"
LABEL description="GEOS-Chem container optimization test: ${test_name}"
LABEL flags="${flags}"

# Environment variables
ENV GC_VERSION="13.4.0"
ENV GC_ROOT="/opt/geos-chem"
ENV GC_DATA_ROOT="/data"
ENV PATH="\${GC_ROOT}/bin:\${PATH}"
ENV LD_LIBRARY_PATH="\${GC_ROOT}/lib:\${LD_LIBRARY_PATH}"

# Install system dependencies
RUN dnf update -y && \\
    dnf install -y \\
    wget \\
    git \\
    gcc \\
    gcc-gfortran \\
    gcc-c++ \\
    make \\
    cmake \\
    netcdf-devel \\
    netcdf-fortran-devel \\
    hdf5-devel \\
    openmpi-devel \\
    python3 \\
    python3-pip \\
    python3-devel \\
    aws-cli \\
    jq \\
    tar \\
    gzip \\
    zip \\
    unzip \\
    curl \\
    which && \\
    dnf clean all

# Set up Python environment
RUN python3 -m pip install --upgrade pip && \\
    python3 -m pip install \\
    numpy \\
    scipy \\
    pandas \\
    matplotlib \\
    xarray \\
    netCDF4 \\
    pyyaml \\
    boto3

# Create directories
RUN mkdir -p \${GC_ROOT} && \\
    mkdir -p \${GC_ROOT}/bin && \\
    mkdir -p \${GC_ROOT}/lib && \\
    mkdir -p \${GC_DATA_ROOT}

# Clone GEOS-Chem source code
WORKDIR /tmp
RUN git clone https://github.com/geoschem/GCClassic.git && \\
    cd GCClassic && \\
    git checkout 13.4.0 && \\
    git submodule update --init --recursive

# Set optimization flags
ENV FFLAGS="${flags}"
ENV CFLAGS="${flags}"
ENV CXXFLAGS="${flags}"

# Build GEOS-Chem
WORKDIR /tmp/GCClassic/build
RUN cmake .. \\
    -DCMAKE_BUILD_TYPE=Release \\
    -DCMAKE_INSTALL_PREFIX=\${GC_ROOT} \\
    -DRUNDIR=/opt/geos-chem/rundir && \\
    make -j\$(nproc) && \\
    make install

# Set up default run directory
RUN mkdir -p /opt/geos-chem/rundir && \\
    cp -r /tmp/GCClassic/rundir/* /opt/geos-chem/rundir/

# Add test script
RUN echo '#!/bin/bash' > /usr/local/bin/run_test.sh && \\
    echo 'export OMP_NUM_THREADS=\${OMP_NUM_THREADS:-\$(nproc)}' >> /usr/local/bin/run_test.sh && \\
    echo 'echo "Running GEOS-Chem with optimization: ${test_name}"' >> /usr/local/bin/run_test.sh && \\
    echo 'echo "Flags: ${flags}"' >> /usr/local/bin/run_test.sh && \\
    echo 'echo "Using \${OMP_NUM_THREADS} OpenMP threads"' >> /usr/local/bin/run_test.sh && \\
    echo 'start_time=\$(date +%s)' >> /usr/local/bin/run_test.sh && \\
    echo 'cd /opt/geos-chem/rundir' >> /usr/local/bin/run_test.sh && \\
    echo './gcclassic' >> /usr/local/bin/run_test.sh && \\
    echo 'end_time=\$(date +%s)' >> /usr/local/bin/run_test.sh && \\
    echo 'runtime=\$((\$end_time-\$start_time))' >> /usr/local/bin/run_test.sh && \\
    echo 'echo "{ \\"test_name\\": \\"${test_name}\\", \\"flags\\": \\"${flags}\\", \\"runtime_seconds\\": \$runtime }" > /opt/geos-chem/rundir/results.json' >> /usr/local/bin/run_test.sh && \\
    echo 'echo "Test completed in \$runtime seconds"' >> /usr/local/bin/run_test.sh && \\
    echo 'aws s3 cp /opt/geos-chem/rundir/results.json ${OUTPUT_PATH}${test_name}/results.json' >> /usr/local/bin/run_test.sh && \\
    echo 'aws s3 cp /opt/geos-chem/rundir/OutputDir/ ${OUTPUT_PATH}${test_name}/OutputDir/ --recursive' >> /usr/local/bin/run_test.sh && \\
    chmod +x /usr/local/bin/run_test.sh

# Clean up
RUN rm -rf /tmp/GCClassic

# Set working directory to run directory
WORKDIR /opt/geos-chem/rundir

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/run_test.sh"]
EOF
    
    return 0
}

# Function to build and tag a container
build_container() {
    local test_name=$1
    local dockerfile="Dockerfile.${test_name}"
    local tag="${BASE_TAG}-${test_name}"
    
    echo "Building container for test case: ${test_name}"
    echo "Using Dockerfile: ${dockerfile}"
    echo "Tag: ${tag}"
    
    docker build -f ${dockerfile} -t ${tag} .
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to build container for test case: ${test_name}"
        return 1
    fi
    
    echo "Container built successfully for test case: ${test_name}"
    return 0
}

# Function to push container to ECR
push_container() {
    local test_name=$1
    local tag="${BASE_TAG}-${test_name}"
    local ecr_tag="${ECR_REPO}:${tag}"
    
    echo "Pushing container to ECR for test case: ${test_name}"
    
    # Log in to ECR
    aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REPO}
    
    # Tag and push
    docker tag ${tag} ${ecr_tag}
    docker push ${ecr_tag}
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to push container to ECR for test case: ${test_name}"
        return 1
    fi
    
    echo "Container pushed successfully to ECR for test case: ${test_name}"
    return 0
}

# Function to submit a test job to AWS Batch
submit_test_job() {
    local test_name=$1
    local tag="${ECR_REPO}:${BASE_TAG}-${test_name}"
    
    echo "Submitting AWS Batch job for test case: ${test_name}"
    
    # Define job name
    local job_name="geos-chem-optimization-test-${test_name}-$(date +%Y%m%d-%H%M%S)"
    
    # Submit job
    local job_id=$(aws batch submit-job \
        --job-name ${job_name} \
        --job-queue geos-chem-graviton-testing \
        --job-definition geos-chem-graviton-testing \
        --container-overrides "{ \"image\": \"${tag}\", \"environment\": [ { \"name\": \"test_name\", \"value\": \"${test_name}\" } ] }" \
        --region ${REGION} \
        --query jobId \
        --output text)
    
    if [ -z "${job_id}" ]; then
        echo "Error: Failed to submit job for test case: ${test_name}"
        return 1
    fi
    
    echo "Job submitted successfully for test case: ${test_name}"
    echo "Job ID: ${job_id}"
    echo "Job Name: ${job_name}"
    
    # Save job info
    echo "${test_name},${job_id},${job_name},SUBMITTED" >> test_jobs.csv
    
    return 0
}

# Build and submit all test cases
echo "====================================================="
echo "Building and submitting test containers"
echo "====================================================="

for test_name in "${!TEST_CASES[@]}"; do
    flags=${TEST_CASES[$test_name]}
    
    echo "Processing test case: ${test_name}"
    echo "Flags: ${flags}"
    
    create_dockerfile ${test_name} "${flags}"
    build_container ${test_name}
    push_container ${test_name}
    submit_test_job ${test_name}
    
    echo "---------------------------------------------------"
done

# Monitor job status
echo "====================================================="
echo "Monitoring job status"
echo "====================================================="

# Create a function to check job status
check_job_status() {
    local job_id=$1
    local status=$(aws batch describe-jobs --jobs ${job_id} --region ${REGION} --query "jobs[0].status" --output text)
    echo ${status}
}

# Read job IDs from the CSV file
while IFS=, read -r test_name job_id job_name status; do
    echo "Monitoring job: ${job_name} (${job_id}) for test case: ${test_name}"
    
    # Check status until job completes
    while true; do
        status=$(check_job_status ${job_id})
        echo "$(date +%Y-%m-%d\ %H:%M:%S) - ${test_name}: ${status}"
        
        if [[ "${status}" == "SUCCEEDED" || "${status}" == "FAILED" ]]; then
            echo "Job ${job_id} (${test_name}) ${status}"
            break
        fi
        
        sleep 60  # Check every minute
    done
done < test_jobs.csv

# Collect and analyze results
echo "====================================================="
echo "Collecting and analyzing results"
echo "====================================================="

# Create a results directory
mkdir -p results

# Download results from S3
for test_name in "${!TEST_CASES[@]}"; do
    echo "Downloading results for test case: ${test_name}"
    
    aws s3 cp ${OUTPUT_PATH}${test_name}/results.json results/${test_name}_results.json --region ${REGION}
    
    if [ $? -ne 0 ]; then
        echo "Warning: Failed to download results for test case: ${test_name}"
        continue
    fi
done

# Analyze and compare results
echo "====================================================="
echo "Performance Comparison"
echo "====================================================="
echo "Test Case,Flags,Runtime (seconds)"

# Extract and sort runtimes
declare -A runtimes
best_runtime=9999999
best_test=""

for test_name in "${!TEST_CASES[@]}"; do
    if [ -f "results/${test_name}_results.json" ]; then
        runtime=$(jq -r '.runtime_seconds' results/${test_name}_results.json)
        flags=${TEST_CASES[$test_name]}
        
        runtimes[$test_name]=$runtime
        
        echo "${test_name},\"${flags}\",${runtime}"
        
        # Track best performing configuration
        if (( $(echo "${runtime} < ${best_runtime}" | bc -l) )); then
            best_runtime=${runtime}
            best_test=${test_name}
        fi
    else
        echo "${test_name},\"${TEST_CASES[$test_name]}\",N/A"
    fi
done

# Print best configuration
echo "====================================================="
echo "Best Performing Configuration"
echo "====================================================="
echo "Test Case: ${best_test}"
echo "Flags: ${TEST_CASES[$best_test]}"
echo "Runtime: ${best_runtime} seconds"
echo "====================================================="

# Generate JSON report
cat > optimization_results.json << EOF
{
  "test_run_date": "$(date +%Y-%m-%d\ %H:%M:%S)",
  "test_cases": [
EOF

first=true
for test_name in "${!TEST_CASES[@]}"; do
    if [ -f "results/${test_name}_results.json" ]; then
        runtime=${runtimes[$test_name]}
        flags=${TEST_CASES[$test_name]}
        
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> optimization_results.json
        fi
        
        cat >> optimization_results.json << EOF
    {
      "name": "${test_name}",
      "flags": "${flags}",
      "runtime_seconds": ${runtime},
      "speedup_vs_baseline": $(echo "scale=2; ${runtimes[baseline]} / ${runtime}" | bc -l)
    }
EOF
    fi
done

cat >> optimization_results.json << EOF
  ],
  "best_configuration": {
    "name": "${best_test}",
    "flags": "${TEST_CASES[$best_test]}",
    "runtime_seconds": ${best_runtime},
    "speedup_vs_baseline": $(echo "scale=2; ${runtimes[baseline]} / ${best_runtime}" | bc -l)
  }
}
EOF

echo "Results written to optimization_results.json"
echo "Test completed at $(date)"