import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API, Storage } from 'aws-amplify';

// Types
export interface FileItem {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  type: 'file' | 'directory';
  path: string;
}

export interface NetCDFVariable {
  name: string;
  longName?: string;
  units?: string;
  dimensions: string[];
  shape: number[];
  attributes?: Record<string, any>;
}

export interface NetCDFDimension {
  name: string;
  size: number;
  values?: number[] | string[];
  units?: string;
}

export interface NetCDFMetadata {
  dimensions: NetCDFDimension[];
  variables: NetCDFVariable[];
  globalAttributes: Record<string, any>;
}

export interface Visualization {
  id: string;
  type: 'map' | 'timeseries' | 'profile' | 'summary' | 'spatial';
  title: string;
  description: string;
  imageUrl: string;
  createdAt: string;
  dataKey: string;
  simulationId: string;
  metadata?: NetCDFMetadata;
}

interface ResultsState {
  currentSimulationId: string | null;
  files: FileItem[];
  currentPath: string;
  visualizations: Visualization[];
  selectedFile: FileItem | null;
  netcdfMetadata: Record<string, NetCDFMetadata>; // Key is filePath
  selectedVariables: string[];
  loading: boolean;
  error: string | null;
  generatingVisualization: boolean;
}

const initialState: ResultsState = {
  currentSimulationId: null,
  files: [],
  currentPath: '',
  visualizations: [],
  selectedFile: null,
  netcdfMetadata: {},
  selectedVariables: [],
  loading: false,
  error: null,
  generatingVisualization: false
};

// Async thunks
export const fetchResultFiles = createAsyncThunk(
  'results/fetchResultFiles',
  async (
    { simulationId, path = '' }: { simulationId: string; path?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.get(
        'GeosChemAPI',
        `/api/results/${simulationId}/files`,
        {
          queryStringParameters: {
            path
          }
        }
      );
      return { simulationId, path, files: response.files };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch result files');
    }
  }
);

export const fetchFileDetails = createAsyncThunk(
  'results/fetchFileDetails',
  async (
    { simulationId, filePath }: { simulationId: string; filePath: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.get(
        'GeosChemAPI',
        `/api/results/${simulationId}/files/${encodeURIComponent(filePath)}`,
        {}
      );
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch file details');
    }
  }
);

export const downloadFile = createAsyncThunk(
  'results/downloadFile',
  async (
    { simulationId, filePath }: { simulationId: string; filePath: string },
    { rejectWithValue }
  ) => {
    try {
      // Get a pre-signed URL for the file
      const response = await API.get(
        'GeosChemAPI',
        `/api/results/${simulationId}/files/${encodeURIComponent(filePath)}/download`,
        {}
      );
      
      // Return the download URL
      return { url: response.downloadUrl, fileName: filePath.split('/').pop() };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to download file');
    }
  }
);

export const fetchVisualizations = createAsyncThunk(
  'results/fetchVisualizations',
  async (simulationId: string, { rejectWithValue }) => {
    try {
      const response = await API.get(
        'GeosChemAPI',
        `/api/results/${simulationId}/visualizations`,
        {}
      );
      return response.visualizations;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch visualizations');
    }
  }
);

export const generateVisualization = createAsyncThunk(
  'results/generateVisualization',
  async (
    {
      simulationId,
      fileKey,
      type,
      params
    }: {
      simulationId: string;
      fileKey: string;
      type: 'map' | 'timeseries' | 'profile' | 'summary' | 'spatial';
      params: any;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.post(
        'GeosChemAPI',
        `/api/results/${simulationId}/visualize`,
        {
          body: {
            fileKey,
            type,
            params
          }
        }
      );
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to generate visualization');
    }
  }
);

