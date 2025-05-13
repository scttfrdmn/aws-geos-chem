import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API } from 'aws-amplify';
import { Simulation, SimulationConfig } from '../../types/simulation';

// Types
interface BatchTemplate {
  id: string;
  name: string;
  description?: string;
  config: SimulationConfig;
  createdAt: string;
  updatedAt: string;
  userId: string;
  username: string;
}

interface BatchSimulation {
  id: string;
  batchId: string;
  name: string;
  description?: string;
  status: string;
  parameters: Record<string, any>;
  cost: number;
  startedAt?: string;
  completedAt?: string;
  simulationId: string;
}

interface BatchJob {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  username: string;
  status: 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  templateId: string;
  parameters: any[];
  computeConfig: any;
  totalSimulations: number;
  completedSimulations: number;
  failedSimulations: number;
  estimatedCost: number;
  actualCost: number;
  simulations: BatchSimulation[];
}

interface BatchState {
  templates: BatchTemplate[];
  batchJobs: BatchJob[];
  currentBatch: BatchJob | null;
  loading: boolean;
  error: string | null;
}

const initialState: BatchState = {
  templates: [],
  batchJobs: [],
  currentBatch: null,
  loading: false,
  error: null
};

// Async thunks
export const fetchSimulationTemplates = createAsyncThunk(
  'batch/fetchSimulationTemplates',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', '/templates', {});
      return response.templates;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch templates');
    }
  }
);

export const fetchBatchJobs = createAsyncThunk(
  'batch/fetchBatchJobs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', '/batches', {});
      return response.batches;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch batch jobs');
    }
  }
);

export const fetchBatchDetails = createAsyncThunk(
  'batch/fetchBatchDetails',
  async (batchId: string, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', `/batches/${batchId}`, {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch batch details');
    }
  }
);

