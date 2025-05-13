import json
import boto3
import re
import os
import logging
from datetime import datetime, timedelta

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

def list_files_in_prefix(bucket, prefix):
    """List all files in a given S3 prefix"""
    try:
        files = []
        paginator = s3.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
        
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    files.append({
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat()
                    })
        
        return files
    except Exception as e:
        logger.error(f"Error listing files in prefix: {e}")
        return []

def get_simulation_metadata(user_id, simulation_id):
    """Get simulation metadata from DynamoDB"""
    try:
        table_name = os.environ.get('SIMULATIONS_TABLE')
        if not table_name:
            logger.warning("SIMULATIONS_TABLE environment variable not set")
            return {}
        
        table = dynamodb.Table(table_name)
        response = table.get_item(
            Key={
                'userId': user_id,
                'simulationId': simulation_id
            }
        )
        
        if 'Item' in response:
            return response['Item']
        else:
            logger.warning(f"No metadata found for simulation {simulation_id}")
            return {}
    except Exception as e:
        logger.error(f"Error getting simulation metadata: {e}")
        return {}

def parse_simulation_log(bucket, log_file_key):
    """Parse a simulation log file for key metrics"""
    try:
        response = s3.get_object(Bucket=bucket, Key=log_file_key)
        log_content = response['Body'].read().decode('utf-8')
        
        metrics = {
            'wall_time': None,
            'start_time': None,
            'end_time': None,
            'simulation_days': None
        }
        
        # Find simulation wall time
        wall_time_match = re.search(r'Elapsed wall time for simulation: ([0-9.]+) hours', log_content)
        if wall_time_match:
            metrics['wall_time'] = float(wall_time_match.group(1))
        
        # Find start time
        start_time_match = re.search(r'Starting GEOS-Chem simulation at: ([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})', log_content)
        if start_time_match:
            metrics['start_time'] = start_time_match.group(1)
        
        # Find end time
        end_time_match = re.search(r'GEOS-Chem simulation completed at: ([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})', log_content)
        if end_time_match:
            metrics['end_time'] = end_time_match.group(1)
        
        # Find simulation days
        days_match = re.search(r'Number of simulation days: ([0-9.]+)', log_content)
        if days_match:
            metrics['simulation_days'] = float(days_match.group(1))
        
        # Calculate throughput if possible
        if metrics['wall_time'] is not None and metrics['simulation_days'] is not None:
            metrics['throughput_days_per_day'] = metrics['simulation_days'] / metrics['wall_time'] * 24
        
        return metrics
    except Exception as e:
        logger.error(f"Error parsing simulation log: {e}")
        return {}

def analyze_output_files(files):
    """Analyze output files to determine available datasets and variables"""
    output_analysis = {
        'total_files': 0,
        'total_size_bytes': 0,
        'file_types': {},
        'netcdf_files': [],
        'log_files': [],
        'restart_files': []
    }
    
    for file in files:
        # Count total files and sizes
        output_analysis['total_files'] += 1
        output_analysis['total_size_bytes'] += file['size']
        
        # Determine file type from extension
        key = file['key']
        _, ext = os.path.splitext(key)
        ext = ext.lower()
        
        if ext not in output_analysis['file_types']:
            output_analysis['file_types'][ext] = 0
        output_analysis['file_types'][ext] += 1
        
        # Categorize files
        if ext in ['.nc', '.nc4']:
            output_analysis['netcdf_files'].append(file)
        elif ext == '.log':
            output_analysis['log_files'].append(file)
        
        # Check for restart files
        if 'restart' in key.lower() or 'Restarts' in key:
            output_analysis['restart_files'].append(file)
    
    # Convert total size to human-readable format
    size_bytes = output_analysis['total_size_bytes']
    if size_bytes > 1e9:
        output_analysis['total_size_human'] = f"{size_bytes/1e9:.2f} GB"
    elif size_bytes > 1e6:
        output_analysis['total_size_human'] = f"{size_bytes/1e6:.2f} MB"
    elif size_bytes > 1e3:
        output_analysis['total_size_human'] = f"{size_bytes/1e3:.2f} KB"
    else:
        output_analysis['total_size_human'] = f"{size_bytes} bytes"
    
    return output_analysis

