import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Auth } from 'aws-amplify';

interface AuthState {
  isAuthenticated: boolean;
  user: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null
};

export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const user = await Auth.signIn(username, password);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to sign in');
    }
  }
);

export const signUp = createAsyncThunk(
  'auth/signUp',
  async (
    { username, password, email }: { username: string; password: string; email: string },
    { rejectWithValue }
  ) => {
    try {
      const { user } = await Auth.signUp({
        username,
        password,
        attributes: {
          email
        }
      });
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to sign up');
    }
  }
);

export const confirmSignUp = createAsyncThunk(
  'auth/confirmSignUp',
  async (
    { username, code }: { username: string; code: string },
    { rejectWithValue }
  ) => {
    try {
      await Auth.confirmSignUp(username, code);
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to confirm sign up');
    }
  }
);

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      await Auth.signOut();
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to sign out');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      return currentUser;
    } catch (error: any) {
      return rejectWithValue(error.message || 'No authenticated user');
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (username: string, { rejectWithValue }) => {
    try {
      await Auth.forgotPassword(username);
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to initiate password reset');
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (
    { username, code, newPassword }: { username: string; code: string; newPassword: string },
    { rejectWithValue }
  ) => {
    try {
      await Auth.forgotPasswordSubmit(username, code, newPassword);
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to reset password');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Sign In
      .addCase(signIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Sign Up
      .addCase(signUp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state) => {
        state.loading = false;
        // Note: User is not authenticated yet after sign up, they need to confirm and sign in
      })
      .addCase(signUp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Confirm Sign Up
      .addCase(confirmSignUp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(confirmSignUp.fulfilled, (state) => {
        state.loading = false;
        // Note: User still needs to sign in after confirmation
      })
      .addCase(confirmSignUp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Sign Out
      .addCase(signOut.pending, (state) => {
        state.loading = true;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.loading = false;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Get Current User
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.user = action.payload;
        state.loading = false;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isAuthenticated = false;
        state.user = null;
        state.loading = false;
        // We don't set error here since this is a common case (user not logged in)
      })
      
      // Forgot Password
      .addCase(forgotPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Reset Password
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;