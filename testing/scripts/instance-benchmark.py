#!/usr/bin/env python3
"""
instance-benchmark.py

Run GEOS-Chem benchmarks across multiple AWS instance types to compare performance.
This script automates the submission of benchmark jobs to AWS Batch and analyzes
the results to determine the optimal instance type for different workloads.
"""

import argparse
import boto3
import json
import yaml
import time
import datetime
import uuid
import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("instance-benchmark.log")
    ]
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="GEOS-Chem Instance Type Benchmarker")
    
    parser.add_argument("--config", "-c", default="benchmark-config.yaml",
                       help="Path to benchmark configuration YAML file")
    parser.add_argument("--output", "-o", default="benchmark-results",
                       help="Output directory for benchmark results")
    parser.add_argument("--region", "-r", default="us-east-1",
                       help="AWS region")
    parser.add_argument("--duration", "-d", type=int, default=1,
                       help="Simulation duration in days")
    parser.add_argument("--resolution", choices=["4x5", "2x2.5", "0.5x0.625", "c24", "c90", "c180"],
                       default="4x5", help="Simulation resolution")
    parser.add_argument("--sim-type", choices=["fullchem", "aerosol", "transport", "co2"],
                       default="fullchem", help="Simulation type")
    parser.add_argument("--graviton-only", action="store_true",
                       help="Only benchmark Graviton instances")
    parser.add_argument("--x86-only", action="store_true",
                       help="Only benchmark x86 instances")
    parser.add_argument("--no-wait", action="store_true",
                       help="Don't wait for jobs to complete")
    parser.add_argument("--analyze-only", action="store_true",
                       help="Only analyze existing results, don't submit new jobs")
    
    return parser.parse_args()

def load_instance_config(config_path):
    """Load instance configuration from YAML file"""
    try:
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file)
        return config
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        return None

def extract_instance_types(config, graviton_only=False, x86_only=False):
    """Extract instance types to benchmark from config"""
    instances = []
    
    # Process all phases and collect unique instance configurations
    for phase_key, phase_benchmarks in config.items():
        if not phase_key.startswith("phase_"):
            continue
            
        for benchmark in phase_benchmarks:
            # Skip if it doesn't have hardware configuration
            if "hardware" not in benchmark:
                continue
                
            hardware = benchmark["hardware"]
            
            # Skip if missing required fields
            if not all(k in hardware for k in ["instance_type", "processor_type", "architecture"]):
                continue
                
            # Filter by architecture if requested
            if graviton_only and hardware["architecture"] != "arm64":
                continue
                
            if x86_only and hardware["architecture"] != "x86_64":
                continue
                
            # Create instance configuration
            instance = {
                "instance_type": hardware["instance_type"],
                "processor_type": hardware["processor_type"],
                "architecture": hardware["architecture"],
                "vcpus": hardware.get("vcpus"),
                "memory_gb": hardware.get("memory_gb"),
                "nodes": hardware.get("nodes", 1) if "nodes" in hardware else 1,
                "description": benchmark.get("description", "")
            }
            
            # Check if we already have this instance type
            if not any(i["instance_type"] == instance["instance_type"] for i in instances):
                instances.append(instance)
    
    return instances

