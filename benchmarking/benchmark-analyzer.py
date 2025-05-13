#!/usr/bin/env python3
"""
benchmark-analyzer.py

Analyzes GEOS-Chem benchmark results and generates performance reports and visualizations.
"""

import argparse
import yaml
import os
import sys
import datetime
import json
import boto3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib as mpl
import seaborn as sns
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("benchmark-analysis.log")
    ]
)
logger = logging.getLogger(__name__)

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="GEOS-Chem Benchmark Analyzer")
    
    parser.add_argument("--results-bucket", "-b", required=True,
                        help="S3 bucket containing benchmark results")
    parser.add_argument("--output-dir", "-o", default="./benchmark-reports",
                        help="Local directory for benchmark reports")
    parser.add_argument("--config", "-c",
                        help="Path to original benchmark configuration YAML file")
    parser.add_argument("--run-id", "-r",
                        help="Specific benchmark run ID to analyze")
    parser.add_argument("--phase", "-p", type=int, choices=[1, 2, 3, 4],
                        help="Only analyze a specific benchmark phase")
    parser.add_argument("--format", "-f", choices=["html", "pdf", "json", "all"],
                        default="all", help="Output report format")
    
    return parser.parse_args()

def load_benchmark_config(config_path):
    """Load benchmarking configuration from YAML file"""
    try:
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file)
        return config
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        return None

def list_benchmark_results(bucket, prefix="benchmark-results/"):
    """List benchmark results in S3 bucket"""
    s3_client = boto3.client('s3')
    results = []
    
    try:
        # List all benchmark folders
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket, Prefix=prefix, Delimiter='/')
        
        for page in pages:
            if 'CommonPrefixes' in page:
                for obj in page['CommonPrefixes']:
                    benchmark_prefix = obj['Prefix']
                    # Extract benchmark ID from prefix
                    benchmark_id = benchmark_prefix.strip('/').split('/')[-1]
                    
                    # Look for manifest.json in this prefix
                    manifest_key = f"{benchmark_prefix}manifest.json"
                    try:
                        manifest = s3_client.get_object(Bucket=bucket, Key=manifest_key)
                        manifest_data = json.loads(manifest['Body'].read().decode('utf-8'))
                        
                        results.append({
                            'benchmark_id': benchmark_id,
                            'prefix': benchmark_prefix,
                            'manifest': manifest_data
                        })
                    except s3_client.exceptions.NoSuchKey:
                        # Try results.json as an alternative
                        try:
                            results_key = f"{benchmark_prefix}results.json"
                            results_obj = s3_client.get_object(Bucket=bucket, Key=results_key)
                            results_data = json.loads(results_obj['Body'].read().decode('utf-8'))
                            
                            results.append({
                                'benchmark_id': benchmark_id,
                                'prefix': benchmark_prefix,
                                'results': results_data
                            })
                        except s3_client.exceptions.NoSuchKey:
                            logger.warning(f"No manifest or results found for {benchmark_prefix}")
        
        return results
    except Exception as e:
        logger.error(f"Error listing benchmark results: {e}")
        return []

def download_benchmark_results(bucket, benchmark_results, local_dir):
    """Download benchmark results from S3"""
    s3_client = boto3.client('s3')
    
    # Create local directory
    os.makedirs(local_dir, exist_ok=True)
    
    for benchmark in benchmark_results:
        benchmark_id = benchmark['benchmark_id']
        prefix = benchmark['prefix']
        
        # Create benchmark directory
        benchmark_dir = os.path.join(local_dir, benchmark_id)
        os.makedirs(benchmark_dir, exist_ok=True)
        
        # Download all files for this benchmark
        try:
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
            
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        key = obj['Key']
                        filename = os.path.basename(key)
                        if filename:  # Skip directories
                            local_path = os.path.join(benchmark_dir, filename)
                            logger.info(f"Downloading {key} to {local_path}")
                            s3_client.download_file(bucket, key, local_path)
        except Exception as e:
            logger.error(f"Error downloading files for {benchmark_id}: {e}")
    
    logger.info(f"Downloaded benchmark results to {local_dir}")
    return local_dir

