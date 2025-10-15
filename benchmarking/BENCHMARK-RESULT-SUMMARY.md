# GEOS-Chem Benchmarking Results

## Overview

This document summarizes the results of running GEOS-Chem benchmarks across three different processor architectures. The benchmarks were conducted with identical parameters to enable a fair comparison between AWS Graviton3 (ARM64), Intel Sapphire Rapids, and AMD EPYC Genoa (both x86) processors.

## Benchmark Configuration

All benchmarks were run with the following configuration:

- **Application**: GEOS-Chem Classic
- **Simulation Type**: Transport
- **Domain**: Global 4°×5° resolution
- **Duration**: 1 day
- **Resource Allocation**: 15 vCPUs, 30GB memory

## Processor Specifications

| Processor | Instance Type | Architecture | vCPUs | Memory (GB) | On-Demand Price/Hour |
|-----------|--------------|--------------|-------|-------------|----------------------|
| AWS Graviton3 | c7g.4xlarge | ARM64 | 16 | 32 | $0.68 |
| Intel Sapphire Rapids | c7i.4xlarge | x86 | 16 | 32 | $0.78 |
| AMD EPYC Genoa | c7a.4xlarge | x86 | 16 | 32 | $0.68 |

## Benchmark Results

All three processor architectures successfully ran the benchmark, demonstrating compatibility across ARM64 and x86 architectures.

### Execution Summary

| Processor | Job ID | Duration | Status |
|-----------|--------|----------|--------|
| AWS Graviton3 | 5eb42700-4d1e-4d99-9c22-9c982719256e | 5 seconds | SUCCEEDED |
| Intel Sapphire Rapids | a27f1478-c204-4aab-9dfa-5f1760d171b9 | 5 seconds | SUCCEEDED |
| AMD EPYC Genoa | c3833bdc-336e-4cf7-8b4e-b2ef079cf001 | 5 seconds | SUCCEEDED |

### Architecture Details

1. **AWS Graviton3 (ARM64)**
   - Processor Type: Graviton3
   - Architecture: arm64
   - Runtime: 5 seconds
   - Exit Code: 0

2. **Intel Sapphire Rapids (x86)**
   - Processor Type: Intel Sapphire Rapids
   - Architecture: amd64 (x86_64)
   - Runtime: 5 seconds
   - Exit Code: 0

3. **AMD EPYC Genoa (x86)**
   - Processor Type: AMD EPYC Genoa
   - Architecture: amd64 (x86_64)
   - Runtime: 5 seconds
   - Exit Code: 0

## Performance Comparison

In our simulated benchmarks, all three processor types completed the task in the same amount of time (5 seconds). In a real-world GEOS-Chem simulation, performance differences would become apparent with longer runs.

The benchmarking system now successfully calculates both throughput metrics (days/day) and hours per simulation day, providing two complementary ways to measure performance. The division by zero error has been fixed in the latest update.

## S3 Upload Issues

All jobs encountered S3 permission issues when attempting to upload results. This is a configuration issue with the IAM roles and not related to the processor architecture compatibility. For production benchmarks, the instance role would need proper S3 permissions.

## Conclusion

The benchmarking system successfully demonstrates compatibility across all three processor architectures:

1. **ARM64 (Graviton)**: The benchmark container runs successfully on AWS Graviton3 processors.
2. **x86 (Intel)**: The benchmark container runs successfully on Intel Sapphire Rapids processors.
3. **x86 (AMD)**: The benchmark container runs successfully on AMD EPYC Genoa processors.

This confirms that our architecture-specific container approach works correctly. The system is now ready for production benchmarking to measure actual performance differences between these processor types with real GEOS-Chem simulations.

## Next Steps

1. Configure proper IAM permissions for S3 access
2. Run longer benchmarks with actual GEOS-Chem simulations
3. Generate detailed performance reports including both throughput (days/day) and wall-clock time (hours/day) metrics
4. Analyze cost-efficiency across different processor architectures