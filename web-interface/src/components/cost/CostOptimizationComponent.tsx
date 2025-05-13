import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Button,
  CircularProgress,
  Alert,
  AlertTitle,
  Tabs,
  Tab,
  IconButton,
  Collapse,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress
} from '@mui/material';

import {
  TrendingDown as SavingsIcon,
  AccountBalance as BudgetIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  ArrowForward as ArrowIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Check as ApplyIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

import { RootState } from '../../store';
import {
  fetchOptimizationRecommendations,
  fetchSimulationOptimizations,
  applyOptimizationRecommendation,
  selectOptimizationSummary,
  selectUserRecommendations,
  selectSimulationRecommendations,
  OptimizationRecommendation,
  Recommendation
} from '../../store/slices/costSlice';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`optimization-tabpanel-${index}`}
      aria-labelledby={`optimization-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `optimization-tab-${index}`,
    'aria-controls': `optimization-tabpanel-${index}`,
  };
}

interface CostOptimizationComponentProps {
  simulationId?: string;
  onRecommendationApplied?: () => void;
}

const CostOptimizationComponent: React.FC<CostOptimizationComponentProps> = ({
  simulationId,
  onRecommendationApplied
}) => {
  const dispatch = useDispatch();
  const [tabValue, setTabValue] = useState(0);
  const [expandedRecommendations, setExpandedRecommendations] = useState<string[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);

  // Redux state selectors
  const { loading, error, submitting } = useSelector((state: RootState) => state.cost);
  const summary = useSelector(selectOptimizationSummary);
  const userRecommendations = useSelector(selectUserRecommendations);
  
  // Only fetch simulation-specific recommendations if a simulationId is provided
  const simulationRecommendations = simulationId 
    ? useSelector(selectSimulationRecommendations(simulationId))
    : null;

  // Fetch recommendations on component mount
  useEffect(() => {
    if (simulationId) {
      dispatch(fetchSimulationOptimizations(simulationId) as any);
    } else {
      dispatch(fetchOptimizationRecommendations({}) as any);
    }
  }, [dispatch, simulationId]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Handle expanding/collapsing recommendation details
  const handleToggleExpand = (recommendationId: string) => {
    if (expandedRecommendations.includes(recommendationId)) {
      setExpandedRecommendations(expandedRecommendations.filter(id => id !== recommendationId));
    } else {
      setExpandedRecommendations([...expandedRecommendations, recommendationId]);
    }
  };

  // Handle applying a recommendation
  const handleApplyRecommendation = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation);
    setApplyDialogOpen(true);
  };

  // Confirm applying a recommendation
  const confirmApplyRecommendation = async () => {
    if (!selectedRecommendation || !simulationId) return;
    
    setApplyDialogOpen(false);
    
    await dispatch(applyOptimizationRecommendation({
      simulationId,
      recommendationType: selectedRecommendation.type,
      recommendationId: selectedRecommendation.type // Using type as ID for simplicity
    }) as any);
    
    // Refresh recommendations after applying
    if (simulationId) {
      dispatch(fetchSimulationOptimizations(simulationId) as any);
    }
    
    // Notify parent component if needed
    if (onRecommendationApplied) {
      onRecommendationApplied();
    }
  };

  // Refresh recommendations
  const handleRefresh = () => {
    if (simulationId) {
      dispatch(fetchSimulationOptimizations(simulationId) as any);
    } else {
      dispatch(fetchOptimizationRecommendations({}) as any);
    }
  };

  // Helper function to render impact chip
  const renderImpactChip = (impact: string) => {
    let color: 'success' | 'warning' | 'error' | 'default' = 'default';
    let icon = <InfoIcon />;
    
    switch(impact) {
      case 'high':
        color = 'error';
        icon = <WarningIcon />;
        break;
      case 'medium':
        color = 'warning';
        icon = <WarningIcon />;
        break;
      case 'low':
        color = 'success';
        icon = <InfoIcon />;
        break;
    }
    
    return (
      <Chip 
        icon={icon}
        label={`${impact} impact`}
        color={color}
        size="small"
        sx={{ mr: 1 }}
      />
    );
  };

  // Helper function to render savings chip
  const renderSavingsChip = (savingsPercent?: number) => {
    if (!savingsPercent) return null;
    
    return (
      <Chip 
        icon={<SavingsIcon />}
        label={`Save ${savingsPercent}%`}
        color="primary"
        size="small"
      />
    );
  };

  // Render summary section
  const renderSummary = () => {
    const targetRecommendations = simulationId 
      ? simulationRecommendations
      : userRecommendations;
    
    if (!targetRecommendations || !targetRecommendations.recommendations || targetRecommendations.recommendations.length === 0) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          <AlertTitle>No Optimization Recommendations Available</AlertTitle>
          No cost optimization recommendations are currently available. This could be because:
          <List>
            <ListItem>
              <ListItemText primary="Your current configurations are already optimized" />
            </ListItem>
            <ListItem>
              <ListItemText primary="There is not enough historical data to make recommendations" />
            </ListItem>
            <ListItem>
              <ListItemText primary="You haven't run any simulations yet" />
            </ListItem>
          </List>
        </Alert>
      );
    }
    
    // Calculate total potential savings for simulation-specific view
    let totalSavings = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    
    if (simulationId && simulationRecommendations?.recommendations) {
      simulationRecommendations.recommendations.forEach(rec => {
        if (rec.potentialSavingsPercent) {
          totalSavings += rec.potentialSavingsPercent;
        }
        
        if (rec.impact === 'high') highCount++;
        else if (rec.impact === 'medium') mediumCount++;
        else if (rec.impact === 'low') lowCount++;
      });
    }
    
    const currentCost = simulationRecommendations?.currentCost || 0;
    const potentialSavingsAmount = (totalSavings / 100) * currentCost;
    
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardHeader 
          title="Cost Optimization Summary" 
          action={
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          }
        />
        <Divider />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SavingsIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Potential Savings
                </Typography>
              </Box>
              
              <Typography variant="h4" color="primary" gutterBottom>
                {simulationId 
                  ? `$${potentialSavingsAmount.toFixed(2)}`
                  : `$${summary?.totalPotentialSavings.toFixed(2)}`
                }
              </Typography>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {simulationId
                  ? `${totalSavings.toFixed(1)}% of current cost ($${currentCost.toFixed(2)})`
                  : 'Estimated total cost savings across all simulations'
                }
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WarningIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Recommendations
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                <Box>
                  <Typography variant="h4" color="error">
                    {simulationId ? highCount : summary?.highImpactCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    High Impact
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {simulationId ? mediumCount : summary?.mediumImpactCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Medium Impact
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="h4" color="success.main">
                    {simulationId ? lowCount : summary?.lowImpactCount || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Low Impact
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  // Render recommendations list for a simulation
  const renderSimulationRecommendations = () => {
    if (!simulationId || !simulationRecommendations) {
      return (
        <Alert severity="info">
          No simulation-specific recommendations available.
        </Alert>
      );
    }
    
    const { recommendations } = simulationRecommendations;
    
    if (!recommendations || recommendations.length === 0) {
      return (
        <Alert severity="info">
          No recommendations available for this simulation.
        </Alert>
      );
    }
    
    return (
      <List>
        {recommendations.map((recommendation, index) => (
          <Paper key={index} variant="outlined" sx={{ mb: 2 }}>
            <ListItem 
              button 
              onClick={() => handleToggleExpand(`sim-${index}`)}
              secondaryAction={
                <IconButton edge="end" onClick={() => handleToggleExpand(`sim-${index}`)}>
                  {expandedRecommendations.includes(`sim-${index}`) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              }
            >
              <ListItemIcon>
                {recommendation.impact === 'high' ? <WarningIcon color="error" /> : 
                 recommendation.impact === 'medium' ? <WarningIcon color="warning" /> : 
                 <InfoIcon color="info" />}
              </ListItemIcon>
              <ListItemText 
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="subtitle1" sx={{ mr: 1 }}>
                      {getRecommendationTitle(recommendation)}
                    </Typography>
                    {renderImpactChip(recommendation.impact)}
                    {renderSavingsChip(recommendation.potentialSavingsPercent)}
                  </Box>
                }
                secondary={recommendation.description}
              />
            </ListItem>
            
            <Collapse in={expandedRecommendations.includes(`sim-${index}`)} timeout="auto" unmountOnExit>
              <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                {recommendation.currentValue && recommendation.recommendedValue && (
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={5}>
                      <Typography variant="body2" color="text.secondary">
                        Current Value:
                      </Typography>
                      <Typography variant="body1">
                        {recommendation.currentValue}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={2} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <ArrowIcon color="action" />
                    </Grid>
                    
                    <Grid item xs={12} sm={5}>
                      <Typography variant="body2" color="text.secondary">
                        Recommended Value:
                      </Typography>
                      <Typography variant="body1" color="primary">
                        {recommendation.recommendedValue}
                      </Typography>
                    </Grid>
                  </Grid>
                )}
                
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    startIcon={<ApplyIcon />}
                    onClick={() => handleApplyRecommendation(recommendation)}
                    disabled={submitting}
                  >
                    Apply Recommendation
                  </Button>
                </Box>
              </Box>
            </Collapse>
          </Paper>
        ))}
      </List>
    );
  };

  // Render user-level recommendations
  const renderUserRecommendations = () => {
    if (!userRecommendations || !userRecommendations.recommendations) {
      return (
        <Alert severity="info">
          No general recommendations available.
        </Alert>
      );
    }
    
    // Organize recommendations by type
    const { recommendations } = userRecommendations;
    const recommendationTypes = Object.keys(recommendations);
    
    if (recommendationTypes.length === 0) {
      return (
        <Alert severity="info">
          No recommendations available at this time.
        </Alert>
      );
    }
    
    return (
      <>
        {recommendationTypes.map((type, typeIndex) => {
          const typeRecs = recommendations[type];
          if (!Array.isArray(typeRecs) || typeRecs.length === 0) return null;
          
          return (
            <Box key={typeIndex} sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                {type} Recommendations
              </Typography>
              
              <List>
                {typeRecs.map((recommendation, index) => (
                  <Paper key={index} variant="outlined" sx={{ mb: 2 }}>
                    <ListItem 
                      button 
                      onClick={() => handleToggleExpand(`${type}-${index}`)}
                      secondaryAction={
                        <IconButton edge="end" onClick={() => handleToggleExpand(`${type}-${index}`)}>
                          {expandedRecommendations.includes(`${type}-${index}`) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        {recommendation.impact === 'high' ? <WarningIcon color="error" /> : 
                         recommendation.impact === 'medium' ? <WarningIcon color="warning" /> : 
                         <InfoIcon color="info" />}
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Typography variant="subtitle1" sx={{ mr: 1 }}>
                              {getRecommendationTitle(recommendation)}
                            </Typography>
                            {renderImpactChip(recommendation.impact)}
                            {renderSavingsChip(recommendation.potentialSavingsPercent)}
                          </Box>
                        }
                        secondary={recommendation.description}
                      />
                    </ListItem>
                    
                    <Collapse in={expandedRecommendations.includes(`${type}-${index}`)} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                        {recommendation.currentValue && recommendation.recommendedValue && (
                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={12} sm={5}>
                              <Typography variant="body2" color="text.secondary">
                                Current Pattern:
                              </Typography>
                              <Typography variant="body1">
                                {recommendation.currentValue}
                              </Typography>
                            </Grid>
                            
                            <Grid item xs={12} sm={2} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <ArrowIcon color="action" />
                            </Grid>
                            
                            <Grid item xs={12} sm={5}>
                              <Typography variant="body2" color="text.secondary">
                                Recommended Pattern:
                              </Typography>
                              <Typography variant="body1" color="primary">
                                {recommendation.recommendedValue}
                              </Typography>
                            </Grid>
                          </Grid>
                        )}
                        
                        {recommendation.potentialSavingsPercent && (
                          <Alert severity="info" sx={{ mb: 2 }}>
                            <AlertTitle>Potential Savings</AlertTitle>
                            Implementing this recommendation could save approximately {recommendation.potentialSavingsPercent}% on your costs.
                          </Alert>
                        )}
                      </Box>
                    </Collapse>
                  </Paper>
                ))}
              </List>
            </Box>
          );
        })}
      </>
    );
  };

  // Helper function to get recommendation title
  const getRecommendationTitle = (recommendation: Recommendation): string => {
    switch (recommendation.type) {
      case 'instance':
        return 'Instance Type Optimization';
      case 'spot':
        return 'Use Spot Instances';
      case 'resolution':
        return 'Resolution Optimization';
      case 'duration':
        return 'Runtime Optimization';
      case 'simulationType':
        return 'Simulation Type Optimization';
      case 'instanceStrategy':
        return 'Instance Selection Strategy';
      case 'instanceSize':
        return 'Instance Size Optimization';
      case 'spotUsage':
        return 'Spot Usage Optimization';
      case 'parallelCluster':
        return 'ParallelCluster Optimization';
      case 'gchp':
        return 'GCHP Recommendation';
      default:
        return recommendation.type.charAt(0).toUpperCase() + recommendation.type.slice(1);
    }
  };

  if (loading && (!userRecommendations && !simulationRecommendations)) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading Optimization Recommendations...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        <AlertTitle>Error</AlertTitle>
        Failed to load optimization recommendations: {error}
      </Alert>
    );
  }

  return (
    <Box>
      {submitting && (
        <LinearProgress sx={{ mb: 2 }} />
      )}
      
      {/* Summary Section */}
      {renderSummary()}
      
      {/* Tabs for different recommendation types */}
      {!simulationId && (
        <>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="optimization recommendation tabs"
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            <Tab label="All Recommendations" {...a11yProps(0)} />
            <Tab label="Instance Optimization" {...a11yProps(1)} />
            <Tab label="Resolution Optimization" {...a11yProps(2)} />
            <Tab label="Runtime Optimization" {...a11yProps(3)} />
          </Tabs>
          
          <TabPanel value={tabValue} index={0}>
            {renderUserRecommendations()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            {/* Filter recommendations for instance types */}
            {renderUserRecommendations()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={2}>
            {/* Filter recommendations for resolution */}
            {renderUserRecommendations()}
          </TabPanel>
          
          <TabPanel value={tabValue} index={3}>
            {/* Filter recommendations for runtime */}
            {renderUserRecommendations()}
          </TabPanel>
        </>
      )}
      
      {/* Simulation-specific recommendations */}
      {simulationId && renderSimulationRecommendations()}
      
      {/* Apply Recommendation Dialog */}
      <Dialog
        open={applyDialogOpen}
        onClose={() => setApplyDialogOpen(false)}
        aria-labelledby="apply-recommendation-dialog-title"
      >
        <DialogTitle id="apply-recommendation-dialog-title">
          Apply Recommendation
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Are you sure you want to apply the following recommendation:
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle1">
              {selectedRecommendation && getRecommendationTitle(selectedRecommendation)}
            </Typography>
            <Typography variant="body2">
              {selectedRecommendation?.description}
            </Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary">
            This will update your simulation configuration. You may need to restart your simulation for the changes to take effect.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApplyDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmApplyRecommendation} 
            color="primary" 
            variant="contained"
            startIcon={<ApplyIcon />}
          >
            Apply Recommendation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CostOptimizationComponent;