def extract_performance_metrics(benchmark_dir):
    """Extract performance metrics from benchmark results"""
    metrics = {}
    
    # Try to load manifest.json
    manifest_path = os.path.join(benchmark_dir, "manifest.json")
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)
            
            # Extract metrics from run_summary if available
            if 'run_summary' in manifest:
                summary = manifest['run_summary']
                metrics.update({
                    'wall_time': summary.get('wall_time'),
                    'duration_seconds': summary.get('duration_seconds'),
                    'compute_time': summary.get('compute_time'),
                    'instance_type': summary.get('instance_type'),
                    'start_time': summary.get('start_time'),
                    'end_time': summary.get('end_time')
                })
        except Exception as e:
            logger.error(f"Error parsing manifest.json: {e}")
    
    # Try to load results.json
    results_path = os.path.join(benchmark_dir, "results.json")
    if os.path.exists(results_path):
        try:
            with open(results_path, 'r') as f:
                results = json.load(f)
            
            # Extract metrics from results
            metrics.update({
                'throughput_days_per_day': results.get('throughput_days_per_day'),
                'cost_per_sim_day': results.get('cost_per_sim_day'),
                'memory_usage_gb': results.get('memory_usage_gb'),
                'cpu_efficiency': results.get('cpu_efficiency')
            })
        except Exception as e:
            logger.error(f"Error parsing results.json: {e}")
    
    # Try to infer additional metrics
    if 'duration_seconds' in metrics and metrics['duration_seconds'] is not None:
        duration_hours = metrics['duration_seconds'] / 3600
        metrics['duration_hours'] = duration_hours
        
        # If we have simulation days information, calculate throughput
        if 'simulation_days' in metrics and metrics['simulation_days'] is not None:
            sim_days = metrics['simulation_days']
            throughput = sim_days / (duration_hours / 24)
            metrics['throughput_days_per_day'] = throughput
    
    # Look for benchmark configuration
    config_path = os.path.join(benchmark_dir, "config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            
            # Extract configuration details
            if isinstance(config, dict):
                metrics['simulation_type'] = config.get('simulation_type')
                metrics['resolution'] = config.get('domain', {}).get('resolution')
                metrics['processor_type'] = config.get('hardware', {}).get('processor_type')
                
                # For GCHP, get node count
                if config.get('application') == 'gchp':
                    metrics['nodes'] = config.get('hardware', {}).get('nodes')
        except Exception as e:
            logger.error(f"Error parsing config.json: {e}")
    
    return metrics

def analyze_benchmarks(results_dir, config=None):
    """Analyze benchmark results and prepare dataframe"""
    # Get all benchmark directories
    benchmark_dirs = [d for d in os.listdir(results_dir) 
                     if os.path.isdir(os.path.join(results_dir, d))]
    
    # Collect metrics for all benchmarks
    all_metrics = []
    for benchmark_id in benchmark_dirs:
        benchmark_dir = os.path.join(results_dir, benchmark_id)
        metrics = extract_performance_metrics(benchmark_dir)
        
        # Add benchmark ID
        metrics['benchmark_id'] = benchmark_id
        
        # If we have the original config, add phase information
        if config:
            # Find the phase this benchmark belongs to
            for phase_num in range(1, 5):
                phase_key = f"phase_{phase_num}"
                if phase_key in config:
                    for bench_config in config[phase_key]:
                        if bench_config.get('id') == benchmark_id:
                            metrics['phase'] = phase_num
                            metrics['description'] = bench_config.get('description')
                            metrics['metrics_focus'] = bench_config.get('metrics_focus')
                            break
        
        all_metrics.append(metrics)
    
    # Convert to DataFrame
    df = pd.DataFrame(all_metrics)
    
    # Clean up DataFrame - convert strings to numeric where appropriate
    numeric_columns = ['throughput_days_per_day', 'duration_seconds', 'duration_hours',
                      'cost_per_sim_day', 'memory_usage_gb', 'cpu_efficiency']
    
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df

def generate_performance_visualizations(df, output_dir):
    """Generate performance visualization plots"""
    # Create visualization directory
    viz_dir = os.path.join(output_dir, "visualizations")
    os.makedirs(viz_dir, exist_ok=True)
    
    # Set the style
    plt.style.use('seaborn-v0_8-whitegrid')
    sns.set_context("talk")
    
    # 1. Throughput Comparison by Processor Type
    if 'throughput_days_per_day' in df.columns and 'processor_type' in df.columns:
        plt.figure(figsize=(14, 8))
        ax = sns.barplot(x='benchmark_id', y='throughput_days_per_day', hue='processor_type', data=df)
        ax.set_title('Simulation Throughput by Processor Type')
        ax.set_xlabel('Benchmark ID')
        ax.set_ylabel('Throughput (Simulation Days / Wall Day)')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'throughput_by_processor.png'), dpi=300)
        plt.close()
    
    # 2. Cost vs. Performance
    if 'cost_per_sim_day' in df.columns and 'throughput_days_per_day' in df.columns:
        plt.figure(figsize=(12, 8))
        ax = sns.scatterplot(x='cost_per_sim_day', y='throughput_days_per_day', 
                           hue='processor_type', size='simulation_type', data=df)
        ax.set_title('Cost vs. Performance')
        ax.set_xlabel('Cost per Simulation Day ($)')
        ax.set_ylabel('Throughput (Simulation Days / Wall Day)')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'cost_vs_performance.png'), dpi=300)
        plt.close()
    
    # 3. Performance by Instance Type for GC Classic
    gc_classic_df = df[df['nodes'].isna()]  # Filter for GC Classic (no nodes)
    if not gc_classic_df.empty and 'instance_type' in gc_classic_df.columns:
        plt.figure(figsize=(14, 8))
        ax = sns.barplot(x='instance_type', y='throughput_days_per_day', data=gc_classic_df)
        ax.set_title('GC Classic Performance by Instance Type')
        ax.set_xlabel('Instance Type')
        ax.set_ylabel('Throughput (Simulation Days / Wall Day)')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'gc_classic_by_instance.png'), dpi=300)
        plt.close()
    
    # 4. GCHP Scaling Performance
    gchp_df = df[df['nodes'].notna()]  # Filter for GCHP (has nodes)
    if not gchp_df.empty and 'nodes' in gchp_df.columns:
        plt.figure(figsize=(12, 8))
        ax = sns.barplot(x='nodes', y='throughput_days_per_day', hue='resolution', data=gchp_df)
        ax.set_title('GCHP Performance by Node Count')
        ax.set_xlabel('Number of Nodes')
        ax.set_ylabel('Throughput (Simulation Days / Wall Day)')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'gchp_scaling.png'), dpi=300)
        plt.close()
    
    # 5. Performance by Simulation Type
    if 'simulation_type' in df.columns:
        plt.figure(figsize=(12, 8))
        ax = sns.barplot(x='simulation_type', y='throughput_days_per_day', hue='processor_type', data=df)
        ax.set_title('Performance by Simulation Type')
        ax.set_xlabel('Simulation Type')
        ax.set_ylabel('Throughput (Simulation Days / Wall Day)')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'performance_by_sim_type.png'), dpi=300)
        plt.close()
    
    # 6. Resolution Impact
    if 'resolution' in df.columns:
        plt.figure(figsize=(12, 8))
        ax = sns.barplot(x='resolution', y='throughput_days_per_day', hue='processor_type', data=df)
        ax.set_title('Performance by Resolution')
        ax.set_xlabel('Resolution')
        ax.set_ylabel('Throughput (Simulation Days / Wall Day)')
        plt.tight_layout()
        plt.savefig(os.path.join(viz_dir, 'performance_by_resolution.png'), dpi=300)
        plt.close()
    
    logger.info(f"Generated performance visualizations in {viz_dir}")

