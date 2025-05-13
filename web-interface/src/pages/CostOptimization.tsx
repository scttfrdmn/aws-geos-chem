import React from 'react';
import { useSelector } from 'react-redux';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  Home as HomeIcon,
  TrendingDown as SavingsIcon,
  AccountBalance as BudgetIcon
} from '@mui/icons-material';

import { RootState } from '../store';
import CostOptimizationComponent from '../components/cost/CostOptimizationComponent';

const CostOptimization: React.FC = () => {
  const { summary } = useSelector((state: RootState) => state.cost);
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }} aria-label="breadcrumb">
        <Link
          component={RouterLink}
          to="/"
          color="inherit"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Home
        </Link>
        <Typography color="text.primary" sx={{ display: 'flex', alignItems: 'center' }}>
          <SavingsIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Cost Optimization
        </Typography>
      </Breadcrumbs>
      
      <Typography variant="h4" component="h1" gutterBottom>
        Cost Optimization Recommendations
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        Review cost optimization recommendations to reduce your AWS costs for GEOS-Chem simulations.
        These recommendations are based on analysis of your past and current simulations.
      </Typography>
      
      {/* Summary Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SavingsIcon color="primary" sx={{ mr: 1, fontSize: 40 }} />
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Total Cost
                  </Typography>
                  <Typography variant="h4">
                    ${summary.totalCost.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <BudgetIcon color="primary" sx={{ mr: 1, fontSize: 40 }} />
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Budget
                  </Typography>
                  <Typography variant="h4">
                    ${summary.forecastedCost.toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SavingsIcon color="secondary" sx={{ mr: 1, fontSize: 40 }} />
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Month-to-Date
                  </Typography>
                  <Typography variant="h4">
                    ${Object.values(summary.costByDay).reduce((a, b) => a + b, 0).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Main content */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <CostOptimizationComponent />
      </Paper>
      
      {/* Info Section */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          About Cost Optimization Recommendations
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2" paragraph>
          The cost optimization system analyzes your simulations and usage patterns to identify opportunities to reduce costs.
          Recommendations are categorized by impact level:
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ bgcolor: 'error.light', color: 'error.contrastText' }}>
              <CardContent>
                <Typography variant="subtitle1">High Impact</Typography>
                <Typography variant="body2">
                  These recommendations can save 30% or more on your costs. They should be prioritized.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
              <CardContent>
                <Typography variant="subtitle1">Medium Impact</Typography>
                <Typography variant="body2">
                  These recommendations typically save 10-30% on costs for specific simulations or workloads.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
              <CardContent>
                <Typography variant="subtitle1">Low Impact</Typography>
                <Typography variant="body2">
                  These recommendations provide minor cost savings (less than 10%) or other operational benefits.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default CostOptimization;