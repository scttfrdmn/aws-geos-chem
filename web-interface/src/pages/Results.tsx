import React from 'react';
import { Box, Typography } from '@mui/material';

const Results: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Results
      </Typography>
      <Typography variant="body1">
        This page will list all simulation results.
      </Typography>
    </Box>
  );
};

export default Results;