def submit_benchmark_jobs(instance_configs, args):
    """Submit benchmark jobs to AWS Batch"""
    batch = boto3.client('batch', region_name=args.region)
    
    # Generate a unique run ID for this benchmark
    run_id = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    
    # Prepare results directory
    os.makedirs(args.output, exist_ok=True)
    
    # Track submitted jobs
    submitted_jobs = []
    
    for idx, instance in enumerate(instance_configs):
        # Determine job definition based on architecture
        if instance["architecture"] == "arm64":
            job_definition = "geos-chem-graviton-testing"
            if instance.get("nodes", 1) > 1:
                job_definition = "geos-chem-graviton-mpi-testing"
        else:
            job_definition = "geos-chem-x86-testing"
            if instance.get("nodes", 1) > 1:
                job_definition = "geos-chem-x86-mpi-testing"
        
        # Generate a unique job name
        job_name = f"geos-chem-benchmark-{instance['instance_type']}-{run_id}-{idx}"
        
        # Determine job queue (queue should match instance architecture)
        if instance["architecture"] == "arm64":
            job_queue = "geos-chem-graviton-testing"
        else:
            job_queue = "geos-chem-x86-testing"
        
        # If instance type includes hpc, use HPC queue
        if "hpc" in instance["instance_type"]:
            if instance["architecture"] == "arm64":
                job_queue = "geos-chem-graviton-hpc-testing"
            else:
                job_queue = "geos-chem-x86-hpc-testing"
        
        # Create job parameters including benchmark configuration
        # Pass these parameters to the container
        params = {
            "runId": run_id,
            "instanceType": instance["instance_type"],
            "processorType": instance["processor_type"],
            "architecture": instance["architecture"],
            "simulationType": args.sim_type,
            "resolution": args.resolution,
            "simulationDays": str(args.duration),
            "outputPath": f"s3://geos-chem-benchmark-results/{run_id}/{instance['instance_type']}/"
        }
        
        # Add multi-node parameters if applicable
        if instance.get("nodes", 1) > 1:
            params["nodes"] = str(instance["nodes"])
        
        # Submit job to AWS Batch
        try:
            logger.info(f"Submitting benchmark job for {instance['instance_type']}")
            
            response = batch.submit_job(
                jobName=job_name,
                jobQueue=job_queue,
                jobDefinition=job_definition,
                parameters=params,
                tags={
                    "BenchmarkId": run_id,
                    "InstanceType": instance["instance_type"],
                    "ProcessorType": instance["processor_type"],
                    "Architecture": instance["architecture"],
                    "SimulationType": args.sim_type,
                    "Resolution": args.resolution
                }
            )
            
            # Save job details
            job_details = {
                "job_id": response["jobId"],
                "job_name": job_name,
                "instance_type": instance["instance_type"],
                "processor_type": instance["processor_type"],
                "architecture": instance["architecture"],
                "nodes": instance.get("nodes", 1),
                "vcpus": instance.get("vcpus"),
                "memory_gb": instance.get("memory_gb"),
                "status": "SUBMITTED",
                "simulation_type": args.sim_type,
                "resolution": args.resolution,
                "duration_days": args.duration,
                "run_id": run_id
            }
            
            submitted_jobs.append(job_details)
            logger.info(f"Submitted job {job_name} (ID: {response['jobId']})")
            
        except Exception as e:
            logger.error(f"Error submitting job for {instance['instance_type']}: {e}")
    
    # Save submitted jobs to file
    job_file = os.path.join(args.output, f"benchmark-jobs-{run_id}.json")
    with open(job_file, 'w') as f:
        json.dump(submitted_jobs, f, indent=2)
    
    logger.info(f"Submitted {len(submitted_jobs)} benchmark jobs. Details saved to {job_file}")
    
    return submitted_jobs, run_id

