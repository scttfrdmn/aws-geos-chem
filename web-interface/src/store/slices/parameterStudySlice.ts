import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API } from 'aws-amplify';

// Types
interface ParameterStudy {
  id: string;
  name: string;
  description?: string;
  studyType: 'sensitivity' | 'optimization' | 'exploration';
  status: 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
  baseSimulationId: string;
  parameters: Array<{
    name: string;
    path: string;
    range: [number, number] | string[];
    type: 'continuous' | 'discrete' | 'categorical';
    samplingPoints: number;
    distribution?: string;
  }>;
  outputConfig: {
    outputVariables: string[];
    analysisMetrics: string[];
    visualizationTypes: string[];
    postProcessingScripts: string[];
  };
  simulations: string[]; // IDs of created simulations
  results?: {
    sensitivities?: Record<string, number>;
    rankings?: Record<string, number>;
    optimalValues?: Record<string, any>;
    plots?: string[]; // URLs to generated plots
  };
  createdAt: string;
  updatedAt: string;
  userId: string;
  username: string;
}

interface ParameterStudyState {
  studies: ParameterStudy[];
  currentStudy: ParameterStudy | null;
  loading: boolean;
  error: string | null;
}

const initialState: ParameterStudyState = {
  studies: [],
  currentStudy: null,
  loading: false,
  error: null
};

// Async thunks
export const fetchParameterStudies = createAsyncThunk(
  'parameterStudy/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', '/parameter-studies', {});
      return response.studies;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch parameter studies');
    }
  }
);

export const fetchParameterStudyById = createAsyncThunk(
  'parameterStudy/fetchById',
  async (studyId: string, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', `/parameter-studies/${studyId}`, {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch parameter study');
    }
  }
);

