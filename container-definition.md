# GEOS-Chem Graviton Container Definition

This document provides the Dockerfile and supporting scripts needed to build a container for running GEOS-Chem on AWS Graviton (ARM64) processors. This container is designed to be used with AWS Batch for efficient cloud-based simulations.

## Dockerfile

```dockerfile
# Base Image: Amazon Linux 2023 for ARM64
FROM --platform=linux/arm64 amazonlinux:2023

LABEL maintainer="GEOS-Chem Cloud Team <your-email@example.com>"
LABEL description="GEOS-Chem container optimized for AWS Graviton processors"
LABEL version="1.0.0"

# Environment variables
ENV GC_VERSION="13.4.0"
ENV GC_ROOT="/opt/geos-chem"
ENV GC_DATA_ROOT="/data"
ENV PATH="${GC_ROOT}/bin:${PATH}"
ENV LD_LIBRARY_PATH="${GC_ROOT}/lib:${LD_LIBRARY_PATH}"

# Install system dependencies
RUN dnf update -y && \
    dnf install -y \
    wget \
    git \
    gcc \
    gcc-gfortran \
    gcc-c++ \
    make \
    cmake \
    netcdf-devel \
    netcdf-fortran-devel \
    hdf5-devel \
    openmpi-devel \
    python3 \
    python3-pip \
    python3-devel \
    vim \
    htop \
    aws-cli \
    jq \
    tar \
    gzip \
    zip \
    unzip \
    curl \
    which && \
    dnf clean all

# Set up Python environment
RUN python3 -m pip install --upgrade pip && \
    python3 -m pip install \
    numpy \
    scipy \
    pandas \
    matplotlib \
    xarray \
    netCDF4 \
    pyyaml \
    boto3 \
    cartopy \
    jupyter \
    jupyterlab \
    gcpy \
    h5py

# Create directories
RUN mkdir -p ${GC_ROOT} && \
    mkdir -p ${GC_ROOT}/bin && \
    mkdir -p ${GC_ROOT}/lib && \
    mkdir -p ${GC_DATA_ROOT}

# Clone GEOS-Chem source code
WORKDIR /tmp
RUN git clone https://github.com/geoschem/GCClassic.git && \
    cd GCClassic && \
    git checkout 13.4.0 && \
    git submodule update --init --recursive

# Set ARM-specific optimization flags
ENV FFLAGS="-O3 -mcpu=neoverse-v1 -ffast-math -fallow-argument-mismatch -march=armv8-a+crc"
ENV CFLAGS="-O3 -mcpu=neoverse-v1 -ffast-math -march=armv8-a+crc"
ENV CXXFLAGS="-O3 -mcpu=neoverse-v1 -ffast-math -march=armv8-a+crc"

# Build GEOS-Chem
WORKDIR /tmp/GCClassic/build
RUN cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX=${GC_ROOT} \
    -DRUNDIR=/opt/geos-chem/rundir && \
    make -j$(nproc) && \
    make install

# Set up default run directory
RUN mkdir -p /opt/geos-chem/rundir && \
    cp -r /tmp/GCClassic/rundir/* /opt/geos-chem/rundir/

# Add utility scripts
COPY scripts/download_data.py /usr/local/bin/
COPY scripts/run_geos_chem.sh /usr/local/bin/
COPY scripts/process_results.py /usr/local/bin/
COPY scripts/entrypoint.sh /usr/local/bin/

# Make scripts executable
RUN chmod +x /usr/local/bin/download_data.py && \
    chmod +x /usr/local/bin/run_geos_chem.sh && \
    chmod +x /usr/local/bin/process_results.py && \
    chmod +x /usr/local/bin/entrypoint.sh

# Clean up
RUN rm -rf /tmp/GCClassic

# Set working directory to run directory
WORKDIR /opt/geos-chem/rundir

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

## Supporting Scripts

### 1. Entrypoint Script (entrypoint.sh)

```bash
#!/bin/bash
# entrypoint.sh - Main entry point for the container

set -e

# Default values
INPUT_PATH=${1:-"s3://gcgrid/GEOS_4x5/GEOS_FP/2016/01/"}
OUTPUT_PATH=${2:-"s3://your-bucket/results/"}
CONFIG_PATH=${3:-""}

# Get instance metadata if running on EC2
INSTANCE_TYPE=$(curl -s http://169.254.169.254/latest/meta-data/instance-type || echo "unknown")
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id || echo "unknown")

