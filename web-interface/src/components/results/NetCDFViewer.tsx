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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  SelectChangeEvent
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import {
  fetchNetCDFMetadata,
  fetchNetCDFData,
  selectNetCDFMetadata,
  setSelectedVariables,
  NetCDFVariable,
  NetCDFDimension
} from '../../store/slices/resultsSlice';
import { RootState } from '../../store';

// Chart components
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, ScatterChart, Scatter, ZAxis, ContourChart, ContourPlot, Sankey
} from 'recharts';

interface NetCDFViewerProps {
  simulationId: string;
  filePath: string;
}

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
      id={`netcdf-tabpanel-${index}`}
      aria-labelledby={`netcdf-tab-${index}`}
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

// Helper function to determine if a variable is likely a GEOS-Chem species
const isGeosChemSpecies = (variable: NetCDFVariable): boolean => {
  // Common GEOS-Chem species naming patterns
  const speciesPatterns = [
    /^SpeciesConc_/, // Species concentration
    /^Aerosol/, // Aerosol-related variables
    /^Chem/, // Chemistry-related variables
    /^Dry/, // Dry deposition
    /^Emis/, // Emissions
    /^Inv/, // Inventory
    /^Met/, // Meteorology
    /^NH/, // NH compounds
    /^NO/, // NOx compounds
    /^O[0-9]/, // Ozone and related
    /^OH/, // OH radical
    /^PM/, // Particulate matter
    /^RH/, // Relative humidity
    /^SO/, // Sulfur compounds
    /^Temp/, // Temperature
    /^Wind/, // Wind variables
  ];
  
  // Check if variable name matches any pattern
  return speciesPatterns.some(pattern => pattern.test(variable.name)) ||
    // Check if long name contains common terms
    (variable.longName && /concentration|mixing ratio|flux|deposition/.test(variable.longName.toLowerCase()));
};

// Helper function to format dimension values nicely
const formatDimensionValues = (dimension: NetCDFDimension): string => {
  if (!dimension.values || dimension.values.length === 0) {
    return `Size: ${dimension.size}`;
  }
  
  if (dimension.values.length <= 5) {
    return `[${dimension.values.join(', ')}]`;
  }
  
  const first = dimension.values.slice(0, 2);
  const last = dimension.values.slice(-2);
  return `[${first.join(', ')}, ..., ${last.join(', ')}]`;
};

