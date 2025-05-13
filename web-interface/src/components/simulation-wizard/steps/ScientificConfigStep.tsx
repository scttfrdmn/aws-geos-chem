import React from 'react';
import {
  Typography,
  Box,
  Grid,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Card,
  CardContent,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';

import {
  ExpandMore as ExpandMoreIcon,
  Science as ScienceIcon,
  CloudCircle as CloudIcon,
  Settings as SettingsIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface ScientificConfigStepProps {
  formValues: any;
  onChange: (field: string, value: any) => void;
}

const ScientificConfigStep: React.FC<ScientificConfigStepProps> = ({ formValues, onChange }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Scientific Configuration
      </Typography>
      
      <Typography variant="body1" paragraph>
        Configure the scientific parameters for your GEOS-Chem simulation, including chemistry settings, emissions options, and HEMCO configuration.
      </Typography>
      
      <Grid container spacing={3}>
        {/* Chemistry Options */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ScienceIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Chemistry Options</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <FormControl component="fieldset">
              <FormLabel component="legend">Select Chemistry Mechanism</FormLabel>
              <RadioGroup
                row
                name="chemistry-option"
                value={formValues.chemistryOption}
                onChange={(e) => onChange('chemistryOption', e.target.value)}
              >
                <FormControlLabel
                  value="fullchem"
                  control={<Radio />}
                  label={
                    <Tooltip title="Complete tropospheric and stratospheric chemistry simulation with 200+ species">
                      <Box>Full Chemistry</Box>
                    </Tooltip>
                  }
                />
                <FormControlLabel
                  value="aerosol"
                  control={<Radio />}
                  label={
                    <Tooltip title="Aerosol-only simulation with simplified chemistry">
                      <Box>Aerosol-Only</Box>
                    </Tooltip>
                  }
                />
                <FormControlLabel
                  value="CH4"
                  control={<Radio />}
                  label={
                    <Tooltip title="Methane simulation with relevant chemistry">
                      <Box>CH4 Simulation</Box>
                    </Tooltip>
                  }
                />
                <FormControlLabel
                  value="CO2"
                  control={<Radio />}
                  label={
                    <Tooltip title="Carbon dioxide simulation for CO2 cycle studies">
                      <Box>CO2 Simulation</Box>
                    </Tooltip>
                  }
                />
                <FormControlLabel
                  value="transport"
                  control={<Radio />}
                  label={
                    <Tooltip title="Transport tracers only, no chemistry">
                      <Box>Transport Tracers</Box>
                    </Tooltip>
                  }
                />
              </RadioGroup>
            </FormControl>
            
            {/* Chemistry option details */}
            <Box sx={{ mt: 3 }}>
              {formValues.chemistryOption === 'fullchem' && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" color="primary" gutterBottom>
                      Full Chemistry
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The standard GEOS-Chem chemistry mechanism with tropospheric and stratospheric chemistry.
                      Includes reactions for O3, NOx, HOx, VOCs, aerosols, halogen chemistry, and more.
                    </Typography>
                    <List dense sx={{ mt: 1 }}>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Comprehensive atmospheric chemistry"
                          secondary="Good for most research applications"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Processing requirements"
                          secondary="Highest computational demands"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              )}
              
              {formValues.chemistryOption === 'aerosol' && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" color="primary" gutterBottom>
                      Aerosol-Only Simulation
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Focuses on aerosol microphysics and thermodynamics with simplified gas-phase chemistry.
                      Includes sulfate, nitrate, ammonium, carbonaceous aerosols, dust, and sea salt.
                    </Typography>
                    <List dense sx={{ mt: 1 }}>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Focused on particulate matter"
                          secondary="Good for air quality and climate studies"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Processing requirements"
                          secondary="Medium computational demands"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              )}
              
              {formValues.chemistryOption === 'CH4' && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" color="primary" gutterBottom>
                      CH4 Simulation
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Specialized simulation for methane studies. Includes simplified chemistry focused on methane oxidation.
                    </Typography>
                    <List dense sx={{ mt: 1 }}>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Methane-focused chemistry"
                          secondary="Good for greenhouse gas studies"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Processing requirements"
                          secondary="Lower computational demands"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              )}
              
              {formValues.chemistryOption === 'CO2' && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" color="primary" gutterBottom>
                      CO2 Simulation
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Carbon dioxide simulation for carbon cycle studies. No chemistry, but includes CO2 sources and sinks.
                    </Typography>
                    <List dense sx={{ mt: 1 }}>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="CO2 sources and sinks"
                          secondary="Good for carbon cycle research"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Processing requirements"
                          secondary="Lower computational demands"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              )}
              
              {formValues.chemistryOption === 'transport' && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" color="primary" gutterBottom>
                      Transport Tracers
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Passive tracers for transport diagnostics. No chemistry, just emissions and transport of inert tracers.
                    </Typography>
                    <List dense sx={{ mt: 1 }}>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Transport evaluation"
                          secondary="Good for model transport diagnostics"
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Processing requirements"
                          secondary="Lowest computational demands"
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              )}
            </Box>
          </Paper>
        </Grid>
        
        {/* Emissions Options */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CloudIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Emissions Options</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <FormControl component="fieldset">
              <FormLabel component="legend">Select Emissions Configuration</FormLabel>
              <RadioGroup
                name="emissions-option"
                value={formValues.emissionsOption}
                onChange={(e) => onChange('emissionsOption', e.target.value)}
              >
                <FormControlLabel
                  value="standard"
                  control={<Radio />}
                  label="Standard Emissions"
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label="Custom Emissions Scenario"
                />
              </RadioGroup>
            </FormControl>
            
            <Box sx={{ mt: 2 }}>
              {formValues.emissionsOption === 'standard' ? (
                <Typography variant="body2" color="text.secondary">
                  Uses the default emissions inventories and settings for the selected simulation type.
                  Appropriate for most standard research applications.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Advanced option. You will be able to customize emissions scaling factors and select
                  alternative emissions inventories after simulation creation.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
        
        {/* HEMCO Options */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SettingsIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">HEMCO Configuration</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <FormControl component="fieldset">
              <FormLabel component="legend">Select HEMCO Configuration</FormLabel>
              <RadioGroup
                name="hemco-option"
                value={formValues.hemcoOption}
                onChange={(e) => onChange('hemcoOption', e.target.value)}
              >
                <FormControlLabel
                  value="standard"
                  control={<Radio />}
                  label="Standard HEMCO Configuration"
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label="Custom HEMCO Settings"
                />
              </RadioGroup>
            </FormControl>
            
            <Box sx={{ mt: 2 }}>
              {formValues.hemcoOption === 'standard' ? (
                <Typography variant="body2" color="text.secondary">
                  Uses the default HEMCO (Harmonized Emissions Component) configuration file
                  appropriate for the selected chemistry option.
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Advanced option. You will be able to upload or edit a custom HEMCO configuration file
                  after simulation creation.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Advanced Options (hidden in accordion) */}
      <Accordion sx={{ mt: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Advanced Scientific Options</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary">
            Advanced scientific options will be available on the simulation detail page after creating the simulation.
            These include custom chemistry mechanisms, reaction rate adjustments, and specialized diagnostics.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default ScientificConfigStep;