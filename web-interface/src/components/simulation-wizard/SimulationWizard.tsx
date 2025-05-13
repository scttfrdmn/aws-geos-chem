import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { createSimulation, estimateSimulationCost } from '../../store/slices/simulationsSlice';
import { addAlert } from '../../store/slices/uiSlice';

// MUI Components
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';

// Wizard Step Components
import SimulationTypeStep from './steps/SimulationTypeStep';
import ScientificConfigStep from './steps/ScientificConfigStep';
import DomainResolutionStep from './steps/DomainResolutionStep';
import TimeConfigStep from './steps/TimeConfigStep';
import ComputeResourcesStep from './steps/ComputeResourcesStep';
import CostEstimationStep from './steps/CostEstimationStep';
import AdditionalOptionsStep from './steps/AdditionalOptionsStep';
import ReviewSubmitStep from './steps/ReviewSubmitStep';

// Icons
import {
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  Save as SaveIcon,
  Send as SubmitIcon
} from '@mui/icons-material';

// Default form values
const initialFormValues = {
  // Step 1: Simulation Type
  simulationType: 'GC_CLASSIC', // or 'GCHP'
  
  // Step 2: Scientific Configuration
  chemistryOption: 'fullchem', // or 'aerosol', 'CH4', 'CO2', 'transport'
  emissionsOption: 'standard', // or 'custom'
  hemcoOption: 'standard', // or 'custom'
  
  // Step 3: Domain and Resolution
  domain: 'global', // or 'nested'
  resolution: '4x5', // or '2x2.5', 'custom' for GC Classic
  nestedRegion: '', // 'asia', 'namerica', 'europe', 'custom' (if domain is 'nested')
  cubedsphereRes: '', // 'C24', 'C48', 'C90', 'C180', 'C360' (if simulationType is 'GCHP')
  
  // Step 4: Time Configuration
  startDate: '',
  endDate: '',
  outputFrequency: 'hourly', // or 'daily', 'monthly'
  restartOption: 'none', // or 'initial', 'custom'
  spinupDays: 0,
  
  // Step 5: Computing Resources
  processorType: 'graviton3', // or 'graviton4', 'intel', 'amd'
  instanceSize: 'medium', // or 'small', 'large', 'xlarge'
  memory: 'standard', // or 'high'
  useSpot: true,
  
  // Step 6: Cost Estimation (read-only)
  estimatedCost: 0,
  estimatedRuntime: 0,
  
  // Step 7: Additional Options
  outputDiagnostics: [],
  postProcessing: [],
  notifications: {
    email: true,
    completion: true,
    error: true
  },
  
  // Step 8: Review and Submit (no additional fields)
  name: '',
  description: ''
};

// Define steps
const steps = [
  'Simulation Type',
  'Scientific Configuration',
  'Domain & Resolution',
  'Time Configuration',
  'Computing Resources',
  'Cost Estimation',
  'Additional Options',
  'Review & Submit'
];

