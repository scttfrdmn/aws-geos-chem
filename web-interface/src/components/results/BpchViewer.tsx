import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  SelectChangeEvent
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Mock API function for BPCH parsing - this would need backend support
const parseBpchFile = async (simulationId: string, filePath: string) => {
  // This is a placeholder for the actual API call to parse BPCH file
  // In a real implementation, this would call a Lambda function that uses
  // the xbpch library or similar to parse binary punch files
  
  // Simulate a network request
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock data
  return {
    diagnostics: [
      {
        name: 'IJ-AVG-$',
        description: 'Tracer Average IJ',
        tracers: [
          { id: 1, name: 'O3', fullName: 'Ozone', units: 'ppbv' },
          { id: 2, name: 'NO', fullName: 'Nitric oxide', units: 'ppbv' },
          { id: 3, name: 'NO2', fullName: 'Nitrogen dioxide', units: 'ppbv' },
          { id: 4, name: 'HNO3', fullName: 'Nitric acid', units: 'ppbv' },
          { id: 5, name: 'PAN', fullName: 'Peroxyacetyl nitrate', units: 'ppbv' }
        ],
        scale: 1.0,
        units: 'ppbv'
      },
      {
        name: 'DRYD-FLX',
        description: 'Dry deposition flux',
        tracers: [
          { id: 1, name: 'O3', fullName: 'Ozone', units: 'molec/cm2/s' },
          { id: 3, name: 'NO2', fullName: 'Nitrogen dioxide', units: 'molec/cm2/s' },
          { id: 4, name: 'HNO3', fullName: 'Nitric acid', units: 'molec/cm2/s' }
        ],
        scale: 1.0e-11,
        units: 'molec/cm2/s'
      },
      {
        name: 'WETDCV',
        description: 'Wet deposition (convective)',
        tracers: [
          { id: 4, name: 'HNO3', fullName: 'Nitric acid', units: 'molec/cm2/s' },
          { id: 9, name: 'SO2', fullName: 'Sulfur dioxide', units: 'molec/cm2/s' }
        ],
        scale: 1.0e-12,
        units: 'molec/cm2/s'
      }
    ],
    dimensions: {
      longitude: { size: 72, values: Array.from({ length: 72 }, (_, i) => -180 + i * 5) },
      latitude: { size: 46, values: Array.from({ length: 46 }, (_, i) => -90 + i * 4) },
      level: { size: 47, values: Array.from({ length: 47 }, (_, i) => i + 1) },
      time: { size: 1, values: ['2019-01-01'] }
    },
    attributes: {
      title: 'GEOS-Chem Binary Punch File',
      modelName: 'GEOS-Chem Classic',
      version: '12.1.0',
      resolution: '4x5',
      meteorology: 'MERRA2',
      simulation: 'Full-chemistry simulation'
    }
  };
};

