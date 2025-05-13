#!/usr/bin/env python3
"""
benchmark-orchestrator.py

Orchestrates GEOS-Chem benchmarking across different configurations
and instance types, submitting jobs to AWS Batch and ParallelCluster.
"""

import argparse
import yaml
import os
import sys
import datetime
import json
import uuid
import boto3
import time
import logging
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("benchmark.log")
    ]
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="GEOS-Chem Benchmarking Orchestrator")
    
    parser.add_argument("--config", "-c", required=True,
                        help="Path to benchmarking configuration YAML file")
    parser.add_argument("--output-bucket", "-o", required=True,
                        help="S3 bucket for benchmark results")
    parser.add_argument("--job-queue", "-q",
                        help="AWS Batch job queue for GC Classic benchmarks")
    parser.add_argument("--parallel-cluster", "-p",
                        help="ParallelCluster name for GCHP benchmarks")
    parser.add_argument("--job-definition", "-j",
                        help="AWS Batch job definition for GC Classic benchmarks")
    parser.add_argument("--phase", type=int, choices=[1, 2, 3, 4],
                        help="Only run a specific benchmark phase")
    parser.add_argument("--dry-run", "-d", action="store_true",
                        help="Validate configuration without submitting jobs")
    parser.add_argument("--max-concurrent", "-m", type=int, default=10,
                        help="Maximum number of concurrent benchmark jobs")
    
    return parser.parse_args()

def load_config(config_path):
    """Load benchmarking configuration from YAML file"""
    try:
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file)
        return config
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        sys.exit(1)

def validate_config(config):
    """Validate benchmarking configuration"""
    # Check required fields
    required_fields = ["phase_1", "phase_2", "phase_3", "phase_4"]
    for field in required_fields:
        if field not in config:
            logger.error(f"Missing required field in configuration: {field}")
            return False
    
    # Validate each phase
    for phase in required_fields:
        if not isinstance(config[phase], list):
            logger.error(f"{phase} must be a list of benchmark configurations")
            return False
        
        for i, benchmark in enumerate(config[phase]):
            # Check required benchmark fields
            if "id" not in benchmark:
                logger.warning(f"Benchmark in {phase} index {i} is missing ID, generating one")
                benchmark["id"] = f"{phase.replace('_', '-')}-{str(uuid.uuid4())[:8]}"
            
            if "simulation_type" not in benchmark:
                logger.error(f"Benchmark {benchmark['id']} is missing simulation_type")
                return False
                
            if "hardware" not in benchmark:
                logger.error(f"Benchmark {benchmark['id']} is missing hardware configuration")
                return False
    
    return True

def estimate_benchmark_runtime(benchmark):
    """Estimate runtime for a benchmark in hours"""
    # Basic estimation based on simulation type and duration
    base_runtime = 1.0  # 1 hour base
    
    # Adjust for simulation type
    sim_type_factor = {
        "fullchem": 1.0,
        "tropchem": 0.8,
        "aerosol": 0.7,
        "transport": 0.5,
        "ch4": 0.6,
        "co2": 0.6
    }
    
    sim_type = benchmark.get("simulation_type", "fullchem")
    factor = sim_type_factor.get(sim_type, 1.0)
    
    # Adjust for duration
    duration_days = benchmark.get("duration", {}).get("days", 7)
    duration_factor = duration_days / 7.0
    
    # Adjust for resolution
    resolution = benchmark.get("domain", {}).get("resolution", "4x5")
    resolution_factor = 1.0
    if resolution == "2x2.5":
        resolution_factor = 2.5
    elif resolution in ["0.5x0.625", "nested"]:
        resolution_factor = 5.0
    elif "c90" in resolution:
        resolution_factor = 4.0
    elif "c180" in resolution:
        resolution_factor = 8.0
    
    # Calculate runtime
    estimated_runtime = base_runtime * factor * duration_factor * resolution_factor
    
    # Add safety margin
    return estimated_runtime * 1.5

