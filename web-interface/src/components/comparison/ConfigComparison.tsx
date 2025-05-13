import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { Simulation } from '../../types/simulation';

interface ConfigComparisonProps {
  simulations: Simulation[];
}

const ConfigComparison: React.FC<ConfigComparisonProps> = ({
  simulations
}) => {
  // Check if the array is empty
  if (!simulations || simulations.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', p: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No simulations selected for comparison.
        </Typography>
      </Box>
    );
  }
  
  // Identify all the configuration sections and keys
  const configSections = [
    {
      name: 'Basic Information',
      keys: [
        { path: 'name', label: 'Name', format: (value: any) => value },
        { path: 'description', label: 'Description', format: (value: any) => value || 'No description' },
        { path: 'createdAt', label: 'Creation Date', format: (value: any) => new Date(value).toLocaleString() },
        { path: 'status', label: 'Status', format: (value: any) => value }
      ]
    },
    {
      name: 'Simulation Type',
      keys: [
        { path: 'config.simulationType', label: 'Type', format: (value: any) => value }
      ]
    },
    {
      name: 'Domain Configuration',
      keys: [
        { path: 'config.domain.region', label: 'Region', format: (value: any) => value },
        { path: 'config.domain.resolution', label: 'Resolution', format: (value: any) => value },
        { path: 'config.domain.verticalLevels', label: 'Vertical Levels', format: (value: any) => value }
      ]
    },
    {
      name: 'Time Configuration',
      keys: [
        { path: 'config.timeConfig.startDate', label: 'Start Date', format: (value: any) => value },
        { path: 'config.timeConfig.endDate', label: 'End Date', format: (value: any) => value },
        { path: 'config.timeConfig.timestep', label: 'Timestep (min)', format: (value: any) => value },
        { path: 'config.timeConfig.outputFrequency', label: 'Output Frequency (min)', format: (value: any) => value },
        { path: 'config.timeConfig.spinupPeriod', label: 'Spinup Period (days)', format: (value: any) => value || 'None' }
      ]
    },
    {
      name: 'Scientific Options',
      keys: [
        { path: 'config.scientificOptions.chemistry', label: 'Chemistry', format: (value: any) => value ? 'Enabled' : 'Disabled' },
        { path: 'config.scientificOptions.aerosols', label: 'Aerosols', format: (value: any) => value ? 'Enabled' : 'Disabled' },
        { path: 'config.scientificOptions.transport', label: 'Transport', format: (value: any) => value ? 'Enabled' : 'Disabled' },
        { path: 'config.scientificOptions.deposition', label: 'Deposition', format: (value: any) => value ? 'Enabled' : 'Disabled' },
        { path: 'config.scientificOptions.cloudProcesses', label: 'Cloud Processes', format: (value: any) => value ? 'Enabled' : 'Disabled' },
        { path: 'config.scientificOptions.carbonCycle', label: 'Carbon Cycle', format: (value: any) => value ? 'Enabled' : 'Disabled' }
      ]
    },
    {
      name: 'Compute Resources',
      keys: [
        { path: 'config.computeResources.instanceType', label: 'Instance Type', format: (value: any) => value },
        { path: 'config.computeResources.nodeCount', label: 'Node Count', format: (value: any) => value },
        { path: 'config.computeResources.maxWallTime', label: 'Max Wall Time (hours)', format: (value: any) => value },
        { path: 'config.computeResources.storage', label: 'Storage (GB)', format: (value: any) => value },
        { path: 'config.computeResources.priority', label: 'Priority', format: (value: any) => value }
      ]
    },
    {
      name: 'Additional Options',
      keys: [
        { path: 'config.additionalOptions.saveCheckpoints', label: 'Save Checkpoints', format: (value: any) => value ? 'Yes' : 'No' },
        { path: 'config.additionalOptions.checkpointFrequency', label: 'Checkpoint Frequency (hours)', format: (value: any) => value || 'N/A' },
        { path: 'config.additionalOptions.enableRestarts', label: 'Enable Restarts', format: (value: any) => value ? 'Yes' : 'No' },
        { path: 'config.additionalOptions.saveDebugOutput', label: 'Save Debug Output', format: (value: any) => value ? 'Yes' : 'No' },
        { path: 'config.additionalOptions.outputFormat', label: 'Output Format', format: (value: any) => value },
        { path: 'config.additionalOptions.compressionLevel', label: 'Compression Level', format: (value: any) => value }
      ]
    }
  ];
  
  // Function to safely get a nested property from an object
  const getNestedProperty = (obj: any, path: string) => {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  };
  
  // Check if values are different
  const valuesAreDifferent = (values: any[]) => {
    if (values.length <= 1) return false;
    
    const firstValue = JSON.stringify(values[0]);
    return values.some(value => JSON.stringify(value) !== firstValue);
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configuration Comparison
      </Typography>
      <Typography variant="body1" paragraph>
        Compare configuration settings between the selected simulations. Differences are highlighted.
      </Typography>
      
      {configSections.map((section) => (
        <Accordion key={section.name} defaultExpanded={section.name === 'Basic Information'}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`${section.name}-content`}
            id={`${section.name}-header`}
          >
            <Typography variant="subtitle1">{section.name}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell 
                      sx={{ 
                        backgroundColor: 'background.default',
                        fontWeight: 'bold' 
                      }}
                    >
                      Parameter
                    </TableCell>
                    {simulations.map((sim, index) => (
                      <TableCell 
                        key={sim.id}
                        sx={{ 
                          backgroundColor: 'background.default',
                          fontWeight: 'bold' 
                        }}
                      >
                        Simulation {index + 1}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {section.keys.map((key) => {
                    const values = simulations.map(sim => getNestedProperty(sim, key.path));
                    const hasDifferences = valuesAreDifferent(values);
                    
                    return (
                      <TableRow key={key.path} sx={{ 
                        backgroundColor: hasDifferences ? 'rgba(255, 235, 59, 0.1)' : 'inherit' 
                      }}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {key.label}
                            {hasDifferences && (
                              <Tooltip title="Values differ between simulations">
                                <InfoIcon color="warning" fontSize="small" sx={{ ml: 1 }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        
                        {values.map((value, index) => (
                          <TableCell key={index}>
                            {value !== undefined && value !== null ? (
                              <>
                                {typeof value === 'boolean' ? (
                                  value ? (
                                    <CheckIcon color="success" fontSize="small" />
                                  ) : (
                                    <CloseIcon color="error" fontSize="small" />
                                  )
                                ) : key.format(value)}
                              </>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Not set
                              </Typography>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}
      
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Key Configuration Differences
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2">
            {configSections.reduce((differences, section) => {
              const sectionDiffs = section.keys.filter(key => {
                const values = simulations.map(sim => getNestedProperty(sim, key.path));
                return valuesAreDifferent(values);
              }).map(key => key.label);
              
              if (sectionDiffs.length > 0) {
                differences.push(`${section.name}: ${sectionDiffs.join(', ')}`);
              }
              
              return differences;
            }, [] as string[]).join('\n')}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};

export default ConfigComparison;