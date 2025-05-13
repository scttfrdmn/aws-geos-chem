import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { addAlert } from '../store/slices/uiSlice';
import { Auth } from 'aws-amplify';

// MUI components
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Avatar,
  InputAdornment,
  IconButton
} from '@mui/material';

// MUI icons
import {
  Save as SaveIcon,
  Visibility,
  VisibilityOff,
  AccountCircle,
  Email,
  VpnKey
} from '@mui/icons-material';

// Custom components
import { useAuthContext } from '../context/AuthContext';

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`account-tabpanel-${index}`}
      aria-labelledby={`account-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const Account: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Load user data
  useEffect(() => {
    if (user) {
      const attributes = user.attributes || {};
      setEmail(attributes.email || '');
      setFirstName(attributes.given_name || '');
      setLastName(attributes.family_name || '');
      setPhone(attributes.phone_number || '');
    }
  }, [user]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      
      const attributes: Record<string, string> = {};
      if (firstName) attributes.given_name = firstName;
      if (lastName) attributes.family_name = lastName;
      if (phone) attributes.phone_number = phone;
      
      // Only update email if it has changed
      if (email && email !== user?.attributes?.email) {
        attributes.email = email;
      }
      
      await Auth.updateUserAttributes(currentUser, attributes);
      
      dispatch(addAlert({
        type: 'success',
        message: 'Profile updated successfully',
        autoHideDuration: 3000
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      await Auth.changePassword(currentUser, currentPassword, newPassword);
      
      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      dispatch(addAlert({
        type: 'success',
        message: 'Password changed successfully',
        autoHideDuration: 3000
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // Get the user's initials for avatar
  const getUserInitials = (): string => {
    const fInitial = firstName ? firstName.charAt(0) : '';
    const lInitial = lastName ? lastName.charAt(0) : '';
    return (fInitial + lInitial).toUpperCase() || 'U';
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Account Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                mx: 'auto',
                mb: 2,
                fontSize: 40,
                bgcolor: 'primary.main'
              }}
            >
              {getUserInitials()}
            </Avatar>
            
            <Typography variant="h5" gutterBottom>
              {firstName} {lastName}
            </Typography>
            
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {email}
            </Typography>
            
            <Typography variant="body2" sx={{ mt: 2 }}>
              User ID: {user?.username}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="body2" color="text.secondary">
              Last Sign In: {user?.signInUserSession?.accessToken?.payload?.auth_time ? 
                new Date(user.signInUserSession.accessToken.payload.auth_time * 1000).toLocaleString() : 
                'Unknown'}
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={tabValue} 
                onChange={handleTabChange}
                aria-label="account settings tabs"
              >
                <Tab label="Profile Information" id="account-tab-0" />
                <Tab label="Change Password" id="account-tab-1" />
              </Tabs>
            </Box>
            
            {/* Profile Tab */}
            <TabPanel value={tabValue} index={0}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              
              <Box component="form" onSubmit={handleProfileUpdate}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="First Name"
                      fullWidth
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccountCircle />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Last Name"
                      fullWidth
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccountCircle />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      label="Email"
                      type="email"
                      fullWidth
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Email />
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      label="Phone Number"
                      fullWidth
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 555-5555"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                      disabled={loading}
                      sx={{ mt: 2 }}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </TabPanel>
            
            {/* Password Tab */}
            <TabPanel value={tabValue} index={1}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              
              <Box component="form" onSubmit={handlePasswordChange}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Current Password"
                      type={showPasswords ? 'text' : 'password'}
                      fullWidth
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <VpnKey />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPasswords(!showPasswords)}
                              edge="end"
                            >
                              {showPasswords ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      label="New Password"
                      type={showPasswords ? 'text' : 'password'}
                      fullWidth
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      helperText="Password must be at least 8 characters"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      label="Confirm New Password"
                      type={showPasswords ? 'text' : 'password'}
                      fullWidth
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      error={newPassword !== confirmPassword && confirmPassword.length > 0}
                      helperText={
                        newPassword !== confirmPassword && confirmPassword.length > 0
                          ? 'Passwords do not match'
                          : ''
                      }
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                      disabled={loading || newPassword !== confirmPassword}
                      sx={{ mt: 2 }}
                    >
                      {loading ? 'Changing Password...' : 'Change Password'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Account;