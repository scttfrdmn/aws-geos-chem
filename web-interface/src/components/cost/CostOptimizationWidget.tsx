import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';

import {
  TrendingDown as SavingsIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';

import { RootState } from '../../store';
import { 
  fetchOptimizationRecommendations,
  selectOptimizationSummary,
  selectUserRecommendations
} from '../../store/slices/costSlice';

const CostOptimizationWidget: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  // Redux state selectors
  const { loading, error } = useSelector((state: RootState) => state.cost);
  const summary = useSelector(selectOptimizationSummary);
  const userRecommendations = useSelector(selectUserRecommendations);
  
  // Fetch recommendations on component mount
  useEffect(() => {
    dispatch(fetchOptimizationRecommendations({}) as any);
  }, [dispatch]);
  
  // Get high impact recommendations only
  const getHighImpactRecommendations = () => {
    if (!userRecommendations || !userRecommendations.recommendations) return [];
    
    const highImpactRecs = [];
    const { recommendations } = userRecommendations;
    
    for (const type in recommendations) {
      if (Array.isArray(recommendations[type])) {
        const typeRecs = recommendations[type].filter(rec => rec.impact === 'high');
        highImpactRecs.push(...typeRecs);
      }
    }
    
    // Sort by potential savings percentage (descending)
    highImpactRecs.sort((a, b) => {
      const savingsA = a.potentialSavingsPercent || 0;
      const savingsB = b.potentialSavingsPercent || 0;
      return savingsB - savingsA;
    });
    
    // Return top 3 recommendations
    return highImpactRecs.slice(0, 3);
  };
  
  // Helper function to render impact chip
  const renderImpactChip = (impact: string) => {
    let color: 'success' | 'warning' | 'error' | 'default' = 'default';
    
    switch(impact) {
      case 'high':
        color = 'error';
        break;
      case 'medium':
        color = 'warning';
        break;
      case 'low':
        color = 'success';
        break;
    }
    
    return (
      <Chip 
        label={impact}
        color={color}
        size="small"
        sx={{ ml: 1 }}
      />
    );
  };
  
  // Render loading state
  if (loading && !userRecommendations) {
    return (
      <Card>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
          <CircularProgress size={40} />
        </CardContent>
      </Card>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" sx={{ mt: 1 }}>
            Failed to load cost optimizations
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  // Get high impact recommendations
  const highImpactRecs = getHighImpactRecommendations();
  
  // Calculate total potential savings
  const totalSavings = summary?.totalPotentialSavings || 0;
  
  return (
    <Card>
      <CardHeader 
        title="Cost Optimization" 
        titleTypographyProps={{ variant: 'h6' }}
      />
      <Divider />
      <CardContent>
        {/* Summary Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <SavingsIcon color="primary" fontSize="large" sx={{ mr: 2 }} />
          <Box>
            <Typography variant="h5" color="primary">
              ${totalSavings.toFixed(2)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Potential cost savings
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="error">
              {summary?.highImpactCount || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              High Impact
            </Typography>
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="warning.main">
              {summary?.mediumImpactCount || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Medium Impact
            </Typography>
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="success.main">
              {summary?.lowImpactCount || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Low Impact
            </Typography>
          </Box>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Top Recommendations */}
        {highImpactRecs.length > 0 ? (
          <>
            <Typography variant="subtitle2" gutterBottom>
              Top Recommendations
            </Typography>
            
            <List dense>
              {highImpactRecs.map((rec, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <WarningIcon color="error" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                          {rec.description}
                        </Typography>
                        {rec.potentialSavingsPercent && (
                          <Chip 
                            icon={<SavingsIcon />}
                            label={`${rec.potentialSavingsPercent}%`}
                            color="primary"
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        ) : (
          <Alert severity="info" sx={{ mt: 1 }}>
            No high-impact optimizations found
          </Alert>
        )}
        
        {/* View All Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button 
            endIcon={<ArrowIcon />}
            onClick={() => navigate('/cost-optimization')}
            size="small"
          >
            View All Optimizations
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CostOptimizationWidget;