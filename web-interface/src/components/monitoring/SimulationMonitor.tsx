import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { 
  fetchSimulationById,
  cancelSimulation,
  updateSimulationProgress,
  updateSimulationCost,
  Simulation
} from '../../store/slices/simulationsSlice';
import { addAlert } from '../../store/slices/uiSlice';

// MUI components
import {
  Box,
  Paper,
  Typography,
  Divider,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';

// MUI icons
import {
  AccessTime as TimeIcon,
  MonetizationOn as CostIcon,
  Memory as ResourceIcon,
  Article as LogIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  EventNote as StatusIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

// Custom components
import StatusChip from '../common/StatusChip';
import LogViewer from './LogViewer';
import ResourceMonitor from './ResourceMonitor';
import TimelineView from './TimelineView';

interface SimulationMonitorProps {
  simulationId: string;
  refreshInterval?: number; // in milliseconds
}

// Interface for a simulation status update
interface StatusUpdate {
  timestamp: string;
  status: string;
  message: string;
}

const SimulationMonitor: React.FC<SimulationMonitorProps> = ({ 
  simulationId, 
  refreshInterval = 10000 // Default refresh every 10 seconds
}) => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Get simulation from Redux store
  const simulation = useSelector((state: RootState) => 
    state.simulations.currentSimulation
  );
  
  const loading = useSelector((state: RootState) => state.simulations.loading);
  
  // Local state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
  const [logLevel, setLogLevel] = useState<'INFO' | 'DEBUG' | 'WARN' | 'ERROR'>('INFO');
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Fetch simulation data initially and set up polling
  useEffect(() => {
    // Initial fetch
    dispatch(fetchSimulationById(simulationId));
    
    // Set up polling for active simulations
    let intervalId: NodeJS.Timeout | null = null;
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        dispatch(fetchSimulationById(simulationId));
      }, refreshInterval);
    }
    
    // Clean up on unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [dispatch, simulationId, refreshInterval, autoRefresh]);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    dispatch(fetchSimulationById(simulationId));
  };
  
  // Handle auto-refresh toggle
  const handleAutoRefreshToggle = () => {
    setAutoRefresh(!autoRefresh);
  };
  
  // Handle cancel dialog open
  const handleCancelDialogOpen = () => {
    setCancelDialogOpen(true);
  };
  
  // Handle cancel dialog close
  const handleCancelDialogClose = () => {
    setCancelDialogOpen(false);
  };
  
  // Handle simulation cancellation
  const handleCancelSimulation = async () => {
    try {
      await dispatch(cancelSimulation(simulationId));
      dispatch(addAlert({
        type: 'success',
        message: 'Simulation cancellation request submitted',
        autoHideDuration: 6000
      }));
      setCancelDialogOpen(false);
    } catch (error) {
      console.error('Error cancelling simulation:', error);
      dispatch(addAlert({
        type: 'error',
        message: 'Failed to cancel simulation',
        autoHideDuration: 6000
      }));
    }
  };
  
  // Handle log level change
  const handleLogLevelChange = (level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR') => {
    setLogLevel(level);
  };
  
  // Generate sample status updates for demonstration
  useEffect(() => {
    if (simulation) {
      // This is sample data - in a real app, this would come from the API
      const sampleUpdates: StatusUpdate[] = [
        {
          timestamp: new Date(new Date().getTime() - 3600000).toISOString(),
          status: 'CREATED',
          message: 'Simulation created'
        },
        {
          timestamp: new Date(new Date().getTime() - 3500000).toISOString(),
          status: 'SUBMITTED',
          message: 'Simulation submitted to AWS Batch'
        }
      ];
      
      if (simulation.status === 'RUNNING' || simulation.status === 'SUCCEEDED' || simulation.status === 'FAILED') {
        sampleUpdates.push({
          timestamp: new Date(new Date().getTime() - 3400000).toISOString(),
          status: 'RUNNING',
          message: 'Simulation started running on compute resources'
        });
      }
      
      if (simulation.status === 'SUCCEEDED') {
        sampleUpdates.push({
          timestamp: new Date(new Date().getTime() - 600000).toISOString(),
          status: 'SUCCEEDED',
          message: 'Simulation completed successfully'
        });
      } else if (simulation.status === 'FAILED') {
        sampleUpdates.push({
          timestamp: new Date(new Date().getTime() - 600000).toISOString(),
          status: 'FAILED',
          message: 'Simulation failed due to an error'
        });
      }
      
      setStatusUpdates(sampleUpdates);
    }
  }, [simulation]);
  
  // Update simulation progress for demo purposes
  useEffect(() => {
    if (simulation && simulation.status === 'RUNNING') {
      // This is just for demo - in a real app, progress would come from the API
      const timer = setInterval(() => {
        const newProgress = Math.min((simulation.progress || 0) + 0.5, 100);
        dispatch(updateSimulationProgress({ 
          id: simulationId, 
          progress: newProgress 
        }));
        
        // Also update cost if available
        if (simulation.currentCost !== undefined) {
          const newCost = simulation.currentCost + 0.05;
          dispatch(updateSimulationCost({
            id: simulationId,
            cost: newCost
          }));
        }
      }, 5000);
      
      return () => clearInterval(timer);
    }
  }, [dispatch, simulationId, simulation]);
  
  // If loading and no simulation data yet, show spinner
  if (loading && !simulation) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // If no simulation found, show error
  if (!simulation) {
    return (
      <Alert severity="error">
        Simulation not found. The simulation may have been deleted or you don't have permission to view it.
      </Alert>
    );
  }
  
  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  // Format elapsed time
  const formatElapsedTime = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'Not started';
    
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const diffMs = end - start;
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours}h ${minutes}m ${seconds}s`;
  };
  
  // Format currency
  const formatCurrency = (amount?: number) => {
    if (amount === undefined) return 'N/A';
    return `$${amount.toFixed(2)}`;
  };
  
  return (
    <Box>
      {/* Status header */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{ p: 2, mb: 3, borderRadius: 2 }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" component="h1">
              {simulation.name || `Simulation ${simulation.simulationId}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {simulation.simulationId} | Created: {formatDate(simulation.createdAt)}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StatusChip status={simulation.status} size="medium" />
            
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            {simulation.status === 'RUNNING' && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={handleCancelDialogOpen}
              >
                Cancel
              </Button>
            )}
          </Box>
        </Box>
        
        {/* Progress bar for running simulations */}
        {simulation.status === 'RUNNING' && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">
                Progress: {Math.round(simulation.progress || 0)}%
              </Typography>
              <Typography variant="body2">
                Elapsed time: {formatElapsedTime(simulation.startedAt)}
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={simulation.progress || 0} 
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
        )}
      </Paper>
      
      {/* Main content tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="simulation monitor tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" id="tab-0" aria-controls="tabpanel-0" />
          <Tab label="Resources" id="tab-1" aria-controls="tabpanel-1" />
          <Tab label="Logs" id="tab-2" aria-controls="tabpanel-2" />
          <Tab label="Timeline" id="tab-3" aria-controls="tabpanel-3" />
        </Tabs>
      </Box>
      
      {/* Overview Tab */}
      <Box
        role="tabpanel"
        hidden={activeTab !== 0}
        id="tabpanel-0"
        aria-labelledby="tab-0"
      >
        {activeTab === 0 && (
          <Grid container spacing={3}>
            {/* Status and Timing */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <StatusIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Status and Timing</Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <TimeIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Created At" 
                        secondary={formatDate(simulation.createdAt)} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <TimeIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Started At" 
                        secondary={formatDate(simulation.startedAt)} 
                      />
                    </ListItem>
                    {simulation.completedAt && (
                      <ListItem>
                        <ListItemIcon>
                          <TimeIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Completed At" 
                          secondary={formatDate(simulation.completedAt)} 
                        />
                      </ListItem>
                    )}
                    <ListItem>
                      <ListItemIcon>
                        <TimeIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Elapsed Time" 
                        secondary={formatElapsedTime(
                          simulation.startedAt || simulation.createdAt,
                          simulation.completedAt
                        )} 
                      />
                    </ListItem>
                    {simulation.status === 'RUNNING' && (
                      <ListItem>
                        <ListItemIcon>
                          <TimeIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Estimated Completion" 
                          secondary={
                            simulation.progress && simulation.progress > 0
                              ? formatDate(new Date(
                                  Date.now() + 
                                  ((100 - simulation.progress) / simulation.progress) * 
                                  (Date.now() - new Date(simulation.startedAt || simulation.createdAt).getTime())
                                ).toISOString())
                              : 'Calculating...'
                          } 
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Cost Information */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CostIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Cost Information</Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CostIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Estimated Cost" 
                        secondary={formatCurrency(simulation.estimatedCost)} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CostIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Current Cost" 
                        secondary={formatCurrency(simulation.currentCost)} 
                      />
                    </ListItem>
                    {simulation.config?.computeConfig?.useSpot && (
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Using Spot Instances" 
                          secondary="70% discount applied to compute costs" 
                        />
                      </ListItem>
                    )}
                  </List>
                  
                  {simulation.status === 'RUNNING' && simulation.currentCost !== undefined && (
                    <Box sx={{ mt: 2 }}>
                      <Alert severity="info">
                        <Typography variant="body2">
                          Current spend rate: approximately ${(simulation.currentCost / 
                            (new Date().getTime() - new Date(simulation.startedAt || simulation.createdAt).getTime()) * 
                            3600000).toFixed(2)} per hour
                        </Typography>
                      </Alert>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
            
            {/* Resource Configuration */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ResourceIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Resource Configuration</Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Simulation Type" 
                        secondary={simulation.config?.simulationType === 'GC_CLASSIC' 
                          ? 'GEOS-Chem Classic' 
                          : 'GEOS-Chem High Performance'} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Instance Type" 
                        secondary={`${simulation.config?.computeConfig?.processorType || 'Standard'}, 
                                   ${simulation.config?.computeConfig?.instanceSize || 'Medium'}`} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Memory" 
                        secondary={simulation.config?.computeConfig?.memory || 'Standard'} 
                      />
                    </ListItem>
                    {simulation.batchJobId && (
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="AWS Batch Job ID" 
                          secondary={simulation.batchJobId} 
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Simulation Details */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SettingsIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Simulation Details</Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Chemistry Option" 
                        secondary={simulation.config?.chemistryOption || 'Standard'} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Domain" 
                        secondary={simulation.config?.domain || 'Global'} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText 
                        primary="Resolution" 
                        secondary={simulation.config?.resolution || 
                                   simulation.config?.cubedsphereRes || 
                                   'Standard'} 
                      />
                    </ListItem>
                    {simulation.config?.timeConfig && (
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Simulation Period" 
                          secondary={`${simulation.config.timeConfig.startDate} to ${simulation.config.timeConfig.endDate}`} 
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Recent Status Updates */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <LogIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6">Status Updates</Typography>
                  </Box>
                  
                  <Divider sx={{ mb: 2 }} />
                  
                  <List>
                    {statusUpdates.map((update, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          {update.status === 'FAILED' ? (
                            <WarningIcon color="error" />
                          ) : (
                            <InfoIcon color="info" />
                          )}
                        </ListItemIcon>
                        <ListItemText 
                          primary={update.message} 
                          secondary={formatDate(update.timestamp)} 
                        />
                        <Chip 
                          label={update.status} 
                          size="small" 
                          color={
                            update.status === 'FAILED' ? 'error' :
                            update.status === 'SUCCEEDED' ? 'success' :
                            update.status === 'RUNNING' ? 'primary' :
                            'default'
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>
      
      {/* Resources Tab */}
      <Box
        role="tabpanel"
        hidden={activeTab !== 1}
        id="tabpanel-1"
        aria-labelledby="tab-1"
      >
        {activeTab === 1 && (
          <ResourceMonitor simulation={simulation} />
        )}
      </Box>
      
      {/* Logs Tab */}
      <Box
        role="tabpanel"
        hidden={activeTab !== 2}
        id="tabpanel-2"
        aria-labelledby="tab-2"
      >
        {activeTab === 2 && (
          <LogViewer 
            simulationId={simulationId} 
            logLevel={logLevel}
            onLogLevelChange={handleLogLevelChange}
          />
        )}
      </Box>
      
      {/* Timeline Tab */}
      <Box
        role="tabpanel"
        hidden={activeTab !== 3}
        id="tabpanel-3"
        aria-labelledby="tab-3"
      >
        {activeTab === 3 && (
          <TimelineView simulation={simulation} statusUpdates={statusUpdates} />
        )}
      </Box>
      
      {/* Cancellation Confirmation Dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={handleCancelDialogClose}
        aria-labelledby="cancel-dialog-title"
        aria-describedby="cancel-dialog-description"
      >
        <DialogTitle id="cancel-dialog-title">
          Cancel Simulation?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="cancel-dialog-description">
            Are you sure you want to cancel this simulation? 
            This action will terminate the running job and cannot be undone.
            You will still have access to any results generated so far.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDialogClose}>No, Keep Running</Button>
          <Button 
            onClick={handleCancelSimulation} 
            color="error" 
            variant="contained"
            startIcon={<CancelIcon />}
          >
            Yes, Cancel Simulation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SimulationMonitor;