import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import simulationsReducer from './slices/simulationsSlice';
import resultsReducer from './slices/resultsSlice';
import costReducer from './slices/costSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    simulations: simulationsReducer,
    results: resultsReducer,
    cost: costReducer,
    ui: uiReducer
  },
  devTools: process.env.NODE_ENV !== 'production'
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;