export const createParameterStudy = createAsyncThunk(
  'parameterStudy/create',
  async (studyData: any, { rejectWithValue }) => {
    try {
      const response = await API.post('GeosChemAPI', '/parameter-studies', {
        body: studyData
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create parameter study');
    }
  }
);

export const cancelParameterStudy = createAsyncThunk(
  'parameterStudy/cancel',
  async (studyId: string, { rejectWithValue }) => {
    try {
      const response = await API.post('GeosChemAPI', `/parameter-studies/${studyId}/cancel`, {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to cancel parameter study');
    }
  }
);

export const generateStudyReport = createAsyncThunk(
  'parameterStudy/generateReport',
  async (studyId: string, { rejectWithValue }) => {
    try {
      const response = await API.post('GeosChemAPI', `/parameter-studies/${studyId}/report`, {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to generate study report');
    }
  }
);

// Temporary sample data for development/testing
const sampleStudies: ParameterStudy[] = [
  {
    id: 'ps-001',
    name: 'Ozone Sensitivity Study',
    description: 'Analysis of ozone sensitivity to NOx and VOC emissions',
    studyType: 'sensitivity',
    status: 'completed',
    baseSimulationId: 'sim-001',
    parameters: [
      {
        name: 'NOx Emissions',
        path: 'emissions.nox',
        type: 'continuous',
        range: [0.5, 1.5],
        samplingPoints: 5,
        distribution: 'uniform'
      },
      {
        name: 'VOC Emissions',
        path: 'emissions.voc',
        type: 'continuous',
        range: [0.7, 1.3],
        samplingPoints: 5,
        distribution: 'uniform'
      },
      {
        name: 'Temperature Adjustment',
        path: 'meteorology.temperature',
        type: 'continuous',
        range: [-2, 2],
        samplingPoints: 3,
        distribution: 'normal'
      }
    ],
    outputConfig: {
      outputVariables: ['O3', 'NO2', 'OH'],
      analysisMetrics: ['sensitivity', 'pcc', 'sobol'],
      visualizationTypes: ['sensitivity_heatmap', 'parameter_sweep', 'surface_response'],
      postProcessingScripts: ['sensitivity_analysis']
    },
    simulations: ['sim-002', 'sim-003', 'sim-004', 'sim-005', 'sim-006'],
    results: {
      sensitivities: {
        'emissions.nox': 0.72,
        'emissions.voc': 0.45,
        'meteorology.temperature': 0.23
      },
      rankings: {
        'emissions.nox': 1,
        'emissions.voc': 2,
        'meteorology.temperature': 3
      },
      plots: [
        'https://example.com/plots/sensitivity_heatmap.png',
        'https://example.com/plots/parameter_sweep.png'
      ]
    },
    createdAt: '2023-04-15T10:30:00Z',
    updatedAt: '2023-04-16T15:45:00Z',
    userId: 'user-001',
    username: 'scientist1'
  },
  {
    id: 'ps-002',
    name: 'PM2.5 Formation Exploration',
    description: 'Exploring the parameter space affecting PM2.5 formation',
    studyType: 'exploration',
    status: 'running',
    baseSimulationId: 'sim-007',
    parameters: [
      {
        name: 'SO2 Emissions',
        path: 'emissions.so2',
        type: 'continuous',
        range: [0.5, 2.0],
        samplingPoints: 4,
        distribution: 'log-normal'
      },
      {
        name: 'NH3 Emissions',
        path: 'emissions.nh3',
        type: 'continuous',
        range: [0.8, 1.5],
        samplingPoints: 4,
        distribution: 'uniform'
      },
      {
        name: 'Aerosol Scheme',
        path: 'config.aerosol_scheme',
        type: 'categorical',
        range: ['simple', 'standard', 'complex'],
        samplingPoints: 3
      }
    ],
    outputConfig: {
      outputVariables: ['PM25', 'SO4', 'NH4', 'NO3', 'BC', 'OC'],
      analysisMetrics: ['mean', 'std', 'min', 'max'],
      visualizationTypes: ['box_plots', 'scatter_matrix', 'spatial_map'],
      postProcessingScripts: ['statistical_summary', 'spatial_aggregation']
    },
    simulations: ['sim-008', 'sim-009', 'sim-010', 'sim-011', 'sim-012', 'sim-013'],
    createdAt: '2023-05-20T09:15:00Z',
    updatedAt: '2023-05-20T14:30:00Z',
    userId: 'user-002',
    username: 'scientist2'
  }
];

// Slice
const parameterStudySlice = createSlice({
  name: 'parameterStudy',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCurrentStudy: (state) => {
      state.currentStudy = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch all parameter studies
      .addCase(fetchParameterStudies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParameterStudies.fulfilled, (state, action: PayloadAction<ParameterStudy[]>) => {
        // For development, use sample data
        // In production, would use: state.studies = action.payload;
        state.studies = sampleStudies;
        state.loading = false;
      })
      .addCase(fetchParameterStudies.rejected, (state, action) => {
        // For development, use sample data even on failure
        state.studies = sampleStudies;
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch parameter study by ID
      .addCase(fetchParameterStudyById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParameterStudyById.fulfilled, (state, action: PayloadAction<ParameterStudy>) => {
        state.currentStudy = action.payload;
        state.loading = false;
      })
      .addCase(fetchParameterStudyById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Create parameter study
      .addCase(createParameterStudy.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createParameterStudy.fulfilled, (state, action: PayloadAction<ParameterStudy>) => {
        state.studies.push(action.payload);
        state.currentStudy = action.payload;
        state.loading = false;
      })
      .addCase(createParameterStudy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Cancel parameter study
      .addCase(cancelParameterStudy.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelParameterStudy.fulfilled, (state, action: PayloadAction<{id: string}>) => {
        const studyIndex = state.studies.findIndex(study => study.id === action.payload.id);
        if (studyIndex !== -1) {
          state.studies[studyIndex].status = 'cancelled';
        }
        if (state.currentStudy && state.currentStudy.id === action.payload.id) {
          state.currentStudy.status = 'cancelled';
        }
        state.loading = false;
      })
      .addCase(cancelParameterStudy.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Generate study report
      .addCase(generateStudyReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateStudyReport.fulfilled, (state, action: PayloadAction<any>) => {
        // Update study with report info if needed
        state.loading = false;
      })
      .addCase(generateStudyReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearError, clearCurrentStudy } = parameterStudySlice.actions;
export default parameterStudySlice.reducer;