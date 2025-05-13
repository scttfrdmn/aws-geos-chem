import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CompareArrows as CompareIcon,
  Visibility as VisibilityIcon,
  SaveAlt as SaveAltIcon,
  ViewList as ViewListIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { fetchSimulations } from '../../store/slices/simulationsSlice';
import { 
  fetchComparisonData, 
  addSimulationToComparison, 
  removeSimulationFromComparison 
} from '../../store/slices/comparisonSlice';

// Sub-components
import SimulationSelector from './SimulationSelector';
import ConfigComparison from './ConfigComparison';
import OutputComparison from './OutputComparison';
import SpatialComparison from './SpatialComparison';
import TimeSeriesComparison from './TimeSeriesComparison';
import StatisticalComparison from './StatisticalComparison';

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
      id={`comparison-tabpanel-${index}`}
      aria-labelledby={`comparison-tab-${index}`}
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

const SimulationComparison: React.FC = () => {
  const dispatch = useDispatch();
  const { simulations } = useSelector((state: RootState) => state.simulations);
  const { 
    selectedSimulations, 
    comparisonData, 
    loading, 
    error 
  } = useSelector((state: RootState) => state.comparison);
  
  const [tabValue, setTabValue] = useState(0);
  const [showSelector, setShowSelector] = useState(false);
  
  // Load simulations when component mounts
  useEffect(() => {
    dispatch(fetchSimulations());
  }, [dispatch]);
  
  // Fetch comparison data when selected simulations change
  useEffect(() => {
    if (selectedSimulations.length >= 2) {
      dispatch(fetchComparisonData(selectedSimulations));
    }
  }, [selectedSimulations, dispatch]);
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleRemoveSimulation = (simId: string) => {
    dispatch(removeSimulationFromComparison(simId));
  };
  
  const handleAddSimulation = (simId: string) => {
    dispatch(addSimulationToComparison(simId));
    setShowSelector(false);
  };
  
  const handleRefreshComparison = () => {
    if (selectedSimulations.length >= 2) {
      dispatch(fetchComparisonData(selectedSimulations));
    }
  };
  
  // Get simulation name from ID
  const getSimulationName = (simId: string) => {
    const simulation = simulations.find(sim => sim.id === simId);
    return simulation ? simulation.name : simId;
  };
  
  return (
    <Box>
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CompareIcon sx={{ fontSize: 30, mr: 1, color: 'primary.main' }} />
            <Typography variant="h5">
              Simulation Comparison
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Refresh comparison">
              <IconButton 
                onClick={handleRefreshComparison}
                disabled={selectedSimulations.length < 2}
                sx={{ mr: 1 }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowSelector(true)}
              disabled={showSelector}
            >
              Add Simulation
            </Button>
          </Box>
        </Box>
        
        <Typography variant="body1" color="text.secondary">
          Compare multiple GEOS-Chem simulations to understand differences in configuration, outputs, and performance.
        </Typography>
      </Paper>
      
      {/* Show simulation selector or currently selected simulations */}
      {showSelector ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <SimulationSelector 
            onSelect={handleAddSimulation}
            onCancel={() => setShowSelector(false)}
            selectedSimulations={selectedSimulations}
          />
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Selected Simulations
          </Typography>
          
          {selectedSimulations.length > 0 ? (
            <List>
              {selectedSimulations.map((simId) => (
                <ListItem key={simId}>
                  <ListItemText
                    primary={getSimulationName(simId)}
                    secondary={simId}
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="View simulation details">
                      <IconButton 
                        edge="end" 
                        aria-label="view"
                        onClick={() => window.open(`/simulations/${simId}`, '_blank')}
                        sx={{ mr: 1 }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remove from comparison">
                      <IconButton 
                        edge="end" 
                        aria-label="delete"
                        onClick={() => handleRemoveSimulation(simId)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info">
              No simulations selected. Add at least two simulations to compare.
            </Alert>
          )}
          
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setShowSelector(true)}
            >
              Add Simulation
            </Button>
          </Box>
        </Paper>
      )}
      
      {/* Error message if any */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Comparison content */}
      {selectedSimulations.length >= 2 ? (
        <Paper variant="outlined" sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="comparison tabs"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Configuration" id="comparison-tab-0" aria-controls="comparison-tabpanel-0" />
            <Tab label="Outputs" id="comparison-tab-1" aria-controls="comparison-tabpanel-1" />
            <Tab label="Spatial" id="comparison-tab-2" aria-controls="comparison-tabpanel-2" />
            <Tab label="Time Series" id="comparison-tab-3" aria-controls="comparison-tabpanel-3" />
            <Tab label="Statistics" id="comparison-tab-4" aria-controls="comparison-tabpanel-4" />
          </Tabs>
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TabPanel value={tabValue} index={0}>
                <ConfigComparison
                  simulations={selectedSimulations.map(id => 
                    simulations.find(sim => sim.id === id)
                  ).filter(Boolean) as any[]}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={1}>
                <OutputComparison
                  comparisonData={comparisonData}
                  simulationIds={selectedSimulations}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={2}>
                <SpatialComparison
                  comparisonData={comparisonData}
                  simulationIds={selectedSimulations}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={3}>
                <TimeSeriesComparison
                  comparisonData={comparisonData}
                  simulationIds={selectedSimulations}
                />
              </TabPanel>
              
              <TabPanel value={tabValue} index={4}>
                <StatisticalComparison
                  comparisonData={comparisonData}
                  simulationIds={selectedSimulations}
                />
              </TabPanel>
            </>
          )}
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <CompareIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Select at least two simulations to compare
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Use the "Add Simulation" button to select simulations for comparison.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default SimulationComparison;