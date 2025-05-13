import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { getCurrentUser, signOut } from '../store/slices/authSlice';
import { Auth } from 'aws-amplify';
import { Hub } from 'aws-amplify';

/**
 * Custom hook to manage authentication state
 * Provides convenient access to authentication-related state and actions
 */
const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, user, loading, error } = useSelector(
    (state: RootState) => state.auth
  );

  // Set up listener for Auth events
  useEffect(() => {
    const listener = (data: any) => {
      switch (data.payload.event) {
        case 'signIn':
          // Refresh the current authenticated user
          dispatch(getCurrentUser());
          break;
        case 'signOut':
          // Nothing to do, store handles this
          break;
        case 'tokenRefresh':
          // Refresh the current authenticated user
          dispatch(getCurrentUser());
          break;
      }
    };

    // Listen for auth events
    const hubListener = Hub.listen('auth', listener);

    // Clean up listener on unmount
    return () => {
      hubListener();
    };
  }, [dispatch]);

  // Check for authenticated user on mount
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, isAuthenticated, loading]);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await dispatch(signOut());
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Return authentication state and actions
  return {
    isAuthenticated,
    user,
    loading,
    error,
    signOut: handleSignOut
  };
};

export default useAuth;