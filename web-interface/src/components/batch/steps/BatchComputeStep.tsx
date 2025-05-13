import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  TextField,
  Slider,
  FormControl,
  FormControlLabel,
  Switch,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  FormHelperText,
  Divider,
  Alert,
  Card,
  CardContent,
  Stack
} from '@mui/material';
import {
  InfoOutlined as InfoIcon,
  SavingsOutlined as SavingsIcon,
  SpeedOutlined as SpeedIcon,
  ScheduleOutlined as ScheduleIcon
} from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material';

interface ComputeConfig {
  instanceType: string;
  maxConcurrentJobs: number;
  maxTotalJobs: number;
  priority: 'low' | 'medium' | 'high';
  maxBudget: number;
  useSpot: boolean;
}

interface BatchComputeStepProps {
  computeConfig: ComputeConfig;
  onComputeConfigChange: (config: ComputeConfig) => void;
  totalSimulations: number;
}

// Instance type options with pricing information
interface InstanceOption {
  value: string;
  label: string;
  vcpu: number;
  memory: number;
  priceOnDemand: number;
  priceSpot: number;
  description: string;
}

const instanceOptions: InstanceOption[] = [
  {
    value: 'c5.large',
    label: 'c5.large',
    vcpu: 2,
    memory: 4,
    priceOnDemand: 0.085,
    priceSpot: 0.027,
    description: 'Compute optimized, 2 vCPU, 4 GiB RAM'
  },
  {
    value: 'c5.xlarge',
    label: 'c5.xlarge',
    vcpu: 4,
    memory: 8,
    priceOnDemand: 0.17,
    priceSpot: 0.054,
    description: 'Compute optimized, 4 vCPU, 8 GiB RAM'
  },
  {
    value: 'c5.2xlarge',
    label: 'c5.2xlarge',
    vcpu: 8,
    memory: 16,
    priceOnDemand: 0.34,
    priceSpot: 0.109,
    description: 'Compute optimized, 8 vCPU, 16 GiB RAM'
  },
  {
    value: 'c5.4xlarge',
    label: 'c5.4xlarge',
    vcpu: 16,
    memory: 32,
    priceOnDemand: 0.68,
    priceSpot: 0.218,
    description: 'Compute optimized, 16 vCPU, 32 GiB RAM'
  },
  {
    value: 'c5.9xlarge',
    label: 'c5.9xlarge',
    vcpu: 36,
    memory: 72,
    priceOnDemand: 1.53,
    priceSpot: 0.490,
    description: 'Compute optimized, 36 vCPU, 72 GiB RAM'
  },
  {
    value: 'r5.xlarge',
    label: 'r5.xlarge',
    vcpu: 4,
    memory: 32,
    priceOnDemand: 0.252,
    priceSpot: 0.081,
    description: 'Memory optimized, 4 vCPU, 32 GiB RAM'
  },
  {
    value: 'r5.2xlarge',
    label: 'r5.2xlarge',
    vcpu: 8,
    memory: 64,
    priceOnDemand: 0.504,
    priceSpot: 0.161,
    description: 'Memory optimized, 8 vCPU, 64 GiB RAM'
  }
];

