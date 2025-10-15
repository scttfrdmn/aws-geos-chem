# GEOS-Chem Benchmarking Test Procedure

This document outlines the steps to run benchmarks for GEOS-Chem using the AWS Cloud Runner infrastructure, comparing different processor architectures:

- **ARM64**: AWS Graviton3 (c7g instances)
- **x86 Intel**: Intel Sapphire Rapids (c7i instances)
- **x86 AMD**: AMD EPYC Genoa (c7a instances)

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. AWS CDK installed (if deploying the full stack)
3. Docker installed locally
4. Node.js and npm installed

## Test Procedure

### Step 1: Configure AWS Profile

Ensure your AWS profile is configured with the correct region:

```bash
aws configure set region us-west-2 --profile aws
export AWS_PROFILE=aws
export AWS_REGION=us-west-2
```

### Step 2: Build Benchmark Containers

Build the benchmark containers for both ARM64 and x86 architectures:

```bash
cd ../container

# Build ARM64 (Graviton) container
./build_benchmark.sh --architecture arm64 --tag benchmark-v1

# Build x86 (Intel/AMD) container
./build_benchmark.sh --architecture amd64 --tag benchmark-v1
```

### Step 3: Create Compute Environments

Create separate compute environments for each processor type:

```bash
cd ../benchmarking
chmod +x create_compute_environments.sh
./create_compute_environments.sh
```

This creates three compute environments:
- `geos-chem-graviton` for c7g instances (ARM64)
- `geos-chem-intel` for c7i instances (x86 Intel)
- `geos-chem-amd` for c7a instances (x86 AMD)

### Step 4: Create Job Definitions

Create job definitions for each processor type:

```bash
chmod +x create_job_definition.sh

# Create ARM64 (Graviton) job definition
./create_job_definition.sh --processor graviton

# Create x86 (Intel) job definition
./create_job_definition.sh --processor intel

# Create x86 (AMD) job definition
./create_job_definition.sh --processor amd
```

### Step 5: Run Comprehensive Benchmark

Run benchmarks on all three processor types:

```bash
chmod +x run_comprehensive_benchmark.sh

# Run the comprehensive benchmark
./run_comprehensive_benchmark.sh --name benchmark-run-1
```

The script will:
1. Submit benchmark jobs for all three processor types
2. Wait for all jobs to complete
3. Download results and generate a comparison report

### Step 6: Alternative: Run Individual Benchmarks

If you prefer to run benchmarks individually:

```bash
chmod +x submit_benchmark.sh

# Run Graviton3 (ARM64) benchmark
./submit_benchmark.sh --processor graviton --config sample-configs/graviton3-c7g-transport.json

# Run Intel (x86) benchmark
./submit_benchmark.sh --processor intel --config sample-configs/intel-c7i-transport.json

# Run AMD (x86) benchmark
./submit_benchmark.sh --processor amd --config sample-configs/amd-c7a-transport.json
```

### Step 7: Monitor Job Progress

Monitor the progress of your benchmark jobs:

```bash
# List Graviton jobs
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status RUNNING

# List Intel jobs
aws batch list-jobs --job-queue geos-chem-intel-queue --job-status RUNNING

# List AMD jobs
aws batch list-jobs --job-queue geos-chem-amd-queue --job-status RUNNING

# Check compute environment status
aws batch describe-compute-environments --compute-environments geos-chem-graviton
```

### Step 8: Analyze Results

Once jobs complete, analyze the benchmark comparison report:

```bash
# View the comparison report
cat benchmark-results-*/benchmark-comparison.md
```

The report includes:
- Performance comparison between different processors
- Cost-performance analysis
- Relative performance metrics

### Step 9: Clean Up Resources

To avoid unnecessary costs, clean up resources after testing:

```bash
# Scale down compute environments to zero
aws batch update-compute-environment --compute-environment geos-chem-graviton --compute-resources "desiredvCpus=0"
aws batch update-compute-environment --compute-environment geos-chem-intel --compute-resources "desiredvCpus=0"
aws batch update-compute-environment --compute-environment geos-chem-amd --compute-resources "desiredvCpus=0"
```

For full cleanup, you can delete the compute environments and job queues:

```bash
chmod +x cleanup_resources.sh
./cleanup_resources.sh
```

## Best Practices for Benchmarking

1. **Consistent Configuration**: Use the same simulation parameters across all processor types
2. **Multiple Runs**: Run each benchmark multiple times to account for variability
3. **Resource Efficiency**: Request slightly less than the full instance resources (15 vCPUs for 16 vCPU instances)
4. **VPC Configuration**: Ensure security groups and subnets are in the same VPC
5. **Cost Analysis**: Consider both raw performance and cost-per-performance when evaluating results

## Cost Optimization for Testing

This procedure is designed to minimize costs during testing:

1. **Short simulation duration**: Using 1-day simulations instead of multi-month runs
2. **Smaller instance types**: Using 4xlarge instead of larger instances
3. **Simpler chemistry**: Transport-only simulations run faster and cost less
4. **Zero-scale environments**: Compute environments scale to zero when not in use

## Expected Outcomes

After completing this procedure, you should have:

1. Validated the benchmarking pipeline across all three processor types
2. Generated comparable performance data for ARM64, Intel x86, and AMD x86 architectures
3. Identified the most cost-effective processor architecture for GEOS-Chem simulations 
4. Documented performance findings for future reference

## Next Steps

After successful validation:

1. Run more comprehensive benchmarks with different simulation types
2. Test larger instance sizes for production workloads
3. Create automated benchmark scheduling for regular performance tracking
4. Integrate benchmark results with cost optimization recommendations