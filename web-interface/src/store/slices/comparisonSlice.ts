import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API } from 'aws-amplify';

// Types
interface ComparisonData {
  variables: string[];
  regions: string[];
  statistics: any;
  spatialData: any;
  timeSeriesData: any;
  plots: {
    [key: string]: string; // URL paths to generated plots
  };
}

interface ComparisonState {
  selectedSimulations: string[];
  comparisonData: ComparisonData | null;
  loading: boolean;
  error: string | null;
}

const initialState: ComparisonState = {
  selectedSimulations: [],
  comparisonData: null,
  loading: false,
  error: null
};

// Async thunks
export const fetchComparisonData = createAsyncThunk(
  'comparison/fetchData',
  async (simulationIds: string[], { rejectWithValue }) => {
    try {
      const response = await API.post('GeosChemAPI', '/simulations/compare', {
        body: {
          simulationIds
        }
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch comparison data');
    }
  }
);

export const generateComparisonPlot = createAsyncThunk(
  'comparison/generatePlot',
  async (
    { 
      simulationIds, 
      plotType, 
      variable, 
      region, 
      level, 
      options 
    }: { 
      simulationIds: string[];
      plotType: string;
      variable: string;
      region: string;
      level: string;
      options?: any;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.post('GeosChemAPI', '/simulations/compare/plot', {
        body: {
          simulationIds,
          plotType,
          variable,
          region,
          level,
          options
        }
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to generate comparison plot');
    }
  }
);

// Sample data for development/testing
const sampleComparisonData: ComparisonData = {
  variables: ['O3', 'CO', 'NO2', 'PM25'],
  regions: ['global', 'north_america', 'europe', 'asia'],
  statistics: {
    // Sample statistics would go here
  },
  spatialData: {
    // Sample spatial data would go here
  },
  timeSeriesData: {
    // Sample time series data would go here
  },
  plots: {
    // Sample plot paths would go here
  }
};

// Slice
const comparisonSlice = createSlice({
  name: 'comparison',
  initialState,
  reducers: {
    addSimulationToComparison: (state, action: PayloadAction<string>) => {
      // Prevent adding duplicate simulations
      if (!state.selectedSimulations.includes(action.payload)) {
        state.selectedSimulations.push(action.payload);
      }
    },
    removeSimulationFromComparison: (state, action: PayloadAction<string>) => {
      state.selectedSimulations = state.selectedSimulations.filter(id => id !== action.payload);
      
      // Clear comparison data if fewer than 2 simulations remain
      if (state.selectedSimulations.length < 2) {
        state.comparisonData = null;
      }
    },
    clearSimulations: (state) => {
      state.selectedSimulations = [];
      state.comparisonData = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch comparison data
      .addCase(fetchComparisonData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchComparisonData.fulfilled, (state, action: PayloadAction<ComparisonData>) => {
        // For development, use sample data
        // In production, would use: state.comparisonData = action.payload;
        state.comparisonData = sampleComparisonData;
        state.loading = false;
      })
      .addCase(fetchComparisonData.rejected, (state, action) => {
        // For development, use sample data even on failure
        state.comparisonData = sampleComparisonData;
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Generate comparison plot
      .addCase(generateComparisonPlot.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateComparisonPlot.fulfilled, (state, action: PayloadAction<any>) => {
        if (state.comparisonData) {
          state.comparisonData.plots = {
            ...state.comparisonData.plots,
            [action.payload.plotType]: action.payload.url
          };
        }
        state.loading = false;
      })
      .addCase(generateComparisonPlot.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { 
  addSimulationToComparison, 
  removeSimulationFromComparison, 
  clearSimulations,
  clearError
} = comparisonSlice.actions;
export default comparisonSlice.reducer;