const NetCDFViewer: React.FC<NetCDFViewerProps> = ({ simulationId, filePath }) => {
  const dispatch = useDispatch();
  const [tabValue, setTabValue] = useState(0);
  const [selectedVariable, setSelectedVariable] = useState<string>('');
  const [selectedDimension, setSelectedDimension] = useState<string>('');
  const [sliceIndex, setSliceIndex] = useState<number>(0);
  const [visualizationType, setVisualizationType] = useState<string>('line');
  const [variableData, setVariableData] = useState<any>(null);
  
  // Get metadata from Redux store
  const metadata = useSelector(selectNetCDFMetadata(filePath));
  const { loading, error } = useSelector((state: RootState) => state.results);
  
  // Fetch metadata when component mounts
  useEffect(() => {
    if (!metadata) {
      dispatch(fetchNetCDFMetadata({ simulationId, filePath }) as any);
    }
  }, [dispatch, simulationId, filePath, metadata]);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Handle variable selection
  const handleVariableChange = (event: SelectChangeEvent<string>) => {
    setSelectedVariable(event.target.value);
    setVariableData(null); // Clear existing data
  };
  
  // Handle dimension selection for slicing
  const handleDimensionChange = (event: SelectChangeEvent<string>) => {
    setSelectedDimension(event.target.value);
    setSliceIndex(0); // Reset slice index
  };
  
  // Handle slice index change
  const handleSliceIndexChange = (event: SelectChangeEvent<string>) => {
    setSliceIndex(parseInt(event.target.value));
  };
  
  // Handle visualization type change
  const handleVisualizationTypeChange = (event: SelectChangeEvent<string>) => {
    setVisualizationType(event.target.value);
  };
  
  // Get dimensions for the selected variable
  const getVariableDimensions = (): NetCDFDimension[] => {
    if (!metadata || !selectedVariable) return [];
    
    const variable = metadata.variables.find(v => v.name === selectedVariable);
    if (!variable) return [];
    
    return variable.dimensions.map(dimName => 
      metadata.dimensions.find(d => d.name === dimName)
    ).filter(Boolean) as NetCDFDimension[];
  };
  
  // Determine if a variable is plottable (has numeric values and right dimensions)
  const isPlottableVariable = (variable: NetCDFVariable): boolean => {
    // Check if it has at least one dimension
    if (!variable.dimensions || variable.dimensions.length === 0) return false;
    
    // For now, consider most numeric variables as plottable
    return !variable.name.includes('ncontact') && 
           !variable.name.includes('AREA') &&
           variable.name !== 'tau';
  };
  
  // Get species variables - these are of particular interest for GEOS-Chem
  const getSpeciesVariables = (): NetCDFVariable[] => {
    if (!metadata) return [];
    return metadata.variables.filter(isGeosChemSpecies).filter(isPlottableVariable);
  };
  
  // Get meteorology variables - another important category for GEOS-Chem
  const getMeteorologicalVariables = (): NetCDFVariable[] => {
    if (!metadata) return [];
    return metadata.variables.filter(v => 
      (v.name.startsWith('Met') || 
       (v.longName && v.longName.toLowerCase().includes('meteorolog'))) &&
      isPlottableVariable(v)
    );
  };
  
  // Get other plottable variables
  const getOtherVariables = (): NetCDFVariable[] => {
    if (!metadata) return [];
    const species = new Set(getSpeciesVariables().map(v => v.name));
    const met = new Set(getMeteorologicalVariables().map(v => v.name));
    
    return metadata.variables.filter(v => 
      !species.has(v.name) && 
      !met.has(v.name) && 
      isPlottableVariable(v)
    );
  };
  
  // Fetch data for the selected variable
  const fetchVariableData = async () => {
    if (!selectedVariable) {
      return;
    }
    
    const variable = metadata.variables.find(v => v.name === selectedVariable);
    if (!variable) return;
    
    const dimensions: Record<string, number | [number, number]> = {};
    
    if (selectedDimension && sliceIndex !== null) {
      // Set the selected dimension to the specific slice index
      dimensions[selectedDimension] = sliceIndex;
    }
    
    try {
      const result = await dispatch(fetchNetCDFData({
        simulationId,
        filePath,
        variable: selectedVariable,
        dimensions
      }) as any);
      
      if (result.payload && result.payload.data) {
        setVariableData(result.payload.data);
      }
    } catch (error) {
      console.error('Error fetching variable data:', error);
    }
  };
  
  // Format the data for visualization
  const formatDataForVisualization = () => {
    if (!variableData || !metadata) return [];
    
    // Find the variable object
    const variable = metadata.variables.find(v => v.name === selectedVariable);
    if (!variable) return [];
    
    // Different formatting depending on the dimensions and visualization type
    try {
      if (Array.isArray(variableData.values)) {
        // For 1D data (simple array of values)
        if (variableData.coordinates && variableData.coordinates.length > 0) {
          // We have coordinate values
          return variableData.values.map((value: number, index: number) => ({
            x: variableData.coordinates[0][index],
            y: value
          }));
        } else {
          // No coordinates, use array indices
          return variableData.values.map((value: number, index: number) => ({
            x: index,
            y: value
          }));
        }
      } else if (typeof variableData.values === 'object') {
        // For 2D data (comes as a nested object or array)
        if (visualizationType === 'contour' || visualizationType === 'heatmap') {
          // For 2D plots, we want the raw data
          return variableData.values;
        } else {
          // For other plots, we need to convert to a format that works with Recharts
          // This assumes the first dimension is the x-axis
          const result = [];
          for (const [key, values] of Object.entries(variableData.values)) {
            if (Array.isArray(values)) {
              values.forEach((value, index) => {
                if (!result[index]) {
                  result[index] = { x: index };
                }
                result[index][key] = value;
              });
            }
          }
          return result;
        }
      }
    } catch (error) {
      console.error('Error formatting data:', error);
      return [];
    }
    
    return [];
  };
  
  // Render the visualization based on data type and selection
  const renderVisualization = () => {
    if (!variableData) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Select a variable and click Visualize to view the data
          </Typography>
        </Box>
      );
    }
    
    const formattedData = formatDataForVisualization();
    if (formattedData.length === 0) {
      return (
        <Alert severity="warning">
          Unable to visualize this data with the current settings
        </Alert>
      );
    }
    
    // Get the variable object
    const variable = metadata.variables.find(v => v.name === selectedVariable);
    const units = variable?.units || '';
    
    // Determine axis labels
    let xAxisLabel = selectedDimension || 'Index';
    const dimObj = metadata.dimensions.find(d => d.name === selectedDimension);
    if (dimObj && dimObj.units) {
      xAxisLabel += ` (${dimObj.units})`;
    }
    
    let yAxisLabel = `${selectedVariable}`;
    if (units) {
      yAxisLabel += ` (${units})`;
    }
    
    switch (visualizationType) {
      case 'line':
        return (
          <Box sx={{ width: '100%', height: 400 }}>
            <Typography variant="h6" align="center" gutterBottom>
              {selectedVariable} Line Plot
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="x" 
                  label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }} 
                />
                <YAxis 
                  label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip formatter={(value) => [value, selectedVariable]} />
                <Legend />
                <Line type="monotone" dataKey="y" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        );
        
      case 'bar':
        return (
          <Box sx={{ width: '100%', height: 400 }}>
            <Typography variant="h6" align="center" gutterBottom>
              {selectedVariable} Bar Chart
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="x" 
                  label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }} 
                />
                <YAxis 
                  label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip formatter={(value) => [value, selectedVariable]} />
                <Legend />
                <Bar dataKey="y" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        );
        
      case 'scatter':
        return (
          <Box sx={{ width: '100%', height: 400 }}>
            <Typography variant="h6" align="center" gutterBottom>
              {selectedVariable} Scatter Plot
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name={xAxisLabel}
                  label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }} 
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name={yAxisLabel}
                  label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} 
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name={selectedVariable} data={formattedData} fill="#8884d8" />
              </ScatterChart>
            </ResponsiveContainer>
          </Box>
        );
        
      default:
        return (
          <Alert severity="info">
            The selected visualization type is not supported for this data
          </Alert>
        );
    }
  };
  
  // Render metadata panel
  const renderMetadataPanel = () => {
    if (!metadata) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No metadata available
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          File Metadata
        </Typography>
        
        {/* Global Attributes */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Global Attributes</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Attribute</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metadata.globalAttributes).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell component="th" scope="row">
                        {key}
                      </TableCell>
                      <TableCell>{String(value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
        
        {/* Dimensions */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Dimensions</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Units</TableCell>
                    <TableCell>Values</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metadata.dimensions.map((dimension) => (
                    <TableRow key={dimension.name}>
                      <TableCell component="th" scope="row">
                        {dimension.name}
                      </TableCell>
                      <TableCell>{dimension.size}</TableCell>
                      <TableCell>{dimension.units || 'N/A'}</TableCell>
                      <TableCell>
                        <Box 
                          sx={{ 
                            maxWidth: 300, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' 
                          }}
                        >
                          {formatDimensionValues(dimension)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
        
        {/* Variables */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Variables</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Long Name</TableCell>
                    <TableCell>Units</TableCell>
                    <TableCell>Dimensions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metadata.variables.map((variable) => (
                    <TableRow key={variable.name}>
                      <TableCell component="th" scope="row">
                        {variable.name}
                      </TableCell>
                      <TableCell>{variable.longName || 'N/A'}</TableCell>
                      <TableCell>{variable.units || 'N/A'}</TableCell>
                      <TableCell>{variable.dimensions.join(', ')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  };
  
  // Render visualization panel
  const renderVisualizationPanel = () => {
    if (!metadata) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No metadata available. Cannot generate visualizations.
          </Typography>
        </Box>
      );
    }
    
    const speciesVariables = getSpeciesVariables();
    const metVariables = getMeteorologicalVariables();
    const otherVariables = getOtherVariables();
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Visualize NetCDF Data
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="variable-select-label">Variable</InputLabel>
              <Select
                labelId="variable-select-label"
                id="variable-select"
                value={selectedVariable}
                label="Variable"
                onChange={handleVariableChange}
              >
                {speciesVariables.length > 0 && (
                  <MenuItem disabled>
                    <Typography variant="caption" color="text.secondary">
                      Species Variables
                    </Typography>
                  </MenuItem>
                )}
                {speciesVariables.map((variable) => (
                  <MenuItem key={variable.name} value={variable.name}>
                    {variable.name} {variable.units ? `(${variable.units})` : ''}
                  </MenuItem>
                ))}
                
                {metVariables.length > 0 && (
                  <MenuItem disabled>
                    <Typography variant="caption" color="text.secondary">
                      Meteorological Variables
                    </Typography>
                  </MenuItem>
                )}
                {metVariables.map((variable) => (
                  <MenuItem key={variable.name} value={variable.name}>
                    {variable.name} {variable.units ? `(${variable.units})` : ''}
                  </MenuItem>
                ))}
                
                {otherVariables.length > 0 && (
                  <MenuItem disabled>
                    <Typography variant="caption" color="text.secondary">
                      Other Variables
                    </Typography>
                  </MenuItem>
                )}
                {otherVariables.map((variable) => (
                  <MenuItem key={variable.name} value={variable.name}>
                    {variable.name} {variable.units ? `(${variable.units})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2 }} disabled={!selectedVariable}>
              <InputLabel id="dimension-select-label">Dimension to Slice</InputLabel>
              <Select
                labelId="dimension-select-label"
                id="dimension-select"
                value={selectedDimension}
                label="Dimension to Slice"
                onChange={handleDimensionChange}
              >
                <MenuItem value="">
                  <em>None (use all data)</em>
                </MenuItem>
                {getVariableDimensions().map((dimension) => (
                  <MenuItem key={dimension.name} value={dimension.name}>
                    {dimension.name} (size: {dimension.size})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          {selectedDimension && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="slice-index-label">Slice Index</InputLabel>
                <Select
                  labelId="slice-index-label"
                  id="slice-index"
                  value={String(sliceIndex)}
                  label="Slice Index"
                  onChange={handleSliceIndexChange}
                >
                  {Array.from({ length: getVariableDimensions().find(d => d.name === selectedDimension)?.size || 0 }, (_, i) => (
                    <MenuItem key={i} value={String(i)}>
                      {i} {getVariableDimensions().find(d => d.name === selectedDimension)?.values?.[i] ? 
                        `(${getVariableDimensions().find(d => d.name === selectedDimension)?.values?.[i]})` : 
                        ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="visualization-type-label">Visualization Type</InputLabel>
              <Select
                labelId="visualization-type-label"
                id="visualization-type"
                value={visualizationType}
                label="Visualization Type"
                onChange={handleVisualizationTypeChange}
              >
                <MenuItem value="line">Line Chart</MenuItem>
                <MenuItem value="bar">Bar Chart</MenuItem>
                <MenuItem value="scatter">Scatter Plot</MenuItem>
                <MenuItem value="contour" disabled>Contour Map (Coming Soon)</MenuItem>
                <MenuItem value="heatmap" disabled>Heat Map (Coming Soon)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={fetchVariableData}
              disabled={!selectedVariable || loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'Visualize Data'}
            </Button>
          </Grid>
        </Grid>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mt: 3 }}>
          {renderVisualization()}
        </Box>
      </Box>
    );
  };
  
  if (loading && !metadata) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error && !metadata) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load NetCDF metadata: {error}
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
            aria-label="netcdf viewer tabs"
          >
            <Tab label="Visualization" id="netcdf-tab-0" aria-controls="netcdf-tabpanel-0" />
            <Tab label="Metadata" id="netcdf-tab-1" aria-controls="netcdf-tabpanel-1" />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          {renderVisualizationPanel()}
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {renderMetadataPanel()}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default NetCDFViewer;