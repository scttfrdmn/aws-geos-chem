# GEOS-Chem Benchmarking Suite

This directory contains tools for benchmarking GEOS-Chem performance across different processor architectures, instance types, and scientific configurations. The benchmarking system helps researchers make informed decisions about cost and performance when running GEOS-Chem simulations in the AWS cloud.

## Overview

The benchmarking suite consists of:

1. **Benchmark Orchestrator**: Submits benchmark jobs to AWS Batch (for GC Classic) and ParallelCluster (for GCHP)
2. **Benchmark Analyzer**: Collects and analyzes benchmark results, generating visualizations and reports
3. **Benchmark Configuration**: YAML definition of benchmark scenarios to test

## Benchmark Configuration

The `benchmark-config.yaml` file defines the benchmarks to run, organized into four phases:

1. **Phase 1**: Single-node baseline benchmarks for GC Classic
2. **Phase 2**: Multi-node GCHP benchmarks
3. **Phase 3**: Specialized benchmarks (nested domains, memory-intensive, I/O-intensive)
4. **Phase 4**: Real-world simulation scenarios

Each benchmark entry includes:
- Unique ID
- Description
- Application type (gc-classic or gchp)
- Simulation type (fullchem, aerosol, transport, etc.)
- Domain configuration
- Duration
- Hardware configuration
- Metrics focus

## Running Benchmarks

To run the benchmarking suite:

```bash
# Make scripts executable
chmod +x benchmark-orchestrator.py benchmark-analyzer.py

# Run benchmark orchestrator
./benchmark-orchestrator.py \
  --config benchmark-config.yaml \
  --output-bucket your-results-bucket \
  --job-queue geos-chem-standard \
  --job-definition geos-chem-graviton \
  --parallel-cluster gchp-cluster

# Run specific phase only
./benchmark-orchestrator.py \
  --config benchmark-config.yaml \
  --output-bucket your-results-bucket \
  --job-queue geos-chem-standard \
  --job-definition geos-chem-graviton \
  --parallel-cluster gchp-cluster \
  --phase 1

# Dry run (validate configuration without submitting jobs)
./benchmark-orchestrator.py \
  --config benchmark-config.yaml \
  --output-bucket your-results-bucket \
  --dry-run
```

## Analyzing Results

After benchmarks have completed, analyze the results:

```bash
# Analyze all benchmark results
./benchmark-analyzer.py \
  --results-bucket your-results-bucket \
  --output-dir ./benchmark-reports \
  --config benchmark-config.yaml

# Analyze specific phase
./benchmark-analyzer.py \
  --results-bucket your-results-bucket \
  --output-dir ./benchmark-reports \
  --config benchmark-config.yaml \
  --phase 1

# Generate specific report format (html, pdf, json, or all)
./benchmark-analyzer.py \
  --results-bucket your-results-bucket \
  --output-dir ./benchmark-reports \
  --format html
```

## Output Reports

The benchmark analyzer generates several outputs:

1. **CSV Data**: Raw benchmark results in tabular format
2. **JSON Data**: Structured benchmark results
3. **Visualizations**: Performance charts and comparisons
4. **HTML Report**: Interactive web-based report
5. **PDF Report**: Printable report document

## Key Performance Metrics

The benchmarking suite collects and analyzes the following key metrics:

- **Throughput**: Simulation days per wall-clock day
- **Cost Efficiency**: Cost per simulation day
- **Memory Usage**: Peak memory consumption
- **CPU Efficiency**: Percentage of CPU time effectively utilized
- **Scaling Efficiency**: Performance improvement with additional resources

## Dependencies

The benchmarking suite requires:

- Python 3.6+
- AWS CLI configured with appropriate permissions
- Python packages: boto3, pandas, matplotlib, seaborn, pyyaml
- For PDF reports: weasyprint

Install dependencies:

```bash
pip install boto3 pandas matplotlib seaborn pyyaml weasyprint
```

## Best Practices

1. **Consistent Environments**: Use the same container image across all benchmarks
2. **Multiple Runs**: Run each benchmark multiple times to account for variability
3. **Representative Workloads**: Use scientific configurations that match real research needs
4. **Isolation**: Run benchmarks when systems are not under other loads
5. **Complete Data**: Collect all relevant metrics for comprehensive analysis