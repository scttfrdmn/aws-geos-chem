import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Chip,
  Divider,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  ListItemText,
  Checkbox,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Science as ScienceIcon,
  CompareArrows as CompareIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Simulation, SimulationStatus } from '../../types/simulation';

interface SimulationSelectorProps {
  onSelect: (simulationId: string) => void;
  onCancel: () => void;
  selectedSimulations: string[];
}

const SimulationSelector: React.FC<SimulationSelectorProps> = ({
  onSelect,
  onCancel,
  selectedSimulations
}) => {
  const { simulations } = useSelector((state: RootState) => state.simulations);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(['COMPLETED']);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  
  // Handle status filter change
  const handleStatusFilterChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setStatusFilter(typeof value === 'string' ? value.split(',') : value);
  };
  
  // Handle type filter change
  const handleTypeFilterChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setTypeFilter(typeof value === 'string' ? value.split(',') : value);
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter(['COMPLETED']);
    setTypeFilter([]);
  };
  
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  // Filter simulations based on search query and filters
  const filteredSimulations = simulations.filter(sim => {
    // Skip already selected simulations
    if (selectedSimulations.includes(sim.id)) {
      return false;
    }
    
    // Apply search filter
    const matchesSearch = searchQuery === '' || 
      sim.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sim.description && sim.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Apply status filter
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(sim.status);
    
    // Apply type filter
    const matchesType = typeFilter.length === 0 || typeFilter.includes(sim.config.simulationType);
    
    return matchesSearch && matchesStatus && matchesType;
  });
  
  // Get unique simulation types for filter options
  const simulationTypes = Array.from(new Set(simulations.map(sim => sim.config.simulationType)));
  
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Select a Simulation to Add
        </Typography>
        <IconButton onClick={onCancel}>
          <CloseIcon />
        </IconButton>
      </Box>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Search Simulations"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              multiple
              value={statusFilter}
              onChange={handleStatusFilterChange}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
              label="Status"
            >
              {Object.values(SimulationStatus).map((status) => (
                <MenuItem key={status} value={status}>
                  <Checkbox checked={statusFilter.indexOf(status) > -1} />
                  <ListItemText primary={status} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel id="type-filter-label">Type</InputLabel>
            <Select
              labelId="type-filter-label"
              multiple
              value={typeFilter}
              onChange={handleTypeFilterChange}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
              label="Type"
            >
              {simulationTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  <Checkbox checked={typeFilter.indexOf(type) > -1} />
                  <ListItemText primary={type} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {filteredSimulations.length} simulations found
        </Typography>
        <Button
          size="small"
          startIcon={<ClearIcon />}
          onClick={handleClearFilters}
        >
          Clear Filters
        </Button>
      </Box>
      
      <Grid container spacing={2}>
        {filteredSimulations.length > 0 ? (
          filteredSimulations.map((simulation) => (
            <Grid item xs={12} sm={6} md={4} key={simulation.id}>
              <Card 
                variant="outlined"
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ScienceIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6" component="div" noWrap>
                      {simulation.name}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {simulation.description || 'No description'}
                  </Typography>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      <strong>Status:</strong>
                    </Typography>
                    <Chip 
                      label={simulation.status} 
                      size="small" 
                      color={simulation.status === 'COMPLETED' ? 'success' : 'default'}
                    />
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      <strong>Type:</strong>
                    </Typography>
                    <Typography variant="body2">
                      {simulation.config.simulationType}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      <strong>Created:</strong>
                    </Typography>
                    <Typography variant="body2">
                      {formatDate(simulation.createdAt)}
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions>
                  <Button 
                    fullWidth
                    variant="contained"
                    onClick={() => onSelect(simulation.id)}
                    startIcon={<CompareIcon />}
                  >
                    Add to Comparison
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No simulations found matching your filters. Try adjusting your search criteria.
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default SimulationSelector;