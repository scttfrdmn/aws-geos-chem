# GEOS-Chem AWS Benchmarking Plan

## Overview

This document outlines a comprehensive benchmarking strategy for the GEOS-Chem AWS Cloud Runner. The purpose of these benchmarks is to:

1. Establish baseline performance metrics across different processor architectures
2. Determine cost-optimal configurations for various simulation types
3. Provide data-driven recommendations to researchers
4. Create performance expectations for the web interface
5. Identify optimization opportunities

## Benchmark Matrix

The benchmarking plan employs a multi-dimensional approach covering various combinations of:

- GEOS-Chem simulation types
- Hardware configurations
- Temporal and spatial domains
- Instance types and processor families

### Simulation Types

| ID | Simulation Type | Description | Computational Characteristics |
|----|----------------|-------------|------------------------------|
| FC | Full Chemistry | Standard tropospheric-stratospheric chemistry | High chemistry computation, moderate I/O |
| TROP | Tropchem | Tropospheric chemistry only | Moderate chemistry computation, moderate I/O |
| AER | Aerosol-only | Aerosols without full gas-phase chemistry | Moderate computation, high particle operations |
| CH4 | Methane | CH₄ simulation | Lower computation, moderate transport |
| TRANS | Transport | Passive tracer transport | Low chemistry, high transport calculation |
| CO2 | Carbon Dioxide | CO₂ simulation | Lower computation, high I/O for flux data |

### Hardware Configurations

#### GC Classic (Single Node)

| ID | Processor | Instance Type | vCPUs | Memory (GiB) | Architecture |
|----|-----------|--------------|-------|-------------|--------------|
| G3-C7G-16 | Graviton3 | c7g.16xlarge | 64 | 128 | ARM64 |
| G3-C7G-8 | Graviton3 | c7g.8xlarge | 32 | 64 | ARM64 |
| G4-C8G-16 | Graviton4 | c8g.16xlarge | 64 | 128 | ARM64 |
| G4-C8G-8 | Graviton4 | c8g.8xlarge | 32 | 64 | ARM64 |
| IN-C6I-16 | Intel Xeon | c6i.16xlarge | 64 | 128 | x86_64 |
| IN-C6I-8 | Intel Xeon | c6i.8xlarge | 32 | 64 | x86_64 |
| AM-C6A-16 | AMD EPYC | c6a.16xlarge | 64 | 128 | x86_64 |
| AM-C6A-8 | AMD EPYC | c6a.8xlarge | 32 | 64 | x86_64 |

#### GCHP (Multi-Node)

| ID | Configuration | Nodes | Processor | Instance Type | Total Cores | Network |
|----|--------------|-------|-----------|--------------|-------------|---------|
| G3E-HPC7G-2 | Graviton3E | 2 | Graviton3E | hpc7g.16xlarge | 128 | EFA 200 Gbps |
| G3E-HPC7G-4 | Graviton3E | 4 | Graviton3E | hpc7g.16xlarge | 256 | EFA 200 Gbps |
| G3E-HPC7G-8 | Graviton3E | 8 | Graviton3E | hpc7g.16xlarge | 512 | EFA 200 Gbps |
| G4-C8G-2 | Graviton4 | 2 | Graviton4 | c8g.48xlarge | 192 | EFA 200 Gbps |
| G4-C8G-4 | Graviton4 | 4 | Graviton4 | c8g.48xlarge | 384 | EFA 200 Gbps |
| IN-HPC6A-2 | Intel HPC | 2 | Intel Xeon | hpc6id.16xlarge | 128 | EFA 200 Gbps |
| IN-HPC6A-4 | Intel HPC | 4 | Intel Xeon | hpc6id.16xlarge | 256 | EFA 200 Gbps |
| IN-HPC6A-8 | Intel HPC | 8 | Intel Xeon | hpc6id.16xlarge | 512 | EFA 200 Gbps |

### Spatial and Temporal Domains

