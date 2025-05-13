import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Divider,
  Grid,
  Paper,
  Chip,
  LinearProgress,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  PauseCircleOutline as PauseCircleOutlineIcon,
  Science as ScienceIcon,
  ListAlt as ListAltIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchBatchJobs, cancelBatchJob } from '../store/slices/batchSlice';
import BatchProcessing from '../components/batch/BatchProcessing';

const BatchSimulations: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { batchJobs, loading, error } = useSelector((state: RootState) => state.batch);
  const [showNewBatchForm, setShowNewBatchForm] = React.useState(false);
  
  useEffect(() => {
    dispatch(fetchBatchJobs());
  }, [dispatch]);
  
  const handleRefresh = () => {
    dispatch(fetchBatchJobs());
  };
  
  const handleNewBatch = () => {
    setShowNewBatchForm(true);
  };
  
  const handleViewBatch = (batchId: string) => {
    navigate(`/batches/${batchId}`);
  };
  
  const handleCancelBatch = (batchId: string) => {
    if (window.confirm('Are you sure you want to cancel this batch job? This action cannot be undone.')) {
      dispatch(cancelBatchJob(batchId));
    }
  };
  
  // Get status color based on batch status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED':
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
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  // Calculate completion percentage
  const calculateCompletionPercentage = (batch: any) => {
    if (batch.totalSimulations === 0) return 0;
    return Math.round(
      ((batch.completedSimulations + batch.failedSimulations) / batch.totalSimulations) * 100
    );
  };
  
  return (
    <Box>
      {showNewBatchForm ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              New Batch Process
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setShowNewBatchForm(false)}
            >
              Cancel
            </Button>
          </Box>
          <BatchProcessing />
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              Batch Simulations
            </Typography>
            <Box>
              <Tooltip title="Refresh list">
                <IconButton onClick={handleRefresh} sx={{ mr: 1 }}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleNewBatch}
              >
                New Batch
              </Button>
            </Box>
          </Box>
          
          <Paper 
            elevation={0} 
            variant="outlined" 
            sx={{ p: 3, mb: 3, borderRadius: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ScienceIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
              <Box>
                <Typography variant="h6">
                  Parameter Studies with Batch Processing
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Run multiple GEOS-Chem simulations with varying parameters to explore scientific questions efficiently.
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body1" paragraph>
              Batch processing allows you to:
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Explore Parameter Space
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Vary model parameters systematically to understand their impacts
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Sensitivity Analysis
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Identify which parameters have the greatest impact on results
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Optimize Resources
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Efficiently utilize cloud computing for multiple simulations
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Compare Results
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Easily compare outputs across different parameter configurations
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewBatch}
            >
              Create New Batch
            </Button>
          </Paper>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {loading && batchJobs.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : batchJobs.length > 0 ? (
            <Paper variant="outlined" sx={{ mb: 3 }}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Batch Name</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Simulations</TableCell>
                      <TableCell>Progress</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Cost</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchJobs.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body1">{batch.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {batch.description || 'No description'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={batch.status}
                            color={getStatusColor(batch.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {batch.completedSimulations} / {batch.totalSimulations} completed
                          </Typography>
                          <Typography variant="body2" color="error">
                            {batch.failedSimulations > 0 ? `${batch.failedSimulations} failed` : ''}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ width: '20%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={calculateCompletionPercentage(batch)}
                                color={batch.failedSimulations > 0 ? 'warning' : 'primary'}
                              />
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">{`${calculateCompletionPercentage(batch)}%`}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{formatDate(batch.createdAt)}</TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            ${batch.actualCost.toFixed(2)} / ${batch.estimatedCost.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex' }}>
                            <Tooltip title="View batch details">
                              <IconButton
                                size="small"
                                onClick={() => handleViewBatch(batch.id)}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </Tooltip>
                            
                            {batch.status === 'RUNNING' && (
                              <Tooltip title="Cancel batch">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleCancelBatch(batch.id)}
                                >
                                  <CancelIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {batch.status === 'CREATED' && (
                              <Tooltip title="Start batch">
                                <IconButton size="small" color="primary">
                                  <PlayCircleOutlineIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {batch.status === 'RUNNING' && (
                              <Tooltip title="Pause batch">
                                <IconButton size="small" color="warning">
                                  <PauseCircleOutlineIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {batch.status === 'COMPLETED' && (
                              <Tooltip title="View results">
                                <IconButton size="small" color="primary">
                                  <ListAltIcon />
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
            </Paper>
          ) : (
            <Alert severity="info" sx={{ mb: 3 }}>
              No batch simulations found. Create a new batch to get started.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
};

export default BatchSimulations;