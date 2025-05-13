import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  Switch,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Assessment as AssessmentIcon,
  Code as CodeIcon,
  Tune as TuneIcon,
  BarChart as BarChartIcon,
  ScatterPlot as ScatterPlotIcon,
  Timeline as TimelineIcon,
  BubbleChart as BubbleChartIcon,
  Map as MapIcon
} from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material';

interface OutputAnalysisStepProps {
  outputConfig: {
    outputVariables: string[];
    analysisMetrics: string[];
    visualizationTypes: string[];
    postProcessingScripts: string[];
  };
  onOutputConfigChange: (config: any) => void;
  baseSimulationId: string;
  parameters: any[];
}

// Available output variables for GEOS-Chem
const availableOutputVariables = [
  { name: 'O3', description: 'Ozone concentration', group: 'gases', unit: 'ppbv' },
  { name: 'CO', description: 'Carbon monoxide', group: 'gases', unit: 'ppbv' },
  { name: 'NO2', description: 'Nitrogen dioxide', group: 'gases', unit: 'ppbv' },
  { name: 'SO2', description: 'Sulfur dioxide', group: 'gases', unit: 'ppbv' },
  { name: 'PM25', description: 'Particulate matter (2.5μm)', group: 'aerosols', unit: 'μg/m³' },
  { name: 'BC', description: 'Black carbon', group: 'aerosols', unit: 'μg/m³' },
  { name: 'OC', description: 'Organic carbon', group: 'aerosols', unit: 'μg/m³' },
  { name: 'SO4', description: 'Sulfate', group: 'aerosols', unit: 'μg/m³' },
  { name: 'NH4', description: 'Ammonium', group: 'aerosols', unit: 'μg/m³' },
  { name: 'NO3', description: 'Nitrate', group: 'aerosols', unit: 'μg/m³' },
  { name: 'DUST', description: 'Dust', group: 'aerosols', unit: 'μg/m³' },
  { name: 'TEMP', description: 'Temperature', group: 'meteorology', unit: 'K' },
  { name: 'RH', description: 'Relative humidity', group: 'meteorology', unit: '%' },
  { name: 'PRES', description: 'Pressure', group: 'meteorology', unit: 'hPa' },
  { name: 'U', description: 'Zonal wind', group: 'meteorology', unit: 'm/s' },
  { name: 'V', description: 'Meridional wind', group: 'meteorology', unit: 'm/s' },
  { name: 'PRCP', description: 'Precipitation', group: 'meteorology', unit: 'mm/day' },
  { name: 'OH', description: 'Hydroxyl radical', group: 'chemistry', unit: 'molecules/cm³' },
  { name: 'HO2', description: 'Hydroperoxyl radical', group: 'chemistry', unit: 'molecules/cm³' },
  { name: 'O3_BURDEN', description: 'Ozone burden', group: 'diagnostics', unit: 'Tg' },
  { name: 'AOD', description: 'Aerosol optical depth', group: 'diagnostics', unit: 'dimensionless' },
  { name: 'SW_TOA', description: 'Shortwave radiation (TOA)', group: 'diagnostics', unit: 'W/m²' },
  { name: 'LW_TOA', description: 'Longwave radiation (TOA)', group: 'diagnostics', unit: 'W/m²' },
  { name: 'DRY_DEP', description: 'Dry deposition', group: 'diagnostics', unit: 'kg/m²/s' },
  { name: 'WET_DEP', description: 'Wet deposition', group: 'diagnostics', unit: 'kg/m²/s' }
];

// Available analysis metrics
const availableMetrics = [
  { id: 'sensitivity', name: 'Sensitivity Coefficients', description: 'Measures how much output variables change with respect to input parameters' },
  { id: 'elasticity', name: 'Elasticity', description: 'Percentage change in output for a percentage change in input' },
  { id: 'pcc', name: 'Partial Correlation Coefficients', description: 'Linear correlation between inputs and outputs, removing effects of other parameters' },
  { id: 'srcc', name: 'Spearman Rank Correlation', description: 'Non-parametric measure of rank correlation' },
  { id: 'variance', name: 'Variance Decomposition', description: 'Estimates how much each parameter contributes to output variance' },
  { id: 'sobol', name: 'Sobol Indices', description: 'Global sensitivity measure based on variance decomposition' },
  { id: 'morris', name: 'Morris Method', description: 'Screening method to identify important factors' },
  { id: 'rsq', name: 'R-squared', description: 'Coefficient of determination for regression models' },
  { id: 'rmse', name: 'RMSE', description: 'Root mean square error between predictions and observations' },
  { id: 'mean', name: 'Mean', description: 'Average value across simulations' },
  { id: 'std', name: 'Standard Deviation', description: 'Measure of variability across simulations' },
  { id: 'min', name: 'Minimum', description: 'Minimum value across simulations' },
  { id: 'max', name: 'Maximum', description: 'Maximum value across simulations' },
  { id: 'q25', name: '25th Percentile', description: 'First quartile value' },
  { id: 'median', name: 'Median', description: '50th percentile value' },
  { id: 'q75', name: '75th Percentile', description: 'Third quartile value' }
];

