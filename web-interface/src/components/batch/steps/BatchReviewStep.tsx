import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

interface BatchReviewStepProps {
  batchName: string;
  batchDescription: string;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  templateId: string | null;
  parameters: any[];
  computeConfig: any;
  totalSimulations: number;
}

const BatchReviewStep: React.FC<BatchReviewStepProps> = ({
  batchName,
  batchDescription,
  onNameChange,
  onDescriptionChange,
  templateId,
  parameters,
  computeConfig,
  totalSimulations
}) => {
  // Get template or simulation from store
  const templates = useSelector((state: RootState) => state.batch.templates);
  const simulations = useSelector((state: RootState) => state.simulations.simulations);
  
  const selectedTemplate = templateId 
    ? templates.find(t => t.id === templateId) || simulations.find(s => s.id === templateId)
    : null;
  
  // Cost calculation for display
  const getInstancePrice = (instanceType: string, useSpot: boolean): number => {
    const prices: Record<string, { onDemand: number, spot: number }> = {
      'c5.large': { onDemand: 0.085, spot: 0.027 },
      'c5.xlarge': { onDemand: 0.17, spot: 0.054 },
      'c5.2xlarge': { onDemand: 0.34, spot: 0.109 },
      'c5.4xlarge': { onDemand: 0.68, spot: 0.218 },
      'c5.9xlarge': { onDemand: 1.53, spot: 0.490 },
      'r5.xlarge': { onDemand: 0.252, spot: 0.081 },
      'r5.2xlarge': { onDemand: 0.504, spot: 0.161 }
    };
    
    const defaultPrice = { onDemand: 0.34, spot: 0.109 }; // c5.2xlarge as default
    const price = prices[instanceType] || defaultPrice;
    
    return useSpot ? price.spot : price.onDemand;
  };
  
  const hourlyRate = getInstancePrice(computeConfig.instanceType, computeConfig.useSpot);
  const estimatedCost = hourlyRate * 24 * computeConfig.maxConcurrentJobs; // Daily cost
  
  // Generate a preview of parameter combinations
  const generateCombinationExamples = () => {
    if (parameters.length === 0) return [];
    
    // Generate a few example combinations (up to 5)
    const examples = [];
    const maxExamples = Math.min(5, totalSimulations);
    
    // Simple function to generate combinations for display purposes
    const generateSampleCombinations = (params: any[], count: number) => {
      const result = [];
      for (let i = 0; i < count; i++) {
        const combination: Record<string, any> = {};
        params.forEach(param => {
          // Pick values with some variation, cycling through available values
          const valueIndex = i % param.values.length;
          combination[param.name] = param.values[valueIndex];
        });
        result.push(combination);
      }
      return result;
    };
    
    return generateSampleCombinations(parameters, maxExamples);
  };
  
  const combinationExamples = generateCombinationExamples();
  
  // Generate warnings if any
  const generateWarnings = () => {
    const warnings = [];
    
    if (!batchName) {
      warnings.push('Batch name is required');
    }
    
    if (totalSimulations === 0) {
      warnings.push('No parameter combinations defined');
    }
    
    if (computeConfig.maxTotalJobs < totalSimulations) {
      warnings.push(`Maximum job limit (${computeConfig.maxTotalJobs}) is less than the total combinations (${totalSimulations}). Some simulations will not be run.`);
    }
    
    // Calculate estimated cost for warning
    const estimatedTotalCost = hourlyRate * 24 * computeConfig.maxConcurrentJobs * (totalSimulations / computeConfig.maxConcurrentJobs / 24);
    if (estimatedTotalCost > computeConfig.maxBudget) {
      warnings.push(`Estimated cost ($${estimatedTotalCost.toFixed(2)}) exceeds budget ($${computeConfig.maxBudget})`);
    }
    
    if (computeConfig.useSpot && computeConfig.priority === 'high') {
      warnings.push('Using Spot instances with high priority may lead to increased interruptions. Consider using On-Demand instances for high priority work.');
    }
    
    return warnings;
  };
  
  const warnings = generateWarnings();
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review & Submit
      </Typography>
      <Typography variant="body1" paragraph>
        Review your batch processing configuration before creating the simulations.
      </Typography>
      
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Batch Information
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Batch Name"
              fullWidth
              required
              value={batchName}
              onChange={(e) => onNameChange(e.target.value)}
              error={!batchName}
              helperText={!batchName ? 'Batch name is required' : ''}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Total Simulations"
              fullWidth
              value={totalSimulations}
              InputProps={{
                readOnly: true,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={batchDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Describe the purpose of this batch simulation"
            />
          </Grid>
        </Grid>
      </Paper>
      
      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Please address the following warnings:
          </Typography>
          <List dense disablePadding>
            {warnings.map((warning, index) => (
              <ListItem key={index} disablePadding>
                <ListItemText primary={warning} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, mb: 3, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              Base Template
            </Typography>
            
            {selectedTemplate ? (
              <>
                <Typography variant="h6">
                  {selectedTemplate.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {selectedTemplate.description || 'No description available'}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Type:</strong> {selectedTemplate.config.simulationType}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Region:</strong> {selectedTemplate.config.domain.region}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Resolution:</strong> {selectedTemplate.config.domain.resolution}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Vertical Levels:</strong> {selectedTemplate.config.domain.verticalLevels}
                    </Typography>
                  </Grid>
                </Grid>
              </>
            ) : (
              <Alert severity="error">
                No template selected. Please go back and select a template.
              </Alert>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, mb: 3, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              Compute Configuration
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Instance Type:</strong> {computeConfig.instanceType}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Pricing:</strong> {computeConfig.useSpot ? 'Spot' : 'On-Demand'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Concurrent Jobs:</strong> {computeConfig.maxConcurrentJobs}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Max Total Jobs:</strong> {computeConfig.maxTotalJobs}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Priority:</strong> {computeConfig.priority}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Max Budget:</strong> ${computeConfig.maxBudget}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">
                  <strong>Estimated Daily Cost:</strong> ${estimatedCost.toFixed(2)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
      
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Parameter Variations
        </Typography>
        
        {parameters.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Parameter</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell>Values</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parameters.map((param, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2">{param.name}</Typography>
                      {param.description && (
                        <Typography variant="caption" color="text.secondary">
                          {param.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{param.path}</Typography>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="error">
            No parameters defined. Please go back and add at least one parameter.
          </Alert>
        )}
      </Paper>
      
      {combinationExamples.length > 0 && (
        <Accordion variant="outlined">
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="combination-examples-content"
            id="combination-examples-header"
          >
            <Typography>Sample Combinations Preview ({combinationExamples.length} of {totalSimulations})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    {parameters.map((param, index) => (
                      <TableCell key={index}>{param.name}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {combinationExamples.map((combination, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      {parameters.map((param, paramIndex) => (
                        <TableCell key={paramIndex}>
                          {combination[param.name] !== undefined
                            ? combination[param.name].toString()
                            : 'N/A'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {totalSimulations > combinationExamples.length && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                ... and {totalSimulations - combinationExamples.length} more combinations
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default BatchReviewStep;