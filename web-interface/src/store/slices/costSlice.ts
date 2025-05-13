import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { API } from 'aws-amplify';

// Types
export interface CostItem {
  userId: string;
  resourceId: string;
  costType: 'real-time' | 'historical';
  simulationId?: string;
  simulationName?: string;
  estimatedCost: number;
  costBreakdown: {
    computeCost: number;
    storageCost: number;
    dataTransferCost: number;
    totalCost: number;
    elapsedHours: number;
    lastUpdated: string;
    instanceType: string;
    isSpot: boolean;
  };
  timePeriod: string;
  updatedAt: string;
}

export interface Recommendation {
  type: string;
  currentValue?: string;
  recommendedValue?: string;
  description: string;
  potentialSavingsPercent?: number;
  impact: 'low' | 'medium' | 'high';
}

export interface OptimizationRecommendation {
  simulationId?: string;
  name?: string;
  currentCost?: number;
  recommendations: Recommendation[];
  generatedAt: string;
  userId?: string;
  simulationCount?: number;
  recommendationTypes?: string[];
}

export interface OptimizationSummary {
  totalPotentialSavings: number;
  totalPotentialSavingsPercent: number;
  highImpactCount: number;
  mediumImpactCount: number;
  lowImpactCount: number;
  byType: Record<string, number>;
}

export interface Budget {
  userId: string;
  budgetId: string;
  name: string;
  amount: number;
  period: 'daily' | 'weekly' | 'monthly' | 'total';
  startDate: string;
  endDate?: string;
  alertThresholds: number[];
  currentSpend: number;
  createdAt: string;
  updatedAt: string;
}

interface CostState {
  costs: CostItem[];
  budgets: Budget[];
  currentBudget: Budget | null;
  summary: {
    totalCost: number;
    forecastedCost: number;
    costByResource: Record<string, number>;
    costByDay: Record<string, number>;
  };
  optimizationRecommendations: {
    userRecommendations: OptimizationRecommendation | null;
    simulationRecommendations: Record<string, OptimizationRecommendation>;
    summary: OptimizationSummary | null;
  };
  loading: boolean;
  error: string | null;
  submitting: boolean;
}

const initialState: CostState = {
  costs: [],
  budgets: [],
  currentBudget: null,
  summary: {
    totalCost: 0,
    forecastedCost: 0,
    costByResource: {},
    costByDay: {}
  },
  optimizationRecommendations: {
    userRecommendations: null,
    simulationRecommendations: {},
    summary: null
  },
  loading: false,
  error: null,
  submitting: false
};

// Async thunks
export const fetchCosts = createAsyncThunk(
  'cost/fetchCosts',
  async (
    { period, filter }: { period?: string; filter?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.get('GeosChemAPI', '/api/costs/reports', {
        queryStringParameters: {
          period,
          filter
        }
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch costs');
    }
  }
);

export const fetchRealTimeCost = createAsyncThunk(
  'cost/fetchRealTimeCost',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', '/api/costs/real-time', {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch real-time costs');
    }
  }
);

export const fetchBudgets = createAsyncThunk(
  'cost/fetchBudgets',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', '/api/budgets', {});
      return response.budgets;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch budgets');
    }
  }
);

export const fetchBudgetById = createAsyncThunk(
  'cost/fetchBudgetById',
  async (budgetId: string, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', `/api/budgets/${budgetId}`, {});
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch budget');
    }
  }
);