echo "============================================"
echo "GEOS-Chem on AWS Graviton"
echo "============================================"
echo "Instance Type: ${INSTANCE_TYPE}"
echo "Instance ID: ${INSTANCE_ID}"
echo "Input Path: ${INPUT_PATH}"
echo "Output Path: ${OUTPUT_PATH}"
echo "Config Path: ${CONFIG_PATH}"
echo "============================================"

# Set OpenMP threads based on available CPUs
export OMP_NUM_THREADS=${OMP_NUM_THREADS:-$(nproc)}
echo "Using ${OMP_NUM_THREADS} OpenMP threads"

# Download configuration if provided
if [ -n "${CONFIG_PATH}" ]; then
    echo "Downloading configuration from ${CONFIG_PATH}"
    aws s3 cp ${CONFIG_PATH} /opt/geos-chem/rundir/geoschem_config.yml
fi

# Download required input data
echo "Downloading input data from ${INPUT_PATH}"
python3 /usr/local/bin/download_data.py --input-path ${INPUT_PATH} --data-dir ${GC_DATA_ROOT}

# Run the model
echo "Starting GEOS-Chem simulation at $(date)"
/usr/local/bin/run_geos_chem.sh

# Process and upload results
echo "Processing results and uploading to ${OUTPUT_PATH}"
python3 /usr/local/bin/process_results.py --output-path ${OUTPUT_PATH}

echo "Simulation completed successfully at $(date)"
```

### 2. Data Download Script (download_data.py)

```python
#!/usr/bin/env python3
# download_data.py - Download required input data for GEOS-Chem

import argparse
import os
import subprocess
import sys
import yaml
import boto3
from datetime import datetime, timedelta

def parse_args():
    parser = argparse.ArgumentParser(description="Download GEOS-Chem input data")
    parser.add_argument("--input-path", required=True, help="S3 path to input data")
    parser.add_argument("--data-dir", default="/data", help="Local directory for data")
    parser.add_argument("--config-file", default="/opt/geos-chem/rundir/geoschem_config.yml", 
                        help="GEOS-Chem configuration file")
    return parser.parse_args()

def read_config(config_file):
    with open(config_file, 'r') as f:
        config = yaml.safe_load(f)
    return config

def get_required_data_paths(config, input_path):
    """Determine what data needs to be downloaded based on configuration"""
    data_paths = []
    
    # Get simulation date range
    start_date = datetime.strptime(config['simulation']['start_date'], "%Y%m%d")
    end_date = datetime.strptime(config['simulation']['end_date'], "%Y%m%d")
    
    # Get met data type (GEOS-FP or MERRA2)
    met_type = config['simulation']['met_field'] if 'met_field' in config['simulation'] else "GEOS_FP"
    
    # Get resolution
    resolution = config['simulation']['resolution'] if 'simulation' in config and 'resolution' in config['simulation'] else "4x5"
    
    # Calculate months needed
    current_date = start_date
    while current_date <= end_date:
        year_month = current_date.strftime("%Y/%m")
        data_path = f"{input_path}/{year_month}/"
        data_paths.append(data_path)
        
        # Move to next month
        next_month = current_date.month + 1
        next_year = current_date.year
        if next_month > 12:
            next_month = 1
            next_year += 1
        current_date = datetime(next_year, next_month, 1)
    
    return data_paths

def download_data(data_paths, data_dir):
    """Download required data from S3"""
    s3 = boto3.client('s3')
    
    for data_path in data_paths:
        # Parse bucket and key from S3 path
        if data_path.startswith('s3://'):
            path_parts = data_path[5:].split('/', 1)
            bucket = path_parts[0]
            prefix = path_parts[1] if len(path_parts) > 1 else ""
        else:
            print(f"Invalid S3 path: {data_path}")
            continue
        
        # Create local directory structure
        local_dir = os.path.join(data_dir, prefix)
        os.makedirs(local_dir, exist_ok=True)
        
        print(f"Downloading data from s3://{bucket}/{prefix} to {local_dir}")
        
        # Use AWS CLI for efficient recursive download
        cmd = [
            "aws", "s3", "cp", 
            f"s3://{bucket}/{prefix}", 
            local_dir,
            "--recursive"
        ]
        
        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            print(f"Error downloading data: {e}")
            sys.exit(1)

