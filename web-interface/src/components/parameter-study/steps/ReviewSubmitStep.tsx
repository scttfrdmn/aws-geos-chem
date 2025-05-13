import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Science as ScienceIcon,
  Tune as TuneIcon,
  Assessment as AssessmentIcon,
  Code as CodeIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

interface ReviewSubmitStepProps {
  studyConfig: {
    name: string;
    description: string;
    studyType: 'sensitivity' | 'optimization' | 'exploration';
    baseSimulationId: string;
    maxSimulations: number;
    samplingMethod: 'grid' | 'random' | 'latin-hypercube' | 'sobol';
  };
  parameters: Array<{
    name: string;
    path: string;
    range: [number, number] | string[];
    type: 'continuous' | 'discrete' | 'categorical';
    samplingPoints: number;
    distribution?: 'uniform' | 'normal' | 'log-normal';
    mean?: number;
    stdDev?: number;
    importance?: number;
  }>;
  outputConfig: {
    outputVariables: string[];
    analysisMetrics: string[];
    visualizationTypes: string[];
    postProcessingScripts: string[];
  };
}

const ReviewSubmitStep: React.FC<ReviewSubmitStepProps> = ({
  studyConfig,
  parameters,
  outputConfig
}) => {
  const simulations = useSelector((state: RootState) => state.simulations.simulations);
  const baseSimulation = simulations.find(sim => sim.id === studyConfig.baseSimulationId);
  
  // Calculate total number of simulations based on parameters
  const calculateTotalSimulations = () => {
    if (parameters.length === 0) return 0;
    
    if (studyConfig.samplingMethod === 'grid') {
      // For grid sampling, multiply all sampling points
      return parameters.reduce((total, param) => {
        if (param.type === 'continuous' || param.type === 'discrete') {
          return total * param.samplingPoints;
        } else {
          // For categorical, use the number of categories
          return total * (Array.isArray(param.range) ? param.range.length : 1);
        }
      }, 1);
    } else {
      // For other sampling methods, use maxSimulations
      return studyConfig.maxSimulations;
    }
  };
  
  const totalSimulations = calculateTotalSimulations();
  
  // Generate warnings if any
  const generateWarnings = () => {
    const warnings = [];
    
    if (totalSimulations > studyConfig.maxSimulations) {
      warnings.push(`Total simulations (${totalSimulations}) exceeds the maximum limit (${studyConfig.maxSimulations})`);
    }
    
    if (parameters.length === 0) {
      warnings.push('No parameters defined for this study');
    }
    
    if (outputConfig.outputVariables.length === 0) {
      warnings.push('No output variables selected for analysis');
    }
    
    // Warn if many parameters with grid sampling (could lead to combinatorial explosion)
    if (studyConfig.samplingMethod === 'grid' && parameters.length > 3) {
      warnings.push('Grid sampling with many parameters may lead to a large number of simulations. Consider using Latin Hypercube or Sobol sampling instead.');
    }
    
    return warnings;
  };
  
  const warnings = generateWarnings();
  
  // Get study type description
  const getStudyTypeDescription = () => {
    switch (studyConfig.studyType) {
      case 'sensitivity':
        return 'Sensitivity analysis to identify which parameters have the largest impact on outputs';
      case 'optimization':
        return 'Parameter optimization to find values that optimize specific model outputs';
      case 'exploration':
        return 'Exploration of parameter space to understand model behavior across different settings';
      default:
        return '';
    }
  };
  
  // Get sampling method description
  const getSamplingMethodDescription = () => {
    switch (studyConfig.samplingMethod) {
      case 'grid':
        return 'Systematically sample at regular intervals across parameter ranges';
      case 'random':
        return 'Randomly sample parameter values within their ranges';
      case 'latin-hypercube':
        return 'Advanced sampling that ensures even coverage of parameter space';
      case 'sobol':
        return 'Quasi-random sequence that provides excellent space-filling properties';
      default:
        return '';
    }
  };
  
  // Format parameter range for display
  const formatParameterRange = (param: any) => {
    if (param.type === 'categorical') {
      return (param.range as string[]).join(', ');
    } else {
      const range = param.range as [number, number];
      return `${range[0]} to ${range[1]}`;
    }
  };
  
  // Find analysis metric name
  const getMetricName = (metricId: string) => {
    switch (metricId) {
      case 'sensitivity': return 'Sensitivity Coefficients';
      case 'elasticity': return 'Elasticity';
      case 'pcc': return 'Partial Correlation Coefficients';
      case 'srcc': return 'Spearman Rank Correlation';
      case 'variance': return 'Variance Decomposition';
      case 'sobol': return 'Sobol Indices';
      case 'morris': return 'Morris Method';
      case 'rsq': return 'R-squared';
      case 'rmse': return 'RMSE';
      case 'mean': return 'Mean';
      case 'std': return 'Standard Deviation';
      case 'min': return 'Minimum';
      case 'max': return 'Maximum';
      case 'q25': return '25th Percentile';
      case 'median': return 'Median';
      case 'q75': return '75th Percentile';
      default: return metricId;
    }
  };
  
  // Find visualization name
  const getVisualizationName = (visId: string) => {
    switch (visId) {
      case 'sensitivity_heatmap': return 'Sensitivity Heatmap';
      case 'parameter_sweep': return 'Parameter Sweep Plot';
      case 'scatter_matrix': return 'Scatter Plot Matrix';
      case 'box_plots': return 'Box Plots';
      case 'parallel_coordinates': return 'Parallel Coordinates';
      case 'surface_response': return '3D Response Surface';
      case 'tornado_plot': return 'Tornado Plot';
      case 'correlation_matrix': return 'Correlation Matrix';
      case 'time_series': return 'Time Series Comparison';
      case 'spatial_map': return 'Spatial Maps';
      default: return visId;
    }
  };
  
  // Find script name
  const getScriptName = (scriptId: string) => {
    switch (scriptId) {
      case 'sensitivity_analysis': return 'Sensitivity Analysis';
      case 'statistical_summary': return 'Statistical Summary';
      case 'visualization_notebook': return 'Visualization Notebook';
      case 'data_extraction': return 'Data Extraction Script';
      case 'spatial_aggregation': return 'Spatial Aggregation';
      case 'time_aggregation': return 'Temporal Aggregation';
      default: return scriptId;
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review & Submit
      </Typography>
      <Typography variant="body1" paragraph>
        Review your parameter study configuration before creating it.
      </Typography>
      
      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Please review the following warnings:
          </Typography>
          <List dense disablePadding>
            {warnings.map((warning, index) => (
              <ListItem key={index} dense disablePadding>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <WarningIcon fontSize="small" color="warning" />
                </ListItemIcon>
                <ListItemText primary={warning} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ScienceIcon sx={{ mr: 1 }} />
              <Typography variant="h6">
                Study Configuration
              </Typography>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1">
                {studyConfig.name || 'Unnamed Study'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {studyConfig.description || 'No description provided'}
              </Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Base Simulation:</strong> {baseSimulation?.name || studyConfig.baseSimulationId}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Max Simulations:</strong> {studyConfig.maxSimulations}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Study Type:</strong> {studyConfig.studyType}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  {getStudyTypeDescription()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2">
                  <strong>Sampling Method:</strong> {studyConfig.samplingMethod}
                </Typography>
                <Typography variant="caption" display="block" color="text.secondary">
                  {getSamplingMethodDescription()}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2">
                  <strong>Total Simulations:</strong> {totalSimulations}
                  {totalSimulations > studyConfig.maxSimulations && (
                    <Typography component="span" color="error">
                      {' '}(exceeds maximum)
                    </Typography>
                  )}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
          
          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TuneIcon sx={{ mr: 1 }} />
              <Typography variant="h6">
                Parameters
              </Typography>
            </Box>
            
            {parameters.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Parameter</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Range / Values</TableCell>
                      <TableCell>Sampling</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parameters.map((param, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography variant="body2">
                            {param.name}
                          </Typography>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block' }}>
                            {param.path}
                          </Typography>
                        </TableCell>
                        <TableCell>{param.type}</TableCell>
                        <TableCell>{formatParameterRange(param)}</TableCell>
                        <TableCell>
                          {param.type !== 'categorical' && (
                            <Typography variant="body2">
                              {param.samplingPoints} points
                              {param.distribution && ` (${param.distribution})`}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="error">
                No parameters defined for this study.
              </Alert>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AssessmentIcon sx={{ mr: 1 }} />
              <Typography variant="h6">
                Output Analysis
              </Typography>
            </Box>
            
            <Typography variant="subtitle2" gutterBottom>
              Output Variables
            </Typography>
            {outputConfig.outputVariables.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>
                {outputConfig.outputVariables.map((variable) => (
                  <Chip
                    key={variable}
                    label={variable}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            ) : (
              <Alert severity="error" sx={{ mb: 3 }}>
                No output variables selected.
              </Alert>
            )}
            
            <Typography variant="subtitle2" gutterBottom>
              Analysis Metrics
            </Typography>
            {outputConfig.analysisMetrics.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>
                {outputConfig.analysisMetrics.map((metric) => (
                  <Chip
                    key={metric}
                    label={getMetricName(metric)}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            ) : (
              <Alert severity="warning" sx={{ mb: 3 }}>
                No analysis metrics selected.
              </Alert>
            )}
            
            <Typography variant="subtitle2" gutterBottom>
              Visualizations
            </Typography>
            {outputConfig.visualizationTypes.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>
                {outputConfig.visualizationTypes.map((vis) => (
                  <Chip
                    key={vis}
                    label={getVisualizationName(vis)}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Box>
            ) : (
              <Alert severity="info" sx={{ mb: 3 }}>
                No visualizations selected.
              </Alert>
            )}
            
            {outputConfig.postProcessingScripts.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom>
                  Post-Processing Scripts
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {outputConfig.postProcessingScripts.map((script) => (
                    <Chip
                      key={script}
                      label={getScriptName(script)}
                      size="small"
                      variant="outlined"
                      icon={<CodeIcon />}
                    />
                  ))}
                </Box>
              </>
            )}
          </Paper>
          
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <InfoIcon sx={{ mr: 1 }} />
              <Typography variant="h6">
                Study Summary
              </Typography>
            </Box>
            
            <List dense>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <CheckIcon fontSize="small" color="success" />
                </ListItemIcon>
                <ListItemText 
                  primary={`This study will run ${totalSimulations} simulations based on the ${parameters.length} parameters you've configured.`} 
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <CheckIcon fontSize="small" color="success" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${outputConfig.outputVariables.length} output variables will be analyzed using ${outputConfig.analysisMetrics.length} metrics.`} 
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <CheckIcon fontSize="small" color="success" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${outputConfig.visualizationTypes.length} visualizations will be generated to help interpret the results.`} 
                />
              </ListItem>
              
              {outputConfig.postProcessingScripts.length > 0 && (
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={`${outputConfig.postProcessingScripts.length} post-processing scripts will be executed automatically.`} 
                  />
                </ListItem>
              )}
            </List>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="body2" color="text.secondary">
              When you submit this study, all the simulations will be created and scheduled to run.
              You can monitor the progress and results from the Studies dashboard.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      
      <Accordion sx={{ mt: 3 }} defaultExpanded={false}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Advanced Details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="subtitle2" gutterBottom>
            Computational Estimations
          </Typography>
          <Typography variant="body2">
            Based on the base simulation and parameters, this study may require approximately:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Storage requirements:" 
                secondary={`~${totalSimulations * 2} GB (estimating 2 GB per simulation)`} 
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Compute requirements:" 
                secondary={`~${totalSimulations * 24} core-hours (estimating 24 core-hours per simulation)`} 
              />
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default ReviewSubmitStep;