def monitor_jobs(jobs, args):
    """Monitor job status until all complete or fail"""
    batch = boto3.client('batch', region_name=args.region)
    
    # Create a copy of jobs for tracking status
    tracked_jobs = jobs.copy()
    
    # Track completed jobs
    completed_jobs = []
    
    # Continue until all jobs are completed or failed
    while tracked_jobs:
        # Check each job status
        for job in list(tracked_jobs):  # Use list() to allow removing items during iteration
            try:
                response = batch.describe_jobs(jobs=[job["job_id"]])
                
                if not response["jobs"]:
                    logger.warning(f"Job {job['job_id']} not found")
                    tracked_jobs.remove(job)
                    continue
                
                job_details = response["jobs"][0]
                status = job_details["status"]
                
                # Update job status
                job["status"] = status
                
                logger.info(f"Job {job['job_name']} ({job['instance_type']}) status: {status}")
                
                # If job completed or failed, move to completed list
                if status in ["SUCCEEDED", "FAILED"]:
                    # Add job end time
                    if "stoppedAt" in job_details:
                        # Convert from milliseconds to seconds
                        job["end_time"] = job_details["stoppedAt"] / 1000
                    
                    # Add job start time
                    if "startedAt" in job_details:
                        # Convert from milliseconds to seconds
                        job["start_time"] = job_details["startedAt"] / 1000
                        
                    # Calculate wall time if we have both start and end times
                    if "start_time" in job and "end_time" in job:
                        job["wall_time"] = job["end_time"] - job["start_time"]
                    
                    completed_jobs.append(job)
                    tracked_jobs.remove(job)
                    
                    logger.info(f"Job {job['job_name']} ({job['instance_type']}) completed with status {status}")
                    
                    # Save job details to file
                    if "run_id" in job:
                        run_id = job["run_id"]
                        details_file = os.path.join(args.output, f"job-details-{run_id}-{job['job_id']}.json")
                        with open(details_file, 'w') as f:
                            json.dump(job, f, indent=2)
            
            except Exception as e:
                logger.error(f"Error checking job {job['job_id']}: {e}")
        
        # If there are still jobs being tracked, wait before checking again
        if tracked_jobs:
            logger.info(f"Waiting for {len(tracked_jobs)} jobs to complete...")
            time.sleep(60)  # Check every minute
    
    logger.info(f"All jobs completed. Total: {len(completed_jobs)}")
    
    # Save all completed jobs to file
    if completed_jobs and "run_id" in completed_jobs[0]:
        run_id = completed_jobs[0]["run_id"]
        completed_file = os.path.join(args.output, f"completed-jobs-{run_id}.json")
        with open(completed_file, 'w') as f:
            json.dump(completed_jobs, f, indent=2)
        
        logger.info(f"Completed job details saved to {completed_file}")
    
    return completed_jobs

def download_benchmark_results(jobs, args):
    """Download benchmark results from S3"""
    # Create a boto3 S3 client
    s3 = boto3.client('s3', region_name=args.region)
    
    # Create results directory
    if not jobs:
        logger.error("No jobs to download results for")
        return
        
    run_id = jobs[0]["run_id"]
    results_dir = os.path.join(args.output, f"results-{run_id}")
    os.makedirs(results_dir, exist_ok=True)
    
    for job in jobs:
        instance_type = job["instance_type"]
        output_path = f"s3://geos-chem-benchmark-results/{run_id}/{instance_type}/"
        
        # Extract bucket and prefix from S3 URI
        s3_parts = output_path.replace("s3://", "").split("/", 1)
        bucket = s3_parts[0]
        prefix = s3_parts[1] if len(s3_parts) > 1 else ""
        
        # Create directory for this instance
        instance_dir = os.path.join(results_dir, instance_type)
        os.makedirs(instance_dir, exist_ok=True)
        
        logger.info(f"Downloading results for {instance_type} from {output_path}")
        
        try:
            # List objects in S3
            response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
            
            if "Contents" not in response:
                logger.warning(f"No results found for {instance_type}")
                continue
                
            # Download each result file
            for obj in response["Contents"]:
                key = obj["Key"]
                filename = os.path.basename(key)
                
                if filename:  # Skip if it's a directory
                    local_path = os.path.join(instance_dir, filename)
                    logger.info(f"Downloading {key} to {local_path}")
                    
                    s3.download_file(bucket, key, local_path)
            
            logger.info(f"Downloaded results for {instance_type}")
                
        except Exception as e:
            logger.error(f"Error downloading results for {instance_type}: {e}")
    
    logger.info(f"Downloaded all benchmark results to {results_dir}")
    return results_dir

