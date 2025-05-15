# GEOS-Chem AWS Cloud Runner Visualization Components

This document provides detailed information about the visualization components available in the GEOS-Chem AWS Cloud Runner web interface. These components enable researchers to visualize and analyze GEOS-Chem atmospheric chemistry model outputs in the cloud.

## Table of Contents

- [Overview](#overview)
- [NetCDF Viewer](#netcdf-viewer)
- [BPCH Viewer](#bpch-viewer)
- [Spatial Visualization](#spatial-visualization)
- [Statistical Analysis](#statistical-analysis)
- [Time Series Comparison](#time-series-comparison)
- [Simulation Comparisons](#simulation-comparisons)
- [Data Export](#data-export)
- [Development Guide](#development-guide)
- [Performance Considerations](#performance-considerations)

## Overview

The GEOS-Chem AWS Cloud Runner includes several specialized visualization components designed for atmospheric chemistry model outputs:

- **NetCDFViewer**: Specialized viewer for NetCDF files with metadata browsing and visualization options
- **BpchViewer**: Specialized viewer for GEOS-Chem Binary Punch (BPCH) file format
- **SpatialVisualization**: Component for visualizing spatial data on maps
- **StatisticalAnalysis**: Tools for statistical analysis of simulation outputs
- **TimeSeriesComparison**: Component for comparing time series across multiple simulations
- **SimulationComparisons**: Page for comparing multiple simulation results

These components are integrated with the Redux state management system to provide a seamless user experience for analyzing GEOS-Chem outputs in the browser.

## NetCDF Viewer

The NetCDFViewer component provides specialized handling for NetCDF (Network Common Data Form) files, which are commonly used in GEOS-Chem and other scientific applications.

### Features

- **Metadata Browser**: Explore dimensions, variables, and attributes within NetCDF files
- **Variable Selection**: Select variables for visualization
- **Dimension Slicing**: Specify slices along different dimensions
- **Visualization Options**: View data as line charts, heatmaps, or spatial plots

### Usage

```jsx
import { NetCDFViewer } from '../components/results/NetCDFViewer';

<NetCDFViewer 
  simulationId="sim-123" 
  filePath="/path/to/file.nc" 
/>
```

### Redux Integration

The NetCDFViewer uses the following Redux actions and selectors:

- `fetchNetCDFMetadata`: Fetch metadata for a NetCDF file
- `fetchNetCDFData`: Fetch actual data for a selected variable and dimensions
- `selectNetCDFMetadata`: Select metadata for a specific file from the Redux store

## BPCH Viewer

The BpchViewer component provides specialized handling for GEOS-Chem's legacy Binary Punch (BPCH) file format.

### Features

- **Diagnostic Selection**: Choose from available diagnostics in the file
- **Tracer Selection**: Select specific tracers to visualize
- **Level Selection**: Choose vertical levels for visualization
- **Time Steps**: Navigate through available time steps

### Usage

```jsx
import { BpchViewer } from '../components/results/BpchViewer';

<BpchViewer 
  simulationId="sim-123" 
  filePath="/path/to/file.bpch" 
/>
```

## Spatial Visualization

The SpatialVisualization component provides interactive visualization of spatial data on maps, including:

### Features

- **Map Display**: View geospatial data on a map projection
- **Color Scales**: Customize color scales and ranges
- **Zoom/Pan**: Interactive zoom and pan controls
- **Grid Lines**: Toggle latitude/longitude grid lines
- **Data Range Control**: Adjust data range for visualization

### Usage

```jsx
import { SpatialVisualization } from '../components/results/SpatialVisualization';

<SpatialVisualization 
  data={spatialData}
  title="Ozone at Surface Level"
  description="Surface ozone concentration in ppb"
/>
```

The `data` object should have the following structure:

```js
{
  lats: number[],  // Latitude values
  lons: number[],  // Longitude values
  values: number[][], // 2D array of values (lat x lon)
  units: string,   // Units for the values
  variable: string // Variable name
}
```

## Statistical Analysis

The StatisticalAnalysis component provides tools for analyzing simulation outputs with statistical methods.

### Features

- **Summary Statistics**: View mean, median, standard deviation, min, max, etc.
- **Histograms**: Visualize data distribution with customizable bins
- **Correlation Analysis**: Compare relationships between variables
- **Time Series Analysis**: Analyze trends and patterns over time

### Usage

```jsx
import { StatisticalAnalysis } from '../components/results/StatisticalAnalysis';

<StatisticalAnalysis 
  data={simulationData}
  title="Statistical Analysis of Simulation Outputs"
/>
```

The `data` object should have variables and their values for analysis.

## Time Series Comparison

The TimeSeriesComparison component allows users to compare how variables change over time across different simulations.

### Features

- **Multi-Simulation Selection**: Select multiple simulations to compare
- **Variable Selection**: Choose variables to compare across simulations
- **Normalization Options**: View absolute values or normalized to a reference
- **Difference Display**: Show differences between simulations
- **Statistical Comparisons**: View correlation, RMSE, and MBE between simulations
- **Export**: Export comparison data to CSV

### Usage

```jsx
import { TimeSeriesComparison } from '../components/results/TimeSeriesComparison';

<TimeSeriesComparison 
  initialSimulationIds={["sim-123", "sim-456"]} 
/>
```

### Metrics

The TimeSeriesComparison component calculates several statistical metrics:

- **Correlation Coefficient (R)**: Measures the linear relationship between two time series
- **Root Mean Square Error (RMSE)**: Measures the average magnitude of errors
- **Mean Bias Error (MBE)**: Measures the average difference between simulations

## Simulation Comparisons

The SimulationComparisons page serves as a container for various comparison features.

### Features

- **Time Series Comparison**: Compare variables over time across simulations
- **Spatial Comparison**: Compare spatial distributions of variables
- **Multiple Visualization Modes**: Switch between different comparison methods

### Usage

Navigate to the SimulationComparisons page through the application's routing system:

```jsx
import { SimulationComparisons } from '../pages/SimulationComparisons';

// In your Router
<Route path="/comparisons/:simulationIds?" component={SimulationComparisons} />
```

## Data Export

Several components support data export functionality:

- **CSV Export**: Export time series data to CSV format
- **Image Download**: Download visualization images
- **Metadata Export**: Export NetCDF metadata

## Development Guide

### Adding New Visualization Types

To add a new visualization type:

1. Create a new component in the `components/results` directory
2. Update the Redux store in `store/slices/resultsSlice.ts` to handle any new data requirements
3. Integrate the component with the FileViewer or appropriate parent component
4. Add any necessary API endpoints in the backend

### Redux Store Structure

The visualization components rely on the Redux store, particularly the `results` slice:

```ts
interface ResultsState {
  currentSimulationId: string | null;
  files: FileItem[];
  currentPath: string;
  visualizations: Visualization[];
  selectedFile: FileItem | null;
  netcdfMetadata: Record<string, NetCDFMetadata>;
  selectedVariables: string[];
  spatialVisualizations: Record<string, SpatialVisualizationResult>;
  spatialDifferences: Record<string, SpatialDifferenceResult>;
  loading: boolean;
  error: string | null;
  generatingVisualization: boolean;
}
```

## Performance Considerations

When working with large datasets, consider the following performance optimizations:

1. **Chunked Loading**: Load data in chunks for large NetCDF files
2. **Canvas Rendering**: Use canvas for rendering large spatial datasets
3. **Downsampling**: Implement downsampling for very large time series
4. **Web Workers**: Consider using web workers for heavy calculations
5. **Memoization**: Use React's memoization patterns for expensive operations

For visualization of large datasets, consider implementing:

1. Progressive loading of visualization data
2. Level-of-detail rendering for maps
3. Client-side caching of previously visualized data

## Testing

To ensure the visualization components work correctly:

1. Test with real GEOS-Chem output files of various sizes
2. Verify rendering across different browsers
3. Test edge cases like missing data, extreme values, etc.
4. Validate statistical calculations against known results