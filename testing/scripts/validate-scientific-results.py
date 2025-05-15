#!/usr/bin/env python3
"""
validate-scientific-results.py

Validates the scientific correctness of GEOS-Chem results across different architectures.
This script compares key output variables between x86 and ARM (Graviton) runs to ensure
that the numerical results are consistent within acceptable tolerances.
"""

import argparse
import os
import sys
import json
import numpy as np
import xarray as xr
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import logging
import shutil
import pandas as pd
from tabulate import tabulate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("validation-results.log")
    ]
)
logger = logging.getLogger(__name__)

# Define key species to validate
KEY_SPECIES = [
    'SpeciesConc_O3',   # Ozone
    'SpeciesConc_CO',   # Carbon monoxide
    'SpeciesConc_NO',   # Nitric oxide
    'SpeciesConc_NO2',  # Nitrogen dioxide
    'SpeciesConc_OH',   # Hydroxyl radical
    'SpeciesConc_SO4',  # Sulfate
    'SpeciesConc_BC',   # Black carbon
    'SpeciesConc_OC'    # Organic carbon
]

# Define validation thresholds (relative differences)
VALIDATION_THRESHOLDS = {
    'mean': 1e-5,      # Mean value should be within 0.001% across architectures
    'rmse': 1e-4,      # RMSE should be less than 0.01% of mean value
    'max_abs_diff': 1e-3  # Maximum absolute difference should be less than 0.1% of mean value
}

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="GEOS-Chem Scientific Results Validator")
    
    parser.add_argument("--reference", "-r", required=True,
                       help="Path to reference output directory (usually x86)")
    parser.add_argument("--test", "-t", required=True,
                       help="Path to test output directory (usually ARM)")
    parser.add_argument("--output", "-o", default="validation-results",
                       help="Output directory for validation results")
    parser.add_argument("--species", "-s", nargs='+',
                       help=f"Specific species to validate (default: {KEY_SPECIES})")
    parser.add_argument("--time-step", type=int, default=-1,
                       help="Time step to validate (default: final time step)")
    parser.add_argument("--threshold", "-th", type=float,
                       help="Custom threshold for validation (overrides defaults)")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    
    return parser.parse_args()

def load_netcdf_outputs(directory):
    """Load NetCDF output files from a directory"""
    if not os.path.exists(directory):
        logger.error(f"Directory not found: {directory}")
        return None
        
    # Look for NetCDF files in the OutputDir subdirectory
    output_dir = os.path.join(directory, "OutputDir")
    if os.path.exists(output_dir):
        directory = output_dir
        
    # Find all NetCDF files
    nc_files = list(Path(directory).glob("*.nc"))
    if not nc_files:
        nc_files = list(Path(directory).glob("**/*.nc"))
        
    if not nc_files:
        logger.error(f"No NetCDF files found in {directory}")
        return None
        
    # For each file type, load the data
    datasets = {}
    
    for nc_file in nc_files:
        try:
            # Use the file stem as a key
            key = nc_file.stem
            
            # Load the dataset
            logger.info(f"Loading {nc_file}")
            ds = xr.open_dataset(nc_file)
            
            datasets[key] = ds
            
        except Exception as e:
            logger.error(f"Error loading {nc_file}: {e}")
    
    return datasets

def get_species_data(datasets, species, time_step=-1):
    """Extract species data from datasets for comparison"""
    species_data = {}
    
    for dataset_name, ds in datasets.items():
        # Check if this is a restart file or output file
        is_restart = "SPC_" in str(list(ds.variables))
        
        for species_name in species:
            # Handle different variable name formats
            if is_restart:
                # For restart files, species are named like SPC_XXX
                var_name = f"SPC_{species_name.split('_')[1]}"
            else:
                # For output files, they're already named correctly
                var_name = species_name
            
            # Check if variable exists in this dataset
            if var_name in ds:
                # Extract the data
                data = ds[var_name]
                
                # Select time step if it's a time series
                if 'time' in data.dims and time_step is not None:
                    if time_step == -1:
                        # Use the last time step
                        data = data.isel(time=-1)
                    else:
                        # Use the specified time step
                        data = data.isel(time=time_step)
                
                # Store the data
                if species_name not in species_data:
                    species_data[species_name] = {}
                
                species_data[species_name][dataset_name] = data
    
    return species_data

