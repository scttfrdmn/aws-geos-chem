import React from 'react';
import { 
  Typography, 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  CardActions, 
  Button, 
  Radio, 
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';

import {
  Check as CheckIcon,
  Science as ScienceIcon,
  Memory as MemoryIcon
} from '@mui/icons-material';

interface SimulationTypeStepProps {
  formValues: any;
  onChange: (field: string, value: any) => void;
}

const SimulationTypeStep: React.FC<SimulationTypeStepProps> = ({ formValues, onChange }) => {
  const handleTypeChange = (type: string) => {
    onChange('simulationType', type);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select Simulation Type
      </Typography>
      
      <Typography variant="body1" paragraph>
        Choose the type of GEOS-Chem simulation you want to run. Each option has different capabilities and resource requirements.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* GEOS-Chem Classic */}
        <Grid item xs={12} md={6}>
          <Card 
            variant="outlined" 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              border: formValues.simulationType === 'GC_CLASSIC' ? 2 : 1,
              borderColor: formValues.simulationType === 'GC_CLASSIC' ? 'primary.main' : 'divider',
              backgroundColor: formValues.simulationType === 'GC_CLASSIC' ? 'action.selected' : 'background.paper',
              transition: 'all 0.3s ease'
            }}
          >
            <CardHeader
              title="GEOS-Chem Classic"
              titleTypographyProps={{ variant: 'h6' }}
              subheader="Single-node OpenMP simulation"
              action={
                <Radio
                  checked={formValues.simulationType === 'GC_CLASSIC'}
                  onChange={() => handleTypeChange('GC_CLASSIC')}
                  value="GC_CLASSIC"
                  name="simulation-type-radio"
                  color="primary"
                />
              }
            />
            
            <Divider />
            
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                GEOS-Chem Classic runs on a single compute node using OpenMP for shared-memory parallelization.
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Easier setup and configuration" />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Suitable for most regional and global simulations" />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Supports nested grid simulations" />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Faster for smaller domains" />
                </ListItem>
              </List>
              
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                  Recommended for:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Single-region studies, sensitivity runs, and standard global simulations.
                </Typography>
              </Box>
            </CardContent>
            
            <CardActions>
              <Button 
                size="small" 
                onClick={() => handleTypeChange('GC_CLASSIC')}
                color="primary"
                fullWidth
                variant={formValues.simulationType === 'GC_CLASSIC' ? 'contained' : 'outlined'}
              >
                {formValues.simulationType === 'GC_CLASSIC' ? 'Selected' : 'Select GEOS-Chem Classic'}
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* GEOS-Chem High Performance */}
        <Grid item xs={12} md={6}>
          <Card 
            variant="outlined" 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              border: formValues.simulationType === 'GCHP' ? 2 : 1,
              borderColor: formValues.simulationType === 'GCHP' ? 'primary.main' : 'divider',
              backgroundColor: formValues.simulationType === 'GCHP' ? 'action.selected' : 'background.paper',
              transition: 'all 0.3s ease'
            }}
          >
            <CardHeader
              title="GEOS-Chem High Performance (GCHP)"
              titleTypographyProps={{ variant: 'h6' }}
              subheader="Multi-node MPI simulation"
              action={
                <Radio
                  checked={formValues.simulationType === 'GCHP'}
                  onChange={() => handleTypeChange('GCHP')}
                  value="GCHP"
                  name="simulation-type-radio"
                  color="primary"
                />
              }
            />
            
            <Divider />
            
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                GCHP uses MPI for distributed-memory parallelization across multiple compute nodes.
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Better scalability for large simulations" />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary="More efficient for high-resolution global runs" />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Uses cubed-sphere grid for better performance" />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <CheckIcon fontSize="small" color="success" />
                  </ListItemIcon>
                  <ListItemText primary="Supports stretched-grid capability" />
                </ListItem>
              </List>
              
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" color="primary" sx={{ fontWeight: 'bold' }}>
                  Recommended for:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  High-resolution global simulations, computationally intensive studies, and large-scale model runs.
                </Typography>
              </Box>
            </CardContent>
            
            <CardActions>
              <Button 
                size="small" 
                onClick={() => handleTypeChange('GCHP')}
                color="primary"
                fullWidth
                variant={formValues.simulationType === 'GCHP' ? 'contained' : 'outlined'}
              >
                {formValues.simulationType === 'GCHP' ? 'Selected' : 'Select GCHP'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Note: GEOS-Chem Classic uses OpenMP for shared-memory parallelization, while GCHP uses MPI for distributed-memory parallelization.
        </Typography>
      </Box>
    </Box>
  );
};

export default SimulationTypeStep;