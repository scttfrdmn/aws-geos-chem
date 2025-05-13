import React, { useState, useEffect, useRef } from 'react';
import { API } from 'aws-amplify';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { addAlert } from '../../store/slices/uiSlice';

// MUI components
import {
  Box,
  Paper,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Button,
  ButtonGroup,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Alert,
  Tooltip,
  Grid,
  FormControlLabel,
  Switch
} from '@mui/material';

// MUI icons
import {
  Refresh as RefreshIcon,
  GetApp as DownloadIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  KeyboardArrowDown as ScrollDownIcon,
  ViewList as AllLogsIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface LogViewerProps {
  simulationId: string;
  logLevel: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  onLogLevelChange: (level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR') => void;
}

// Sample interface for a log entry
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

const LogViewer: React.FC<LogViewerProps> = ({ 
  simulationId,
  logLevel,
  onLogLevelChange
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Local state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [currentLogFile, setCurrentLogFile] = useState('geos.log');
  
  // Available log files
  const availableLogFiles = [
    { value: 'geos.log', label: 'Main Simulation Log' },
    { value: 'hemco.log', label: 'HEMCO Emissions Log' },
    { value: 'aws_batch.log', label: 'AWS Batch Job Log' },
    { value: 'system.log', label: 'System Log' }
  ];
  
  // Fetch simulation logs
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // This is just a mock implementation - replace with actual API call in production
      // const response = await API.get('GeosChemAPI', `/api/simulations/${simulationId}/logs`, {
      //   queryStringParameters: {
      //     file: currentLogFile,
      //     level: logLevel
      //   }
      // });
      
      // For demo purposes, generate mock log data
      const mockLogs = generateMockLogs(currentLogFile, logLevel);
      setLogs(mockLogs);
      
      // Apply any filters
      applyFilters(mockLogs, searchQuery);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setError(err.message || 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch logs on initial load and when parameters change
  useEffect(() => {
    fetchLogs();
    
    // Set up polling for logs if simulation is running
    const intervalId = setInterval(fetchLogs, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(intervalId);
  }, [simulationId, currentLogFile, logLevel]);
  
  // Generate mock logs for demonstration
  const generateMockLogs = (logFile: string, level: string): LogEntry[] => {
    // Mock log messages based on log file type
    const mockMessages: Record<string, string[]> = {
      'geos.log': [
        'Initializing GEOS-Chem simulation...',
        'Reading configuration files...',
        'Initializing transport module...',
        'Computing chemical mechanism...',
        'Timestep: 0000 completed successfully',
        'Timestep: 0001 completed successfully',
        'Writing restart file...',
        'Simulation progressing normally',
        'Warning: Negative tracer concentration detected, resetting to zero',
        'Error: Failed to read meteorology data'
      ],
      'hemco.log': [
        'HEMCO initialization started...',
        'Reading HEMCO configuration file...',
        'Processing emissions inventories...',
        'Applying scale factors to emissions...',
        'Warning: Missing emission data for some species',
        'Error: Invalid emission file format'
      ],
      'aws_batch.log': [
        'AWS Batch job started',
        'Setting up container environment',
        'Downloading input data from S3',
        'Starting GEOS-Chem simulation',
        'Checking resources utilization',
        'Warning: High memory usage detected',
        'Error: Job exceeded time limit'
      ],
      'system.log': [
        'System initialization...',
        'Container started with 8 cores',
        'Available memory: 16GB',
        'Disk space check: 100GB available',
        'CPU utilization: 75%',
        'Warning: High I/O wait times',
        'Error: Out of memory error detected'
      ]
    };
    
    // Create random logs with different levels
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const logEntries: LogEntry[] = [];
    const levelIndex = levels.indexOf(level);
    
    // Current time minus 1 hour
    let timestamp = Date.now() - 3600000;
    
    // Generate 100 log entries
    for (let i = 0; i < 100; i++) {
      // Randomly select level with bias towards less severe levels
      const random = Math.random();
      let logLevel = 'INFO';
      
      if (random < 0.1) {
        logLevel = 'ERROR';
      } else if (random < 0.25) {
        logLevel = 'WARN';
      } else if (random < 0.4) {
        logLevel = 'DEBUG';
      }
      
      // Only include logs of the selected level or higher severity
      if (levels.indexOf(logLevel) >= levelIndex) {
        // Randomly select a message for this log file
        const messages = mockMessages[logFile] || mockMessages['system.log'];
        const message = messages[Math.floor(Math.random() * messages.length)];
        
        // Create log entry
        logEntries.push({
          timestamp: new Date(timestamp).toISOString(),
          level: logLevel,
          message: message + (i % 10 === 0 ? ' (repeated)' : ''),
          source: logFile.split('.')[0]
        });
      }
      
      // Increment timestamp by random amount (1-10 seconds)
      timestamp += 1000 * (1 + Math.floor(Math.random() * 10));
    }
    
    return logEntries.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };
  
  // Apply filters to logs
  const applyFilters = (logs: LogEntry[], query: string) => {
    if (!query.trim()) {
      setFilteredLogs(logs);
      return;
    }
    
    const filtered = logs.filter(log => 
      log.message.toLowerCase().includes(query.toLowerCase()) ||
      log.source.toLowerCase().includes(query.toLowerCase())
    );
    
    setFilteredLogs(filtered);
  };
  
  // Handle search query change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    applyFilters(logs, query);
  };
  
  // Handle clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setFilteredLogs(logs);
  };
  
  // Handle log file change
  const handleLogFileChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setCurrentLogFile(e.target.value as string);
  };
  
  // Handle log level change
  const handleLogLevelChange = (e: React.MouseEvent<HTMLElement>, newLevel: string | null) => {
    if (newLevel) {
      onLogLevelChange(newLevel as 'INFO' | 'DEBUG' | 'WARN' | 'ERROR');
    }
  };
  
  // Handle refresh button click
  const handleRefresh = () => {
    fetchLogs();
  };
  
  // Handle download logs
  const handleDownload = () => {
    try {
      // Create a blob with the log data
      const logsToDownload = searchQuery ? filteredLogs : logs;
      const logText = logsToDownload.map(log => 
        `${log.timestamp} [${log.level}] [${log.source}] ${log.message}`
      ).join('\n');
      
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${simulationId}_${currentLogFile}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      dispatch(addAlert({
        type: 'success',
        message: 'Logs downloaded successfully',
        autoHideDuration: 3000
      }));
    } catch (err) {
      console.error('Error downloading logs:', err);
      dispatch(addAlert({
        type: 'error',
        message: 'Failed to download logs',
        autoHideDuration: 6000
      }));
    }
  };
  
  // Handle auto-scroll toggle
  const handleAutoScrollToggle = () => {
    setAutoScroll(!autoScroll);
  };
  
  // Handle timestamps toggle
  const handleTimestampsToggle = () => {
    setShowTimestamps(!showTimestamps);
  };
  
  // Scroll to bottom of logs when new logs arrive and auto-scroll is enabled
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);
  
  // Get logs to display
  const displayLogs = searchQuery ? filteredLogs : logs;
  
  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  // Get color for log level
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'error';
      case 'WARN':
        return 'warning';
      case 'INFO':
        return 'info';
      case 'DEBUG':
        return 'default';
      default:
        return 'default';
    }
  };
  
  // Get icon for log level
  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'WARN':
        return <WarningIcon color="warning" fontSize="small" />;
      case 'INFO':
        return <InfoIcon color="info" fontSize="small" />;
      case 'DEBUG':
        return <InfoIcon color="disabled" fontSize="small" />;
      default:
        return null;
    }
  };
  
  return (
    <Box>
      {/* Log controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="log-file-label">Log File</InputLabel>
              <Select
                labelId="log-file-label"
                id="log-file"
                value={currentLogFile}
                label="Log File"
                onChange={handleLogFileChange}
              >
                {availableLogFiles.map(file => (
                  <MenuItem key={file.value} value={file.value}>
                    {file.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <ToggleButtonGroup
              value={logLevel}
              exclusive
              onChange={handleLogLevelChange}
              aria-label="Log Level"
              size="small"
            >
              <ToggleButton value="DEBUG" aria-label="Debug">
                <Tooltip title="Debug">
                  <InfoIcon fontSize="small" color="disabled" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="INFO" aria-label="Info">
                <Tooltip title="Info">
                  <InfoIcon fontSize="small" color="info" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="WARN" aria-label="Warning">
                <Tooltip title="Warning">
                  <WarningIcon fontSize="small" color="warning" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="ERROR" aria-label="Error">
                <Tooltip title="Error">
                  <ErrorIcon fontSize="small" color="error" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          
          <Grid item xs={12} sm={4}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Tooltip title="Refresh Logs">
                <IconButton onClick={handleRefresh} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Download Logs">
                <IconButton onClick={handleDownload}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Search logs..."
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                  endAdornment: searchQuery && (
                    <IconButton
                      size="small"
                      onClick={handleClearSearch}
                      edge="end"
                    >
                      <ClearIcon />
                    </IconButton>
                  )
                }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={autoScroll}
                    onChange={handleAutoScrollToggle}
                    size="small"
                  />
                }
                label="Auto-scroll"
                sx={{ ml: 1 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={showTimestamps}
                    onChange={handleTimestampsToggle}
                    size="small"
                  />
                }
                label="Timestamps"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Log display */}
      <Paper 
        variant="outlined" 
        sx={{ 
          height: 500, 
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {loading && logs.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">
              {error}
            </Alert>
          </Box>
        ) : displayLogs.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              No logs available{searchQuery ? ' matching your search' : ''}
            </Typography>
          </Box>
        ) : (
          <Box
            ref={logContainerRef}
            sx={{
              overflowY: 'auto',
              height: '100%',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              p: 2,
              backgroundColor: 'background.default'
            }}
          >
            {displayLogs.map((log, index) => (
              <Box 
                key={index}
                sx={{ 
                  py: 0.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  borderBottom: index < displayLogs.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  opacity: log.level === 'DEBUG' ? 0.7 : 1
                }}
              >
                {getLogLevelIcon(log.level)}
                
                <Box sx={{ ml: 1, flex: 1 }}>
                  {showTimestamps && (
                    <Typography 
                      component="span" 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ mr: 1 }}
                    >
                      [{formatTimestamp(log.timestamp)}]
                    </Typography>
                  )}
                  
                  <Chip
                    label={log.level}
                    size="small"
                    color={getLogLevelColor(log.level) as any}
                    variant="outlined"
                    sx={{ mr: 1, fontSize: '0.7rem', height: 20 }}
                  />
                  
                  <Typography 
                    component="span" 
                    variant="body2"
                    sx={{ 
                      fontWeight: log.level === 'ERROR' || log.level === 'WARN' ? 'bold' : 'normal',
                      color: log.level === 'ERROR' ? 'error.main' : 
                             log.level === 'WARN' ? 'warning.main' : 'text.primary'
                    }}
                  >
                    {log.message}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        
        {/* Auto-scroll button (shows when auto-scroll is disabled) */}
        {!autoScroll && displayLogs.length > 0 && (
          <Box sx={{ 
            position: 'absolute', 
            bottom: 16, 
            right: 16,
            zIndex: 10
          }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                if (logContainerRef.current) {
                  logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                }
              }}
              startIcon={<ScrollDownIcon />}
              size="small"
            >
              Scroll to Bottom
            </Button>
          </Box>
        )}
      </Paper>
      
      {/* Stats and summary */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Showing {displayLogs.length} {searchQuery ? 'filtered ' : ''}logs
          {' '}
          (
          {displayLogs.filter(log => log.level === 'ERROR').length} errors,
          {' '}
          {displayLogs.filter(log => log.level === 'WARN').length} warnings
          )
        </Typography>
        
        <Typography variant="body2" color="text.secondary">
          Last updated: {new Date().toLocaleTimeString()}
          {loading && <CircularProgress size={12} sx={{ ml: 1 }} />}
        </Typography>
      </Box>
    </Box>
  );
};

export default LogViewer;