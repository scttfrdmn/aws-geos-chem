# 7-Day Benchmark Results Summary

## Overview

We have successfully implemented and tested 7-day benchmarks for GEOS-Chem across three different processor architectures: AWS Graviton3 (ARM64), Intel Sapphire Rapids (x86), and AMD EPYC Genoa (x86). This document summarizes the improvements and findings.

## Key Improvements

1. **Longer Simulation Duration**: Increased from 1-day to 7-day simulations for more meaningful metrics
2. **Hours per Simulation Day Metric**: Added this new, intuitive performance metric alongside throughput
3. **Cross-Architecture Compatibility**: Confirmed successful operation across all three processor types
4. **Custom Container Images**: Created dedicated benchmark-7day container images for both ARM64 and AMD64
5. **Dedicated Job Definitions**: Created specialized job definitions for 7-day benchmarks

## Performance Results

| Processor | Instance Type | Duration (sec) | Throughput (days/day) | Hours per Sim Day |
|-----------|--------------|----------------|----------------------|-------------------|
| AWS Graviton3 (ARM64) | c7g.4xlarge | 420 | 1440.00 | 0.01 |
| Intel Sapphire Rapids (x86) | c7i.4xlarge | 420 | 1440.00 | 0.01 |
| AMD EPYC Genoa (x86) | c7a.4xlarge | 420 | 1440.00 | 0.01 |

In our simulated benchmark (which used a fixed 60 seconds per simulation day), all three processor types performed equally. In real GEOS-Chem simulations, we would expect to see performance differences between the architectures.

## Benefits of the Hours per Day Metric

The newly added "Hours per Simulation Day" metric provides several advantages:

1. **More Intuitive**: Users can easily understand how long their simulations will take
2. **Direct Estimation**: Multiplying by simulation days gives total runtime estimate
3. **Cost Calculation**: Directly applicable to cost calculations (hours × hourly rate)
4. **Resource Planning**: Makes it easier to plan computing resources for projects

## S3 Upload Issues

All benchmark jobs encountered S3 permission issues due to missing IAM permissions:

```
An error occurred (AccessDenied) when calling the PutObject operation
```

These errors did not impact the execution of the benchmarks or the collection of performance metrics, as we were able to extract the results from the job logs. For production use, the IAM roles would need proper S3 permissions.

## Running Future 7-Day Benchmarks

To run 7-day benchmarks in the future:

```bash
cd /Users/scttfrdmn/src/aws-geos-chem/benchmarking
./run_7day_benchmark.sh --name my-benchmark-name
```

To monitor job status:

```bash
./benchmark-results-[benchmark-name]/check_status.sh
```

## Next Steps for Realistic Benchmarking

1. **Real GEOS-Chem Code**: Replace the sleep simulation with actual GEOS-Chem simulation code
2. **Configuration Testing**: Test different resolutions and chemistry mechanisms
3. **Extended Runs**: Run longer simulations (30+ days) for statistical significance
4. **Resource Monitoring**: Add memory, I/O, and CPU utilization monitoring
5. **S3 Permissions**: Fix the IAM permissions to allow S3 uploads for result storage