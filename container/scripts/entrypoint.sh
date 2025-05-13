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