def update_config_paths(config, data_dir):
    """Update configuration file with local data paths"""
    # Update ExtData path
    if 'paths' in config:
        config['paths']['ExtData'] = data_dir
    
    # Write updated config
    with open('/opt/geos-chem/rundir/geoschem_config.yml', 'w') as f:
        yaml.dump(config, f, default_flow_style=False)

def main():
    args = parse_args()
    config = read_config(args.config_file)
    data_paths = get_required_data_paths(config, args.input_path)
    download_data(data_paths, args.data_dir)
    update_config_paths(config, args.data_dir)
    print("Data download complete")

if __name__ == "__main__":
    main()
```

### 3. Run Script (run_geos_chem.sh)

```bash
#!/bin/bash
# run_geos_chem.sh - Run the GEOS-Chem simulation

set -e

# Directory setup
RUN_DIR="/opt/geos-chem/rundir"
cd ${RUN_DIR}

# Set OpenMP environment variables for optimal performance on Graviton
export OMP_STACKSIZE=500m
export OMP_WAIT_POLICY=active
export OMP_PROC_BIND=close
export OMP_PLACES=cores

# Start time for benchmarking
START_TIME=$(date +%s)

# Create log file with timestamp
LOG_FILE="gc_${START_TIME}.log"

# Run GEOS-Chem
echo "Running GEOS-Chem in ${RUN_DIR}"
echo "Execution time started at $(date)"

# Execute GEOS-Chem and capture logs
${GC_ROOT}/bin/gcclassic | tee ${LOG_FILE}

# End time for benchmarking
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
HOURS=$(echo "scale=2; ${DURATION}/3600" | bc)

echo "Execution completed at $(date)"
echo "Total runtime: ${DURATION} seconds (${HOURS} hours)"

# Parse log file for performance metrics
WALL_TIME=$(grep -i "Elapsed wall time" ${LOG_FILE} | awk '{print $NF}')
COMPUTE_TIME=$(grep -i "Chemistry computation" ${LOG_FILE} | awk '{print $NF}')
TOTAL_TIME=$(grep -i "Total model" ${LOG_FILE} | awk '{print $NF}')

# Create a simple JSON summary of the run
cat > ${RUN_DIR}/run_summary.json << EOL
{
  "start_time": "$(date -d @${START_TIME} -u +%Y-%m-%dT%H:%M:%SZ)",
  "end_time": "$(date -d @${END_TIME} -u +%Y-%m-%dT%H:%M:%SZ)",
  "duration_seconds": ${DURATION},
  "wall_time": "${WALL_TIME}",
  "compute_time": "${COMPUTE_TIME}",
  "total_model_time": "${TOTAL_TIME}",
  "instance_type": "$(curl -s http://169.254.169.254/latest/meta-data/instance-type || echo 'unknown')",
  "cpu_info": "$(lscpu | grep 'Model name' || echo 'unknown')",
  "memory_total": "$(free -m | grep Mem | awk '{print $2}') MB",
  "omp_num_threads": "${OMP_NUM_THREADS}"
}
EOL

echo "Run summary saved to ${RUN_DIR}/run_summary.json"
```

### 4. Results Processing Script (process_results.py)

```python
#!/usr/bin/env python3
# process_results.py - Process and upload GEOS-Chem results

import argparse
import os
import json
import subprocess
import glob
import boto3
from datetime import datetime

def parse_args():
    parser = argparse.ArgumentParser(description="Process and upload GEOS-Chem results")
    parser.add_argument("--output-path", required=True, help="S3 path for results")
    parser.add_argument("--run-dir", default="/opt/geos-chem/rundir", help="GEOS-Chem run directory")
    return parser.parse_args()

def collect_diagnostics(run_dir):
    """Collect diagnostic files and metadata"""
    diagnostics = {
        "output_files": [],
        "log_files": [],
        "config_files": [],
        "restart_files": []
    }
    
    # Output NetCDF files
    for file in glob.glob(f"{run_dir}/OutputDir/*.nc*"):
        diagnostics["output_files"].append(file)
    
    # Log files
    for file in glob.glob(f"{run_dir}/*.log"):
        diagnostics["log_files"].append(file)
    
    # Configuration files
    for file in glob.glob(f"{run_dir}/*.yml") + glob.glob(f"{run_dir}/*.rc"):
        diagnostics["config_files"].append(file)
    
    # Restart files
    for file in glob.glob(f"{run_dir}/Restarts/*.nc*"):
        diagnostics["restart_files"].append(file)
    
    return diagnostics

