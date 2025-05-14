import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Toolbar,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
  Description as TextIcon,
  Image as ImageIcon,
  TableChart as CSVIcon,
  DataObject as NetCDFIcon,
  Storage as BpchIcon
} from '@mui/icons-material';
import { getFileContent, downloadFile } from '../../services/simulationService';
import NetCDFViewer from './NetCDFViewer';
import BpchViewer from './BpchViewer';

// Syntax highlighting imports
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface FileViewerProps {
  filePath: string;
  simulationId: string;
}

type FileType = 'text' | 'image' | 'netcdf' | 'csv' | 'binary' | 'bpch' | 'unknown';

const FileViewer: React.FC<FileViewerProps> = ({ filePath, simulationId }) => {
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<FileType>('unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'auto' | 'text' | 'hex'>('auto');

  const determineFileType = (path: string, content?: string): FileType => {
    const extension = path.split('.').pop()?.toLowerCase() || '';
    const fileName = path.split('/').pop()?.toLowerCase() || '';

    switch (extension) {
      case 'txt':
      case 'log':
      case 'f90':
      case 'f':
      case 'py':
      case 'sh':
      case 'json':
      case 'yaml':
      case 'yml':
      case 'xml':
      case 'md':
        return 'text';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'bmp':
        return 'image';
      case 'nc':
      case 'nc4':
        return 'netcdf';
      case 'csv':
      case 'tsv':
        return 'csv';
      case 'bpch':
        return 'bpch';
      default:
        // Check for BPCH files (they often don't have extensions but have specific naming patterns)
        if (fileName.includes('trac_avg') ||
            fileName.includes('ctm.bpch') ||
            fileName.includes('gctm.') ||
            fileName.endsWith('.bpch')) {
          return 'bpch';
        }

        // Try to determine if it's text by checking content
        if (content && isTextContent(content)) {
          return 'text';
        }
        return 'binary';
    }
  };

  const isTextContent = (content: string): boolean => {
    // Simple heuristic to check if content is text
    // Real implementation would be more sophisticated
    const nonTextChars = content.slice(0, 1000).match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g);
    return !nonTextChars || nonTextChars.length < content.length * 0.1;
  };

  const getLanguageForSyntaxHighlighting = (path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase() || '';
    
    switch (extension) {
      case 'py': return 'python';
      case 'f90': case 'f': return 'fortran';
      case 'sh': return 'bash';
      case 'json': return 'json';
      case 'yaml': case 'yml': return 'yaml';
      case 'xml': return 'xml';
      case 'md': return 'markdown';
      case 'csv': return 'csv';
      default: return 'text';
    }
  };

  const loadFileContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const content = await getFileContent(simulationId, filePath);
      setFileContent(content);
      setFileType(determineFileType(filePath, content));
    } catch (err) {
      setError(`Failed to load file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewModeChange = (event: SelectChangeEvent<string>) => {
    setViewMode(event.target.value as 'auto' | 'text' | 'hex');
  };

  const handleDownload = () => {
    downloadFile(simulationId, filePath);
  };

  const handleRefresh = () => {
    loadFileContent();
  };

  // Get file name from path
  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };

  // Render file content based on type and view mode
  const renderFileContent = () => {
    if (!fileContent) {
      return (
        <Typography variant="body2" color="text.secondary">
          No content to display
        </Typography>
      );
    }

    // Override with text mode if user selected it
    const effectiveFileType = viewMode === 'text' ? 'text' : fileType;
    
    switch (effectiveFileType) {
      case 'text':
        return (
          <Box sx={{ maxHeight: '60vh', overflow: 'auto', borderRadius: 1 }}>
            <SyntaxHighlighter
              language={getLanguageForSyntaxHighlighting(filePath)}
              style={materialLight}
              showLineNumbers
              customStyle={{ margin: 0 }}
            >
              {fileContent}
            </SyntaxHighlighter>
          </Box>
        );
        
      case 'image':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <img 
              src={`data:image;base64,${fileContent}`}
              alt={getFileName(filePath)}
              style={{ maxWidth: '100%', maxHeight: '60vh' }}
            />
          </Box>
        );
        
      case 'csv':
        // Simple CSV renderer - a more sophisticated implementation would use a table component
        return (
          <Box sx={{ maxHeight: '60vh', overflow: 'auto', borderRadius: 1, fontFamily: 'monospace' }}>
            <pre>
              {fileContent.split('\n').slice(0, 1000).join('\n')}
              {fileContent.split('\n').length > 1000 ? '\n[Content truncated...]' : ''}
            </pre>
          </Box>
        );
        
      case 'netcdf':
        return (
          <Box sx={{ p: 2 }}>
            <NetCDFViewer simulationId={simulationId} filePath={filePath} />
          </Box>
        );

      case 'bpch':
        return (
          <Box sx={{ p: 2 }}>
            <BpchViewer simulationId={simulationId} filePath={filePath} />
          </Box>
        );
        
      case 'binary':
      default:
        if (viewMode === 'hex') {
          // Simple hex viewer
          return (
            <Box 
              sx={{ 
                maxHeight: '60vh', 
                overflow: 'auto', 
                fontFamily: 'monospace', 
                fontSize: '0.875rem',
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 1
              }}
            >
              {renderHexDump(fileContent)}
            </Box>
          );
        } else {
          return (
            <Box sx={{ p: 2 }}>
              <Typography variant="body1" gutterBottom>
                This file type cannot be displayed in the browser.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The file appears to be a binary file. You can try to view it as text or download it to open in an appropriate application.
              </Typography>
            </Box>
          );
        }
    }
  };

  // Render hex dump of content
  const renderHexDump = (content: string) => {
    const bytes = new TextEncoder().encode(content);
    let hexOutput = '';
    let asciiOutput = '';
    let result = '';
    
    for (let i = 0; i < Math.min(bytes.length, 2000); i++) {
      // Add address at the beginning of each line
      if (i % 16 === 0) {
        if (i > 0) {
          result += `${hexOutput}  |${asciiOutput}|\n`;
          hexOutput = '';
          asciiOutput = '';
        }
        result += `${i.toString(16).padStart(8, '0')}: `;
      }
      
      // Add hex representation
      hexOutput += `${bytes[i].toString(16).padStart(2, '0')} `;
      
      // Add ASCII representation
      const char = bytes[i] >= 32 && bytes[i] <= 126 ? String.fromCharCode(bytes[i]) : '.';
      asciiOutput += char;
    }
    
    // Add the last line if there's anything left
    if (hexOutput) {
      result += `${hexOutput.padEnd(48, ' ')}  |${asciiOutput}|\n`;
    }
    
    if (bytes.length > 2000) {
      result += '\n[Content truncated...]';
    }
    
    return result;
  };

  useEffect(() => {
    loadFileContent();
  }, [filePath]);

  // Get file icon based on type
  const getFileIcon = () => {
    switch (fileType) {
      case 'text': return <TextIcon />;
      case 'image': return <ImageIcon />;
      case 'csv': return <CSVIcon />;
      case 'netcdf': return <NetCDFIcon />;
      case 'bpch': return <BpchIcon />;
      default: return <CodeIcon />;
    }
  };

  return (
    <Box>
      <Paper 
        variant="outlined" 
        sx={{ borderRadius: 1, mb: 2 }}
      >
        <Toolbar variant="dense" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            {getFileIcon()}
            <Typography variant="subtitle1" sx={{ ml: 1 }}>
              {getFileName(filePath)}
            </Typography>
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <FormControl variant="standard" sx={{ minWidth: 120, mr: 2 }}>
            <InputLabel id="view-mode-label">View As</InputLabel>
            <Select
              labelId="view-mode-label"
              id="view-mode-select"
              value={viewMode}
              onChange={handleViewModeChange}
              label="View As"
            >
              <MenuItem value="auto">Auto-detect</MenuItem>
              <MenuItem value="text">Text</MenuItem>
              <MenuItem value="hex">Hex</MenuItem>
            </Select>
          </FormControl>
          
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Download">
            <IconButton onClick={handleDownload}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
        
        <Box sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            renderFileContent()
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default FileViewer;