| ID | Resolution | Domain | Duration | Description |
|----|------------|--------|----------|-------------|
| G4X5-1D | 4°×5° | Global | 1 day | Coarse global, short-term |
| G4X5-7D | 4°×5° | Global | 7 days | Coarse global, medium-term |
| G4X5-31D | 4°×5° | Global | 31 days | Coarse global, monthly |
| G2X25-1D | 2°×2.5° | Global | 1 day | Medium global, short-term |
| G2X25-7D | 2°×2.5° | Global | 7 days | Medium global, medium-term |
| G2X25-31D | 2°×2.5° | Global | 31 days | Medium global, monthly |
| AS-NEST-7D | 0.5°×0.625° | Asia | 7 days | Nested domain over Asia |
| NA-NEST-7D | 0.5°×0.625° | North America | 7 days | Nested domain over North America |
| GCHP-C24-1D | C24 | Global | 1 day | GCHP cubed-sphere, low resolution |
| GCHP-C90-1D | C90 | Global | 1 day | GCHP cubed-sphere, medium resolution |
| GCHP-C180-1D | C180 | Global | 1 day | GCHP cubed-sphere, high resolution |
| GCHP-C90-7D | C90 | Global | 7 days | GCHP cubed-sphere, medium-term |

## Benchmark Methodology

### Preparation

1. **Container Preparation**
   - Build separate containers for each architecture (ARM64, x86_64)
   - Ensure consistent compiler flags for fair comparison
   - Use same GEOS-Chem version across all tests

2. **Input Data Staging**
   - Pre-stage meteorological data in Amazon S3
   - Configure containers to efficiently access S3 data
   - Use identical input data across comparable tests

3. **Monitoring Setup**
   - Configure CloudWatch for detailed metrics collection
   - Set up custom metrics for GEOS-Chem performance
   - Enable instance-level metrics (CPU, memory, network, disk)

### Execution Process

For each benchmark combination:

1. **Pre-Run**
   - Initialize AWS Batch job or ParallelCluster
   - Record start time and initial conditions
   - Verify resource allocation

2. **Execution**
   - Run GEOS-Chem simulation with specified parameters
   - Collect real-time metrics every 5 minutes
   - Capture detailed logs

3. **Post-Run**
   - Verify simulation completion and output integrity
   - Collect and archive final metrics
   - Shut down compute resources

### Metrics Collection

#### Performance Metrics
- Simulation throughput (model days per wall-clock day)
- Total wall-clock time to completion
- CPU utilization (%) over time
- Memory utilization (GB and %) over time
- I/O performance (read/write operations, data volumes)
- Network utilization (for multi-node configurations)

#### Cost Metrics
- Total AWS cost for the simulation
- Cost per simulated day
- Cost-performance ratio ($/simulation day)
- Comparison between Spot and On-Demand pricing

#### Quality Metrics
- Checksum verification of outputs
- Statistical comparison between architectures
- Reproducibility across multiple runs

## Benchmark Execution Plan

### Phase 1: Baseline Single-Node Benchmarks

Focus on establishing baseline performance for GEOS-Chem Classic across processor types.

| ID | Simulation Type | Resolution | Duration | Processor Types | Metrics Focus |
|----|----------------|------------|----------|-----------------|---------------|
| B1-1 | Full Chemistry | 4°×5° | 7 days | All GC Classic configs | Basic throughput, cost comparison |
| B1-2 | Full Chemistry | 2°×2.5° | 7 days | All GC Classic configs | Resolution scaling impact |
| B1-3 | Aerosol-only | 4°×5° | 7 days | All GC Classic configs | Chemistry complexity impact |
| B1-4 | Transport | 4°×5° | 7 days | All GC Classic configs | Transport-only performance |
| B1-5 | Full Chemistry | 4°×5° | 31 days | Selected subset | Long-run stability |

### Phase 2: Multi-Node GCHP Benchmarks

Focus on scalability and performance of GEOS-Chem High Performance with MPI.

| ID | Simulation Type | Resolution | Duration | Node Configurations | Metrics Focus |
|----|----------------|------------|----------|---------------------|---------------|
| B2-1 | Full Chemistry | C24 | 1 day | All GCHP configs | Basic MPI scaling |
| B2-2 | Full Chemistry | C90 | 1 day | All GCHP configs | Higher resolution impact |
| B2-3 | Full Chemistry | C180 | 1 day | Selected subset | High resolution performance |
| B2-4 | Full Chemistry | C90 | 7 days | Selected subset | Medium-term stability |
| B2-5 | Aerosol-only | C90 | 1 day | All GCHP configs | Chemistry complexity impact |

### Phase 3: Specialized Benchmarks

Focus on specific scientific use cases and optimizations.

