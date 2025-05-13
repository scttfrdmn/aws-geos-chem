import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Alert notification type
export interface AlertMessage {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  autoHideDuration?: number;
}

// Type for theme preferences
export interface ThemePreferences {
  mode: 'light' | 'dark';
  primaryColor: string;
  density: 'comfortable' | 'compact' | 'standard';
}

interface UiState {
  alerts: AlertMessage[];
  sidebarOpen: boolean;
  themePreferences: ThemePreferences;
  loading: {
    global: boolean;
    [key: string]: boolean;
  };
}

const initialState: UiState = {
  alerts: [],
  sidebarOpen: true,
  themePreferences: {
    mode: 'light',
    primaryColor: '#1976d2', // Default MUI blue
    density: 'standard'
  },
  loading: {
    global: false
  }
};

// Slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Alert actions
    addAlert: (state, action: PayloadAction<Omit<AlertMessage, 'id'>>) => {
      const id = Date.now().toString();
      state.alerts.push({
        ...action.payload,
        id
      });
      return state;
    },
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
      return state;
    },
    clearAlerts: (state) => {
      state.alerts = [];
      return state;
    },
    
    // Sidebar actions
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
      return state;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
      return state;
    },
    
    // Theme actions
    setThemeMode: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.themePreferences.mode = action.payload;
      return state;
    },
    setThemeColor: (state, action: PayloadAction<string>) => {
      state.themePreferences.primaryColor = action.payload;
      return state;
    },
    setThemeDensity: (state, action: PayloadAction<'comfortable' | 'compact' | 'standard'>) => {
      state.themePreferences.density = action.payload;
      return state;
    },
    setThemePreferences: (state, action: PayloadAction<Partial<ThemePreferences>>) => {
      state.themePreferences = {
        ...state.themePreferences,
        ...action.payload
      };
      return state;
    },
    
    // Loading state actions
    setLoading: (state, action: PayloadAction<{ key: string; isLoading: boolean }>) => {
      const { key, isLoading } = action.payload;
      state.loading[key] = isLoading;
      return state;
    },
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
      return state;
    }
  }
});

export const {
  addAlert,
  removeAlert,
  clearAlerts,
  toggleSidebar,
  setSidebarOpen,
  setThemeMode,
  setThemeColor,
  setThemeDensity,
  setThemePreferences,
  setLoading,
  setGlobalLoading
} = uiSlice.actions;

export default uiSlice.reducer;