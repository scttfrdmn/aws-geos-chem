import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

// MUI components
import {
  Box,
  Container,
  Paper,
  Typography,
  useTheme,
  Link,
  Grid
} from '@mui/material';

// Logo
import GcLogo from '../../assets/geos-chem-logo.svg';

const AuthLayout: React.FC = () => {
  const theme = useTheme();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  
  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        backgroundImage: 'url("/background-pattern.svg")',
        backgroundSize: 'cover'
      }}
    >
      <Container maxWidth="sm" sx={{ display: 'flex', alignItems: 'center' }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <img
              src={GcLogo}
              alt="GEOS-Chem Logo"
              style={{ 
                height: 80,
                marginBottom: theme.spacing(2)
              }}
            />
            <Typography variant="h4" component="h1" gutterBottom>
              GEOS-Chem Cloud Runner
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Run GEOS-Chem simulations efficiently in the cloud
            </Typography>
          </Box>
          
          {/* Outlet for child routes (Login, Signup, ForgotPassword) */}
          <Outlet />
          
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Grid container spacing={2} justifyContent="center">
              <Grid item>
                <Link href="https://geos-chem.seas.harvard.edu/" target="_blank" rel="noopener">
                  GEOS-Chem Website
                </Link>
              </Grid>
              <Grid item>
                <Link href="https://github.com/geoschem" target="_blank" rel="noopener">
                  GitHub
                </Link>
              </Grid>
              <Grid item>
                <Link href="/help" target="_blank">
                  Help
                </Link>
              </Grid>
            </Grid>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              © {new Date().getFullYear()} GEOS-Chem Support Team
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default AuthLayout;