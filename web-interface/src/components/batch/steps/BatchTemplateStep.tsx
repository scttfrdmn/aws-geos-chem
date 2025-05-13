import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Divider,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper
} from '@mui/material';
import {
  Check as CheckIcon,
  Science as ScienceIcon,
  Api as ApiIcon,
  AddCircleOutline as AddCircleOutlineIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { fetchSimulationTemplates } from '../../../store/slices/batchSlice';
import { Simulation } from '../../../types/simulation';

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
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface BatchTemplateStepProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
}

const BatchTemplateStep: React.FC<BatchTemplateStepProps> = ({
  selectedTemplateId,
  onSelectTemplate
}) => {
  const dispatch = useDispatch();
  const { templates, loading, error } = useSelector((state: RootState) => state.batch);
  const simulations = useSelector((state: RootState) => state.simulations.simulations);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(fetchSimulationTemplates());
  }, [dispatch]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSelectTemplate = (templateId: string) => {
    onSelectTemplate(templateId);
  };

  const handleSelectExistingSimulation = (simulationId: string) => {
    onSelectTemplate(simulationId);
  };

  // Filter templates based on search query
  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter simulations based on search query
  const filteredSimulations = simulations.filter(simulation =>
    simulation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    simulation.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderTemplateCard = (template: any) => (
    <Grid item xs={12} md={6} lg={4} key={template.id}>
      <Card 
        variant="outlined"
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          border: selectedTemplateId === template.id ? 2 : 1,
          borderColor: selectedTemplateId === template.id ? 'primary.main' : 'divider'
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ScienceIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" component="div">
              {template.name}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {template.description || 'No description available'}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Scientific Configuration:</strong> {template.config.simulationType}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Domain:</strong> {template.config.domain.region} at {template.config.domain.resolution} resolution
          </Typography>
          <Typography variant="body2">
            <strong>Created:</strong> {new Date(template.createdAt).toLocaleDateString()}
          </Typography>
        </CardContent>
        <CardActions>
          <Button
            size="small"
            variant={selectedTemplateId === template.id ? "contained" : "outlined"}
            onClick={() => handleSelectTemplate(template.id)}
            startIcon={selectedTemplateId === template.id ? <CheckIcon /> : undefined}
            fullWidth
          >
            {selectedTemplateId === template.id ? "Selected" : "Select"}
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );

  const renderSimulationCard = (simulation: Simulation) => (
    <Grid item xs={12} md={6} lg={4} key={simulation.id}>
      <Card 
        variant="outlined"
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          border: selectedTemplateId === simulation.id ? 2 : 1,
          borderColor: selectedTemplateId === simulation.id ? 'primary.main' : 'divider'
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ApiIcon color="info" sx={{ mr: 1 }} />
            <Typography variant="h6" component="div">
              {simulation.name}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {simulation.description || 'No description available'}
          </Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Status:</strong> {simulation.status}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Scientific Configuration:</strong> {simulation.config.simulationType}
          </Typography>
          <Typography variant="body2">
            <strong>Created:</strong> {new Date(simulation.createdAt).toLocaleDateString()}
          </Typography>
        </CardContent>
        <CardActions>
          <Button
            size="small"
            variant={selectedTemplateId === simulation.id ? "contained" : "outlined"}
            onClick={() => handleSelectExistingSimulation(simulation.id)}
            startIcon={selectedTemplateId === simulation.id ? <CheckIcon /> : undefined}
            fullWidth
          >
            {selectedTemplateId === simulation.id ? "Selected" : "Select"}
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select a Template
      </Typography>
      <Typography variant="body1" paragraph>
        Choose a template or existing simulation as the base configuration for your batch process. Parameters will be varied around this base configuration.
      </Typography>

      <TextField
        label="Search templates and simulations"
        variant="outlined"
        fullWidth
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Enter keywords to filter templates..."
        sx={{ mb: 3 }}
      />

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="template selection tabs"
        >
          <Tab label="Templates" id="template-tab-0" aria-controls="template-tabpanel-0" />
          <Tab label="Existing Simulations" id="template-tab-1" aria-controls="template-tabpanel-1" />
          <Tab label="Create New" id="template-tab-2" aria-controls="template-tabpanel-2" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : filteredTemplates.length > 0 ? (
          <Grid container spacing={3}>
            {filteredTemplates.map(template => renderTemplateCard(template))}
          </Grid>
        ) : (
          <Alert severity="info">
            No templates found. {searchQuery ? 'Try a different search term.' : 'Create a template first.'}
          </Alert>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {filteredSimulations.length > 0 ? (
          <Grid container spacing={3}>
            {filteredSimulations.map(simulation => renderSimulationCard(simulation))}
          </Grid>
        ) : (
          <Alert severity="info">
            No simulations found. {searchQuery ? 'Try a different search term.' : 'Create a simulation first.'}
          </Alert>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Create a New Template
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            You'll need to create a new base configuration for your batch simulations.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            href="/simulations/new?batchTemplate=true"
          >
            Create New Template
          </Button>
        </Box>
      </TabPanel>
    </Box>
  );
};

export default BatchTemplateStep;