export const createBatchSimulations = createAsyncThunk(
  'batch/createBatchSimulations',
  async (batchConfig: any, { rejectWithValue }) => {
    try {
      const response = await API.post('GeosChemAPI', '/batches', {
        body: batchConfig
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create batch simulations');
    }
  }
);

export const cancelBatchJob = createAsyncThunk(
  'batch/cancelBatchJob',
  async (batchId: string, { rejectWithValue }) => {
    try {
      const response = await API.post('GeosChemAPI', `/batches/${batchId}/cancel`, {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to cancel batch job');
    }
  }
);

// Temporary templates for development
const temporaryTemplates: BatchTemplate[] = [
  {
    id: 'template-1',
    name: 'Global Fullchem Simulation',
    description: 'Standard global simulation with full chemistry at 4x5 resolution',
    config: {
      simulationType: 'fullchem',
      scientificOptions: {
        chemistry: true,
        aerosols: true,
        transport: true,
        deposition: true,
        cloudProcesses: true,
        carbonCycle: false
      },
      domain: {
        region: 'Global',
        resolution: '4x5',
        verticalLevels: 72
      },
      timeConfig: {
        startDate: '2019-01-01',
        endDate: '2019-02-01',
        timestep: 30,
        outputFrequency: 60
      },
      computeResources: {
        instanceType: 'c5.2xlarge',
        nodeCount: 1,
        maxWallTime: 24,
        storage: 100,
        priority: 'medium'
      },
      additionalOptions: {
        saveCheckpoints: true,
        checkpointFrequency: 6,
        enableRestarts: true,
        saveDebugOutput: false,
        outputFormat: 'netcdf',
        compressionLevel: 5
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'user-1',
    username: 'User'
  },
  {
    id: 'template-2',
    name: 'Regional Transport Study',
    description: 'High-resolution regional simulation focused on transport processes',
    config: {
      simulationType: 'transport',
      scientificOptions: {
        chemistry: false,
        aerosols: false,
        transport: true,
        deposition: true,
        cloudProcesses: false,
        carbonCycle: false
      },
      domain: {
        region: 'North America',
        resolution: '0.5x0.625',
        verticalLevels: 47
      },
      timeConfig: {
        startDate: '2020-06-01',
        endDate: '2020-07-01',
        timestep: 10,
        outputFrequency: 30
      },
      computeResources: {
        instanceType: 'c5.4xlarge',
        nodeCount: 2,
        maxWallTime: 48,
        storage: 200,
        priority: 'high'
      },
      additionalOptions: {
        saveCheckpoints: true,
        checkpointFrequency: 3,
        enableRestarts: true,
        saveDebugOutput: true,
        outputFormat: 'netcdf',
        compressionLevel: 4
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'user-1',
    username: 'User'
  },
  {
    id: 'template-3',
    name: 'Aerosol Study',
    description: 'Global simulation focused on aerosol processes and interactions',
    config: {
      simulationType: 'aerosol',
      scientificOptions: {
        chemistry: true,
        aerosols: true,
        transport: true,
        deposition: true,
        cloudProcesses: true,
        carbonCycle: false
      },
      domain: {
        region: 'Global',
        resolution: '2x2.5',
        verticalLevels: 72
      },
      timeConfig: {
        startDate: '2018-01-01',
        endDate: '2019-01-01',
        timestep: 20,
        outputFrequency: 180
      },
      computeResources: {
        instanceType: 'r5.2xlarge',
        nodeCount: 1,
        maxWallTime: 120,
        storage: 500,
        priority: 'medium'
      },
      additionalOptions: {
        saveCheckpoints: true,
        checkpointFrequency: 24,
        enableRestarts: true,
        saveDebugOutput: false,
        outputFormat: 'netcdf',
        compressionLevel: 7
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'user-1',
    username: 'User'
  }
];

// Slice
const batchSlice = createSlice({
  name: 'batch',
  initialState,
  reducers: {
    clearBatchError: (state) => {
      state.error = null;
    },
    clearCurrentBatch: (state) => {
      state.currentBatch = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Templates
      .addCase(fetchSimulationTemplates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSimulationTemplates.fulfilled, (state, action: PayloadAction<BatchTemplate[]>) => {
        // For development, use temporary templates
        // In production, would use: state.templates = action.payload;
        state.templates = temporaryTemplates;
        state.loading = false;
      })
      .addCase(fetchSimulationTemplates.rejected, (state, action) => {
        // For development, use temporary templates even on failure
        state.templates = temporaryTemplates;
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch Batch Jobs
      .addCase(fetchBatchJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBatchJobs.fulfilled, (state, action: PayloadAction<BatchJob[]>) => {
        state.batchJobs = action.payload;
        state.loading = false;
      })
      .addCase(fetchBatchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch Batch Details
      .addCase(fetchBatchDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBatchDetails.fulfilled, (state, action: PayloadAction<BatchJob>) => {
        state.currentBatch = action.payload;
        state.loading = false;
      })
      .addCase(fetchBatchDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Create Batch Simulations
      .addCase(createBatchSimulations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBatchSimulations.fulfilled, (state, action: PayloadAction<BatchJob>) => {
        state.batchJobs.push(action.payload);
        state.currentBatch = action.payload;
        state.loading = false;
      })
      .addCase(createBatchSimulations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Cancel Batch Job
      .addCase(cancelBatchJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelBatchJob.fulfilled, (state, action: PayloadAction<{ batchId: string }>) => {
        const { batchId } = action.payload;
        
        // Update batch job status in the list
        const batchIndex = state.batchJobs.findIndex(batch => batch.id === batchId);
        if (batchIndex !== -1) {
          state.batchJobs[batchIndex].status = 'CANCELLED';
        }
        
        // Update current batch if it's the one that was cancelled
        if (state.currentBatch && state.currentBatch.id === batchId) {
          state.currentBatch.status = 'CANCELLED';
        }
        
        state.loading = false;
      })
      .addCase(cancelBatchJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearBatchError, clearCurrentBatch } = batchSlice.actions;
export default batchSlice.reducer;