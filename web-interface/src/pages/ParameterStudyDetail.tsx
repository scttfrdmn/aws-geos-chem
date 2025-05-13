import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  BarChart as BarChartIcon,
  BubbleChart as BubbleChartIcon,
  Timeline as TimelineIcon,
  Check as CheckIcon,
  Info as InfoIcon,
  Science as ScienceIcon,
  Tune as TuneIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import {
  fetchParameterStudyById,
  cancelParameterStudy,
  generateStudyReport
} from '../store/slices/parameterStudySlice';

// Mock visualization data
const mockVisualizations = [
  {
    id: 'vis-001',
    title: 'Sensitivity Heatmap',
    type: 'heatmap',
    thumbnail: 'https://via.placeholder.com/300x200?text=Sensitivity+Heatmap',
    fullUrl: 'https://via.placeholder.com/1200x800?text=Sensitivity+Heatmap',
    description: 'Heatmap showing sensitivity of output variables to input parameters'
  },
  {
    id: 'vis-002',
    title: 'Parameter Sweep: NOx Emissions',
    type: 'line',
    thumbnail: 'https://via.placeholder.com/300x200?text=Parameter+Sweep',
    fullUrl: 'https://via.placeholder.com/1200x800?text=Parameter+Sweep',
    description: 'Line plot showing how Ozone varies with NOx emissions'
  },
  {
    id: 'vis-003',
    title: 'Surface Response: O3',
    type: 'surface',
    thumbnail: 'https://via.placeholder.com/300x200?text=Surface+Response',
    fullUrl: 'https://via.placeholder.com/1200x800?text=Surface+Response',
    description: '3D surface plot showing Ozone as a function of NOx and VOC'
  }
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
      id={`study-tabpanel-${index}`}
      aria-labelledby={`study-tab-${index}`}
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

const ParameterStudyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentStudy, loading, error } = useSelector((state: RootState) => state.parameterStudy);
  const [tabValue, setTabValue] = useState(0);
  const [selectedVisualization, setSelectedVisualization] = useState<any | null>(null);
  
  useEffect(() => {
    if (id) {
      dispatch(fetchParameterStudyById(id));
    }
  }, [id, dispatch]);
  
  const handleRefresh = () => {
    if (id) {
      dispatch(fetchParameterStudyById(id));
    }
  };
  
  const handleBack = () => {
    navigate('/parameter-studies');
  };
  
  const handleCancelStudy = () => {
    if (id && window.confirm('Are you sure you want to cancel this parameter study? This action cannot be undone.')) {
      dispatch(cancelParameterStudy(id));
    }
  };
  
  const handleGenerateReport = () => {
    if (id) {
      dispatch(generateStudyReport(id));
      alert('Report generation has started. It will be available once completed.');
    }
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleViewSimulation = (simulationId: string) => {
    navigate(`/simulations/${simulationId}`);
  };
  
  const handleViewVisualization = (visualization: any) => {
    setSelectedVisualization(visualization);
    window.open(visualization.fullUrl, '_blank');
  };
  
  // Get status color based on status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created':
        return 'default';
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };
  
  // Format parameter range for display
  const formatParameterRange = (param: any) => {
    if (param.type === 'categorical') {
      return (param.range as string[]).join(', ');
    } else {
      const range = param.range as [number, number];
      return `${range[0]} to ${range[1]}`;
    }
  };
  
  // Get visualization icon based on type
  const getVisualizationIcon = (type: string) => {
    switch (type) {
      case 'heatmap':
        return <BubbleChartIcon />;
      case 'bar':
        return <BarChartIcon />;
      case 'line':
      case 'scatter':
        return <TimelineIcon />;
      default:
        return <AssessmentIcon />;
    }
  };
  
  if (loading && !currentStudy) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
        <Button 
          color="inherit" 
          size="small" 
          onClick={handleBack}
          sx={{ ml: 2 }}
        >
          Back to Parameter Studies
        </Button>
      </Alert>
    );
  }
  
  if (!currentStudy) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        Parameter study not found. <Link component="button" onClick={handleBack}>Return to parameter studies</Link>
      </Alert>
    );
  }
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Back to Parameter Studies
        </Button>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {currentStudy.status === 'running' && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={handleCancelStudy}
              sx={{ mr: 1 }}
            >
              Cancel Study
            </Button>
          )}
          
          {currentStudy.status === 'completed' && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AssessmentIcon />}
              onClick={handleGenerateReport}
              sx={{ mr: 1 }}
            >
              Generate Report
            </Button>
          )}
          
          {currentStudy.status === 'completed' && currentStudy.results && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
            >
              Download Results
            </Button>
          )}
        </Box>
      </Box>
      
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ mr: 2 }}>
            <ScienceIcon fontSize="large" color="primary" />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5">
              {currentStudy.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentStudy.description || 'No description'}
            </Typography>
          </Box>
          <Chip
            label={currentStudy.status}
            size="medium"
            color={getStatusColor(currentStudy.status) as any}
          />
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Study Type</Typography>
            <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
              {currentStudy.studyType}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Parameters</Typography>
            <Typography variant="body1">
              {currentStudy.parameters.length} parameters varied
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Simulations</Typography>
            <Typography variant="body1">
              {currentStudy.simulations?.length || 0} simulations
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Created</Typography>
            <Typography variant="body1">
              {formatDate(currentStudy.createdAt)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
      
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="study details tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" id="study-tab-0" aria-controls="study-tabpanel-0" />
          <Tab label="Parameters" id="study-tab-1" aria-controls="study-tabpanel-1" />
          <Tab label="Simulations" id="study-tab-2" aria-controls="study-tabpanel-2" />
          <Tab label="Results" id="study-tab-3" aria-controls="study-tabpanel-3" />
          <Tab label="Visualizations" id="study-tab-4" aria-controls="study-tabpanel-4" />
        </Tabs>
        
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Study Summary
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body1" paragraph>
                      {currentStudy.description || `This is a ${currentStudy.studyType} study using ${currentStudy.parameters.length} parameters across ${currentStudy.simulations?.length || 0} simulations.`}
                    </Typography>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Base Simulation:
                    </Typography>
                    <Typography variant="body2" paragraph>
                      {currentStudy.baseSimulationId}
                    </Typography>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Study Focus:
                    </Typography>
                    <Typography variant="body2" paragraph>
                      {currentStudy.studyType === 'sensitivity' && 'Identifying parameter sensitivities and their impact on model outputs'}
                      {currentStudy.studyType === 'optimization' && 'Finding optimal parameter values to maximize or minimize specific outputs'}
                      {currentStudy.studyType === 'exploration' && 'Exploring how outputs vary across a range of parameter values'}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Output Variables
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {currentStudy.outputConfig.outputVariables.map((variable: string, index: number) => (
                      <Chip
                        key={index}
                        label={variable}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Analysis Metrics
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {currentStudy.outputConfig.analysisMetrics.map((metric: string, index: number) => (
                      <Chip
                        key={index}
                        label={metric}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              {currentStudy.status === 'completed' && currentStudy.results?.sensitivities && (
                <Card variant="outlined" sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Key Findings
                    </Typography>
                    
                    {currentStudy.studyType === 'sensitivity' && (
                      <>
                        <Typography variant="subtitle2" gutterBottom>
                          Parameter Sensitivity Rankings:
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Rank</TableCell>
                              <TableCell>Parameter</TableCell>
                              <TableCell>Sensitivity</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(currentStudy.results.rankings || {})
                              .sort((a, b) => a[1] as number - (b[1] as number))
                              .map(([param, rank]) => (
                                <TableRow key={param}>
                                  <TableCell>{rank}</TableCell>
                                  <TableCell>{param}</TableCell>
                                  <TableCell>
                                    {(currentStudy.results?.sensitivities?.[param] * 100).toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </>
                    )}
                    
                    {currentStudy.studyType === 'optimization' && currentStudy.results?.optimalValues && (
                      <>
                        <Typography variant="subtitle2" gutterBottom>
                          Optimal Parameter Values:
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Parameter</TableCell>
                              <TableCell>Optimal Value</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(currentStudy.results.optimalValues).map(([param, value]) => (
                              <TableRow key={param}>
                                <TableCell>{param}</TableCell>
                                <TableCell>{value}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
              
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Status Information
                  </Typography>
                  
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Status" 
                        secondary={currentStudy.status} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <ScienceIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Simulations"
                        secondary={`${currentStudy.simulations?.length || 0} total`} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <TuneIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Parameters Varied" 
                        secondary={`${currentStudy.parameters.length} parameters`} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <TrendingUpIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Output Variables" 
                        secondary={`${currentStudy.outputConfig.outputVariables.length} variables analyzed`} 
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Parameter Configuration
          </Typography>
          <Typography variant="body1" paragraph>
            The following parameters were varied in this study:
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Parameter</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Range / Values</TableCell>
                  <TableCell>Sampling</TableCell>
                  <TableCell>Path</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentStudy.parameters.map((param: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{param.name}</TableCell>
                    <TableCell>{param.type}</TableCell>
                    <TableCell>{formatParameterRange(param)}</TableCell>
                    <TableCell>
                      {param.type !== 'categorical' && (
                        <Typography variant="body2">
                          {param.samplingPoints} points
                          {param.distribution && ` (${param.distribution})`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {param.path}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Sampling Method
            </Typography>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  {currentStudy.samplingMethod || 'Grid'} Sampling
                </Typography>
                <Typography variant="body2">
                  {currentStudy.samplingMethod === 'grid' && 
                    'Systematically samples at regular intervals across parameter ranges. Provides complete coverage but requires more simulations.'}
                  {currentStudy.samplingMethod === 'random' && 
                    'Randomly samples parameter values within their ranges. Simple but may have clustering or gaps.'}
                  {currentStudy.samplingMethod === 'latin-hypercube' && 
                    'Advanced sampling that ensures even coverage of parameter space. Good balance between efficiency and coverage.'}
                  {currentStudy.samplingMethod === 'sobol' && 
                    'Quasi-random sequence that provides excellent space-filling properties. Best for complex models with many parameters.'}
                  {!currentStudy.samplingMethod && 
                    'Systematically samples at regular intervals across parameter ranges.'}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Simulations
          </Typography>
          <Typography variant="body1" paragraph>
            This study includes {currentStudy.simulations?.length || 0} GEOS-Chem simulations:
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Simulation ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Parameter Values</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentStudy.simulations?.map((simId: string, index: number) => (
                  <TableRow key={simId}>
                    <TableCell>{simId}</TableCell>
                    <TableCell>
                      <Chip
                        label={'COMPLETED'} // In real implementation, this would come from simulation data
                        size="small"
                        color="success"
                      />
                    </TableCell>
                    <TableCell>
                      {/* In real implementation, this would show the actual parameter values */}
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        {currentStudy.parameters.slice(0, 3).map((param: any, pIndex: number) => (
                          <Typography key={pIndex} variant="caption">
                            {param.name}: {
                              param.type === 'categorical' 
                                ? (param.range as string[])[index % (param.range as string[]).length]
                                : (((param.range as [number, number])[0] + index / 10) % (param.range as [number, number])[1]).toFixed(2)
                            }
                          </Typography>
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {formatDate(currentStudy.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View simulation details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewSimulation(simId)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          {currentStudy.status === 'completed' && currentStudy.results ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Study Results
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Sensitivity Analysis Results
                      </Typography>
                      
                      {currentStudy.results.sensitivities && (
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Parameter</TableCell>
                                <TableCell>Sensitivity</TableCell>
                                <TableCell>Rank</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(currentStudy.results.sensitivities)
                                .sort((a, b) => (b[1] as number) - (a[1] as number))
                                .map(([param, sensitivity]) => (
                                  <TableRow key={param}>
                                    <TableCell>{param}</TableCell>
                                    <TableCell>{(sensitivity as number * 100).toFixed(2)}%</TableCell>
                                    <TableCell>{currentStudy.results?.rankings?.[param]}</TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Statistical Summary
                      </Typography>
                      
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Variable</TableCell>
                              <TableCell>Mean</TableCell>
                              <TableCell>Std Dev</TableCell>
                              <TableCell>Min</TableCell>
                              <TableCell>Max</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {currentStudy.outputConfig.outputVariables.map((variable: string) => (
                              <TableRow key={variable}>
                                <TableCell>{variable}</TableCell>
                                <TableCell>{(Math.random() * 100).toFixed(2)}</TableCell>
                                <TableCell>{(Math.random() * 20).toFixed(2)}</TableCell>
                                <TableCell>{(Math.random() * 50).toFixed(2)}</TableCell>
                                <TableCell>{(Math.random() * 150 + 50).toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Key Insights
                </Typography>
                <Card variant="outlined">
                  <CardContent>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <CheckIcon color="success" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={`Parameter "${Object.entries(currentStudy.results.rankings || {})
                            .sort((a, b) => (a[1] as number) - (b[1] as number))
                            .map(entry => entry[0])[0]}" has the highest impact on model results`} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckIcon color="success" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={`The model output is most sensitive to changes in ${
                            currentStudy.parameters[0]?.name || 'the first parameter'
                          }`} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckIcon color="success" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={`${currentStudy.outputConfig.outputVariables[0] || 'The primary output variable'} 
                          varies by up to ${(Math.random() * 40 + 10).toFixed(1)}% across the parameter range`} 
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <AssessmentIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Results not available yet
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {currentStudy.status === 'running' 
                  ? 'The study is still running. Results will be available once all simulations are completed.'
                  : 'This study has not been completed yet.'}
              </Typography>
            </Box>
          )}
        </TabPanel>
        
        <TabPanel value={tabValue} index={4}>
          {currentStudy.status === 'completed' ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Visualizations
              </Typography>
              <Typography variant="body1" paragraph>
                The following visualizations were generated from this parameter study:
              </Typography>
              
              <Grid container spacing={3}>
                {(currentStudy.results?.plots || mockVisualizations).map((vis: any) => (
                  <Grid item xs={12} sm={6} md={4} key={vis.id || vis}>
                    <Card 
                      variant="outlined"
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          boxShadow: 3
                        }
                      }}
                      onClick={() => handleViewVisualization(vis)}
                    >
                      <Box sx={{ pt: 2, px: 2, display: 'flex', alignItems: 'center' }}>
                        {getVisualizationIcon(vis.type || 'unknown')}
                        <Typography variant="subtitle1" sx={{ ml: 1 }}>
                          {vis.title || vis}
                        </Typography>
                      </Box>
                      <CardContent>
                        <Box sx={{ mb: 2 }}>
                          <img 
                            src={vis.thumbnail || vis} 
                            alt={vis.title || vis}
                            style={{ width: '100%', height: 'auto', borderRadius: 4 }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {vis.description || 'Visualization of parameter study results'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <BarChartIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Visualizations not available yet
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {currentStudy.status === 'running' 
                  ? 'The study is still running. Visualizations will be generated once all simulations are completed.'
                  : 'This study has not been completed yet.'}
              </Typography>
            </Box>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default ParameterStudyDetail;