import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { fetchSimulationResults } from '../../store/slices/resultsSlice';
import FileBrowser from './FileBrowser';
import FileViewer from './FileViewer';
import DataVisualization from './DataVisualization';

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
      id={`results-tabpanel-${index}`}
      aria-labelledby={`results-tab-${index}`}
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

const ResultsViewer: React.FC = () => {
  const { simulationId } = useParams<{ simulationId: string }>();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  const { 
    results, 
    loading, 
    error 
  } = useSelector((state: RootState) => state.results);
  
  const simulation = useSelector((state: RootState) => 
    state.simulations.simulations.find(sim => sim.id === simulationId)
  );

  useEffect(() => {
    if (simulationId) {
      dispatch(fetchSimulationResults(simulationId));
    }
  }, [simulationId, dispatch]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    // If selecting a file, automatically switch to file viewer tab
    setActiveTab(1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading results: {error}
      </Alert>
    );
  }

  if (!simulation) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Simulation not found
      </Alert>
    );
  }

  return (
    <Box>
      <Paper 
        elevation={0} 
        variant="outlined" 
        sx={{ p: 2, mb: 3, borderRadius: 2 }}
      >
        <Typography variant="h5">
          Results: {simulation.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Simulation ID: {simulationId}
        </Typography>
      </Paper>

      <Box sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange} 
            aria-label="results viewer tabs"
          >
            <Tab label="Files" id="results-tab-0" aria-controls="results-tabpanel-0" />
            <Tab 
              label="File Viewer" 
              id="results-tab-1" 
              aria-controls="results-tabpanel-1" 
              disabled={!selectedFile}
            />
            <Tab label="Visualizations" id="results-tab-2" aria-controls="results-tabpanel-2" />
          </Tabs>
        </Box>
        
        <TabPanel value={activeTab} index={0}>
          <FileBrowser 
            results={results} 
            onFileSelect={handleFileSelect} 
            selectedFile={selectedFile}
          />
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          {selectedFile && (
            <FileViewer filePath={selectedFile} simulationId={simulationId!} />
          )}
        </TabPanel>
        
        <TabPanel value={activeTab} index={2}>
          <DataVisualization simulationId={simulationId!} results={results} />
        </TabPanel>
      </Box>
    </Box>
  );
};

export default ResultsViewer;