def generate_batch_job_params(benchmark, args):
    """Generate AWS Batch job submission parameters"""
    # Estimate memory needs
    memory = 8192  # Default 8 GB
    if benchmark.get("domain", {}).get("resolution") in ["2x2.5", "nested"]:
        memory = 16384
    
    # Determine instance type and adjust vCPUs
    instance_type = benchmark.get("hardware", {}).get("instance_type", "c7g.8xlarge")
    vcpus = 4  # Default
    
    if "16xlarge" in instance_type:
        vcpus = 64
    elif "8xlarge" in instance_type:
        vcpus = 32
    elif "4xlarge" in instance_type:
        vcpus = 16
    
    # Generate unique run ID
    run_id = f"benchmark-{benchmark['id']}-{int(time.time())}"
    
    # Output location
    output_path = f"s3://{args.output_bucket}/benchmark-results/{benchmark['id']}/"
    
    # Benchmark configuration as JSON
    config_json = json.dumps(benchmark)
    
    # Create job parameters
    job_params = {
        "jobName": run_id,
        "jobQueue": args.job_queue,
        "jobDefinition": args.job_definition,
        "containerOverrides": {
            "vcpus": vcpus,
            "memory": memory,
            "command": [
                "--benchmark",
                "Ref::configJson",
                "--output-path",
                "Ref::outputPath"
            ],
            "environment": [
                {"name": "BENCHMARK_ID", "value": benchmark["id"]},
                {"name": "BENCHMARK_RUN_ID", "value": run_id},
                {"name": "OMP_NUM_THREADS", "value": str(vcpus)}
            ]
        },
        "parameters": {
            "configJson": config_json,
            "outputPath": output_path
        },
        "timeout": {
            "attemptDurationSeconds": int(estimate_benchmark_runtime(benchmark) * 3600)
        }
    }
    
    return job_params

def generate_parallel_cluster_job_params(benchmark, args):
    """Generate ParallelCluster job submission parameters"""
    # Output location
    output_path = f"s3://{args.output_bucket}/benchmark-results/{benchmark['id']}/"
    
    # Determine number of nodes
    nodes = benchmark.get("hardware", {}).get("nodes", 2)
    
    # Determine queue
    arch = benchmark.get("hardware", {}).get("architecture", "graviton")
    queue = f"gchp-{arch}"
    
    # Duration in days
    duration_days = benchmark.get("duration", {}).get("days", 7)
    
    # Create temporary config file for this benchmark
    config_file = f"/tmp/benchmark-{benchmark['id']}.json"
    with open(config_file, 'w') as f:
        json.dump(benchmark, f)
    
    # Create S3 path for config
    config_s3_path = f"s3://{args.output_bucket}/benchmark-configs/{benchmark['id']}.json"
    
    # Upload config to S3
    s3_client = boto3.client('s3')
    bucket = args.output_bucket
    key = f"benchmark-configs/{benchmark['id']}.json"
    
    try:
        s3_client.upload_file(config_file, bucket, key)
    except ClientError as e:
        logger.error(f"Error uploading config to S3: {e}")
        return None
    
    # Command to submit job to parallel cluster
    ssh_command = (
        f"ssh ec2-user@{args.parallel_cluster}-head "
        f"'submit-gchp -c {config_s3_path} -o {output_path} "
        f"-d {duration_days} -n {nodes} -q {queue}'"
    )
    
    return {
        "ssh_command": ssh_command,
        "config_s3_path": config_s3_path,
        "output_path": output_path,
        "duration_days": duration_days,
        "nodes": nodes,
        "queue": queue
    }

def submit_batch_job(job_params, args):
    """Submit a job to AWS Batch"""
    if args.dry_run:
        logger.info(f"DRY RUN: Would submit Batch job with parameters: {json.dumps(job_params, indent=2)}")
        return "dry-run-job-id"
    
    batch_client = boto3.client('batch')
    try:
        response = batch_client.submit_job(**job_params)
        job_id = response['jobId']
        logger.info(f"Submitted Batch job: {job_id}")
        return job_id
    except Exception as e:
        logger.error(f"Error submitting Batch job: {e}")
        return None

def submit_parallel_cluster_job(job_params, args):
    """Submit a job to ParallelCluster via SSH"""
    if args.dry_run:
        logger.info(f"DRY RUN: Would submit ParallelCluster job with command: {job_params['ssh_command']}")
        return "dry-run-job-id"
    
    try:
        import subprocess
        result = subprocess.run(job_params['ssh_command'], shell=True, check=True, 
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, 
                               text=True)
        
        # Extract job ID from output
        output = result.stdout
        import re
        match = re.search(r'Submitted batch job (\d+)', output)
        if match:
            job_id = match.group(1)
            logger.info(f"Submitted ParallelCluster job: {job_id}")
            return job_id
        else:
            logger.error(f"Could not extract job ID from output: {output}")
            return None
    except Exception as e:
        logger.error(f"Error submitting ParallelCluster job: {e}")
        return None

