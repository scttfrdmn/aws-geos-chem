import React, { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Chip,
  Tooltip,
  SelectChangeEvent
} from '@mui/material';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar
} from 'recharts';

// Utility function for calculating statistics
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
  
  // Percentiles
  const percentile25 = sortedValues[Math.floor(count * 0.25)];
  const percentile75 = sortedValues[Math.floor(count * 0.75)];
  const percentile95 = sortedValues[Math.floor(count * 0.95)];
  
  return { 
    mean, 
    median, 
    stdDev, 
    min, 
    max, 
    count, 
    sum,
    percentile25,
    percentile75,
    percentile95
  };
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

// Calculate linear regression
const calculateLinearRegression = (x: number[], y: number[]) => {
  if (!x || !y || x.length === 0 || y.length === 0 || x.length !== y.length) {
    return { slope: 0, intercept: 0, r2: 0 };
  }
  
  const validPairs = x.map((val, idx) => [val, y[idx]])
    .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]) && 
            pair[0] !== null && pair[1] !== null && 
            pair[0] !== undefined && pair[1] !== undefined);
  
  if (validPairs.length === 0) return { slope: 0, intercept: 0, r2: 0 };
  
  const xValues = validPairs.map(pair => pair[0]);
  const yValues = validPairs.map(pair => pair[1]);
  
  const n = xValues.length;
  const xMean = xValues.reduce((sum, val) => sum + val, 0) / n;
  const yMean = yValues.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate the slope
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
    denominator += Math.pow(xValues[i] - xMean, 2);
  }
  
  if (denominator === 0) return { slope: 0, intercept: 0, r2: 0 };
  
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  
  // Calculate R-squared
  let ssr = 0; // Sum of squared residuals
  let sst = 0; // Total sum of squares
  
  for (let i = 0; i < n; i++) {
    const prediction = slope * xValues[i] + intercept;
    ssr += Math.pow(yValues[i] - prediction, 2);
    sst += Math.pow(yValues[i] - yMean, 2);
  }
  
  const r2 = sst !== 0 ? 1 - (ssr / sst) : 0;
  
  return { slope, intercept, r2 };
};

// Generate histogram data
const generateHistogram = (values: number[], bins: number = 10) => {
  if (!values || values.length === 0) {
    return [];
  }
  
  const filteredValues = values.filter(v => !isNaN(v) && v !== null && v !== undefined);
  
  if (filteredValues.length === 0) {
    return [];
  }
  
  const min = Math.min(...filteredValues);
  const max = Math.max(...filteredValues);
  const range = max - min;
  const binWidth = range / bins;
  
  // Initialize bins
  const histogramData = Array(bins).fill(0).map((_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    count: 0,
    frequency: 0
  }));
  
  // Count values in each bin
  filteredValues.forEach(value => {
    // Special case: if value is max, put it in the last bin
    if (value === max) {
      histogramData[bins - 1].count++;
    } else {
      const binIndex = Math.floor((value - min) / binWidth);
      if (binIndex >= 0 && binIndex < bins) {
        histogramData[binIndex].count++;
      }
    }
  });
  
  // Calculate frequency (proportion)
  histogramData.forEach(bin => {
    bin.frequency = bin.count / filteredValues.length;
  });
  
  return histogramData;
};

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
      id={`stats-tabpanel-${index}`}
      aria-labelledby={`stats-tab-${index}`}
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

interface StatisticalAnalysisProps {
  data: {
    variableNames: string[];
    values: Record<string, number[]>;
    xAxis?: string[];
    units?: Record<string, string>;
    description?: string;
  };
  title?: string;
}

