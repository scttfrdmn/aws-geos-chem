import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { signUp, confirmSignUp, clearError } from '../store/slices/authSlice';
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
  StepLabel,
  Paper
} from '@mui/material';

// MUI icons
import {
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

const Signup: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  
  // Steps
  const [activeStep, setActiveStep] = useState(0);
  const steps = ['Create Account', 'Verification'];
  
  // Form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Form validation
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [confirmationCodeError, setConfirmationCodeError] = useState('');
  
  // Handle input changes
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (usernameError) setUsernameError('');
    if (error) dispatch(clearError());
  };
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
    if (error) dispatch(clearError());
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) setPasswordError('');
    if (error) dispatch(clearError());
  };
  
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (confirmPasswordError) setConfirmPasswordError('');
    if (error) dispatch(clearError());
  };
  
  const handleConfirmationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmationCode(e.target.value);
    if (confirmationCodeError) setConfirmationCodeError('');
    if (error) dispatch(clearError());
  };
  
  // Toggle password visibility
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  // Validate registration form
  const validateRegistrationForm = () => {
    let isValid = true;
    
    if (!username.trim()) {
      setUsernameError('Username is required');
      isValid = false;
    }
    
    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Email is invalid');
      isValid = false;
    }
    
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      isValid = false;
    }
    
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    }
    
    return isValid;
  };
  
  // Validate confirmation form
  const validateConfirmationForm = () => {
    let isValid = true;
    
    if (!confirmationCode.trim()) {
      setConfirmationCodeError('Verification code is required');
      isValid = false;
    }
    
    return isValid;
  };
  
  // Handle registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRegistrationForm()) {
      return;
    }
    
    const result = await dispatch(signUp({ username, password, email }));
    
    if (!result.error) {
      // Move to confirmation step
      setActiveStep(1);
    }
  };
  
  // Handle confirmation
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateConfirmationForm()) {
      return;
    }
    
    const result = await dispatch(confirmSignUp({ username, code: confirmationCode }));
    
    if (!result.error) {
      dispatch(addAlert({
        type: 'success',
        message: 'Account created successfully! You can now log in.',
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
        // Registration form
        <Box
          component="form"
          onSubmit={handleRegister}
          noValidate
        >
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
          
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            value={email}
            onChange={handleEmailChange}
            error={!!emailError}
            helperText={emailError}
            disabled={loading}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={handlePasswordChange}
            error={!!passwordError}
            helperText={passwordError}
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
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
          
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link component={RouterLink} to="/login" variant="body2">
              {'Already have an account? Sign In'}
            </Link>
          </Box>
        </Box>
      ) : (
        // Confirmation form
        <Box
          component="form"
          onSubmit={handleConfirm}
          noValidate
        >
          <Typography variant="body1" gutterBottom>
            We've sent a verification code to your email address. Please enter it below to complete your registration.
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
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? 'Verifying...' : 'Verify Account'}
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
              dispatch(addAlert({
                type: 'info',
                message: 'Verification code resent',
                autoHideDuration: 3000
              }));
            }}>
              Resend code
            </Link>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Signup;