def generate_html_report(df, output_dir, config=None):
    """Generate HTML report with benchmark results"""
    # Create report directory
    report_dir = os.path.join(output_dir, "html")
    os.makedirs(report_dir, exist_ok=True)
    
    # Copy visualization images if they exist
    viz_dir = os.path.join(output_dir, "visualizations")
    if os.path.exists(viz_dir):
        for img_file in os.listdir(viz_dir):
            if img_file.endswith('.png'):
                src = os.path.join(viz_dir, img_file)
                dst = os.path.join(report_dir, img_file)
                import shutil
                shutil.copy2(src, dst)
    
    # Generate summary statistics
    summary_stats = {}
    
    if 'throughput_days_per_day' in df.columns:
        summary_stats['max_throughput'] = {
            'value': df['throughput_days_per_day'].max(),
            'benchmark': df.loc[df['throughput_days_per_day'].idxmax(), 'benchmark_id']
        }
    
    if 'cost_per_sim_day' in df.columns:
        summary_stats['min_cost'] = {
            'value': df['cost_per_sim_day'].min(),
            'benchmark': df.loc[df['cost_per_sim_day'].idxmin(), 'benchmark_id']
        }
    
    # Build HTML content
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GEOS-Chem Benchmarking Report</title>
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
        <h1>GEOS-Chem Benchmarking Report</h1>
        <p>Generated on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        
        <div class="summary-card">
            <h2>Summary Statistics</h2>
            <ul>
    """
    
    # Add summary stats
    for stat_name, stat_data in summary_stats.items():
        formatted_name = ' '.join(word.capitalize() for word in stat_name.split('_'))
        html_content += f"<li><strong>{formatted_name}:</strong> <span class='metric-highlight'>{stat_data['value']:.2f}</span> (Benchmark: {stat_data['benchmark']})</li>\n"
    
    html_content += """
            </ul>
        </div>
        
        <h2>Performance Visualizations</h2>
    """
    
    # Add visualization images
    viz_files = [
        'throughput_by_processor.png',
        'cost_vs_performance.png',
        'gc_classic_by_instance.png',
        'gchp_scaling.png',
        'performance_by_sim_type.png',
        'performance_by_resolution.png'
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
    
    # Table headers
    columns_to_show = ['benchmark_id', 'description', 'simulation_type', 'resolution', 
                     'processor_type', 'instance_type', 'nodes',
                     'throughput_days_per_day', 'cost_per_sim_day', 'duration_hours']
    
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
                formatted_value = f"{value:.2f}" if col in ['throughput_days_per_day', 'cost_per_sim_day', 'duration_hours'] else str(value)
            else:
                formatted_value = str(value)
            
            html_content += f"<td>{formatted_value}</td>\n"
        html_content += "</tr>\n"
    
    html_content += """
            </tbody>
        </table>
        
        <footer>
            <p>GEOS-Chem AWS Cloud Runner Benchmarking System</p>
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