interface BpchViewerProps {
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
      id={`bpch-tabpanel-${index}`}
      aria-labelledby={`bpch-tab-${index}`}
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

interface Tracer {
  id: number;
  name: string;
  fullName: string;
  units: string;
}

interface Diagnostic {
  name: string;
  description: string;
  tracers: Tracer[];
  scale: number;
  units: string;
}

interface BpchMetadata {
  diagnostics: Diagnostic[];
  dimensions: Record<string, { size: number; values: any[] }>;
  attributes: Record<string, any>;
}

const BpchViewer: React.FC<BpchViewerProps> = ({ simulationId, filePath }) => {
  const dispatch = useDispatch();
  const [tabValue, setTabValue] = useState(0);
  const [metadata, setMetadata] = useState<BpchMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<string>('');
  const [selectedTracer, setSelectedTracer] = useState<number>(0);
  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [visualizationData, setVisualizationData] = useState<any[]>([]);
  
  // Fetch BPCH file metadata when component mounts
  useEffect(() => {
    const fetchBpchMetadata = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await parseBpchFile(simulationId, filePath);
        setMetadata(data);
        
        // Default selections
        if (data.diagnostics.length > 0) {
          setSelectedDiagnostic(data.diagnostics[0].name);
          if (data.diagnostics[0].tracers.length > 0) {
            setSelectedTracer(data.diagnostics[0].tracers[0].id);
          }
        }
        
        if (data.dimensions.level) {
          setSelectedLevel(data.dimensions.level.values[0]);
        }
      } catch (err) {
        setError(`Failed to parse BPCH file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBpchMetadata();
  }, [simulationId, filePath]);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Handle diagnostic selection
  const handleDiagnosticChange = (event: SelectChangeEvent<string>) => {
    const newDiagnostic = event.target.value;
    setSelectedDiagnostic(newDiagnostic);
    
    // Reset tracer selection
    const diagnostic = metadata?.diagnostics.find(d => d.name === newDiagnostic);
    if (diagnostic && diagnostic.tracers.length > 0) {
      setSelectedTracer(diagnostic.tracers[0].id);
    } else {
      setSelectedTracer(0);
    }
  };
  
  // Handle tracer selection
  const handleTracerChange = (event: SelectChangeEvent<number>) => {
    setSelectedTracer(event.target.value as number);
  };
  
  // Handle level selection
  const handleLevelChange = (event: SelectChangeEvent<number>) => {
    setSelectedLevel(event.target.value as number);
  };
  
  // Generate visualization data
  const generateVisualization = () => {
    if (!metadata || !selectedDiagnostic || !selectedTracer) {
      return;
    }
    
    // In a real implementation, this would fetch the actual data from the backend
    // Here we're generating some sample data for demonstration
    
    // Find the selected diagnostic
    const diagnostic = metadata.diagnostics.find(d => d.name === selectedDiagnostic);
    if (!diagnostic) return;
    
    // Find the selected tracer
    const tracer = diagnostic.tracers.find(t => t.id === selectedTracer);
    if (!tracer) return;
    
    // Generate sample data
    // This would normally come from the backend parsing the BPCH file
    const latitudes = metadata.dimensions.latitude.values;
    const data = [];
    
    // For this example, we'll create a latitudinal profile at a fixed longitude
    for (let i = 0; i < latitudes.length; i++) {
      // Create a value that depends on latitude (higher near equator)
      const baseValue = 50 * Math.exp(-Math.pow((latitudes[i] / 30), 2));
      
      // Add some random variation
      const value = baseValue * (0.8 + 0.4 * Math.random());
      
      data.push({
        latitude: latitudes[i],
        value: value,
        units: tracer.units
      });
    }
    
    setVisualizationData(data);
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
          BPCH File Metadata
        </Typography>
        
        {/* File Attributes */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">File Attributes</Typography>
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
                  {Object.entries(metadata.attributes).map(([key, value]) => (
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
                    <TableCell>Values</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metadata.dimensions).map(([name, dimension]) => (
                    <TableRow key={name}>
                      <TableCell component="th" scope="row">
                        {name}
                      </TableCell>
                      <TableCell>{dimension.size}</TableCell>
                      <TableCell>
                        <Box 
                          sx={{ 
                            maxWidth: 300, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' 
                          }}
                        >
                          {dimension.values.length <= 5 
                            ? `[${dimension.values.join(', ')}]`
                            : `[${dimension.values.slice(0, 2).join(', ')}, ..., ${dimension.values.slice(-2).join(', ')}]`}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
        
        {/* Diagnostics */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Diagnostics</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Tracers</TableCell>
                    <TableCell>Units</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metadata.diagnostics.map((diagnostic) => (
                    <TableRow key={diagnostic.name}>
                      <TableCell component="th" scope="row">
                        {diagnostic.name}
                      </TableCell>
                      <TableCell>{diagnostic.description}</TableCell>
                      <TableCell>{diagnostic.tracers.map(t => t.name).join(', ')}</TableCell>
                      <TableCell>{diagnostic.units}</TableCell>
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
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Visualize BPCH Data
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="diagnostic-select-label">Diagnostic</InputLabel>
              <Select
                labelId="diagnostic-select-label"
                id="diagnostic-select"
                value={selectedDiagnostic}
                label="Diagnostic"
                onChange={handleDiagnosticChange}
              >
                {metadata.diagnostics.map((diagnostic) => (
                  <MenuItem key={diagnostic.name} value={diagnostic.name}>
                    {diagnostic.name} - {diagnostic.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <FormControl fullWidth sx={{ mb: 2 }} disabled={!selectedDiagnostic}>
              <InputLabel id="tracer-select-label">Tracer</InputLabel>
              <Select
                labelId="tracer-select-label"
                id="tracer-select"
                value={selectedTracer}
                label="Tracer"
                onChange={handleTracerChange}
              >
                {selectedDiagnostic && metadata.diagnostics.find(d => d.name === selectedDiagnostic)?.tracers.map((tracer) => (
                  <MenuItem key={tracer.id} value={tracer.id}>
                    {tracer.name} - {tracer.fullName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="level-select-label">Level</InputLabel>
              <Select
                labelId="level-select-label"
                id="level-select"
                value={selectedLevel}
                label="Level"
                onChange={handleLevelChange}
              >
                {metadata.dimensions.level?.values.map((level, index) => (
                  <MenuItem key={index} value={level}>
                    Level {level}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={generateVisualization}
              disabled={!selectedDiagnostic || !selectedTracer}
              fullWidth
            >
              Generate Visualization
            </Button>
          </Grid>
        </Grid>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        
        {visualizationData.length > 0 && (
          <Box sx={{ mt: 3, width: '100%', height: 400 }}>
            <Typography variant="h6" align="center" gutterBottom>
              {metadata.diagnostics.find(d => d.name === selectedDiagnostic)?.description || selectedDiagnostic} - 
              {metadata.diagnostics.find(d => d.name === selectedDiagnostic)?.tracers.find(t => t.id === selectedTracer)?.fullName}
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visualizationData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="latitude" 
                  label={{ value: 'Latitude (degrees)', position: 'insideBottom', offset: -5 }} 
                />
                <YAxis 
                  label={{ 
                    value: `${metadata.diagnostics.find(d => d.name === selectedDiagnostic)?.tracers.find(t => t.id === selectedTracer)?.name} (${metadata.diagnostics.find(d => d.name === selectedDiagnostic)?.tracers.find(t => t.id === selectedTracer)?.units})`, 
                    angle: -90, 
                    position: 'insideLeft' 
                  }} 
                />
                <Tooltip formatter={(value) => [`${value} ${visualizationData[0]?.units}`, 'Value']} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#8884d8" 
                  activeDot={{ r: 8 }} 
                  name={metadata.diagnostics.find(d => d.name === selectedDiagnostic)?.tracers.find(t => t.id === selectedTracer)?.name}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Box>
    );
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error && !metadata) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load BPCH file: {error}
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
            aria-label="bpch viewer tabs"
          >
            <Tab label="Visualization" id="bpch-tab-0" aria-controls="bpch-tabpanel-0" />
            <Tab label="Metadata" id="bpch-tab-1" aria-controls="bpch-tabpanel-1" />
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

export default BpchViewer;