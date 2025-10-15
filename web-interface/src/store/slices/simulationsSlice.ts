import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as simulationService from '../../services/simulationService';

// Types
export interface Simulation {
  simulationId: string;
  name?: string;
  status: 'SUBMITTED' | 'PENDING' | 'RUNNABLE' | 'STARTING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  userId: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  simulationType: 'GC_CLASSIC' | 'GCHP';
  startDate: string;
  endDate: string;
  resolution: string;
  chemistry?: string;
  processorType?: 'graviton4' | 'graviton3' | 'amd' | 'intel';
  instanceSize?: 'small' | 'medium' | 'large' | 'xlarge';
  useSpot?: boolean;
  estimatedCost?: number;
  estimatedRuntime?: number;
  actualCost?: number;
  actualRuntime?: number;
  throughput?: number;
  progress?: number;
  statusDetails?: string;
  batchJobId?: string;
  executionArn?: string;
  inputPath?: string;
  outputPath?: string;
  resultPath?: string;
  manifestPath?: string;
}

interface SimulationsState {
  simulations: Simulation[];
  currentSimulation: Simulation | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  nextToken?: string;
  count: number;
}

const initialState: SimulationsState = {
  simulations: [],
  currentSimulation: null,
  loading: false,
  error: null,
  submitting: false,
  nextToken: undefined,
  count: 0
};

// Async thunks
export const fetchSimulations = createAsyncThunk(
  'simulations/fetchSimulations',
  async (params: { status?: string; limit?: number; nextToken?: string } = {}, { rejectWithValue }) => {
    try {
      const response = await simulationService.getSimulations(
        params.status,
        params.limit,
        params.nextToken
      );
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch simulations');
    }
  }
);

export const fetchSimulationById = createAsyncThunk(
  'simulations/fetchSimulationById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await simulationService.getSimulation(id);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch simulation');
    }
  }
);

export const createSimulation = createAsyncThunk(
  'simulations/createSimulation',
  async (simulationData: Partial<Simulation>, { rejectWithValue }) => {
    try {
      const response = await simulationService.createSimulation(simulationData as any);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create simulation');
    }
  }
);

export const cancelSimulation = createAsyncThunk(
  'simulations/cancelSimulation',
  async (id: string, { rejectWithValue }) => {
    try {
      await simulationService.cancelSimulation(id);
      // Fetch the updated simulation after cancellation
      const updatedSimulation = await simulationService.getSimulation(id);
      return updatedSimulation;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to cancel simulation');
    }
  }
);

export const deleteSimulation = createAsyncThunk(
  'simulations/deleteSimulation',
  async (id: string, { rejectWithValue }) => {
    try {
      await simulationService.deleteSimulation(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete simulation');
    }
  }
);

// Slice
const simulationsSlice = createSlice({
  name: 'simulations',
  initialState,
  reducers: {
    resetCurrentSimulation: (state) => {
      state.currentSimulation = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateSimulationProgress: (state, action: PayloadAction<{ id: string; progress: number }>) => {
      const { id, progress } = action.payload;
      const simulation = state.simulations.find(sim => sim.simulationId === id);
      if (simulation) {
        simulation.progress = progress;
      }
      if (state.currentSimulation && state.currentSimulation.simulationId === id) {
        state.currentSimulation.progress = progress;
      }
    },
    updateSimulationCost: (state, action: PayloadAction<{ id: string; cost: number }>) => {
      const { id, cost } = action.payload;
      const simulation = state.simulations.find(sim => sim.simulationId === id);
      if (simulation) {
        simulation.currentCost = cost;
      }
      if (state.currentSimulation && state.currentSimulation.simulationId === id) {
        state.currentSimulation.currentCost = cost;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Simulations
      .addCase(fetchSimulations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSimulations.fulfilled, (state, action) => {
        state.simulations = action.payload.simulations;
        state.count = action.payload.count;
        state.nextToken = action.payload.nextToken;
        state.loading = false;
      })
      .addCase(fetchSimulations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch Simulation By Id
      .addCase(fetchSimulationById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSimulationById.fulfilled, (state, action) => {
        state.currentSimulation = action.payload;
        state.loading = false;
      })
      .addCase(fetchSimulationById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Create Simulation
      .addCase(createSimulation.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(createSimulation.fulfilled, (state, action) => {
        state.simulations.unshift(action.payload);
        state.currentSimulation = action.payload;
        state.count = state.count + 1;
        state.submitting = false;
      })
      .addCase(createSimulation.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload as string;
      })
      
      // Cancel Simulation
      .addCase(cancelSimulation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelSimulation.fulfilled, (state, action) => {
        const updatedSimulation = action.payload;
        const index = state.simulations.findIndex(
          sim => sim.simulationId === updatedSimulation.simulationId
        );
        if (index !== -1) {
          state.simulations[index] = updatedSimulation;
        }
        if (state.currentSimulation?.simulationId === updatedSimulation.simulationId) {
          state.currentSimulation = updatedSimulation;
        }
        state.loading = false;
      })
      .addCase(cancelSimulation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Delete Simulation
      .addCase(deleteSimulation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteSimulation.fulfilled, (state, action) => {
        const id = action.payload;
        state.simulations = state.simulations.filter(sim => sim.simulationId !== id);
        if (state.currentSimulation?.simulationId === id) {
          state.currentSimulation = null;
        }
        state.count = Math.max(0, state.count - 1);
        state.loading = false;
      })
      .addCase(deleteSimulation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { 
  resetCurrentSimulation, 
  clearError, 
  updateSimulationProgress, 
  updateSimulationCost 
} = simulationsSlice.actions;
export default simulationsSlice.reducer;