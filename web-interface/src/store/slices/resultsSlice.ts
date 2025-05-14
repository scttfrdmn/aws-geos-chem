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

interface SpatialVisualizationResult {
  simulationId: string;
  imageUrl: string;
  metadata: {
    variable: string;
    level?: string | number;
    time?: number;
    plotType: string;
    colormap: string;
    min: number;
    max: number;
    units: string;
  };
}

interface SpatialDifferenceResult {
  simulationId1: string;
  simulationId2: string;
  imageUrl: string;
  metadata: {
    variable: string;
    level?: string | number;
    time?: number;
    useRelativeDifference: boolean;
    colormap: string;
    min: number;
    max: number;
    units: string;
  };
}

interface ResultsState {
  currentSimulationId: string | null;
  files: FileItem[];
  currentPath: string;
  visualizations: Visualization[];
  selectedFile: FileItem | null;
  netcdfMetadata: Record<string, NetCDFMetadata>; // Key is filePath
  selectedVariables: string[];
  spatialVisualizations: Record<string, SpatialVisualizationResult>; // Key is simulationId
  spatialDifferences: Record<string, SpatialDifferenceResult>; // Key is simulationId1_simulationId2
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
  spatialVisualizations: {},
  spatialDifferences: {},
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

export const generateSpatialVisualization = createAsyncThunk(
  'results/generateSpatialVisualization',
  async (
    {
      simulationId,
      filePath,
      variable,
      level,
      time,
      plotType = 'horizontal',
      colormap = 'viridis',
    }: {
      simulationId: string;
      filePath: string;
      variable: string;
      level?: string | number;
      time?: number;
      plotType?: 'horizontal' | 'zonal' | 'vertical';
      colormap?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.post(
        'GeosChemAPI',
        `/api/results/${simulationId}/spatial-visualization`,
        {
          body: {
            filePath,
            variable,
            level,
            time,
            plotType,
            colormap
          }
        }
      );

      // In a real implementation, this would return the visualization URL
      // For now, we'll mock the response for demonstration
      return {
        simulationId,
        imageUrl: `https://via.placeholder.com/800x400?text=${simulationId}_${variable}_${level}_${time}`,
        metadata: {
          variable,
          level,
          time,
          plotType,
          colormap,
          min: 0,
          max: 100,
          units: 'ppb'
        }
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to generate spatial visualization');
    }
  }
);

export const generateSpatialDifferenceVisualization = createAsyncThunk(
  'results/generateSpatialDifferenceVisualization',
  async (
    {
      simulationId1,
      simulationId2,
      filePath1,
      filePath2,
      variable,
      level,
      time,
      useRelativeDifference = false,
      colormap = 'RdBu_r',
    }: {
      simulationId1: string;
      simulationId2: string;
      filePath1: string;
      filePath2: string;
      variable: string;
      level?: string | number;
      time?: number;
      useRelativeDifference?: boolean;
      colormap?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.post(
        'GeosChemAPI',
        `/api/results/spatial-difference`,
        {
          body: {
            simulationId1,
            simulationId2,
            filePath1,
            filePath2,
            variable,
            level,
            time,
            useRelativeDifference,
            colormap
          }
        }
      );

      // Mock response for demonstration
      return {
        simulationId1,
        simulationId2,
        imageUrl: `https://via.placeholder.com/800x400?text=diff_${simulationId2}_vs_${simulationId1}_${variable}_${useRelativeDifference ? 'relative' : 'absolute'}`,
        metadata: {
          variable,
          level,
          time,
          useRelativeDifference,
          colormap,
          min: -50,
          max: 50,
          units: useRelativeDifference ? '%' : 'ppb'
        }
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to generate spatial difference visualization');
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
      })

      // Generate Spatial Visualization
      .addCase(generateSpatialVisualization.pending, (state) => {
        state.generatingVisualization = true;
        state.error = null;
      })
      .addCase(generateSpatialVisualization.fulfilled, (state, action) => {
        const result = action.payload;
        state.spatialVisualizations[result.simulationId] = result;
        state.generatingVisualization = false;
      })
      .addCase(generateSpatialVisualization.rejected, (state, action) => {
        state.generatingVisualization = false;
        state.error = action.payload as string;
      })

      // Generate Spatial Difference Visualization
      .addCase(generateSpatialDifferenceVisualization.pending, (state) => {
        state.generatingVisualization = true;
        state.error = null;
      })
      .addCase(generateSpatialDifferenceVisualization.fulfilled, (state, action) => {
        const result = action.payload;
        // Create a key using both simulation IDs
        const key = `${result.simulationId1}_${result.simulationId2}`;
        state.spatialDifferences[key] = result;
        state.generatingVisualization = false;
      })
      .addCase(generateSpatialDifferenceVisualization.rejected, (state, action) => {
        state.generatingVisualization = false;
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

export const selectSpatialVisualization = (simulationId: string) => (state: { results: ResultsState }) =>
  state.results.spatialVisualizations[simulationId];

export const selectSpatialDifference = (simulationId1: string, simulationId2: string) => (state: { results: ResultsState }) =>
  state.results.spatialDifferences[`${simulationId1}_${simulationId2}`];

export default resultsSlice.reducer;