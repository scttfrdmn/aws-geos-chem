import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { forgotPassword, resetPassword, clearError } from '../store/slices/authSlice';
import { addAlert } from '../store/slices/uiSlice';

// MUI components
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';

// MUI icons
import {
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

const ForgotPassword: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  
  // Steps
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Request Reset', 'Reset Password'];
  
  // Form state
  const [username, setUsername] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Form validation
  const [usernameError, setUsernameError] = useState('');
  const [confirmationCodeError, setConfirmationCodeError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  // Handle input changes
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (usernameError) setUsernameError('');
    if (error) dispatch(clearError());
  };
  
  const handleConfirmationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmationCode(e.target.value);
    if (confirmationCodeError) setConfirmationCodeError('');
    if (error) dispatch(clearError());
  };
  
  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
    if (newPasswordError) setNewPasswordError('');
    if (error) dispatch(clearError());
  };
  
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (confirmPasswordError) setConfirmPasswordError('');
    if (error) dispatch(clearError());
  };
  
  // Toggle password visibility
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  // Validate request form
  const validateRequestForm = () => {
    let isValid = true;
    
    if (!username.trim()) {
      setUsernameError('Username is required');
      isValid = false;
    }
    
    return isValid;
  };
  
  // Validate reset form
  const validateResetForm = () => {
    let isValid = true;
    
    if (!confirmationCode.trim()) {
      setConfirmationCodeError('Verification code is required');
      isValid = false;
    }
    
    if (!newPassword) {
      setNewPasswordError('New password is required');
      isValid = false;
    } else if (newPassword.length < 8) {
      setNewPasswordError('Password must be at least 8 characters');
      isValid = false;
    }
    
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }
    
    return isValid;
  };
  
  // Handle request password reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRequestForm()) {
      return;
    }
    
    const result = await dispatch(forgotPassword(username));
    
    if (!result.error) {
      // Move to reset step
      setActiveStep(1);
    }
  };
  
  // Handle reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateResetForm()) {
      return;
    }
    
    const result = await dispatch(resetPassword({
      username,
      code: confirmationCode,
      newPassword
    }));
    
    if (!result.error) {
      dispatch(addAlert({
        type: 'success',
        message: 'Password reset successfully! You can now log in with your new password.',
        autoHideDuration: 6000
      }));
      
      // Navigate to login page
      navigate('/login');
    }
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {activeStep === 0 ? (
        // Request reset form
        <Box
          component="form"
          onSubmit={handleRequestReset}
          noValidate
        >
          <Typography variant="body1" gutterBottom>
            Enter your username and we'll send you a verification code to reset your password.
          </Typography>
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={handleUsernameChange}
            error={!!usernameError}
            helperText={usernameError}
            disabled={loading}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? 'Requesting...' : 'Request Password Reset'}
          </Button>
          
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link component={RouterLink} to="/login" variant="body2">
              {'Back to Sign In'}
            </Link>
          </Box>
        </Box>
      ) : (
        // Reset password form
        <Box
          component="form"
          onSubmit={handleResetPassword}
          noValidate
        >
          <Typography variant="body1" gutterBottom>
            Enter the verification code sent to your email and your new password.
          </Typography>
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="confirmationCode"
            label="Verification Code"
            name="confirmationCode"
            autoFocus
            value={confirmationCode}
            onChange={handleConfirmationCodeChange}
            error={!!confirmationCodeError}
            helperText={confirmationCodeError}
            disabled={loading}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="newPassword"
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            id="newPassword"
            autoComplete="new-password"
            value={newPassword}
            onChange={handleNewPasswordChange}
            error={!!newPasswordError}
            helperText={newPasswordError}
            disabled={loading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="confirmPassword"
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            error={!!confirmPasswordError}
            helperText={confirmPasswordError}
            disabled={loading}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button
              variant="text"
              onClick={() => setActiveStep(0)}
              disabled={loading}
            >
              Back
            </Button>
            
            <Link component="button" variant="body2" onClick={() => {
              // Logic to resend code would go here
              dispatch(forgotPassword(username)).then(() => {
                dispatch(addAlert({
                  type: 'info',
                  message: 'Verification code resent',
                  autoHideDuration: 3000
                }));
              });
            }}>
              Resend code
            </Link>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ForgotPassword;