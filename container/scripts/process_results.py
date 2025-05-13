#!/usr/bin/env python3
# process_results.py - Process and upload GEOS-Chem results

import argparse
import os
import json
import subprocess
import glob
import boto3
from datetime import datetime

def parse_args():
    parser = argparse.ArgumentParser(description="Process and upload GEOS-Chem results")
    parser.add_argument("--output-path", required=True, help="S3 path for results")
    parser.add_argument("--run-dir", default="/opt/geos-chem/rundir", help="GEOS-Chem run directory")
    return parser.parse_args()

def collect_diagnostics(run_dir):
    """Collect diagnostic files and metadata"""
    diagnostics = {
        "output_files": [],
        "log_files": [],
        "config_files": [],
        "restart_files": []
    }
    
    # Output NetCDF files
    for file in glob.glob(f"{run_dir}/OutputDir/*.nc*"):
        diagnostics["output_files"].append(file)
    
    # Log files
    for file in glob.glob(f"{run_dir}/*.log"):
        diagnostics["log_files"].append(file)
    
    # Configuration files
    for file in glob.glob(f"{run_dir}/*.yml") + glob.glob(f"{run_dir}/*.rc"):
        diagnostics["config_files"].append(file)
    
    # Restart files
    for file in glob.glob(f"{run_dir}/Restarts/*.nc*"):
        diagnostics["restart_files"].append(file)
    
    return diagnostics

def create_manifest(run_dir, diagnostics, output_path):
    """Create a manifest file with metadata about the run"""
    # Load run summary if it exists
    summary_file = f"{run_dir}/run_summary.json"
    summary = {}
    if os.path.exists(summary_file):
        with open(summary_file, 'r') as f:
            summary = json.load(f)
    
    # Create manifest
    manifest = {
        "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "run_summary": summary,
        "output_files": [os.path.basename(f) for f in diagnostics["output_files"]],
        "log_files": [os.path.basename(f) for f in diagnostics["log_files"]],
        "config_files": [os.path.basename(f) for f in diagnostics["config_files"]],
        "restart_files": [os.path.basename(f) for f in diagnostics["restart_files"]],
        "output_location": output_path
    }
    
    # Write manifest locally
    manifest_file = f"{run_dir}/manifest.json"
    with open(manifest_file, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    return manifest_file

def upload_results(diagnostics, manifest_file, output_path):
    """Upload results to S3"""
    # Parse bucket and prefix
    if output_path.startswith('s3://'):
        path_parts = output_path[5:].split('/', 1)
        bucket = path_parts[0]
        prefix = path_parts[1] if len(path_parts) > 1 else ""
    else:
        print(f"Invalid S3 path: {output_path}")
        return
    
    s3 = boto3.client('s3')
    
    # Upload manifest
    manifest_key = f"{prefix}/manifest.json"
    print(f"Uploading manifest to s3://{bucket}/{manifest_key}")
    s3.upload_file(manifest_file, bucket, manifest_key)
    
    # Upload output files
    for file_type in diagnostics:
        for file in diagnostics[file_type]:
            file_name = os.path.basename(file)
            key = f"{prefix}/{file_type}/{file_name}"
            print(f"Uploading {file} to s3://{bucket}/{key}")
            s3.upload_file(file, bucket, key)
    
    print(f"All results uploaded to s3://{bucket}/{prefix}/")

def main():
    args = parse_args()
    diagnostics = collect_diagnostics(args.run_dir)
    manifest_file = create_manifest(args.run_dir, diagnostics, args.output_path)
    upload_results(diagnostics, manifest_file, args.output_path)
    print("Results processing and upload complete")

if __name__ == "__main__":
    main()