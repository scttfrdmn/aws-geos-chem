import React from 'react';
import { Simulation } from '../../store/slices/simulationsSlice';

// MUI components
import {
  Box,
  Paper,
  Typography,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Alert,
  Chip,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/material';

// MUI icons
import {
  PlayArrow as StartIcon,
  Check as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Sync as RunningIcon,
  Create as CreateIcon,
  CloudUpload as SubmitIcon,
  Storage as DataIcon,
  Code as ProcessingIcon,
  Save as SaveIcon
} from '@mui/icons-material';

interface StatusUpdate {
  timestamp: string;
  status: string;
  message: string;
}

interface TimelineViewProps {
  simulation: Simulation;
  statusUpdates: StatusUpdate[];
}

const TimelineView: React.FC<TimelineViewProps> = ({ simulation, statusUpdates }) => {
  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Get icon for status
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CREATED':
        return <CreateIcon />;
      case 'SUBMITTED':
        return <SubmitIcon />;
      case 'RUNNING':
        return <RunningIcon />;
      case 'SUCCEEDED':
        return <SuccessIcon />;
      case 'FAILED':
        return <ErrorIcon />;
      case 'CANCELED':
        return <ErrorIcon />;
      default:
        return <PendingIcon />;
    }
  };
  
  // Get color for status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CREATED':
        return 'default';
      case 'SUBMITTED':
        return 'info';
      case 'RUNNING':
        return 'primary';
      case 'SUCCEEDED':
        return 'success';
      case 'FAILED':
        return 'error';
      case 'CANCELED':
        return 'warning';
      default:
        return 'default';
    }
  };
  
  // Generate timeline events
  const generateTimelineEvents = () => {
    const events = [...statusUpdates];
    
    // Add more detailed events for demonstration purposes
    if (simulation.status === 'RUNNING' || 
        simulation.status === 'SUCCEEDED' || 
        simulation.status === 'FAILED') {
      // Add data download event
      const dataDownloadTimestamp = new Date(
        new Date(events.find(e => e.status === 'RUNNING')?.timestamp || new Date()).getTime() + 10 * 60 * 1000
      ).toISOString();
      
      events.push({
        timestamp: dataDownloadTimestamp,
        status: 'INFO',
        message: 'Downloading input data from S3'
      });
      
      // Add simulation start event
      const simStartTimestamp = new Date(
        new Date(dataDownloadTimestamp).getTime() + 15 * 60 * 1000
      ).toISOString();
      
      events.push({
        timestamp: simStartTimestamp,
        status: 'INFO',
        message: 'GEOS-Chem simulation started'
      });
      
      // Add checkpointing event
      const checkpointTimestamp = new Date(
        new Date(simStartTimestamp).getTime() + 30 * 60 * 1000
      ).toISOString();
      
      events.push({
        timestamp: checkpointTimestamp,
        status: 'INFO',
        message: 'Creating checkpoint'
      });
      
      // For completed or failed simulations, add appropriate events
      if (simulation.status === 'SUCCEEDED' || simulation.status === 'FAILED') {
        const finalEvent = events.find(e => 
          e.status === 'SUCCEEDED' || e.status === 'FAILED'
        );
        
        if (finalEvent) {
          const finalEventTime = new Date(finalEvent.timestamp).getTime();
          
          // Add processing event
          const processingTimestamp = new Date(
            finalEventTime - 20 * 60 * 1000
          ).toISOString();
          
          events.push({
            timestamp: processingTimestamp,
            status: 'INFO',
            message: 'Processing simulation results'
          });
          
          // Add data upload event
          const uploadTimestamp = new Date(
            finalEventTime - 10 * 60 * 1000
          ).toISOString();
          
          events.push({
            timestamp: uploadTimestamp,
            status: 'INFO',
            message: 'Uploading results to S3'
          });
        }
      }
    }
    
    // Sort events by timestamp
    return events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };
  
  const timelineEvents = generateTimelineEvents();
  
  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Simulation Timeline
        </Typography>
        
        <Divider sx={{ mb: 3 }} />
        
        <Timeline position="alternate">
          {timelineEvents.map((event, index) => (
            <TimelineItem key={index}>
              <TimelineOppositeContent color="text.secondary">
                {formatTimestamp(event.timestamp)}
              </TimelineOppositeContent>
              
              <TimelineSeparator>
                <TimelineDot color={getStatusColor(event.status)}>
                  {getStatusIcon(event.status)}
                </TimelineDot>
                {index < timelineEvents.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              
              <TimelineContent>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1">
                      {event.message}
                    </Typography>
                    
                    {event.status !== 'INFO' && (
                      <Chip 
                        label={event.status} 
                        size="small" 
                        color={getStatusColor(event.status) as any}
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          ))}
          
          {/* If simulation is still running, add a "Current" item */}
          {simulation.status === 'RUNNING' && (
            <TimelineItem>
              <TimelineOppositeContent color="text.secondary">
                {formatTimestamp(new Date().toISOString())}
              </TimelineOppositeContent>
              
              <TimelineSeparator>
                <TimelineDot color="primary" variant="outlined">
                  <RunningIcon />
                </TimelineDot>
              </TimelineSeparator>
              
              <TimelineContent>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1">
                      Current State
                    </Typography>
                    <Chip 
                      label="RUNNING" 
                      size="small" 
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          )}
        </Timeline>
        
        {/* Show note about detailed timeline */}
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            This timeline shows the major status changes in your simulation. For more detailed logs, please check the Logs tab.
          </Typography>
        </Alert>
      </Paper>
      
      {/* Simulation Steps Overview */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Simulation Steps
        </Typography>
        
        <Divider sx={{ mb: 3 }} />
        
        <Stepper orientation="vertical">
          <Step active={true} completed={true}>
            <StepLabel StepIconProps={{ icon: <CreateIcon /> }}>
              Create Simulation
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                Simulation created at {formatTimestamp(simulation.createdAt)}
              </Typography>
            </StepContent>
          </Step>
          
          <Step active={true} completed={
            simulation.status !== 'CREATED'
          }>
            <StepLabel StepIconProps={{ icon: <SubmitIcon /> }}>
              Submit to AWS Batch
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                {simulation.status !== 'CREATED'
                  ? `Submitted to AWS Batch at ${formatTimestamp(simulation.updatedAt)}`
                  : 'Waiting for submission'
                }
              </Typography>
            </StepContent>
          </Step>
          
          <Step active={
            simulation.status === 'RUNNING' || 
            simulation.status === 'SUCCEEDED' || 
            simulation.status === 'FAILED'
          } completed={
            simulation.status === 'SUCCEEDED' || 
            simulation.status === 'FAILED'
          }>
            <StepLabel StepIconProps={{ icon: <DataIcon /> }}>
              Download Input Data
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                {simulation.status === 'RUNNING' || 
                 simulation.status === 'SUCCEEDED' || 
                 simulation.status === 'FAILED'
                  ? 'Input data downloaded from S3'
                  : 'Waiting for data download'
                }
              </Typography>
            </StepContent>
          </Step>
          
          <Step active={
            simulation.status === 'RUNNING' || 
            simulation.status === 'SUCCEEDED' || 
            simulation.status === 'FAILED'
          } completed={
            simulation.status === 'SUCCEEDED' || 
            simulation.status === 'FAILED'
          }>
            <StepLabel StepIconProps={{ icon: <RunningIcon /> }}>
              Execute GEOS-Chem
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                {simulation.status === 'RUNNING'
                  ? 'GEOS-Chem simulation is currently running'
                  : simulation.status === 'SUCCEEDED' || simulation.status === 'FAILED'
                    ? 'GEOS-Chem execution completed'
                    : 'Waiting for execution'
                }
              </Typography>
              {simulation.progress !== undefined && simulation.progress > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Progress: {Math.round(simulation.progress)}%
                </Typography>
              )}
            </StepContent>
          </Step>
          
          <Step active={
            simulation.status === 'SUCCEEDED' || 
            simulation.status === 'FAILED'
          } completed={
            simulation.status === 'SUCCEEDED' || 
            simulation.status === 'FAILED'
          }>
            <StepLabel StepIconProps={{ icon: <ProcessingIcon /> }}>
              Process Results
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                {simulation.status === 'SUCCEEDED' || simulation.status === 'FAILED'
                  ? 'Results processing completed'
                  : 'Waiting for processing'
                }
              </Typography>
            </StepContent>
          </Step>
          
          <Step active={
            simulation.status === 'SUCCEEDED' || 
            simulation.status === 'FAILED'
          } completed={
            simulation.status === 'SUCCEEDED' || 
            simulation.status === 'FAILED'
          }>
            <StepLabel StepIconProps={{ icon: <SaveIcon /> }}>
              Save Results
            </StepLabel>
            <StepContent>
              <Typography variant="body2">
                {simulation.status === 'SUCCEEDED'
                  ? 'Results saved successfully'
                  : simulation.status === 'FAILED'
                    ? 'Results saving failed or incomplete'
                    : 'Waiting for results'
                }
              </Typography>
              {simulation.s3ResultsPath && (
                <Typography variant="body2" color="text.secondary">
                  Results path: {simulation.s3ResultsPath}
                </Typography>
              )}
            </StepContent>
          </Step>
        </Stepper>
      </Paper>
    </Box>
  );
};

export default TimelineView;