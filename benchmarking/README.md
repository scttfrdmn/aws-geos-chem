# GEOS-Chem AWS Benchmarking System

This directory contains the tools and scripts for running GEOS-Chem benchmarks on AWS, with a focus on comparing different processor architectures (ARM64/Graviton vs x86 Intel/AMD).

## Overview

The benchmarking system consists of:

1. **Container Infrastructure**: Docker containers with the GEOS-Chem simulation environment
2. **AWS Batch Resources**: Compute environments, job queues, and job definitions
3. **Orchestration Scripts**: Tools for submitting and monitoring benchmark jobs
4. **Result Analysis**: Tools for analyzing and comparing benchmark results

## Supported Architectures

- **ARM64 (Graviton)**: AWS Graviton3 processors (c7g instances)
- **x86 (Intel)**: Intel Sapphire Rapids processors (c7i instances)
- **x86 (AMD)**: AMD EPYC Genoa processors (c7a instances)

| Processor | Instance Type | Architecture | vCPUs | Memory (GB) | On-Demand Price/Hour |
|-----------|--------------|--------------|-------|-------------|----------------------|
| AWS Graviton3 | c7g.4xlarge | ARM64 | 16 | 32 | $0.68 |
| Intel Sapphire Rapids | c7i.4xlarge | x86 | 16 | 32 | $0.78 |
| AMD EPYC Genoa | c7a.4xlarge | x86 | 16 | 32 | $0.68 |

## Setup Instructions

### 1. Configure AWS Profile

```bash
aws configure set region us-west-2 --profile aws
export AWS_PROFILE=aws
export AWS_REGION=us-west-2
```

### 2. Build Containers

Build containers for both architectures:

```bash
cd ../container

# Build ARM64 (Graviton) container
./build_benchmark.sh --architecture arm64

# Build x86 (Intel/AMD) container
./build_benchmark.sh --architecture amd64
```

### 3. Create AWS Batch Resources

Set up the compute environments and job queues:

```bash
cd ../benchmarking

# Create Graviton compute environment
./create_compute_environments.sh

# Create Intel and AMD compute environments
./create_intel_amd_environments.sh
```

### 4. Create Job Definitions

Create job definitions for all processor types:

```bash
# Create Graviton job definition
./create_job_definition.sh --processor graviton --architecture arm64

# Create Intel job definition
./create_job_definition.sh --processor intel --architecture amd64

# Create AMD job definition
./create_job_definition.sh --processor amd --architecture amd64
```

For real computational benchmarks with dynamic metrics:

```bash
# Create Real Benchmark job definitions
./create_real_job_definition.sh --processor graviton
./create_real_job_definition.sh --processor intel
./create_real_job_definition.sh --processor amd
```

## Running Benchmarks

### Individual Benchmark Submission

To submit a benchmark job for a specific processor type:

```bash
# Submit Graviton (ARM64) benchmark
./submit_benchmark.sh --processor graviton --config sample-configs/graviton3-c7g-transport.json

# Submit Intel Sapphire Rapids (x86) benchmark
./submit_benchmark.sh --processor intel --config sample-configs/intel-c7i-transport.json

# Submit AMD EPYC Genoa (x86) benchmark
./submit_benchmark.sh --processor amd --config sample-configs/amd-c7a-transport.json
```

### Comprehensive Benchmarks

To run benchmarks on all processor types simultaneously:

```bash
./run_comprehensive_benchmark.sh --name my-benchmark-run
```

### Real Computational Benchmarks

To run real computational benchmarks with dynamic metrics calculation:

```bash
./run_real_benchmark.sh --name my-real-benchmark --days 2
```

These benchmarks will run a computationally intensive task that simulates GEOS-Chem workloads and will accurately measure performance differences between processor architectures.

### Advanced Options

The submission script supports several options:

```bash
./submit_benchmark.sh \
  --config <config-file> \
  --processor <graviton|intel|amd> \
  --profile <aws-profile> \
  --region <aws-region> \
  --bucket <s3-bucket-name> \
  --name <run-name>
```