export const createBudget = createAsyncThunk(
  'cost/createBudget',
  async (budgetData: Partial<Budget>, { rejectWithValue }) => {
    try {
      const response = await API.post('GeosChemAPI', '/api/budgets', {
        body: budgetData
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create budget');
    }
  }
);

export const updateBudget = createAsyncThunk(
  'cost/updateBudget',
  async (
    { budgetId, budgetData }: { budgetId: string; budgetData: Partial<Budget> },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.put('GeosChemAPI', `/api/budgets/${budgetId}`, {
        body: budgetData
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update budget');
    }
  }
);

export const deleteBudget = createAsyncThunk(
  'cost/deleteBudget',
  async (budgetId: string, { rejectWithValue }) => {
    try {
      await API.del('GeosChemAPI', `/api/budgets/${budgetId}`, {});
      return budgetId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete budget');
    }
  }
);

export const fetchOptimizationRecommendations = createAsyncThunk(
  'cost/fetchOptimizationRecommendations',
  async (
    { type }: { type?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.get('GeosChemAPI', '/api/costs/optimization', {
        queryStringParameters: {
          type: type || 'all'
        }
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch optimization recommendations');
    }
  }
);

export const fetchSimulationOptimizations = createAsyncThunk(
  'cost/fetchSimulationOptimizations',
  async (simulationId: string, { rejectWithValue }) => {
    try {
      const response = await API.get('GeosChemAPI', '/api/costs/optimization', {
        queryStringParameters: {
          simulationId
        }
      });
      return {
        simulationId,
        recommendations: response.recommendations
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch simulation optimization recommendations');
    }
  }
);

export const applyOptimizationRecommendation = createAsyncThunk(
  'cost/applyOptimizationRecommendation',
  async (
    { simulationId, recommendationType, recommendationId }:
    { simulationId: string; recommendationType: string; recommendationId: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await API.post('GeosChemAPI', '/api/costs/optimization/apply', {
        body: {
          simulationId,
          recommendationType,
          recommendationId
        }
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to apply optimization recommendation');
    }
  }
);

// Slice
const costSlice = createSlice({
  name: 'cost',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetCurrentBudget: (state) => {
      state.currentBudget = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Costs
      .addCase(fetchCosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCosts.fulfilled, (state, action) => {
        state.costs = action.payload.costs;
        state.summary = action.payload.summary;
        state.loading = false;
      })
      .addCase(fetchCosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch Real-Time Cost
      .addCase(fetchRealTimeCost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRealTimeCost.fulfilled, (state, action) => {
        // Update costs with real-time data
        const realTimeCosts = action.payload.costs;
        
        // Replace or add real-time cost items
        realTimeCosts.forEach((rtCost: CostItem) => {
          const index = state.costs.findIndex(
            cost => cost.resourceId === rtCost.resourceId && cost.costType === 'real-time'
          );
          
          if (index !== -1) {
            state.costs[index] = rtCost;
          } else {
            state.costs.push(rtCost);
          }
        });
        
        state.loading = false;
      })
      .addCase(fetchRealTimeCost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch Budgets
      .addCase(fetchBudgets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBudgets.fulfilled, (state, action) => {
        state.budgets = action.payload;
        state.loading = false;
      })
      .addCase(fetchBudgets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch Budget By Id
      .addCase(fetchBudgetById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBudgetById.fulfilled, (state, action) => {
        state.currentBudget = action.payload;
        state.loading = false;
      })
      .addCase(fetchBudgetById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Create Budget
      .addCase(createBudget.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(createBudget.fulfilled, (state, action) => {
        state.budgets.push(action.payload);
        state.currentBudget = action.payload;
        state.submitting = false;
      })
      .addCase(createBudget.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload as string;
      })
      
      // Update Budget
      .addCase(updateBudget.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(updateBudget.fulfilled, (state, action) => {
        const updatedBudget = action.payload;
        const index = state.budgets.findIndex(
          budget => budget.budgetId === updatedBudget.budgetId
        );
        if (index !== -1) {
          state.budgets[index] = updatedBudget;
        }
        if (state.currentBudget?.budgetId === updatedBudget.budgetId) {
          state.currentBudget = updatedBudget;
        }
        state.submitting = false;
      })
      .addCase(updateBudget.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload as string;
      })
      
      // Delete Budget
      .addCase(deleteBudget.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteBudget.fulfilled, (state, action) => {
        const budgetId = action.payload;
        state.budgets = state.budgets.filter(budget => budget.budgetId !== budgetId);
        if (state.currentBudget?.budgetId === budgetId) {
          state.currentBudget = null;
        }
        state.loading = false;
      })
      .addCase(deleteBudget.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch Optimization Recommendations
      .addCase(fetchOptimizationRecommendations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOptimizationRecommendations.fulfilled, (state, action) => {
        // Set the user recommendations
        state.optimizationRecommendations.userRecommendations = action.payload.recommendations;

        // Calculate optimization summary
        if (action.payload.recommendations && action.payload.recommendations.recommendations) {
          const recommendations = action.payload.recommendations.recommendations;

          let totalSavings = 0;
          let highCount = 0;
          let mediumCount = 0;
          let lowCount = 0;
          const byType: Record<string, number> = {};

          // Process all recommendation types
          Object.keys(recommendations).forEach(type => {
            const typeRecs = recommendations[type];
            if (!Array.isArray(typeRecs)) return;

            typeRecs.forEach(rec => {
              // Count by impact
              if (rec.impact === 'high') highCount++;
              else if (rec.impact === 'medium') mediumCount++;
              else if (rec.impact === 'low') lowCount++;

              // Count by type
              if (!byType[rec.type]) byType[rec.type] = 0;
              byType[rec.type]++;

              // Add potential savings
              if (rec.potentialSavingsPercent) {
                totalSavings += rec.potentialSavingsPercent;
              }
            });
          });

          // Set summary
          state.optimizationRecommendations.summary = {
            totalPotentialSavings: totalSavings,
            totalPotentialSavingsPercent: state.summary.totalCost > 0
              ? (totalSavings / 100) * state.summary.totalCost
              : 0,
            highImpactCount: highCount,
            mediumImpactCount: mediumCount,
            lowImpactCount: lowCount,
            byType
          };
        }

        state.loading = false;
      })
      .addCase(fetchOptimizationRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch Simulation Optimizations
      .addCase(fetchSimulationOptimizations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSimulationOptimizations.fulfilled, (state, action) => {
        const { simulationId, recommendations } = action.payload;

        // Set the simulation recommendations
        state.optimizationRecommendations.simulationRecommendations[simulationId] = recommendations;

        state.loading = false;
      })
      .addCase(fetchSimulationOptimizations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Apply Optimization Recommendation
      .addCase(applyOptimizationRecommendation.pending, (state) => {
        state.submitting = true;
        state.error = null;
      })
      .addCase(applyOptimizationRecommendation.fulfilled, (state, action) => {
        // Update applied recommendation status
        const { simulationId, recommendationId, success } = action.payload;

        if (success && simulationId && recommendationId) {
          // Mark recommendation as applied if successful
          const simRecs = state.optimizationRecommendations.simulationRecommendations[simulationId];
          if (simRecs) {
            // Find and update the recommendation
            simRecs.recommendations = simRecs.recommendations.map(rec => {
              // Assuming recommendationId matches the index or some unique identifier
              if (rec.type === recommendationId) {
                return { ...rec, applied: true };
              }
              return rec;
            });
          }
        }

        state.submitting = false;
      })
      .addCase(applyOptimizationRecommendation.rejected, (state, action) => {
        state.submitting = false;
        state.error = action.payload as string;
      });
  }
});

export const {
  clearError,
  resetCurrentBudget
} = costSlice.actions;

// Selectors
export const selectOptimizationSummary = (state: { cost: CostState }) => state.cost.optimizationRecommendations.summary;
export const selectUserRecommendations = (state: { cost: CostState }) => state.cost.optimizationRecommendations.userRecommendations;
export const selectSimulationRecommendations = (simulationId: string) => (state: { cost: CostState }) =>
  state.cost.optimizationRecommendations.simulationRecommendations[simulationId];

export default costSlice.reducer;