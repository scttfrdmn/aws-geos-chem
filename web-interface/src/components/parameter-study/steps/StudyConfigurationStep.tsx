import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Grid,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  FormControlLabel,
  Slider,
  Tooltip,
  IconButton,
  Divider,
  Alert,
  Paper
} from '@mui/material';
import {
  Science as ScienceIcon,
  Tune as TuneIcon,
  Search as SearchIcon,
  Speed as SpeedIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

interface StudyConfigStepProps {
  studyConfig: {
    name: string;
    description: string;
    studyType: 'sensitivity' | 'optimization' | 'exploration';
    baseSimulationId: string;
    maxSimulations: number;
    samplingMethod: 'grid' | 'random' | 'latin-hypercube' | 'sobol';
  };
  onConfigChange: (config: any) => void;
}

const StudyConfigurationStep: React.FC<StudyConfigStepProps> = ({
  studyConfig,
  onConfigChange
}) => {
  const simulations = useSelector((state: RootState) => state.simulations.simulations);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const handleChange = (field: string, value: any) => {
    onConfigChange({
      ...studyConfig,
      [field]: value
    });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    handleChange(name, value);
  };
  
  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      handleChange(name, numValue);
    }
  };
  
  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    handleChange(name, value);
  };
  
  const getStudyTypeDescription = () => {
    switch (studyConfig.studyType) {
      case 'sensitivity':
        return 'Evaluate how model outputs change when varying input parameters to identify which parameters have the largest impact.';
      case 'optimization':
        return 'Find parameter values that optimize (maximize or minimize) specific model outputs or objective functions.';
      case 'exploration':
        return 'Broadly explore parameter space to understand model behavior across a wide range of parameter values.';
      default:
        return '';
    }
  };
  
  const getSamplingMethodDescription = () => {
    switch (studyConfig.samplingMethod) {
      case 'grid':
        return 'Systematically sample at regular intervals across parameter ranges. Best for fewer parameters with well-defined ranges.';
      case 'random':
        return 'Randomly sample parameter values within their ranges. Simple but may have clustering or gaps.';
      case 'latin-hypercube':
        return 'Advanced sampling that ensures even coverage of parameter space. Good balance between efficiency and coverage.';
      case 'sobol':
        return 'Quasi-random sequence that provides excellent space-filling properties. Best for complex models with many parameters.';
      default:
        return '';
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Study Configuration
      </Typography>
      <Typography variant="body1" paragraph>
        Configure the basic parameters for your study. This will determine how parameter values are sampled and which simulations are run.
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            required
            label="Study Name"
            name="name"
            value={studyConfig.name}
            onChange={handleInputChange}
            helperText="Enter a descriptive name for your parameter study"
            sx={{ mb: 3 }}
            error={studyConfig.name.trim() === ''}
          />
          
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={studyConfig.description}
            onChange={handleInputChange}
            multiline
            rows={3}
            helperText="Describe the purpose and goals of this parameter study"
            sx={{ mb: 3 }}
          />
          
          <FormControl fullWidth sx={{ mb: 3 }} required>
            <InputLabel id="base-simulation-label">Base Simulation</InputLabel>
            <Select
              labelId="base-simulation-label"
              name="baseSimulationId"
              value={studyConfig.baseSimulationId}
              onChange={handleSelectChange}
              label="Base Simulation"
              error={studyConfig.baseSimulationId === ''}
            >
              {simulations.map((sim) => (
                <MenuItem key={sim.id} value={sim.id}>
                  {sim.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Select a simulation to use as the base configuration for parameter variations
            </FormHelperText>
          </FormControl>
          
          <TextField
            fullWidth
            required
            type="number"
            label="Maximum Simulations"
            name="maxSimulations"
            value={studyConfig.maxSimulations}
            onChange={handleNumberInputChange}
            inputProps={{ min: 1, max: 100 }}
            helperText="Maximum number of simulations to run in this study"
            sx={{ mb: 3 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Study Type
            </Typography>
            
            <RadioGroup
              name="studyType"
              value={studyConfig.studyType}
              onChange={(e) => handleChange('studyType', e.target.value)}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                  <FormControlLabel
                    value="sensitivity"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle2">Sensitivity Analysis</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Identify which parameters have the largest impact on model outputs
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%' }}
                  />
                </Paper>
                
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                  <FormControlLabel
                    value="optimization"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle2">Parameter Optimization</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Find parameter values that optimize specific model outputs
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%' }}
                  />
                </Paper>
                
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                  <FormControlLabel
                    value="exploration"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle2">Parameter Space Exploration</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Broadly explore parameter space to understand model behavior
                        </Typography>
                      </Box>
                    }
                    sx={{ width: '100%' }}
                  />
                </Paper>
              </Box>
            </RadioGroup>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {getStudyTypeDescription()}
            </Typography>
          </Paper>
          
          <Paper elevation={0} variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Sampling Method
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="sampling-method-label">Sampling Method</InputLabel>
              <Select
                labelId="sampling-method-label"
                name="samplingMethod"
                value={studyConfig.samplingMethod}
                onChange={handleSelectChange}
                label="Sampling Method"
              >
                <MenuItem value="grid">Grid Sampling</MenuItem>
                <MenuItem value="random">Random Sampling</MenuItem>
                <MenuItem value="latin-hypercube">Latin Hypercube Sampling</MenuItem>
                <MenuItem value="sobol">Sobol Sequence</MenuItem>
              </Select>
            </FormControl>
            
            <Typography variant="body2" color="text.secondary">
              {getSamplingMethodDescription()}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      
      {!studyConfig.baseSimulationId && (
        <Alert severity="info" sx={{ mt: 3 }}>
          You must select a base simulation to continue. The base simulation provides the default values for all parameters that won't be varied in the study.
        </Alert>
      )}
    </Box>
  );
};

export default StudyConfigurationStep;