def compare_species(reference_data, test_data, species, thresholds=None):
    """Compare species data between reference and test runs"""
    if thresholds is None:
        thresholds = VALIDATION_THRESHOLDS
    
    results = {}
    
    for species_name in species:
        if species_name not in reference_data or species_name not in test_data:
            logger.warning(f"Species {species_name} not found in both datasets")
            continue
        
        species_results = {}
        
        # For each dataset containing this species
        for dataset_name in set(reference_data[species_name].keys()) & set(test_data[species_name].keys()):
            # Get the data arrays
            ref_array = reference_data[species_name][dataset_name].values
            test_array = test_data[species_name][dataset_name].values
            
            # Ensure shapes match
            if ref_array.shape != test_array.shape:
                logger.warning(f"Shape mismatch for {species_name} in {dataset_name}: {ref_array.shape} vs {test_array.shape}")
                continue
            
            # Calculate statistics
            # Convert to numpy arrays and flatten for easier processing
            ref_flat = ref_array.flatten()
            test_flat = test_array.flatten()
            
            # Remove NaN values
            valid_idx = ~np.isnan(ref_flat) & ~np.isnan(test_flat)
            ref_valid = ref_flat[valid_idx]
            test_valid = test_flat[valid_idx]
            
            if len(ref_valid) == 0:
                logger.warning(f"No valid (non-NaN) data for {species_name} in {dataset_name}")
                continue
            
            # Calculate absolute differences
            abs_diff = np.abs(test_valid - ref_valid)
            
            # Calculate relative differences where reference is not too close to zero
            # Avoid division by zero or very small values
            safe_idx = np.abs(ref_valid) > 1e-10
            rel_diff = np.zeros_like(ref_valid)
            rel_diff[safe_idx] = abs_diff[safe_idx] / np.abs(ref_valid[safe_idx])
            
            # Calculate statistics
            stats = {
                'mean_ref': float(np.mean(ref_valid)),
                'mean_test': float(np.mean(test_valid)),
                'mean_abs_diff': float(np.mean(abs_diff)),
                'max_abs_diff': float(np.max(abs_diff)),
                'rmse': float(np.sqrt(np.mean(np.square(abs_diff)))),
                'mean_rel_diff': float(np.mean(rel_diff)),
                'max_rel_diff': float(np.max(rel_diff)),
                'corr_coef': float(np.corrcoef(ref_valid, test_valid)[0, 1])
            }
            
            # Determine if the results pass validation
            # Calculate the relative statistics as percentages of mean reference value
            if stats['mean_ref'] != 0:
                rel_mean_diff = abs(stats['mean_ref'] - stats['mean_test']) / abs(stats['mean_ref'])
                rel_rmse = stats['rmse'] / abs(stats['mean_ref'])
                rel_max_diff = stats['max_abs_diff'] / abs(stats['mean_ref'])
                
                passes_validation = (
                    rel_mean_diff < thresholds['mean'] and
                    rel_rmse < thresholds['rmse'] and
                    rel_max_diff < thresholds['max_abs_diff']
                )
            else:
                # If reference mean is zero, check if test mean is also very close to zero
                passes_validation = abs(stats['mean_test']) < 1e-10
            
            stats['passes_validation'] = passes_validation
            
            # Store the results
            species_results[dataset_name] = stats
        
        results[species_name] = species_results
    
    return results

