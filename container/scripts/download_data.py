#!/usr/bin/env python3
# download_data.py - Download required input data for GEOS-Chem

import argparse
import os
import subprocess
import sys
import yaml
import boto3
from datetime import datetime, timedelta

def parse_args():
    parser = argparse.ArgumentParser(description="Download GEOS-Chem input data")
    parser.add_argument("--input-path", required=True, help="S3 path to input data")
    parser.add_argument("--data-dir", default="/data", help="Local directory for data")
    parser.add_argument("--config-file", default="/opt/geos-chem/rundir/geoschem_config.yml", 
                        help="GEOS-Chem configuration file")
    return parser.parse_args()

def read_config(config_file):
    with open(config_file, 'r') as f:
        config = yaml.safe_load(f)
    return config

def get_required_data_paths(config, input_path):
    """Determine what data needs to be downloaded based on configuration"""
    data_paths = []
    
    # Get simulation date range
    start_date = datetime.strptime(config['simulation']['start_date'], "%Y%m%d")
    end_date = datetime.strptime(config['simulation']['end_date'], "%Y%m%d")
    
    # Get met data type (GEOS-FP or MERRA2)
    met_type = config['simulation']['met_field'] if 'met_field' in config['simulation'] else "GEOS_FP"
    
    # Get resolution
    resolution = config['simulation']['resolution'] if 'simulation' in config and 'resolution' in config['simulation'] else "4x5"
    
    # Calculate months needed
    current_date = start_date
    while current_date <= end_date:
        year_month = current_date.strftime("%Y/%m")
        data_path = f"{input_path}/{year_month}/"
        data_paths.append(data_path)
        
        # Move to next month
        next_month = current_date.month + 1
        next_year = current_date.year
        if next_month > 12:
            next_month = 1
            next_year += 1
        current_date = datetime(next_year, next_month, 1)
    
    return data_paths

def download_data(data_paths, data_dir):
    """Download required data from S3"""
    s3 = boto3.client('s3')
    
    for data_path in data_paths:
        # Parse bucket and key from S3 path
        if data_path.startswith('s3://'):
            path_parts = data_path[5:].split('/', 1)
            bucket = path_parts[0]
            prefix = path_parts[1] if len(path_parts) > 1 else ""
        else:
            print(f"Invalid S3 path: {data_path}")
            continue
        
        # Create local directory structure
        local_dir = os.path.join(data_dir, prefix)
        os.makedirs(local_dir, exist_ok=True)
        
        print(f"Downloading data from s3://{bucket}/{prefix} to {local_dir}")
        
        # Use AWS CLI for efficient recursive download
        cmd = [
            "aws", "s3", "cp", 
            f"s3://{bucket}/{prefix}", 
            local_dir,
            "--recursive"
        ]
        
        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            print(f"Error downloading data: {e}")
            sys.exit(1)

def update_config_paths(config, data_dir):
    """Update configuration file with local data paths"""
    # Update ExtData path
    if 'paths' in config:
        config['paths']['ExtData'] = data_dir
    
    # Write updated config
    with open('/opt/geos-chem/rundir/geoschem_config.yml', 'w') as f:
        yaml.dump(config, f, default_flow_style=False)

def main():
    args = parse_args()
    config = read_config(args.config_file)
    data_paths = get_required_data_paths(config, args.input_path)
    download_data(data_paths, args.data_dir)
    update_config_paths(config, args.data_dir)
    print("Data download complete")

if __name__ == "__main__":
    main()