// Available visualization types
const availableVisualizations = [
  { id: 'sensitivity_heatmap', name: 'Sensitivity Heatmap', description: 'Colored grid showing sensitivity of outputs to inputs', icon: <BubbleChartIcon /> },
  { id: 'parameter_sweep', name: 'Parameter Sweep Plot', description: 'Line plots showing how outputs vary with each parameter', icon: <TimelineIcon /> },
  { id: 'scatter_matrix', name: 'Scatter Plot Matrix', description: 'Grid of scatter plots for all parameter-output combinations', icon: <ScatterPlotIcon /> },
  { id: 'box_plots', name: 'Box Plots', description: 'Show statistical distribution of outputs for each parameter setting', icon: <BarChartIcon /> },
  { id: 'parallel_coordinates', name: 'Parallel Coordinates', description: 'Visualize multi-dimensional data showing parameter-output relationships', icon: <TimelineIcon /> },
  { id: 'surface_response', name: '3D Response Surface', description: 'Surface plot showing output as function of two parameters', icon: <MapIcon /> },
  { id: 'tornado_plot', name: 'Tornado Plot', description: 'Bar chart showing relative impact of each parameter', icon: <BarChartIcon /> },
  { id: 'correlation_matrix', name: 'Correlation Matrix', description: 'Heatmap of correlation coefficients', icon: <BubbleChartIcon /> },
  { id: 'time_series', name: 'Time Series Comparison', description: 'Line plots of output time series for different parameter settings', icon: <TimelineIcon /> },
  { id: 'spatial_map', name: 'Spatial Maps', description: 'Geographic maps showing spatial variation for different parameter settings', icon: <MapIcon /> }
];

// Example post-processing scripts
const exampleScripts = [
  { id: 'sensitivity_analysis', name: 'Sensitivity Analysis', description: 'Calculates sensitivity indices using SALib Python package', language: 'python' },
  { id: 'statistical_summary', name: 'Statistical Summary', description: 'Generates statistical summaries of all output variables', language: 'python' },
  { id: 'visualization_notebook', name: 'Visualization Notebook', description: 'Jupyter notebook with interactive visualizations', language: 'jupyter' },
  { id: 'data_extraction', name: 'Data Extraction Script', description: 'Extracts key variables from output NetCDF files', language: 'python' },
  { id: 'spatial_aggregation', name: 'Spatial Aggregation', description: 'Aggregates outputs to different spatial scales (regional, global)', language: 'python' },
  { id: 'time_aggregation', name: 'Temporal Aggregation', description: 'Aggregates outputs to different temporal scales (daily, monthly)', language: 'python' }
];

