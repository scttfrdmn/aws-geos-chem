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
      });
  }
});

export const { clearError, resetCurrentBudget } = costSlice.actions;
export default costSlice.reducer;