def analyze_benchmark_results(results_dir, jobs, args):
    """Analyze benchmark results and generate report"""
    if not os.path.exists(results_dir):
        logger.error(f"Results directory not found: {results_dir}")
        return
        
    # Collect benchmark metrics from each instance
    metrics = []
    
    for job in jobs:
        instance_type = job["instance_type"]
        instance_dir = os.path.join(results_dir, instance_type)
        
        if not os.path.exists(instance_dir):
            logger.warning(f"Results directory not found for {instance_type}")
            continue
            
        # Look for benchmark results file
        results_file = os.path.join(instance_dir, "benchmark_results.json")
        if not os.path.exists(results_file):
            logger.warning(f"Results file not found for {instance_type}")
            continue
            
        # Load results file
        try:
            with open(results_file, 'r') as f:
                result_data = json.load(f)
                
            # Extract metrics
            instance_metrics = {
                "instance_type": instance_type,
                "processor_type": job["processor_type"],
                "architecture": job["architecture"],
                "nodes": job.get("nodes", 1),
                "vcpus": job.get("vcpus"),
                "memory_gb": job.get("memory_gb"),
                "simulation_type": job["simulation_type"],
                "resolution": job["resolution"],
                "duration_days": job["duration_days"],
                "job_id": job["job_id"],
                "job_status": job["status"]
            }
            
            # Add performance metrics from results
            if "performance" in result_data:
                perf = result_data["performance"]
                instance_metrics.update({
                    "wall_time_seconds": perf.get("wall_time_seconds"),
                    "compute_time_seconds": perf.get("compute_time_seconds"),
                    "throughput_days_per_day": perf.get("throughput_days_per_day"),
                    "cost_per_sim_day": perf.get("cost_per_sim_day"),
                    "memory_usage_gb": perf.get("memory_usage_gb"),
                    "cpu_efficiency": perf.get("cpu_efficiency")
                })
            
            # Add metrics from job details
            if "wall_time" in job:
                instance_metrics["job_wall_time"] = job["wall_time"]
                
            metrics.append(instance_metrics)
                
        except Exception as e:
            logger.error(f"Error analyzing results for {instance_type}: {e}")
    
    # Convert to DataFrame for analysis
    df = pd.DataFrame(metrics)
    
    # Calculate some derived metrics
    if "throughput_days_per_day" in df.columns and "cost_per_sim_day" in df.columns:
        df["cost_performance_ratio"] = df["cost_per_sim_day"] / df["throughput_days_per_day"]
    
    # Save results as CSV
    run_id = jobs[0]["run_id"] if jobs else "unknown"
    csv_file = os.path.join(args.output, f"benchmark-metrics-{run_id}.csv")
    df.to_csv(csv_file, index=False)
    
    logger.info(f"Benchmark metrics saved to {csv_file}")
    
    # Generate visualizations
    generate_visualizations(df, args.output, run_id)
    
    # Generate report
    generate_report(df, args.output, run_id, args)
    
    return df

