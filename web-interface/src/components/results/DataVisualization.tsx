import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Button,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  SelectChangeEvent
} from '@mui/material';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { SimulationResults } from '../../types/simulation';
import { getVisualizationData } from '../../services/simulationService';
import SpatialVisualization from './SpatialVisualization';
import StatisticalAnalysis from './StatisticalAnalysis';

interface DataVisualizationProps {
  simulationId: string;
  results: SimulationResults | null;
}

interface DataSet {
  id: string;
  name: string;
  description: string;
  type: 'timeseries' | 'profile' | 'scatter' | 'bar' | 'spatial';
  variables: string[];
}

interface VisualizationData {
  data: any[];
  metadata: {
    title: string;
    xAxisLabel: string;
    yAxisLabel: string;
    zAxisLabel?: string;
  };
}

const DataVisualization: React.FC<DataVisualizationProps> = ({ simulationId, results }) => {
  const [availableDatasets, setAvailableDatasets] = useState<DataSet[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [visualizationData, setVisualizationData] = useState<VisualizationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<number>(0);

  // Scan results for potential visualization datasets
  useEffect(() => {
    if (!results || !results.files) return;

    // Look for NetCDF, CSV files and standard GEOS-Chem output files that might be visualizable
    const potentialDatasets: DataSet[] = [];

    const scanDirectory = (files: any[], basePath: string = '') => {
      files.forEach(file => {
        if (file.type === 'file') {
          const ext = file.name.split('.').pop()?.toLowerCase();
          const fullPath = basePath ? `${basePath}/${file.name}` : file.name;

          if (ext === 'nc' || ext === 'nc4') {
            // Classify NetCDF files more granularly based on file name patterns
            let datasetType: 'timeseries' | 'profile' | 'scatter' | 'bar' = 'timeseries';
            let description = 'NetCDF dataset';

            // Classify based on GEOS-Chem naming conventions
            if (file.name.includes('SpeciesConc') || file.name.includes('concentration')) {
              description = 'Species concentrations';
            } else if (file.name.includes('StateMet') || file.name.includes('Met')) {
              description = 'Meteorological data';
            } else if (file.name.includes('Emissions') || file.name.includes('Emis')) {
              description = 'Emissions data';
            } else if (file.name.includes('Deposition') || file.name.includes('Dep')) {
              description = 'Deposition data';
            } else if (file.name.includes('Aerosol')) {
              description = 'Aerosol data';
            } else if (file.name.includes('Budget') || file.name.includes('Mass')) {
              description = 'Budget data';
            } else if (file.name.includes('JValues')) {
              description = 'Photolysis rates';
            }

            // Determine the type based on naming pattern or default
            if (file.name.includes('ts_') || file.name.includes('timeseries')) {
              datasetType = 'timeseries';
            } else if (file.name.includes('profile') || file.name.includes('vertical')) {
              datasetType = 'profile';
            } else if (file.name.includes('daily') || file.name.includes('monthly')) {
              datasetType = 'timeseries';
            } else if (file.name.includes('spatial') ||
                       file.name.includes('map') ||
                       file.name.includes('global') ||
                       file.name.includes('grid')) {
              datasetType = 'spatial';
            }

            potentialDatasets.push({
              id: fullPath,
              name: file.name,
              description,
              type: datasetType,
              variables: ['Loading...'] // Placeholder until we load the actual variables
            });
          } else if (ext === 'csv') {
            potentialDatasets.push({
              id: fullPath,
              name: file.name,
              description: 'CSV dataset',
              type: 'timeseries', // Default assumption
              variables: ['Loading...']
            });
          } else if (file.name.includes('timeseries') || file.name.includes('ts_')) {
            potentialDatasets.push({
              id: fullPath,
              name: file.name,
              description: 'Time series data',
              type: 'timeseries',
              variables: ['Loading...']
            });
          } else if (file.name.includes('profile') || file.name.includes('vertical')) {
            potentialDatasets.push({
              id: fullPath,
              name: file.name,
              description: 'Vertical profile data',
              type: 'profile',
              variables: ['Loading...']
            });
          } else if (file.name.includes('budget') || file.name.includes('diag')) {
            potentialDatasets.push({
              id: fullPath,
              name: file.name,
              description: 'Diagnostic data',
              type: 'bar',
              variables: ['Loading...']
            });
          }
        } else if (file.type === 'directory' && file.children) {
          // Recursively scan subdirectories
          const newBasePath = basePath ? `${basePath}/${file.name}` : file.name;
          scanDirectory(file.children, newBasePath);
        }
      });
    };

    scanDirectory(results.files);
    
    // Add some example datasets for demo purposes if none found
    if (potentialDatasets.length === 0) {
      potentialDatasets.push({
        id: 'example-timeseries',
        name: 'Example Time Series',
        description: 'Example time series data for demonstration',
        type: 'timeseries',
        variables: ['O3', 'CO', 'NO2', 'PM25']
      });
      
      potentialDatasets.push({
        id: 'example-profile',
        name: 'Example Vertical Profile',
        description: 'Example vertical profile data for demonstration',
        type: 'profile',
        variables: ['Temperature', 'Pressure', 'Humidity', 'O3']
      });
      
      potentialDatasets.push({
        id: 'example-scatter',
        name: 'Example Scatter Plot',
        description: 'Example scatter plot data for demonstration',
        type: 'scatter',
        variables: ['NO vs O3', 'Temperature vs Concentration']
      });
    }
    
    setAvailableDatasets(potentialDatasets);
  }, [results]);

  // Load variables when dataset is selected
  useEffect(() => {
    if (!selectedDataset) return;
    
    const loadDatasetVariables = async () => {
      try {
        setLoading(true);
        
        // For real implementation, we would fetch the actual variables from the dataset
        // For now, we'll use placeholder data or example data
        
        // Check if we're using an example dataset
        if (selectedDataset.startsWith('example-')) {
          const dataset = availableDatasets.find(ds => ds.id === selectedDataset);
          if (dataset) {
            // We already have the variables for example datasets
            // Reset visualization when changing datasets
            setVisualizationData(null);
            setSelectedVariables([]);
          }
        } else {
          // In a real implementation, we would fetch the variables from the file
          // For now, we'll use some placeholder variables based on the file type
          const dataset = availableDatasets.find(ds => ds.id === selectedDataset);
          
          if (dataset) {
            let updatedDataset = { ...dataset };
            
            if (dataset.id.endsWith('.nc') || dataset.id.endsWith('.nc4')) {
              updatedDataset.variables = ['Temperature', 'Pressure', 'Humidity', 'O3', 'CO', 'NO2'];
            } else if (dataset.id.endsWith('.csv')) {
              updatedDataset.variables = ['Time', 'Value1', 'Value2', 'Value3'];
            } else if (dataset.type === 'timeseries') {
              updatedDataset.variables = ['O3', 'CO', 'NO2', 'PM25'];
            } else if (dataset.type === 'profile') {
              updatedDataset.variables = ['Temperature', 'Pressure', 'Humidity', 'O3'];
            }
            
            // Update the dataset in the list
            const updatedDatasets = availableDatasets.map(ds => 
              ds.id === selectedDataset ? updatedDataset : ds
            );
            
            setAvailableDatasets(updatedDatasets);
            setVisualizationData(null);
            setSelectedVariables([]);
          }
        }
      } catch (err) {
        setError(`Failed to load dataset variables: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadDatasetVariables();
  }, [selectedDataset]);

  // Generate visualization when variables are selected
  const generateVisualization = async () => {
    if (!selectedDataset || selectedVariables.length === 0) {
      setError('Please select a dataset and at least one variable');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // In a real implementation, we would fetch the actual data
      // For now, we'll generate some example data
      
      // For real data, we would use:
      // const data = await getVisualizationData(simulationId, selectedDataset, selectedVariables);
      
      let data: any[] = [];
      let metadata = {
        title: 'Visualization',
        xAxisLabel: 'X',
        yAxisLabel: 'Y',
        zAxisLabel: undefined as string | undefined
      };
      
      const dataset = availableDatasets.find(ds => ds.id === selectedDataset);
      
      if (dataset) {
        switch (dataset.type) {
          case 'timeseries':
            // Generate time series data
            data = Array.from({ length: 24 }, (_, i) => {
              const entry: any = { time: `${i}:00` };
              selectedVariables.forEach(variable => {
                // Generate some random but somewhat realistic data for each variable
                const baseValue = variable === 'O3' ? 40 : 
                                 variable === 'CO' ? 200 : 
                                 variable === 'NO2' ? 15 : 10;
                const amplitude = baseValue * 0.3;
                const phase = Math.random() * Math.PI * 2;
                
                // Create a value with a diurnal cycle plus some noise
                const value = baseValue + 
                  amplitude * Math.sin((i / 24) * Math.PI * 2 + phase) + 
                  (Math.random() - 0.5) * amplitude * 0.5;
                
                entry[variable] = Math.max(0, value.toFixed(2));
              });
              return entry;
            });
            
            metadata = {
              title: 'Time Series Visualization',
              xAxisLabel: 'Time',
              yAxisLabel: 'Concentration (ppb)',
              zAxisLabel: undefined
            };
            break;
            
          case 'profile':
            // Generate vertical profile data
            data = Array.from({ length: 20 }, (_, i) => {
              const altitude = i * 500; // meters
              const entry: any = { altitude };
              
              selectedVariables.forEach(variable => {
                let value;
                if (variable === 'Temperature') {
                  // Temperature decreases with height in troposphere (lapse rate)
                  value = 25 - (altitude / 100) - (Math.random() * 2);
                } else if (variable === 'Pressure') {
                  // Pressure decreases exponentially with height
                  value = 1013 * Math.exp(-altitude / 8000);
                } else if (variable === 'Humidity') {
                  // Humidity generally decreases with height
                  value = Math.max(0, 80 - (altitude / 100) + (Math.random() * 10));
                } else {
                  // Other variables might have different profiles
                  const baseValue = 50;
                  value = baseValue * Math.exp(-altitude / 5000) + (Math.random() * 5);
                }
                
                entry[variable] = parseFloat(value.toFixed(2));
              });
              
              return entry;
            });
            
            metadata = {
              title: 'Vertical Profile',
              xAxisLabel: selectedVariables[0] || '',
              yAxisLabel: 'Altitude (m)',
              zAxisLabel: undefined
            };
            break;
            
          case 'scatter':
            // Generate scatter plot data
            if (selectedVariables.length >= 1) {
              const varParts = selectedVariables[0].split(' vs ');
              const xVar = varParts[0] || 'X';
              const yVar = varParts.length > 1 ? varParts[1] : 'Y';
              
              data = Array.from({ length: 50 }, () => {
                const x = Math.random() * 100;
                // Create a correlation with some noise
                const y = x * 0.7 + (Math.random() * 30);
                return { 
                  [xVar]: parseFloat(x.toFixed(2)), 
                  [yVar]: parseFloat(y.toFixed(2)),
                  z: Math.random() * 10 // For bubble size in scatter plots
                };
              });
              
              metadata = {
                title: 'Scatter Plot',
                xAxisLabel: xVar,
                yAxisLabel: yVar,
                zAxisLabel: 'Size'
              };
            }
            break;
            
          default:
            // Default to a simple dataset
            data = Array.from({ length: 10 }, (_, i) => {
              const entry: any = { category: `Category ${i+1}` };
              selectedVariables.forEach(variable => {
                entry[variable] = Math.round(Math.random() * 100);
              });
              return entry;
            });
            
            metadata = {
              title: 'Data Visualization',
              xAxisLabel: 'Category',
              yAxisLabel: 'Value',
              zAxisLabel: undefined
            };
        }
      }
      
      setVisualizationData({ data, metadata });
    } catch (err) {
      setError(`Failed to generate visualization: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDatasetChange = (event: SelectChangeEvent<string>) => {
    setSelectedDataset(event.target.value);
  };

  const handleVariableChange = (event: SelectChangeEvent<string[]>) => {
    setSelectedVariables(
      typeof event.target.value === 'string' 
        ? event.target.value.split(',') 
        : event.target.value
    );
  };

  const handleChartTypeChange = (event: React.SyntheticEvent, newValue: number) => {
    setChartType(newValue);
  };

  // Get available variables for the selected dataset
  const getAvailableVariables = () => {
    const dataset = availableDatasets.find(ds => ds.id === selectedDataset);
    return dataset ? dataset.variables : [];
  };

  // Render chart based on dataset type and selected chart type
  const renderChart = () => {
    if (!visualizationData || !visualizationData.data.length) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No data to display. Select a dataset and variables, then click Generate Visualization.
          </Typography>
        </Box>
      );
    }

    const { data, metadata } = visualizationData;
    const dataset = availableDatasets.find(ds => ds.id === selectedDataset);

    // Determine which chart type to use
    if (chartType === 5) {  // Statistical Analysis
      // Create data structure for StatisticalAnalysis component
      const variableNames = selectedVariables;
      const values: Record<string, number[]> = {};

      // Extract values for each selected variable
      selectedVariables.forEach(variable => {
        values[variable] = data.map(item =>
          typeof item[variable] === 'number' ? item[variable] : NaN
        );
      });

      // Extract x-axis data (usually time)
      const xAxis = data.map(item =>
        item.time || item.x || ''
      );

      // Extract units from metadata
      const units: Record<string, string> = {};
      selectedVariables.forEach(variable => {
        units[variable] = metadata.yAxisLabel || '';
      });

      return (
        <StatisticalAnalysis
          data={{
            variableNames,
            values,
            xAxis,
            units,
            description: metadata.title || undefined
          }}
          title={`Statistical Analysis: ${selectedVariables.join(', ')}`}
        />
      );
    }

    if (dataset?.type === 'spatial' || chartType === 4) {
      // Spatial visualization with map
      // For this example, we'll create sample spatial data from the first variable

      // Extract the variable name
      const variable = selectedVariables[0] || 'Unknown';

      // In a real implementation, this would be actual latitude, longitude, and data values
      // Here we're generating a sample grid for demonstration

      // Create a grid of longitudes and latitudes
      const longitude = Array.from({ length: 72 }, (_, i) => -180 + i * 5);
      const latitude = Array.from({ length: 46 }, (_, i) => -90 + i * 4);

      // Generate sample data values
      const values = latitude.map((lat) => {
        return longitude.map((lon) => {
          // Create a simple pattern based on latitude and longitude
          // In a real implementation, this would be the actual data values
          return 50 + 25 * Math.sin(lat / 10) * Math.cos(lon / 10);
        });
      });

      // Create the spatial data object
      const spatialData = {
        longitude,
        latitude,
        values,
        variable,
        units: metadata.yAxisLabel || 'units',
        level: 1,
        time: data.length > 0 && data[0].time ? data[0].time : undefined
      };

      return (
        <SpatialVisualization
          data={spatialData}
          title={metadata.title || 'Spatial Visualization'}
          description={`Geographic distribution of ${variable}`}
        />
      );
    } else if (dataset?.type === 'timeseries' || chartType === 0) {
      // Line chart for time series
      return (
        <Box sx={{ width: '100%', height: 400 }}>
          <Typography variant="h6" align="center" gutterBottom>
            {metadata.title}
          </Typography>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" label={{ value: metadata.xAxisLabel, position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: metadata.yAxisLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {selectedVariables.map((variable, index) => (
                <Line
                  key={variable}
                  type="monotone"
                  dataKey={variable}
                  stroke={`hsl(${index * 60}, 70%, 50%)`}
                  activeDot={{ r: 8 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      );
    } else if (dataset?.type === 'profile' || chartType === 1) {
      // Line chart for profiles (with x and y swapped for vertical profiles)
      return (
        <Box sx={{ width: '100%', height: 400 }}>
          <Typography variant="h6" align="center" gutterBottom>
            {metadata.title}
          </Typography>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                dataKey="altitude"
                type="number"
                label={{ value: metadata.yAxisLabel, angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Legend />
              {selectedVariables.map((variable, index) => (
                <Line
                  key={variable}
                  type="monotone"
                  dataKey={variable}
                  stroke={`hsl(${index * 60}, 70%, 50%)`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      );
    } else if (dataset?.type === 'scatter' || chartType === 2) {
      // Scatter plot
      const varParts = selectedVariables[0]?.split(' vs ') || [];
      const xVar = varParts[0] || 'X';
      const yVar = varParts.length > 1 ? varParts[1] : 'Y';

      return (
        <Box sx={{ width: '100%', height: 400 }}>
          <Typography variant="h6" align="center" gutterBottom>
            {metadata.title}
          </Typography>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid />
              <XAxis
                type="number"
                dataKey={xVar}
                name={xVar}
                label={{ value: xVar, position: 'insideBottom', offset: -5 }}
              />
              <YAxis
                type="number"
                dataKey={yVar}
                name={yVar}
                label={{ value: yVar, angle: -90, position: 'insideLeft' }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                range={[20, 200]}
                name={metadata.zAxisLabel}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter name={`${xVar} vs ${yVar}`} data={data} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
        </Box>
      );
    } else if (chartType === 3) {
      // Bar chart as another option
      return (
        <Box sx={{ width: '100%', height: 400 }}>
          <Typography variant="h6" align="center" gutterBottom>
            {metadata.title}
          </Typography>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={dataset?.type === 'timeseries' ? 'time' : 'category'}
                label={{ value: metadata.xAxisLabel, position: 'insideBottom', offset: -5 }}
              />
              <YAxis label={{ value: metadata.yAxisLabel, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {selectedVariables.map((variable, index) => (
                <Bar
                  key={variable}
                  dataKey={variable}
                  fill={`hsl(${index * 60}, 70%, 50%)`}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      );
    }

    // Fallback if no suitable chart type is found
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No suitable visualization available for this data type.
        </Typography>
      </Box>
    );
  };

  if (availableDatasets.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No visualizable datasets found in the simulation results. Try running a simulation that generates NetCDF or CSV outputs.
      </Alert>
    );
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Data Visualization
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="dataset-select-label">Dataset</InputLabel>
              <Select
                labelId="dataset-select-label"
                id="dataset-select"
                value={selectedDataset}
                label="Dataset"
                onChange={handleDatasetChange}
              >
                {availableDatasets.map((dataset) => (
                  <MenuItem key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2 }} disabled={!selectedDataset || loading}>
              <InputLabel id="variables-select-label">Variables</InputLabel>
              <Select
                labelId="variables-select-label"
                id="variables-select"
                multiple
                value={selectedVariables}
                label="Variables"
                onChange={handleVariableChange}
              >
                {getAvailableVariables().map((variable) => (
                  <MenuItem key={variable} value={variable}>
                    {variable}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={generateVisualization}
              disabled={!selectedDataset || selectedVariables.length === 0 || loading}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate'}
            </Button>
          </Grid>
        </Grid>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
      
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={chartType}
            onChange={handleChartTypeChange}
            aria-label="chart type tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label="Line Chart" id="chart-tab-0" aria-controls="chart-panel-0" />
            <Tab label="Profile" id="chart-tab-1" aria-controls="chart-panel-1" />
            <Tab label="Scatter" id="chart-tab-2" aria-controls="chart-panel-2" />
            <Tab label="Bar Chart" id="chart-tab-3" aria-controls="chart-panel-3" />
            <Tab label="Spatial Map" id="chart-tab-4" aria-controls="chart-panel-4" />
            <Tab label="Statistical Analysis" id="chart-tab-5" aria-controls="chart-panel-5" />
          </Tabs>
        </Box>
        
        {renderChart()}
      </Paper>
    </Box>
  );
};

export default DataVisualization;