export const fetchNetCDFMetadata = createAsyncThunk(
  'results/fetchNetCDFMetadata',
  async (
    { simulationId, filePath }: { simulationId: string; filePath: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.get(
        'GeosChemAPI',
        `/api/results/${simulationId}/netcdf-metadata`,
        {
          queryStringParameters: {
            filePath
          }
        }
      );
      return { filePath, metadata: response.metadata };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch NetCDF metadata');
    }
  }
);

export const fetchNetCDFData = createAsyncThunk(
  'results/fetchNetCDFData',
  async (
    {
      simulationId,
      filePath,
      variable,
      dimensions
    }: {
      simulationId: string;
      filePath: string;
      variable: string;
      dimensions?: Record<string, number | [number, number]>;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.get(
        'GeosChemAPI',
        `/api/results/${simulationId}/netcdf-data`,
        {
          queryStringParameters: {
            filePath,
            variable,
            dimensions: dimensions ? JSON.stringify(dimensions) : undefined
          }
        }
      );
      return { filePath, variable, data: response.data, metadata: response.metadata };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch NetCDF data');
    }
  }
);

// Slice
const resultsSlice = createSlice({
  name: 'results',
  initialState,
  reducers: {
    clearSelectedFile: (state) => {
      state.selectedFile = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    setCurrentPath: (state, action: PayloadAction<string>) => {
      state.currentPath = action.payload;
    },
    setSelectedVariables: (state, action: PayloadAction<string[]>) => {
      state.selectedVariables = action.payload;
    },
    clearNetCDFMetadata: (state) => {
      state.netcdfMetadata = {};
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Result Files
      .addCase(fetchResultFiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchResultFiles.fulfilled, (state, action) => {
        const { simulationId, path, files } = action.payload;
        state.currentSimulationId = simulationId;
        state.currentPath = path;
        state.files = files;
        state.loading = false;
      })
      .addCase(fetchResultFiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch File Details
      .addCase(fetchFileDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFileDetails.fulfilled, (state, action) => {
        state.selectedFile = action.payload.file;
        state.loading = false;
      })
      .addCase(fetchFileDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Download File
      .addCase(downloadFile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(downloadFile.fulfilled, (state) => {
        state.loading = false;
        // The actual download is triggered in the component after the URL is received
      })
      .addCase(downloadFile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch Visualizations
      .addCase(fetchVisualizations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVisualizations.fulfilled, (state, action) => {
        state.visualizations = action.payload;
        state.loading = false;
      })
      .addCase(fetchVisualizations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Generate Visualization
      .addCase(generateVisualization.pending, (state) => {
        state.generatingVisualization = true;
        state.error = null;
      })
      .addCase(generateVisualization.fulfilled, (state, action) => {
        state.visualizations.push(action.payload);
        state.generatingVisualization = false;
      })
      .addCase(generateVisualization.rejected, (state, action) => {
        state.generatingVisualization = false;
        state.error = action.payload as string;
      })

      // Fetch NetCDF Metadata
      .addCase(fetchNetCDFMetadata.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNetCDFMetadata.fulfilled, (state, action) => {
        const { filePath, metadata } = action.payload;
        state.netcdfMetadata[filePath] = metadata;
        state.loading = false;
      })
      .addCase(fetchNetCDFMetadata.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch NetCDF Data
      .addCase(fetchNetCDFData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNetCDFData.fulfilled, (state, action) => {
        // Data is passed to the component directly, not stored in Redux
        // But we can update metadata if it's included
        const { filePath, metadata } = action.payload;
        if (metadata) {
          state.netcdfMetadata[filePath] = metadata;
        }
        state.loading = false;
      })
      .addCase(fetchNetCDFData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const {
  clearSelectedFile,
  clearError,
  setCurrentPath,
  setSelectedVariables,
  clearNetCDFMetadata
} = resultsSlice.actions;

// Selectors
export const selectNetCDFMetadata = (filePath: string) => (state: { results: ResultsState }) =>
  state.results.netcdfMetadata[filePath];

export default resultsSlice.reducer;