def create_manifest(run_dir, diagnostics, output_path):
    """Create a manifest file with metadata about the run"""
    # Load run summary if it exists
    summary_file = f"{run_dir}/run_summary.json"
    summary = {}
    if os.path.exists(summary_file):
        with open(summary_file, 'r') as f:
            summary = json.load(f)
    
    # Create manifest
    manifest = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "run_summary": summary,
        "output_files": [os.path.basename(f) for f in diagnostics["output_files"]],
        "log_files": [os.path.basename(f) for f in diagnostics["log_files"]],
        "config_files": [os.path.basename(f) for f in diagnostics["config_files"]],
        "restart_files": [os.path.basename(f) for f in diagnostics["restart_files"]],
        "output_location": output_path
    }
    
    # Write manifest locally
    manifest_file = f"{run_dir}/manifest.json"
    with open(manifest_file, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    return manifest_file

def upload_results(diagnostics, manifest_file, output_path):
    """Upload results to S3"""
    # Parse bucket and prefix
    if output_path.startswith('s3://'):
        path_parts = output_path[5:].split('/', 1)
        bucket = path_parts[0]
        prefix = path_parts[1] if len(path_parts) > 1 else ""
    else:
        print(f"Invalid S3 path: {output_path}")
        return
    
    s3 = boto3.client('s3')
    
    # Upload manifest
    manifest_key = f"{prefix}/manifest.json"
    print(f"Uploading manifest to s3://{bucket}/{manifest_key}")
    s3.upload_file(manifest_file, bucket, manifest_key)
    
    # Upload output files
    for file_type in diagnostics:
        for file in diagnostics[file_type]:
            file_name = os.path.basename(file)
            key = f"{prefix}/{file_type}/{file_name}"
            print(f"Uploading {file} to s3://{bucket}/{key}")
            s3.upload_file(file, bucket, key)
    
    print(f"All results uploaded to s3://{bucket}/{prefix}/")

def main():
    args = parse_args()
    diagnostics = collect_diagnostics(args.run_dir)
    manifest_file = create_manifest(args.run_dir, diagnostics, args.output_path)
    upload_results(diagnostics, manifest_file, args.output_path)
    print("Results processing and upload complete")

if __name__ == "__main__":
    main()
```

## AWS Batch Job Definition

Here's an example AWS Batch job definition for running the GEOS-Chem container on Graviton processors:

```json
{
  "jobDefinitionName": "geos-chem-graviton",
  "type": "container",
  "containerProperties": {
    "image": "012345678901.dkr.ecr.us-east-1.amazonaws.com/geos-chem:graviton-latest",
    "vcpus": 64,
    "memory": 128000,
    "command": [
      "s3://gcgrid/GEOS_4x5/GEOS_FP/2016/01/",
      "Ref::outputPath",
      "Ref::configPath"
    ],
    "jobRoleArn": "arn:aws:iam::012345678901:role/GEOSChemBatchJobRole",
    "environment": [
      {
        "name": "OMP_NUM_THREADS",
        "value": "64"
      }
    ],
    "resourceRequirements": [
      {
        "type": "VCPU",
        "value": "64"
      },
      {
        "type": "MEMORY",
        "value": "128000"
      }
    ],
    "linuxParameters": {
      "devices": [],
      "tmpfs": [
        {
          "containerPath": "/scratch",
          "size": 102400,
          "mountOptions": [
            "rw",
            "noatime"
          ]
        }
      ]
    },
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/aws/batch/geos-chem",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "geos-chem-graviton"
      }
    }
  },
  "retryStrategy": {
    "attempts": 1
  },
  "timeout": {
    "attemptDurationSeconds": 86400
  },
  "schedulingPriority": 1,
  "propagateTags": true
}
```

## Building and Pushing the Container

Here's a script to build and push the container to Amazon ECR:

```bash
#!/bin/bash
# build_and_push.sh - Build and push the GEOS-Chem container to ECR

set -e

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}
ECR_REPOSITORY=geos-chem
TAG=graviton-latest

# Create ECR repository if it doesn't exist
aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} || \
    aws ecr create-repository --repository-name ${ECR_REPOSITORY}

# Get ECR login
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Create directory structure
mkdir -p scripts

