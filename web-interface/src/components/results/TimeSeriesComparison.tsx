import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  TextField,
  Chip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  SelectChangeEvent
} from '@mui/material';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  ReferenceArea,
  ReferenceLine
} from 'recharts';

import {
  GetApp as DownloadIcon,
  Info as InfoIcon,
  RemoveCircleOutline as RemoveIcon,
  Add as AddIcon,
  Colorize as ColorizeIcon,
  Timeline as TimelineIcon,
  Difference as DifferenceIcon,
  FilterAlt as FilterIcon
} from '@mui/icons-material';

import { RootState } from '../../store';
import { fetchSimulations } from '../../store/slices/simulationsSlice';
import { 
  fetchSimulationResults, 
  fetchResultFiles
} from '../../store/slices/resultsSlice';

// Statistical functions from StatisticalAnalysis (could be moved to a shared utility)
const calculateStats = (values: number[]) => {
  if (!values || values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, count: 0, sum: 0 };
  }
  
  const filteredValues = values.filter(v => !isNaN(v) && v !== null && v !== undefined);
  
  if (filteredValues.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, count: 0, sum: 0 };
  }
  
  // Sort for median and percentiles
  const sortedValues = [...filteredValues].sort((a, b) => a - b);
  
  // Basic statistics
  const count = filteredValues.length;
  const sum = filteredValues.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const min = sortedValues[0];
  const max = sortedValues[count - 1];
  
  // Median
  const midIndex = Math.floor(count / 2);
  const median = count % 2 === 0 
    ? (sortedValues[midIndex - 1] + sortedValues[midIndex]) / 2 
    : sortedValues[midIndex];
  
  // Standard deviation
  const squaredDiffs = filteredValues.map(value => Math.pow(value - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / count;
  const stdDev = Math.sqrt(variance);
  
  return { mean, median, stdDev, min, max, count, sum };
};

// Root mean square error
const calculateRMSE = (values1: number[], values2: number[]) => {
  if (!values1 || !values2 || values1.length === 0 || values2.length === 0) {
    return NaN;
  }
  
  // Get pairs of values that are both valid
  const validPairs = values1.map((v1, i) => [v1, values2[i]])
    .filter(([v1, v2]) => 
      !isNaN(v1) && !isNaN(v2) && 
      v1 !== null && v2 !== null && 
      v1 !== undefined && v2 !== undefined
    );
  
  if (validPairs.length === 0) {
    return NaN;
  }
  
  // Calculate RMSE
  const squaredDiffs = validPairs.map(([v1, v2]) => Math.pow(v1 - v2, 2));
  const meanSquaredError = squaredDiffs.reduce((sum, val) => sum + val, 0) / validPairs.length;
  
  return Math.sqrt(meanSquaredError);
};

// Calculate Mean Bias Error
const calculateMBE = (values1: number[], values2: number[]) => {
  if (!values1 || !values2 || values1.length === 0 || values2.length === 0) {
    return NaN;
  }
  
  // Get pairs of values that are both valid
  const validPairs = values1.map((v1, i) => [v1, values2[i]])
    .filter(([v1, v2]) => 
      !isNaN(v1) && !isNaN(v2) && 
      v1 !== null && v2 !== null && 
      v1 !== undefined && v2 !== undefined
    );
  
  if (validPairs.length === 0) {
    return NaN;
  }
  
  // Calculate MBE
  const diffs = validPairs.map(([v1, v2]) => v1 - v2);
  const meanBiasError = diffs.reduce((sum, val) => sum + val, 0) / validPairs.length;
  
  return meanBiasError;
};

// Calculate correlation coefficient
const calculateCorrelation = (x: number[], y: number[]) => {
  if (!x || !y || x.length === 0 || y.length === 0 || x.length !== y.length) {
    return 0;
  }
  
  const validPairs = x.map((val, idx) => [val, y[idx]])
    .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]) && 
            pair[0] !== null && pair[1] !== null && 
            pair[0] !== undefined && pair[1] !== undefined);
  
  if (validPairs.length === 0) return 0;
  
  const xValues = validPairs.map(pair => pair[0]);
  const yValues = validPairs.map(pair => pair[1]);
  
  const xMean = xValues.reduce((sum, val) => sum + val, 0) / xValues.length;
  const yMean = yValues.reduce((sum, val) => sum + val, 0) / yValues.length;
  
  const xDiffs = xValues.map(val => val - xMean);
  const yDiffs = yValues.map(val => val - yMean);
  
  const numerator = xDiffs.reduce((sum, xDiff, i) => sum + xDiff * yDiffs[i], 0);
  
  const xSquaredDiffs = xDiffs.map(diff => Math.pow(diff, 2));
  const ySquaredDiffs = yDiffs.map(diff => Math.pow(diff, 2));
  
  const xSumSquares = xSquaredDiffs.reduce((sum, val) => sum + val, 0);
  const ySumSquares = ySquaredDiffs.reduce((sum, val) => sum + val, 0);
  
  if (xSumSquares === 0 || ySumSquares === 0) return 0;
  
  const denominator = Math.sqrt(xSumSquares * ySumSquares);
  
  return numerator / denominator;
};