def generate_comparison_plots(reference_data, test_data, species, output_dir, comparison_results):
    """Generate comparison plots for each species"""
    os.makedirs(output_dir, exist_ok=True)
    plot_dir = os.path.join(output_dir, "plots")
    os.makedirs(plot_dir, exist_ok=True)
    
    for species_name in species:
        if species_name not in reference_data or species_name not in test_data:
            continue
        
        for dataset_name in set(reference_data[species_name].keys()) & set(test_data[species_name].keys()):
            # Get the data arrays
            ref_array = reference_data[species_name][dataset_name].values
            test_array = test_data[species_name][dataset_name].values
            
            # Ensure shapes match
            if ref_array.shape != test_array.shape:
                continue
                
            # Get results stats
            stats = comparison_results[species_name][dataset_name]
            
            # Create a figure with 3 subplots
            fig, axs = plt.subplots(1, 3, figsize=(18, 6))
            
            # Plot the reference data
            ref_flat = ref_array.flatten()
            ref_valid = ref_flat[~np.isnan(ref_flat)]
            
            # 1. Histogram of reference values
            sns.histplot(ref_valid, bins=50, kde=True, ax=axs[0])
            axs[0].set_title(f"Reference Distribution: {species_name}")
            axs[0].set_xlabel("Value")
            axs[0].set_ylabel("Frequency")
            
            # 2. Scatter plot of reference vs test
            test_flat = test_array.flatten()
            valid_idx = ~np.isnan(ref_flat) & ~np.isnan(test_flat)
            ref_valid = ref_flat[valid_idx]
            test_valid = test_flat[valid_idx]
            
            # Sample points if there are too many
            if len(ref_valid) > 10000:
                sample_idx = np.random.choice(len(ref_valid), 10000, replace=False)
                ref_sample = ref_valid[sample_idx]
                test_sample = test_valid[sample_idx]
            else:
                ref_sample = ref_valid
                test_sample = test_valid
            
            axs[1].scatter(ref_sample, test_sample, alpha=0.5, s=2)
            
            # Add y=x line
            lims = [
                np.min([axs[1].get_xlim(), axs[1].get_ylim()]),
                np.max([axs[1].get_xlim(), axs[1].get_ylim()])
            ]
            axs[1].plot(lims, lims, 'r-', alpha=0.75, zorder=0)
            
            axs[1].set_title(f"Reference vs Test: {species_name}")
            axs[1].set_xlabel("Reference Value")
            axs[1].set_ylabel("Test Value")
            
            # Add correlation coefficient and RMSE to the plot
            text = f"Correlation: {stats['corr_coef']:.6f}\nRMSE: {stats['rmse']:.6e}"
            axs[1].annotate(text, xy=(0.05, 0.95), xycoords='axes fraction',
                           bbox=dict(boxstyle="round,pad=0.3", fc="white", alpha=0.8),
                           va='top')
            
            # 3. Histogram of differences
            abs_diff = np.abs(test_valid - ref_valid)
            rel_diff = np.zeros_like(ref_valid)
            safe_idx = np.abs(ref_valid) > 1e-10
            rel_diff[safe_idx] = abs_diff[safe_idx] / np.abs(ref_valid[safe_idx])
            
            sns.histplot(rel_diff, bins=50, kde=True, ax=axs[2])
            axs[2].set_title(f"Relative Differences: {species_name}")
            axs[2].set_xlabel("Relative Difference")
            axs[2].set_ylabel("Frequency")
            
            # Use scientific notation for x-axis if the values are very small
            if np.max(rel_diff) < 1e-3:
                axs[2].ticklabel_format(axis='x', style='sci', scilimits=(0,0))
            
            # Add validation result
            result_text = "PASS" if stats['passes_validation'] else "FAIL"
            color = "green" if stats['passes_validation'] else "red"
            fig.suptitle(f"{species_name} - {dataset_name} - Validation: {result_text}", 
                        fontsize=16, color=color)
            
            plt.tight_layout()
            
            # Save the figure
            plot_file = os.path.join(plot_dir, f"{species_name}_{dataset_name}_comparison.png")
            plt.savefig(plot_file, dpi=300)
            plt.close()
    
    logger.info(f"Plots saved to {plot_dir}")