# Create the script files
cat > scripts/entrypoint.sh << 'EOL'
#!/bin/bash
# Content of entrypoint.sh goes here
# ... (copy from above)
EOL

cat > scripts/download_data.py << 'EOL'
#!/usr/bin/env python3
# Content of download_data.py goes here
# ... (copy from above)
EOL

cat > scripts/run_geos_chem.sh << 'EOL'
#!/bin/bash
# Content of run_geos_chem.sh goes here
# ... (copy from above)
EOL

cat > scripts/process_results.py << 'EOL'
#!/usr/bin/env python3
# Content of process_results.py goes here
# ... (copy from above)
EOL

# Make scripts executable
chmod +x scripts/*.sh scripts/*.py

# Build the Docker image
docker build -t ${ECR_REPOSITORY}:${TAG} \
    --platform linux/arm64 \
    --progress=plain \
    .

# Tag and push the image
docker tag ${ECR_REPOSITORY}:${TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}

echo "Container built and pushed to ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${TAG}"
```

## Submitting a Job

Here's a Python script to submit a GEOS-Chem job to AWS Batch:

```python
#!/usr/bin/env python3
# submit_job.py - Submit a GEOS-Chem job to AWS Batch

import argparse
import boto3
import json
import time
import uuid

def parse_args():
    parser = argparse.ArgumentParser(description="Submit a GEOS-Chem job to AWS Batch")
    parser.add_argument("--job-name", default=f"geos-chem-{time.strftime('%Y%m%d-%H%M%S')}", 
                        help="Name for the job")
    parser.add_argument("--job-queue", required=True, help="AWS Batch job queue")
    parser.add_argument("--job-definition", required=True, help="AWS Batch job definition")
    parser.add_argument("--output-path", required=True, help="S3 path for output")
    parser.add_argument("--config-path", required=False, help="S3 path to configuration file")
    parser.add_argument("--vcpus", type=int, default=64, help="Number of vCPUs")
    parser.add_argument("--memory", type=int, default=128000, help="Memory in MB")
    return parser.parse_args()

def submit_job(args):
    batch = boto3.client('batch')
    
    # Prepare container overrides
    container_overrides = {
        "command": [
            "s3://gcgrid/GEOS_4x5/GEOS_FP/2016/01/",
            args.output_path,
            args.config_path if args.config_path else ""
        ],
        "environment": [
            {
                "name": "OMP_NUM_THREADS",
                "value": str(args.vcpus)
            }
        ],
        "resourceRequirements": [
            {
                "type": "VCPU",
                "value": str(args.vcpus)
            },
            {
                "type": "MEMORY",
                "value": str(args.memory)
            }
        ]
    }
    
    # Submit job
    response = batch.submit_job(
        jobName=args.job_name,
        jobQueue=args.job_queue,
        jobDefinition=args.job_definition,
        containerOverrides=container_overrides
    )
    
    job_id = response['jobId']
    print(f"Job submitted successfully with ID: {job_id}")
    print(f"Results will be stored at: {args.output_path}")
    
    return job_id

def main():
    args = parse_args()
    job_id = submit_job(args)
    
    # Optionally, wait for job to complete
    if args.wait:
        batch = boto3.client('batch')
        print("Waiting for job to complete...")
        
        while True:
            response = batch.describe_jobs(jobs=[job_id])
            status = response['jobs'][0]['status']
            
            print(f"Job status: {status}")
            
            if status in ['SUCCEEDED', 'FAILED']:
                break
            
            time.sleep(60)  # Check every minute
        
        if status == 'SUCCEEDED':
            print(f"Job completed successfully. Results available at: {args.output_path}")
        else:
            print(f"Job failed. Check CloudWatch logs for details.")

if __name__ == "__main__":
    main()
```

## Usage Example

1. Build and push the container:
```bash
./build_and_push.sh
```

2. Submit a GEOS-Chem job:
```bash
python submit_job.py \
  --job-queue geos-chem-graviton-queue \
  --job-definition geos-chem-graviton \
  --output-path s3://your-bucket/results/test-run-1 \
  --config-path s3://your-bucket/configs/fullchem_4x5.yml \
  --vcpus 64 \
  --memory 128000
```

This container and associated scripts provide a complete solution for running GEOS-Chem on AWS Graviton processors via AWS Batch, with automatic data downloading, simulation execution, and results processing and storage.