const StatisticalAnalysis: React.FC<StatisticalAnalysisProps> = ({ 
  data, 
  title = 'Statistical Analysis' 
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedVariable1, setSelectedVariable1] = useState<string>('');
  const [selectedVariable2, setSelectedVariable2] = useState<string>('');
  const [histogramBins, setHistogramBins] = useState<number>(10);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [correlationStats, setCorrelationStats] = useState<Record<string, any>>({});
  const [histogramData, setHistogramData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize the first selected variable when component mounts
  useEffect(() => {
    if (data && data.variableNames && data.variableNames.length > 0) {
      setSelectedVariable1(data.variableNames[0]);
      
      if (data.variableNames.length > 1) {
        setSelectedVariable2(data.variableNames[1]);
      }
    }
  }, [data]);
  
  // Calculate statistics when the selected variable changes
  useEffect(() => {
    if (!selectedVariable1 || !data || !data.values) return;
    
    const values = data.values[selectedVariable1];
    if (!values) return;
    
    // Calculate basic statistics for the selected variable
    setStats(calculateStats(values));
    
    // Generate histogram data
    setHistogramData(generateHistogram(values, histogramBins));
    
    // Calculate correlation statistics if two variables are selected
    if (selectedVariable2 && selectedVariable1 !== selectedVariable2) {
      const values2 = data.values[selectedVariable2];
      if (values2) {
        const correlation = calculateCorrelation(values, values2);
        const { slope, intercept, r2 } = calculateLinearRegression(values, values2);
        
        setCorrelationStats({
          correlation,
          slope,
          intercept,
          r2
        });
      }
    }
  }, [selectedVariable1, selectedVariable2, histogramBins, data]);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Handle variable selection changes
  const handleVariable1Change = (event: SelectChangeEvent<string>) => {
    setSelectedVariable1(event.target.value);
  };
  
  const handleVariable2Change = (event: SelectChangeEvent<string>) => {
    setSelectedVariable2(event.target.value);
  };
  
  // Handle histogram bin changes
  const handleBinsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    if (!isNaN(value) && value > 1 && value <= 100) {
      setHistogramBins(value);
    }
  };
  
  // Create scatter plot data for correlation analysis
  const getScatterData = () => {
    if (!selectedVariable1 || !selectedVariable2 || !data || !data.values) {
      return [];
    }
    
    const values1 = data.values[selectedVariable1];
    const values2 = data.values[selectedVariable2];
    
    if (!values1 || !values2 || values1.length !== values2.length) {
      return [];
    }
    
    return values1.map((val1, index) => {
      const val2 = values2[index];
      
      // Skip invalid values
      if (val1 === undefined || val2 === undefined || 
          val1 === null || val2 === null || 
          isNaN(val1) || isNaN(val2)) {
        return null;
      }
      
      return {
        x: val1,
        y: val2,
        xAxis: data.xAxis ? data.xAxis[index] : index
      };
    }).filter(item => item !== null);
  };
  
  // Render summary statistics
  const renderSummaryStats = () => {
    if (!selectedVariable1 || !data || !data.values || !stats) {
      return (
        <Alert severity="info">
          Select a variable to view statistics.
        </Alert>
      );
    }
    
    const units = data.units && data.units[selectedVariable1] ? data.units[selectedVariable1] : '';
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Summary Statistics: {selectedVariable1} {units ? `(${units})` : ''}
        </Typography>
        
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Statistic</TableCell>
                <TableCell align="right">Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Count</TableCell>
                <TableCell align="right">{stats.count}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Mean</TableCell>
                <TableCell align="right">{stats.mean.toFixed(4)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Median</TableCell>
                <TableCell align="right">{stats.median.toFixed(4)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Standard Deviation</TableCell>
                <TableCell align="right">{stats.stdDev.toFixed(4)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Minimum</TableCell>
                <TableCell align="right">{stats.min.toFixed(4)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Maximum</TableCell>
                <TableCell align="right">{stats.max.toFixed(4)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>25th Percentile</TableCell>
                <TableCell align="right">{stats.percentile25?.toFixed(4) || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>75th Percentile</TableCell>
                <TableCell align="right">{stats.percentile75?.toFixed(4) || 'N/A'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>95th Percentile</TableCell>
                <TableCell align="right">{stats.percentile95?.toFixed(4) || 'N/A'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        
        <Typography variant="subtitle1" sx={{ mt: 4, mb: 2 }}>
          Histogram
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <TextField
            label="Number of Bins"
            type="number"
            size="small"
            value={histogramBins}
            onChange={handleBinsChange}
            InputProps={{
              inputProps: { min: 2, max: 100 }
            }}
            sx={{ width: 150 }}
          />
        </Box>
        
        {histogramData.length > 0 ? (
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="binStart" 
                  tickFormatter={(value) => value.toFixed(2)}
                  label={{ 
                    value: selectedVariable1, 
                    position: 'insideBottom', 
                    offset: -10 
                  }}
                />
                <YAxis 
                  label={{ 
                    value: 'Frequency', 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                />
                <RechartsTooltip 
                  formatter={(value: any, name: string) => [
                    `${parseFloat(value).toFixed(4)}`, 
                    name === 'frequency' ? 'Frequency' : name
                  ]}
                  labelFormatter={(label) => `Bin: ${parseFloat(label).toFixed(2)} - ${(parseFloat(label) + (stats.max - stats.min) / histogramBins).toFixed(2)}`}
                />
                <Bar 
                  dataKey="frequency" 
                  fill="#8884d8" 
                  name={`${selectedVariable1} frequency`}
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Alert severity="info">
            No valid data for histogram.
          </Alert>
        )}
      </Box>
    );
  };
  
  // Render correlation analysis
  const renderCorrelationAnalysis = () => {
    if (!selectedVariable1 || !selectedVariable2 || 
        selectedVariable1 === selectedVariable2 || 
        !data || !data.values) {
      return (
        <Alert severity="info">
          Select two different variables to analyze correlation.
        </Alert>
      );
    }
    
    const scatterData = getScatterData();
    
    if (scatterData.length === 0) {
      return (
        <Alert severity="warning">
          No valid paired data points for correlation analysis.
        </Alert>
      );
    }
    
    const units1 = data.units && data.units[selectedVariable1] ? data.units[selectedVariable1] : '';
    const units2 = data.units && data.units[selectedVariable2] ? data.units[selectedVariable2] : '';
    
    // Add regression line data points
    const xMin = Math.min(...scatterData.map((point: any) => point.x));
    const xMax = Math.max(...scatterData.map((point: any) => point.x));
    
    const regressionLineData = [
      { x: xMin, y: correlationStats.slope * xMin + correlationStats.intercept },
      { x: xMax, y: correlationStats.slope * xMax + correlationStats.intercept }
    ];
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Correlation Analysis
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Statistic</TableCell>
                    <TableCell align="right">Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Correlation Coefficient (r)</TableCell>
                    <TableCell align="right">{correlationStats.correlation?.toFixed(4) || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Coefficient of Determination (R²)</TableCell>
                    <TableCell align="right">{correlationStats.r2?.toFixed(4) || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Regression Slope</TableCell>
                    <TableCell align="right">{correlationStats.slope?.toFixed(4) || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Regression Intercept</TableCell>
                    <TableCell align="right">{correlationStats.intercept?.toFixed(4) || 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Regression Equation</TableCell>
                    <TableCell align="right">
                      {`${selectedVariable2} = ${correlationStats.slope?.toFixed(4) || '?'} × ${selectedVariable1} + ${correlationStats.intercept?.toFixed(4) || '?'}`}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Chip 
                label={`Strong ${correlationStats.correlation > 0 ? 'Positive' : 'Negative'} Correlation`} 
                color={
                  Math.abs(correlationStats.correlation) > 0.7 ? 'success' : 
                  Math.abs(correlationStats.correlation) > 0.4 ? 'primary' : 
                  Math.abs(correlationStats.correlation) > 0.2 ? 'warning' : 
                  'error'
                }
                variant="outlined"
                sx={{ mr: 1 }}
              />
              
              <Chip 
                label={`R² = ${correlationStats.r2?.toFixed(4) || 'N/A'}`} 
                color={
                  correlationStats.r2 > 0.7 ? 'success' : 
                  correlationStats.r2 > 0.4 ? 'primary' : 
                  correlationStats.r2 > 0.2 ? 'warning' : 
                  'error'
                }
                variant="outlined"
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              {Math.abs(correlationStats.correlation) > 0.7 
                ? 'This indicates a strong relationship between the variables.' 
                : Math.abs(correlationStats.correlation) > 0.4 
                ? 'This indicates a moderate relationship between the variables.' 
                : 'This indicates a weak relationship between the variables.'}
            </Typography>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              The R² value indicates that {(correlationStats.r2 * 100).toFixed(1)}% of the variation in {selectedVariable2} can be explained by {selectedVariable1}.
            </Typography>
          </Grid>
        </Grid>
        
        <Typography variant="subtitle1" sx={{ mt: 4, mb: 2 }}>
          Scatter Plot with Regression Line
        </Typography>
        
        <Box sx={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name={selectedVariable1} 
                label={{ 
                  value: `${selectedVariable1}${units1 ? ` (${units1})` : ''}`, 
                  position: 'insideBottom', 
                  offset: -5 
                }} 
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name={selectedVariable2} 
                label={{ 
                  value: `${selectedVariable2}${units2 ? ` (${units2})` : ''}`, 
                  angle: -90, 
                  position: 'insideLeft' 
                }} 
              />
              <RechartsTooltip 
                formatter={(value: any, name: string) => [
                  parseFloat(value).toFixed(4), 
                  name === 'x' ? selectedVariable1 : 
                  name === 'y' ? selectedVariable2 : name
                ]}
                labelFormatter={(label) => 
                  data.xAxis ? `Time: ${label}` : `Index: ${label}`
                }
              />
              <Legend />
              <Scatter 
                name={`${selectedVariable1} vs ${selectedVariable2}`} 
                data={scatterData} 
                fill="#8884d8" 
              />
              <Line 
                name="Regression Line" 
                data={regressionLineData} 
                type="linear" 
                dataKey="y" 
                stroke="#ff7300" 
                dot={false} 
              />
            </ScatterChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  };
  
  // Render time series analysis
  const renderTimeSeriesAnalysis = () => {
    if (!selectedVariable1 || !data || !data.values) {
      return (
        <Alert severity="info">
          Select a variable to view time series analysis.
        </Alert>
      );
    }
    
    const values = data.values[selectedVariable1];
    if (!values) {
      return (
        <Alert severity="warning">
          No data available for time series analysis.
        </Alert>
      );
    }
    
    // Create time series data
    const timeSeriesData = values.map((value, index) => {
      return {
        time: data.xAxis ? data.xAxis[index] : `Point ${index + 1}`,
        value
      };
    });
    
    // Calculate moving average (window of 5)
    const movingAverageData = timeSeriesData.map((item, index, array) => {
      if (index < 2 || index >= array.length - 2) {
        return { ...item, movingAvg: null };
      }
      
      const windowValues = [
        array[index - 2].value,
        array[index - 1].value,
        array[index].value,
        array[index + 1].value,
        array[index + 2].value
      ].filter(v => !isNaN(v) && v !== null && v !== undefined);
      
      if (windowValues.length === 0) {
        return { ...item, movingAvg: null };
      }
      
      const sum = windowValues.reduce((acc, val) => acc + val, 0);
      return { 
        ...item, 
        movingAvg: sum / windowValues.length 
      };
    });
    
    // Calculate trend (simple linear regression)
    const { slope, intercept } = calculateLinearRegression(
      Array.from({ length: values.length }, (_, i) => i),
      values
    );
    
    const trendData = timeSeriesData.map((item, index) => {
      return {
        ...item,
        trend: slope * index + intercept
      };
    });
    
    const units = data.units && data.units[selectedVariable1] ? data.units[selectedVariable1] : '';
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Time Series Analysis: {selectedVariable1} {units ? `(${units})` : ''}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Chip 
            label={slope > 0 ? 'Increasing Trend' : slope < 0 ? 'Decreasing Trend' : 'No Clear Trend'} 
            color={
              Math.abs(slope) > 0.1 * stats.mean ? 'primary' : 
              Math.abs(slope) > 0.01 * stats.mean ? 'info' : 
              'default'
            }
            variant="outlined"
            sx={{ mr: 1 }}
          />
          
          <Chip 
            label={`Slope: ${slope.toFixed(6)}`} 
            color="default"
            variant="outlined"
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          {slope > 0 
            ? `${selectedVariable1} shows an increasing trend over time (${slope.toFixed(6)} units per time step).` 
            : slope < 0 
            ? `${selectedVariable1} shows a decreasing trend over time (${Math.abs(slope).toFixed(6)} units per time step).` 
            : `${selectedVariable1} shows no clear trend over time.`}
        </Typography>
        
        <Box sx={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={movingAverageData.map((item, index) => ({
                ...item,
                trend: trendData[index].trend
              }))} 
              margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                label={{ 
                  value: 'Time/Index', 
                  position: 'insideBottom', 
                  offset: -5 
                }} 
              />
              <YAxis 
                label={{ 
                  value: `${selectedVariable1}${units ? ` (${units})` : ''}`, 
                  angle: -90, 
                  position: 'insideLeft' 
                }} 
              />
              <RechartsTooltip 
                formatter={(value: any, name: string) => [
                  parseFloat(value).toFixed(4), 
                  name === 'value' ? selectedVariable1 : 
                  name === 'movingAvg' ? '5-point Moving Average' : 
                  name === 'trend' ? 'Trend Line' : name
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#8884d8" 
                name={selectedVariable1} 
                dot={{ r: 2 }} 
              />
              <Line 
                type="monotone" 
                dataKey="movingAvg" 
                stroke="#82ca9d" 
                name="5-point Moving Average" 
                dot={false} 
                strokeWidth={2} 
              />
              <Line 
                type="monotone" 
                dataKey="trend" 
                stroke="#ff7300" 
                name="Trend Line" 
                dot={false} 
                strokeWidth={2} 
                strokeDasharray="5 5" 
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    );
  };
  
  if (!data || !data.variableNames || data.variableNames.length === 0) {
    return (
      <Alert severity="warning">
        No data available for statistical analysis.
      </Alert>
    );
  }
  
  return (
    <Box>
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="statistical analysis tabs"
          >
            <Tab label="Summary Statistics" id="stats-tab-0" aria-controls="stats-tabpanel-0" />
            <Tab label="Correlation Analysis" id="stats-tab-1" aria-controls="stats-tabpanel-1" />
            <Tab label="Time Series Analysis" id="stats-tab-2" aria-controls="stats-tabpanel-2" />
          </Tabs>
        </Box>
        
        <Box sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel id="variable1-select-label">Variable 1</InputLabel>
                <Select
                  labelId="variable1-select-label"
                  id="variable1-select"
                  value={selectedVariable1}
                  label="Variable 1"
                  onChange={handleVariable1Change}
                >
                  {data.variableNames.map(name => (
                    <MenuItem key={name} value={name}>
                      {name} {data.units && data.units[name] ? `(${data.units[name]})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            {tabValue === 1 && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="variable2-select-label">Variable 2</InputLabel>
                  <Select
                    labelId="variable2-select-label"
                    id="variable2-select"
                    value={selectedVariable2}
                    label="Variable 2"
                    onChange={handleVariable2Change}
                  >
                    {data.variableNames.map(name => (
                      <MenuItem key={name} value={name}>
                        {name} {data.units && data.units[name] ? `(${data.units[name]})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          {renderSummaryStats()}
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {renderCorrelationAnalysis()}
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          {renderTimeSeriesAnalysis()}
        </TabPanel>
      </Paper>
      
      {data.description && (
        <Typography variant="body2" color="text.secondary">
          {data.description}
        </Typography>
      )}
    </Box>
  );
};

export default StatisticalAnalysis;