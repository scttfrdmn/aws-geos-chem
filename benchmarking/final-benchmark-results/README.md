# GEOS-Chem AWS Benchmarking Final Results

This directory contains the final results of our benchmarking tests comparing AWS Graviton3 (ARM64), Intel Sapphire Rapids (x86), and AMD EPYC Genoa (x86) processors for running GEOS-Chem simulations.

## Key Files
- `benchmark-comparison.md`: Detailed comparison of performance metrics across the three processor architectures

## Key Findings
1. AMD EPYC Genoa provides the best performance and cost-efficiency
2. AWS Graviton3 is a very close second (only 5% slower)
3. Intel Sapphire Rapids is significantly slower (52% slower) and less cost-efficient

## Performance Metrics
Our benchmarking system now dynamically calculates all performance metrics:

1. **Throughput (days/day)**: Simulation days processed per wall-clock day
2. **Hours per simulation day**: Wall-clock hours needed to simulate one day
3. **Cost per simulation day**: Instance cost to simulate one day
4. **CPU efficiency**: Percentage of CPU effectively utilized
5. **Memory usage**: RAM consumed by the simulation

## Instance Types Used
- **Graviton3**: c7g.4xlarge (ARM64)
- **Intel**: c7i.4xlarge (x86)
- **AMD**: c7a.4xlarge (x86)

To run similar benchmarks, use:
```bash
cd /Users/scttfrdmn/src/aws-geos-chem/benchmarking
./run_real_benchmark.sh --name your-benchmark-name --days simulation-days
```