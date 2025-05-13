import React from 'react';
import {
  Typography,
  Box,
  Grid,
  Paper,
  Divider,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  Card,
  CardContent,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';

import {
  Science as ScienceIcon,
  GridOn as GridIcon,
  Schedule as ScheduleIcon,
  Memory as MemoryIcon,
  MonetizationOn as CostIcon,
  DataObject as DiagnosticsIcon
} from '@mui/icons-material';

interface ReviewSubmitStepProps {
  formValues: any;
  onChange: (field: string, value: any) => void;
}

const ReviewSubmitStep: React.FC<ReviewSubmitStepProps> = ({ formValues, onChange }) => {
  // Format currency
  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };
  
  // Calculate duration between two dates
  const calculateDuration = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Invalid date range';
    }
    
    // Calculate difference in days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = diffDays % 30;
    
    let result = '';
    if (years > 0) {
      result += `${years} year${years > 1 ? 's' : ''} `;
    }
    if (months > 0) {
      result += `${months} month${months > 1 ? 's' : ''} `;
    }
    if (days > 0 || (years === 0 && months === 0)) {
      result += `${days} day${days !== 1 ? 's' : ''}`;
    }
    
    return result.trim();
  };
  
  // Handle name and description changes
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange('name', e.target.value);
  };
  
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange('description', e.target.value);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Review and Submit
      </Typography>
      
      <Typography variant="body1" paragraph>
        Review your simulation configuration and provide a name and description before submission.
      </Typography>
      
      <Grid container spacing={3}>
        {/* Simulation Name and Description */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Simulation Name and Description
            </Typography>
            
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Simulation Name"
                  fullWidth
                  required
                  value={formValues.name}
                  onChange={handleNameChange}
                  placeholder="e.g., Global Run 2020 Full Chemistry"
                  helperText="Provide a descriptive name for your simulation"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={formValues.description}
                  onChange={handleDescriptionChange}
                  placeholder="e.g., Global full chemistry simulation for 2020 with standard emissions to evaluate ozone production"
                  helperText="Provide additional details about the simulation purpose and configuration"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        {/* Simulation Configuration Summary */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Configuration Summary
            </Typography>
            
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={4}>
              {/* Scientific Configuration */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <ScienceIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Scientific Configuration</Typography>
                    </Box>
                    
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="Simulation Type"
                          secondary={formValues.simulationType === 'GC_CLASSIC' ? 'GEOS-Chem Classic' : 'GEOS-Chem High Performance'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Chemistry Option"
                          secondary={
                            formValues.chemistryOption === 'fullchem' ? 'Full Chemistry' :
                            formValues.chemistryOption === 'aerosol' ? 'Aerosol-Only' :
                            formValues.chemistryOption === 'CH4' ? 'CH4 Simulation' :
                            formValues.chemistryOption === 'CO2' ? 'CO2 Simulation' :
                            formValues.chemistryOption === 'transport' ? 'Transport Tracers' :
                            formValues.chemistryOption
                          }
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Emissions Configuration"
                          secondary={formValues.emissionsOption === 'standard' ? 'Standard Emissions' : 'Custom Emissions'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="HEMCO Configuration"
                          secondary={formValues.hemcoOption === 'standard' ? 'Standard HEMCO' : 'Custom HEMCO'}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Domain and Resolution */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <GridIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Domain and Resolution</Typography>
                    </Box>
                    
                    {formValues.simulationType === 'GC_CLASSIC' ? (
                      <List dense>
                        <ListItem>
                          <ListItemText
                            primary="Domain Type"
                            secondary={formValues.domain === 'global' ? 'Global Domain' : 'Nested Domain'}
                          />
                        </ListItem>
                        {formValues.domain === 'global' ? (
                          <ListItem>
                            <ListItemText
                              primary="Resolution"
                              secondary={formValues.resolution}
                            />
                          </ListItem>
                        ) : (
                          <>
                            <ListItem>
                              <ListItemText
                                primary="Nested Region"
                                secondary={
                                  formValues.nestedRegion === 'asia' ? 'Asia' :
                                  formValues.nestedRegion === 'namerica' ? 'North America' :
                                  formValues.nestedRegion === 'europe' ? 'Europe' :
                                  formValues.nestedRegion === 'custom' ? 'Custom Region' :
                                  formValues.nestedRegion
                                }
                              />
                            </ListItem>
                            <ListItem>
                              <ListItemText
                                primary="Nested Resolution"
                                secondary={formValues.resolution}
                              />
                            </ListItem>
                          </>
                        )}
                      </List>
                    ) : (
                      <List dense>
                        <ListItem>
                          <ListItemText
                            primary="Grid Type"
                            secondary="Cubed-Sphere"
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemText
                            primary="Resolution"
                            secondary={formValues.cubedsphereRes}
                          />
                        </ListItem>
                      </List>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Time Configuration */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <ScheduleIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Time Configuration</Typography>
                    </Box>
                    
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="Start Date"
                          secondary={formValues.startDate}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="End Date"
                          secondary={formValues.endDate}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Duration"
                          secondary={formValues.startDate && formValues.endDate ? 
                            calculateDuration(formValues.startDate, formValues.endDate) : 'Unknown'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Output Frequency"
                          secondary={formValues.outputFrequency}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Restart Option"
                          secondary={
                            formValues.restartOption === 'none' ? 'No restart' :
                            formValues.restartOption === 'initial' ? 'Standard initial conditions' :
                            formValues.restartOption === 'custom' ? 'Custom restart file' :
                            formValues.restartOption
                          }
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Spinup Days"
                          secondary={`${formValues.spinupDays} days`}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Computing Resources */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <MemoryIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Computing Resources</Typography>
                    </Box>
                    
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="Processor Type"
                          secondary={
                            formValues.processorType === 'graviton3' ? 'AWS Graviton3 (ARM)' :
                            formValues.processorType === 'graviton4' ? 'AWS Graviton4 (ARM)' :
                            formValues.processorType === 'intel' ? 'Intel x86' :
                            formValues.processorType === 'amd' ? 'AMD x86' :
                            formValues.processorType
                          }
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Instance Size"
                          secondary={
                            formValues.instanceSize === 'small' ? 'Small (4 vCPUs)' :
                            formValues.instanceSize === 'medium' ? 'Medium (8 vCPUs)' :
                            formValues.instanceSize === 'large' ? 'Large (16 vCPUs)' :
                            formValues.instanceSize === 'xlarge' ? 'X-Large (32 vCPUs)' :
                            formValues.instanceSize
                          }
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Memory Configuration"
                          secondary={formValues.memory === 'standard' ? 'Standard Memory' : 'High Memory'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Use Spot Instances"
                          secondary={formValues.useSpot ? 'Yes (70% cost savings)' : 'No (on-demand)'}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Cost and Performance */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <CostIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Cost and Performance</Typography>
                    </Box>
                    
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="Estimated Cost"
                          secondary={formatCurrency(formValues.estimatedCost || 0)}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Estimated Runtime"
                          secondary={`${formValues.estimatedRuntime || 0} hours (${Math.ceil((formValues.estimatedRuntime || 0) / 24)} days)`}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* Output and Notifications */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <DiagnosticsIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6">Output and Notifications</Typography>
                    </Box>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Selected Diagnostics:
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      {formValues.outputDiagnostics && formValues.outputDiagnostics.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {formValues.outputDiagnostics.map((diagnostic: string) => (
                            <Chip 
                              key={diagnostic} 
                              label={diagnostic.charAt(0).toUpperCase() + diagnostic.slice(1)} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No additional diagnostics selected
                        </Typography>
                      )}
                    </Box>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Post-Processing:
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      {formValues.postProcessing && formValues.postProcessing.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {formValues.postProcessing.map((option: string) => (
                            <Chip 
                              key={option} 
                              label={option} 
                              size="small" 
                              color="secondary" 
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No post-processing selected
                        </Typography>
                      )}
                    </Box>
                    
                    <Typography variant="subtitle2" gutterBottom>
                      Notifications:
                    </Typography>
                    
                    <Box>
                      <Typography variant="body2">
                        Email: {formValues.notifications?.email ? 'Enabled' : 'Disabled'} |
                        Completion: {formValues.notifications?.completion ? 'Enabled' : 'Disabled'} |
                        Errors: {formValues.notifications?.error ? 'Enabled' : 'Disabled'}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        {/* Final Checks */}
        <Grid item xs={12}>
          <Alert 
            severity={formValues.name ? 'success' : 'warning'}
            sx={{ mb: 2 }}
          >
            {formValues.name 
              ? 'Your simulation is ready to be submitted. Click "Submit Simulation" below to proceed.'
              : 'Please provide a name for your simulation before submitting.'}
          </Alert>
          
          {formValues.useSpot && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You've selected spot instances, which can save ~70% on costs but may be interrupted.
              Your simulation will be checkpointed every hour for recovery.
            </Alert>
          )}
          
          {formValues.estimatedRuntime > 72 && (
            <Alert severity="info">
              Your simulation has an estimated runtime of {formValues.estimatedRuntime} hours ({Math.ceil(formValues.estimatedRuntime / 24)} days).
              Long-running simulations are more susceptible to interruption.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReviewSubmitStep;