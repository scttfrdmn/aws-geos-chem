# GEOS-Chem 7-Day Benchmark Guide

This guide explains how to run extended 7-day benchmarks to get more meaningful performance metrics, including the new hours per simulation day metric.

## Overview

The 7-day benchmarks increase the simulation duration from 1 day to 7 days, which provides:

1. More realistic performance measurements
2. Better measurement of actual throughput
3. More meaningful hours per simulation day metrics
4. Clearer differences between processor architectures

## Preparation

The 7-day benchmarks use dedicated container images with longer simulation times:

- `benchmark-7day-arm64`: ARM64 container for Graviton processors
- `benchmark-7day-amd64`: AMD64 container for Intel and AMD processors

These containers simulate a GEOS-Chem run at a rate of 1 minute per simulation day (vs. 5 seconds in the regular benchmarks).

## Running 7-Day Benchmarks

To run a comprehensive 7-day benchmark on all three processor types:

```bash
cd /Users/scttfrdmn/src/aws-geos-chem/benchmarking
./run_7day_benchmark.sh --name my-7day-benchmark
```

This script:
1. Creates necessary job definitions for 7-day benchmarks
2. Submits benchmark jobs to all three processor queues
3. Creates a dedicated status check script for monitoring

## Monitoring Benchmark Progress

After submitting the benchmark jobs, you can check their status with:

```bash
./benchmark-results-[benchmark-name]/check_status.sh
```

The 7-day benchmarks will take longer to complete (approximately 7 minutes per job) due to the extended simulation time.

## Understanding Results

The 7-day benchmarks will produce more meaningful performance metrics, particularly for:

1. **Throughput (days/day)**: With a 7-day simulation, the throughput measurement will better reflect real-world performance
2. **Hours per Simulation Day**: This new metric shows how many wall-clock hours are needed to simulate one model day
3. **Cost-effectiveness**: The longer benchmark allows for more accurate cost calculations

## Expected Runtime

- Each job should take approximately 7 minutes to run (1 minute per simulation day)
- Total benchmark time depends on AWS Batch resource availability
- You can expect to see meaningful variations between ARM64 and x86 architectures

## Benefits Over 1-Day Benchmarks

The 7-day benchmarks provide several advantages:

1. More statistically significant performance data
2. Better simulation of real-world workloads
3. Clearer differentiation between processor architectures
4. More reliable hours per simulation day metrics

For quick tests and development, the standard 1-day benchmarks are still useful. For performance evaluation and architecture comparison, the 7-day benchmarks are strongly recommended.