const BatchComputeStep: React.FC<BatchComputeStepProps> = ({
  computeConfig,
  onComputeConfigChange,
  totalSimulations
}) => {
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  
  // Helper function to find instance option by value
  const findInstanceOption = (value: string): InstanceOption => {
    return instanceOptions.find(option => option.value === value) || instanceOptions[0];
  };
  
  // Calculate estimated cost and time
  useEffect(() => {
    calculateEstimates();
  }, [computeConfig, totalSimulations]);
  
  const calculateEstimates = () => {
    if (totalSimulations === 0) {
      setEstimatedCost(0);
      setEstimatedTime(0);
      return;
    }
    
    const instanceOption = findInstanceOption(computeConfig.instanceType);
    const hourlyPrice = computeConfig.useSpot ? instanceOption.priceSpot : instanceOption.priceOnDemand;
    
    // Assume average GEOS-Chem simulation time based on instance type
    // This would be more accurate with real benchmarks
    const avgSimulationTimeHours = 24 / instanceOption.vcpu; // Rough estimate
    
    // Calculate total time and cost
    const concurrentJobs = Math.min(computeConfig.maxConcurrentJobs, totalSimulations);
    const totalTimeHours = (totalSimulations / concurrentJobs) * avgSimulationTimeHours;
    const totalCost = totalTimeHours * hourlyPrice * concurrentJobs;
    
    setEstimatedTime(totalTimeHours);
    setEstimatedCost(totalCost);
  };
  
  const handleInstanceTypeChange = (event: SelectChangeEvent<string>) => {
    const newInstanceType = event.target.value;
    onComputeConfigChange({
      ...computeConfig,
      instanceType: newInstanceType
    });
  };
  
  const handleConcurrentJobsChange = (event: Event, value: number | number[]) => {
    onComputeConfigChange({
      ...computeConfig,
      maxConcurrentJobs: value as number
    });
  };
  
  const handleMaxJobsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value);
    if (!isNaN(newValue) && newValue >= 0) {
      onComputeConfigChange({
        ...computeConfig,
        maxTotalJobs: newValue
      });
    }
  };
  
  const handlePriorityChange = (event: SelectChangeEvent<string>) => {
    onComputeConfigChange({
      ...computeConfig,
      priority: event.target.value as 'low' | 'medium' | 'high'
    });
  };
  
  const handleBudgetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    if (!isNaN(newValue) && newValue >= 0) {
      onComputeConfigChange({
        ...computeConfig,
        maxBudget: newValue
      });
    }
  };
  
  const handleSpotChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onComputeConfigChange({
      ...computeConfig,
      useSpot: event.target.checked
    });
  };
  
  const formatTime = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} minutes`;
    } else if (hours < 24) {
      return `${Math.round(hours * 10) / 10} hours`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round((hours % 24) * 10) / 10;
      return `${days} days ${remainingHours > 0 ? `${remainingHours} hours` : ''}`;
    }
  };
  
  // Get the current instance option
  const currentInstance = findInstanceOption(computeConfig.instanceType);
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Compute Resources
      </Typography>
      <Typography variant="body1" paragraph>
        Configure the computing resources for your batch of simulations. These settings will affect cost, performance, and total runtime.
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>
              Resource Configuration
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="instance-type-label">Instance Type</InputLabel>
              <Select
                labelId="instance-type-label"
                value={computeConfig.instanceType}
                label="Instance Type"
                onChange={handleInstanceTypeChange}
              >
                {instanceOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box>
                      <Typography variant="body1">{option.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Selected: {currentInstance.vcpu} vCPU, {currentInstance.memory} GiB RAM
              </FormHelperText>
            </FormControl>
            
            <Box sx={{ mb: 3 }}>
              <Typography id="concurrent-jobs-slider" gutterBottom>
                Maximum Concurrent Jobs: {computeConfig.maxConcurrentJobs}
              </Typography>
              <Slider
                value={computeConfig.maxConcurrentJobs}
                onChange={handleConcurrentJobsChange}
                aria-labelledby="concurrent-jobs-slider"
                min={1}
                max={20}
                marks={[
                  { value: 1, label: '1' },
                  { value: 5, label: '5' },
                  { value: 10, label: '10' },
                  { value: 20, label: '20' }
                ]}
              />
              <FormHelperText>
                Determines how many simulations will run in parallel
              </FormHelperText>
            </Box>
            
            <TextField
              label="Maximum Total Jobs"
              type="number"
              fullWidth
              value={computeConfig.maxTotalJobs}
              onChange={handleMaxJobsChange}
              helperText={`Should be at least ${totalSimulations} to run all parameter combinations`}
              sx={{ mb: 3 }}
              error={computeConfig.maxTotalJobs < totalSimulations}
            />
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="priority-label">Batch Priority</InputLabel>
              <Select
                labelId="priority-label"
                value={computeConfig.priority}
                label="Batch Priority"
                onChange={handlePriorityChange}
              >
                <MenuItem value="low">Low (Cost-effective)</MenuItem>
                <MenuItem value="medium">Medium (Balanced)</MenuItem>
                <MenuItem value="high">High (Faster results)</MenuItem>
              </Select>
              <FormHelperText>
                Affects job scheduling and resource allocation
              </FormHelperText>
            </FormControl>
            
            <TextField
              label="Maximum Budget (USD)"
              type="number"
              fullWidth
              value={computeConfig.maxBudget}
              onChange={handleBudgetChange}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
              }}
              helperText="The batch will be terminated if cost exceeds this limit"
              sx={{ mb: 3 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={computeConfig.useSpot}
                  onChange={handleSpotChange}
                />
              }
              label="Use Spot Instances"
              sx={{ mb: 1 }}
            />
            <FormHelperText>
              Spot instances are up to 70% cheaper but may be interrupted. Recommended for non-critical workloads.
            </FormHelperText>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={5}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Cost Estimation
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <SavingsIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" color="primary">
                    ${estimatedCost.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Estimated total cost
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2">
                <strong>Hourly rate:</strong> ${computeConfig.useSpot ? currentInstance.priceSpot : currentInstance.priceOnDemand} per instance
              </Typography>
              <Typography variant="body2">
                <strong>Instance savings:</strong> {computeConfig.useSpot ? 'Up to 70% with Spot instances' : 'None (using On-Demand)'}
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Time Estimation
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <ScheduleIcon color="info" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h5" color="info.main">
                    {formatTime(estimatedTime)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Estimated completion time
                  </Typography>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2">
                <strong>Simulations:</strong> {totalSimulations} total
              </Typography>
              <Typography variant="body2">
                <strong>Parallel execution:</strong> {computeConfig.maxConcurrentJobs} concurrent jobs
              </Typography>
            </Paper>
            
            {computeConfig.maxTotalJobs < totalSimulations && (
              <Alert severity="warning">
                Maximum jobs limit ({computeConfig.maxTotalJobs}) is less than the total number of combinations ({totalSimulations}). Some simulations will not be run.
              </Alert>
            )}
            
            {estimatedCost > computeConfig.maxBudget && (
              <Alert severity="warning">
                Estimated cost (${estimatedCost.toFixed(2)}) exceeds your budget (${computeConfig.maxBudget}). Consider adjusting your parameters or increasing your budget.
              </Alert>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BatchComputeStep;