def create_validation_report(comparison_results, args, output_dir):
    """Create a validation report from the comparison results"""
    os.makedirs(output_dir, exist_ok=True)
    
    # Create a pandas DataFrame for the summary
    summary_rows = []
    
    for species_name in comparison_results.keys():
        for dataset_name, stats in comparison_results[species_name].items():
            row = {
                'Species': species_name,
                'Dataset': dataset_name,
                'Mean Reference': stats['mean_ref'],
                'Mean Test': stats['mean_test'],
                'Mean Difference': stats['mean_abs_diff'],
                'Max Difference': stats['max_abs_diff'],
                'RMSE': stats['rmse'],
                'Correlation': stats['corr_coef'],
                'Mean Rel Diff (%)': stats['mean_rel_diff'] * 100,
                'Max Rel Diff (%)': stats['max_rel_diff'] * 100,
                'Passes Validation': stats['passes_validation']
            }
            summary_rows.append(row)
    
    summary_df = pd.DataFrame(summary_rows)
    
    # Save the summary as CSV
    csv_file = os.path.join(output_dir, "validation_summary.csv")
    summary_df.to_csv(csv_file, index=False)
    
    # Create a markdown report
    md_file = os.path.join(output_dir, "validation_report.md")
    
    with open(md_file, 'w') as f:
        f.write("# GEOS-Chem Scientific Validation Report\n\n")
        
        f.write("## Validation Configuration\n\n")
        f.write(f"- Reference data: `{args.reference}`\n")
        f.write(f"- Test data: `{args.test}`\n")
        f.write(f"- Time step: {args.time_step}\n")
        
        if args.threshold:
            f.write(f"- Custom threshold: {args.threshold}\n")
        else:
            f.write("- Validation thresholds:\n")
            for key, value in VALIDATION_THRESHOLDS.items():
                f.write(f"  - {key}: {value}\n")
        
        f.write("\n## Validation Summary\n\n")
        
        # Count passed/failed tests
        total_tests = len(summary_rows)
        passed_tests = sum(1 for row in summary_rows if row['Passes Validation'])
        failed_tests = total_tests - passed_tests
        
        f.write(f"- **Total tests**: {total_tests}\n")
        f.write(f"- **Passed tests**: {passed_tests}\n")
        f.write(f"- **Failed tests**: {failed_tests}\n")
        
        if failed_tests > 0:
            f.write("\n### Failed Tests\n\n")
            
            # Create a table of failed tests
            failed_rows = [row for row in summary_rows if not row['Passes Validation']]
            failed_df = pd.DataFrame(failed_rows)[['Species', 'Dataset', 'Mean Rel Diff (%)', 'Max Rel Diff (%)', 'RMSE']]
            
            f.write(tabulate(failed_df, headers='keys', tablefmt='pipe', floatfmt='.6e'))
            
        f.write("\n\n## Detailed Results\n\n")
        
        # Write detailed results for each species
        for species_name in comparison_results.keys():
            f.write(f"### {species_name}\n\n")
            
            for dataset_name, stats in comparison_results[species_name].items():
                f.write(f"#### {dataset_name}\n\n")
                
                result_text = "**PASS**" if stats['passes_validation'] else "**FAIL**"
                f.write(f"- Validation Result: {result_text}\n")
                f.write(f"- Mean Reference: {stats['mean_ref']:.6e}\n")
                f.write(f"- Mean Test: {stats['mean_test']:.6e}\n")
                f.write(f"- Mean Absolute Difference: {stats['mean_abs_diff']:.6e}\n")
                f.write(f"- Maximum Absolute Difference: {stats['max_abs_diff']:.6e}\n")
                f.write(f"- RMSE: {stats['rmse']:.6e}\n")
                f.write(f"- Correlation Coefficient: {stats['corr_coef']:.6f}\n")
                f.write(f"- Mean Relative Difference: {stats['mean_rel_diff']*100:.6e}%\n")
                f.write(f"- Maximum Relative Difference: {stats['max_rel_diff']*100:.6e}%\n\n")
                
                # Add the plot if it exists
                plot_file = f"{species_name}_{dataset_name}_comparison.png"
                if os.path.exists(os.path.join(output_dir, "plots", plot_file)):
                    f.write(f"![{species_name} {dataset_name} Comparison](plots/{plot_file})\n\n")
    
    # Create an HTML report
    html_file = os.path.join(output_dir, "validation_report.html")
    
    with open(html_file, 'w') as f:
        f.write("""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GEOS-Chem Scientific Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        h1, h2, h3, h4 { color: #2c3e50; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { text-align: left; padding: a12px; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        tr:hover { background-color: #f5f5f5; }
        .summary-card { background-color: #f8f9fa; border-radius: 5px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .chart-container { margin: 30px 0; text-align: center; }
        .chart-container img { max-width: 100%; height: auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .details { margin-top: 30px; }
    </style>
</head>
<body>
    <h1>GEOS-Chem Scientific Validation Report</h1>
    
    <div class="summary-card">
        <h2>Validation Configuration</h2>
        <ul>
""")
        
        f.write(f'            <li><strong>Reference data:</strong> {args.reference}</li>\n')
        f.write(f'            <li><strong>Test data:</strong> {args.test}</li>\n')
        f.write(f'            <li><strong>Time step:</strong> {args.time_step}</li>\n')
        
        if args.threshold:
            f.write(f'            <li><strong>Custom threshold:</strong> {args.threshold}</li>\n')
        else:
            f.write('            <li><strong>Validation thresholds:</strong>\n                <ul>\n')
            for key, value in VALIDATION_THRESHOLDS.items():
                f.write(f'                    <li>{key}: {value}</li>\n')
            f.write('                </ul>\n            </li>\n')
        
        f.write("""        </ul>
    </div>
    
    <div class="summary-card">
        <h2>Validation Summary</h2>
        <ul>
""")
        
        f.write(f'            <li><strong>Total tests:</strong> {total_tests}</li>\n')
        f.write(f'            <li><strong>Passed tests:</strong> <span class="pass">{passed_tests}</span></li>\n')
        f.write(f'            <li><strong>Failed tests:</strong> <span class="fail">{failed_tests}</span></li>\n')
        
        f.write('        </ul>\n    </div>\n')
        
        if failed_tests > 0:
            f.write('    <h2>Failed Tests</h2>\n    <table>\n        <tr>\n')
            f.write('            <th>Species</th>\n            <th>Dataset</th>\n            <th>Mean Rel Diff (%)</th>\n')
            f.write('            <th>Max Rel Diff (%)</th>\n            <th>RMSE</th>\n        </tr>\n')
            
            for row in failed_rows:
                f.write('        <tr>\n')
                f.write(f'            <td>{row["Species"]}</td>\n')
                f.write(f'            <td>{row["Dataset"]}</td>\n')
                f.write(f'            <td>{row["Mean Rel Diff (%)"]:.6e}</td>\n')
                f.write(f'            <td>{row["Max Rel Diff (%)"]:.6e}</td>\n')
                f.write(f'            <td>{row["RMSE"]:.6e}</td>\n')
                f.write('        </tr>\n')
            
            f.write('    </table>\n')
        
        f.write('    <h2>Detailed Results</h2>\n')
        
        for species_name in comparison_results.keys():
            f.write(f'    <h3>{species_name}</h3>\n')
            
            for dataset_name, stats in comparison_results[species_name].items():
                f.write(f'    <h4>{dataset_name}</h4>\n')
                
                result_class = "pass" if stats['passes_validation'] else "fail"
                result_text = "PASS" if stats['passes_validation'] else "FAIL"
                
                f.write('    <div class="details">\n        <ul>\n')
                f.write(f'            <li><strong>Validation Result:</strong> <span class="{result_class}">{result_text}</span></li>\n')
                f.write(f'            <li><strong>Mean Reference:</strong> {stats["mean_ref"]:.6e}</li>\n')
                f.write(f'            <li><strong>Mean Test:</strong> {stats["mean_test"]:.6e}</li>\n')
                f.write(f'            <li><strong>Mean Absolute Difference:</strong> {stats["mean_abs_diff"]:.6e}</li>\n')
                f.write(f'            <li><strong>Maximum Absolute Difference:</strong> {stats["max_abs_diff"]:.6e}</li>\n')
                f.write(f'            <li><strong>RMSE:</strong> {stats["rmse"]:.6e}</li>\n')
                f.write(f'            <li><strong>Correlation Coefficient:</strong> {stats["corr_coef"]:.6f}</li>\n')
                f.write(f'            <li><strong>Mean Relative Difference:</strong> {stats["mean_rel_diff"]*100:.6e}%</li>\n')
                f.write(f'            <li><strong>Maximum Relative Difference:</strong> {stats["max_rel_diff"]*100:.6e}%</li>\n')
                f.write('        </ul>\n    </div>\n')
                
                # Add the plot if it exists
                plot_file = f"{species_name}_{dataset_name}_comparison.png"
                if os.path.exists(os.path.join(output_dir, "plots", plot_file)):
                    f.write(f'    <div class="chart-container">\n')
                    f.write(f'        <img src="plots/{plot_file}" alt="{species_name} {dataset_name} Comparison">\n')
                    f.write(f'    </div>\n')
        
        f.write("""</body>
</html>
""")
    
    logger.info(f"Validation report saved to {output_dir}")
    logger.info(f"  - CSV: {csv_file}")
    logger.info(f"  - Markdown: {md_file}")
    logger.info(f"  - HTML: {html_file}")
    
    return html_file

