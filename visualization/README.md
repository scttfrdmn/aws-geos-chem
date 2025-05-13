# GEOS-Chem Results Visualization Service

This directory contains the code for the GEOS-Chem Results Visualization Service, which allows users to generate visualizations from their simulation outputs through an API.

## Overview

The visualization service provides the following functionality:

1. **Listing available variables** in NetCDF output files
2. **Generating visualizations** such as global maps, zonal means, and time series
3. **Creating summaries** of simulation results with performance metrics and available data

## Components

### Lambda Functions

The service consists of three main Lambda functions:

1. **list-variables.py**: Lists all variables in a NetCDF file with metadata
2. **generate-visualization.py**: Creates visualizations from NetCDF data
3. **generate-summary.py**: Generates a summary of simulation results

### Lambda Layer

Scientific packages required for visualization are packaged in a Lambda layer:

- numpy
- matplotlib
- xarray
- netCDF4
- cartopy
- other dependencies

### API Gateway

The API Gateway provides endpoints for the visualization service:

- `POST /visualizations/variables`: List variables in a NetCDF file
- `POST /visualizations/generate`: Generate a visualization
- `POST /visualizations/summary`: Generate a simulation summary

## Building and Deploying

### Building the Lambda Layer

The Lambda layer contains scientific Python packages that are too large to be included directly in the Lambda deployment package. To build the layer:

```bash
# Make the build script executable
chmod +x build-layer.sh

# Build the layer
./build-layer.sh
```

This will create a `dist/scientific-layer.zip` file that can be deployed as a Lambda layer.

### Deploying with CDK

The visualization service is deployed as part of the AWS CDK infrastructure in the `visualization-stack.ts` file.

## API Usage

### List Variables

Request:
```json
{
  "sourceBucket": "your-results-bucket",
  "sourceKey": "user123/results/sim456/OutputDir/GEOSChem.SpeciesConc.20220101_0000z.nc4"
}
```

Response:
```json
{
  "message": "Variables listed successfully",
  "filename": "GEOSChem.SpeciesConc.20220101_0000z.nc4",
  "variables": [
    {
      "name": "SpeciesConc_O3",
      "dims": ["time", "lev", "lat", "lon"],
      "shape": [1, 47, 46, 72],
      "dtype": "float32",
      "units": "mol mol-1 dry",
      "long_name": "Ozone concentration",
      "species": "O3",
      "type": "concentration"
    },
    ...
  ],
  "dimensions": {
    "time": {"size": 1, "start": "2022-01-01T00:00:00Z", "end": "2022-01-01T00:00:00Z"},
    "lev": {"size": 47, "min": 0.0, "max": 1.0},
    "lat": {"size": 46, "min": -90.0, "max": 90.0},
    "lon": {"size": 72, "min": -180.0, "max": 180.0}
  }
}
```

### Generate Visualization

Request:
```json
{
  "sourceBucket": "your-results-bucket",
  "sourceKey": "user123/results/sim456/OutputDir/GEOSChem.SpeciesConc.20220101_0000z.nc4",
  "outputBucket": "your-visualization-bucket",
  "outputPrefix": "visualizations/user123/",
  "variableName": "SpeciesConc_O3",
  "visualizationType": "global_map",
  "level": 0,
  "timeIndex": 0
}
```

Response:
```json
{
  "message": "Visualization generated successfully",
  "visualizationUrl": "https://your-visualization-bucket.s3.amazonaws.com/visualizations/user123/global_map_SpeciesConc_O3_20230415123456_abcd1234.png?...",
  "bucket": "your-visualization-bucket",
  "key": "visualizations/user123/global_map_SpeciesConc_O3_20230415123456_abcd1234.png",
  "variableName": "SpeciesConc_O3",
  "visualizationType": "global_map"
}
```

### Generate Summary

Request:
```json
{
  "bucket": "your-results-bucket",
  "prefix": "user123/results/sim456/",
  "userId": "user123",
  "simulationId": "sim456"
}
```

Response:
```json
{
  "message": "Summary generated successfully",
  "bucket": "your-results-bucket",
  "summaryKey": "user123/results/sim456/summary.json",
  "summary": {
    "simulationId": "sim456",
    "userId": "user123",
    "bucket": "your-results-bucket",
    "prefix": "user123/results/sim456/",
    "generatedAt": "2023-04-15T12:34:56.789Z",
    "metrics": {
      "wall_time": 5.67,
      "throughput_days_per_day": 42.3,
      "total_files": 24,
      "total_size_bytes": 1234567890,
      "total_size_human": "1.23 GB"
    },
    ...
  }
}
```

## Visualization Types

The service supports the following visualization types:

1. **global_map**: 2D global distribution of a variable at a specific level and time
2. **zonal_mean**: Latitude-height cross-section showing zonal mean values
3. **time_series**: Time series of a variable at a specific location or global mean