import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stepper,
  Step,
  StepLabel,
  Button,
  IconButton,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Save as SaveIcon,
  Science as ScienceIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { createParameterStudy } from '../../store/slices/parameterStudySlice';

// Step components
import StudyConfigurationStep from './steps/StudyConfigurationStep';
import ParameterSelectionStep from './steps/ParameterSelectionStep';
import OutputAnalysisStep from './steps/OutputAnalysisStep';
import ReviewSubmitStep from './steps/ReviewSubmitStep';

const steps = [
  'Study Configuration',
  'Parameter Selection',
  'Output Analysis',
  'Review & Submit'
];

const ParameterStudy: React.FC = () => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.parameterStudy);
  
  const [activeStep, setActiveStep] = useState(0);
  
  // State for study configuration
  const [studyConfig, setStudyConfig] = useState({
    name: '',
    description: '',
    studyType: 'sensitivity' as 'sensitivity' | 'optimization' | 'exploration',
    baseSimulationId: '',
    maxSimulations: 20,
    samplingMethod: 'grid' as 'grid' | 'random' | 'latin-hypercube' | 'sobol'
  });
  
  // State for parameters
  const [parameters, setParameters] = useState<Array<{
    name: string;
    path: string;
    range: [number, number] | string[];
    type: 'continuous' | 'discrete' | 'categorical';
    samplingPoints: number;
    distribution?: 'uniform' | 'normal' | 'log-normal';
    mean?: number;
    stdDev?: number;
    importance?: number;
  }>>([]);
  
  // State for output analysis configuration
  const [outputConfig, setOutputConfig] = useState({
    outputVariables: [] as string[],
    analysisMetrics: [] as string[],
    visualizationTypes: [] as string[],
    postProcessingScripts: [] as string[]
  });
  
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  
  const validateCurrentStep = () => {
    switch (activeStep) {
      case 0: // Study configuration
        return (
          studyConfig.name.trim() !== '' &&
          studyConfig.baseSimulationId !== '' &&
          studyConfig.maxSimulations > 0
        );
      case 1: // Parameter selection
        return parameters.length > 0 && parameters.every(p => 
          p.name && 
          (Array.isArray(p.range) && p.range.length > 0) &&
          (p.type === 'continuous' ? p.samplingPoints > 1 : true)
        );
      case 2: // Output analysis
        return outputConfig.outputVariables.length > 0;
      case 3: // Review
        return true;
      default:
        return false;
    }
  };
  
  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    
    // Create parameter study configuration
    const studyData = {
      ...studyConfig,
      parameters,
      outputConfig
    };
    
    // Dispatch action to create parameter study
    await dispatch(createParameterStudy(studyData));
  };
  
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <StudyConfigurationStep 
            studyConfig={studyConfig}
            onConfigChange={setStudyConfig}
          />
        );
      case 1:
        return (
          <ParameterSelectionStep 
            parameters={parameters}
            onParametersChange={setParameters}
            baseSimulationId={studyConfig.baseSimulationId}
            studyType={studyConfig.studyType}
            samplingMethod={studyConfig.samplingMethod}
          />
        );
      case 2:
        return (
          <OutputAnalysisStep 
            outputConfig={outputConfig}
            onOutputConfigChange={setOutputConfig}
            baseSimulationId={studyConfig.baseSimulationId}
            parameters={parameters}
          />
        );
      case 3:
        return (
          <ReviewSubmitStep 
            studyConfig={studyConfig}
            parameters={parameters}
            outputConfig={outputConfig}
          />
        );
      default:
        return null;
    }
  };
  
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
  
  return (
    <Box>
      <Paper 
        elevation={0} 
        variant="outlined" 
        sx={{ p: 3, mb: 3, borderRadius: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ScienceIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" gutterBottom>
              Parameter Study
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Design and run a systematic study to understand parameter sensitivity and explore model behavior.
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        {renderStepContent()}
      </Paper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Total simulations to be generated: <strong>{totalSimulations}</strong>
          {totalSimulations > studyConfig.maxSimulations && (
            <Typography component="span" color="error.main">
              {' '}(exceeds maximum of {studyConfig.maxSimulations})
            </Typography>
          )}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          disabled={activeStep === 0 || loading}
        >
          Back
        </Button>
        
        <Box>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSubmit}
              disabled={!validateCurrentStep() || loading}
            >
              {loading ? 'Creating...' : 'Create Parameter Study'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              endIcon={<ArrowForwardIcon />}
              onClick={handleNext}
              disabled={!validateCurrentStep()}
            >
              Next
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ParameterStudy;