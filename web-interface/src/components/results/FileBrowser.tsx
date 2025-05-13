import React, { useState } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Paper,
  Divider,
  TextField,
  InputAdornment,
  Breadcrumbs,
  Link,
  Typography,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  Search as SearchIcon,
  NavigateNext as NavigateNextIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material';
import { SimulationResults } from '../../types/simulation';
import { downloadFile } from '../../services/simulationService';

interface FileBrowserProps {
  results: SimulationResults | null;
  onFileSelect: (filePath: string) => void;
  selectedFile: string | null;
}

type FileItem = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  children?: FileItem[];
};

const FileBrowser: React.FC<FileBrowserProps> = ({ results, onFileSelect, selectedFile }) => {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  if (!results || !results.files) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body1">No results available</Typography>
      </Box>
    );
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Navigate to a specific folder
  const navigateToFolder = (path: string[]) => {
    setCurrentPath(path);
  };

  // Navigate to a specific breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    navigateToFolder(currentPath.slice(0, index + 1));
  };

  // Get current directory contents based on path
  const getCurrentDirectory = () => {
    let currentDir: FileItem[] = results.files;
    
    // Navigate through the path
    for (const folder of currentPath) {
      const foundDir = currentDir.find(
        item => item.type === 'directory' && item.name === folder
      );
      
      if (foundDir && foundDir.children) {
        currentDir = foundDir.children;
      } else {
        return [];
      }
    }
    
    return currentDir;
  };

  // Filter files based on search query
  const filterFiles = (files: FileItem[]) => {
    if (!searchQuery) return files;
    
    return files.filter(file => 
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Handle file selection
  const handleFileClick = (file: FileItem) => {
    if (file.type === 'directory') {
      navigateToFolder([...currentPath, file.name]);
    } else {
      const fullPath = [...currentPath, file.name].join('/');
      onFileSelect(fullPath);
    }
  };

  // Handle file download
  const handleDownload = (event: React.MouseEvent, file: FileItem) => {
    event.stopPropagation();
    const fullPath = [...currentPath, file.name].join('/');
    
    if (results.simulationId) {
      downloadFile(results.simulationId, fullPath);
    }
  };

  const currentDirContents = getCurrentDirectory();
  const filteredContents = filterFiles(currentDirContents);

  return (
    <Box>
      {/* Search bar */}
      <Paper
        component="form"
        sx={{ p: '2px 4px', mb: 2, display: 'flex', alignItems: 'center' }}
      >
        <TextField
          fullWidth
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          variant="standard"
          sx={{ ml: 1, flex: 1 }}
        />
      </Paper>

      {/* Breadcrumbs navigation */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{ mb: 2 }}
      >
        <Link
          color="inherit"
          onClick={() => navigateToFolder([])}
          sx={{ cursor: 'pointer' }}
        >
          Root
        </Link>
        
        {currentPath.map((folder, index) => (
          <Link
            key={index}
            color={index === currentPath.length - 1 ? 'text.primary' : 'inherit'}
            onClick={() => handleBreadcrumbClick(index)}
            sx={{ cursor: 'pointer' }}
          >
            {folder}
          </Link>
        ))}
      </Breadcrumbs>

      {/* File listing */}
      <Paper variant="outlined" sx={{ maxHeight: 500, overflow: 'auto' }}>
        <List dense>
          {filteredContents.length === 0 ? (
            <ListItem>
              <ListItemText primary="No files found" />
            </ListItem>
          ) : (
            filteredContents.map((item, index) => (
              <React.Fragment key={item.path}>
                {index > 0 && <Divider />}
                <ListItemButton 
                  selected={selectedFile === [...currentPath, item.name].join('/')}
                  onClick={() => handleFileClick(item)}
                >
                  <ListItemIcon>
                    {item.type === 'directory' ? <FolderIcon color="primary" /> : <FileIcon />}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.name} 
                    secondary={item.type === 'file' ? (
                      item.size !== undefined ? formatBytes(item.size) : ''
                    ) : `Directory`}
                  />
                  {item.type === 'file' && (
                    <Tooltip title="Download file">
                      <IconButton 
                        edge="end" 
                        aria-label="download"
                        onClick={(e) => handleDownload(e, item)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItemButton>
              </React.Fragment>
            ))
          )}
        </List>
      </Paper>
    </Box>
  );
};

export default FileBrowser;