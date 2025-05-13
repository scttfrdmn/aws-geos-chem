import React from 'react';
import { Box, Typography } from '@mui/material';

const Simulations: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Simulations
      </Typography>
      <Typography variant="body1">
        This page will list all simulations.
      </Typography>
    </Box>
  );
};

export default Simulations;