def generate_benchmark_report(df, output_dir, report_format, config=None):
    """Generate benchmark report in the specified format"""
    # Generate data tables and summary statistics
    output_paths = {}
    
    # Always save the processed data as CSV
    csv_path = os.path.join(output_dir, "benchmark-results.csv")
    df.to_csv(csv_path, index=False)
    output_paths['csv'] = csv_path
    
    # Generate JSON output
    if report_format in ['json', 'all']:
        json_path = os.path.join(output_dir, "benchmark-results.json")
        
        # Convert DataFrame to JSON
        results_json = {
            'generated_at': datetime.datetime.now().isoformat(),
            'benchmarks': df.to_dict(orient='records'),
            'summary': {
                'total_benchmarks': len(df),
                'mean_throughput': df['throughput_days_per_day'].mean() if 'throughput_days_per_day' in df.columns else None,
                'mean_cost': df['cost_per_sim_day'].mean() if 'cost_per_sim_day' in df.columns else None
            }
        }
        
        with open(json_path, 'w') as f:
            json.dump(results_json, f, indent=2)
        
        output_paths['json'] = json_path
    
    # Generate visualizations
    generate_performance_visualizations(df, output_dir)
    
    # Generate HTML report
    if report_format in ['html', 'all']:
        html_path = generate_html_report(df, output_dir, config)
        output_paths['html'] = html_path
    
    # Generate PDF report (if requested and possible)
    if report_format in ['pdf', 'all']:
        try:
            from weasyprint import HTML
            pdf_dir = os.path.join(output_dir, "pdf")
            os.makedirs(pdf_dir, exist_ok=True)
            
            # Use the HTML report as a base for the PDF
            if 'html' in output_paths:
                html_path = output_paths['html']
                pdf_path = os.path.join(pdf_dir, "benchmark-report.pdf")
                
                HTML(html_path).write_pdf(pdf_path)
                output_paths['pdf'] = pdf_path
                logger.info(f"Generated PDF report at {pdf_path}")
            else:
                logger.warning("Cannot generate PDF without HTML report")
        except ImportError:
            logger.warning("weasyprint module not found, skipping PDF generation")
    
    return output_paths

def main():
    """Main function"""
    args = parse_args()
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Load benchmark configuration if provided
    config = None
    if args.config:
        config = load_benchmark_config(args.config)
    
    # List benchmark results
    logger.info(f"Listing benchmark results in {args.results_bucket}")
    benchmark_results = list_benchmark_results(args.results_bucket)
    
    if not benchmark_results:
        logger.error("No benchmark results found")
        sys.exit(1)
    
    logger.info(f"Found {len(benchmark_results)} benchmark results")
    
    # Filter results by phase if specified
    if args.phase:
        if config:
            phase_key = f"phase_{args.phase}"
            phase_benchmarks = []
            if phase_key in config:
                phase_ids = [b['id'] for b in config[phase_key]]
                
                benchmark_results = [b for b in benchmark_results 
                                   if b['benchmark_id'] in phase_ids]
                
                logger.info(f"Filtered to {len(benchmark_results)} benchmarks in phase {args.phase}")
        else:
            logger.warning("Cannot filter by phase without configuration file")
    
    # Filter by specific run ID if provided
    if args.run_id:
        benchmark_results = [b for b in benchmark_results 
                           if args.run_id in b['benchmark_id']]
        logger.info(f"Filtered to {len(benchmark_results)} benchmarks with run ID {args.run_id}")
    
    # Download results
    results_dir = os.path.join(args.output_dir, "downloaded-results")
    download_benchmark_results(args.results_bucket, benchmark_results, results_dir)
    
    # Analyze benchmarks
    df = analyze_benchmarks(results_dir, config)
    
    if df.empty:
        logger.error("No valid benchmark data found to analyze")
        sys.exit(1)
    
    # Generate reports
    report_paths = generate_benchmark_report(df, args.output_dir, args.format, config)
    
    logger.info("Benchmark analysis completed")
    logger.info(f"Output files: {', '.join(report_paths.values())}")

if __name__ == "__main__":
    main()