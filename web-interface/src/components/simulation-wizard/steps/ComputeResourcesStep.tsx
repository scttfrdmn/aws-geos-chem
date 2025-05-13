import React from 'react';
import {
  Typography,
  Box,
  Grid,
  Paper,
  Divider,
  RadioGroup,
  FormControlLabel,
  Radio,
  Card,
  CardContent,
  CardHeader,
  FormGroup,
  Switch,
  Slider,
  Stack,
  Alert,
  Tooltip,
  IconButton,
  FormControl,
  FormLabel,
  Chip
} from '@mui/material';

import {
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  AttachMoney as MoneyIcon,
  HelpOutline as HelpIcon
} from '@mui/icons-material';

interface ComputeResourcesStepProps {
  formValues: any;
  onChange: (field: string, value: any) => void;
}

const ComputeResourcesStep: React.FC<ComputeResourcesStepProps> = ({ formValues, onChange }) => {
  // Determine if high memory is needed based on other selections
  const isHighMemoryRecommended = () => {
    if (formValues.simulationType === 'GCHP' && 
        (formValues.cubedsphereRes === 'C180' || formValues.cubedsphereRes === 'C360')) {
      return true;
    }
    
    if (formValues.simulationType === 'GC_CLASSIC' && 
        formValues.resolution === '0.25x0.3125') {
      return true;
    }
    
    return false;
  };
  
  // Toggle spot instance option
  const handleSpotToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange('useSpot', event.target.checked);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Computing Resources
      </Typography>
      
      <Typography variant="body1" paragraph>
        Configure the computational resources for your simulation. Selecting appropriate resources
        ensures optimal performance and cost-effectiveness.
      </Typography>
      
      <Grid container spacing={3}>
        {/* Processor Type Selection */}
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <MemoryIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Processor Type</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <FormControl component="fieldset">
              <FormLabel component="legend">Select Processor Architecture</FormLabel>
              <RadioGroup
                row
                name="processor-type"
                value={formValues.processorType}
                onChange={(e) => onChange('processorType', e.target.value)}
              >
                <FormControlLabel
                  value="graviton3"
                  control={<Radio />}
                  label={
                    <Box>
                      AWS Graviton3 (ARM)
                      <Chip 
                        label="Recommended" 
                        size="small" 
                        color="success" 
                        sx={{ ml: 1 }} 
                      />
                    </Box>
                  }
                />
                <FormControlLabel
                  value="graviton4"
                  control={<Radio />}
                  label="AWS Graviton4 (ARM)"
                />
                <FormControlLabel
                  value="intel"
                  control={<Radio />}
                  label="Intel x86"
                />
                <FormControlLabel
                  value="amd"
                  control={<Radio />}
                  label="AMD x86"
                />
              </RadioGroup>
            </FormControl>
            
            <Box sx={{ mt: 2 }}>
              {formValues.processorType === 'graviton3' && (
                <Typography variant="body2" color="text.secondary">
                  AWS Graviton3 processors offer excellent performance for GEOS-Chem with better cost-efficiency
                  than x86 alternatives. Recommended for most simulations.
                </Typography>
              )}
              {formValues.processorType === 'graviton4' && (
                <Typography variant="body2" color="text.secondary">
                  AWS Graviton4 processors are the newest ARM-based processors with improved performance,
                  but at a higher cost than Graviton3.
                </Typography>
              )}
              {formValues.processorType === 'intel' && (
                <Typography variant="body2" color="text.secondary">
                  Intel x86 processors are compatible with all GEOS-Chem configurations and have
                  been thoroughly tested, but are generally more expensive than Graviton alternatives.
                </Typography>
              )}
              {formValues.processorType === 'amd' && (
                <Typography variant="body2" color="text.secondary">
                  AMD x86 processors offer a balance of performance and cost, but may not be available
                  in all instance sizes or regions.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
        
        {/* Instance Size Selection */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <SpeedIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Instance Size</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <FormLabel component="legend">Select Instance Size</FormLabel>
              <RadioGroup
                name="instance-size"
                value={formValues.instanceSize}
                onChange={(e) => onChange('instanceSize', e.target.value)}
              >
                <FormControlLabel
                  value="small"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                      <Typography>Small (4 vCPUs)</Typography>
                      <Typography color="text.secondary">
                        {formValues.processorType === 'graviton3' && '$0.68/hour'}
                        {formValues.processorType === 'graviton4' && '$0.76/hour'}
                        {formValues.processorType === 'intel' && '$0.70/hour'}
                        {formValues.processorType === 'amd' && '$0.67/hour'}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="medium"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                      <Typography>Medium (8 vCPUs)</Typography>
                      <Typography color="text.secondary">
                        {formValues.processorType === 'graviton3' && '$1.36/hour'}
                        {formValues.processorType === 'graviton4' && '$1.52/hour'}
                        {formValues.processorType === 'intel' && '$1.40/hour'}
                        {formValues.processorType === 'amd' && '$1.34/hour'}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="large"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                      <Typography>Large (16 vCPUs)</Typography>
                      <Typography color="text.secondary">
                        {formValues.processorType === 'graviton3' && '$2.72/hour'}
                        {formValues.processorType === 'graviton4' && '$3.04/hour'}
                        {formValues.processorType === 'intel' && '$2.80/hour'}
                        {formValues.processorType === 'amd' && '$2.68/hour'}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="xlarge"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                      <Typography>X-Large (32 vCPUs)</Typography>
                      <Typography color="text.secondary">
                        {formValues.processorType === 'graviton3' && '$5.44/hour'}
                        {formValues.processorType === 'graviton4' && '$6.08/hour'}
                        {formValues.processorType === 'intel' && '$5.60/hour'}
                        {formValues.processorType === 'amd' && '$5.36/hour'}
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
            
            {/* Recommendations based on simulation type */}
            <Box sx={{ mt: 2 }}>
              {formValues.simulationType === 'GC_CLASSIC' && (
                <Typography variant="body2" color="text.secondary">
                  {formValues.resolution === '4x5' && 'For 4°×5° simulations, Small (4 vCPUs) is typically sufficient.'}
                  {formValues.resolution === '2x2.5' && 'For 2°×2.5° simulations, Medium (8 vCPUs) is recommended.'}
                  {(formValues.resolution === '0.5x0.625' || formValues.resolution === '0.25x0.3125') && 
                    'For high-resolution nested simulations, Large (16 vCPUs) or X-Large (32 vCPUs) is recommended.'}
                </Typography>
              )}
              
              {formValues.simulationType === 'GCHP' && (
                <Typography variant="body2" color="text.secondary">
                  {(formValues.cubedsphereRes === 'C24' || formValues.cubedsphereRes === 'C48') && 
                    'For C24-C48 resolutions, Medium (8 vCPUs) is recommended.'}
                  {formValues.cubedsphereRes === 'C90' && 
                    'For C90 resolution, Large (16 vCPUs) is recommended.'}
                  {(formValues.cubedsphereRes === 'C180' || formValues.cubedsphereRes === 'C360') && 
                    'For C180-C360 resolutions, X-Large (32 vCPUs) is strongly recommended.'}
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
        
        {/* Memory and Optimization */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <MoneyIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Optimization Options</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            {/* Memory Option */}
            <FormControl component="fieldset" sx={{ width: '100%', mb: 3 }}>
              <FormLabel component="legend">Memory Configuration</FormLabel>
              <RadioGroup
                row
                name="memory-option"
                value={formValues.memory}
                onChange={(e) => onChange('memory', e.target.value)}
              >
                <FormControlLabel
                  value="standard"
                  control={<Radio />}
                  label="Standard Memory"
                />
                <FormControlLabel
                  value="high"
                  control={<Radio />}
                  label="High Memory"
                />
              </RadioGroup>
              
              {isHighMemoryRecommended() && formValues.memory === 'standard' && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  High memory is recommended for your selected configuration.
                </Alert>
              )}
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {formValues.memory === 'standard' ? 
                  'Standard memory is sufficient for most simulations.' : 
                  'High memory instances cost ~40% more but can be necessary for high-resolution or complex chemistry.'}
              </Typography>
            </FormControl>
            
            {/* Spot Instance Option */}
            <FormControl component="fieldset" sx={{ width: '100%', mb: 2 }}>
              <FormLabel component="legend">Cost Optimization</FormLabel>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={formValues.useSpot} 
                      onChange={handleSpotToggle}
                      color="primary"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      Use Spot Instances (save ~70%)
                      <Tooltip title="Spot instances are unused EC2 capacity available at a discount. They may be interrupted with a 2-minute warning if AWS needs the capacity back. Recommended for most research simulations.">
                        <IconButton size="small" sx={{ ml: 0.5 }}>
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                />
              </FormGroup>
            </FormControl>
            
            <Box sx={{ mt: 1 }}>
              {formValues.useSpot ? (
                <Alert severity="info">
                  Spot instances can reduce your costs by ~70%. Your simulation will be automatically checkpointed
                  every hour to minimize data loss in case of interruption.
                </Alert>
              ) : (
                <Alert severity="info">
                  On-demand instances are guaranteed not to be interrupted, but cost significantly more.
                  Only recommended for time-critical or production workloads.
                </Alert>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ComputeResourcesStep;