def estimate_cost(metadata, metrics):
    """Estimate the cost of the simulation based on metadata and metrics"""
    try:
        cost_estimate = {
            'total_cost': None,
            'compute_cost': None,
            'storage_cost': None,
            'data_transfer_cost': None,
            'cost_per_day': None
        }
        
        # Check if metadata contains instance type and compute type
        instance_type = metadata.get('instanceType')
        compute_type = metadata.get('computeType', 'ON_DEMAND')
        
        if not instance_type:
            return cost_estimate
        
        # Hourly rates for different instance types (simplified for this example)
        hourly_rates = {
            'c7g.16xlarge': 2.4480,
            'c7g.8xlarge': 1.2240,
            'c6i.16xlarge': 2.7200,
            'c6i.8xlarge': 1.3600,
            'c6a.16xlarge': 2.4480,
            'c6a.8xlarge': 1.2240,
            'r7g.16xlarge': 3.0720,
            'r7g.8xlarge': 1.5360,
            'hpc7g.16xlarge': 3.2640,
            'm7g.16xlarge': 2.7136,
            'm7g.8xlarge': 1.3568,
        }
        
        # Apply discount for Spot instances
        if compute_type == 'SPOT':
            for instance in hourly_rates:
                hourly_rates[instance] *= 0.3  # 70% discount for Spot
        
        # Get hourly rate for the instance
        hourly_rate = hourly_rates.get(instance_type)
        if not hourly_rate:
            return cost_estimate
        
        # Calculate compute cost if we have wall time
        if 'wall_time' in metrics and metrics['wall_time'] is not None:
            wall_time_hours = metrics['wall_time']
            compute_cost = hourly_rate * wall_time_hours
            cost_estimate['compute_cost'] = compute_cost
            
            # Estimate storage cost (simplified)
            total_size_gb = (metrics.get('total_size_bytes', 0) or 0) / 1e9
            storage_cost = total_size_gb * 0.023  # $0.023 per GB per month
            cost_estimate['storage_cost'] = storage_cost
            
            # Estimate data transfer cost (simplified)
            data_transfer_cost = total_size_gb * 0.09  # $0.09 per GB
            cost_estimate['data_transfer_cost'] = data_transfer_cost
            
            # Calculate total cost
            total_cost = compute_cost + storage_cost + data_transfer_cost
            cost_estimate['total_cost'] = total_cost
            
            # Calculate cost per simulation day
            if 'simulation_days' in metrics and metrics['simulation_days'] is not None:
                cost_per_day = total_cost / metrics['simulation_days']
                cost_estimate['cost_per_day'] = cost_per_day
        
        return cost_estimate
    except Exception as e:
        logger.error(f"Error estimating cost: {e}")
        return {}

def handler(event, context):
    """Lambda handler for generating simulation result summaries"""
    try:
        # Get parameters from the event
        bucket = event['bucket']
        prefix = event['prefix']
        user_id = event.get('userId')
        simulation_id = event.get('simulationId')
        
        # List all files in the prefix
        logger.info(f"Listing files in s3://{bucket}/{prefix}")
        files = list_files_in_prefix(bucket, prefix)
        
        # Get simulation metadata if user_id and simulation_id provided
        metadata = {}
        if user_id and simulation_id:
            metadata = get_simulation_metadata(user_id, simulation_id)
        
        # Analyze output files
        output_analysis = analyze_output_files(files)
        
        # Parse log file if available
        metrics = {}
        if output_analysis['log_files']:
            # Use the newest log file
            log_files = sorted(output_analysis['log_files'], key=lambda x: x['last_modified'], reverse=True)
            log_file = log_files[0]
            logger.info(f"Parsing log file: {log_file['key']}")
            metrics = parse_simulation_log(bucket, log_file['key'])
        
        # Add output analysis metrics to metrics dict
        metrics.update({
            'total_files': output_analysis['total_files'],
            'total_size_bytes': output_analysis['total_size_bytes'],
            'total_size_human': output_analysis['total_size_human'],
            'netcdf_file_count': len(output_analysis['netcdf_files']),
            'restart_file_count': len(output_analysis['restart_files'])
        })
        
        # Estimate cost
        cost_estimate = estimate_cost(metadata, metrics)
        
        # Create summary
        summary = {
            'simulationId': simulation_id,
            'userId': user_id,
            'bucket': bucket,
            'prefix': prefix,
            'generatedAt': datetime.now().isoformat(),
            'metadata': metadata,
            'metrics': metrics,
            'outputAnalysis': output_analysis,
            'costEstimate': cost_estimate,
            'availableVisualizations': [
                {
                    'type': 'global_map',
                    'description': 'Global distribution map of species concentrations'
                },
                {
                    'type': 'zonal_mean',
                    'description': 'Zonal mean vertical profiles'
                },
                {
                    'type': 'time_series',
                    'description': 'Time series of global mean concentrations'
                }
            ]
        }
        
        # Add list of NetCDF files that can be visualized
        visualization_files = []
        for file in output_analysis['netcdf_files']:
            viz_file = {
                'key': file['key'],
                'filename': file['key'].split('/')[-1],
                'size': file['size'],
                'last_modified': file['last_modified']
            }
            visualization_files.append(viz_file)
        
        summary['visualizationFiles'] = visualization_files
        
        # Save summary to S3
        summary_key = f"{prefix.rstrip('/')}/summary.json"
        s3.put_object(
            Bucket=bucket,
            Key=summary_key,
            Body=json.dumps(summary, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Summary generated successfully',
                'bucket': bucket,
                'summaryKey': summary_key,
                'summary': summary
            })
        }
    
    except Exception as e:
        logger.error(f"Error generating summary: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': f"Error generating summary: {str(e)}"
            })
        }