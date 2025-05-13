import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Container,
  Paper,
  Grid,
  Tabs,
  Tab,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  Divider,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Home as HomeIcon,
  Science as ScienceIcon,
  Settings as SettingsIcon,
  MonetizationOn as CostIcon,
  Storage as StorageIcon,
  Assessment as ResultsIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';

import { RootState } from '../store';
import { fetchSimulation } from '../store/slices/simulationsSlice';
import { fetchSimulationOptimizations } from '../store/slices/costSlice';
import CostOptimizationComponent from '../components/cost/CostOptimizationComponent';
import SimulationMonitor from '../components/monitoring/SimulationMonitor';

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
      id={`simulation-tabpanel-${index}`}
      aria-labelledby={`simulation-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simulation-tab-${index}`,
    'aria-controls': `simulation-tabpanel-${index}`,
  };
}

const SimulationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch();
  const [tabValue, setTabValue] = useState(0);

  // Redux state selectors
  const { currentSimulation, loading, error } = useSelector((state: RootState) => state.simulations);

  // Fetch simulation data when component mounts
  useEffect(() => {
    if (id) {
      dispatch(fetchSimulation(id) as any);
      dispatch(fetchSimulationOptimizations(id) as any);
    }
  }, [dispatch, id]);

  // Handle tab change
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={60} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">
          Error loading simulation: {error}
        </Alert>
      </Container>
    );
  }

  if (!currentSimulation && !loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning">
          Simulation not found. The simulation with ID {id} may have been deleted or you don't have permission to view it.
        </Alert>
        <Button
          component={RouterLink}
          to="/simulations"
          variant="outlined"
          startIcon={<BackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Simulations
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }} aria-label="breadcrumb">
        <Link
          component={RouterLink}
          to="/"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Home
        </Link>
        <Link
          component={RouterLink}
          to="/simulations"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <ScienceIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Simulations
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          {currentSimulation?.name || id}
        </Typography>
      </Breadcrumbs>

      {/* Simulation Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h4" component="h1" gutterBottom>
              {currentSimulation?.name || 'Simulation Details'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {currentSimulation?.description || 'No description provided.'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary">
              Status:
            </Typography>
            <Typography variant="h6" color="primary">
              {currentSimulation?.status || 'Unknown'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created: {currentSimulation?.createdAt ? new Date(currentSimulation.createdAt).toLocaleString() : 'Unknown'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleChange}
            aria-label="simulation detail tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<SettingsIcon />} label="Configuration" {...a11yProps(0)} />
            <Tab icon={<ResultsIcon />} label="Monitoring" {...a11yProps(1)} />
            <Tab icon={<StorageIcon />} label="Results" {...a11yProps(2)} />
            <Tab icon={<CostIcon />} label="Cost & Optimization" {...a11yProps(3)} />
          </Tabs>
        </Box>

        {/* Configuration Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Simulation Configuration
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Simulation Type:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.simulationType || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Chemistry Option:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.chemistryOption || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Resolution:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.resolution || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Meteorology:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.meteorology || 'Not specified'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Compute Resources
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Instance Type:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.instanceType || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Instance Count:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.instanceCount || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Using Spot:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.useSpot ? 'Yes' : 'No'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Storage (GB):
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.storageGB || 'Not specified'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Simulation Period
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Start Date:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.startDate || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      End Date:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.endDate || 'Not specified'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Spinup Days:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.spinupDays || 'None'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Total Duration:
                    </Typography>
                    <Typography variant="body1">
                      {currentSimulation?.durationDays ? `${currentSimulation.durationDays} days` : 'Not specified'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Monitoring Tab */}
        <TabPanel value={tabValue} index={1}>
          {id && <SimulationMonitor simulationId={id} />}
        </TabPanel>

        {/* Results Tab */}
        <TabPanel value={tabValue} index={2}>
          <Alert severity="info">
            Results tab content will be implemented in a future update.
          </Alert>
        </TabPanel>

        {/* Cost & Optimization Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Cost Summary
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          Estimated Cost
                        </Typography>
                        <Typography variant="h4" color="primary">
                          ${currentSimulation?.estimatedCost?.toFixed(2) || '0.00'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          Current Cost
                        </Typography>
                        <Typography variant="h4" color="secondary">
                          ${currentSimulation?.currentCost?.toFixed(2) || '0.00'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary">
                          Estimated Completion
                        </Typography>
                        <Typography variant="h4">
                          {currentSimulation?.estimatedCompletion
                            ? new Date(currentSimulation.estimatedCompletion).toLocaleDateString()
                            : 'Unknown'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Cost Optimization Recommendations
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {id && <CostOptimizationComponent simulationId={id} />}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>
    </Container>
  );
};

export default SimulationDetail;