import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Alert
} from '@mui/material';
import {
  CloudDownload as DownloadIcon,
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SelectChangeEvent } from '@mui/material';

interface TimeSeriesComparisonProps {
  comparisonData: any;
  simulationIds: string[];
}

// Sample variables for GEOS-Chem
const availableVariables = [
  { id: 'O3', name: 'Ozone', unit: 'ppbv', group: 'gases' },
  { id: 'CO', name: 'Carbon Monoxide', unit: 'ppbv', group: 'gases' },
  { id: 'NO2', name: 'Nitrogen Dioxide', unit: 'ppbv', group: 'gases' },
  { id: 'PM25', name: 'PM2.5', unit: 'μg/m³', group: 'aerosols' },
  { id: 'SO4', name: 'Sulfate', unit: 'μg/m³', group: 'aerosols' },
  { id: 'BC', name: 'Black Carbon', unit: 'μg/m³', group: 'aerosols' },
  { id: 'OC', name: 'Organic Carbon', unit: 'μg/m³', group: 'aerosols' },
  { id: 'AOD', name: 'Aerosol Optical Depth', unit: '', group: 'diagnostics' },
  { id: 'OH', name: 'Hydroxyl Radical', unit: 'molecules/cm³', group: 'chemistry' }
];

// Sample regions
const availableRegions = [
  { id: 'global', name: 'Global' },
  { id: 'north_america', name: 'North America' },
  { id: 'europe', name: 'Europe' },
  { id: 'asia', name: 'Asia' },
  { id: 'tropics', name: 'Tropics' },
  { id: 'southern_ocean', name: 'Southern Ocean' },
  { id: 'arctic', name: 'Arctic' }
];

