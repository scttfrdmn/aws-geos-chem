# GEOS-Chem Benchmarking - Architecture Mismatch Fix Guide

## Issue

During our benchmarking tests, we encountered an architecture mismatch issue with the Intel and AMD jobs. The CloudWatch logs showed the following error:

```
exec /usr/local/bin/benchmarking_entrypoint.sh: exec format error
```

This error occurs when trying to run binaries compiled for one architecture (e.g., ARM64) on a different architecture (e.g., x86).

## Root Cause

The root cause of this issue appears to be that the entrypoint script in our container image was compiled for ARM64 but was being run on x86 instances for the Intel and AMD benchmarks. This mismatch occurred because:

1. While we built separate container images for both architectures (`benchmark-v1-arm64` and `benchmark-v1-amd64`), the entrypoint script itself may not have been properly formatted for both architectures.

2. The script headers or binaries may have been compiled or otherwise formatted specifically for ARM64.

## Fix

To resolve this issue, follow these steps:

### 1. Update the benchmarking_entrypoint.sh Script

Ensure the script has a proper shebang line and is saved with Unix line endings:

```bash
#!/bin/bash
# Ensure script has Unix line endings (LF not CRLF)
```

### 2. Create Separate Dockerfiles for Each Architecture

Instead of trying to build a multi-architecture image from a single Dockerfile, create separate Dockerfiles for each architecture:

**Dockerfile.benchmark.arm64**:
```dockerfile
# Base Image: Amazon Linux 2023 for ARM64
FROM --platform=linux/arm64 amazonlinux:2023

LABEL maintainer="GEOS-Chem Cloud Team <info@example.com>"
LABEL description="GEOS-Chem benchmarking container for AWS Graviton (ARM64)"
LABEL version="1.0.0"

# Install system dependencies
RUN dnf update -y && \
    dnf install -y \
    jq \
    bc \
    python3 \
    python3-pip \
    tar \
    gzip \
    curl \
    procps \
    --allowerasing && \
    dnf clean all

# Install Python packages including AWS CLI
RUN pip3 install --no-cache-dir \
    boto3 \
    numpy \
    pandas \
    python-dateutil \
    awscli \
    pytest

# Add benchmarking entrypoint script
COPY benchmarking_entrypoint.sh /usr/local/bin/

# Make script executable
RUN chmod +x /usr/local/bin/benchmarking_entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/benchmarking_entrypoint.sh"]
```

**Dockerfile.benchmark.amd64**:
```dockerfile
# Base Image: Amazon Linux 2023 for AMD64
FROM --platform=linux/amd64 amazonlinux:2023

LABEL maintainer="GEOS-Chem Cloud Team <info@example.com>"
LABEL description="GEOS-Chem benchmarking container for AWS Intel/AMD (x86)"
LABEL version="1.0.0"

# Install system dependencies
RUN dnf update -y && \
    dnf install -y \
    jq \
    bc \
    python3 \
    python3-pip \
    tar \
    gzip \
    curl \
    procps \
    --allowerasing && \
    dnf clean all

# Install Python packages including AWS CLI
RUN pip3 install --no-cache-dir \
    boto3 \
    numpy \
    pandas \
    python-dateutil \
    awscli \
    pytest

# Add benchmarking entrypoint script
COPY benchmarking_entrypoint.sh /usr/local/bin/

# Make script executable
RUN chmod +x /usr/local/bin/benchmarking_entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/benchmarking_entrypoint.sh"]
```

### 3. Update the build_benchmark.sh Script

Modify the build script to use the appropriate Dockerfile for each architecture:

```bash
# Determine Dockerfile based on architecture
if [[ "${ARCHITECTURE}" == "arm64" ]]; then
  DOCKERFILE="Dockerfile.benchmark.arm64"
  PLATFORM="linux/arm64"
  ARCH_TAG="${TAG}-arm64"
else
  DOCKERFILE="Dockerfile.benchmark.amd64"
  PLATFORM="linux/amd64"
  ARCH_TAG="${TAG}-amd64"
fi

# Build the Docker image
echo "Building Docker image for ${PLATFORM} using ${DOCKERFILE}..."
docker build -t ${ECR_REPOSITORY}:${ARCH_TAG} \
    -f ${DOCKERFILE} \
    --platform ${PLATFORM} \
    --progress=plain \
    .
```

### 4. Rebuild and Push the Images

Rebuild both images with the updated configurations:

```bash
./build_benchmark.sh --architecture arm64 --tag benchmark-v2
./build_benchmark.sh --architecture amd64 --tag benchmark-v2
```

### 5. Update the Job Definitions

Update the job definitions to use the new container images:

```bash
# Update job definitions
./create_job_definition.sh --processor graviton --architecture arm64
./create_job_definition.sh --processor intel --architecture amd64
./create_job_definition.sh --processor amd --architecture amd64
```

### 6. Run the Benchmarks Again

Run the comprehensive benchmark with the updated configurations:

```bash
./run_comprehensive_benchmark.sh --name comprehensive-benchmark-fixed
```

## Verification

After making these changes, verify that:

1. The container starts correctly on all three processor types.
2. No architecture mismatch errors appear in the CloudWatch logs.
3. The benchmarks complete successfully for all processor types.

## Additional Tips

- When working with multiple architectures, always explicitly specify the platform flag when building Docker images.
- Test the container on each architecture before running benchmarks.
- Check script permissions and line endings to avoid common scripting issues across different platforms.
- Consider using Docker's buildx feature for true multi-architecture image support if needed in the future.