| ID | Description | Configuration | Focus Area |
|----|-------------|--------------|------------|
| B3-1 | Nested Domain | NA-NEST-7D with all GC Classic configs | Regional modeling performance |
| B3-2 | Stratospheric Focus | Full Chemistry with extended vertical levels | Vertical resolution impact |
| B3-3 | Data-Intensive | CO2 with hourly output | I/O performance |
| B3-4 | Compiler Optimization | Various compiler flags on G3-C7G-16 | Compiler impact |
| B3-5 | Memory-Optimized | Full Chemistry on memory-optimized instances | Memory impact |

### Phase 4: Real-World Research Scenarios

Simulate complete research workflows to validate benchmark relevance.

| ID | Research Scenario | Description | Configurations |
|----|------------------|-------------|----------------|
| B4-1 | Annual Simulation | Full year global simulation | Selected best performers |
| B4-2 | Air Quality Episode | High-resolution nested domain for pollution event | Selected best performers |
| B4-3 | Emissions Sensitivity | Multiple runs with varied emissions | Selected best performers |
| B4-4 | Climate Projection | Decadal-scale transportation simulation | Selected best performers |

## Data Analysis Methodology

### Automated Analysis Pipeline

1. **Data Collection**
   - AWS CloudWatch metrics export
   - Container log parsing
   - Output file analysis

2. **Performance Analysis**
   - Throughput calculations
   - Scaling efficiency analysis
   - Performance bottleneck identification

3. **Cost Analysis**
   - Cost per simulation day calculations
   - Price-performance ratio
   - Spot vs. On-Demand comparison
   - Break-even analysis for different simulation durations

4. **Comparative Analysis**
   - Processor type comparison
   - Scaling efficiency across node counts
   - Resolution impact analysis
   - Chemistry mechanism complexity impact

### Visualization and Reporting

Automated generation of:

1. **Performance Dashboards**
   - Interactive comparison charts
   - Time-series visualizations
   - Scaling efficiency curves

2. **Cost Optimization Reports**
   - Cost breakdown by component
   - Price-performance matrices
   - Optimal configuration recommendations

3. **Configuration Guides**
   - Scenario-specific recommendations
   - Optimal settings for different research types
   - Expected performance and cost metrics

## Benchmark Workflow Automation

### AWS Batch Job Definition Example

```json
{
  "jobDefinitionName": "geos-chem-benchmark",
  "type": "container",
  "containerProperties": {
    "image": "${ECR_REPOSITORY}:${IMAGE_TAG}",
    "vcpus": ${VCPUS},
    "memory": ${MEMORY},
    "command": [
      "/benchmarks/run_benchmark.sh",
      "${BENCHMARK_ID}",
      "${SIMULATION_TYPE}",
      "${RESOLUTION}",
      "${DURATION}",
      "${OUTPUT_BUCKET}"
    ],
    "environment": [
      {
        "name": "AWS_REGION",
        "value": "us-east-1"
      },
      {
        "name": "OMP_NUM_THREADS",
        "value": "${OMP_NUM_THREADS}"
      }
    ],
    "jobRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/GEOSChemBenchmarkRole",
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/aws/batch/geos-chem-benchmarks",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "${BENCHMARK_ID}"
      }
    }
  }
}
```

### Benchmark Orchestration Script

```bash
#!/bin/bash
# orchestrate_benchmarks.sh

# Load benchmark configurations
source benchmark_configs.sh

# Function to submit a benchmark job
submit_benchmark() {
  local benchmark_id=$1
  local sim_type=$2
  local resolution=$3
  local duration=$4
  local instance_type=$5
  local vcpus=$6
  local memory=$7
  
  echo "Submitting benchmark: ${benchmark_id}"
  
  aws batch submit-job \
    --job-name "benchmark-${benchmark_id}" \
    --job-queue ${JOB_QUEUE} \
    --job-definition ${JOB_DEFINITION} \
    --container-overrides '{
      "command": ["/benchmarks/run_benchmark.sh", "'"${benchmark_id}"'", "'"${sim_type}"'", "'"${resolution}"'", "'"${duration}"'", "'"${OUTPUT_BUCKET}"'"],
      "environment": [
        {"name": "OMP_NUM_THREADS", "value": "'"${vcpus}"'"},
        {"name": "INSTANCE_TYPE", "value": "'"${instance_type}"'"}
      ],
      "resourceRequirements": [
        {"type": "VCPU", "value": "'"${vcpus}"'"},
        {"type": "MEMORY", "value": "'"${memory}"'"}
      ]
    }'
    
  # Prevent overwhelming the API
  sleep 2
}

# Execute Phase 1 benchmarks
echo "Starting Phase 1 benchmarks..."
for config in "${PHASE1_CONFIGS[@]}"; do
  IFS=',' read -r benchmark_id sim_type resolution duration instance_type vcpus memory <<< "$config"
  submit_benchmark "$benchmark_id" "$sim_type" "$resolution" "$duration" "$instance_type" "$vcpus" "$memory"
done

# Continue with other phases as needed
```