def generate_visualizations(df, output_dir, run_id):
    """Generate visualizations from benchmark results"""
    # Create visualizations directory
    viz_dir = os.path.join(output_dir, f"visualizations-{run_id}")
    os.makedirs(viz_dir, exist_ok=True)
    
    # Set the style
    plt.style.use('seaborn-v0_8-whitegrid')
    sns.set_context("talk")
    
    # 1. Throughput Comparison by Instance Type
    if "throughput_days_per_day" in df.columns:
        plt.figure(figsize=(14, 8))
        
        if "processor_type" in df.columns:
            # Group by processor type
            ax = sns.barplot(x="instance_type", y="throughput_days_per_day", hue="processor_type", data=df)
        else:
            ax = sns.barplot(x="instance_type", y="throughput_days_per_day", data=df)
            
        ax.set_title('Simulation Throughput by Instance Type')
        ax.set_xlabel('Instance Type')
        ax.set_ylabel('Throughput (Simulation Days / Wall Day)')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'throughput_by_instance.png'), dpi=300)
        plt.close()
    
    # 2. Cost vs. Performance
    if "cost_per_sim_day" in df.columns and "throughput_days_per_day" in df.columns:
        plt.figure(figsize=(12, 8))
        
        if "processor_type" in df.columns:
            ax = sns.scatterplot(x="cost_per_sim_day", y="throughput_days_per_day", 
                              hue="processor_type", size="vcpus", data=df)
        else:
            ax = sns.scatterplot(x="cost_per_sim_day", y="throughput_days_per_day", 
                              size="vcpus", data=df)
            
        # Add labels for each point
        for i, row in df.iterrows():
            plt.text(row["cost_per_sim_day"], row["throughput_days_per_day"], 
                    row["instance_type"], fontsize=8)
            
        ax.set_title('Cost vs. Performance')
        ax.set_xlabel('Cost per Simulation Day ($)')
        ax.set_ylabel('Throughput (Simulation Days / Wall Day)')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'cost_vs_performance.png'), dpi=300)
        plt.close()
    
    # 3. CPU Efficiency by Instance Type
    if "cpu_efficiency" in df.columns:
        plt.figure(figsize=(14, 8))
        
        if "processor_type" in df.columns:
            ax = sns.barplot(x="instance_type", y="cpu_efficiency", hue="processor_type", data=df)
        else:
            ax = sns.barplot(x="instance_type", y="cpu_efficiency", data=df)
            
        ax.set_title('CPU Efficiency by Instance Type')
        ax.set_xlabel('Instance Type')
        ax.set_ylabel('CPU Efficiency (%)')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'cpu_efficiency.png'), dpi=300)
        plt.close()
    
    # 4. Wall Time Comparison
    if "wall_time_seconds" in df.columns:
        plt.figure(figsize=(14, 8))
        
        if "processor_type" in df.columns:
            ax = sns.barplot(x="instance_type", y="wall_time_seconds", hue="processor_type", data=df)
        else:
            ax = sns.barplot(x="instance_type", y="wall_time_seconds", data=df)
            
        ax.set_title('Wall Time by Instance Type')
        ax.set_xlabel('Instance Type')
        ax.set_ylabel('Wall Time (seconds)')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'wall_time.png'), dpi=300)
        plt.close()
    
    # 5. Memory Usage by Instance Type
    if "memory_usage_gb" in df.columns:
        plt.figure(figsize=(14, 8))
        
        if "processor_type" in df.columns:
            ax = sns.barplot(x="instance_type", y="memory_usage_gb", hue="processor_type", data=df)
        else:
            ax = sns.barplot(x="instance_type", y="memory_usage_gb", data=df)
            
        ax.set_title('Memory Usage by Instance Type')
        ax.set_xlabel('Instance Type')
        ax.set_ylabel('Memory Usage (GB)')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'memory_usage.png'), dpi=300)
        plt.close()
    
    logger.info(f"Visualizations generated in {viz_dir}")

