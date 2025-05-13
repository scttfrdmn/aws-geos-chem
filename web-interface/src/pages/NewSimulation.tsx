import React from 'react';
import { Box, Typography } from '@mui/material';
import SimulationWizard from '../components/simulation-wizard/SimulationWizard';

const NewSimulation: React.FC = () => {
  return (
    <Box>
      <SimulationWizard />
    </Box>
  );
};

export default NewSimulation;