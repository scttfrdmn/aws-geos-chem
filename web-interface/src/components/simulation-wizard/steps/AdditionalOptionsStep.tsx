import React, { useState } from 'react';
import {
  Typography,
  Box,
  Grid,
  Paper,
  Divider,
  FormGroup,
  FormControlLabel,
  Checkbox,
  TextField,
  Switch,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';

import {
  ExpandMore as ExpandMoreIcon,
  Notifications as NotificationsIcon,
  DataObject as DiagnosticsIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Add as AddIcon
} from '@mui/icons-material';

interface AdditionalOptionsStepProps {
  formValues: any;
  onChange: (field: string, value: any) => void;
}

const AdditionalOptionsStep: React.FC<AdditionalOptionsStepProps> = ({ formValues, onChange }) => {
  // Local state for diagnostic options
  const [selectedDiagnostics, setSelectedDiagnostics] = useState<string[]>(
    formValues.outputDiagnostics || []
  );
  
  // Available diagnostic collections
  const diagnosticOptions = [
    { id: 'transport', name: 'Transport', description: 'Air mass fluxes and transport diagnostics' },
    { id: 'meteorology', name: 'Meteorology', description: 'Meteorological fields' },
    { id: 'chemistry', name: 'Chemistry', description: 'Chemical production and loss rates' },
    { id: 'aerosols', name: 'Aerosols', description: 'Aerosol concentrations and properties' },
    { id: 'deposition', name: 'Deposition', description: 'Dry and wet deposition fluxes' },
    { id: 'emissions', name: 'Emissions', description: 'Emission fluxes by category' },
    { id: 'radiation', name: 'Radiation', description: 'Radiative fluxes and properties' },
    { id: 'budget', name: 'Budget', description: 'Mass budget diagnostics' }
  ];
  
  // Post-processing options
  const postProcessingOptions = [
    { id: 'timeAverage', name: 'Time Averaging', description: 'Calculate time averages of output fields' },
    { id: 'spatialAverage', name: 'Spatial Averaging', description: 'Calculate spatial averages over regions' },
    { id: 'verticalProfiles', name: 'Vertical Profiles', description: 'Extract vertical profiles at locations' },
    { id: 'timeSeries', name: 'Time Series', description: 'Extract time series at locations' },
    { id: 'regridToLatLon', name: 'Regrid to Lat-Lon', description: 'Convert cubed-sphere output to lat-lon (GCHP only)' }
  ];
  
  // Handle diagnostic selection
  const handleDiagnosticChange = (diagnosticId: string) => {
    setSelectedDiagnostics((prev) => {
      if (prev.includes(diagnosticId)) {
        return prev.filter(id => id !== diagnosticId);
      } else {
        return [...prev, diagnosticId];
      }
    });
    
    onChange('outputDiagnostics', 
      selectedDiagnostics.includes(diagnosticId)
        ? selectedDiagnostics.filter(id => id !== diagnosticId)
        : [...selectedDiagnostics, diagnosticId]
    );
  };
  
  // Handle post-processing selection
  const handlePostProcessingChange = (optionId: string) => {
    const currentOptions = formValues.postProcessing || [];
    
    if (currentOptions.includes(optionId)) {
      onChange('postProcessing', currentOptions.filter((id: string) => id !== optionId));
    } else {
      onChange('postProcessing', [...currentOptions, optionId]);
    }
  };
  
  // Handle notification changes
  const handleNotificationChange = (field: string, value: boolean) => {
    onChange('notifications', {
      ...formValues.notifications,
      [field]: value
    });
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Additional Options
      </Typography>
      
      <Typography variant="body1" paragraph>
        Configure optional settings for your simulation, including output diagnostics, post-processing,
        and notification preferences.
      </Typography>
      
      <Grid container spacing={3}>
        {/* Diagnostics Selection */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DiagnosticsIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Output Diagnostics</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <Typography variant="body2" paragraph>
              Select which diagnostics you want to include in your simulation output.
              More diagnostics will increase the output file size.
            </Typography>
            
            <Grid container spacing={2}>
              {diagnosticOptions.map((option) => (
                <Grid item xs={12} sm={6} md={4} key={option.id}>
                  <Box
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: selectedDiagnostics.includes(option.id)
                        ? 'primary.main'
                        : 'divider',
                      borderRadius: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      height: '100%',
                      backgroundColor: selectedDiagnostics.includes(option.id)
                        ? 'action.selected'
                        : 'background.paper',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleDiagnosticChange(option.id)}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle1">{option.name}</Typography>
                      <Checkbox
                        checked={selectedDiagnostics.includes(option.id)}
                        color="primary"
                        size="small"
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleDiagnosticChange(option.id)}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
            
            {selectedDiagnostics.length === 0 && (
              <Alert severity="info" sx={{ mt: 3 }}>
                No diagnostics selected. The simulation will only output basic concentration fields.
              </Alert>
            )}
            
            {/* Custom Diagnostics Accordion */}
            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Advanced/Custom Diagnostics</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Custom diagnostics can be configured after simulation creation.
                  You'll be able to specify individual species, levels, and regions.
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  variant="outlined"
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={(e) => e.preventDefault()}
                >
                  Add Custom Diagnostic (After Creation)
                </Button>
              </AccordionDetails>
            </Accordion>
          </Paper>
        </Grid>
        
        {/* Post Processing Options */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CodeIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Post-Processing</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <Typography variant="body2" paragraph>
              Select automatic post-processing operations to apply to simulation outputs.
            </Typography>
            
            <FormGroup>
              {postProcessingOptions.map((option) => (
                <FormControlLabel
                  key={option.id}
                  control={
                    <Checkbox
                      checked={(formValues.postProcessing || []).includes(option.id)}
                      onChange={() => handlePostProcessingChange(option.id)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">{option.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 1 }}
                />
              ))}
            </FormGroup>
            
            {(formValues.postProcessing || []).length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No post-processing selected. Raw model outputs will be available.
              </Alert>
            )}
            
            {formValues.simulationType === 'GCHP' && !(formValues.postProcessing || []).includes('regridToLatLon') && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                GCHP outputs are on the cubed-sphere grid. Consider adding "Regrid to Lat-Lon"
                for easier analysis with standard tools.
              </Alert>
            )}
          </Paper>
        </Grid>
        
        {/* Notification Preferences */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <NotificationsIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Notification Preferences</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <Typography variant="body2" paragraph>
              Configure how you'd like to be notified about your simulation.
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  <InfoIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Email Notifications"
                  secondary="Receive updates via email"
                />
                <Switch
                  edge="end"
                  checked={formValues.notifications?.email !== false}
                  onChange={(e) => handleNotificationChange('email', e.target.checked)}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <InfoIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Completion Notification"
                  secondary="Notify when simulation completes"
                />
                <Switch
                  edge="end"
                  checked={formValues.notifications?.completion !== false}
                  onChange={(e) => handleNotificationChange('completion', e.target.checked)}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <InfoIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Error Notification"
                  secondary="Notify when errors occur"
                />
                <Switch
                  edge="end"
                  checked={formValues.notifications?.error !== false}
                  onChange={(e) => handleNotificationChange('error', e.target.checked)}
                />
              </ListItem>
            </List>
            
            {!formValues.notifications?.email && !formValues.notifications?.completion && !formValues.notifications?.error && (
              <Alert severity="info" sx={{ mt: 2 }}>
                All notifications are disabled. You'll need to manually check simulation status.
              </Alert>
            )}
          </Paper>
        </Grid>
        
        {/* Advanced Configuration */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SettingsIcon color="primary" sx={{ mr: 1 }} />
                <Typography>Advanced Configuration (YAML Editor)</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" paragraph>
                Advanced users can modify the YAML configuration directly. This will be available
                after simulation creation, on the simulation details page.
              </Typography>
              
              <TextField
                multiline
                fullWidth
                rows={8}
                disabled
                variant="outlined"
                placeholder="YAML configuration will be available after simulation creation"
                helperText="YAML editor will be accessible on the simulation details page"
              />
              
              <Alert severity="info" sx={{ mt: 2 }}>
                The YAML editor gives you full control over all simulation parameters.
                It will be available on the simulation details page after creation.
              </Alert>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdditionalOptionsStep;