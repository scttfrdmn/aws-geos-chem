import React, { createContext, useContext, ReactNode } from 'react';
import useAuth from '../hooks/useAuth';

// Define the shape of the auth context
interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps parts of the app that need auth context
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use the custom hook to manage auth state
  const auth = useAuth();

  // Provide the auth context to children
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

// Hook to use the auth context
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;