## Initial Benchmark Schedule

The following schedule outlines the execution plan for all benchmarks:

| Phase | Start Date | End Date | Number of Jobs | Expected Duration |
|-------|------------|----------|----------------|-------------------|
| Phase 1 | Week 1, Day 1 | Week 2, Day 3 | 40 | 10 days |
| Phase 2 | Week 2, Day 4 | Week 3, Day 5 | 35 | 9 days |
| Phase 3 | Week 3, Day 6 | Week 4, Day 4 | 25 | 6 days |
| Phase 4 | Week 4, Day 5 | Week 5, Day 5 | 12 | 7 days |
| Analysis | Week 5, Day 6 | Week 6, Day 3 | N/A | 5 days |

## Expected Outcomes

1. **Performance Guide**
   - Comprehensive comparison across processor architectures
   - Scaling curves for different simulation types
   - Performance predictions for different configurations

2. **Cost Optimization Guide**
   - Most cost-effective configurations by simulation type
   - Spot vs. On-Demand recommendations
   - Budget planning guidance for different research projects

3. **Web Interface Integration**
   - Data-driven recommendations in the configuration interface
   - Accurate cost and runtime estimations
   - Optimal defaults for different simulation types

4. **Research Publications**
   - Benchmark methodology and results paper
   - Cloud computing best practices for atmospheric chemistry modeling
   - Performance comparison across cloud computing options

## Resource Requirements

1. **AWS Resources**
   - Multiple AWS accounts for parallel testing
   - Service limit increases for concurrent Batch jobs
   - S3 storage for input/output data and results

2. **Human Resources**
   - Benchmark coordinator (1 FTE)
   - Data analyst (0.5 FTE)
   - DevOps engineer (0.5 FTE)

3. **Budget Estimate**
   - AWS compute costs: $15,000 - $20,000
   - Storage costs: $1,000 - $2,000
   - Data transfer: $500 - $1,000
   - Total estimate: $16,500 - $23,000

## Risk Management

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Spot instance termination | Medium | Medium | Implement checkpointing, prioritize critical benchmarks for On-Demand |
| Service limits | Medium | High | Request limit increases in advance, distribute across regions if needed |
| Data integrity issues | Low | High | Implement validation checks, replicate critical benchmarks |
| Cost overruns | Medium | Medium | Set up budget alerts, prioritize benchmarks if approaching limit |
| Performance inconsistency | Medium | Medium | Run multiple trials for key benchmarks, analyze variance |

## Appendix

### Compiler Optimization Flags

#### GCC/GFortran for ARM64
```
FFLAGS="-O3 -mcpu=neoverse-v1 -ffast-math -fallow-argument-mismatch -march=armv8-a+crc"
```

#### GCC/GFortran for x86_64
```
FFLAGS="-O3 -march=skylake-avx512 -ffast-math -fallow-argument-mismatch"
```

### Sample Benchmark Analysis Script

