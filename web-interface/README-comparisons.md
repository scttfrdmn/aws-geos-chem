# GEOS-Chem AWS Cloud Runner Simulation Comparison Features

This document provides detailed information about the simulation comparison features in the GEOS-Chem AWS Cloud Runner. These features allow researchers to compare results across multiple simulations, identify differences, and analyze the impacts of configuration changes.

## Table of Contents

- [Overview](#overview)
- [Time Series Comparison](#time-series-comparison)
- [Spatial Comparison](#spatial-comparison)
- [Statistical Metrics](#statistical-metrics)
- [Data Export](#data-export)
- [Implementation Details](#implementation-details)
- [Usage Examples](#usage-examples)

## Overview

The Simulation Comparison functionality of GEOS-Chem AWS Cloud Runner enables:

- Comparing time series data across multiple simulations
- Visualizing spatial differences between simulations
- Calculating statistical metrics to quantify differences
- Exporting comparison data for further analysis

These features are accessible through the SimulationComparisons page, which serves as a hub for comparison activities.

## Time Series Comparison

The TimeSeriesComparison component allows users to compare how variables change over time across different simulations.

### Key Features

- **Multi-Simulation Selection**: Select multiple simulations to compare
- **Variable Selection**: Choose from available variables common to selected simulations
- **Visualization Options**:
  - Line charts for direct comparison
  - Normalization to reference simulation (as percentages)
  - Difference view (absolute or relative differences)
- **Statistical Comparison**:
  - Correlation analysis with scatter plots
  - Regression lines with equations
  - Summary statistics table

### How to Use

1. Navigate to the Simulation Comparisons page
2. Select two or more simulations to compare
3. Choose a variable of interest (e.g., SpeciesConc_O3)
4. Select a reference simulation for normalization and differences
5. Toggle between absolute and relative difference views
6. Use the tabs to switch between time series, correlation, and statistics views

### Implementation

The TimeSeriesComparison component uses:

- Redux store for simulation data access
- Recharts library for interactive charts
- Custom statistical functions for metrics calculation

## Spatial Comparison

The SpatialComparison component allows visualization and comparison of spatial distributions across simulations.

### Key Features

- **Multi-Simulation Selection**: Select multiple simulations to compare
- **Variable Selection**: Choose from available NetCDF variables
- **Visualization Types**:
  - Horizontal (lat-lon) maps
  - Zonal mean (latitude-altitude) plots
  - Vertical profiles
- **Difference Maps**:
  - Absolute differences between simulations
  - Relative (percentage) differences
- **Level/Time Selection**:
  - Select vertical levels (surface, pressure levels, column)
  - Choose time steps for time-dependent data

### How to Use

1. Navigate to the Simulation Comparisons page
2. Select the "Spatial Comparison" tab
3. Select two or more simulations to compare
4. Choose a variable, level, and time step
5. Toggle "Show Differences" to view difference maps
6. Use "Relative (%)" toggle to switch between absolute and percentage differences
7. Switch between horizontal, zonal mean, and vertical profile tabs

### Implementation

The SpatialComparison component:

- Fetches NetCDF metadata and variable information
- Generates visualizations using API endpoints
- Allows for downloading images of the visualization

## Statistical Metrics

Several statistical metrics are calculated to quantify differences between simulations:

### Time Series Metrics

- **Correlation Coefficient (R)**: Measures the linear relationship between two time series. Values range from -1 to 1, where:
  - 1 indicates perfect positive correlation
  - 0 indicates no correlation
  - -1 indicates perfect negative correlation

- **Root Mean Square Error (RMSE)**: Measures the square root of the average squared differences between values. Lower values indicate better agreement.

- **Mean Bias Error (MBE)**: Measures the average difference between simulations. Positive values indicate the simulation is on average higher than the reference; negative values indicate it's lower.

### Implementation

Statistical metrics are calculated using custom functions:

```javascript
// Correlation coefficient
const calculateCorrelation = (x: number[], y: number[]) => {
  // Calculate the mean of x and y
  const xMean = x.reduce((sum, val) => sum + val, 0) / x.length;
  const yMean = y.reduce((sum, val) => sum + val, 0) / y.length;
  
  // Calculate deviations from the mean
  const xDiffs = x.map(val => val - xMean);
  const yDiffs = y.map(val => val - yMean);
  
  // Calculate the numerator (covariance)
  const numerator = xDiffs.reduce((sum, xDiff, i) => sum + xDiff * yDiffs[i], 0);
  
  // Calculate the denominator (product of standard deviations)
  const xSumSquares = xDiffs.map(diff => Math.pow(diff, 2)).reduce((sum, val) => sum + val, 0);
  const ySumSquares = yDiffs.map(diff => Math.pow(diff, 2)).reduce((sum, val) => sum + val, 0);
  
  if (xSumSquares === 0 || ySumSquares === 0) return 0;
  
  const denominator = Math.sqrt(xSumSquares * ySumSquares);
  
  return numerator / denominator;
};

// Root mean square error
const calculateRMSE = (values1: number[], values2: number[]) => {
  // Filter for valid pairs of values
  const validPairs = values1.map((v1, i) => [v1, values2[i]])
    .filter(([v1, v2]) => !isNaN(v1) && !isNaN(v2));
  
  if (validPairs.length === 0) return NaN;
  
  // Calculate the mean squared error
  const squaredDiffs = validPairs.map(([v1, v2]) => Math.pow(v1 - v2, 2));
  const meanSquaredError = squaredDiffs.reduce((sum, val) => sum + val, 0) / validPairs.length;
  
  // Return the square root
  return Math.sqrt(meanSquaredError);
};

// Mean bias error
const calculateMBE = (values1: number[], values2: number[]) => {
  // Filter for valid pairs of values
  const validPairs = values1.map((v1, i) => [v1, values2[i]])
    .filter(([v1, v2]) => !isNaN(v1) && !isNaN(v2));
  
  if (validPairs.length === 0) return NaN;
  
  // Calculate the differences and their mean
  const diffs = validPairs.map(([v1, v2]) => v1 - v2);
  const meanBiasError = diffs.reduce((sum, val) => sum + val, 0) / validPairs.length;
  
  return meanBiasError;
};
```

## Data Export

### CSV Export

Time series comparison data can be exported to CSV format for further analysis in external tools. The export includes:

- Time values
- Values for each simulation
- Optional normalization and differences

### Implementation

```javascript
// Export chart data to CSV
const exportToCSV = () => {
  if (comparisonData.length === 0) return;
  
  // Create CSV header
  const headers = ['time', ...timeSeriesData
    .filter(ts => ts.visible)
    .map(ts => ts.simulationName)
  ];
  
  // Create CSV rows
  const rows = comparisonData.map(point => {
    const row = [point.time];
    
    timeSeriesData
      .filter(ts => ts.visible)
      .forEach(ts => {
        row.push(point[ts.simulationName]);
      });
    
    return row;
  });
  
  // Combine header and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Create a blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${selectedVariable}_comparison.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

### Image Download

Spatial comparison visualizations can be downloaded as images for inclusion in publications or presentations. The implementation uses standard browser functionality to download images from URLs.

## Implementation Details

### Redux Store Integration

The comparison features are integrated with the Redux store, particularly the following slices:

- **resultsSlice**: Manages visualization data and metadata
- **simulationsSlice**: Provides access to simulation information

### API Endpoints

The backend provides several API endpoints for comparison features:

- `/api/results/{simulationId}/netcdf-metadata`: Get metadata for NetCDF files
- `/api/results/{simulationId}/netcdf-data`: Get variable data from NetCDF files
- `/api/results/{simulationId}/spatial-visualization`: Generate spatial visualizations
- `/api/results/spatial-difference`: Generate difference maps between simulations

## Usage Examples

### Scenario 1: Comparing Model Versions

Researchers can compare results from different versions of the GEOS-Chem model:

1. Run simulations with identical configurations but different model versions
2. Use TimeSeriesComparison to identify trends and differences over time
3. Use SpatialComparison to identify spatial patterns in differences
4. Export data for detailed analysis and inclusion in publications

### Scenario 2: Parameter Sensitivity Analysis

Researchers can analyze the sensitivity of model outputs to parameter changes:

1. Run simulations with variations in key parameters
2. Use TimeSeriesComparison to quantify the impact on key variables
3. Calculate correlation and RMSE to determine which parameters have the most significant impact
4. Visualize spatial differences to understand regional sensitivities

### Scenario 3: Emissions Scenario Comparison

Researchers can compare different emissions scenarios:

1. Run simulations with different emissions scenarios
2. Compare concentration changes over time for key species
3. Identify regions with the most significant differences
4. Quantify the relationship between emissions changes and concentration responses