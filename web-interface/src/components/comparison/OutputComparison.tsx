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
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  Map as MapIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SelectChangeEvent } from '@mui/material';

interface OutputComparisonProps {
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

// Define TabPanel component
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
      id={`output-tabpanel-${index}`}
      aria-labelledby={`output-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const OutputComparison: React.FC<OutputComparisonProps> = ({
  comparisonData,
  simulationIds
}) => {
  const { simulations } = useSelector((state: RootState) => state.simulations);
  
  const [selectedVariable, setSelectedVariable] = useState<string>('O3');
  const [selectedLevel, setSelectedLevel] = useState<string>('surface');
  const [selectedRegion, setSelectedRegion] = useState<string>('global');
  const [tabValue, setTabValue] = useState(0);
  const [showRelativeDifference, setShowRelativeDifference] = useState(false);
  
  // Get simulation names from IDs
  const getSimulationName = (simId: string) => {
    const simulation = simulations.find(sim => sim.id === simId);
    return simulation ? simulation.name : simId;
  };
  
  // Handle variable change
  const handleVariableChange = (event: SelectChangeEvent) => {
    setSelectedVariable(event.target.value);
  };
  
  // Handle level change
  const handleLevelChange = (event: SelectChangeEvent) => {
    setSelectedLevel(event.target.value);
  };
  
  // Handle region change
  const handleRegionChange = (event: SelectChangeEvent) => {
    setSelectedRegion(event.target.value);
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Toggle between absolute and relative differences
  const handleToggleRelativeDifference = () => {
    setShowRelativeDifference(!showRelativeDifference);
  };
  
  // Generate sample data for demonstration purposes
  const generateSampleData = () => {
    // For real implementation, this would come from comparisonData
    // Here we're generating some sample data for UI demonstration
    
    // Global statistics
    const globalStats = simulationIds.map((simId, index) => {
      const baseValue = selectedVariable === 'O3' ? 30 + index * 5 :
                       selectedVariable === 'CO' ? 120 + index * 20 :
                       selectedVariable === 'PM25' ? 15 + index * 3 :
                       selectedVariable === 'AOD' ? 0.5 + index * 0.1 :
                       10 + index * 2;
      
      return {
        simulationId: simId,
        name: getSimulationName(simId),
        globalMean: baseValue + Math.random() * 5,
        globalMin: baseValue * 0.5 + Math.random() * 2,
        globalMax: baseValue * 1.5 + Math.random() * 10,
        landMean: baseValue * 1.2 + Math.random() * 5,
        oceanMean: baseValue * 0.8 + Math.random() * 3,
        northernHemisphereMean: baseValue * 1.1 + Math.random() * 4,
        southernHemisphereMean: baseValue * 0.9 + Math.random() * 3
      };
    });
    
    // Regional statistics for selected region
    const regionalStats = {
      region: selectedRegion,
      simulations: simulationIds.map((simId, index) => {
        const baseValue = selectedVariable === 'O3' ? 35 + index * 6 :
                         selectedVariable === 'CO' ? 140 + index * 25 :
                         selectedVariable === 'PM25' ? 18 + index * 4 :
                         selectedVariable === 'AOD' ? 0.6 + index * 0.15 :
                         12 + index * 3;
        
        return {
          simulationId: simId,
          name: getSimulationName(simId),
          mean: baseValue + Math.random() * 6,
          min: baseValue * 0.4 + Math.random() * 2,
          max: baseValue * 1.6 + Math.random() * 12,
          stdDev: baseValue * 0.2 + Math.random() * 1
        };
      })
    };
    
    return {
      globalStats,
      regionalStats,
      // Images would be URLs to plots in real implementation
      plots: {
        globalMap: `https://via.placeholder.com/800x400?text=Global+Map+${selectedVariable}`,
        timeSeries: `https://via.placeholder.com/800x400?text=Time+Series+${selectedVariable}`,
        histogram: `https://via.placeholder.com/800x400?text=Histogram+${selectedVariable}`,
        difference: `https://via.placeholder.com/800x400?text=Difference+Map+${selectedVariable}+${showRelativeDifference ? 'Relative' : 'Absolute'}`
      }
    };
  };
  
  const sampleData = generateSampleData();
  
  // Calculate differences between simulations
  const calculateDifferences = () => {
    if (sampleData.globalStats.length < 2) return [];
    
    const baseStats = sampleData.globalStats[0];
    
    return sampleData.globalStats.slice(1).map(stats => {
      const diffGlobalMean = showRelativeDifference
        ? ((stats.globalMean - baseStats.globalMean) / baseStats.globalMean) * 100
        : stats.globalMean - baseStats.globalMean;
      
      const diffLandMean = showRelativeDifference
        ? ((stats.landMean - baseStats.landMean) / baseStats.landMean) * 100
        : stats.landMean - baseStats.landMean;
      
      const diffOceanMean = showRelativeDifference
        ? ((stats.oceanMean - baseStats.oceanMean) / baseStats.oceanMean) * 100
        : stats.oceanMean - baseStats.oceanMean;
      
      const diffNHMean = showRelativeDifference
        ? ((stats.northernHemisphereMean - baseStats.northernHemisphereMean) / baseStats.northernHemisphereMean) * 100
        : stats.northernHemisphereMean - baseStats.northernHemisphereMean;
      
      const diffSHMean = showRelativeDifference
        ? ((stats.southernHemisphereMean - baseStats.southernHemisphereMean) / baseStats.southernHemisphereMean) * 100
        : stats.southernHemisphereMean - baseStats.southernHemisphereMean;
      
      return {
        simulationId: stats.simulationId,
        name: stats.name,
        diffGlobalMean,
        diffLandMean,
        diffOceanMean,
        diffNHMean,
        diffSHMean
      };
    });
  };
  
  const differences = calculateDifferences();
  
  // Format difference values for display
  const formatDifference = (value: number) => {
    if (showRelativeDifference) {
      return `${value.toFixed(2)}%`;
    } else {
      const variable = availableVariables.find(v => v.id === selectedVariable);
      return `${value.toFixed(3)} ${variable?.unit || ''}`;
    }
  };
  
  // Get color based on difference value
  const getDifferenceColor = (value: number) => {
    if (value > 0) {
      return 'error.main'; // Positive difference
    } else if (value < 0) {
      return 'info.main'; // Negative difference
    } else {
      return 'text.primary'; // No difference
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Output Comparison
      </Typography>
      <Typography variant="body1" paragraph>
        Compare output variables across simulations.
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="variable-select-label">Variable</InputLabel>
            <Select
              labelId="variable-select-label"
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
        
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="level-select-label">Level</InputLabel>
            <Select
              labelId="level-select-label"
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
        
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="region-select-label">Region</InputLabel>
            <Select
              labelId="region-select-label"
              value={selectedRegion}
              label="Region"
              onChange={handleRegionChange}
            >
              <MenuItem value="global">Global</MenuItem>
              <MenuItem value="north_america">North America</MenuItem>
              <MenuItem value="europe">Europe</MenuItem>
              <MenuItem value="asia">Asia</MenuItem>
              <MenuItem value="tropics">Tropics</MenuItem>
              <MenuItem value="southern_ocean">Southern Ocean</MenuItem>
              <MenuItem value="arctic">Arctic</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="output comparison tabs">
          <Tab label="Statistics" id="output-tab-0" aria-controls="output-tabpanel-0" />
          <Tab label="Visualizations" id="output-tab-1" aria-controls="output-tabpanel-1" />
          <Tab label="Differences" id="output-tab-2" aria-controls="output-tabpanel-2" />
        </Tabs>
      </Box>
      
      <TabPanel value={tabValue} index={0}>
        <Typography variant="subtitle1" gutterBottom>
          Global Statistics for {availableVariables.find(v => v.id === selectedVariable)?.name || selectedVariable}
        </Typography>
        
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Simulation</TableCell>
                <TableCell>Global Mean</TableCell>
                <TableCell>Global Min</TableCell>
                <TableCell>Global Max</TableCell>
                <TableCell>Land Mean</TableCell>
                <TableCell>Ocean Mean</TableCell>
                <TableCell>NH Mean</TableCell>
                <TableCell>SH Mean</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sampleData.globalStats.map((stats, index) => (
                <TableRow key={stats.simulationId}>
                  <TableCell>{stats.name}</TableCell>
                  <TableCell>{stats.globalMean.toFixed(3)}</TableCell>
                  <TableCell>{stats.globalMin.toFixed(3)}</TableCell>
                  <TableCell>{stats.globalMax.toFixed(3)}</TableCell>
                  <TableCell>{stats.landMean.toFixed(3)}</TableCell>
                  <TableCell>{stats.oceanMean.toFixed(3)}</TableCell>
                  <TableCell>{stats.northernHemisphereMean.toFixed(3)}</TableCell>
                  <TableCell>{stats.southernHemisphereMean.toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Typography variant="subtitle1" gutterBottom>
          Regional Statistics: {selectedRegion.charAt(0).toUpperCase() + selectedRegion.slice(1).replace('_', ' ')}
        </Typography>
        
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Simulation</TableCell>
                <TableCell>Mean</TableCell>
                <TableCell>Min</TableCell>
                <TableCell>Max</TableCell>
                <TableCell>Std. Dev.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sampleData.regionalStats.simulations.map((stats, index) => (
                <TableRow key={stats.simulationId}>
                  <TableCell>{stats.name}</TableCell>
                  <TableCell>{stats.mean.toFixed(3)}</TableCell>
                  <TableCell>{stats.min.toFixed(3)}</TableCell>
                  <TableCell>{stats.max.toFixed(3)}</TableCell>
                  <TableCell>{stats.stdDev.toFixed(3)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={sampleData.plots.globalMap}
                alt="Global Map"
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    Global Distribution
                  </Typography>
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
                <Typography variant="body2" color="text.secondary">
                  Global distribution of {availableVariables.find(v => v.id === selectedVariable)?.name || selectedVariable} at {selectedLevel} level
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={sampleData.plots.timeSeries}
                alt="Time Series"
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    Time Series Comparison
                  </Typography>
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
                <Typography variant="body2" color="text.secondary">
                  Time series of {availableVariables.find(v => v.id === selectedVariable)?.name || selectedVariable} averaged over {selectedRegion.replace('_', ' ')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={sampleData.plots.histogram}
                alt="Histogram"
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    Distribution Histogram
                  </Typography>
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
                <Typography variant="body2" color="text.secondary">
                  Histogram showing distribution of {availableVariables.find(v => v.id === selectedVariable)?.name || selectedVariable} values
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="subtitle1">
            Differences Relative to {sampleData.globalStats[0]?.name || 'Baseline'}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showRelativeDifference}
                onChange={handleToggleRelativeDifference}
              />
            }
            label={showRelativeDifference ? "Relative Differences (%)" : "Absolute Differences"}
          />
        </Box>
        
        {differences.length > 0 ? (
          <>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Simulation</TableCell>
                    <TableCell>Global Mean</TableCell>
                    <TableCell>Land Mean</TableCell>
                    <TableCell>Ocean Mean</TableCell>
                    <TableCell>NH Mean</TableCell>
                    <TableCell>SH Mean</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {differences.map((diff) => (
                    <TableRow key={diff.simulationId}>
                      <TableCell>{diff.name}</TableCell>
                      <TableCell sx={{ color: getDifferenceColor(diff.diffGlobalMean) }}>
                        {formatDifference(diff.diffGlobalMean)}
                      </TableCell>
                      <TableCell sx={{ color: getDifferenceColor(diff.diffLandMean) }}>
                        {formatDifference(diff.diffLandMean)}
                      </TableCell>
                      <TableCell sx={{ color: getDifferenceColor(diff.diffOceanMean) }}>
                        {formatDifference(diff.diffOceanMean)}
                      </TableCell>
                      <TableCell sx={{ color: getDifferenceColor(diff.diffNHMean) }}>
                        {formatDifference(diff.diffNHMean)}
                      </TableCell>
                      <TableCell sx={{ color: getDifferenceColor(diff.diffSHMean) }}>
                        {formatDifference(diff.diffSHMean)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="400"
                image={sampleData.plots.difference}
                alt="Difference Map"
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    {showRelativeDifference ? 'Relative' : 'Absolute'} Difference Map
                  </Typography>
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
                <Typography variant="body2" color="text.secondary">
                  {showRelativeDifference ? 'Relative (%)' : 'Absolute'} difference in {availableVariables.find(v => v.id === selectedVariable)?.name || selectedVariable} between simulations
                </Typography>
              </CardContent>
            </Card>
          </>
        ) : (
          <Alert severity="info">
            At least two simulations are required to calculate differences.
          </Alert>
        )}
      </TabPanel>
    </Box>
  );
};

export default OutputComparison;