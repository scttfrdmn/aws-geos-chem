import React, { useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { Simulation } from '../../store/slices/simulationsSlice';

// MUI components
import {
  Box,
  Paper,
  Typography,
  Divider,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Tab,
  Tabs,
  Alert,
  Button,
  FormControlLabel,
  Switch,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';

// For charts
// Note: In a real implementation, you would use a charting library like Chart.js or Recharts
// This example uses a simplified mock approach for demonstration

interface ResourceMetric {
  timestamp: string;
  value: number;
}

interface ResourceData {
  cpu: ResourceMetric[];
  memory: ResourceMetric[];
  disk: ResourceMetric[];
  network: ResourceMetric[];
}

interface ResourceMonitorProps {
  simulation: Simulation;
}

const ResourceMonitor: React.FC<ResourceMonitorProps> = ({ simulation }) => {
  const [resourceData, setResourceData] = useState<ResourceData>({
    cpu: [],
    memory: [],
    disk: [],
    network: []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '3h' | '6h' | '12h' | '24h'>('1h');
  const [metricTab, setMetricTab] = useState(0);
  
  // Fetch resource metrics
  const fetchResourceMetrics = async () => {
    if (simulation.status !== 'RUNNING') {
      // Only fetch metrics for running simulations
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // This is just for demonstration - in a real app, you would call your API
      // const response = await API.get('GeosChemAPI', `/api/simulations/${simulation.simulationId}/metrics`, {
      //   queryStringParameters: {
      //     timeRange
      //   }
      // });
      
      // Generate mock resource data for demonstration
      const mockData = generateMockResourceData(timeRange);
      setResourceData(mockData);
    } catch (err: any) {
      console.error('Error fetching resource metrics:', err);
      setError(err.message || 'Failed to fetch resource metrics');
    } finally {
      setLoading(false);
    }
  };
  
  // Generate mock resource data for demonstration
  const generateMockResourceData = (range: string): ResourceData => {
    const now = Date.now();
    const hours = range === '1h' ? 1 : 
                 range === '3h' ? 3 : 
                 range === '6h' ? 6 : 
                 range === '12h' ? 12 : 24;
    const dataPoints = 60 * hours; // One data point per minute
    const startTime = now - (hours * 60 * 60 * 1000);
    
    const cpu: ResourceMetric[] = [];
    const memory: ResourceMetric[] = [];
    const disk: ResourceMetric[] = [];
    const network: ResourceMetric[] = [];
    
    // Generate data points
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(startTime + (i * 60 * 1000)).toISOString();
      
      // CPU usage varies between 30% and 90% with some random fluctuation
      cpu.push({
        timestamp,
        value: 30 + Math.random() * 60
      });
      
      // Memory usage starts at 20% and gradually increases to 70%
      memory.push({
        timestamp,
        value: 20 + (i / dataPoints) * 50 + (Math.random() * 10 - 5)
      });
      
      // Disk usage starts at 10% and increases linearly
      disk.push({
        timestamp,
        value: 10 + (i / dataPoints) * 40
      });
      
      // Network usage has spikes
      const baseNetwork = 10 + Math.random() * 20;
      const spike = i % 30 === 0 ? 50 : 0; // Spike every 30 minutes
      network.push({
        timestamp,
        value: baseNetwork + spike
      });
    }
    
    return { cpu, memory, disk, network };
  };
  
  // Fetch metrics on initial load and when parameters change
  useEffect(() => {
    fetchResourceMetrics();
    
    // Set up polling for metrics if auto-refresh is enabled
    let intervalId: NodeJS.Timeout | null = null;
    
    if (autoRefresh && simulation.status === 'RUNNING') {
      intervalId = setInterval(fetchResourceMetrics, 60000); // Refresh every minute
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [simulation.simulationId, simulation.status, autoRefresh, timeRange]);
  
  // Handle time range change
  const handleTimeRangeChange = (
    event: React.MouseEvent<HTMLElement>,
    newTimeRange: '1h' | '3h' | '6h' | '12h' | '24h' | null
  ) => {
    if (newTimeRange) {
      setTimeRange(newTimeRange);
    }
  };
  
  // Handle auto refresh toggle
  const handleAutoRefreshToggle = () => {
    setAutoRefresh(!autoRefresh);
  };
  
  // Handle metric tab change
  const handleMetricTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setMetricTab(newValue);
  };
  
  // Get current metric based on active tab
  const getCurrentMetric = () => {
    switch (metricTab) {
      case 0:
        return { data: resourceData.cpu, label: 'CPU Usage', unit: '%', color: '#2196f3' };
      case 1:
        return { data: resourceData.memory, label: 'Memory Usage', unit: '%', color: '#4caf50' };
      case 2:
        return { data: resourceData.disk, label: 'Disk Usage', unit: '%', color: '#ff9800' };
      case 3:
        return { data: resourceData.network, label: 'Network Usage', unit: 'MB/s', color: '#9c27b0' };
      default:
        return { data: resourceData.cpu, label: 'CPU Usage', unit: '%', color: '#2196f3' };
    }
  };
  
  // Get current metric value (most recent)
  const getCurrentMetricValue = () => {
    const metric = getCurrentMetric();
    if (metric.data.length > 0) {
      return metric.data[metric.data.length - 1].value;
    }
    return 0;
  };
  
  // Get average metric value
  const getAverageMetricValue = () => {
    const metric = getCurrentMetric();
    if (metric.data.length > 0) {
      const sum = metric.data.reduce((acc, item) => acc + item.value, 0);
      return sum / metric.data.length;
    }
    return 0;
  };
  
  // Get max metric value
  const getMaxMetricValue = () => {
    const metric = getCurrentMetric();
    if (metric.data.length > 0) {
      return Math.max(...metric.data.map(item => item.value));
    }
    return 0;
  };
  
  // Render a simple chart using div elements (for demonstration)
  // In a real app, you would use a proper charting library like Chart.js or Recharts
  const renderSimpleChart = () => {
    const metric = getCurrentMetric();
    const data = metric.data;
    
    if (data.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <Typography variant="body1" color="text.secondary">
            No data available
          </Typography>
        </Box>
      );
    }
    
    // Take last 60 data points for simplicity
    const displayData = data.slice(-60);
    const maxValue = Math.max(...displayData.map(item => item.value));
    
    return (
      <Box sx={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        {displayData.map((item, index) => (
          <Tooltip 
            key={index}
            title={`${new Date(item.timestamp).toLocaleTimeString()}: ${item.value.toFixed(1)}${metric.unit}`}
          >
            <Box
              sx={{
                height: `${(item.value / (maxValue * 1.1)) * 100}%`,
                width: `${100 / 60}%`,
                backgroundColor: metric.color,
                borderRadius: '2px 2px 0 0'
              }}
            />
          </Tooltip>
        ))}
      </Box>
    );
  };
  
  // If simulation is not running and has no metrics, show appropriate message
  if (simulation.status !== 'RUNNING' && 
      resourceData.cpu.length === 0 && 
      !loading) {
    return (
      <Box>
        <Alert severity="info">
          Resource metrics are only available for running simulations. This simulation is currently {simulation.status.toLowerCase()}.
        </Alert>
      </Box>
    );
  }
  
  return (
    <Box>
      {/* Controls and filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Typography variant="subtitle1">
              Resource Monitoring
            </Typography>
          </Grid>
          
          <Grid item xs>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              aria-label="time range"
              size="small"
            >
              <ToggleButton value="1h" aria-label="1 hour">
                1h
              </ToggleButton>
              <ToggleButton value="3h" aria-label="3 hours">
                3h
              </ToggleButton>
              <ToggleButton value="6h" aria-label="6 hours">
                6h
              </ToggleButton>
              <ToggleButton value="12h" aria-label="12 hours">
                12h
              </ToggleButton>
              <ToggleButton value="24h" aria-label="24 hours">
                24h
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={handleAutoRefreshToggle}
                  size="small"
                />
              }
              label="Auto-refresh"
            />
          </Grid>
          
          <Grid item>
            <Button
              variant="outlined"
              size="small"
              onClick={fetchResourceMetrics}
              disabled={loading}
              startIcon={loading && <CircularProgress size={16} />}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
      
      {/* Resource summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* CPU Usage */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                CPU Usage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                <Typography variant="h4" component="div">
                  {resourceData.cpu.length > 0 
                    ? `${resourceData.cpu[resourceData.cpu.length - 1].value.toFixed(1)}%`
                    : 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  avg: {resourceData.cpu.length > 0 
                    ? `${(resourceData.cpu.reduce((acc, item) => acc + item.value, 0) / resourceData.cpu.length).toFixed(1)}%`
                    : 'N/A'}
                </Typography>
              </Box>
              {resourceData.cpu.length > 0 && (
                <LinearProgress 
                  variant="determinate" 
                  value={resourceData.cpu[resourceData.cpu.length - 1].value} 
                  sx={{ mt: 1, height: 6, borderRadius: 3 }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Memory Usage */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Memory Usage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                <Typography variant="h4" component="div">
                  {resourceData.memory.length > 0 
                    ? `${resourceData.memory[resourceData.memory.length - 1].value.toFixed(1)}%`
                    : 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  max: {resourceData.memory.length > 0 
                    ? `${Math.max(...resourceData.memory.map(item => item.value)).toFixed(1)}%`
                    : 'N/A'}
                </Typography>
              </Box>
              {resourceData.memory.length > 0 && (
                <LinearProgress 
                  variant="determinate" 
                  value={resourceData.memory[resourceData.memory.length - 1].value} 
                  sx={{ mt: 1, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { backgroundColor: '#4caf50' } }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Disk Usage */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Disk Usage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                <Typography variant="h4" component="div">
                  {resourceData.disk.length > 0 
                    ? `${resourceData.disk[resourceData.disk.length - 1].value.toFixed(1)}%`
                    : 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  trend: {resourceData.disk.length > 0 && resourceData.disk.length > 10
                    ? (resourceData.disk[resourceData.disk.length - 1].value > 
                       resourceData.disk[resourceData.disk.length - 10].value
                        ? '+' : '')
                      + (resourceData.disk[resourceData.disk.length - 1].value - 
                         resourceData.disk[resourceData.disk.length - 10].value).toFixed(1) + '%'
                    : 'N/A'}
                </Typography>
              </Box>
              {resourceData.disk.length > 0 && (
                <LinearProgress 
                  variant="determinate" 
                  value={resourceData.disk[resourceData.disk.length - 1].value} 
                  sx={{ mt: 1, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { backgroundColor: '#ff9800' } }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Network Usage */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Network Usage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                <Typography variant="h4" component="div">
                  {resourceData.network.length > 0 
                    ? `${resourceData.network[resourceData.network.length - 1].value.toFixed(1)} MB/s`
                    : 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  peak: {resourceData.network.length > 0 
                    ? `${Math.max(...resourceData.network.map(item => item.value)).toFixed(1)} MB/s`
                    : 'N/A'}
                </Typography>
              </Box>
              {resourceData.network.length > 0 && (
                <LinearProgress 
                  variant="determinate" 
                  value={(resourceData.network[resourceData.network.length - 1].value / 100) * 100} 
                  sx={{ mt: 1, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { backgroundColor: '#9c27b0' } }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Detailed metrics */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={metricTab} onChange={handleMetricTabChange} aria-label="resource metrics tabs">
            <Tab label="CPU" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="Memory" id="tab-1" aria-controls="tabpanel-1" />
            <Tab label="Disk" id="tab-2" aria-controls="tabpanel-2" />
            <Tab label="Network" id="tab-3" aria-controls="tabpanel-3" />
          </Tabs>
        </Box>
        
        <Box sx={{ py: 2 }}>
          {/* Metric details */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1">
                {getCurrentMetric().label}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Current
                  </Typography>
                  <Typography variant="h5">
                    {getCurrentMetricValue().toFixed(1)}{getCurrentMetric().unit}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Average
                  </Typography>
                  <Typography variant="h5">
                    {getAverageMetricValue().toFixed(1)}{getCurrentMetric().unit}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Maximum
                  </Typography>
                  <Typography variant="h5">
                    {getMaxMetricValue().toFixed(1)}{getCurrentMetric().unit}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={8}>
              {/* Chart */}
              <Box sx={{ height: 250, mt: 2 }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  renderSimpleChart()
                )}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default ResourceMonitor;