import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  LinearProgress,
  Alert,
  Link,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  PauseCircleOutline as PauseIcon,
  PlayCircleOutline as PlayIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  ViewList as ViewListIcon,
  Science as ScienceIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchBatchDetails, cancelBatchJob } from '../store/slices/batchSlice';

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
      id={`batch-tabpanel-${index}`}
      aria-labelledby={`batch-tab-${index}`}
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

const BatchDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentBatch, loading, error } = useSelector((state: RootState) => state.batch);
  const [tabValue, setTabValue] = useState(0);
  const [selectedSimulation, setSelectedSimulation] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  useEffect(() => {
    if (id) {
      dispatch(fetchBatchDetails(id));
    }
  }, [id, dispatch]);
  
  const handleRefresh = () => {
    if (id) {
      dispatch(fetchBatchDetails(id));
    }
  };
  
  const handleBack = () => {
    navigate('/batches');
  };
  
  const handleCancelBatch = () => {
    if (id && window.confirm('Are you sure you want to cancel this batch job? This action cannot be undone.')) {
      dispatch(cancelBatchJob(id));
    }
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleViewSimulation = (simulation: any) => {
    setSelectedSimulation(simulation);
    setIsDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedSimulation(null);
  };
  
  const handleViewSimulationDetails = (simulationId: string) => {
    navigate(`/simulations/${simulationId}`);
  };
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  // Get status color based on status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED':
      case 'PENDING':
        return 'info';
      case 'RUNNING':
        return 'primary';
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
        return 'error';
      case 'CANCELLED':
        return 'warning';
      default:
        return 'default';
    }
  };
  
  // Get status icon based on status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CREATED':
      case 'PENDING':
        return <HourglassEmptyIcon />;
      case 'RUNNING':
        return <TimelineIcon />;
      case 'COMPLETED':
        return <CheckCircleIcon />;
      case 'FAILED':
        return <ErrorIcon />;
      case 'CANCELLED':
        return <CancelIcon />;
      default:
        return <InfoIcon />;
    }
  };
  
  // Calculate completion percentage
  const calculateCompletionPercentage = () => {
    if (!currentBatch || currentBatch.totalSimulations === 0) return 0;
    return Math.round(
      ((currentBatch.completedSimulations + currentBatch.failedSimulations) / currentBatch.totalSimulations) * 100
    );
  };
  
  if (loading && !currentBatch) {
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
      </Alert>
    );
  }
  
  if (!currentBatch) {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        Batch not found. <Link component="button" onClick={handleBack}>Return to batch list</Link>
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
          Back to Batches
        </Button>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {currentBatch.status === 'RUNNING' && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={handleCancelBatch}
              sx={{ mr: 1 }}
            >
              Cancel Batch
            </Button>
          )}
          {currentBatch.status === 'CREATED' && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayIcon />}
            >
              Start Batch
            </Button>
          )}
        </Box>
      </Box>
      
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ mr: 2 }}>
            {getStatusIcon(currentBatch.status)}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5">
              {currentBatch.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentBatch.description || 'No description'}
            </Typography>
          </Box>
          <Chip
            label={currentBatch.status}
            color={getStatusColor(currentBatch.status) as any}
          />
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Created</Typography>
            <Typography variant="body1">{formatDate(currentBatch.createdAt)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Last Updated</Typography>
            <Typography variant="body1">{formatDate(currentBatch.updatedAt)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">User</Typography>
            <Typography variant="body1">{currentBatch.username}</Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">Total Cost</Typography>
            <Typography variant="body1">${currentBatch.actualCost.toFixed(2)} / ${currentBatch.estimatedCost.toFixed(2)}</Typography>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Progress: {currentBatch.completedSimulations} of {currentBatch.totalSimulations} simulations completed
            {currentBatch.failedSimulations > 0 && `, ${currentBatch.failedSimulations} failed`}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: '100%', mr: 1 }}>
              <LinearProgress
                variant="determinate"
                value={calculateCompletionPercentage()}
                color={currentBatch.failedSimulations > 0 ? 'warning' : 'primary'}
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">{`${calculateCompletionPercentage()}%`}</Typography>
            </Box>
          </Box>
        </Box>
      </Paper>
      
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="batch details tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" id="batch-tab-0" aria-controls="batch-tabpanel-0" />
          <Tab label="Simulations" id="batch-tab-1" aria-controls="batch-tabpanel-1" />
          <Tab label="Parameters" id="batch-tab-2" aria-controls="batch-tabpanel-2" />
          <Tab label="Resources" id="batch-tab-3" aria-controls="batch-tabpanel-3" />
        </Tabs>
        
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Batch Summary
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Template:</strong> {currentBatch.templateId}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Total Simulations:</strong> {currentBatch.totalSimulations}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Completed:</strong> {currentBatch.completedSimulations}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Failed:</strong> {currentBatch.failedSimulations}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Progress:</strong> {calculateCompletionPercentage()}%
                    </Typography>
                  </Box>
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Cost Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Estimated Cost:</strong> ${currentBatch.estimatedCost.toFixed(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Actual Cost:</strong> ${currentBatch.actualCost.toFixed(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Budget:</strong> ${(currentBatch.computeConfig?.maxBudget || 0).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Compute Configuration
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Instance Type:</strong> {currentBatch.computeConfig?.instanceType || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Max Concurrent Jobs:</strong> {currentBatch.computeConfig?.maxConcurrentJobs || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Priority:</strong> {currentBatch.computeConfig?.priority || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Spot Instances:</strong> {currentBatch.computeConfig?.useSpot ? 'Yes' : 'No'}
                    </Typography>
                  </Box>
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Status Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Current Status:</strong>{' '}
                    <Chip
                      label={currentBatch.status}
                      color={getStatusColor(currentBatch.status) as any}
                      size="small"
                    />
                  </Typography>
                  <Typography variant="body2">
                    <strong>Created At:</strong> {formatDate(currentBatch.createdAt)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Last Updated:</strong> {formatDate(currentBatch.updatedAt)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Simulations
            </Typography>
            <Typography variant="body2" gutterBottom>
              This batch contains {currentBatch.totalSimulations} simulations with varying parameters.
            </Typography>
          </Box>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Parameters</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Completed</TableCell>
                  <TableCell>Cost</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentBatch.simulations && currentBatch.simulations.map((simulation) => (
                  <TableRow key={simulation.id}>
                    <TableCell>
                      <Typography variant="body2">{simulation.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={simulation.status}
                        color={getStatusColor(simulation.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleViewSimulation(simulation)}
                      >
                        View Parameters
                      </Button>
                    </TableCell>
                    <TableCell>{formatDate(simulation.startedAt)}</TableCell>
                    <TableCell>{formatDate(simulation.completedAt)}</TableCell>
                    <TableCell>${simulation.cost.toFixed(2)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex' }}>
                        <Tooltip title="View simulation details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewSimulationDetails(simulation.simulationId)}
                          >
                            <ViewListIcon />
                          </IconButton>
                        </Tooltip>
                        
                        {simulation.status === 'COMPLETED' && (
                          <Tooltip title="Download results">
                            <IconButton size="small">
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Parameter Variations
            </Typography>
            <Typography variant="body2" gutterBottom>
              The following parameters were varied across the simulations in this batch.
            </Typography>
          </Box>
          
          {currentBatch.parameters && currentBatch.parameters.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Parameter</TableCell>
                    <TableCell>Path</TableCell>
                    <TableCell>Values</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentBatch.parameters.map((param, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2">
                          <strong>{param.name}</strong>
                        </Typography>
                        {param.description && (
                          <Typography variant="caption" color="text.secondary">
                            {param.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{param.path}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {param.values.map((value: any, i: number) => (
                            <Chip
                              key={i}
                              label={value.toString()}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              No parameter variations found for this batch.
            </Alert>
          )}
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Resource Usage
            </Typography>
            <Typography variant="body2" gutterBottom>
              Compute resources and cost information for this batch.
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Compute Configuration
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      <strong>Instance Type:</strong> {currentBatch.computeConfig?.instanceType || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Max Concurrent Jobs:</strong> {currentBatch.computeConfig?.maxConcurrentJobs || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Max Total Jobs:</strong> {currentBatch.computeConfig?.maxTotalJobs || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Priority:</strong> {currentBatch.computeConfig?.priority || 'N/A'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Using Spot Instances:</strong> {currentBatch.computeConfig?.useSpot ? 'Yes' : 'No'}
                    </Typography>
                  </Box>
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Resource Allocation
                  </Typography>
                  <Typography variant="body2">
                    <strong>Parallel Simulations:</strong> {currentBatch.computeConfig?.maxConcurrentJobs || 'N/A'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Total CPU Hours:</strong> {/* Would be calculated from actual running data */}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Average Runtime per Simulation:</strong> {/* Would be calculated from actual data */}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Cost Information
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2">
                      <strong>Estimated Total Cost:</strong> ${currentBatch.estimatedCost.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Actual Cost to Date:</strong> ${currentBatch.actualCost.toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Budget Limit:</strong> ${(currentBatch.computeConfig?.maxBudget || 0).toFixed(2)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Cost per Simulation (Avg):</strong> ${(currentBatch.actualCost / (currentBatch.completedSimulations || 1)).toFixed(2)}
                    </Typography>
                  </Box>
                  
                  <Typography variant="subtitle1" gutterBottom>
                    Savings
                  </Typography>
                  <Typography variant="body2">
                    <strong>Spot Instance Savings:</strong> {currentBatch.computeConfig?.useSpot ? 'Up to 70% savings with Spot instances' : 'None (using On-Demand)'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Budget Utilization:</strong> {currentBatch.computeConfig?.maxBudget ? `${((currentBatch.actualCost / currentBatch.computeConfig.maxBudget) * 100).toFixed(0)}%` : 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
      
      {/* Parameter Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Simulation Parameters
          {selectedSimulation && (
            <Typography variant="subtitle1" color="text.secondary">
              {selectedSimulation.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {selectedSimulation && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Parameter</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(selectedSimulation.parameters).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell>{key}</TableCell>
                      <TableCell>{String(value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          <Button 
            onClick={() => {
              if (selectedSimulation) {
                handleViewSimulationDetails(selectedSimulation.simulationId);
              }
            }}
            variant="contained"
          >
            View Full Simulation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BatchDetail;