```python
#!/usr/bin/env python3
# analyze_benchmarks.py

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import boto3
import json
from datetime import datetime

# Configuration
RESULTS_BUCKET = "geos-chem-benchmarks-results"
OUTPUT_DIR = "./benchmark_results"

# AWS clients
s3 = boto3.client('s3')
cloudwatch = boto3.client('cloudwatch')

# Load benchmark metadata
def load_benchmark_metadata():
    response = s3.get_object(
        Bucket=RESULTS_BUCKET,
        Key="metadata/benchmark_catalog.json"
    )
    return json.loads(response['Body'].read().decode('utf-8'))

# Analyze performance metrics
def analyze_performance(benchmark_id, metadata):
    # Load CloudWatch metrics
    end_time = datetime.utcnow()
    start_time = datetime.strptime(metadata[benchmark_id]['start_time'], 
                                   "%Y-%m-%dT%H:%M:%SZ")
    
    # Get CPU utilization
    cpu_response = cloudwatch.get_metric_statistics(
        Namespace="AWS/Batch",
        MetricName="CPUUtilization",
        Dimensions=[
            {
                'Name': 'JobId',
                'Value': metadata[benchmark_id]['job_id']
            }
        ],
        StartTime=start_time,
        EndTime=end_time,
        Period=300,
        Statistics=['Average']
    )
    
    # Process metrics and create dataframe
    # ... additional processing ...
    
    # Calculate key performance indicators
    wall_time = (metadata[benchmark_id]['end_time'] - 
                metadata[benchmark_id]['start_time']).total_seconds() / 3600
    sim_days = metadata[benchmark_id]['simulation_days']
    throughput = sim_days / wall_time
    
    # Return performance summary
    return {
        'benchmark_id': benchmark_id,
        'wall_time_hours': wall_time,
        'throughput_days_per_day': throughput * 24,
        'avg_cpu_utilization': avg_cpu,
        'max_memory_gb': max_mem
    }

# Main analysis function
def main():
    metadata = load_benchmark_metadata()
    
    # Create results directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Analyze each benchmark
    results = []
    for benchmark_id in metadata:
        print(f"Analyzing benchmark: {benchmark_id}")
        result = analyze_performance(benchmark_id, metadata)
        results.append(result)
    
    # Create results dataframe
    df = pd.DataFrame(results)
    
    # Join with configuration data
    config_df = pd.DataFrame([metadata[b]['configuration'] for b in metadata])
    config_df['benchmark_id'] = metadata.keys()
    results_df = pd.merge(df, config_df, on='benchmark_id')
    
    # Save to CSV
    results_df.to_csv(f"{OUTPUT_DIR}/benchmark_results_summary.csv", index=False)
    
    # Generate visualizations
    generate_visualization(results_df)

# Generate key visualizations
def generate_visualization(df):
    # Throughput by processor type
    plt.figure(figsize=(12, 8))
    sns.barplot(x='processor_type', y='throughput_days_per_day', 
               hue='simulation_type', data=df)
    plt.title('Simulation Throughput by Processor Type')
    plt.ylabel('Throughput (Model Days / Wall Day)')
    plt.tight_layout()
    plt.savefig(f"{OUTPUT_DIR}/throughput_by_processor.png")
    
    # Cost-performance comparison
    plt.figure(figsize=(12, 8))
    sns.scatterplot(x='cost_per_day', y='throughput_days_per_day', 
                   hue='processor_type', size='vcpus', data=df)
    plt.title('Cost vs. Performance')
    plt.xlabel('Cost per Simulation Day ($)')
    plt.ylabel('Throughput (Model Days / Wall Day)')
    plt.tight_layout()
    plt.savefig(f"{OUTPUT_DIR}/cost_vs_performance.png")
    
    # Additional visualizations...

if __name__ == "__main__":
    main()
```

### Benchmark Result Example

```json
{
  "benchmark_id": "B1-1-G3-C7G-16-FC",
  "configuration": {
    "simulation_type": "Full Chemistry",
    "resolution": "4x5",
    "duration_days": 7,
    "processor_type": "Graviton3",
    "instance_type": "c7g.16xlarge",
    "vcpus": 64,
    "memory_gb": 128
  },
  "results": {
    "wall_time_hours": 3.45,
    "throughput_days_per_day": 48.7,
    "avg_cpu_utilization": 92.3,
    "max_memory_gb": 78.4,
    "total_cost": 12.34,
    "cost_per_simulation_day": 1.76
  },
  "timestamps": {
    "start_time": "2025-05-01T14:23:17Z",
    "end_time": "2025-05-01T17:50:32Z"
  },
  "metrics_location": "s3://geos-chem-benchmarks-results/metrics/B1-1-G3-C7G-16-FC/",
  "output_location": "s3://geos-chem-benchmarks-results/output/B1-1-G3-C7G-16-FC/"
}
```

## Implementation Checklist

- [x] Set up AWS account with appropriate limits
- [x] Create S3 buckets for benchmark data and results
- [x] Build container images for each architecture (ARM64, x86_64)
- [x] Configure AWS Batch compute environments
- [x] Create job definitions for each benchmark configuration
- [x] Implement benchmark automation scripts
- [x] Set up monitoring and alerting
- [x] Create data analysis pipeline
- [x] Generate visualization dashboards
- [ ] Document findings and recommendations
