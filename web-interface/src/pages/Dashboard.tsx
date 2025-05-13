import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { fetchSimulations } from '../store/slices/simulationsSlice';
import { fetchRealTimeCost } from '../store/slices/costSlice';

// MUI components
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';

// MUI icons
import {
  PlayArrow as PlayIcon,
  Check as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Sync as RunningIcon,
  Add as AddIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';

// Custom components
import StatusChip from '../components/common/StatusChip';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  // Get data from Redux store
  const { simulations, loading: simulationsLoading } = useSelector((state: RootState) => state.simulations);
  const { costs, summary, loading: costsLoading } = useSelector((state: RootState) => state.cost);
  const { user } = useSelector((state: RootState) => state.auth);
  
  // Fetch data on component mount
  useEffect(() => {
    dispatch(fetchSimulations());
    dispatch(fetchRealTimeCost());
    
    // Set up real-time cost polling
    const costInterval = setInterval(() => {
      dispatch(fetchRealTimeCost());
    }, 60000); // Update every minute
    
    return () => clearInterval(costInterval);
  }, [dispatch]);
  
  // Get active and recent simulations
  const activeSimulations = simulations.filter(sim => ['SUBMITTED', 'RUNNING'].includes(sim.status));
  const recentSimulations = simulations
    .filter(sim => ['SUCCEEDED', 'FAILED'].includes(sim.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);
  
  // Calculate statistics
  const successfulSimulations = simulations.filter(sim => sim.status === 'SUCCEEDED').length;
  const failedSimulations = simulations.filter(sim => sim.status === 'FAILED').length;
  const totalSimulations = simulations.length;
  const successRate = totalSimulations > 0 ? Math.round((successfulSimulations / totalSimulations) * 100) : 0;
  
  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/new-simulation')}
        >
          New Simulation
        </Button>
      </Box>
      
      {/* Main content */}
      <Grid container spacing={3}>
        {/* Active simulations */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Active Simulations
            </Typography>
            {simulationsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : activeSimulations.length > 0 ? (
              <List>
                {activeSimulations.map((simulation) => (
                  <React.Fragment key={simulation.simulationId}>
                    <ListItem 
                      button 
                      onClick={() => navigate(`/simulations/${simulation.simulationId}`)}
                      secondaryAction={
                        <StatusChip status={simulation.status} />
                      }
                    >
                      <ListItemText
                        primary={simulation.name}
                        secondary={`Started: ${new Date(simulation.startedAt || simulation.createdAt).toLocaleString()}`}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No active simulations
                </Typography>
                <Button 
                  variant="outlined" 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/new-simulation')}
                >
                  Start a new simulation
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Cost summary */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Cost Summary
            </Typography>
            {costsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Current Usage
                      </Typography>
                      <Typography variant="h5">
                        ${summary.totalCost.toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Forecast
                      </Typography>
                      <Typography variant="h5">
                        ${summary.forecastedCost.toFixed(2)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Active Resources
                </Typography>
                {activeSimulations.length > 0 ? (
                  <List dense>
                    {activeSimulations.map(sim => {
                      const costItem = costs.find(c => 
                        c.simulationId === sim.simulationId && c.costType === 'real-time'
                      );
                      return (
                        <ListItem key={sim.simulationId}>
                          <ListItemText
                            primary={sim.name}
                            secondary={costItem ? 
                              `${costItem.costBreakdown.elapsedHours.toFixed(1)} hours • $${costItem.estimatedCost.toFixed(2)}` : 
                              'Calculating...'
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                    No active resources
                  </Typography>
                )}
                
                <Button 
                  fullWidth 
                  variant="text" 
                  sx={{ mt: 2 }}
                  onClick={() => navigate('/costs')}
                >
                  View Cost Details
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Statistics */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Total Simulations
                  </Typography>
                  <Typography variant="h3">
                    {totalSimulations}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Successful
                  </Typography>
                  <Typography variant="h3" color="success.main">
                    {successfulSimulations}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Failed
                  </Typography>
                  <Typography variant="h3" color="error.main">
                    {failedSimulations}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Success Rate
                  </Typography>
                  <Typography variant="h3">
                    {successRate}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
        
        {/* Recent simulations */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Simulations
            </Typography>
            {simulationsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : recentSimulations.length > 0 ? (
              <List>
                {recentSimulations.map((simulation) => (
                  <React.Fragment key={simulation.simulationId}>
                    <ListItem 
                      button 
                      onClick={() => navigate(`/simulations/${simulation.simulationId}`)}
                      secondaryAction={
                        <StatusChip status={simulation.status} />
                      }
                    >
                      <ListItemText
                        primary={simulation.name}
                        secondary={`Completed: ${new Date(simulation.completedAt || simulation.updatedAt).toLocaleString()}`}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body1" color="text.secondary">
                  No recent simulations
                </Typography>
              </Box>
            )}
            
            <Button 
              fullWidth 
              variant="text" 
              sx={{ mt: 2 }}
              onClick={() => navigate('/simulations')}
            >
              View All Simulations
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;