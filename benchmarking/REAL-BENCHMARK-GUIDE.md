# GEOS-Chem Real Benchmark Guide

This guide explains how to run actual computational benchmarks for GEOS-Chem across different processor architectures.

## Overview

The real benchmarking system replaces the artificial sleep-based simulation with actual computational tasks that reflect GEOS-Chem's workload patterns. This provides meaningful performance comparisons between different processor architectures.

## How It Works

The real benchmarking system works in two modes:

1. **With GEOS-Chem Code**: If the GEOS-Chem code is available in an S3 bucket, it will download and run the actual model.

2. **Fallback Computational Mode**: If the GEOS-Chem code is not available, it runs a Python script that simulates the computational patterns of GEOS-Chem:
   - Matrix operations similar to those in chemical transport models
   - Memory access patterns that reflect atmospheric chemistry calculations
   - Time-stepping loops that simulate model integration
   - Multiple species and reactions to stress CPU performance

## Benchmark Execution Approach

Unlike simulated benchmarks where all systems take exactly the same time, the real benchmark:

1. Runs the same computational workload on each processor architecture
2. Measures how long each system actually takes to complete the workload
3. Calculates performance metrics based on real execution times
4. Shows actual differences in throughput and hours per simulation day

## Running Real Benchmarks

To run real benchmarks:

```bash
cd /Users/scttfrdmn/src/aws-geos-chem/benchmarking
./run_real_benchmark.sh --name my-real-benchmark --days 7
```

Optional parameters:
- `--days N`: Number of simulation days (default: 7)
- `--profile PROFILE`: AWS profile to use
- `--region REGION`: AWS region to use
- `--bucket BUCKET`: S3 bucket for results

## Monitoring Progress

After submitting the benchmarks, monitor their progress with:

```bash
./benchmark-results-[benchmark-name]/check_status.sh
```

Real benchmarks will take longer to complete than simulated benchmarks because they're performing actual computation.

## Understanding Results

The benchmark results will include:

1. **Throughput (days/day)**: How many simulation days can be completed in a wall-clock day
2. **Hours per Simulation Day**: Wall-clock hours needed to simulate one model day
3. **Execution Time**: Total runtime for the benchmark workload

These metrics will vary between different processor architectures based on their actual performance.

## Key Differences from Simulated Benchmarks

| Simulated Benchmarks | Real Benchmarks |
|----------------------|-----------------|
| Uses `sleep` command | Uses actual computation |
| Takes the same time on all processors | Takes different times based on processor performance |
| No real CPU/memory usage | Exercises CPU, memory, and cache performance |
| Identical metrics across all systems | Shows actual performance differences |

## Expected Differences

Based on industry benchmarks, you might expect to see:

1. **ARM64 (Graviton3)**: Good performance/price ratio, possibly better memory bandwidth
2. **Intel Sapphire Rapids**: Strong single-thread performance
3. **AMD EPYC Genoa**: Strong multi-thread performance, high core count efficiency

## Results Interpretation

When analyzing results, consider:

1. **Cost-efficiency**: Performance relative to instance price
2. **Absolute performance**: Raw throughput for time-critical workloads
3. **Scaling**: How performance scales with simulation size
4. **Memory usage**: Particularly for high-resolution simulations