// Interface for a simulation time series
interface TimeSeries {
  simulationId: string;
  simulationName: string;
  variable: string;
  units: string;
  times: string[];
  values: number[];
  color: string;
  visible: boolean;
}

// Interface for the component props
interface TimeSeriesComparisonProps {
  initialSimulationIds?: string[];
}

// Array of colors to use for different simulations
const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ff7300', '#0088FE', '#00C49F', 
  '#FFBB28', '#FF8042', '#a4de6c', '#d0ed57', '#83a6ed'
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`comparison-tabpanel-${index}`}
      aria-labelledby={`comparison-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const TimeSeriesComparison: React.FC<TimeSeriesComparisonProps> = ({ 
  initialSimulationIds = [] 
}) => {
  const dispatch = useDispatch();
  const [tabValue, setTabValue] = useState(0);
  const [selectedSimulations, setSelectedSimulations] = useState<string[]>(initialSimulationIds);
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<string>('');
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeries[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [normalizeData, setNormalizeData] = useState<boolean>(false);
  const [showDifference, setShowDifference] = useState<boolean>(false);
  const [referenceSimulation, setReferenceSimulation] = useState<string>('');
  const [statisticsData, setStatisticsData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get the list of simulations from Redux
  const { simulations, loading: simulationsLoading } = useSelector((state: RootState) => state.simulations);
  const { files, loading: resultsLoading } = useSelector((state: RootState) => state.results);
  
  // Fetch simulations when component mounts
  useEffect(() => {
    dispatch(fetchSimulations() as any);
  }, [dispatch]);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Handle simulation selection
  const handleSimulationToggle = (simulationId: string) => {
    if (selectedSimulations.includes(simulationId)) {
      // Remove simulation if already selected
      const updatedSimulations = selectedSimulations.filter(id => id !== simulationId);
      setSelectedSimulations(updatedSimulations);
      
      // If this was the reference simulation, reset the reference
      if (referenceSimulation === simulationId) {
        setReferenceSimulation(updatedSimulations.length > 0 ? updatedSimulations[0] : '');
      }
      
      // Update time series data
      setTimeSeriesData(prevData => prevData.filter(ts => ts.simulationId !== simulationId));
    } else {
      // Add simulation
      const updatedSimulations = [...selectedSimulations, simulationId];
      setSelectedSimulations(updatedSimulations);
      
      // If this is the first simulation, set it as reference
      if (updatedSimulations.length === 1) {
        setReferenceSimulation(simulationId);
      }
    }
  };
  
  // Set reference simulation for comparison
  const handleSetReference = (simulationId: string) => {
    setReferenceSimulation(simulationId);
  };
  
  // Handle variable selection
  const handleVariableChange = (event: SelectChangeEvent<string>) => {
    setSelectedVariable(event.target.value);
  };
  
  // Fetch all available variables for selected simulations
  useEffect(() => {
    const fetchVariables = async () => {
      if (selectedSimulations.length === 0) {
        setAvailableVariables([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // In a real implementation, this would fetch the available variables
        // from each of the selected simulations' output files
        
        // For now, we'll use a mock list of variables
        const mockVariables = [
          'SpeciesConc_O3',
          'SpeciesConc_NO',
          'SpeciesConc_NO2',
          'SpeciesConc_CO',
          'SpeciesConc_SO2',
          'Met_TEMP',
          'Met_PRES',
          'Met_RH',
          'Aerosol_OA',
          'Aerosol_BC'
        ];
        
        setAvailableVariables(mockVariables);
        
        // Set default variable if none selected
        if (!selectedVariable && mockVariables.length > 0) {
          setSelectedVariable(mockVariables[0]);
        }
      } catch (err) {
        setError(`Failed to fetch variables: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchVariables();
  }, [selectedSimulations]);
  
  // Fetch time series data for selected simulations and variable
  useEffect(() => {
    const fetchTimeSeriesData = async () => {
      if (selectedSimulations.length === 0 || !selectedVariable) {
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // This would normally fetch real data, but for now we're generating sample data
        const newTimeSeriesData: TimeSeries[] = [];
        
        for (let i = 0; i < selectedSimulations.length; i++) {
          const simulationId = selectedSimulations[i];
          const simulation = simulations.find(sim => sim.id === simulationId);
          
          if (!simulation) continue;
          
          // Generate sample data (in a real app, this would be fetched from the backend)
          const timeLength = 24; // 24 hours for example
          const times = Array.from({ length: timeLength }, (_, i) => `${i}:00`);
          
          // Create slightly different patterns for each simulation
          const baseValue = selectedVariable.includes('O3') ? 40 : 
                           selectedVariable.includes('NO2') ? 15 : 
                           selectedVariable.includes('CO') ? 200 : 
                           selectedVariable.includes('TEMP') ? 298 : 
                           selectedVariable.includes('PRES') ? 1013 : 
                           selectedVariable.includes('RH') ? 70 : 20;
          
          const amplitude = baseValue * 0.3;
          const frequency = 1 + (i * 0.2); // Different frequency for each simulation
          const phase = i * Math.PI / 6; // Different phase for each simulation
          const noise = baseValue * 0.05; // Small noise
          
          const values = times.map((_, j) => {
            const timeValue = j / timeLength;
            const sinValue = Math.sin(timeValue * Math.PI * 2 * frequency + phase);
            const noisyValue = baseValue + amplitude * sinValue + (Math.random() - 0.5) * noise;
            return Math.max(0, noisyValue);
          });
          
          // Determine the variable units
          const units = selectedVariable.includes('TEMP') ? 'K' : 
                      selectedVariable.includes('PRES') ? 'hPa' : 
                      selectedVariable.includes('RH') ? '%' : 
                      'ppb';
          
          // Add the time series
          newTimeSeriesData.push({
            simulationId,
            simulationName: simulation.name,
            variable: selectedVariable,
            units,
            times,
            values,
            color: CHART_COLORS[i % CHART_COLORS.length],
            visible: true
          });
        }
        
        setTimeSeriesData(newTimeSeriesData);
        
        // Update comparison data
        updateComparisonData(newTimeSeriesData, normalizeData, showDifference, referenceSimulation);
      } catch (err) {
        setError(`Failed to fetch time series data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTimeSeriesData();
  }, [selectedSimulations, selectedVariable, simulations]);
  
  // Update comparison data when settings change
  useEffect(() => {
    updateComparisonData(timeSeriesData, normalizeData, showDifference, referenceSimulation);
  }, [normalizeData, showDifference, referenceSimulation]);
  
  // Update comparison statistics when time series data changes
  useEffect(() => {
    updateStatistics(timeSeriesData, referenceSimulation);
  }, [timeSeriesData, referenceSimulation]);
  
  // Function to update comparison data with normalization and difference options
  const updateComparisonData = (
    data: TimeSeries[], 
    normalize: boolean, 
    difference: boolean,
    reference: string
  ) => {
    if (data.length === 0) {
      setComparisonData([]);
      return;
    }
    
    // Find the reference time series
    const referenceSeries = data.find(ts => ts.simulationId === reference);
    
    // If difference mode is enabled but no reference is selected, fall back to normal mode
    const useDifference = difference && referenceSeries;
    
    // Prepare data for the chart
    const chartData = data[0].times.map((time, timeIndex) => {
      const point: any = { time };
      
      if (useDifference) {
        // Reference value at this time point
        const referenceValue = referenceSeries!.values[timeIndex];
        
        // Add difference for each visible time series
        data.forEach(ts => {
          if (!ts.visible) return;
          
          if (ts.simulationId === reference) {
            // Reference series is always zero in difference mode
            point[ts.simulationName] = 0;
          } else {
            const originalValue = ts.values[timeIndex];
            
            // Calculate difference from reference
            let diffValue = originalValue - referenceValue;
            
            // Normalize if requested
            if (normalize && referenceValue !== 0) {
              diffValue = (diffValue / referenceValue) * 100; // as percentage
            }
            
            point[ts.simulationName] = diffValue;
          }
        });
      } else {
        // Normal mode - just add the values
        data.forEach(ts => {
          if (!ts.visible) return;
          
          let value = ts.values[timeIndex];
          
          // Normalize if requested
          if (normalize && referenceSeries) {
            const referenceValue = referenceSeries.values[timeIndex];
            if (referenceValue !== 0) {
              value = (value / referenceValue) * 100; // as percentage
            }
          }
          
          point[ts.simulationName] = value;
        });
      }
      
      return point;
    });
    
    setComparisonData(chartData);
  };
  
  // Function to update statistics
  const updateStatistics = (data: TimeSeries[], reference: string) => {
    if (data.length === 0) {
      setStatisticsData([]);
      return;
    }
    
    const referenceSeries = data.find(ts => ts.simulationId === reference);
    if (!referenceSeries) {
      setStatisticsData([]);
      return;
    }
    
    const stats = data.map(ts => {
      const seriesStats = calculateStats(ts.values);
      
      // For the reference series, correlation, RMSE, and MBE are not applicable
      if (ts.simulationId === reference) {
        return {
          simulationId: ts.simulationId,
          simulationName: ts.simulationName,
          mean: seriesStats.mean,
          median: seriesStats.median,
          stdDev: seriesStats.stdDev,
          min: seriesStats.min,
          max: seriesStats.max,
          correlation: 1,
          rmse: 0,
          mbe: 0
        };
      }
      
      // Calculate comparison statistics
      const correlation = calculateCorrelation(referenceSeries.values, ts.values);
      const rmse = calculateRMSE(ts.values, referenceSeries.values);
      const mbe = calculateMBE(ts.values, referenceSeries.values);
      
      return {
        simulationId: ts.simulationId,
        simulationName: ts.simulationName,
        mean: seriesStats.mean,
        median: seriesStats.median,
        stdDev: seriesStats.stdDev,
        min: seriesStats.min,
        max: seriesStats.max,
        correlation,
        rmse,
        mbe
      };
    });
    
    setStatisticsData(stats);
  };
  
  // Toggle a time series visibility
  const toggleTimeSeriesVisibility = (simulationId: string) => {
    const updatedData = timeSeriesData.map(ts => 
      ts.simulationId === simulationId ? { ...ts, visible: !ts.visible } : ts
    );
    
    setTimeSeriesData(updatedData);
    updateComparisonData(updatedData, normalizeData, showDifference, referenceSimulation);
  };
  
  // Toggle normalization
  const handleToggleNormalize = () => {
    setNormalizeData(!normalizeData);
  };
  
  // Toggle difference display
  const handleToggleDifference = () => {
    setShowDifference(!showDifference);
  };
  
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
  
  // Render timeseries comparison chart
  const renderTimeSeriesChart = () => {
    if (!selectedVariable || comparisonData.length === 0) {
      return (
        <Alert severity="info">
          Select simulations and a variable to compare time series.
        </Alert>
      );
    }
    
    // Get units and handle normalization
    const firstSeries = timeSeriesData[0];
    let unitString = firstSeries ? firstSeries.units : '';
    
    if (normalizeData && !showDifference) {
      unitString = '%';
    } else if (showDifference) {
      if (normalizeData) {
        unitString = '% difference';
      } else {
        unitString += ' difference';
      }
    }
    
    return (
      <Box>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={normalizeData}
                  onChange={handleToggleNormalize}
                  color="primary"
                />
              }
              label="Normalize"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={showDifference}
                  onChange={handleToggleDifference}
                  color="primary"
                />
              }
              label="Show Difference"
            />
          </Box>
          
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportToCSV}
          >
            Export to CSV
          </Button>
        </Box>
        
        <Box sx={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis 
                label={{ 
                  value: `${selectedVariable} ${unitString ? `(${unitString})` : ''}`, 
                  angle: -90, 
                  position: 'insideLeft' 
                }} 
              />
              <RechartsTooltip />
              <Legend />
              
              {/* If showing differences, add a reference line at y=0 */}
              {showDifference && (
                <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
              )}
              
              {timeSeriesData
                .filter(ts => ts.visible)
                .map(ts => (
                  <Line
                    key={ts.simulationId}
                    type="monotone"
                    dataKey={ts.simulationName}
                    stroke={ts.color}
                    dot={false}
                    activeDot={{ r: 8 }}
                    strokeWidth={ts.simulationId === referenceSimulation ? 3 : 1.5}
                  />
                ))
              }
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  };
  
  // Render correlation scatter plots
  const renderCorrelationPlots = () => {
    if (!selectedVariable || timeSeriesData.length < 2) {
      return (
        <Alert severity="info">
          Select at least two simulations to view correlation plots.
        </Alert>
      );
    }
    
    // Find reference simulation
    const referenceSeries = timeSeriesData.find(ts => ts.simulationId === referenceSimulation);
    if (!referenceSeries) {
      return (
        <Alert severity="warning">
          Please select a reference simulation.
        </Alert>
      );
    }
    
    // Create scatter data for all simulations against the reference
    const otherSeries = timeSeriesData.filter(ts => 
      ts.simulationId !== referenceSimulation && ts.visible
    );
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Correlation with Reference Simulation: {referenceSeries.simulationName}
        </Typography>
        
        <Grid container spacing={3}>
          {otherSeries.map(ts => {
            // Create scatter plot data
            const scatterData = referenceSeries.values.map((refValue, i) => {
              const tsValue = ts.values[i];
              
              return {
                x: refValue,
                y: tsValue,
                time: referenceSeries.times[i]
              };
            });
            
            // Calculate correlation and linear regression
            const correlation = calculateCorrelation(referenceSeries.values, ts.values);
            const slope = correlation * (calculateStats(ts.values).stdDev / calculateStats(referenceSeries.values).stdDev);
            const intercept = calculateStats(ts.values).mean - slope * calculateStats(referenceSeries.values).mean;
            
            // Create regression line data points
            const xMin = Math.min(...referenceSeries.values);
            const xMax = Math.max(...referenceSeries.values);
            
            const regressionLineData = [
              { x: xMin, y: slope * xMin + intercept },
              { x: xMax, y: slope * xMax + intercept }
            ];
            
            return (
              <Grid item xs={12} sm={6} key={ts.simulationId}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {ts.simulationName} vs {referenceSeries.simulationName}
                    </Typography>
                    
                    <Box sx={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            type="number" 
                            dataKey="x" 
                            name={referenceSeries.simulationName} 
                            label={{ 
                              value: `${referenceSeries.simulationName} (${referenceSeries.units})`, 
                              position: 'insideBottom', 
                              offset: -5 
                            }} 
                          />
                          <YAxis 
                            type="number" 
                            dataKey="y" 
                            name={ts.simulationName} 
                            label={{ 
                              value: `${ts.simulationName} (${ts.units})`, 
                              angle: -90, 
                              position: 'insideLeft' 
                            }} 
                          />
                          <RechartsTooltip 
                            formatter={(value: any, name: string) => [
                              parseFloat(value).toFixed(4), 
                              name === 'x' ? referenceSeries.simulationName : ts.simulationName
                            ]}
                            labelFormatter={(label) => 
                              typeof label === 'object' && label.time ? `Time: ${label.time}` : '' 
                            }
                          />
                          {/* 1:1 Line */}
                          <Line 
                            name="1:1 Line" 
                            data={[
                              { x: xMin, y: xMin },
                              { x: xMax, y: xMax }
                            ]} 
                            type="linear" 
                            dataKey="y" 
                            stroke="#888" 
                            dot={false} 
                            strokeDasharray="3 3" 
                          />
                          {/* Regression Line */}
                          <Line 
                            name="Regression Line" 
                            data={regressionLineData} 
                            type="linear" 
                            dataKey="y" 
                            stroke={ts.color} 
                            dot={false} 
                          />
                          <Scatter 
                            name="Data Points" 
                            data={scatterData} 
                            fill={ts.color} 
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </Box>
                    
                    <Box sx={{ mt: 2 }}>
                      <Chip 
                        label={`R = ${correlation.toFixed(4)}`} 
                        color={
                          Math.abs(correlation) > 0.7 ? 'success' : 
                          Math.abs(correlation) > 0.4 ? 'primary' : 
                          Math.abs(correlation) > 0.2 ? 'warning' : 
                          'error'
                        }
                        size="small"
                        sx={{ mr: 1 }}
                      />
                      
                      <Chip 
                        label={`y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`} 
                        color="default"
                        size="small"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };
  
  // Render statistics table
  const renderStatisticsTable = () => {
    if (!selectedVariable || statisticsData.length === 0) {
      return (
        <Alert severity="info">
          Select simulations and a variable to view statistics.
        </Alert>
      );
    }
    
    // Get units
    const units = timeSeriesData.length > 0 ? timeSeriesData[0].units : '';
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Statistical Comparison: {selectedVariable}
        </Typography>
        
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Simulation</TableCell>
                <TableCell align="right">Mean ({units})</TableCell>
                <TableCell align="right">Median ({units})</TableCell>
                <TableCell align="right">StdDev ({units})</TableCell>
                <TableCell align="right">Min ({units})</TableCell>
                <TableCell align="right">Max ({units})</TableCell>
                <TableCell align="right">R</TableCell>
                <TableCell align="right">RMSE ({units})</TableCell>
                <TableCell align="right">MBE ({units})</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {statisticsData.map(stats => (
                <TableRow 
                  key={stats.simulationId}
                  sx={{ 
                    bgcolor: stats.simulationId === referenceSimulation ? 'action.selected' : 'inherit',
                    fontWeight: stats.simulationId === referenceSimulation ? 'bold' : 'normal'
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {stats.simulationId === referenceSimulation && (
                        <Tooltip title="Reference Simulation">
                          <InfoIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                        </Tooltip>
                      )}
                      {stats.simulationName}
                    </Box>
                  </TableCell>
                  <TableCell align="right">{stats.mean.toFixed(2)}</TableCell>
                  <TableCell align="right">{stats.median.toFixed(2)}</TableCell>
                  <TableCell align="right">{stats.stdDev.toFixed(2)}</TableCell>
                  <TableCell align="right">{stats.min.toFixed(2)}</TableCell>
                  <TableCell align="right">{stats.max.toFixed(2)}</TableCell>
                  <TableCell 
                    align="right"
                    sx={{ 
                      color: 
                        stats.simulationId === referenceSimulation ? 'inherit' :
                        Math.abs(stats.correlation) > 0.7 ? 'success.main' : 
                        Math.abs(stats.correlation) > 0.4 ? 'primary.main' : 
                        Math.abs(stats.correlation) > 0.2 ? 'warning.main' : 
                        'error.main'
                    }}
                  >
                    {stats.simulationId === referenceSimulation ? '—' : stats.correlation.toFixed(4)}
                  </TableCell>
                  <TableCell align="right">
                    {stats.simulationId === referenceSimulation ? '—' : stats.rmse.toFixed(2)}
                  </TableCell>
                  <TableCell 
                    align="right"
                    sx={{ 
                      color: 
                        stats.simulationId === referenceSimulation ? 'inherit' :
                        Math.abs(stats.mbe) < stats.stdDev * 0.1 ? 'success.main' : 
                        Math.abs(stats.mbe) < stats.stdDev * 0.3 ? 'primary.main' : 
                        Math.abs(stats.mbe) < stats.stdDev * 0.5 ? 'warning.main' : 
                        'error.main'
                    }}
                  >
                    {stats.simulationId === referenceSimulation ? '—' : stats.mbe.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Statistical Measures
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>R (Correlation Coefficient):</strong> Measures the strength and direction of the linear relationship between two variables. Values range from -1 to 1, where 1 is perfect positive correlation, 0 is no correlation, and -1 is perfect negative correlation.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>RMSE (Root Mean Square Error):</strong> Measures the square root of the average squared differences between predicted and actual values. Lower values indicate better fit.
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>MBE (Mean Bias Error):</strong> Measures the average difference between simulations. Positive values indicate the simulation is on average higher than the reference; negative values indicate it's lower.
          </Typography>
        </Box>
      </Box>
    );
  };
  
  // Render simulation selection panel
  const renderSimulationSelection = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Select Simulations to Compare
        </Typography>
        
        {simulationsLoading ? (
          <CircularProgress />
        ) : (
          <Grid container spacing={2}>
            {simulations.map(simulation => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={simulation.id}>
                <Card 
                  variant={selectedSimulations.includes(simulation.id) ? 'elevation' : 'outlined'}
                  sx={{ 
                    cursor: 'pointer',
                    borderColor: selectedSimulations.includes(simulation.id) ? 'primary.main' : 'divider',
                    bgcolor: selectedSimulations.includes(simulation.id) ? 'action.selected' : 'background.paper'
                  }}
                  onClick={() => handleSimulationToggle(simulation.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle1">
                        {simulation.name}
                      </Typography>
                      
                      {selectedSimulations.includes(simulation.id) && (
                        <Box>
                          {simulation.id === referenceSimulation ? (
                            <Tooltip title="Reference Simulation">
                              <Chip
                                label="Reference"
                                color="primary"
                                size="small"
                              />
                            </Tooltip>
                          ) : (
                            <Tooltip title="Set as Reference">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetReference(simulation.id);
                                }}
                              >
                                <TimelineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      Status: {simulation.status}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                      Created: {new Date(simulation.createdAt).toLocaleDateString()}
                    </Typography>
                    
                    {simulation.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {simulation.description.slice(0, 50)}{simulation.description.length > 50 ? '...' : ''}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    );
  };
  
  // Render selected simulations
  const renderSelectedSimulations = () => {
    if (selectedSimulations.length === 0) {
      return null;
    }
    
    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Selected Simulations
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {timeSeriesData.map(ts => (
            <Chip
              key={ts.simulationId}
              label={ts.simulationName}
              onDelete={() => handleSimulationToggle(ts.simulationId)}
              deleteIcon={<RemoveIcon />}
              color={ts.visible ? 'primary' : 'default'}
              variant={ts.visible ? 'filled' : 'outlined'}
              sx={{ bgcolor: !ts.visible ? 'background.paper' : ts.color, mb: 1 }}
              onClick={() => toggleTimeSeriesVisibility(ts.simulationId)}
            />
          ))}
        </Box>
        
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="variable-select-label">Variable to Compare</InputLabel>
            <Select
              labelId="variable-select-label"
              id="variable-select"
              value={selectedVariable}
              label="Variable to Compare"
              onChange={handleVariableChange}
            >
              {availableVariables.map(variable => (
                <MenuItem key={variable} value={variable}>
                  {variable}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
    );
  };
  
  return (
    <Box>
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="time series comparison tabs"
          >
            <Tab label="Simulations" id="comparison-tab-0" aria-controls="comparison-tabpanel-0" />
            <Tab label="Time Series" id="comparison-tab-1" aria-controls="comparison-tabpanel-1" disabled={selectedSimulations.length === 0} />
            <Tab label="Correlation" id="comparison-tab-2" aria-controls="comparison-tabpanel-2" disabled={selectedSimulations.length < 2} />
            <Tab label="Statistics" id="comparison-tab-3" aria-controls="comparison-tabpanel-3" disabled={selectedSimulations.length === 0} />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          {renderSimulationSelection()}
          {renderSelectedSimulations()}
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {loading ? <CircularProgress /> : renderTimeSeriesChart()}
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          {loading ? <CircularProgress /> : renderCorrelationPlots()}
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          {loading ? <CircularProgress /> : renderStatisticsTable()}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default TimeSeriesComparison;