# GEOS-Chem AWS Cloud Runner Testing Plan for Graviton/ARM Compatibility

This document outlines a comprehensive testing strategy for ensuring optimal performance and compatibility of the GEOS-Chem AWS Cloud Runner on Graviton/ARM architecture, with a focus on the compute infrastructure.

## Table of Contents

1. [Introduction](#1-introduction)
2. [Testing Objectives](#2-testing-objectives)
3. [Testing Infrastructure](#3-testing-infrastructure)
4. [Container Testing](#4-container-testing)
5. [Compute Performance Testing](#5-compute-performance-testing)
6. [Benchmarking Framework](#6-benchmarking-framework)
7. [Integration Testing](#7-integration-testing)
8. [Regression Testing](#8-regression-testing)
9. [Implementation Timeline](#9-implementation-timeline)
10. [Success Criteria](#10-success-criteria)

## 1. Introduction

The GEOS-Chem AWS Cloud Runner includes infrastructure for running atmospheric chemistry simulations on AWS Batch using both x86 and ARM (Graviton) processors. This testing plan focuses on ensuring that the compute infrastructure works correctly across architectures, with an emphasis on optimizing performance on Graviton processors.

### Project Components to Test

1. **Container Infrastructure**
   - Building and optimizing Dockerfiles for different architectures
   - Runtime scripts and utilities
   - Cross-architecture image building and testing

2. **Compute Infrastructure**
   - AWS Batch environment configuration
   - Job definitions optimized for different instance types
   - Job scheduling and queue management

3. **Performance Benchmarking**
   - Systematic performance measurement
   - Cross-architecture comparison
   - Cost-performance analysis

4. **End-to-End Workflow**
   - Integration with the web interface
   - Data flow from simulation setup to results

## 2. Testing Objectives

1. **Compatibility Testing**: Ensure the GEOS-Chem code and dependencies work correctly on Graviton processors
2. **Performance Optimization**: Identify and implement optimizations for ARM architecture
3. **Cross-architecture Testing**: Verify that the system works seamlessly across x86 and ARM architectures
4. **Benchmarking**: Establish performance baselines and measure improvements
5. **Regression Prevention**: Ensure new features don't break existing functionality

## 3. Testing Infrastructure

### AWS Infrastructure for Testing

#### Core Infrastructure
- Dedicated testing VPC with appropriate subnets
- Testing S3 buckets for input/output data
- ECR repositories for test images

#### Compute Environments
Multiple compute environments to test different processor architectures and instance families:

1. **Graviton3 Environment**
   - c7g.4xlarge, c7g.8xlarge, c7g.16xlarge instances
   - ARM64 architecture optimized for GEOS-Chem

2. **Graviton3E HPC Environment**
   - hpc7g.16xlarge instances with EFA networking
   - For GCHP multi-node testing

3. **Intel Environment**
   - c6i.4xlarge, c6i.8xlarge, c6i.16xlarge instances
   - For x86 comparison testing

4. **AMD Environment**
   - c6a.4xlarge, c6a.8xlarge, c6a.16xlarge instances
   - For additional x86 comparison testing

5. **High Memory Environments**
   - r7g.4xlarge, r7g.8xlarge (Graviton)
   - r6i.8xlarge, r6i.16xlarge (Intel)
   - For memory-intensive workloads

### Automated Testing Resources

1. **CI/CD Pipeline**
   - GitHub Actions workflow for automated testing
   - Cross-architecture container builds
   - Unit and integration tests

2. **Test Data Repository**
   - Standard input datasets for reproducible testing
   - Performance test cases
   - Regression test suite

3. **Monitoring and Logging**
   - CloudWatch for metrics collection
   - Compute resource utilization tracking
   - Performance data aggregation

## 4. Container Testing

### 4.1 Multi-architecture Container Build Testing

Test that containers can be built correctly for different architectures:

1. **Base Image Selection Tests**
   - Test different base images for ARM64 (Amazon Linux 2023, Ubuntu)
   - Evaluate size, security, and dependency compatibility

2. **Cross-Platform Build System**
   - Implement and test Docker BuildX for multi-architecture builds
   - Verify image manifest for proper architecture targeting

3. **Dependency Compatibility Tests**
   - Test critical scientific libraries on ARM64 (NetCDF, HDF5, OpenMPI)
   - Verify proper linking and runtime performance

4. **Compiler Optimization Tests**
   - Test different compiler flags for ARM64 optimization
   - Compare performance with and without Neoverse-specific optimizations

#### Test Scripts

```bash
#!/bin/bash
# test-container-build.sh
# Test building GEOS-Chem container for multiple architectures

# Test ARM64 build
echo "Building ARM64 container..."
docker buildx build --platform linux/arm64 -t geos-chem:arm64-test -f Dockerfile.arm64 .
if [ $? -ne 0 ]; then
    echo "ARM64 build failed"
    exit 1
fi

# Test x86_64 build
echo "Building x86_64 container..."
docker buildx build --platform linux/amd64 -t geos-chem:x86-test -f Dockerfile.x86 .
if [ $? -ne 0 ]; then
    echo "x86_64 build failed"
    exit 1
fi

# Test multi-platform build and push to ECR
echo "Testing multi-platform build..."
docker buildx build --platform linux/arm64,linux/amd64 -t <ecr-repo>/geos-chem:multi-test .
if [ $? -ne 0 ]; then
    echo "Multi-platform build failed"
    exit 1
fi

echo "Container build tests completed successfully"
```

### 4.2 Runtime Compatibility Testing

Test that container runtime scripts work correctly on different architectures:

1. **Entrypoint Script Tests**
   - Verify proper handling of input/output paths
   - Test environment variable configuration
   - Check runtime optimizations (OMP_NUM_THREADS, etc.)

2. **Data Download Tests**
   - Test AWS CLI performance for data transfer
   - Verify S3 data access patterns work efficiently

3. **Simulation Execution Tests**
   - Run short standard simulations to verify execution
   - Check for ARM-specific runtime errors

4. **Results Processing Tests**
   - Test post-processing scripts on different architectures
   - Verify data format compatibility

#### Test Script

```python
#!/usr/bin/env python3
# test_runtime_compatibility.py
# Tests runtime behavior of container on different architectures

import subprocess
import sys
import json
import os

def run_test_container(arch, test_case):
    """Run a test container with specified architecture and test case"""
    image_tag = f"geos-chem:{arch}-test"
    
    # Sample input path for test
    input_path = "s3://gcgrid-test/mini-test-data/"
    
    # Output path for test
    output_path = f"s3://gcgrid-test-output/{arch}/{test_case}/"
    
    # Command to run container
    cmd = [
        "docker", "run", "--rm",
        "-e", "AWS_ACCESS_KEY_ID",
        "-e", "AWS_SECRET_ACCESS_KEY",
        "-e", "AWS_SESSION_TOKEN",
        image_tag,
        input_path, output_path
    ]
    
    print(f"Running test for {arch} - {test_case}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    return {
        "arch": arch,
        "test_case": test_case,
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "success": result.returncode == 0
    }

# Test cases
architectures = ["arm64", "x86"]
test_cases = ["basic", "download_only", "process_only"]

# Run tests
results = []
for arch in architectures:
    for test_case in test_cases:
        result = run_test_container(arch, test_case)
        results.append(result)
        
        if not result["success"]:
            print(f"TEST FAILED: {arch} - {test_case}")
            print(f"Error: {result['stderr']}")
        else:
            print(f"TEST PASSED: {arch} - {test_case}")

# Write results to file
with open("runtime_test_results.json", "w") as f:
    json.dump(results, f, indent=2)

# Exit with failure if any test failed
if any(not r["success"] for r in results):
    sys.exit(1)
```

## 5. Compute Performance Testing

### 5.1 Instance Type Testing

Test GEOS-Chem performance across different instance types:

1. **CPU Type Tests**
   - Graviton3 (c7g) vs. Intel (c6i) vs. AMD (c6a)
   - Graviton3E (hpc7g) for HPC workloads
   - Graviton4 (c8g) vs. Graviton3 comparison

2. **Instance Size Tests**
   - Size scaling (4xlarge, 8xlarge, 16xlarge)
   - Cost-performance ratio analysis
   - Memory-to-core ratio impact

3. **Memory-Optimized Tests**
   - r7g vs. c7g for memory-intensive workloads
   - Impact of memory bandwidth on performance

4. **HPC Networking Tests**
   - EFA vs. standard networking for multi-node workloads
   - GCHP scaling across nodes with different network configurations

### 5.2 Graviton-Specific Optimization Testing

1. **Compiler Flag Optimization**
   - Test different combinations of Neoverse-specific flags
   - Evaluate impact of `-mcpu=neoverse-v1` and other Graviton-specific optimizations
   - Measure speedup from vectorization options

2. **Memory Access Patterns**
   - Test different memory allocation strategies
   - Evaluate NUMA awareness impact on Graviton
   - Profile cache usage and optimization

3. **Library Optimization**
   - Test ARM-optimized versions of NetCDF, HDF5, BLAS libraries
   - Compare with standard versions
   - Evaluate custom-compiled libraries vs. package manager versions

4. **Thread Scaling Tests**
   - Test different OMP_NUM_THREADS configurations
   - Evaluate OpenMP scheduling strategies
   - Compare thread affinity approaches

## 6. Benchmarking Framework

### 6.1 Standard Benchmark Suite

Implement a standardized benchmarking framework to consistently measure performance:

1. **Test Cases**
   - Standard global simulations (4°×5° resolution)
   - High-resolution simulations (2°×2.5° and 0.5°×0.625°)
   - Different chemistry configurations (Full Chemistry, Aerosol-only, Transport-only)
   - GCHP multi-node simulations

2. **Performance Metrics**
   - Throughput (simulation days per wall-clock day)
   - Cost per simulation day
   - Memory usage and efficiency
   - Scaling efficiency (across cores and nodes)

3. **Benchmark Automation**
   - Script-driven benchmark execution
   - Automated result collection and processing
   - Visualization and reporting

### 6.2 Benchmark Implementation

1. **Benchmark Orchestration Script**
   ```python
   # benchmark-orchestrator.py
   # Framework to run benchmarks across different architectures and configurations
   
   import argparse
   import yaml
   import boto3
   import uuid
   import json
   import time
   import logging
   
   # Parse configuration
   def parse_benchmark_config(config_file):
       with open(config_file, 'r') as f:
           return yaml.safe_load(f)
   
   # Submit benchmark jobs
   def submit_benchmarks(config, phase=None):
       batch = boto3.client('batch')
       
       # Filter benchmarks by phase if specified
       benchmarks = []
       if phase:
           phase_key = f"phase_{phase}"
           if phase_key in config:
               benchmarks = config[phase_key]
       else:
           # Collect all benchmarks from all phases
           for key in config:
               if key.startswith("phase_"):
                   benchmarks.extend(config[key])
       
       # Submit each benchmark as a Batch job
       results = []
       for benchmark in benchmarks:
           job_name = f"benchmark-{benchmark['id']}-{uuid.uuid4().hex[:8]}"
           
           # Determine job queue based on hardware configuration
           if benchmark['hardware']['architecture'] == 'arm64':
               job_queue = "geos-chem-graviton"
               if benchmark.get('application') == 'gchp':
                   job_definition = "geos-chem-graviton-mpi"
               else:
                   job_definition = "geos-chem-graviton"
           else:
               job_queue = "geos-chem-x86"
               if benchmark.get('application') == 'gchp':
                   job_definition = "geos-chem-x86-mpi"
               else:
                   job_definition = "geos-chem-x86"
           
           # Create job parameters
           params = {
               'benchmarkId': benchmark['id'],
               'configurationType': benchmark['simulation_type'],
               'resolution': benchmark['domain']['resolution'],
               'simDays': str(benchmark['duration']['days'])
           }
           
           # Submit job
           response = batch.submit_job(
               jobName=job_name,
               jobQueue=job_queue,
               jobDefinition=job_definition,
               parameters=params,
               tags={
                   'BenchmarkId': benchmark['id'],
                   'Application': benchmark.get('application', 'gc-classic'),
                   'SimulationType': benchmark['simulation_type']
               }
           )
           
           results.append({
               'benchmark_id': benchmark['id'],
               'job_id': response['jobId'],
               'job_name': job_name,
               'status': 'SUBMITTED'
           })
           
           logging.info(f"Submitted benchmark {benchmark['id']} as job {job_name}")
       
       return results
   
   # Main function
   def main():
       parser = argparse.ArgumentParser(description='GEOS-Chem Benchmark Orchestrator')
       parser.add_argument('--config', '-c', required=True, help='Benchmark configuration YAML file')
       parser.add_argument('--phase', '-p', type=int, choices=[1, 2, 3, 4], help='Run only a specific benchmark phase')
       parser.add_argument('--output', '-o', default='benchmark-jobs.json', help='Output file for job tracking')
       args = parser.parse_args()
       
       # Configure logging
       logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
       
       # Load configuration
       config = parse_benchmark_config(args.config)
       
       # Submit benchmarks
       results = submit_benchmarks(config, args.phase)
       
       # Write results to file
       with open(args.output, 'w') as f:
           json.dump(results, f, indent=2)
       
       logging.info(f"Submitted {len(results)} benchmark jobs. Details written to {args.output}")
   
   if __name__ == "__main__":
       main()
   ```

2. **Benchmark Result Analysis Tool**
   - Automated data collection
   - Statistical analysis
   - Comparative visualization
   - Cost-performance assessment

## 7. Integration Testing

### 7.1 End-to-End Workflow Testing

Test the complete workflow from the web interface through job execution and results visualization:

1. **Web Interface Integration**
   - Test simulation configuration for different architectures
   - Verify correct job queue and definition selection
   - Validate architecture-specific parameter handling

2. **Job Submission and Monitoring**
   - Test job submission to different compute environments
   - Verify job status updates
   - Test error handling and failure recovery

3. **Results Processing and Storage**
   - Verify output file compatibility across architectures
   - Test results visualization with different output formats
   - Validate metadata handling

4. **Cross-Architecture Data Flow**
   - Test data transfer between x86 and ARM jobs
   - Verify format compatibility for post-processing
   - Test simulation chains with mixed architecture steps

### 7.2 API Testing

Test the API functionality for job management and results access:

1. **Job API Tests**
   - Test job submission for different architectures
   - Verify appropriate compute environment selection
   - Test job control operations (stop, resume)

2. **Results API Tests**
   - Test retrieving results from different architecture jobs
   - Verify data format compatibility
   - Test result filtering and searching

## 8. Regression Testing

### 8.1 Scientific Validation Tests

Ensure scientific accuracy is maintained across architectures:

1. **Output Validation**
   - Compare key chemical species concentrations between architectures
   - Verify agreement within acceptable numerical tolerance
   - Validate against benchmark cases

2. **Numerical Stability Tests**
   - Test long-duration runs for numerical stability
   - Verify conservation properties
   - Test edge cases with extreme conditions

### 8.2 Automation Framework

Implement automated regression testing to catch issues early:

1. **Test Matrix**
   - Define a matrix of test cases across architectures
   - Include a range of simulation configurations
   - Cover different instance types and sizes

2. **CI/CD Integration**
   - Run a subset of tests on every commit
   - Schedule comprehensive tests weekly
   - Alert on regressions

## 9. Implementation Timeline

The testing implementation will be phased over 10 weeks:

### Phase 1: Infrastructure Setup (Weeks 1-2)
- Set up testing AWS infrastructure
- Create test data repositories
- Implement CI/CD pipelines

### Phase 2: Container Testing (Weeks 3-4)
- Implement multi-architecture build tests
- Develop runtime compatibility test suite
- Establish baseline container functionality

### Phase 3: Compute Performance Testing (Weeks 5-6)
- Implement instance type tests
- Develop Graviton optimization tests
- Create performance testing framework

### Phase 4: Benchmarking (Weeks 7-8)
- Set up benchmark orchestration framework
- Implement result analysis tools
- Run initial benchmark suite

### Phase 5: Integration and Regression Testing (Weeks 9-10)
- Develop end-to-end workflow tests
- Implement scientific validation suite
- Create automated regression testing framework

## 10. Success Criteria

The testing framework will be considered successful if it meets the following criteria:

1. **Compatibility**
   - GEOS-Chem runs successfully on all target architectures
   - Containers build and run correctly on both ARM and x86
   - Scientific results are consistent across architectures

2. **Performance**
   - Graviton-specific optimizations are identified and implemented
   - Performance benchmarks show expected scaling behavior
   - Cost-performance metrics are captured accurately

3. **Automation**
   - Tests run automatically as part of CI/CD
   - Regression testing catches potential issues
   - Performance reports are generated automatically

4. **Documentation**
   - Testing procedures are well-documented
   - Performance results are reported clearly
   - Optimization recommendations are provided based on test results