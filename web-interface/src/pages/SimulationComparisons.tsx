import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Breadcrumbs,
  Link,
  Paper,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import {
  Home as HomeIcon,
  Science as ScienceIcon,
  Compare as CompareIcon,
  Add as AddIcon
} from '@mui/icons-material';

import TimeSeriesComparison from '../components/results/TimeSeriesComparison';
import SpatialComparison from '../components/comparison/SpatialComparison';

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
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SimulationComparisons: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const { simulationIds } = useParams<{ simulationIds?: string }>();
  
  // Parse simulation IDs from URL if provided
  const initialSimulationIds = simulationIds ? simulationIds.split(',') : [];
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
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
          <CompareIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Comparisons
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Simulation Comparisons
        </Typography>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          component={RouterLink}
          to="/simulations"
        >
          Select Simulations
        </Button>
      </Box>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Compare results from multiple GEOS-Chem simulations to analyze differences and similarities across different configurations, input data, or time periods.
      </Typography>
      
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="comparison tabs"
          >
            <Tab label="Time Series" id="comparison-main-tab-0" aria-controls="comparison-main-tabpanel-0" />
            <Tab label="Spatial Comparison" id="comparison-main-tab-1" aria-controls="comparison-main-tabpanel-1" />
            <Tab label="Budget Comparison" id="comparison-main-tab-2" aria-controls="comparison-main-tabpanel-2" disabled />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <TimeSeriesComparison initialSimulationIds={initialSimulationIds} />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <SpatialComparison comparisonData={{}} simulationIds={initialSimulationIds} />
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Budget Comparison Coming Soon
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This feature will allow comparing mass budgets across different simulations.
            </Typography>
          </Box>
        </TabPanel>
      </Paper>
      
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          How to Compare Simulations
        </Typography>
        
        <Box component="ol" sx={{ pl: 2 }}>
          <Box component="li" sx={{ mb: 1 }}>
            <Typography variant="body1">
              Select the simulations you want to compare from the simulations list or dashboard.
            </Typography>
          </Box>
          <Box component="li" sx={{ mb: 1 }}>
            <Typography variant="body1">
              Choose a variable of interest to compare across all selected simulations.
            </Typography>
          </Box>
          <Box component="li" sx={{ mb: 1 }}>
            <Typography variant="body1">
              Use the Time Series tab to visualize how the variable changes over time across different simulations.
            </Typography>
          </Box>
          <Box component="li" sx={{ mb: 1 }}>
            <Typography variant="body1">
              For more detailed analysis, use the Correlation and Statistics tabs to quantify differences between simulations.
            </Typography>
          </Box>
          <Box component="li">
            <Typography variant="body1">
              Select a reference simulation to calculate relative differences and statistical metrics relative to that simulation.
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default SimulationComparisons;