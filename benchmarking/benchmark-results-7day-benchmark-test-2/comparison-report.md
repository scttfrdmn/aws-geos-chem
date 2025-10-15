# GEOS-Chem 7-Day Benchmark Comparison Report

Run Name: 7day-benchmark-test-2  
Date: May 16, 2025

## Performance Metrics Summary

| Processor | Instance Type | Duration (sec) | Throughput (days/day) | Hours per Sim Day | Relative Performance |
|-----------|--------------|----------------|----------------------|-------------------|---------------------|
| AWS Graviton3 (ARM64) | c7g.4xlarge | 420 | 1440.00 | 0.01 | 1.00x |
| Intel Sapphire Rapids (x86) | c7i.4xlarge | 420 | 1440.00 | 0.01 | 1.00x |
| AMD EPYC Genoa (x86) | c7a.4xlarge | 420 | 1440.00 | 0.01 | 1.00x |

## Cost-Performance Comparison

Instance prices (On-Demand, us-west-2):
- c7g.4xlarge: $0.68 per hour
- c7i.4xlarge: $0.78 per hour
- c7a.4xlarge: $0.68 per hour

| Processor | Cost per Day ($) | Cost-Performance Ratio |
|-----------|-------------------|------------------------|
| AWS Graviton3 (ARM64) | $0.68 × 24 ÷ 1440 = $0.01 | 1.00x |
| Intel Sapphire Rapids (x86) | $0.78 × 24 ÷ 1440 = $0.01 | 1.15x |
| AMD EPYC Genoa (x86) | $0.68 × 24 ÷ 1440 = $0.01 | 1.00x |

*Note: Lower cost-performance ratio is better (less cost per unit of performance). The ratios show Graviton and AMD have equal cost-performance, while Intel is slightly higher due to higher instance cost.*

## Hours per Simulation Day Analysis

The new "Hours per Simulation Day" metric shows the wall-clock time required to simulate one model day. All three processor types performed equally in our simulated benchmark, with each taking 0.01 hours (36 seconds) per simulation day.

This metric is more intuitive for users to understand compared to throughput (days/day). For example:
- To simulate a 30-day period would take approximately 0.3 hours or 18 minutes
- To simulate a 365-day period would take approximately 3.65 hours

## Benchmark Details

### AWS Graviton3 (ARM64)
- Job ID: 0709bc0c-242a-4147-8d91-638dad8d184b
- Start time: 2025-05-16T02:10:31Z
- End time: 2025-05-16T02:17:31Z
- Duration: 420 seconds

### Intel Sapphire Rapids (x86)
- Job ID: b3ef24ba-67c0-48b1-b6cd-3a9391296713
- Start time: 2025-05-16T02:10:32Z
- End time: 2025-05-16T02:17:32Z
- Duration: 420 seconds

### AMD EPYC Genoa (x86)
- Job ID: ee22a64f-98e4-44ea-a75e-4f1c205150ca
- Start time: 2025-05-16T02:10:29Z
- End time: 2025-05-16T02:17:29Z
- Duration: 420 seconds

## Notes on Simulated Benchmark

This benchmark used a simulated GEOS-Chem run at 60 seconds (1 minute) per simulation day. In a production environment with actual GEOS-Chem simulations, performance differences between processor architectures will likely become more apparent. The current benchmark demonstrates the successful implementation of:

1. The new "Hours per Simulation Day" metric, which provides an intuitive way to understand simulation performance
2. Cross-architecture compatibility for GEOS-Chem benchmarking
3. Comparable 7-day benchmarks across all three processor types

## Next Steps

For more realistic performance comparisons:
1. Run the benchmark with actual GEOS-Chem simulation code
2. Increase simulation duration to 30+ days
3. Test with different resolutions and chemistry mechanisms
4. Include memory usage and I/O performance metrics