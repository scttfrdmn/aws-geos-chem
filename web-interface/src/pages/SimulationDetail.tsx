import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

const SimulationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Simulation Details
      </Typography>
      <Typography variant="body1">
        Viewing simulation with ID: {id}
      </Typography>
    </Box>
  );
};

export default SimulationDetail;