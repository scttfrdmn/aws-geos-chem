import React, { useState, useEffect } from 'react';
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
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
  Slider,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
  Alert
} from '@mui/material';
import {
  CloudDownload as DownloadIcon,
  Visibility as VisibilityIcon,
  Map as MapIcon,
  Timeline as TimelineIcon,
  CompareArrows as CompareIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import {
  fetchNetCDFMetadata,
  fetchNetCDFData,
  fetchResultFiles,
  generateSpatialVisualization,
  generateSpatialDifferenceVisualization,
  selectSpatialVisualization,
  selectSpatialDifference
} from '../../store/slices/resultsSlice';
import { SelectChangeEvent } from '@mui/material';

interface SpatialComparisonProps {
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
      id={`spatial-tabpanel-${index}`}
      aria-labelledby={`spatial-tab-${index}`}
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

const SpatialComparison: React.FC<SpatialComparisonProps> = ({
  comparisonData,
  simulationIds
}) => {
  const { simulations } = useSelector((state: RootState) => state.simulations);
  
  const [selectedVariable, setSelectedVariable] = useState<string>('O3');
  const [selectedLevel, setSelectedLevel] = useState<string>('surface');
  const [selectedTime, setSelectedTime] = useState<number>(0);
  const [showDifference, setShowDifference] = useState<boolean>(true);
  const [useRelativeDifference, setUseRelativeDifference] = useState<boolean>(false);
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
  
  // Handle level change
  const handleLevelChange = (event: SelectChangeEvent) => {
    setSelectedLevel(event.target.value);
  };
  
  // Handle time slider change
  const handleTimeChange = (event: Event, newValue: number | number[]) => {
    setSelectedTime(newValue as number);
  };
  
  // Handle difference toggle
  const handleDifferenceToggle = () => {
    setShowDifference(!showDifference);
  };
  
  // Handle relative difference toggle
  const handleRelativeDifferenceToggle = () => {
    setUseRelativeDifference(!useRelativeDifference);
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Generate sample labels for time slider
  const timeLabels = [
    'Jan 1',
    'Jan 15',
    'Feb 1',
    'Feb 15',
    'Mar 1',
    'Mar 15',
    'Apr 1'
  ];
  
  // Generate sample data for demonstration purposes
  const generateSamplePlots = () => {
    // For real implementation, this would come from comparisonData
    // Here we're generating some sample data for UI demonstration
    
    const plots = {
      horizontalMaps: simulationIds.map(simId => ({
        simulationId: simId,
        name: getSimulationName(simId),
        imageUrl: `https://via.placeholder.com/800x400?text=${getSimulationName(simId)}+${selectedVariable}+${selectedLevel}+${timeLabels[selectedTime]}`
      })),
      differenceMaps: [],
      zonalMeanPlots: simulationIds.map(simId => ({
        simulationId: simId,
        name: getSimulationName(simId),
        imageUrl: `https://via.placeholder.com/800x400?text=Zonal+Mean+${getSimulationName(simId)}+${selectedVariable}`
      })),
      verticalProfiles: simulationIds.map(simId => ({
        simulationId: simId,
        name: getSimulationName(simId),
        imageUrl: `https://via.placeholder.com/800x400?text=Vertical+Profile+${getSimulationName(simId)}+${selectedVariable}`
      }))
    };
    
    // Add difference maps if there are at least 2 simulations
    if (simulationIds.length >= 2) {
      for (let i = 1; i < simulationIds.length; i++) {
        plots.differenceMaps.push({
          simulationId1: simulationIds[0],
          simulationId2: simulationIds[i],
          name1: getSimulationName(simulationIds[0]),
          name2: getSimulationName(simulationIds[i]),
          imageUrl: `https://via.placeholder.com/800x400?text=Difference+${useRelativeDifference ? 'Relative' : 'Absolute'}+${getSimulationName(simulationIds[i])}-${getSimulationName(simulationIds[0])}`
        });
      }
    }
    
    return plots;
  };
  
  const samplePlots = generateSamplePlots();

  // Function to fetch NetCDF files for each simulation
  useEffect(() => {
    const fetchFilesForSimulations = async () => {
      if (simulationIds.length === 0) return;

      const simFilesPromises = simulationIds.map(simId => {
        return dispatch(fetchResultFiles({ simulationId: simId })) as any;
      });

      try {
        await Promise.all(simFilesPromises);

        // Process files - find NetCDF files
        const filesInfo = simulationIds.map(simId => {
          const sim = simulations.find(s => s.id === simId);
          const simName = sim ? sim.name : simId;

          // Filter to find NetCDF files only (ending with .nc or .nc4)
          const netcdfFiles = files.filter(file =>
            file.type === 'file' && (file.name.endsWith('.nc') || file.name.endsWith('.nc4'))
          );

          return {
            simulationId: simId,
            simulationName: simName,
            files: netcdfFiles.map(file => ({
              path: file.path,
              name: file.name,
              type: file.type
            }))
          };
        });

        setSimulationFiles(filesInfo);

        // If we have files, fetch metadata for the first file of the first simulation
        if (filesInfo.length > 0 && filesInfo[0].files.length > 0) {
          const firstFilePath = filesInfo[0].files[0].path;
          setSelectedFile(firstFilePath);

          // Fetch metadata for this file
          dispatch(fetchNetCDFMetadata({
            simulationId: filesInfo[0].simulationId,
            filePath: firstFilePath
          }));
        }
      } catch (err) {
        console.error('Error fetching simulation files:', err);
      }
    };

    fetchFilesForSimulations();
  }, [dispatch, simulationIds, simulations, files]);

  // Process NetCDF metadata to extract available variables
  useEffect(() => {
    if (!selectedFile || !netcdfMetadata[selectedFile]) return;

    const metadata = netcdfMetadata[selectedFile];

    // Extract variables that have lat/lon dimensions (for spatial visualization)
    const spatialVariables = metadata.variables.filter(variable => {
      const hasLat = variable.dimensions.some(dim =>
        dim.toLowerCase().includes('lat') || dim.toLowerCase().includes('y')
      );
      const hasLon = variable.dimensions.some(dim =>
        dim.toLowerCase().includes('lon') || dim.toLowerCase().includes('x')
      );

      return hasLat && hasLon;
    });

    const processedVariables = spatialVariables.map(variable => ({
      id: variable.name,
      name: variable.longName || variable.name,
      unit: variable.units || '',
      group: variable.dimensions.includes('lev') || variable.dimensions.includes('level') ? 'profile' : 'surface'
    }));

    setAvailableVariables(processedVariables);

    // Set default variable if available
    if (processedVariables.length > 0 && (!selectedVariable || !processedVariables.find(v => v.id === selectedVariable))) {
      setSelectedVariable(processedVariables[0].id);
    }
  }, [selectedFile, netcdfMetadata, selectedVariable]);

  // Generate real visualizations for the selected parameters
  const generateRealVisualizations = async () => {
    if (!selectedVariable || simulationFiles.length === 0 || !selectedFile) return;

    setGeneratingVisualizations(true);

    try {
      // Generate visualization for each simulation
      const visualizationPromises = simulationFiles.map(async (simFile) => {
        // Find the matching file in this simulation
        const matchingFile = simFile.files.find(file =>
          file.name === selectedFile.split('/').pop()
        );

        if (!matchingFile) return null;

        // Generate the spatial visualization
        const response = await dispatch(generateSpatialVisualization({
          simulationId: simFile.simulationId,
          filePath: matchingFile.path,
          variable: selectedVariable,
          level: selectedLevel,
          time: selectedTime,
          plotType: tabValue === 0 ? 'horizontal' : tabValue === 1 ? 'zonal' : 'vertical'
        })) as any;

        // Update the visualization URL map
        return response.payload;
      });

      const results = await Promise.all(visualizationPromises);

      // Update visualization URLs
      const urlMap: Record<string, string> = {};
      results.filter(Boolean).forEach((result: any) => {
        if (result && result.simulationId) {
          urlMap[result.simulationId] = result.imageUrl;
        }
      });

      setVisualizationUrls(urlMap);

      // Generate difference maps if there are at least 2 simulations
      if (simulationIds.length >= 2 && showDifference) {
        const referenceSimId = simulationIds[0];
        const referenceFile = simulationFiles.find(sf => sf.simulationId === referenceSimId)?.files.find(file =>
          file.name === selectedFile.split('/').pop()
        );

        if (referenceFile) {
          const differencePromises = simulationIds.slice(1).map(async (comparisonSimId) => {
            const comparisonFile = simulationFiles.find(sf => sf.simulationId === comparisonSimId)?.files.find(file =>
              file.name === selectedFile.split('/').pop()
            );

            if (!comparisonFile) return null;

            // Generate the difference visualization
            const response = await dispatch(generateSpatialDifferenceVisualization({
              simulationId1: referenceSimId,
              simulationId2: comparisonSimId,
              filePath1: referenceFile.path,
              filePath2: comparisonFile.path,
              variable: selectedVariable,
              level: selectedLevel,
              time: selectedTime,
              useRelativeDifference: useRelativeDifference
            })) as any;

            return response.payload;
          });

          const diffResults = await Promise.all(differencePromises);

          // Update the difference visualization URLs
          diffResults.filter(Boolean).forEach((result: any) => {
            if (result) {
              urlMap[`diff_${result.simulationId1}_${result.simulationId2}`] = result.imageUrl;
            }
          });

          setVisualizationUrls(urlMap);
        }
      }
    } catch (err) {
      console.error('Error generating visualizations:', err);
    } finally {
      setGeneratingVisualizations(false);
    }
  };

  // Generate visualizations when parameters change
  useEffect(() => {
    if (simulationIds.length > 0 && selectedVariable && selectedFile) {
      generateRealVisualizations();
    }
  }, [selectedVariable, selectedLevel, selectedTime, selectedFile, showDifference, useRelativeDifference, tabValue, dispatch, simulationIds, simulationFiles]);
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Spatial Comparison
      </Typography>
      <Typography variant="body1" paragraph>
        Compare spatial distributions and patterns across simulations.
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel id="spatial-variable-label">Variable</InputLabel>
            <Select
              labelId="spatial-variable-label"
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
            <InputLabel id="spatial-level-label">Level</InputLabel>
            <Select
              labelId="spatial-level-label"
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
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
            <Grid container>
              <Grid item xs={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showDifference}
                      onChange={handleDifferenceToggle}
                    />
                  }
                  label="Show Differences"
                />
              </Grid>
              <Grid item xs={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={useRelativeDifference}
                      onChange={handleRelativeDifferenceToggle}
                      disabled={!showDifference}
                    />
                  }
                  label="Relative (%)"
                />
              </Grid>
            </Grid>
          </Box>
        </Grid>
      </Grid>
      
      <Box sx={{ mb: 3 }}>
        <Typography id="time-slider" gutterBottom>
          Time: {timeLabels[selectedTime]}
        </Typography>
        <Slider
          value={selectedTime}
          onChange={handleTimeChange}
          aria-labelledby="time-slider"
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => timeLabels[value]}
          step={1}
          marks={timeLabels.map((label, index) => ({ value: index, label }))}
          min={0}
          max={timeLabels.length - 1}
        />
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="spatial comparison tabs">
          <Tab label="Horizontal Maps" id="spatial-tab-0" aria-controls="spatial-tabpanel-0" />
          <Tab label="Zonal Means" id="spatial-tab-1" aria-controls="spatial-tabpanel-1" />
          <Tab label="Vertical Profiles" id="spatial-tab-2" aria-controls="spatial-tabpanel-2" />
        </Tabs>
      </Box>
      
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Individual simulation maps */}
          {samplePlots.horizontalMaps.map((plot) => (
            <Grid item xs={12} md={6} key={plot.simulationId}>
              <Card variant="outlined">
                <CardMedia
                  component="img"
                  height="300"
                  image={plot.imageUrl}
                  alt={`Horizontal Map - ${plot.name}`}
                />
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                      {plot.name}
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
                    {selectedVariable} at {selectedLevel} level - {timeLabels[selectedTime]}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* Difference maps */}
          {showDifference && samplePlots.differenceMaps.map((plot, index) => (
            <Grid item xs={12} md={6} key={`diff-${index}`}>
              <Card variant="outlined">
                <CardMedia
                  component="img"
                  height="300"
                  image={plot.imageUrl}
                  alt={`Difference Map - ${plot.name2} vs ${plot.name1}`}
                />
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                      Difference: {plot.name2} - {plot.name1}
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
                    {useRelativeDifference ? 'Relative (%)' : 'Absolute'} difference in {selectedVariable} at {selectedLevel} level
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {/* Zonal mean plots */}
          {samplePlots.zonalMeanPlots.map((plot) => (
            <Grid item xs={12} key={plot.simulationId}>
              <Card variant="outlined">
                <CardMedia
                  component="img"
                  height="300"
                  image={plot.imageUrl}
                  alt={`Zonal Mean - ${plot.name}`}
                />
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                      Zonal Mean: {plot.name}
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
                    Zonal mean distribution of {selectedVariable} by latitude and altitude
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {/* Combined zonal mean plot */}
          {simulationIds.length > 1 && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardMedia
                  component="img"
                  height="300"
                  image={`https://via.placeholder.com/800x400?text=Combined+Zonal+Mean+${selectedVariable}`}
                  alt="Combined Zonal Mean"
                />
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1">
                      Combined Zonal Mean
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
                    Comparison of zonal mean distributions across all simulations
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          {generatingVisualizations ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Vertical profile plots */}
              {simulationFiles.map((simFile) => (
                <Grid item xs={12} md={6} key={simFile.simulationId}>
                  <Card variant="outlined">
                    <CardMedia
                      component="img"
                      height="300"
                      image={`https://via.placeholder.com/800x400?text=Vertical+Profile+${simFile.simulationName}+${selectedVariable}`}
                      alt={`Vertical Profile - ${simFile.simulationName}`}
                    />
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">
                          Vertical Profile: {simFile.simulationName}
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
                        Vertical profile of {selectedVariable} by altitude
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}

              {/* Combined vertical profile plot */}
              {simulationIds.length > 1 && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardMedia
                      component="img"
                      height="300"
                      image={`https://via.placeholder.com/800x400?text=Combined+Vertical+Profiles+${selectedVariable}`}
                      alt="Combined Vertical Profiles"
                    />
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">
                          Combined Vertical Profiles
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
                        Comparison of vertical profiles across all simulations
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </>
          )}
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default SpatialComparison;