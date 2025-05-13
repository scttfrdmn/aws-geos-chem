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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
  Divider,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import {
  CloudDownload as DownloadIcon,
  BarChart as BarChartIcon,
  ScatterPlot as ScatterPlotIcon,
  BubbleChart as BubbleChartIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SelectChangeEvent } from '@mui/material';

interface StatisticalComparisonProps {
  comparisonData: any;
  simulationIds: string[];
}

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
      id={`statistical-tabpanel-${index}`}
      aria-labelledby={`statistical-tab-${index}`}
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

const StatisticalComparison: React.FC<StatisticalComparisonProps> = ({
  comparisonData,
  simulationIds
}) => {
  const { simulations } = useSelector((state: RootState) => state.simulations);
  
  const [selectedVariable, setSelectedVariable] = useState<string>('O3');
  const [selectedRegion, setSelectedRegion] = useState<string>('global');
  const [tabValue, setTabValue] = useState(0);
  
  // Get simulation names from IDs
  const getSimulationName = (simId: string) => {
    const simulation = simulations.find(sim => sim.id === simId);
    return simulation ? simulation.name : simId;
  };
  
  // Handle variable change
  const handleVariableChange = (event: SelectChangeEvent) => {
    setSelectedVariable(event.target.value);
  };
  
  // Handle region change
  const handleRegionChange = (event: SelectChangeEvent) => {
    setSelectedRegion(event.target.value);
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Generate sample data for demonstration purposes
  const generateSampleData = () => {
    // For real implementation, this would come from comparisonData
    // Here we're generating some sample data for UI demonstration
    
    const variable = availableVariables.find(v => v.id === selectedVariable) || availableVariables[0];
    const region = availableRegions.find(r => r.id === selectedRegion) || availableRegions[0];
    
    // Statistical metrics for each simulation
    const statistics = simulationIds.map((simId, index) => {
      const baseValue = variable.id === 'O3' ? 30 + index * 3 :
                       variable.id === 'CO' ? 120 + index * 15 :
                       variable.id === 'PM25' ? 15 + index * 2 :
                       variable.id === 'AOD' ? 0.5 + index * 0.1 :
                       10 + index * 2;
      
      return {
        simulationId: simId,
        name: getSimulationName(simId),
        mean: baseValue + Math.random() * 5,
        median: baseValue + Math.random() * 4,
        stdDev: baseValue * 0.2 + Math.random() * 2,
        min: baseValue * 0.5 + Math.random() * 1,
        max: baseValue * 1.5 + Math.random() * 10,
        p25: baseValue * 0.8 + Math.random() * 3,
        p75: baseValue * 1.2 + Math.random() * 7,
        spatialCorrelation: 0.7 + Math.random() * 0.3 - index * 0.05,
        temporalCorrelation: 0.65 + Math.random() * 0.35 - index * 0.04,
        bias: (Math.random() - 0.5) * baseValue * 0.1,
        rmse: baseValue * 0.15 + Math.random() * 3
      };
    });
    
    // Correlation data for scatter plots
    const correlationMatrix = simulationIds.map((simId1, i) => {
      return simulationIds.map((simId2, j) => {
        return {
          sim1: simId1,
          sim2: simId2,
          name1: getSimulationName(simId1),
          name2: getSimulationName(simId2),
          correlation: i === j ? 1 : 0.95 - Math.abs(i - j) * 0.15 + Math.random() * 0.1
        };
      });
    });
    
    // Taylor diagram data
    const taylorDiagram = simulationIds.map((simId, index) => {
      return {
        simulationId: simId,
        name: getSimulationName(simId),
        standardDeviation: 1.0 + (Math.random() - 0.5) * 0.4,
        correlation: 0.9 - index * 0.1 + Math.random() * 0.1,
        rmse: 0.2 + index * 0.15 + Math.random() * 0.1
      };
    });
    
    // Sample plots
    const plots = {
      scatter: {
        title: `Scatter Plot Comparison for ${variable.name} in ${region.name}`,
        imageUrl: `https://via.placeholder.com/800x400?text=Scatter+Plot+${variable.id}+${region.id}`
      },
      taylor: {
        title: `Taylor Diagram for ${variable.name} in ${region.name}`,
        imageUrl: `https://via.placeholder.com/800x400?text=Taylor+Diagram+${variable.id}+${region.id}`
      },
      boxplot: {
        title: `Box Plot Comparison for ${variable.name} in ${region.name}`,
        imageUrl: `https://via.placeholder.com/800x400?text=Box+Plot+${variable.id}+${region.id}`
      },
      histogram: {
        title: `Histogram Comparison for ${variable.name} in ${region.name}`,
        imageUrl: `https://via.placeholder.com/800x400?text=Histogram+${variable.id}+${region.id}`
      },
      correlation: {
        title: `Correlation Matrix for ${variable.name} in ${region.name}`,
        imageUrl: `https://via.placeholder.com/800x400?text=Correlation+Matrix+${variable.id}+${region.id}`
      }
    };
    
    return {
      statistics,
      correlationMatrix: correlationMatrix.flat(),
      taylorDiagram,
      plots
    };
  };
  
  const sampleData = generateSampleData();
  
  // Highlight cells with significant differences
  const highlightCell = (value1: number, value2: number, threshold: number = 0.1) => {
    const relativeDiff = Math.abs((value1 - value2) / value1);
    return relativeDiff > threshold;
  };
  
  // Format correlation value
  const formatCorrelation = (value: number) => {
    return value.toFixed(3);
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Statistical Comparison
      </Typography>
      <Typography variant="body1" paragraph>
        Compare statistical metrics and distributions across simulations.
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="statistical-variable-label">Variable</InputLabel>
            <Select
              labelId="statistical-variable-label"
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
        
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel id="statistical-region-label">Region</InputLabel>
            <Select
              labelId="statistical-region-label"
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
      </Grid>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="statistical comparison tabs">
          <Tab label="Summary Statistics" id="statistical-tab-0" aria-controls="statistical-tabpanel-0" />
          <Tab label="Correlation Analysis" id="statistical-tab-1" aria-controls="statistical-tabpanel-1" />
          <Tab label="Distribution Comparison" id="statistical-tab-2" aria-controls="statistical-tabpanel-2" />
        </Tabs>
      </Box>
      
      <TabPanel value={tabValue} index={0}>
        <Typography variant="subtitle1" gutterBottom>
          Statistical Metrics
        </Typography>
        
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Metric</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell key={stat.simulationId}>
                    {stat.name}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Mean</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell 
                    key={`${stat.simulationId}-mean`}
                    sx={{ 
                      backgroundColor: sampleData.statistics.length > 1 && 
                        highlightCell(stat.mean, sampleData.statistics[0].mean) ? 
                        'rgba(255, 235, 59, 0.1)' : 'inherit' 
                    }}
                  >
                    {stat.mean.toFixed(3)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Median</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell 
                    key={`${stat.simulationId}-median`}
                    sx={{ 
                      backgroundColor: sampleData.statistics.length > 1 && 
                        highlightCell(stat.median, sampleData.statistics[0].median) ? 
                        'rgba(255, 235, 59, 0.1)' : 'inherit' 
                    }}
                  >
                    {stat.median.toFixed(3)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Standard Deviation</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell 
                    key={`${stat.simulationId}-stdDev`}
                    sx={{ 
                      backgroundColor: sampleData.statistics.length > 1 && 
                        highlightCell(stat.stdDev, sampleData.statistics[0].stdDev) ? 
                        'rgba(255, 235, 59, 0.1)' : 'inherit' 
                    }}
                  >
                    {stat.stdDev.toFixed(3)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Minimum</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell key={`${stat.simulationId}-min`}>{stat.min.toFixed(3)}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Maximum</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell key={`${stat.simulationId}-max`}>{stat.max.toFixed(3)}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>25th Percentile</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell key={`${stat.simulationId}-p25`}>{stat.p25.toFixed(3)}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>75th Percentile</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell key={`${stat.simulationId}-p75`}>{stat.p75.toFixed(3)}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Bias</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell 
                    key={`${stat.simulationId}-bias`}
                    sx={{ 
                      color: stat.bias > 0 ? 'error.main' : stat.bias < 0 ? 'info.main' : 'text.primary' 
                    }}
                  >
                    {stat.bias > 0 ? '+' : ''}{stat.bias.toFixed(3)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>RMSE</TableCell>
                {sampleData.statistics.map((stat) => (
                  <TableCell 
                    key={`${stat.simulationId}-rmse`}
                    sx={{ 
                      backgroundColor: sampleData.statistics.length > 1 && 
                        highlightCell(stat.rmse, sampleData.statistics[0].rmse) ? 
                        'rgba(255, 235, 59, 0.1)' : 'inherit' 
                    }}
                  >
                    {stat.rmse.toFixed(3)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={sampleData.plots.boxplot.imageUrl}
                alt={sampleData.plots.boxplot.title}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    {sampleData.plots.boxplot.title}
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
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={sampleData.plots.histogram.imageUrl}
                alt={sampleData.plots.histogram.title}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    {sampleData.plots.histogram.title}
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
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Typography variant="subtitle1" gutterBottom>
          Correlation Matrix
        </Typography>
        
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell></TableCell>
                {simulationIds.map((simId) => (
                  <TableCell key={simId}>
                    {getSimulationName(simId)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {simulationIds.map((simId1, i) => (
                <TableRow key={simId1}>
                  <TableCell>
                    <strong>{getSimulationName(simId1)}</strong>
                  </TableCell>
                  {simulationIds.map((simId2, j) => {
                    const correlation = sampleData.correlationMatrix.find(
                      c => c.sim1 === simId1 && c.sim2 === simId2
                    )?.correlation || 0;
                    
                    return (
                      <TableCell 
                        key={`${simId1}-${simId2}`}
                        sx={{ 
                          backgroundColor: i === j ? 'inherit' : 
                            `rgba(25, 118, 210, ${correlation.toFixed(2)})`,
                          color: correlation > 0.5 ? 'white' : 'inherit'
                        }}
                      >
                        {formatCorrelation(correlation)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={sampleData.plots.scatter.imageUrl}
                alt={sampleData.plots.scatter.title}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    {sampleData.plots.scatter.title}
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
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="300"
                image={sampleData.plots.correlation.imageUrl}
                alt={sampleData.plots.correlation.title}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    {sampleData.plots.correlation.title}
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
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Typography variant="subtitle1" gutterBottom>
          Taylor Diagram
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card variant="outlined">
              <CardMedia
                component="img"
                height="500"
                image={sampleData.plots.taylor.imageUrl}
                alt={sampleData.plots.taylor.title}
              />
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1">
                    {sampleData.plots.taylor.title}
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
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Simulation</TableCell>
                    <TableCell>Standard Deviation</TableCell>
                    <TableCell>Correlation</TableCell>
                    <TableCell>RMSE</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sampleData.taylorDiagram.map((item) => (
                    <TableRow key={item.simulationId}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.standardDeviation.toFixed(3)}</TableCell>
                      <TableCell>{item.correlation.toFixed(3)}</TableCell>
                      <TableCell>{item.rmse.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Taylor Diagram Interpretation
              </Typography>
              <Typography variant="body2" paragraph>
                The Taylor diagram provides a way to summarize multiple aspects of model performance:
              </Typography>
              <ul>
                <li>
                  <Typography variant="body2">
                    <strong>Standard Deviation:</strong> Represents the amplitude of variations. Values closer to 1.0 indicate similar variability to the reference.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Correlation:</strong> Distance from origin represents correlation with the reference. Higher values indicate better pattern matching.
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>RMSE:</strong> Distance from the reference point. Smaller distances indicate better overall agreement.
                  </Typography>
                </li>
              </ul>
            </Box>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default StatisticalComparison;