#!/usr/bin/env python3
"""
generate-gchp-config.py

Script to generate GCHP configuration files for ParallelCluster execution.
"""

import argparse
import yaml
import os
import sys
import datetime
import uuid
import boto3
import json

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Generate GCHP configuration files")
    
    parser.add_argument("--output-path", "-o", required=True,
                        help="S3 path to store the configuration file")
    parser.add_argument("--simulation-type", "-t", default="fullchem",
                        choices=["fullchem", "aerosol", "transport", "ch4", "co2"],
                        help="Type of simulation")
    parser.add_argument("--resolution", "-r", default="c24",
                        choices=["c24", "c48", "c90", "c180", "c360"],
                        help="Cubed-sphere resolution")
    parser.add_argument("--duration-days", "-d", type=int, default=7,
                        help="Simulation duration in days")
    parser.add_argument("--start-date", "-s", default=None,
                        help="Start date in YYYY-MM-DD format (default: current date)")
    parser.add_argument("--nodes", "-n", type=int, default=2,
                        help="Number of compute nodes (1-8)")
    parser.add_argument("--architecture", "-a", default="graviton",
                        choices=["graviton", "x86"],
                        help="Processor architecture")
    parser.add_argument("--description", "--desc", default="",
                        help="Optional description of the simulation")
    
    return parser.parse_args()

def validate_args(args):
    """Validate command line arguments"""
    # Validate S3 path
    if not args.output_path.startswith("s3://"):
        sys.exit("Error: output-path must be an S3 URL (s3://...)")
    
    # Validate date format
    if args.start_date:
        try:
            datetime.datetime.strptime(args.start_date, "%Y-%m-%d")
        except ValueError:
            sys.exit("Error: start-date must be in YYYY-MM-DD format")
    
    # Validate nodes
    if args.nodes < 1 or args.nodes > 8:
        sys.exit("Error: nodes must be between 1 and 8")

def get_nz_levels(resolution):
    """Get number of vertical levels based on resolution"""
    if resolution in ["c180", "c360"]:
        return 72  # High resolution uses 72 levels
    return 47  # Default for lower resolutions

def get_stretched_grid_params(resolution):
    """Get stretched grid parameters based on resolution"""
    return {
        "target_lat": 0.0,
        "target_lon": 0.0,
        "stretch_factor": 1.0  # 1.0 means no stretching
    }

def get_processor_layout(resolution, nodes):
    """
    Get processor layout based on resolution and number of nodes
    Returns (IM_WORLD, JM_WORLD) - number of processes in X and Y directions
    """
    # Mapping of resolution to cubed-sphere size
    cs_sizes = {
        "c24": 24,
        "c48": 48,
        "c90": 90,
        "c180": 180,
        "c360": 360
    }
    
    # Total number of cores (64 cores per node)
    total_cores = nodes * 64
    
    # For GCHP, 6 faces of the cube
    cores_per_face = total_cores // 6
    
    # Calculate layout - keep X*Y close to cores_per_face
    # The product of IM_WORLD and JM_WORLD should equal cores_per_face
    # Try to keep them as close as possible for load balancing
    import math
    side_length = cs_sizes[resolution]
    
    # Find factors of cores_per_face
    factors = []
    for i in range(1, int(math.sqrt(cores_per_face)) + 1):
        if cores_per_face % i == 0:
            factors.append((i, cores_per_face // i))
    
    # Find the pair of factors that divides the side length evenly
    for x, y in factors:
        if side_length % x == 0 and side_length % y == 0:
            return x, y
    
    # If no perfect factors, use the last pair
    if factors:
        return factors[-1]
    
    # Fallback
    return 1, cores_per_face

def create_gchp_config(args):
    """Create GCHP configuration file"""
    # Set start date
    start_date = args.start_date
    if not start_date:
        # Default to current date
        start_date = datetime.datetime.now().strftime("%Y-%m-%d")
    
    # Parse start date
    start_datetime = datetime.datetime.strptime(start_date, "%Y-%m-%d")
    
    # Calculate end date
    end_datetime = start_datetime + datetime.timedelta(days=args.duration_days)
    end_date = end_datetime.strftime("%Y-%m-%d")
    
    # Get processor layout
    im_world, jm_world = get_processor_layout(args.resolution, args.nodes)
    
    # Create configuration
    config = {
        "simulation": {
            "id": str(uuid.uuid4()),
            "type": args.simulation_type,
            "created_at": datetime.datetime.now().isoformat(),
            "description": args.description or f"GCHP {args.simulation_type} simulation at {args.resolution} resolution",
            "duration_days": args.duration_days,
            "start_date": start_date,
            "end_date": end_date
        },
        "resource": {
            "nodes": args.nodes,
            "architecture": args.architecture,
            "queue": f"gchp-{args.architecture}"
        },
        "grid": {
            "resolution": args.resolution,
            "nz": get_nz_levels(args.resolution),
            "stretched_grid": get_stretched_grid_params(args.resolution)
        },
        "compute": {
            "im_world": im_world,
            "jm_world": jm_world,
            "layout_is_optimal": True,
            "cores_per_node": 64,
            "total_cores": args.nodes * 64
        },
        "chemistry": {
            "mechanism": args.simulation_type,
            "hemco_config": "standard",
            "diagnostics": ["SpeciesConc", "AerosolMass"]
        },
        "output": {
            "frequency": "3H",  # Output every 3 hours
            "format": "netcdf4",
            "compression": True
        }
    }
    
    return config

def upload_to_s3(config, output_path):
    """Upload configuration to S3"""
    # Parse S3 URL
    if not output_path.startswith("s3://"):
        raise ValueError("S3 path must start with s3://")
    
    parts = output_path[5:].split('/', 1)
    bucket = parts[0]
    key = parts[1] if len(parts) > 1 else ""
    
    # Make sure key ends with .yml or .json
    if not (key.endswith('.yml') or key.endswith('.yaml') or key.endswith('.json')):
        key = key.rstrip('/') + '/gchp-config.yml'
    
    # Configure S3 client
    s3_client = boto3.client('s3')
    
    # Convert config to YAML
    config_str = yaml.dump(config, default_flow_style=False)
    
    # Upload to S3
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=config_str,
        ContentType='application/yaml'
    )
    
    return f"s3://{bucket}/{key}"

def main():
    """Main function"""
    args = parse_args()
    validate_args(args)
    
    config = create_gchp_config(args)
    output_url = upload_to_s3(config, args.output_path)
    
    print(f"GCHP configuration generated and uploaded to {output_url}")
    print(f"Summary:")
    print(f"  - Simulation type: {args.simulation_type}")
    print(f"  - Resolution: {args.resolution}")
    print(f"  - Duration: {args.duration_days} days")
    print(f"  - Nodes: {args.nodes}")
    print(f"  - Architecture: {args.architecture}")
    
    # Print command to submit the job
    print("\nTo submit this job to the GCHP cluster, run:")
    print(f"submit-gchp -c {output_url} -o [output_path] -d {args.duration_days} -n {args.nodes} -q gchp-{args.architecture}")

if __name__ == "__main__":
    main()