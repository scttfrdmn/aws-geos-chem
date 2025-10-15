# Benchmarking Scripts Documentation

This document provides detailed information about the benchmarking system implemented for the GEOS-Chem AWS Cloud Runner.

## Overview

The benchmarking system consists of two main components:

1. **benchmark-orchestrator.py**: Submits benchmark jobs to AWS Batch and ParallelCluster
2. **benchmark-analyzer.py**: Analyzes benchmark results and generates reports

These scripts work together to provide a comprehensive benchmarking solution for evaluating the performance of GEOS-Chem on various AWS compute resources.

## Benchmark Orchestrator

### Purpose

The benchmark orchestrator script automates the submission of benchmarking jobs to AWS based on configurations defined in a YAML file. It supports both AWS Batch (for single-node GC Classic benchmarks) and ParallelCluster (for multi-node GCHP benchmarks).

### Features

- **Phased Execution**: Run benchmarks in four distinct phases
- **Concurrent Job Management**: Control the number of concurrent jobs
- **Job Monitoring**: Track job status and wait for completion
- **Metadata Tracking**: Save job submission details for later analysis
- **Dry Run Mode**: Validate configurations without submitting actual jobs

### Usage

```bash
# Run specific benchmark phase
./benchmark-orchestrator.py \
  --config benchmark-config.yaml \
  --output-bucket your-results-bucket \
  --job-queue geos-chem-batch-queue \
  --job-definition geos-chem-batch-job \
  --phase 1

# Run all benchmark phases
./benchmark-orchestrator.py \
  --config benchmark-config.yaml \
  --output-bucket your-results-bucket \
  --job-queue geos-chem-batch-queue \
  --job-definition geos-chem-batch-job

# Run GCHP benchmarks
./benchmark-orchestrator.py \
  --config benchmark-config.yaml \
  --output-bucket your-results-bucket \
  --job-queue geos-chem-batch-queue \
  --job-definition geos-chem-batch-job \
  --parallel-cluster gchp-cluster

# Test configuration without submitting jobs
./benchmark-orchestrator.py \
  --config benchmark-config.yaml \
  --output-bucket your-results-bucket \
  --dry-run
```

### Command Line Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `--config`, `-c` | Path to benchmark configuration YAML file | Yes |
| `--output-bucket`, `-o` | S3 bucket for benchmark results | Yes |
| `--job-queue`, `-q` | AWS Batch job queue for GC Classic benchmarks | For GC Classic |
| `--job-definition`, `-j` | AWS Batch job definition for GC Classic benchmarks | For GC Classic |
| `--parallel-cluster`, `-p` | ParallelCluster name for GCHP benchmarks | For GCHP |
| `--phase` | Only run a specific benchmark phase (1-4) | No |
| `--dry-run`, `-d` | Validate configuration without submitting jobs | No |
| `--max-concurrent`, `-m` | Maximum number of concurrent benchmark jobs | No (default: 10) |

## Benchmark Analyzer

### Purpose

The benchmark analyzer script processes the results of completed benchmarks, generating comparative analyses and visualizations to help understand the performance characteristics across different configurations.

### Features

- **Automated Data Collection**: Collect results from S3
- **Performance Metrics**: Calculate key metrics like throughput and cost efficiency
- **Visualizations**: Generate charts comparing different configurations
- **Report Generation**: Create HTML reports with interactive visualizations
- **Phase-Specific Analysis**: Focus on specific benchmark phases

### Usage

```bash
# Analyze all benchmark results
./benchmark-analyzer.py \
  --results-bucket your-results-bucket \
  --output-dir ./benchmark-reports

# Analyze specific phase
./benchmark-analyzer.py \
  --results-bucket your-results-bucket \
  --output-dir ./benchmark-reports \
  --phase 1

# Generate specific report format
./benchmark-analyzer.py \
  --results-bucket your-results-bucket \
  --output-dir ./benchmark-reports \
  --format html
```

### Command Line Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `--results-bucket`, `-b` | S3 bucket containing benchmark results | Yes |
| `--output-dir`, `-o` | Local directory for benchmark reports | No (default: ./benchmark-reports) |
| `--config`, `-c` | Path to original benchmark configuration YAML file | No |
| `--run-id`, `-r` | Specific benchmark run ID to analyze | No |
| `--phase`, `-p` | Only analyze a specific benchmark phase (1-4) | No |
| `--format`, `-f` | Output report format (html, pdf, json, all) | No (default: all) |

## Benchmark Configuration File

The benchmark configuration YAML file defines the benchmarks to be run. It organizes benchmarks into four phases:

1. **Phase 1**: Single-Node Baseline Benchmarks for GC Classic
2. **Phase 2**: Multi-Node GCHP Benchmarks
3. **Phase 3**: Specialized Benchmarks
4. **Phase 4**: Real-World Simulation Scenarios

### Configuration Structure

```yaml
# Phase 1: Single-Node Baseline Benchmarks
phase_1:
  - id: B1-1-G3-C7G-16-FC
    description: "Full Chemistry on Graviton3 c7g.16xlarge"
    application: gc-classic
    simulation_type: fullchem
    domain:
      type: global
      resolution: 4x5
    duration:
      days: 7
    hardware:
      instance_type: c7g.16xlarge
      processor_type: Graviton3
      architecture: arm64
      vcpus: 64
      memory_gb: 128
    metrics_focus: "baseline throughput"

# Additional phases...
```

### Configuration Fields

| Field | Description | Required |
|-------|-------------|----------|
| `id` | Unique identifier for the benchmark | Yes |
| `description` | Human-readable description | Yes |
| `application` | Application type (gc-classic or gchp) | Yes |
| `simulation_type` | Simulation type (fullchem, aerosol, transport, etc.) | Yes |
| `domain` | Domain configuration (type, resolution) | Yes |
| `duration` | Simulation duration in days | Yes |
| `hardware` | Hardware configuration (instance type, processor, etc.) | Yes |
| `metrics_focus` | Focus area for metrics analysis | No |

## Output Reports

The benchmark analyzer generates several output formats:

1. **CSV Data**: Raw benchmark results in tabular format
2. **JSON Data**: Structured benchmark results
3. **Visualizations**: Performance charts and comparisons
4. **HTML Report**: Interactive web-based report
5. **PDF Report**: Printable report document (requires weasyprint)

### Key Visualizations

1. **Throughput by Processor Type**: Compare simulation throughput across different processor types
2. **Cost vs. Performance**: Scatter plot showing cost efficiency
3. **Instance Type Comparison**: Compare performance across instance types
4. **Scaling Performance**: Show scaling efficiency for GCHP
5. **Performance by Simulation Type**: Compare different simulation types
6. **Resolution Impact**: Show the impact of resolution on performance

## Dependencies

The benchmarking scripts require:

- Python 3.6+
- AWS CLI configured with appropriate permissions
- Python packages: boto3, pandas, matplotlib, seaborn, pyyaml
- For PDF reports: weasyprint (optional)

Install dependencies:

```bash
pip install boto3 pandas matplotlib seaborn pyyaml
pip install weasyprint  # Optional, for PDF reports
```

## Best Practices

1. **Run Benchmarks Iteratively**: Start with Phase 1 to establish baselines
2. **Use Similar Job Definitions**: Keep container versions consistent
3. **Monitor Costs**: Set up AWS Budget alerts to avoid unexpected costs
4. **Save Results**: Always download and backup your results
5. **Document Findings**: Record observations about performance patterns