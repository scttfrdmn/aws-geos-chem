import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

const ResultDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Result Details
      </Typography>
      <Typography variant="body1">
        Viewing result with ID: {id}
      </Typography>
    </Box>
  );
};

export default ResultDetail;