def generate_report(df, output_dir, run_id, args):
    """Generate HTML report with benchmark results"""
    # Create report directory
    report_dir = os.path.join(output_dir, f"report-{run_id}")
    os.makedirs(report_dir, exist_ok=True)
    
    # Copy visualization images
    viz_dir = os.path.join(output_dir, f"visualizations-{run_id}")
    if os.path.exists(viz_dir):
        for img_file in os.listdir(viz_dir):
            if img_file.endswith('.png'):
                src = os.path.join(viz_dir, img_file)
                dst = os.path.join(report_dir, img_file)
                import shutil
                shutil.copy2(src, dst)
    
    # Calculate summary statistics
    summary = {
        "total_instances": len(df),
        "architecture_count": df["architecture"].value_counts().to_dict(),
        "processor_type_count": df["processor_type"].value_counts().to_dict() if "processor_type" in df.columns else {},
    }
    
    if "throughput_days_per_day" in df.columns:
        best_throughput = df.loc[df["throughput_days_per_day"].idxmax()]
        summary["best_throughput"] = {
            "instance": best_throughput["instance_type"],
            "processor": best_throughput.get("processor_type", "Unknown"),
            "value": best_throughput["throughput_days_per_day"]
        }
        
    if "cost_per_sim_day" in df.columns:
        best_cost = df.loc[df["cost_per_sim_day"].idxmin()]
        summary["best_cost"] = {
            "instance": best_cost["instance_type"],
            "processor": best_cost.get("processor_type", "Unknown"),
            "value": best_cost["cost_per_sim_day"]
        }
        
    if "cost_performance_ratio" in df.columns:
        best_value = df.loc[df["cost_performance_ratio"].idxmin()]
        summary["best_value"] = {
            "instance": best_value["instance_type"],
            "processor": best_value.get("processor_type", "Unknown"),
            "throughput": best_value["throughput_days_per_day"],
            "cost": best_value["cost_per_sim_day"]
        }
    
    # Build HTML content
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GEOS-Chem Instance Benchmark Report</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
            h1, h2, h3 {{ color: #2c3e50; }}
            table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
            th, td {{ text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }}
            th {{ background-color: #f2f2f2; }}
            tr:hover {{ background-color: #f5f5f5; }}
            .summary-card {{ background-color: #f8f9fa; border-radius: 5px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
            .chart-container {{ margin: 30px 0; text-align: center; }}
            .chart-container img {{ max-width: 100%; height: auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            .metric-highlight {{ font-weight: bold; color: #2980b9; }}
            footer {{ margin-top: 50px; text-align: center; font-size: 0.8em; color: #7f8c8d; }}
        </style>
    </head>
    <body>
        <h1>GEOS-Chem Instance Benchmark Report</h1>
        <p>Run ID: {run_id}</p>
        <p>Generated on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        
        <div class="summary-card">
            <h2>Benchmark Configuration</h2>
            <ul>
                <li><strong>Simulation Type:</strong> {args.sim_type}</li>
                <li><strong>Resolution:</strong> {args.resolution}</li>
                <li><strong>Duration:</strong> {args.duration} days</li>
                <li><strong>Instances Tested:</strong> {summary['total_instances']}</li>
            </ul>
        </div>
        
        <div class="summary-card">
            <h2>Summary Statistics</h2>
            <ul>
    """
    
    # Add best throughput if available
    if "best_throughput" in summary:
        html_content += f"""
                <li><strong>Best Throughput:</strong> <span class='metric-highlight'>{summary['best_throughput']['instance']}</span> 
                    ({summary['best_throughput']['processor']}) - 
                    {summary['best_throughput']['value']:.2f} sim days/day</li>
        """
    
    # Add best cost if available
    if "best_cost" in summary:
        html_content += f"""
                <li><strong>Best Cost Efficiency:</strong> <span class='metric-highlight'>{summary['best_cost']['instance']}</span> 
                    ({summary['best_cost']['processor']}) - 
                    ${summary['best_cost']['value']:.2f} per sim day</li>
        """
    
    # Add best value if available
    if "best_value" in summary:
        html_content += f"""
                <li><strong>Best Overall Value:</strong> <span class='metric-highlight'>{summary['best_value']['instance']}</span> 
                    ({summary['best_value']['processor']}) - 
                    {summary['best_value']['throughput']:.2f} sim days/day at 
                    ${summary['best_value']['cost']:.2f} per sim day</li>
        """
    
    html_content += """
            </ul>
        </div>
        
        <h2>Performance Visualizations</h2>
    """
    
    # Add visualization images
    viz_files = [
        'throughput_by_instance.png',
        'cost_vs_performance.png',
        'cpu_efficiency.png',
        'wall_time.png',
        'memory_usage.png'
    ]
    
    for viz_file in viz_files:
        if os.path.exists(os.path.join(report_dir, viz_file)):
            html_content += f"""
            <div class="chart-container">
                <h3>{' '.join(word.capitalize() for word in viz_file.replace('.png', '').split('_'))}</h3>
                <img src="{viz_file}" alt="{viz_file}">
            </div>
            """
    
    html_content += """
        <h2>Detailed Benchmark Results</h2>
        <table>
            <thead>
                <tr>
    """
    
    # Table headers - use columns that actually exist in the DataFrame
    columns_to_show = ['instance_type', 'processor_type', 'architecture', 'nodes', 'vcpus',
                      'throughput_days_per_day', 'cost_per_sim_day', 'wall_time_seconds',
                      'memory_usage_gb', 'cpu_efficiency', 'job_status']
    
    # Filter only columns that exist in the DataFrame
    columns_to_show = [col for col in columns_to_show if col in df.columns]
    
    # Add table headers
    for col in columns_to_show:
        formatted_col = ' '.join(word.capitalize() for word in col.split('_'))
        html_content += f"<th>{formatted_col}</th>\n"
    
    html_content += """
                </tr>
            </thead>
            <tbody>
    """
    
    # Add table rows
    for _, row in df.iterrows():
        html_content += "<tr>\n"
        for col in columns_to_show:
            value = row.get(col)
            if pd.isna(value):
                formatted_value = ""
            elif isinstance(value, (int, float)):
                if col in ['throughput_days_per_day', 'cost_per_sim_day']:
                    formatted_value = f"{value:.2f}"
                elif col in ['wall_time_seconds']:
                    formatted_value = f"{value:.0f}"
                elif col in ['cpu_efficiency']:
                    formatted_value = f"{value:.1f}%"
                else:
                    formatted_value = str(value)
            else:
                formatted_value = str(value)
            
            html_content += f"<td>{formatted_value}</td>\n"
        html_content += "</tr>\n"
    
    html_content += """
            </tbody>
        </table>
        
        <footer>
            <p>GEOS-Chem AWS Cloud Runner Benchmark System</p>
        </footer>
    </body>
    </html>
    """
    
    # Write HTML file
    html_path = os.path.join(report_dir, "benchmark-report.html")
    with open(html_path, 'w') as f:
        f.write(html_content)
    
    logger.info(f"Generated HTML report at {html_path}")
    return html_path

def main():
    """Main function"""
    args = parse_args()
    
    # Create output directory
    os.makedirs(args.output, exist_ok=True)
    
    # If only analyzing, skip job submission
    if args.analyze_only:
        logger.info("Analyzing existing results only")
        
        # Find most recent run
        runs = []
        for filename in os.listdir(args.output):
            if filename.startswith("completed-jobs-"):
                run_id = filename.replace("completed-jobs-", "").replace(".json", "")
                runs.append(run_id)
        
        if not runs:
            logger.error("No completed job results found")
            return
            
        # Sort runs by timestamp (assuming format YYYYMMDD-HHMMSS)
        runs.sort(reverse=True)
        latest_run = runs[0]
        
        logger.info(f"Using latest run: {latest_run}")
        
        # Load completed jobs
        completed_file = os.path.join(args.output, f"completed-jobs-{latest_run}.json")
        with open(completed_file, 'r') as f:
            completed_jobs = json.load(f)
        
        # Proceed with analysis
        results_dir = os.path.join(args.output, f"results-{latest_run}")
        if not os.path.exists(results_dir):
            results_dir = download_benchmark_results(completed_jobs, args)
        
        analyze_benchmark_results(results_dir, completed_jobs, args)
        return
    
    # Load instance configuration
    config = load_instance_config(args.config)
    if not config:
        logger.error("Failed to load configuration")
        return
    
    # Extract instance types to benchmark
    instance_configs = extract_instance_types(config, args.graviton_only, args.x86_only)
    
    if not instance_configs:
        logger.error("No instances found to benchmark")
        return
    
    logger.info(f"Found {len(instance_configs)} instances to benchmark")
    for instance in instance_configs:
        logger.info(f"  - {instance['instance_type']} ({instance['processor_type']})")
    
    # Submit benchmark jobs
    submitted_jobs, run_id = submit_benchmark_jobs(instance_configs, args)
    
    # If no-wait, exit here
    if args.no_wait:
        logger.info("Jobs submitted - exiting without waiting for completion")
        return
    
    # Monitor jobs
    completed_jobs = monitor_jobs(submitted_jobs, args)
    
    # Download and analyze results
    results_dir = download_benchmark_results(completed_jobs, args)
    analyze_benchmark_results(results_dir, completed_jobs, args)
    
    logger.info("Benchmark completed successfully")

if __name__ == "__main__":
    main()