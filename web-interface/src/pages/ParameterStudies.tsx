import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Divider,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
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
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Cancel as CancelIcon,
  Assessment as AssessmentIcon,
  BarChart as BarChartIcon,
  BubbleChart as BubbleChartIcon,
  Science as ScienceIcon,
  Timeline as TimelineIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { 
  fetchParameterStudies, 
  cancelParameterStudy, 
  generateStudyReport 
} from '../store/slices/parameterStudySlice';
import ParameterStudy from '../components/parameter-study/ParameterStudy';

const ParameterStudies: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { studies, loading, error } = useSelector((state: RootState) => state.parameterStudy);
  const [showNewStudyForm, setShowNewStudyForm] = useState(false);
  
  useEffect(() => {
    dispatch(fetchParameterStudies());
  }, [dispatch]);
  
  const handleRefresh = () => {
    dispatch(fetchParameterStudies());
  };
  
  const handleNewStudy = () => {
    setShowNewStudyForm(true);
  };
  
  const handleViewStudy = (studyId: string) => {
    navigate(`/parameter-studies/${studyId}`);
  };
  
  const handleCancelStudy = (studyId: string) => {
    if (window.confirm('Are you sure you want to cancel this parameter study? This action cannot be undone.')) {
      dispatch(cancelParameterStudy(studyId));
    }
  };
  
  const handleGenerateReport = (studyId: string) => {
    dispatch(generateStudyReport(studyId));
    alert('Report generation has started. It will be available once completed.');
  };
  
  // Get status color based on study status
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
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString();
  };
  
  // Get progress percentage based on simulations and status
  const getProgressPercentage = (study: any) => {
    if (study.status === 'completed') return 100;
    if (study.status === 'created') return 0;
    
    // For running studies, estimate based on simulations
    if (study.simulationStatuses) {
      const completed = Object.values(study.simulationStatuses).filter(
        (status: any) => status === 'COMPLETED' || status === 'FAILED'
      ).length;
      return Math.round((completed / study.simulations.length) * 100);
    }
    
    // Fallback to 50% for running studies without detailed status
    return study.status === 'running' ? 50 : 0;
  };
  
  // Get visualization icon based on type
  const getVisualizationIcon = (type: string) => {
    switch (type) {
      case 'sensitivity_heatmap':
      case 'correlation_matrix':
        return <BubbleChartIcon fontSize="small" />;
      case 'box_plots':
      case 'tornado_plot':
        return <BarChartIcon fontSize="small" />;
      case 'parameter_sweep':
      case 'time_series':
      case 'parallel_coordinates':
        return <TimelineIcon fontSize="small" />;
      default:
        return <AssessmentIcon fontSize="small" />;
    }
  };
  
  return (
    <Box>
      {showNewStudyForm ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              New Parameter Study
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setShowNewStudyForm(false)}
            >
              Cancel
            </Button>
          </Box>
          <ParameterStudy />
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1">
              Parameter Studies
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
                onClick={handleNewStudy}
              >
                New Study
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
                  Parameter Studies for GEOS-Chem
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Explore how model outputs change with varying input parameters. Identify key sensitivities and optimize model performance.
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body1" paragraph>
              Parameter studies allow you to:
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Identify Sensitivities
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Discover which parameters have the greatest impact on model outputs
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Optimize Parameters
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Find parameter values that maximize or minimize specific outcomes
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Explore Uncertainties
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Understand how parameter uncertainties propagate to model results
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Visualize Relationships
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      See complex parameter-output relationships through interactive visualizations
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewStudy}
            >
              Create New Parameter Study
            </Button>
          </Paper>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {loading && studies.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : studies.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Study Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Progress</TableCell>
                    <TableCell>Parameters</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {studies.map((study) => (
                    <TableRow key={study.id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body1">{study.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {study.description || 'No description'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={study.studyType}
                          size="small"
                          color={
                            study.studyType === 'sensitivity' ? 'primary' :
                            study.studyType === 'optimization' ? 'secondary' : 'default'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={study.status}
                          size="small"
                          color={getStatusColor(study.status) as any}
                        />
                      </TableCell>
                      <TableCell sx={{ width: '15%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={getProgressPercentage(study)}
                              color={study.status === 'failed' ? 'error' : 'primary'}
                            />
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {getProgressPercentage(study)}%
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="caption" display="block">
                          {study.simulations?.length || 0} simulations
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {study.parameters.slice(0, 3).map((param: any, index: number) => (
                            <Chip
                              key={index}
                              label={param.name}
                              size="small"
                              variant="outlined"
                              sx={{ m: 0.2 }}
                            />
                          ))}
                          {study.parameters.length > 3 && (
                            <Chip
                              label={`+${study.parameters.length - 3} more`}
                              size="small"
                              variant="outlined"
                              sx={{ m: 0.2 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {formatDate(study.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex' }}>
                          <Tooltip title="View study details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewStudy(study.id)}
                            >
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {study.status === 'running' && (
                            <Tooltip title="Cancel study">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleCancelStudy(study.id)}
                              >
                                <CancelIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {study.status === 'completed' && (
                            <Tooltip title="Generate report">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleGenerateReport(study.id)}
                              >
                                <AssessmentIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {study.status === 'completed' && study.results?.plots && (
                            <Tooltip title="Download results">
                              <IconButton
                                size="small"
                                color="primary"
                              >
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
          ) : (
            <Alert severity="info">
              No parameter studies found. Create a new study to get started.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
};

export default ParameterStudies;