### Sample Configurations

Sample benchmark configurations are provided in the `sample-configs` directory:

- `graviton3-c7g-transport.json`: Transport simulation on Graviton3 c7g.4xlarge
- `intel-c7i-transport.json`: Transport simulation on Intel c7i.4xlarge
- `amd-c7a-transport.json`: Transport simulation on AMD c7a.4xlarge

## Monitoring Jobs

### Checking Job Status

To check the status of submitted jobs:

```bash
# Check comprehensive benchmark job status
./check_benchmark_status.sh

# Get logs for a specific job
./get_job_logs.sh --job-id YOUR_JOB_ID
```

You can also monitor jobs using the AWS Batch console or AWS CLI:

```bash
# List all jobs in the Graviton queue
aws batch list-jobs --job-queue geos-chem-graviton-queue

# List all jobs in the Intel queue
aws batch list-jobs --job-queue geos-chem-intel-queue-new

# List all jobs in the AMD queue
aws batch list-jobs --job-queue geos-chem-amd-queue-new

# Check details of a specific job
aws batch describe-jobs --jobs <job-id>
```

## Architecture Comparison

When running performance comparisons:

1. Use the same simulation configuration (simulation_type, resolution, duration)
2. Only change the hardware parameters between runs
3. Compare the throughput_days_per_day metric for relative performance
4. Consider cost efficiency (performance per dollar) when evaluating results

## Key Performance Metrics

The benchmarking suite dynamically calculates the following key metrics:

- **Throughput (days/day)**: Simulation days per wall-clock day, calculated as `(simulation_days * 86400) / runtime_seconds`
- **Hours per Simulation Day**: Wall-clock hours needed to simulate one model day, calculated as `(runtime_seconds / 3600) / simulation_days`
- **Cost per Simulation Day**: Instance cost to simulate one day, calculated as `instance_hourly_cost * hours_per_sim_day`
  - Graviton3/AMD: $0.68 per hour
  - Intel: $0.78 per hour
- **Memory Usage**: RAM consumed by the simulation, dynamically estimated based on workload
- **CPU Efficiency**: Percentage of CPU time effectively utilized, estimated based on throughput performance

All metrics are processor-specific and dynamically calculated, providing an accurate representation of real-world performance differences.

### Final Benchmark Results

Our latest benchmark results confirm:

1. **AMD EPYC Genoa**: Best performance (8228.57 days/day) and cost-efficiency ($0.001982/sim day)
2. **AWS Graviton3**: Close second (7854.54 days/day, $0.002077/sim day)
3. **Intel Sapphire Rapids**: Significantly slower (3927.27 days/day, $0.004766/sim day)

See the `final-benchmark-results` directory for detailed comparisons.

## Best Practices

- **Resource Requirements**: Request slightly less than the full instance resources (15 vCPUs for 16 vCPU instances)
- **Separate Environments**: Always use separate compute environments for different architectures
- **VPC Configuration**: Ensure security groups and subnets are in the same VPC
- **Region Consistency**: Always specify the AWS region in your commands or environment variables

## Troubleshooting

See the following documents for troubleshooting guidance:

- `aws-batch-best-practices.md`: Best practices for AWS Batch configuration
- `vpc-configuration-troubleshooting.md`: Guide for troubleshooting VPC issues

## Cleanup

To clean up all AWS resources when finished:

```bash
./cleanup_all_resources.sh
```

To avoid unnecessary costs without fully cleaning up:

```bash
# Scale down compute environments to zero
aws batch update-compute-environment --compute-environment geos-chem-graviton --compute-resources "desiredvCpus=0"
aws batch update-compute-environment --compute-environment geos-chem-intel-new --compute-resources "desiredvCpus=0"
aws batch update-compute-environment --compute-environment geos-chem-amd-new --compute-resources "desiredvCpus=0"
```