const OutputAnalysisStep: React.FC<OutputAnalysisStepProps> = ({
  outputConfig,
  onOutputConfigChange,
  baseSimulationId,
  parameters
}) => {
  const [showVariableDialog, setShowVariableDialog] = useState(false);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [newScript, setNewScript] = useState<string>('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  
  // Filter available variables by group
  const filteredVariables = filterGroup === 'all'
    ? availableOutputVariables
    : availableOutputVariables.filter(v => v.group === filterGroup);
  
  // Handle adding output variables
  const handleAddVariable = (variable: string) => {
    if (!outputConfig.outputVariables.includes(variable)) {
      onOutputConfigChange({
        ...outputConfig,
        outputVariables: [...outputConfig.outputVariables, variable]
      });
    }
  };
  
  // Handle removing output variables
  const handleRemoveVariable = (variable: string) => {
    onOutputConfigChange({
      ...outputConfig,
      outputVariables: outputConfig.outputVariables.filter(v => v !== variable)
    });
  };
  
  // Handle adding analysis metrics
  const handleAddMetric = (metric: string) => {
    if (!outputConfig.analysisMetrics.includes(metric)) {
      onOutputConfigChange({
        ...outputConfig,
        analysisMetrics: [...outputConfig.analysisMetrics, metric]
      });
    }
  };
  
  // Handle removing analysis metrics
  const handleRemoveMetric = (metric: string) => {
    onOutputConfigChange({
      ...outputConfig,
      analysisMetrics: outputConfig.analysisMetrics.filter(m => m !== metric)
    });
  };
  
  // Handle adding visualization types
  const handleAddVisualization = (visualization: string) => {
    if (!outputConfig.visualizationTypes.includes(visualization)) {
      onOutputConfigChange({
        ...outputConfig,
        visualizationTypes: [...outputConfig.visualizationTypes, visualization]
      });
    }
  };
  
  // Handle removing visualization types
  const handleRemoveVisualization = (visualization: string) => {
    onOutputConfigChange({
      ...outputConfig,
      visualizationTypes: outputConfig.visualizationTypes.filter(v => v !== visualization)
    });
  };
  
  // Handle adding post-processing scripts
  const handleAddScript = (script: string) => {
    if (!outputConfig.postProcessingScripts.includes(script)) {
      onOutputConfigChange({
        ...outputConfig,
        postProcessingScripts: [...outputConfig.postProcessingScripts, script]
      });
    }
    setShowScriptDialog(false);
  };
  
  // Handle removing post-processing scripts
  const handleRemoveScript = (script: string) => {
    onOutputConfigChange({
      ...outputConfig,
      postProcessingScripts: outputConfig.postProcessingScripts.filter(s => s !== script)
    });
  };
  
  // Calculate required output variables based on selected metrics
  const getRequiredVariables = () => {
    const required: string[] = [];
    
    if (outputConfig.analysisMetrics.includes('sensitivity') || 
        outputConfig.analysisMetrics.includes('sobol') ||
        outputConfig.analysisMetrics.includes('morris')) {
      // These metrics typically require all output variables of interest
      if (required.length === 0 && availableOutputVariables.length > 0) {
        // Suggest some common variables if none selected
        required.push('O3', 'PM25', 'AOD');
      }
    }
    
    return required;
  };
  
  const requiredVariables = getRequiredVariables();
  
  // Add recommended output variables based on parameters
  useEffect(() => {
    const recommendedVariables: string[] = [];
    
    // If parameters contain chemical species, recommend related outputs
    parameters.forEach(param => {
      if (param.path.includes('chemistry') && !recommendedVariables.includes('O3')) {
        recommendedVariables.push('O3', 'OH', 'HO2');
      }
      if (param.path.includes('aerosols') && !recommendedVariables.includes('PM25')) {
        recommendedVariables.push('PM25', 'AOD', 'BC', 'OC');
      }
    });
    
    if (recommendedVariables.length > 0 && outputConfig.outputVariables.length === 0) {
      // Only suggest if no variables are selected yet
      onOutputConfigChange({
        ...outputConfig,
        outputVariables: recommendedVariables
      });
    }
  }, [parameters]);
  
  // Add recommended metrics based on study type
  useEffect(() => {
    if (outputConfig.analysisMetrics.length === 0) {
      const recommendedMetrics = ['sensitivity', 'pcc', 'mean', 'std'];
      onOutputConfigChange({
        ...outputConfig,
        analysisMetrics: recommendedMetrics
      });
    }
    
    if (outputConfig.visualizationTypes.length === 0) {
      const recommendedVisualizations = ['sensitivity_heatmap', 'parameter_sweep', 'box_plots'];
      onOutputConfigChange({
        ...outputConfig,
        visualizationTypes: recommendedVisualizations
      });
    }
  }, []);
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Output Analysis Configuration
      </Typography>
      <Typography variant="body1" paragraph>
        Select the output variables, analysis metrics, and visualizations for your parameter study.
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Output Variables
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setShowVariableDialog(true)}
              >
                Add Variables
              </Button>
            </Box>
            
            {outputConfig.outputVariables.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {outputConfig.outputVariables.map((variable) => {
                  const varInfo = availableOutputVariables.find(v => v.name === variable);
                  return (
                    <Chip
                      key={variable}
                      label={`${variable} ${varInfo?.unit ? `(${varInfo.unit})` : ''}`}
                      onDelete={() => handleRemoveVariable(variable)}
                      sx={{ mb: 1 }}
                    />
                  );
                })}
              </Box>
            ) : (
              <Alert severity="info">
                No output variables selected. Please add at least one variable to analyze.
              </Alert>
            )}
            
            {requiredVariables.length > 0 && !requiredVariables.every(v => outputConfig.outputVariables.includes(v)) && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Some selected analysis metrics require specific output variables. Consider adding:
                {requiredVariables.filter(v => !outputConfig.outputVariables.includes(v)).map(v => ` ${v}`)}
              </Alert>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Analysis Metrics
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {availableMetrics.map((metric) => (
                <Chip
                  key={metric.id}
                  label={metric.name}
                  onClick={() => handleAddMetric(metric.id)}
                  onDelete={outputConfig.analysisMetrics.includes(metric.id) ? () => handleRemoveMetric(metric.id) : undefined}
                  color={outputConfig.analysisMetrics.includes(metric.id) ? 'primary' : 'default'}
                  variant={outputConfig.analysisMetrics.includes(metric.id) ? 'filled' : 'outlined'}
                  sx={{ mb: 1 }}
                />
              ))}
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Visualizations
            </Typography>
            
            <Grid container spacing={2}>
              {availableVisualizations.map((vis) => (
                <Grid item xs={12} sm={6} md={4} key={vis.id}>
                  <Card 
                    variant="outlined"
                    sx={{ 
                      cursor: 'pointer',
                      border: outputConfig.visualizationTypes.includes(vis.id) ? 2 : 1,
                      borderColor: outputConfig.visualizationTypes.includes(vis.id) ? 'primary.main' : 'divider',
                      '&:hover': {
                        borderColor: 'primary.main',
                      },
                    }}
                    onClick={() => outputConfig.visualizationTypes.includes(vis.id) 
                      ? handleRemoveVisualization(vis.id) 
                      : handleAddVisualization(vis.id)
                    }
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        {vis.icon}
                        <Typography variant="subtitle1" sx={{ ml: 1 }}>
                          {vis.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {vis.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Accordion defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CodeIcon sx={{ mr: 1 }} />
                <Typography variant="subtitle1">Post-Processing Scripts</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Select post-processing scripts to automatically analyze the results of your parameter study.
              </Typography>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setShowScriptDialog(true)}
                >
                  Add Script
                </Button>
              </Box>
              
              <Grid container spacing={2}>
                {exampleScripts.map((script) => (
                  <Grid item xs={12} sm={6} key={script.id}>
                    <Card 
                      variant="outlined"
                      sx={{ 
                        border: outputConfig.postProcessingScripts.includes(script.id) ? 2 : 1,
                        borderColor: outputConfig.postProcessingScripts.includes(script.id) ? 'primary.main' : 'divider',
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1">
                            {script.name}
                          </Typography>
                          {outputConfig.postProcessingScripts.includes(script.id) ? (
                            <IconButton size="small" onClick={() => handleRemoveScript(script.id)}>
                              <DeleteIcon />
                            </IconButton>
                          ) : (
                            <IconButton size="small" onClick={() => handleAddScript(script.id)}>
                              <AddIcon />
                            </IconButton>
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {script.description}
                        </Typography>
                        <Chip 
                          label={script.language} 
                          size="small" 
                          variant="outlined"
                          sx={{ mt: 1 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
      
      {/* Output Variables Dialog */}
      <Dialog
        open={showVariableDialog}
        onClose={() => setShowVariableDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Select Output Variables</Typography>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Filter by Group</InputLabel>
              <Select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                label="Filter by Group"
              >
                <MenuItem value="all">All Groups</MenuItem>
                <MenuItem value="gases">Gases</MenuItem>
                <MenuItem value="aerosols">Aerosols</MenuItem>
                <MenuItem value="meteorology">Meteorology</MenuItem>
                <MenuItem value="chemistry">Chemistry</MenuItem>
                <MenuItem value="diagnostics">Diagnostics</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={1}>
            {filteredVariables.map((variable) => (
              <Grid item xs={12} sm={6} md={4} key={variable.name}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    cursor: 'pointer',
                    border: outputConfig.outputVariables.includes(variable.name) ? 2 : 1,
                    borderColor: outputConfig.outputVariables.includes(variable.name) ? 'primary.main' : 'divider',
                    '&:hover': {
                      borderColor: 'primary.main',
                    },
                  }}
                  onClick={() => outputConfig.outputVariables.includes(variable.name) 
                    ? handleRemoveVariable(variable.name) 
                    : handleAddVariable(variable.name)
                  }
                >
                  <CardContent>
                    <Typography variant="subtitle1">
                      {variable.name} {variable.unit ? `(${variable.unit})` : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {variable.description}
                    </Typography>
                    <Chip 
                      label={variable.group} 
                      size="small" 
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVariableDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Post-Processing Script Dialog */}
      <Dialog
        open={showScriptDialog}
        onClose={() => setShowScriptDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Post-Processing Script</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            Select one of the example scripts or provide a custom script name.
          </Typography>
          
          <TextField
            fullWidth
            label="Custom Script Name"
            value={newScript}
            onChange={(e) => setNewScript(e.target.value)}
            helperText="Enter a name for your custom script"
            sx={{ mb: 3 }}
          />
          
          <Typography variant="subtitle1" gutterBottom>
            Or select from example scripts:
          </Typography>
          
          <Grid container spacing={2}>
            {exampleScripts.filter(s => !outputConfig.postProcessingScripts.includes(s.id)).map((script) => (
              <Grid item xs={12} sm={6} key={script.id}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'primary.main',
                    },
                  }}
                  onClick={() => handleAddScript(script.id)}
                >
                  <CardContent>
                    <Typography variant="subtitle1">
                      {script.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {script.description}
                    </Typography>
                    <Chip 
                      label={script.language} 
                      size="small" 
                      variant="outlined"
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScriptDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => handleAddScript(newScript)}
            variant="contained"
            disabled={!newScript}
          >
            Add Custom Script
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OutputAnalysisStep;