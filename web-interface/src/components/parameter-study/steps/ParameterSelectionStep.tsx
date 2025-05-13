import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  IconButton,
  Grid,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  Tune as TuneIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

interface Parameter {
  name: string;
  path: string;
  range: [number, number] | string[];
  type: 'continuous' | 'discrete' | 'categorical';
  samplingPoints: number;
  distribution?: 'uniform' | 'normal' | 'log-normal';
  mean?: number;
  stdDev?: number;
  importance?: number;
}

interface ParameterSelectionStepProps {
  parameters: Parameter[];
  onParametersChange: (parameters: Parameter[]) => void;
  baseSimulationId: string;
  studyType: 'sensitivity' | 'optimization' | 'exploration';
  samplingMethod: 'grid' | 'random' | 'latin-hypercube' | 'sobol';
}

const ParameterSelectionStep: React.FC<ParameterSelectionStepProps> = ({
  parameters,
  onParametersChange,
  baseSimulationId,
  studyType,
  samplingMethod
}) => {
  // Simulations and parameterizable options
  const simulations = useSelector((state: RootState) => state.simulations.simulations);
  const baseSimulation = simulations.find(sim => sim.id === baseSimulationId);
  
  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editParameterIndex, setEditParameterIndex] = useState<number | null>(null);
  const [newParameter, setNewParameter] = useState<Parameter>({
    name: '',
    path: '',
    range: [0, 0],
    type: 'continuous',
    samplingPoints: 5
  });
  
  // Generate potential parameters from base simulation
  const [potentialParameters, setPotentialParameters] = useState<Array<{
    name: string;
    path: string;
    defaultValue: any;
    type: 'continuous' | 'discrete' | 'categorical';
    suggested?: boolean;
  }>>([]);
  
  useEffect(() => {
    if (baseSimulation) {
      generatePotentialParameters(baseSimulation);
    }
  }, [baseSimulation]);
  
  const generatePotentialParameters = (simulation: any) => {
    const params: any[] = [];
    
    // Extract scientific options
    if (simulation.config?.scientificOptions) {
      const scientificOptions = simulation.config.scientificOptions;
      
      Object.entries(scientificOptions).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          params.push({
            name: formatParameterName(key),
            path: `scientificOptions.${key}`,
            defaultValue: value,
            type: 'categorical',
            suggested: key === 'chemistry' || key === 'aerosols'
          });
        }
      });
    }
    
    // Extract domain options
    if (simulation.config?.domain) {
      const domain = simulation.config.domain;
      
      // Resolution
      params.push({
        name: 'Resolution',
        path: 'domain.resolution',
        defaultValue: domain.resolution,
        type: 'categorical',
        suggested: true
      });
      
      // Vertical levels
      params.push({
        name: 'Vertical Levels',
        path: 'domain.verticalLevels',
        defaultValue: domain.verticalLevels,
        type: 'discrete',
        suggested: true
      });
      
      // Custom bounds if they exist
      if (domain.customBounds) {
        Object.entries(domain.customBounds).forEach(([key, value]) => {
          params.push({
            name: formatParameterName(key),
            path: `domain.customBounds.${key}`,
            defaultValue: value,
            type: 'continuous'
          });
        });
      }
    }
    
    // Extract time configuration
    if (simulation.config?.timeConfig) {
      const timeConfig = simulation.config.timeConfig;
      
      // Timestep
      params.push({
        name: 'Timestep',
        path: 'timeConfig.timestep',
        defaultValue: timeConfig.timestep,
        type: 'discrete',
        suggested: true
      });
      
      // Output frequency
      params.push({
        name: 'Output Frequency',
        path: 'timeConfig.outputFrequency',
        defaultValue: timeConfig.outputFrequency,
        type: 'discrete'
      });
      
      // Spinup period
      if (timeConfig.spinupPeriod) {
        params.push({
          name: 'Spinup Period',
          path: 'timeConfig.spinupPeriod',
          defaultValue: timeConfig.spinupPeriod,
          type: 'discrete',
          suggested: true
        });
      }
    }
    
    // Extract compute resources
    if (simulation.config?.computeResources) {
      const resources = simulation.config.computeResources;
      
      // Node count
      params.push({
        name: 'Node Count',
        path: 'computeResources.nodeCount',
        defaultValue: resources.nodeCount,
        type: 'discrete'
      });
      
      // Storage
      params.push({
        name: 'Storage (GB)',
        path: 'computeResources.storage',
        defaultValue: resources.storage,
        type: 'continuous'
      });
    }
    
    // Extract additional options
    if (simulation.config?.additionalOptions) {
      const options = simulation.config.additionalOptions;
      
      // Checkpoint frequency
      if (options.checkpointFrequency) {
        params.push({
          name: 'Checkpoint Frequency',
          path: 'additionalOptions.checkpointFrequency',
          defaultValue: options.checkpointFrequency,
          type: 'discrete'
        });
      }
      
      // Compression level
      params.push({
        name: 'Compression Level',
        path: 'additionalOptions.compressionLevel',
        defaultValue: options.compressionLevel,
        type: 'discrete'
      });
    }
    
    setPotentialParameters(params);
  };
  
  // Helper function to format parameter names
  const formatParameterName = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/^./, (str) => str.toUpperCase()) // Uppercase first letter
      .replace(/([a-z])([A-Z])/g, '$1 $2'); // Add space between words
  };
  
  // Handle adding a parameter
  const handleAddParameter = () => {
    setNewParameter({
      name: '',
      path: '',
      range: [0, 0],
      type: 'continuous',
      samplingPoints: 5
    });
    setIsAddDialogOpen(true);
  };
  
  // Handle selecting a potential parameter
  const handleSelectPotentialParameter = (param: any) => {
    let range: [number, number] | string[];
    
    if (param.type === 'continuous') {
      // For continuous parameters, create a range around the default value
      const defaultValue = parseFloat(param.defaultValue);
      range = [Math.max(0, defaultValue * 0.5), defaultValue * 1.5];
    } else if (param.type === 'discrete') {
      // For discrete parameters, create a range of integers around the default value
      const defaultValue = parseInt(param.defaultValue, 10);
      range = [Math.max(1, defaultValue - 2), defaultValue + 2];
    } else {
      // For categorical parameters, include the default value and add additional options
      if (param.path === 'domain.resolution') {
        range = ['4x5', '2x2.5', '0.5x0.625', '0.25x0.3125'];
      } else if (typeof param.defaultValue === 'boolean') {
        range = [true, false];
      } else {
        range = [param.defaultValue];
      }
    }
    
    setNewParameter({
      name: param.name,
      path: param.path,
      range,
      type: param.type,
      samplingPoints: param.type === 'categorical' ? range.length : 5
    });
  };
  
  // Handle saving a new parameter
  const handleSaveParameter = () => {
    if (newParameter.name && newParameter.path && newParameter.range) {
      onParametersChange([...parameters, newParameter]);
      setIsAddDialogOpen(false);
    }
  };
  
  // Handle editing a parameter
  const handleEditParameter = (index: number) => {
    setEditParameterIndex(index);
    setNewParameter(parameters[index]);
    setIsEditDialogOpen(true);
  };
  
  // Handle saving an edited parameter
  const handleSaveEditedParameter = () => {
    if (editParameterIndex !== null && newParameter.name && newParameter.path && newParameter.range) {
      const updatedParameters = [...parameters];
      updatedParameters[editParameterIndex] = newParameter;
      onParametersChange(updatedParameters);
      setIsEditDialogOpen(false);
      setEditParameterIndex(null);
    }
  };
  
  // Handle deleting a parameter
  const handleDeleteParameter = (index: number) => {
    const updatedParameters = [...parameters];
    updatedParameters.splice(index, 1);
    onParametersChange(updatedParameters);
  };
  
  // Handle parameter input changes
  const handleParameterChange = (field: string, value: any) => {
    setNewParameter({
      ...newParameter,
      [field]: value
    });
  };
  
  // Handle range change for continuous and discrete parameters
  const handleRangeChange = (index: number, value: number) => {
    if (newParameter.type === 'continuous' || newParameter.type === 'discrete') {
      const range = [...(newParameter.range as [number, number])];
      range[index] = value;
      setNewParameter({
        ...newParameter,
        range
      });
    }
  };
  
  // Handle categorical range change
  const handleCategoricalRangeChange = (index: number, value: string) => {
    if (newParameter.type === 'categorical') {
      const range = [...(newParameter.range as string[])];
      range[index] = value;
      setNewParameter({
        ...newParameter,
        range
      });
    }
  };
  
  // Handle adding a new value to categorical range
  const handleAddCategoricalValue = () => {
    if (newParameter.type === 'categorical') {
      setNewParameter({
        ...newParameter,
        range: [...(newParameter.range as string[]), '']
      });
    }
  };
  
  // Handle removing a value from categorical range
  const handleRemoveCategoricalValue = (index: number) => {
    if (newParameter.type === 'categorical') {
      const range = [...(newParameter.range as string[])];
      range.splice(index, 1);
      setNewParameter({
        ...newParameter,
        range
      });
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Parameter Selection
      </Typography>
      <Typography variant="body1" paragraph>
        Select the parameters to vary in your study and define their ranges and sampling options.
      </Typography>
      
      {/* Parameter list */}
      {parameters.length > 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Parameter</TableCell>
                <TableCell>Path</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Range / Values</TableCell>
                <TableCell>Sampling</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parameters.map((param, index) => (
                <TableRow key={index}>
                  <TableCell>{param.name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {param.path}
                    </Typography>
                  </TableCell>
                  <TableCell>{param.type}</TableCell>
                  <TableCell>
                    {param.type === 'categorical' ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(param.range as string[]).map((value, i) => (
                          <Chip key={i} label={value.toString()} size="small" />
                        ))}
                      </Box>
                    ) : (
                      <Typography>
                        {(param.range as [number, number])[0]} to {(param.range as [number, number])[1]}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {param.type !== 'categorical' && (
                      <Typography variant="body2">
                        {param.samplingPoints} points
                        {param.distribution && ` (${param.distribution})`}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex' }}>
                      <Tooltip title="Edit parameter">
                        <IconButton size="small" onClick={() => handleEditParameter(index)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete parameter">
                        <IconButton size="small" onClick={() => handleDeleteParameter(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          No parameters added yet. Add parameters to define what will be varied in your study.
        </Alert>
      )}
      
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        onClick={handleAddParameter}
        sx={{ mb: 3 }}
      >
        Add Parameter
      </Button>
      
      {/* Sampling strategy guidance based on study type */}
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Sampling Strategy Guidance
        </Typography>
        
        {studyType === 'sensitivity' && (
          <Typography variant="body2">
            For sensitivity analysis, it's recommended to:
            <ul>
              <li>Include parameters you suspect have significant impacts on the model outputs</li>
              <li>Use at least 5-10 sampling points for continuous parameters to capture non-linear effects</li>
              <li>Consider using Latin Hypercube sampling for better space coverage with fewer samples</li>
            </ul>
          </Typography>
        )}
        
        {studyType === 'optimization' && (
          <Typography variant="body2">
            For parameter optimization, it's recommended to:
            <ul>
              <li>Focus on parameters that you can reasonably control in real-world applications</li>
              <li>Define realistic constraints on parameter ranges</li>
              <li>Start with broader ranges and refine in subsequent studies</li>
              <li>Use more sampling points for higher optimization accuracy</li>
            </ul>
          </Typography>
        )}
        
        {studyType === 'exploration' && (
          <Typography variant="body2">
            For parameter space exploration, it's recommended to:
            <ul>
              <li>Include a diverse set of parameters</li>
              <li>Use wider ranges to capture edge cases and emergent behaviors</li>
              <li>Balance the number of parameters with sampling density</li>
              <li>Consider Sobol sequences for high-dimensional parameter spaces</li>
            </ul>
          </Typography>
        )}
      </Paper>
      
      {/* Add Parameter Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Parameter</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Select from Model Parameters
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choose from parameters available in the base simulation:
            </Typography>
            
            <Grid container spacing={2}>
              {potentialParameters.map((param, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: param.suggested ? '1px dashed primary.main' : undefined,
                      borderColor: newParameter.path === param.path ? 'primary.main' : 'divider',
                      '&:hover': {
                        borderColor: 'primary.main',
                      },
                    }}
                    onClick={() => handleSelectPotentialParameter(param)}
                  >
                    <Typography variant="subtitle2">{param.name}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      {param.path}
                    </Typography>
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">
                        Default: {param.defaultValue?.toString()}
                      </Typography>
                      <Chip
                        label={param.type}
                        size="small"
                        color={param.suggested ? 'primary' : 'default'}
                        variant={param.suggested ? 'filled' : 'outlined'}
                      />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Parameter Configuration
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Parameter Name"
                  value={newParameter.name}
                  onChange={(e) => handleParameterChange('name', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Parameter Path"
                  value={newParameter.path}
                  onChange={(e) => handleParameterChange('path', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Parameter Type</InputLabel>
                  <Select
                    value={newParameter.type}
                    onChange={(e) => handleParameterChange('type', e.target.value)}
                    label="Parameter Type"
                  >
                    <MenuItem value="continuous">Continuous (Float)</MenuItem>
                    <MenuItem value="discrete">Discrete (Integer)</MenuItem>
                    <MenuItem value="categorical">Categorical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                {(newParameter.type === 'continuous' || newParameter.type === 'discrete') && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Distribution</InputLabel>
                    <Select
                      value={newParameter.distribution || 'uniform'}
                      onChange={(e) => handleParameterChange('distribution', e.target.value)}
                      label="Distribution"
                    >
                      <MenuItem value="uniform">Uniform</MenuItem>
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="log-normal">Log-Normal</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Grid>
            </Grid>
            
            {/* Range settings for continuous/discrete parameters */}
            {(newParameter.type === 'continuous' || newParameter.type === 'discrete') && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Parameter Range
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Minimum Value"
                      value={(newParameter.range as [number, number])[0]}
                      onChange={(e) => handleRangeChange(0, parseFloat(e.target.value))}
                      InputProps={{ inputProps: { step: newParameter.type === 'discrete' ? 1 : 0.1 } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Maximum Value"
                      value={(newParameter.range as [number, number])[1]}
                      onChange={(e) => handleRangeChange(1, parseFloat(e.target.value))}
                      InputProps={{ inputProps: { step: newParameter.type === 'discrete' ? 1 : 0.1 } }}
                    />
                  </Grid>
                </Grid>
                
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                  Sampling Points: {newParameter.samplingPoints}
                </Typography>
                <Slider
                  value={newParameter.samplingPoints}
                  onChange={(e, value) => handleParameterChange('samplingPoints', value)}
                  min={2}
                  max={20}
                  step={1}
                  marks={[
                    { value: 2, label: '2' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' }
                  ]}
                  valueLabelDisplay="auto"
                />
                
                {newParameter.distribution === 'normal' && (
                  <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Normal Distribution Parameters
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Mean"
                          value={newParameter.mean || ((newParameter.range as [number, number])[0] + (newParameter.range as [number, number])[1]) / 2}
                          onChange={(e) => handleParameterChange('mean', parseFloat(e.target.value))}
                          InputProps={{ inputProps: { step: 0.1 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Standard Deviation"
                          value={newParameter.stdDev || (((newParameter.range as [number, number])[1] - (newParameter.range as [number, number])[0]) / 4)}
                          onChange={(e) => handleParameterChange('stdDev', parseFloat(e.target.value))}
                          InputProps={{ inputProps: { step: 0.1, min: 0 } }}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                )}
              </Box>
            )}
            
            {/* Value settings for categorical parameters */}
            {newParameter.type === 'categorical' && (
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">
                    Categorical Values
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddCategoricalValue}
                  >
                    Add Value
                  </Button>
                </Box>
                
                {(newParameter.range as string[]).map((value, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TextField
                      fullWidth
                      required
                      label={`Value ${index + 1}`}
                      value={value}
                      onChange={(e) => handleCategoricalRangeChange(index, e.target.value)}
                      sx={{ mr: 1 }}
                    />
                    <IconButton
                      onClick={() => handleRemoveCategoricalValue(index)}
                      disabled={(newParameter.range as string[]).length <= 1}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
            
            {/* Advanced options accordion for all parameter types */}
            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Advanced Options</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth
                  type="number"
                  label="Importance (0-100)"
                  value={newParameter.importance || 50}
                  onChange={(e) => handleParameterChange('importance', parseInt(e.target.value, 10))}
                  helperText="Higher importance parameters may be sampled more densely in adaptive methods"
                  InputProps={{ inputProps: { min: 0, max: 100 } }}
                  sx={{ mb: 2 }}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveParameter} 
            variant="contained"
            disabled={!newParameter.name || !newParameter.path}
          >
            Add Parameter
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Parameter Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Parameter</DialogTitle>
        <DialogContent dividers>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Parameter Configuration
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Parameter Name"
                  value={newParameter.name}
                  onChange={(e) => handleParameterChange('name', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  required
                  label="Parameter Path"
                  value={newParameter.path}
                  onChange={(e) => handleParameterChange('path', e.target.value)}
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Parameter Type</InputLabel>
                  <Select
                    value={newParameter.type}
                    onChange={(e) => handleParameterChange('type', e.target.value)}
                    label="Parameter Type"
                  >
                    <MenuItem value="continuous">Continuous (Float)</MenuItem>
                    <MenuItem value="discrete">Discrete (Integer)</MenuItem>
                    <MenuItem value="categorical">Categorical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                {(newParameter.type === 'continuous' || newParameter.type === 'discrete') && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Distribution</InputLabel>
                    <Select
                      value={newParameter.distribution || 'uniform'}
                      onChange={(e) => handleParameterChange('distribution', e.target.value)}
                      label="Distribution"
                    >
                      <MenuItem value="uniform">Uniform</MenuItem>
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="log-normal">Log-Normal</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </Grid>
            </Grid>
            
            {/* Range settings for continuous/discrete parameters */}
            {(newParameter.type === 'continuous' || newParameter.type === 'discrete') && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Parameter Range
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Minimum Value"
                      value={(newParameter.range as [number, number])[0]}
                      onChange={(e) => handleRangeChange(0, parseFloat(e.target.value))}
                      InputProps={{ inputProps: { step: newParameter.type === 'discrete' ? 1 : 0.1 } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      required
                      type="number"
                      label="Maximum Value"
                      value={(newParameter.range as [number, number])[1]}
                      onChange={(e) => handleRangeChange(1, parseFloat(e.target.value))}
                      InputProps={{ inputProps: { step: newParameter.type === 'discrete' ? 1 : 0.1 } }}
                    />
                  </Grid>
                </Grid>
                
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                  Sampling Points: {newParameter.samplingPoints}
                </Typography>
                <Slider
                  value={newParameter.samplingPoints}
                  onChange={(e, value) => handleParameterChange('samplingPoints', value)}
                  min={2}
                  max={20}
                  step={1}
                  marks={[
                    { value: 2, label: '2' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                    { value: 20, label: '20' }
                  ]}
                  valueLabelDisplay="auto"
                />
                
                {newParameter.distribution === 'normal' && (
                  <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Normal Distribution Parameters
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Mean"
                          value={newParameter.mean || ((newParameter.range as [number, number])[0] + (newParameter.range as [number, number])[1]) / 2}
                          onChange={(e) => handleParameterChange('mean', parseFloat(e.target.value))}
                          InputProps={{ inputProps: { step: 0.1 } }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Standard Deviation"
                          value={newParameter.stdDev || (((newParameter.range as [number, number])[1] - (newParameter.range as [number, number])[0]) / 4)}
                          onChange={(e) => handleParameterChange('stdDev', parseFloat(e.target.value))}
                          InputProps={{ inputProps: { step: 0.1, min: 0 } }}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                )}
              </Box>
            )}
            
            {/* Value settings for categorical parameters */}
            {newParameter.type === 'categorical' && (
              <Box sx={{ mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2">
                    Categorical Values
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddCategoricalValue}
                  >
                    Add Value
                  </Button>
                </Box>
                
                {(newParameter.range as string[]).map((value, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TextField
                      fullWidth
                      required
                      label={`Value ${index + 1}`}
                      value={value}
                      onChange={(e) => handleCategoricalRangeChange(index, e.target.value)}
                      sx={{ mr: 1 }}
                    />
                    <IconButton
                      onClick={() => handleRemoveCategoricalValue(index)}
                      disabled={(newParameter.range as string[]).length <= 1}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
            
            {/* Advanced options accordion for all parameter types */}
            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Advanced Options</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth
                  type="number"
                  label="Importance (0-100)"
                  value={newParameter.importance || 50}
                  onChange={(e) => handleParameterChange('importance', parseInt(e.target.value, 10))}
                  helperText="Higher importance parameters may be sampled more densely in adaptive methods"
                  InputProps={{ inputProps: { min: 0, max: 100 } }}
                  sx={{ mb: 2 }}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSaveEditedParameter} 
            variant="contained"
            disabled={!newParameter.name || !newParameter.path}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParameterSelectionStep;