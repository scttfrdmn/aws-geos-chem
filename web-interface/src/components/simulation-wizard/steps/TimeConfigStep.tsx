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
  TextField,
  Paper,
  Divider,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Tooltip,
  IconButton,
  Alert,
  Slider,
  Stack
} from '@mui/material';

import {
  DateRange as DateRangeIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  HelpOutline as HelpIcon
} from '@mui/icons-material';

interface TimeConfigStepProps {
  formValues: any;
  onChange: (field: string, value: any) => void;
}

const TimeConfigStep: React.FC<TimeConfigStepProps> = ({ formValues, onChange }) => {
  // Handle output frequency change
  const handleOutputFrequencyChange = (event: SelectChangeEvent) => {
    onChange('outputFrequency', event.target.value);
  };
  
  // Handle restart option change
  const handleRestartOptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange('restartOption', event.target.value);
  };
  
  // Handle spinup days slider change
  const handleSpinupChange = (event: Event, newValue: number | number[]) => {
    onChange('spinupDays', newValue as number);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Time Configuration
      </Typography>
      
      <Typography variant="body1" paragraph>
        Configure the time parameters for your simulation, including start and end dates, output frequency,
        restart options, and spinup settings.
      </Typography>
      
      <Grid container spacing={3}>
        {/* Simulation Period */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DateRangeIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Simulation Period</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Start Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={formValues.startDate}
                  onChange={(e) => onChange('startDate', e.target.value)}
                  required
                  helperText="Simulation start date (YYYY-MM-DD)"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="End Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={formValues.endDate}
                  onChange={(e) => onChange('endDate', e.target.value)}
                  required
                  helperText="Simulation end date (YYYY-MM-DD)"
                />
              </Grid>
            </Grid>
            
            {/* Duration calculation */}
            {formValues.startDate && formValues.endDate && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Duration: {calculateDuration(formValues.startDate, formValues.endDate)}
                </Typography>
              </Box>
            )}
            
            {/* Alert for long simulations */}
            {formValues.startDate && formValues.endDate && 
              isLongDuration(formValues.startDate, formValues.endDate) && (
              <Alert severity="info" sx={{ mt: 2 }}>
                You've selected a relatively long simulation period. Consider breaking it into
                smaller segments or using restart files for more manageable runs.
              </Alert>
            )}
          </Paper>
        </Grid>
        
        {/* Output Frequency */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ScheduleIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Output Frequency</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <FormControl fullWidth>
              <InputLabel id="output-frequency-label">Output Frequency</InputLabel>
              <Select
                labelId="output-frequency-label"
                id="output-frequency"
                value={formValues.outputFrequency}
                label="Output Frequency"
                onChange={handleOutputFrequencyChange}
              >
                <MenuItem value="hourly">Hourly</MenuItem>
                <MenuItem value="3-hourly">3-Hourly</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {formValues.outputFrequency === 'hourly' && 
                  'Hourly output provides the most detailed temporal resolution but generates the most data.'}
                {formValues.outputFrequency === '3-hourly' && 
                  '3-hourly output is a good balance between temporal resolution and data volume.'}
                {formValues.outputFrequency === 'daily' && 
                  'Daily output is suitable for most applications and generates moderate data volume.'}
                {formValues.outputFrequency === 'monthly' && 
                  'Monthly output is ideal for long-term simulations and generates the least data.'}
                {formValues.outputFrequency === 'custom' && 
                  'Custom output frequency can be configured in advanced settings after simulation creation.'}
              </Typography>
            </Box>
            
            {/* Estimated data volume info */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Estimated output data volume:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formValues.outputFrequency === 'hourly' && formValues.simulationType === 'GC_CLASSIC' && 
                  '• ~5-10 GB per simulation month for standard diagnostics'}
                {formValues.outputFrequency === '3-hourly' && formValues.simulationType === 'GC_CLASSIC' && 
                  '• ~2-4 GB per simulation month for standard diagnostics'}
                {formValues.outputFrequency === 'daily' && formValues.simulationType === 'GC_CLASSIC' && 
                  '• ~1-2 GB per simulation month for standard diagnostics'}
                {formValues.outputFrequency === 'monthly' && formValues.simulationType === 'GC_CLASSIC' && 
                  '• ~0.5-1 GB per simulation month for standard diagnostics'}
                
                {formValues.outputFrequency === 'hourly' && formValues.simulationType === 'GCHP' && 
                  '• ~10-20 GB per simulation month for standard diagnostics'}
                {formValues.outputFrequency === '3-hourly' && formValues.simulationType === 'GCHP' && 
                  '• ~4-8 GB per simulation month for standard diagnostics'}
                {formValues.outputFrequency === 'daily' && formValues.simulationType === 'GCHP' && 
                  '• ~2-4 GB per simulation month for standard diagnostics'}
                {formValues.outputFrequency === 'monthly' && formValues.simulationType === 'GCHP' && 
                  '• ~1-2 GB per simulation month for standard diagnostics'}
                
                {formValues.outputFrequency === 'custom' && 
                  '• Varies based on selected output frequency'}
              </Typography>
            </Box>
          </Paper>
        </Grid>
        
        {/* Restart Options */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <RefreshIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Restart & Spinup Options</Typography>
              <Tooltip title="Restart files store the model state at a given time. Spinup ensures the model reaches chemical equilibrium before the analysis period.">
                <IconButton size="small" sx={{ ml: 1 }}>
                  <HelpIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <FormControl component="fieldset">
              <FormLabel component="legend">Restart Configuration</FormLabel>
              <RadioGroup
                name="restart-option"
                value={formValues.restartOption}
                onChange={handleRestartOptionChange}
              >
                <FormControlLabel
                  value="none"
                  control={<Radio />}
                  label="No restart (initialize from default state)"
                />
                <FormControlLabel
                  value="initial"
                  control={<Radio />}
                  label="Use standard initial conditions"
                />
                <FormControlLabel
                  value="custom"
                  control={<Radio />}
                  label="Use custom restart file (upload after creation)"
                />
              </RadioGroup>
            </FormControl>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Spinup Days
                <Tooltip title="Number of days to run the model before the actual simulation period to allow chemical species to reach equilibrium">
                  <IconButton size="small" sx={{ ml: 0.5 }}>
                    <HelpIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Typography>
              
              <Stack spacing={2} direction="row" alignItems="center" sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">0</Typography>
                <Slider
                  value={formValues.spinupDays}
                  onChange={handleSpinupChange}
                  min={0}
                  max={90}
                  step={1}
                  valueLabelDisplay="auto"
                  aria-labelledby="spinup-days-slider"
                />
                <Typography variant="body2" color="text.secondary">90</Typography>
              </Stack>
              
              <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
                {formValues.spinupDays} days
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {formValues.spinupDays === 0 ?
                  'No spinup period. Suitable if using restart files from a similar run.' :
                  `${formValues.spinupDays} days of spinup will be performed before the main simulation.`}
                
                {formValues.chemistryOption === 'fullchem' && formValues.spinupDays < 30 && formValues.restartOption === 'none' && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    For full chemistry without restart files, at least 30 days of spinup is recommended.
                  </Alert>
                )}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

// Helper function to calculate duration between two dates
function calculateDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Invalid date range';
  }
  
  // Check if end date is before start date
  if (end < start) {
    return 'End date must be after start date';
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
}

// Helper function to check if duration is long (more than 3 months)
function isLongDuration(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return false;
  }
  
  // Calculate difference in days
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Consider more than 3 months (90 days) as a long duration
  return diffDays > 90;
}

export default TimeConfigStep;