const TimeSeriesComparison: React.FC<TimeSeriesComparisonProps> = ({
  comparisonData,
  simulationIds
}) => {
  const { simulations } = useSelector((state: RootState) => state.simulations);
  
  const [selectedVariable, setSelectedVariable] = useState<string>('O3');
  const [selectedRegion, setSelectedRegion] = useState<string>('global');
  const [selectedLevel, setSelectedLevel] = useState<string>('surface');
  const [showAnomalies, setShowAnomalies] = useState<boolean>(false);
  const [showTrend, setShowTrend] = useState<boolean>(false);
  const [showDiurnal, setShowDiurnal] = useState<boolean>(false);
  const [showCumulative, setShowCumulative] = useState<boolean>(false);
  
  // Get simulation names from IDs
  const getSimulationName = (simId: string) => {
    const simulation = simulations.find(sim => sim.id === simId);
    return simulation ? simulation.name : simId;
  };
  
  // Generate unique colors for each simulation
  const getSimulationColor = (index: number) => {
    const colors = [
      '#1f77b4', // blue
      '#ff7f0e', // orange
      '#2ca02c', // green
      '#d62728', // red
      '#9467bd', // purple
      '#8c564b', // brown
      '#e377c2', // pink
      '#7f7f7f', // gray
      '#bcbd22', // olive
      '#17becf'  // teal
    ];
    
    return colors[index % colors.length];
  };
  
  // Handle variable change
  const handleVariableChange = (event: SelectChangeEvent) => {
    setSelectedVariable(event.target.value);
  };
  
  // Handle region change
  const handleRegionChange = (event: SelectChangeEvent) => {
    setSelectedRegion(event.target.value);
  };
  
  // Handle level change
  const handleLevelChange = (event: SelectChangeEvent) => {
    setSelectedLevel(event.target.value);
  };
  
  // Generate sample data for demonstration purposes
  const generateSamplePlots = () => {
    // For real implementation, this would come from comparisonData
    // Here we're generating some sample data for UI demonstration
    
    const variable = availableVariables.find(v => v.id === selectedVariable) || availableVariables[0];
    const region = availableRegions.find(r => r.id === selectedRegion) || availableRegions[0];
    
    const plots = {
      timeSeries: {
        title: `Time Series of ${variable.name} in ${region.name}`,
        subtitle: `At ${selectedLevel} level`,
        imageUrl: `https://via.placeholder.com/800x400?text=Time+Series+${variable.id}+${region.id}+${showAnomalies ? '+Anomalies' : ''}`
      },
      diurnal: {
        title: `Diurnal Cycle of ${variable.name} in ${region.name}`,
        subtitle: `At ${selectedLevel} level`,
        imageUrl: `https://via.placeholder.com/800x400?text=Diurnal+Cycle+${variable.id}+${region.id}`
      },
      trend: {
        title: `Trend Analysis of ${variable.name} in ${region.name}`,
        subtitle: `At ${selectedLevel} level`,
        imageUrl: `https://via.placeholder.com/800x400?text=Trend+Analysis+${variable.id}+${region.id}`
      },
      seasonal: {
        title: `Seasonal Cycle of ${variable.name} in ${region.name}`,
        subtitle: `At ${selectedLevel} level`,
        imageUrl: `https://via.placeholder.com/800x400?text=Seasonal+Cycle+${variable.id}+${region.id}`
      },
      cumulative: {
        title: `Cumulative ${variable.name} in ${region.name}`,
        subtitle: `At ${selectedLevel} level`,
        imageUrl: `https://via.placeholder.com/800x400?text=Cumulative+${variable.id}+${region.id}`
      },
      extremes: {
        title: `Extreme Values of ${variable.name} in ${region.name}`,
        subtitle: `At ${selectedLevel} level`,
        imageUrl: `https://via.placeholder.com/800x400?text=Extremes+${variable.id}+${region.id}`
      }
    };
    
    return plots;
  };
  
  const samplePlots = generateSamplePlots();
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Time Series Comparison
      </Typography>
      <Typography variant="body1" paragraph>
        Compare temporal patterns and trends across simulations.
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel id="timeseries-variable-label">Variable</InputLabel>
            <Select
              labelId="timeseries-variable-label"
              value={selectedVariable}
              label="Variable"
              onChange={handleVariableChange}
            >
              {availableVariables.map((variable) => (
                <MenuItem key={variable.id} value={variable.id}>
                  {variable.name} ({variable.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel id="timeseries-region-label">Region</InputLabel>
            <Select
              labelId="timeseries-region-label"
              value={selectedRegion}
              label="Region"
              onChange={handleRegionChange}
            >
              {availableRegions.map((region) => (
                <MenuItem key={region.id} value={region.id}>
                  {region.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel id="timeseries-level-label">Level</InputLabel>
            <Select
              labelId="timeseries-level-label"
              value={selectedLevel}
              label="Level"
              onChange={handleLevelChange}
            >
              <MenuItem value="surface">Surface</MenuItem>
              <MenuItem value="850hPa">850 hPa</MenuItem>
              <MenuItem value="500hPa">500 hPa</MenuItem>
              <MenuItem value="200hPa">200 hPa</MenuItem>
              <MenuItem value="column">Column Average</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showAnomalies}
                  onChange={() => setShowAnomalies(!showAnomalies)}
                />
              }
              label="Show Anomalies"
            />
          </Box>
        </Grid>
      </Grid>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Simulation Legend
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {simulationIds.map((simId, index) => (
            <Chip
              key={simId}
              label={getSimulationName(simId)}
              sx={{ 
                backgroundColor: getSimulationColor(index),
                color: 'white'
              }}
            />
          ))}
        </Box>
      </Box>
      
      <Grid container spacing={3}>
        {/* Main time series plot */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardMedia
              component="img"
              height="400"
              image={samplePlots.timeSeries.imageUrl}
              alt={samplePlots.timeSeries.title}
            />
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1">
                    {samplePlots.timeSeries.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {samplePlots.timeSeries.subtitle}
                  </Typography>
                </Box>
                <Box>
                  <Tooltip title="View Full Size">
                    <IconButton size="small" sx={{ mr: 1 }}>
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download Image">
                    <IconButton size="small">
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Options for additional plots */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Additional Analyses
            </Typography>
            <FormGroup row>
              <FormControlLabel
                control={
                  <Switch
                    checked={showDiurnal}
                    onChange={() => setShowDiurnal(!showDiurnal)}
                  />
                }
                label="Diurnal Cycle"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showTrend}
                    onChange={() => setShowTrend(!showTrend)}
                  />
                }
                label="Trend Analysis"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={showCumulative}
                    onChange={() => setShowCumulative(!showCumulative)}
                  />
                }
                label="Cumulative Values"
              />
            </FormGroup>
          </Paper>
        </Grid>
        
        {/* Additional plots based on selected options */}
        {showDiurnal && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={samplePlots.diurnal.imageUrl}
                alt={samplePlots.diurnal.title}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1">
                      {samplePlots.diurnal.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {samplePlots.diurnal.subtitle}
                    </Typography>
                  </Box>
                  <Box>
                    <Tooltip title="View Full Size">
                      <IconButton size="small" sx={{ mr: 1 }}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download Image">
                      <IconButton size="small">
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        {showTrend && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={samplePlots.trend.imageUrl}
                alt={samplePlots.trend.title}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1">
                      {samplePlots.trend.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {samplePlots.trend.subtitle}
                    </Typography>
                  </Box>
                  <Box>
                    <Tooltip title="View Full Size">
                      <IconButton size="small" sx={{ mr: 1 }}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download Image">
                      <IconButton size="small">
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardMedia
              component="img"
              height="300"
              image={samplePlots.seasonal.imageUrl}
              alt={samplePlots.seasonal.title}
            />
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1">
                    {samplePlots.seasonal.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {samplePlots.seasonal.subtitle}
                  </Typography>
                </Box>
                <Box>
                  <Tooltip title="View Full Size">
                    <IconButton size="small" sx={{ mr: 1 }}>
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download Image">
                    <IconButton size="small">
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {showCumulative && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={samplePlots.cumulative.imageUrl}
                alt={samplePlots.cumulative.title}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="subtitle1">
                      {samplePlots.cumulative.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {samplePlots.cumulative.subtitle}
                    </Typography>
                  </Box>
                  <Box>
                    <Tooltip title="View Full Size">
                      <IconButton size="small" sx={{ mr: 1 }}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Download Image">
                      <IconButton size="small">
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardMedia
              component="img"
              height="300"
              image={samplePlots.extremes.imageUrl}
              alt={samplePlots.extremes.title}
            />
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1">
                    {samplePlots.extremes.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {samplePlots.extremes.subtitle}
                  </Typography>
                </Box>
                <Box>
                  <Tooltip title="View Full Size">
                    <IconButton size="small" sx={{ mr: 1 }}>
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download Image">
                    <IconButton size="small">
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TimeSeriesComparison;