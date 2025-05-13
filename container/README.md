# GEOS-Chem Graviton Container

This directory contains the Dockerfile and supporting scripts for building and running GEOS-Chem on AWS Graviton processors. The container is optimized for ARM64 architecture and designed to be run with AWS Batch.

## Contents

- `Dockerfile`: Container definition for GEOS-Chem on ARM64
- `scripts/entrypoint.sh`: Main container entry point
- `scripts/download_data.py`: Script to download input data from S3
- `scripts/run_geos_chem.sh`: Script to execute GEOS-Chem
- `scripts/process_results.py`: Script to process and upload results
- `build_and_push.sh`: Script to build and push the container to ECR

## Building the Container

1. Ensure you have AWS CLI configured with appropriate permissions
2. Ensure Docker is installed and has ARM64 emulation support if building on x86 hardware
3. Run the build script:

```bash
chmod +x build_and_push.sh
./build_and_push.sh
```

This will build the container and push it to Amazon ECR.

## Container Features

- Optimized for AWS Graviton processors
- Includes GEOS-Chem 13.4.0
- Automatic data download from S3
- Configurable via environment variables
- Performance metrics collection
- Result processing and S3 upload

## Usage with AWS Batch

The container is designed to be used with AWS Batch and accepts the following parameters:

1. Input data path (S3 URL)
2. Output path for results (S3 URL)
3. Optional configuration file path (S3 URL)

Example job submission:

```bash
aws batch submit-job \
    --job-name geos-chem-test \
    --job-queue geos-chem-queue \
    --job-definition geos-chem-job-definition \
    --container-overrides '{
        "command": ["s3://gcgrid/GEOS_4x5/GEOS_FP/2016/01/", "s3://your-bucket/results/test-run", "s3://your-bucket/configs/test-config.yml"]
    }'
```

## Performance Optimization

The container includes the following optimizations for Graviton processors:

- ARM-specific compiler flags
- OpenMP configuration for optimal performance
- Memory usage optimizations
- Efficient I/O handling

## Customization

To customize the container:

1. Modify the `Dockerfile` to change installed packages or versions
2. Adjust the build flags in the `ENV` statements for different optimization levels
3. Modify the Python scripts in the `scripts` directory to change behavior

## Troubleshooting

If you encounter issues:

1. Check the container logs for errors
2. Verify S3 permissions for input and output paths
3. Ensure the configuration file is valid YAML
4. Check AWS Batch job logs for execution errors