def main():
    """Main function"""
    args = parse_args()
    
    # Create output directory
    os.makedirs(args.output, exist_ok=True)
    
    # Use default species if not specified
    species_to_validate = args.species if args.species else KEY_SPECIES
    
    logger.info(f"Validating {len(species_to_validate)} species between:")
    logger.info(f"  - Reference: {args.reference}")
    logger.info(f"  - Test: {args.test}")
    
    # Load data
    logger.info("Loading reference data...")
    reference_datasets = load_netcdf_outputs(args.reference)
    
    logger.info("Loading test data...")
    test_datasets = load_netcdf_outputs(args.test)
    
    if not reference_datasets or not test_datasets:
        logger.error("Failed to load datasets")
        sys.exit(1)
    
    # Extract species data
    logger.info("Extracting species data...")
    reference_data = get_species_data(reference_datasets, species_to_validate, args.time_step)
    test_data = get_species_data(test_datasets, species_to_validate, args.time_step)
    
    # Set validation threshold if provided
    thresholds = VALIDATION_THRESHOLDS
    if args.threshold:
        thresholds = {
            'mean': args.threshold,
            'rmse': args.threshold * 10,
            'max_abs_diff': args.threshold * 100
        }
    
    # Compare species
    logger.info("Comparing species data...")
    comparison_results = compare_species(reference_data, test_data, species_to_validate, thresholds)
    
    # Generate comparison plots
    logger.info("Generating comparison plots...")
    generate_comparison_plots(reference_data, test_data, species_to_validate, args.output, comparison_results)
    
    # Create validation report
    logger.info("Creating validation report...")
    report_file = create_validation_report(comparison_results, args, args.output)
    
    # Count validation results
    pass_count = 0
    total_count = 0
    
    for species_name in comparison_results.keys():
        for dataset_name, stats in comparison_results[species_name].items():
            total_count += 1
            if stats['passes_validation']:
                pass_count += 1
    
    # Print summary
    logger.info(f"Validation complete: {pass_count}/{total_count} tests passed")
    logger.info(f"Report saved to {report_file}")
    
    # Exit with error code if any tests failed
    if pass_count < total_count:
        sys.exit(1)

if __name__ == "__main__":
    main()