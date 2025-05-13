import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API } from 'aws-amplify';

// Types
export interface Simulation {
  simulationId: string;
  name: string;
  status: 'CREATED' | 'SUBMITTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  userId: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  config: {
    simulationType: 'GC_CLASSIC' | 'GCHP';
    chemistryOption: string;
    domain: string;
    resolution: string;
    timeConfig: {
      startDate: string;
      endDate: string;
      outputFrequency: string;
    };
    computeConfig: {
      instanceType: string;
      useSpot: boolean;
    };
  };
  estimatedCost?: number;
  estimatedRuntime?: number;
  currentCost?: number;
  progress?: number;
  error?: string;
  batchJobId?: string;
  s3ResultsPath?: string;
}

interface SimulationsState {
  simulations: Simulation[];
  currentSimulation: Simulation | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
}

const initialState: SimulationsState = {
  simulations: [],
  currentSimulation: null,
  loading: false,
  error: null,
  submitting: false
};

// Async thunks
export const fetchSimulations = createAsyncThunk(
  'simulations/fetchSimulations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', '/api/simulations', {});
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
      const response = await API.get('GeosChemAPI', `/api/simulations/${id}`, {});
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
      const response = await API.post('GeosChemAPI', '/api/simulations', {
        body: simulationData
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create simulation');
    }
  }
);

export const submitSimulation = createAsyncThunk(
  'simulations/submitSimulation',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await API.put('GeosChemAPI', `/api/simulations/${id}/submit`, {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to submit simulation');
    }
  }
);

export const cancelSimulation = createAsyncThunk(
  'simulations/cancelSimulation',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await API.put('GeosChemAPI', `/api/simulations/${id}/cancel`, {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to cancel simulation');
    }
  }
);

export const deleteSimulation = createAsyncThunk(
  'simulations/deleteSimulation',
  async (id: string, { rejectWithValue }) => {
    try {
      await API.del('GeosChemAPI', `/api/simulations/${id}`, {});
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete simulation');
    }
  }
);

export const estimateSimulationCost = createAsyncThunk(
  'simulations/estimateSimulationCost',
  async (simulationConfig: Partial<Simulation['config']>, { rejectWithValue }) => {
    try {
      const response = await API.post('GeosChemAPI', '/api/configurations/cost-estimate', {
        body: simulationConfig
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to estimate simulation cost');
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
        state.simulations = action.payload;
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
        state.simulations.push(action.payload);
        state.currentSimulation = action.payload;
        state.submitting = false;
      })
      .addCase(createSimulation.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload as string;
      })
      
      // Submit Simulation
      .addCase(submitSimulation.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(submitSimulation.fulfilled, (state, action) => {
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
        state.submitting = false;
      })
      .addCase(submitSimulation.rejected, (state, action) => {
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
        state.loading = false;
      })
      .addCase(deleteSimulation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Estimate Simulation Cost
      .addCase(estimateSimulationCost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(estimateSimulationCost.fulfilled, (state, action) => {
        if (state.currentSimulation) {
          state.currentSimulation.estimatedCost = action.payload.estimatedCost;
          state.currentSimulation.estimatedRuntime = action.payload.estimatedRuntime;
        }
        state.loading = false;
      })
      .addCase(estimateSimulationCost.rejected, (state, action) => {
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