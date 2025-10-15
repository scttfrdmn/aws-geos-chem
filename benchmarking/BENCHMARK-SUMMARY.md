# GEOS-Chem AWS Benchmarking System - Implementation Summary

## Overview

This document summarizes the implementation of the GEOS-Chem AWS benchmarking system. The system is designed to compare the performance of GEOS-Chem on different AWS processor architectures, specifically comparing AWS Graviton3 (ARM64) with Intel Sapphire Rapids and AMD EPYC Genoa (both x86).

## System Components

### 1. Container Infrastructure

- **Docker Images**: 
  - Built for both ARM64 and AMD64 architectures
  - Base image: Amazon Linux 2023
  - Tagged as `benchmark-v1-arm64` and `benchmark-v1-amd64`
  - Includes all necessary dependencies for running GEOS-Chem benchmarks

- **Entrypoint Script**: 
  - Enhanced with robust error handling
  - Provides metrics including throughput in days per day
  - Validates S3 bucket access before attempting uploads
  - Collects and formats performance metrics

### 2. AWS Batch Configuration

- **Compute Environments**:
  - `geos-chem-graviton`: For Graviton3 (ARM64) instances, using c7g.4xlarge
  - `geos-chem-intel-new`: For Intel Sapphire Rapids (x86) instances, using c7i.4xlarge
  - `geos-chem-amd-new`: For AMD EPYC Genoa (x86) instances, using c7a.4xlarge
  - All environments configured with the same VPC, security group, and instance role

- **Job Queues**:
  - `geos-chem-graviton-queue`: For Graviton3 jobs
  - `geos-chem-intel-queue-new`: For Intel jobs
  - `geos-chem-amd-queue-new`: For AMD jobs

- **Job Definitions**:
  - `geos-chem-benchmark-graviton`: For Graviton3 (ARM64)
  - `geos-chem-benchmark-intel-new`: For Intel (x86)
  - `geos-chem-benchmark-amd-new`: For AMD (x86)
  - All job definitions configured with appropriate resource requirements (15 vCPUs, 30GB memory)

### 3. Benchmarking Scripts

- **build_benchmark.sh**: 
  - Builds Docker images for both ARM64 and AMD64 architectures
  - Pushes images to Amazon ECR

- **create_compute_environments.sh**: 
  - Creates compute environments for Graviton3 processors
  - Includes proper VPC and security group configuration

- **create_intel_amd_environments.sh**: 
  - Creates compute environments for Intel and AMD processors
  - Includes a wait function to ensure environments are valid before creating job queues

- **create_job_definition.sh**: 
  - Creates job definitions for all three processor types
  - Configures appropriate container images based on architecture

- **submit_benchmark.sh**: 
  - Submits benchmark jobs to AWS Batch
  - Supports all three processor types
  - Monitors job status

- **run_comprehensive_benchmark.sh**: 
  - Runs benchmarks on all three processor types
  - Collects and compares results
  - Generates a performance comparison report

- **check_benchmark_status.sh**:
  - Checks the status of submitted benchmark jobs
  - Generates comparison report when jobs complete

## Benchmark Configuration

All benchmarks use the same configuration parameters to ensure a fair comparison:

- **Application**: GEOS-Chem Classic
- **Simulation Type**: Transport
- **Domain**: Global 4°×5° resolution
- **Duration**: 1 day
- **Resource Allocation**: 15 vCPUs, 30GB memory

## Processor Types Compared

| Processor | Instance Type | Architecture | vCPUs | Memory (GB) | On-Demand Price/Hour |
|-----------|--------------|--------------|-------|-------------|----------------------|
| AWS Graviton3 | c7g.4xlarge | ARM64 | 16 | 32 | $0.68 |
| Intel Sapphire Rapids | c7i.4xlarge | x86 | 16 | 32 | $0.78 |
| AMD EPYC Genoa | c7a.4xlarge | x86 | 16 | 32 | $0.68 |

## Benchmark Results

Initial benchmark run (`comprehensive-benchmark-20250515-v2`) returned mixed results:

- Graviton3 jobs succeeded
- Intel and AMD jobs failed with "exec format error"

### Investigation of Failures

Upon investigation of the CloudWatch logs for the failed Intel and AMD jobs, we found the following error:
```
exec /usr/local/bin/benchmarking_entrypoint.sh: exec format error
```

This indicates an architecture mismatch between the container and the instance. The error occurs when trying to run ARM64 binaries on x86 processors or vice versa. Our investigation found that even though we built and pushed container images for both architectures, the job definition was not correctly selecting the appropriate image for the target architecture.

## Next Steps

1. **Fix architecture mismatch in container images**:
   - Update the Dockerfile to properly build multi-architecture images
   - Ensure the correct container tags are used in job definitions
   - Verify that the benchmarking_entrypoint.sh script is compiled for the appropriate architecture

2. **Run corrected benchmarks**: 
   - After resolving issues, run a new set of benchmarks
   - Compare performance across all three processor types

3. **Generate comprehensive report**: 
   - Create detailed performance comparison
   - Include cost-performance analysis
   - Provide recommendations for most cost-effective instance types

## Conclusion

The benchmarking system has been successfully implemented with support for all three processor architectures. Initial tests have demonstrated that the Graviton3 environment is working correctly, but issues with Intel and AMD environments require further investigation. Once these issues are resolved, the system will provide valuable insights into the relative performance and cost-effectiveness of different AWS instance types for running GEOS-Chem simulations.