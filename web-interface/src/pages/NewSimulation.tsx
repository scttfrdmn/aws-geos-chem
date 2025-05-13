import React from 'react';
import { Box, Typography } from '@mui/material';

const NewSimulation: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        New Simulation
      </Typography>
      <Typography variant="body1">
        This page will allow creating a new simulation.
      </Typography>
    </Box>
  );
};

export default NewSimulation;