def wait_for_batch_jobs(job_ids, args, max_wait_minutes=120):
    """Wait for AWS Batch jobs to complete"""
    if args.dry_run or not job_ids:
        return
    
    batch_client = boto3.client('batch')
    
    pending_jobs = job_ids.copy()
    start_time = time.time()
    timeout = max_wait_minutes * 60
    
    logger.info(f"Waiting for {len(pending_jobs)} jobs to complete...")
    
    while pending_jobs and (time.time() - start_time) < timeout:
        # Check job status in batches of 100
        batch_size = 100
        for i in range(0, len(pending_jobs), batch_size):
            batch = pending_jobs[i:i+batch_size]
            response = batch_client.describe_jobs(jobs=batch)
            
            for job in response['jobs']:
                job_id = job['jobId']
                status = job['status']
                
                if status in ['SUCCEEDED', 'FAILED']:
                    logger.info(f"Job {job_id} {status}")
                    pending_jobs.remove(job_id)
                
                elif status == 'FAILED':
                    reason = job.get('statusReason', 'Unknown reason')
                    logger.error(f"Job {job_id} failed: {reason}")
                    pending_jobs.remove(job_id)
        
        # Wait before checking again
        if pending_jobs:
            logger.info(f"Waiting for {len(pending_jobs)} jobs to complete...")
            time.sleep(60)
    
    if pending_jobs:
        logger.warning(f"Timed out waiting for {len(pending_jobs)} jobs")
    else:
        logger.info("All jobs completed")

def run_benchmarks(config, args):
    """Run benchmarks according to configuration"""
    # Determine which phases to run
    phases = []
    if args.phase:
        phase_key = f"phase_{args.phase}"
        if phase_key in config:
            phases = [(args.phase, config[phase_key])]
        else:
            logger.error(f"Phase {args.phase} not found in configuration")
            return
    else:
        # Run all phases
        for i in range(1, 5):
            phase_key = f"phase_{i}"
            if phase_key in config:
                phases.append((i, config[phase_key]))
    
    # Track submitted jobs
    submitted_jobs = []
    
    # Run each phase
    for phase_num, benchmarks in phases:
        logger.info(f"Starting benchmarks for Phase {phase_num}")
        
        # Process each benchmark in the phase
        for benchmark in benchmarks:
            benchmark_id = benchmark.get("id", "unknown")
            logger.info(f"Processing benchmark {benchmark_id}")
            
            # Determine if this is a GC Classic or GCHP benchmark
            is_gchp = benchmark.get("application", "gc-classic").lower() == "gchp"
            
            if is_gchp:
                # Check if ParallelCluster is specified
                if not args.parallel_cluster:
                    logger.warning(f"Skipping GCHP benchmark {benchmark_id} - no ParallelCluster specified")
                    continue
                
                # Generate and submit ParallelCluster job
                job_params = generate_parallel_cluster_job_params(benchmark, args)
                if job_params:
                    job_id = submit_parallel_cluster_job(job_params, args)
                    if job_id:
                        submitted_jobs.append(job_id)
            else:
                # Check if job queue and definition are specified
                if not args.job_queue or not args.job_definition:
                    logger.warning(f"Skipping GC Classic benchmark {benchmark_id} - no job queue or definition specified")
                    continue
                
                # Generate and submit AWS Batch job
                job_params = generate_batch_job_params(benchmark, args)
                job_id = submit_batch_job(job_params, args)
                if job_id:
                    submitted_jobs.append(job_id)
            
            # Limit concurrent jobs
            if len(submitted_jobs) >= args.max_concurrent:
                logger.info(f"Reached maximum concurrent jobs ({args.max_concurrent}), waiting for some to complete...")
                wait_for_batch_jobs(submitted_jobs[:5], args)  # Wait for the first 5 to complete
                submitted_jobs = submitted_jobs[5:]
    
    # Wait for all remaining jobs
    if submitted_jobs and not args.dry_run:
        logger.info(f"Waiting for {len(submitted_jobs)} remaining jobs to complete...")
        wait_for_batch_jobs(submitted_jobs, args)

def main():
    """Main function"""
    args = parse_args()
    
    # Load and validate configuration
    config = load_config(args.config)
    if not validate_config(config):
        logger.error("Configuration validation failed. Exiting.")
        sys.exit(1)
    
    # Log configuration overview
    logger.info("Benchmarking Configuration Summary:")
    for i in range(1, 5):
        phase_key = f"phase_{i}"
        if phase_key in config:
            logger.info(f"Phase {i}: {len(config[phase_key])} benchmarks")
    
    if args.dry_run:
        logger.info("Running in DRY RUN mode - no jobs will be submitted")
    
    # Run benchmarks
    run_benchmarks(config, args)
    
    logger.info("Benchmarking orchestration completed")

if __name__ == "__main__":
    main()