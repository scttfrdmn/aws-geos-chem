import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  IconButton,
  Divider,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { createBatchSimulations } from '../../store/slices/batchSlice';

import BatchTemplateStep from './steps/BatchTemplateStep';
import BatchParametersStep from './steps/BatchParametersStep';
import BatchComputeStep from './steps/BatchComputeStep';
import BatchReviewStep from './steps/BatchReviewStep';

const steps = [
  'Select Template',
  'Configure Parameters',
  'Compute Resources',
  'Review & Submit'
];

const BatchProcessing: React.FC = () => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.batch);
  
  const [activeStep, setActiveStep] = useState(0);
  const [batchName, setBatchName] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [parameters, setParameters] = useState<Array<{
    name: string;
    values: any[];
    description?: string;
  }>>([]);
  const [computeConfig, setComputeConfig] = useState({
    instanceType: 'c5.2xlarge',
    maxConcurrentJobs: 5,
    maxTotalJobs: 20,
    priority: 'medium' as 'low' | 'medium' | 'high',
    maxBudget: 100,
    useSpot: true
  });
  
  // Calculate total simulations based on parameter combinations
  const calculateTotalSimulations = () => {
    if (parameters.length === 0) return 0;
    
    return parameters.reduce((total, param) => {
      return total * param.values.length;
    }, 1);
  };
  
  const totalSimulations = calculateTotalSimulations();
  
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const validateCurrentStep = () => {
    switch (activeStep) {
      case 0: // Template selection
        return !!templateId;
      case 1: // Parameters configuration
        return parameters.length > 0 && parameters.every(p => p.name && p.values.length > 0);
      case 2: // Compute configuration
        return computeConfig.instanceType && 
               computeConfig.maxConcurrentJobs > 0 && 
               computeConfig.maxTotalJobs >= totalSimulations &&
               computeConfig.maxBudget > 0;
      case 3: // Review
        return batchName.trim().length > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    
    // Create batch configuration object
    const batchConfig = {
      name: batchName,
      description: batchDescription,
      templateId,
      parameters,
      computeConfig,
      totalSimulations
    };
    
    // Dispatch action to create batch simulations
    dispatch(createBatchSimulations(batchConfig));
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <BatchTemplateStep 
            selectedTemplateId={templateId} 
            onSelectTemplate={setTemplateId}
          />
        );
      case 1:
        return (
          <BatchParametersStep 
            parameters={parameters}
            onParametersChange={setParameters}
            templateId={templateId}
          />
        );
      case 2:
        return (
          <BatchComputeStep 
            computeConfig={computeConfig}
            onComputeConfigChange={setComputeConfig}
            totalSimulations={totalSimulations}
          />
        );
      case 3:
        return (
          <BatchReviewStep 
            batchName={batchName}
            batchDescription={batchDescription}
            onNameChange={setBatchName}
            onDescriptionChange={setBatchDescription}
            templateId={templateId}
            parameters={parameters}
            computeConfig={computeConfig}
            totalSimulations={totalSimulations}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Paper 
        elevation={0} 
        variant="outlined" 
        sx={{ p: 3, mb: 3, borderRadius: 2 }}
      >
        <Typography variant="h5" gutterBottom>
          Batch Processing
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Run multiple GEOS-Chem simulations with varying parameters to explore scientific questions efficiently.
        </Typography>
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
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={!validateCurrentStep() || loading}
            >
              {loading ? 'Creating...' : 'Create Batch'}
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

export default BatchProcessing;