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
  MenuItem,
  InputAdornment,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Help as HelpIcon,
  AddCircle as AddCircleIcon,
  DragIndicator as DragIndicatorIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { SimulationConfig } from '../../../types/simulation';

// Define parameter types
type ParameterType = 'numeric' | 'categorical' | 'spatial' | 'temporal';

interface Parameter {
  name: string;
  description?: string;
  type: ParameterType;
  values: any[];
  unit?: string;
  path: string; // Path to the parameter in the simulation config object
}

interface BatchParametersStepProps {
  parameters: any[];
  onParametersChange: (parameters: any[]) => void;
  templateId: string | null;
}

const BatchParametersStep: React.FC<BatchParametersStepProps> = ({
  parameters,
  onParametersChange,
  templateId
}) => {
  const [selectedParameter, setSelectedParameter] = useState<Parameter | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [paramToEdit, setParamToEdit] = useState<number | null>(null);
  
  // Get template or simulation from store
  const templates = useSelector((state: RootState) => state.batch.templates);
  const simulations = useSelector((state: RootState) => state.simulations.simulations);
  
  const selectedTemplate = templateId 
    ? templates.find(t => t.id === templateId) || simulations.find(s => s.id === templateId)
    : null;
  
  // Generate suggested parameters based on template
  const [suggestedParameters, setSuggestedParameters] = useState<Parameter[]>([]);
  
  useEffect(() => {
    if (selectedTemplate) {
      generateSuggestedParameters(selectedTemplate.config);
    }
  }, [selectedTemplate]);
  
  const generateSuggestedParameters = (config: SimulationConfig) => {
    const suggestions: Parameter[] = [];
    
    // Add simulation type parameter
    suggestions.push({
      name: 'Simulation Type',
      description: 'Type of GEOS-Chem simulation to run',
      type: 'categorical',
      values: ['fullchem', 'transport', 'aerosol', 'custom'],
      path: 'simulationType'
    });
    
    // Add domain parameters
    suggestions.push({
      name: 'Resolution',
      description: 'Horizontal resolution of the simulation',
      type: 'categorical',
      values: ['4x5', '2x2.5', '0.5x0.625', '0.25x0.3125'],
      path: 'domain.resolution'
    });
    
    suggestions.push({
      name: 'Vertical Levels',
      description: 'Number of vertical levels in the atmosphere',
      type: 'numeric',
      values: [30, 47, 72],
      path: 'domain.verticalLevels'
    });
    
    // Add time parameters
    suggestions.push({
      name: 'Start Date',
      description: 'Simulation start date',
      type: 'temporal',
      values: [
        config.timeConfig.startDate,
        '2019-01-01',
        '2020-01-01',
        '2021-01-01'
      ],
      path: 'timeConfig.startDate'
    });
    
    // Add compute parameters
    suggestions.push({
      name: 'Instance Type',
      description: 'EC2 instance type for computation',
      type: 'categorical',
      values: [
        'c5.large',
        'c5.xlarge',
        'c5.2xlarge',
        'c5.4xlarge'
      ],
      path: 'computeResources.instanceType'
    });
    
    // Add scientific parameters
    if (config.scientificOptions) {
      // Chemistry options
      if (config.scientificOptions.chemistry) {
        suggestions.push({
          name: 'Chemistry Enabled',
          description: 'Whether chemistry is enabled in the simulation',
          type: 'categorical',
          values: [true, false],
          path: 'scientificOptions.chemistry'
        });
      }
      
      // Aerosol options
      if (config.scientificOptions.aerosols) {
        suggestions.push({
          name: 'Aerosols Enabled',
          description: 'Whether aerosols are enabled in the simulation',
          type: 'categorical',
          values: [true, false],
          path: 'scientificOptions.aerosols'
        });
      }
    }
    
    setSuggestedParameters(suggestions);
  };
  
  const handleAddParameter = () => {
    setIsAddDialogOpen(true);
  };
  
  const handleCloseAddDialog = () => {
    setIsAddDialogOpen(false);
    setSelectedParameter(null);
  };
  
  const handleEditParameter = (index: number) => {
    setParamToEdit(index);
    setIsEditDialogOpen(true);
  };
  
  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setParamToEdit(null);
  };
  
  const handleDeleteParameter = (index: number) => {
    const updatedParameters = [...parameters];
    updatedParameters.splice(index, 1);
    onParametersChange(updatedParameters);
  };
  
  const handleSuggestedParameterSelect = (param: Parameter) => {
    setSelectedParameter(param);
  };
  
  const handleConfirmAddParameter = () => {
    if (selectedParameter) {
      // Create a new parameter entry
      const newParam = {
        name: selectedParameter.name,
        values: selectedParameter.values,
        description: selectedParameter.description,
        path: selectedParameter.path,
        type: selectedParameter.type,
        unit: selectedParameter.unit
      };
      
      onParametersChange([...parameters, newParam]);
      handleCloseAddDialog();
    }
  };
  
  const handleSaveEditedParameter = (updatedParam: any, index: number) => {
    const updatedParameters = [...parameters];
    updatedParameters[index] = updatedParam;
    onParametersChange(updatedParameters);
    handleCloseEditDialog();
  };
  
  // Calculate total number of simulations
  const totalSimulations = parameters.length > 0
    ? parameters.reduce((total, param) => total * param.values.length, 1)
    : 0;
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure Parameters
      </Typography>
      <Typography variant="body1" paragraph>
        Define the parameters to vary across your batch of simulations. Each parameter can take multiple values, and all combinations will be generated.
      </Typography>
      
      {!selectedTemplate && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please select a template first to configure parameters.
        </Alert>
      )}
      
      {parameters.length > 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width="30%">Parameter</TableCell>
                <TableCell width="40%">Values</TableCell>
                <TableCell width="20%">Info</TableCell>
                <TableCell width="10%" align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parameters.map((param, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Typography variant="subtitle2">{param.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {param.path}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {param.values.map((value: any, i: number) => (
                        <Chip 
                          key={i} 
                          label={value.toString()} 
                          size="small" 
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {param.description && (
                      <Typography variant="body2" color="text.secondary">
                        {param.description}
                      </Typography>
                    )}
                    {param.unit && (
                      <Typography variant="body2" color="text.secondary">
                        Unit: {param.unit}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          No parameters added yet. Add parameters to create combinations for your batch simulations.
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddParameter}
          disabled={!selectedTemplate}
        >
          Add Parameter
        </Button>
        
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Total simulations to be created: <strong>{totalSimulations}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            (based on all parameter combinations)
          </Typography>
        </Box>
      </Box>
      
      {/* Add Parameter Dialog */}
      <Dialog 
        open={isAddDialogOpen} 
        onClose={handleCloseAddDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Parameter</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
            Select a parameter to vary in your batch simulations:
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {suggestedParameters.map((param, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: selectedParameter?.name === param.name ? 2 : 1,
                    borderColor: selectedParameter?.name === param.name ? 'primary.main' : 'divider',
                    '&:hover': {
                      borderColor: 'primary.main',
                    },
                  }}
                  onClick={() => handleSuggestedParameterSelect(param)}
                >
                  <Typography variant="subtitle2">{param.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {param.description}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" display="block">
                      Sample values:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {param.values.slice(0, 3).map((value, i) => (
                        <Chip 
                          key={i} 
                          label={value.toString()} 
                          size="small" 
                          variant="outlined"
                        />
                      ))}
                      {param.values.length > 3 && (
                        <Chip 
                          label={`+${param.values.length - 3} more`} 
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="subtitle2" gutterBottom>
            Or create a custom parameter:
          </Typography>
          
          <Button
            variant="outlined"
            startIcon={<CodeIcon />}
            sx={{ mt: 1 }}
            onClick={() => {
              // Create a custom parameter template
              setSelectedParameter({
                name: 'Custom Parameter',
                description: 'User-defined parameter',
                type: 'numeric',
                values: [0, 1, 2],
                path: 'custom.path'
              });
            }}
          >
            Create Custom Parameter
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button 
            onClick={handleConfirmAddParameter} 
            variant="contained"
            disabled={!selectedParameter}
          >
            Add Parameter
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Edit Parameter Dialog */}
      {paramToEdit !== null && isEditDialogOpen && (
        <ParameterEditDialog
          parameter={parameters[paramToEdit]}
          onSave={(updatedParam) => handleSaveEditedParameter(updatedParam, paramToEdit)}
          onCancel={handleCloseEditDialog}
        />
      )}
    </Box>
  );
};

// Parameter Edit Dialog Component
interface ParameterEditDialogProps {
  parameter: any;
  onSave: (parameter: any) => void;
  onCancel: () => void;
}

const ParameterEditDialog: React.FC<ParameterEditDialogProps> = ({
  parameter,
  onSave,
  onCancel
}) => {
  const [editedParam, setEditedParam] = useState({ ...parameter });
  const [newValue, setNewValue] = useState('');
  const [valueType, setValueType] = useState<'string' | 'number' | 'boolean'>('string');
  
  const handleValueTypeChange = (event: SelectChangeEvent<string>) => {
    setValueType(event.target.value as 'string' | 'number' | 'boolean');
  };
  
  const handleAddValue = () => {
    if (newValue.trim() === '') return;
    
    let parsedValue;
    switch (valueType) {
      case 'number':
        parsedValue = parseFloat(newValue);
        break;
      case 'boolean':
        parsedValue = newValue.toLowerCase() === 'true';
        break;
      default:
        parsedValue = newValue;
    }
    
    setEditedParam({
      ...editedParam,
      values: [...editedParam.values, parsedValue]
    });
    setNewValue('');
  };
  
  const handleRemoveValue = (index: number) => {
    const updatedValues = [...editedParam.values];
    updatedValues.splice(index, 1);
    setEditedParam({
      ...editedParam,
      values: updatedValues
    });
  };
  
  const handleChange = (field: string, value: any) => {
    setEditedParam({
      ...editedParam,
      [field]: value
    });
  };
  
  return (
    <Dialog open={true} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Edit Parameter</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Parameter Name"
              fullWidth
              value={editedParam.name}
              onChange={(e) => handleChange('name', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Parameter Path"
              fullWidth
              value={editedParam.path}
              onChange={(e) => handleChange('path', e.target.value)}
              margin="normal"
              helperText="Path to the parameter in the configuration object"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              fullWidth
              value={editedParam.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              margin="normal"
              multiline
              rows={2}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="param-type-label">Parameter Type</InputLabel>
              <Select
                labelId="param-type-label"
                value={editedParam.type || 'numeric'}
                label="Parameter Type"
                onChange={(e) => handleChange('type', e.target.value)}
              >
                <MenuItem value="numeric">Numeric</MenuItem>
                <MenuItem value="categorical">Categorical</MenuItem>
                <MenuItem value="spatial">Spatial</MenuItem>
                <MenuItem value="temporal">Temporal</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Unit (optional)"
              fullWidth
              value={editedParam.unit || ''}
              onChange={(e) => handleChange('unit', e.target.value)}
              margin="normal"
            />
          </Grid>
        </Grid>
        
        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
          Parameter Values
        </Typography>
        
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {editedParam.values.length > 0 ? (
              editedParam.values.map((value: any, index: number) => (
                <Chip
                  key={index}
                  label={value.toString()}
                  onDelete={() => handleRemoveValue(index)}
                  variant="outlined"
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No values added yet. Add at least one value below.
              </Typography>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <FormControl sx={{ width: 120 }}>
              <InputLabel id="value-type-label">Value Type</InputLabel>
              <Select
                labelId="value-type-label"
                value={valueType}
                label="Value Type"
                onChange={handleValueTypeChange}
                size="small"
              >
                <MenuItem value="string">Text</MenuItem>
                <MenuItem value="number">Number</MenuItem>
                <MenuItem value="boolean">Boolean</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="New Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={handleAddValue}
                      disabled={newValue.trim() === ''}
                    >
                      <AddCircleIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSave(editedParam)}
          variant="contained"
          disabled={editedParam.name.trim() === '' || editedParam.values.length === 0}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchParametersStep;