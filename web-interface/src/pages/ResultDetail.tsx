import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Paper, Breadcrumbs, Link } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchSimulationResults } from '../store/slices/resultsSlice';
import ResultsViewer from '../components/results/ResultsViewer';

const ResultDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.results);
  const simulation = useSelector((state: RootState) => 
    state.simulations.simulations.find(sim => sim.id === id)
  );

  useEffect(() => {
    if (id) {
      dispatch(fetchSimulationResults(id));
    }
  }, [id, dispatch]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading results: {error}
      </Alert>
    );
  }

  if (!simulation) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Simulation not found
      </Alert>
    );
  }

  return (
    <Box>
      <Paper 
        elevation={0} 
        variant="outlined" 
        sx={{ p: 2, mb: 3, borderRadius: 2 }}
      >
        <Breadcrumbs aria-label="breadcrumb">
          <Link color="inherit" href="/simulations">
            Simulations
          </Link>
          <Link color="inherit" href={`/simulations/${id}`}>
            {simulation.name}
          </Link>
          <Typography color="text.primary">Results</Typography>
        </Breadcrumbs>
      </Paper>

      <ResultsViewer />
    </Box>
  );
};

export default ResultDetail;