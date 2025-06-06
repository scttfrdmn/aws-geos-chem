import React from 'react';
import {
  Typography,
  Box,
  Paper,
  Grid,
  Divider,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Chip
} from '@mui/material';

import {
  MonetizationOn as CostIcon,
  AccessTime as TimeIcon,
  Storage as StorageIcon,
  Receipt as BillingIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface CostEstimationStepProps {
  formValues: any;
  onChange: (field: string, value: any) => void;
}

const CostEstimationStep: React.FC<CostEstimationStepProps> = ({ formValues, onChange }) => {
  // Calculate the simulation duration in days
  const calculateDurationDays = (): number => {
    if (!formValues.startDate || !formValues.endDate) return 0;
    
    const start = new Date(formValues.startDate);
    const end = new Date(formValues.endDate);
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }
    
    // Calculate difference in days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };
  
  // Get estimated hourly cost based on instance type
  const getInstanceHourlyCost = (): number => {
    const baseCosts: Record<string, Record<string, Record<string, number>>> = {
      graviton3: {
        standard: {
          small: 0.68,
          medium: 1.36,
          large: 2.72,
          xlarge: 5.44
        },
        high: {
          small: 0.95,
          medium: 1.91,
          large: 3.81,
          xlarge: 7.62
        }
      },
      graviton4: {
        standard: {
          small: 0.76,
          medium: 1.52,
          large: 3.04,
          xlarge: 6.08
        },
        high: {
          small: 1.06,
          medium: 2.13,
          large: 4.26,
          xlarge: 8.51
        }
      },
      intel: {
        standard: {
          small: 0.70,
          medium: 1.40,
          large: 2.80,
          xlarge: 5.60
        },
        high: {
          small: 0.98,
          medium: 1.96,
          large: 3.92,
          xlarge: 7.84
        }
      },
      amd: {
        standard: {
          small: 0.67,
          medium: 1.34,
          large: 2.68,
          xlarge: 5.36
        },
        high: {
          small: 0.94,
          medium: 1.88,
          large: 3.75,
          xlarge: 7.50
        }
      }
    };
    
    // Determine cost
    try {
      const processorType = formValues.processorType || 'graviton3';
      const memoryType = formValues.memory || 'standard';
      const instanceSize = formValues.instanceSize || 'medium';
      
      return baseCosts[processorType][memoryType][instanceSize];
    } catch (error) {
      console.error('Error calculating instance cost:', error);
      return 1.36; // Default to medium graviton3 standard
    }
  };
  
  // Check if cost estimation is in progress
  const isEstimating = !formValues.estimatedCost && !formValues.estimatedRuntime;
  
  // Get the estimated wall-clock runtime based on configuration
  const getEstimatedWallClockHours = (): number => {
    if (formValues.estimatedRuntime) {
      return formValues.estimatedRuntime;
    }
    
    // These are placeholders for the estimation logic
    // In reality, these would come from benchmarks or a prediction model
    let baseHoursPerSimDay = 0.1; // 6 minutes per simulation day
    
    // Adjust for resolution/domain
    if (formValues.simulationType === 'GC_CLASSIC') {
      if (formValues.resolution === '4x5') {
        baseHoursPerSimDay = 0.1; // 6 minutes per sim day
      } else if (formValues.resolution === '2x2.5') {
        baseHoursPerSimDay = 0.3; // 18 minutes per sim day
      } else if (formValues.resolution === '0.5x0.625') {
        baseHoursPerSimDay = 0.5; // 30 minutes per sim day
      } else if (formValues.resolution === '0.25x0.3125') {
        baseHoursPerSimDay = 1.0; // 60 minutes per sim day
      }
    } else if (formValues.simulationType === 'GCHP') {
      if (formValues.cubedsphereRes === 'C24') {
        baseHoursPerSimDay = 0.2; // 12 minutes per sim day
      } else if (formValues.cubedsphereRes === 'C48') {
        baseHoursPerSimDay = 0.5; // 30 minutes per sim day
      } else if (formValues.cubedsphereRes === 'C90') {
        baseHoursPerSimDay = 1.0; // 60 minutes per sim day
      } else if (formValues.cubedsphereRes === 'C180') {
        baseHoursPerSimDay = 2.5; // 150 minutes per sim day
      } else if (formValues.cubedsphereRes === 'C360') {
        baseHoursPerSimDay = 8.0; // 480 minutes per sim day
      }
    }
    
    // Adjust for chemistry complexity
    if (formValues.chemistryOption === 'fullchem') {
      baseHoursPerSimDay *= 1.0; // Full factor
    } else if (formValues.chemistryOption === 'aerosol') {
      baseHoursPerSimDay *= 0.7; // 30% faster
    } else if (formValues.chemistryOption === 'CH4' || formValues.chemistryOption === 'CO2') {
      baseHoursPerSimDay *= 0.5; // 50% faster
    } else if (formValues.chemistryOption === 'transport') {
      baseHoursPerSimDay *= 0.3; // 70% faster
    }
    
    // Adjust for instance size
    let instanceSpeedupFactor = 1.0;
    if (formValues.instanceSize === 'small') {
      instanceSpeedupFactor = 0.5; // 2x slower than baseline medium
    } else if (formValues.instanceSize === 'medium') {
      instanceSpeedupFactor = 1.0; // Baseline
    } else if (formValues.instanceSize === 'large') {
      instanceSpeedupFactor = 1.8; // Not quite 2x faster due to diminishing returns
    } else if (formValues.instanceSize === 'xlarge') {
      instanceSpeedupFactor = 3.2; // Not quite 4x faster due to diminishing returns
    }
    
    // Calculate total runtime
    const simDays = calculateDurationDays() + (formValues.spinupDays || 0);
    const wallClockHours = (baseHoursPerSimDay * simDays) / instanceSpeedupFactor;
    
    return Math.ceil(wallClockHours);
  };
  
  // Compute the total estimated cost
  const computeTotalCost = (): number => {
    if (formValues.estimatedCost) {
      return formValues.estimatedCost;
    }
    
    const hourlyRate = getInstanceHourlyCost();
    const spotDiscount = formValues.useSpot ? 0.3 : 1.0; // 70% discount for spot
    const wallClockHours = getEstimatedWallClockHours();
    
    // Calculate basic compute cost
    const computeCost = hourlyRate * spotDiscount * wallClockHours;
    
    // Add storage costs (estimated)
    const storageCost = estimateStorageCost();
    
    return computeCost + storageCost;
  };
  
  // Estimate storage cost
  const estimateStorageCost = (): number => {
    // These are simplified estimates
    const baseSizeGB = formValues.simulationType === 'GC_CLASSIC' ? 10 : 20;
    
    // Adjust for resolution
    let resolutionFactor = 1.0;
    if (formValues.simulationType === 'GC_CLASSIC') {
      if (formValues.resolution === '4x5') {
        resolutionFactor = 1.0;
      } else if (formValues.resolution === '2x2.5') {
        resolutionFactor = 2.0;
      } else if (formValues.resolution === '0.5x0.625') {
        resolutionFactor = 8.0;
      } else if (formValues.resolution === '0.25x0.3125') {
        resolutionFactor = 16.0;
      }
    } else if (formValues.simulationType === 'GCHP') {
      if (formValues.cubedsphereRes === 'C24') {
        resolutionFactor = 1.0;
      } else if (formValues.cubedsphereRes === 'C48') {
        resolutionFactor = 4.0;
      } else if (formValues.cubedsphereRes === 'C90') {
        resolutionFactor = 12.0;
      } else if (formValues.cubedsphereRes === 'C180') {
        resolutionFactor = 36.0;
      } else if (formValues.cubedsphereRes === 'C360') {
        resolutionFactor = 96.0;
      }
    }
    
    // Adjust for output frequency
    let frequencyFactor = 1.0;
    if (formValues.outputFrequency === 'hourly') {
      frequencyFactor = 24.0;
    } else if (formValues.outputFrequency === '3-hourly') {
      frequencyFactor = 8.0;
    } else if (formValues.outputFrequency === 'daily') {
      frequencyFactor = 1.0;
    } else if (formValues.outputFrequency === 'monthly') {
      frequencyFactor = 0.033;
    }
    
    // Calculate storage size
    const simDays = calculateDurationDays();
    const storageGB = baseSizeGB * resolutionFactor * frequencyFactor * (simDays / 30);
    
    // Cost at $0.023 per GB-month for 3 months retention
    return storageGB * 0.023 * 3;
  };
  
  // Compute cost breakdown
  const computeCostBreakdown = () => {
    const hourlyRate = getInstanceHourlyCost();
    const spotDiscount = formValues.useSpot ? 0.3 : 1.0;
    const wallClockHours = getEstimatedWallClockHours();
    
    const computeCost = hourlyRate * spotDiscount * wallClockHours;
    const storageCost = estimateStorageCost();
    const totalCost = computeCost + storageCost;
    
    return {
      compute: computeCost,
      storage: storageCost,
      total: totalCost,
      wallClockHours
    };
  };
  
  const costBreakdown = computeCostBreakdown();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Cost Estimation
      </Typography>
      
      <Typography variant="body1" paragraph>
        Review the estimated cost and runtime for your simulation. This is based on our benchmarks and your configuration.
      </Typography>
      
      {isEstimating ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Estimating Cost...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We're calculating the estimated cost and runtime based on your configuration.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Summary Card */}
          <Grid item xs={12}>
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CostIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Cost Summary</Typography>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <CostIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" gutterBottom>
                          Total Estimated Cost
                        </Typography>
                      </Box>
                      <Typography variant="h4" component="div" sx={{ mb: 1, color: 'primary.main' }}>
                        {formatCurrency(costBreakdown.total)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formValues.useSpot ? 'Using spot instances (70% savings applied)' : 'Using on-demand instances'}
                      </Typography>
                      
                      {costBreakdown.total > 100 && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          Consider optimizing your configuration to reduce costs.
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TimeIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" gutterBottom>
                          Estimated Runtime
                        </Typography>
                      </Box>
                      <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                        {costBreakdown.wallClockHours} hours
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Approximately {Math.ceil(costBreakdown.wallClockHours / 24)} days of wall-clock time
                      </Typography>
                      
                      {costBreakdown.wallClockHours > 72 && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          Long-running simulation. Consider breaking it into smaller segments.
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <StorageIcon color="primary" sx={{ mr: 1 }} />
                        <Typography variant="h6" gutterBottom>
                          Estimated Storage
                        </Typography>
                      </Box>
                      <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                        {formatCurrency(costBreakdown.storage)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Includes 3 months of storage retention
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* Cost Breakdown */}
              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Cost Breakdown
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      Compute Cost:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, mb: 2 }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={(costBreakdown.compute / costBreakdown.total) * 100}
                          sx={{ height: 10, borderRadius: 5 }}
                        />
                      </Box>
                      <Box sx={{ minWidth: 80 }}>
                        <Typography variant="body2" color="text.secondary">
                          {formatCurrency(costBreakdown.compute)}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Typography variant="body2">
                      Storage Cost:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={(costBreakdown.storage / costBreakdown.total) * 100}
                          sx={{ height: 10, borderRadius: 5 }}
                        />
                      </Box>
                      <Box sx={{ minWidth: 80 }}>
                        <Typography variant="body2" color="text.secondary">
                          {formatCurrency(costBreakdown.storage)}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Cost Details
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={`Instance: ${formValues.processorType}, ${formValues.instanceSize}, ${formValues.memory} memory`}
                          secondary={`Base rate: ${formatCurrency(getInstanceHourlyCost())}/hour`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={`${formValues.useSpot ? 'Spot instance' : 'On-demand instance'}`}
                          secondary={formValues.useSpot ? '70% discount applied' : 'No discount'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <InfoIcon fontSize="small" color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={`Runtime: ${costBreakdown.wallClockHours} hours`}
                          secondary={`${calculateDurationDays()} simulation days + ${formValues.spinupDays || 0} spinup days`}
                        />
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>
              </Box>
              
              {/* Cost Optimization Tips */}
              <Box sx={{ mt: 3 }}>
                <Alert severity="info" icon={<BillingIcon />}>
                  <Typography variant="subtitle2">
                    Cost Optimization Tips
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Use spot instances for 70% savings (already applied if selected)"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Reduce output frequency to save on storage and I/O costs"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Consider using a coarser resolution for preliminary or sensitivity runs"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Break long simulations into smaller segments to manage costs"
                      />
                    </ListItem>
                  </List>
                </Alert>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default CostEstimationStep;