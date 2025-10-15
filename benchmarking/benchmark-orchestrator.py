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

    # Use the AWS_REGION environment variable or default to us-west-2
    region = os.environ.get('AWS_REGION', 'us-west-2')
    logger.info(f"Using AWS region: {region}")

    batch_client = boto3.client('batch', region_name=region)
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

def wait_for_batch_jobs(jobs, args, max_wait_minutes=120):
    """Wait for AWS Batch jobs to complete"""
    if args.dry_run or not jobs:
        return

    # Use the AWS_REGION environment variable or default to us-west-2
    region = os.environ.get('AWS_REGION', 'us-west-2')
    logger.info(f"Using AWS region: {region}")

    batch_client = boto3.client('batch', region_name=region)

    pending_jobs = jobs.copy()
    start_time = time.time()
    timeout = max_wait_minutes * 60

    logger.info(f"Waiting for {len(pending_jobs)} jobs to complete...")

    while pending_jobs and (time.time() - start_time) < timeout:
        # Process batch jobs through AWS Batch API
        batch_job_ids = [job["job_id"] for job in pending_jobs if job["type"] == "batch"]

        if batch_job_ids:
            # Check job status in batches of 100
            batch_size = 100
            for i in range(0, len(batch_job_ids), batch_size):
                batch_ids = batch_job_ids[i:i+batch_size]
                try:
                    response = batch_client.describe_jobs(jobs=batch_ids)

                    for job_details in response['jobs']:
                        job_id = job_details['jobId']
                        status = job_details['status']

                        # Find the corresponding job in our pending_jobs list
                        for job in list(pending_jobs):
                            if job["job_id"] == job_id:
                                if status in ['SUCCEEDED', 'FAILED']:
                                    benchmark_id = job["benchmark_id"]
                                    logger.info(f"Job {job_id} for benchmark {benchmark_id} {status}")

                                    if status == 'FAILED':
                                        reason = job_details.get('statusReason', 'Unknown reason')
                                        logger.error(f"Job {job_id} failed: {reason}")

                                    pending_jobs.remove(job)
                                break
                except Exception as e:
                    logger.error(f"Error checking batch job status: {e}")

        # Process ParallelCluster jobs - we can't easily query their status
        # Just log that we're waiting for them, but keep them in the pending list
        parallel_cluster_jobs = [job for job in pending_jobs if job["type"] == "parallel_cluster"]
        if parallel_cluster_jobs:
            logger.info(f"Waiting for {len(parallel_cluster_jobs)} ParallelCluster jobs (status not available)")

            # If all remaining jobs are ParallelCluster jobs and we have a long timeout,
            # we might want to check their status through SSH
            # This would require implementing a function like check_parallel_cluster_job_status

        # Wait before checking again
        if pending_jobs:
            logger.info(f"Waiting for {len(pending_jobs)} jobs to complete...")
            time.sleep(60)

    if pending_jobs:
        logger.warning(f"Timed out waiting for {len(pending_jobs)} jobs")
        # List the job IDs and types that timed out
        for job in pending_jobs:
            logger.warning(f"Job {job['job_id']} ({job['type']}) for benchmark {job['benchmark_id']} timed out")
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
            return []
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
                        job_info = {
                            "job_id": job_id,
                            "benchmark_id": benchmark_id,
                            "type": "parallel_cluster",
                            "phase": phase_num,
                            "submission_time": datetime.datetime.now().isoformat(),
                            "benchmark": benchmark  # Include the full benchmark config
                        }
                        submitted_jobs.append(job_info)
            else:
                # Check if job queue and definition are specified
                if not args.job_queue or not args.job_definition:
                    logger.warning(f"Skipping GC Classic benchmark {benchmark_id} - no job queue or definition specified")
                    continue

                # Generate and submit AWS Batch job
                job_params = generate_batch_job_params(benchmark, args)
                job_id = submit_batch_job(job_params, args)
                if job_id:
                    job_info = {
                        "job_id": job_id,
                        "benchmark_id": benchmark_id,
                        "type": "batch",
                        "phase": phase_num,
                        "submission_time": datetime.datetime.now().isoformat(),
                        "benchmark": benchmark  # Include the full benchmark config
                    }
                    submitted_jobs.append(job_info)
            
            # Limit concurrent jobs
            if len(submitted_jobs) >= args.max_concurrent:
                logger.info(f"Reached maximum concurrent jobs ({args.max_concurrent}), waiting for some to complete...")
                # Wait for a subset of jobs to complete
                subset_to_wait = submitted_jobs[:min(5, len(submitted_jobs))]
                wait_for_batch_jobs(subset_to_wait, args)  # Wait for the first few to complete
                # Remove completed jobs from our tracking list
                for job in subset_to_wait:
                    if job in submitted_jobs:
                        submitted_jobs.remove(job)
    
    # Wait for all remaining jobs
    if submitted_jobs and not args.dry_run:
        logger.info(f"Waiting for {len(submitted_jobs)} remaining jobs to complete...")
        wait_for_batch_jobs(submitted_jobs, args)

    return submitted_jobs

def save_benchmark_metadata(submitted_jobs, args):
    """Save metadata about submitted benchmark jobs"""
    if not submitted_jobs:
        return

    # Generate a unique run ID based on timestamp
    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    metadata_file = f"benchmark-jobs-{timestamp}.json"

    # Prepare metadata including job information and submission details
    metadata = {
        "benchmark_run_id": timestamp,
        "submission_time": datetime.datetime.now().isoformat(),
        "submitted_by": os.getenv("USER", "unknown"),
        "dry_run": args.dry_run,
        "jobs": submitted_jobs,
        # Include configuration options used
        "configuration": {
            "config_file": args.config,
            "output_bucket": args.output_bucket,
            "job_queue": args.job_queue if hasattr(args, "job_queue") else None,
            "job_definition": args.job_definition if hasattr(args, "job_definition") else None,
            "parallel_cluster": args.parallel_cluster if hasattr(args, "parallel_cluster") else None,
            "phase": args.phase if hasattr(args, "phase") else None,
        }
    }

    # Save metadata to file
    try:
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        logger.info(f"Saved benchmark job metadata to {metadata_file}")

        # If we have an output bucket, also save there
        if args.output_bucket and not args.dry_run:
            try:
                # Use the AWS_REGION environment variable or default to us-west-2
                region = os.environ.get('AWS_REGION', 'us-west-2')
                logger.info(f"Using AWS region for S3: {region}")

                s3_client = boto3.client('s3', region_name=region)
                s3_key = f"benchmark-metadata/{metadata_file}"
                s3_client.put_object(
                    Bucket=args.output_bucket,
                    Key=s3_key,
                    Body=json.dumps(metadata, indent=2)
                )
                logger.info(f"Uploaded benchmark job metadata to s3://{args.output_bucket}/{s3_key}")
            except Exception as e:
                logger.error(f"Error uploading metadata to S3: {e}")

        return metadata_file
    except Exception as e:
        logger.error(f"Error saving benchmark job metadata: {e}")
        return None

def main():
    """Main function"""
    args = parse_args()

    try:
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

        # Verify required parameters
        if not args.output_bucket:
            logger.error("Output bucket is required")
            sys.exit(1)

        # Run benchmarks and track submitted jobs
        all_submitted_jobs = []

        # Run the benchmarks and collect job info
        all_submitted_jobs = run_benchmarks(config, args)

        # Save metadata about the benchmark run
        save_benchmark_metadata(all_submitted_jobs, args)

        logger.info("Benchmarking orchestration completed successfully")

    except KeyboardInterrupt:
        logger.warning("Benchmark orchestration interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Benchmark orchestration failed with error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()