const SimulationWizard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  // State from Redux
  const { loading, error, currentSimulation } = useSelector(
    (state: RootState) => state.simulations
  );
  
  // Local state
  const [activeStep, setActiveStep] = useState(0);
  const [formValues, setFormValues] = useState(initialFormValues);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Handle form values change
  const handleFormChange = (field: string, value: any) => {
    setFormValues((prevValues) => ({
      ...prevValues,
      [field]: value
    }));
    
    // Clear errors when form values change
    setLocalError(null);
  };
  
  // Handle next step
  const handleNext = async () => {
    // Validate current step
    const isValid = validateCurrentStep();
    if (!isValid) return;
    
    // If moving to cost estimation step, request cost estimate
    if (activeStep === 4) {
      try {
        // Dispatch action to estimate cost
        const configForEstimation = {
          simulationType: formValues.simulationType,
          domain: formValues.domain,
          resolution: formValues.resolution,
          cubedsphereRes: formValues.cubedsphereRes,
          timeConfig: {
            startDate: formValues.startDate,
            endDate: formValues.endDate,
            outputFrequency: formValues.outputFrequency
          },
          computeConfig: {
            processorType: formValues.processorType,
            instanceSize: formValues.instanceSize,
            memory: formValues.memory,
            useSpot: formValues.useSpot
          }
        };
        
        const resultAction = await dispatch(estimateSimulationCost(configForEstimation));
        if (estimateSimulationCost.fulfilled.match(resultAction)) {
          const { estimatedCost, estimatedRuntime } = resultAction.payload;
          setFormValues((prev) => ({
            ...prev,
            estimatedCost,
            estimatedRuntime
          }));
        }
      } catch (err) {
        console.error('Error estimating cost:', err);
        setLocalError('Failed to estimate cost. Please try again.');
        return;
      }
    }
    
    setActiveStep((prevStep) => prevStep + 1);
  };
  
  // Handle back step
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };
  
  // Handle reset
  const handleReset = () => {
    setFormValues(initialFormValues);
    setActiveStep(0);
    setLocalError(null);
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    try {
      // Create simulation config object from form values
      const simulationConfig = {
        name: formValues.name,
        description: formValues.description,
        config: {
          simulationType: formValues.simulationType,
          chemistryOption: formValues.chemistryOption,
          emissionsOption: formValues.emissionsOption,
          hemcoOption: formValues.hemcoOption,
          domain: formValues.domain,
          resolution: formValues.resolution,
          nestedRegion: formValues.nestedRegion,
          cubedsphereRes: formValues.cubedsphereRes,
          timeConfig: {
            startDate: formValues.startDate,
            endDate: formValues.endDate,
            outputFrequency: formValues.outputFrequency,
            restartOption: formValues.restartOption,
            spinupDays: formValues.spinupDays
          },
          computeConfig: {
            processorType: formValues.processorType,
            instanceSize: formValues.instanceSize,
            memory: formValues.memory,
            useSpot: formValues.useSpot
          },
          outputDiagnostics: formValues.outputDiagnostics,
          postProcessing: formValues.postProcessing,
          notifications: formValues.notifications
        },
        estimatedCost: formValues.estimatedCost,
        estimatedRuntime: formValues.estimatedRuntime
      };
      
      // Dispatch action to create simulation
      const resultAction = await dispatch(createSimulation(simulationConfig));
      
      if (createSimulation.fulfilled.match(resultAction)) {
        // Show success notification
        dispatch(addAlert({
          type: 'success',
          message: 'Simulation created successfully!',
          autoHideDuration: 6000
        }));
        
        // Navigate to the simulation detail page
        navigate(`/simulations/${resultAction.payload.simulationId}`);
      }
    } catch (err) {
      console.error('Error creating simulation:', err);
      setLocalError('Failed to create simulation. Please try again.');
    }
  };
  
  // Validate current step
  const validateCurrentStep = (): boolean => {
    switch (activeStep) {
      case 0: // Simulation Type
        if (!formValues.simulationType) {
          setLocalError('Please select a simulation type.');
          return false;
        }
        break;
      case 1: // Scientific Configuration
        if (!formValues.chemistryOption) {
          setLocalError('Please select a chemistry option.');
          return false;
        }
        break;
      case 2: // Domain & Resolution
        if (formValues.simulationType === 'GC_CLASSIC') {
          if (!formValues.domain || !formValues.resolution) {
            setLocalError('Please specify domain and resolution.');
            return false;
          }
          if (formValues.domain === 'nested' && !formValues.nestedRegion) {
            setLocalError('Please select a nested region.');
            return false;
          }
        } else if (formValues.simulationType === 'GCHP') {
          if (!formValues.cubedsphereRes) {
            setLocalError('Please select a cubed-sphere resolution.');
            return false;
          }
        }
        break;
      case 3: // Time Configuration
        if (!formValues.startDate || !formValues.endDate) {
          setLocalError('Please specify start and end dates.');
          return false;
        }
        break;
      case 4: // Computing Resources
        if (!formValues.processorType || !formValues.instanceSize) {
          setLocalError('Please specify processor type and instance size.');
          return false;
        }
        break;
      case 7: // Review & Submit
        if (!formValues.name) {
          setLocalError('Please provide a name for the simulation.');
          return false;
        }
        break;
      default:
        break;
    }
    return true;
  };
  
  // Render step content
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <SimulationTypeStep 
            formValues={formValues} 
            onChange={handleFormChange} 
          />
        );
      case 1:
        return (
          <ScientificConfigStep 
            formValues={formValues} 
            onChange={handleFormChange} 
          />
        );
      case 2:
        return (
          <DomainResolutionStep 
            formValues={formValues} 
            onChange={handleFormChange} 
          />
        );
      case 3:
        return (
          <TimeConfigStep 
            formValues={formValues} 
            onChange={handleFormChange} 
          />
        );
      case 4:
        return (
          <ComputeResourcesStep 
            formValues={formValues} 
            onChange={handleFormChange} 
          />
        );
      case 5:
        return (
          <CostEstimationStep 
            formValues={formValues} 
            onChange={handleFormChange} 
          />
        );
      case 6:
        return (
          <AdditionalOptionsStep 
            formValues={formValues} 
            onChange={handleFormChange} 
          />
        );
      case 7:
        return (
          <ReviewSubmitStep 
            formValues={formValues} 
            onChange={handleFormChange} 
          />
        );
      default:
        return 'Unknown step';
    }
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          New Simulation
        </Typography>
        
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {(error || localError) && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error || localError}
          </Alert>
        )}
        
        <Box sx={{ mt: 2, mb: 4 }}>
          {getStepContent(activeStep)}
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
          <Button
            color="inherit"
            disabled={activeStep === 0 || loading}
            onClick={handleBack}
            startIcon={<BackIcon />}
          >
            Back
          </Button>
          
          <Box>
            <Button
              color="primary"
              variant="outlined"
              onClick={handleReset}
              sx={{ mr: 1 }}
              disabled={loading}
            >
              Reset
            </Button>
            
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                startIcon={loading ? <CircularProgress size={20} /> : <SubmitIcon />}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit Simulation'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={handleNext}
                endIcon={<NextIcon />}
                disabled={loading}
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default SimulationWizard;