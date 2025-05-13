import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { removeAlert } from '../../store/slices/uiSlice';

// MUI components
import { 
  Snackbar, 
  Alert, 
  AlertTitle,
  Stack 
} from '@mui/material';

const AlertNotification: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const alerts = useSelector((state: RootState) => state.ui.alerts);

  // Handle alert close
  const handleClose = (id: string) => (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    dispatch(removeAlert(id));
  };

  // Auto-dismiss alerts
  useEffect(() => {
    alerts.forEach(alert => {
      if (alert.autoHideDuration) {
        const timer = setTimeout(() => {
          dispatch(removeAlert(alert.id));
        }, alert.autoHideDuration);
        
        return () => clearTimeout(timer);
      }
    });
  }, [alerts, dispatch]);

  // If no alerts, render nothing
  if (alerts.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2} sx={{ 
      width: '100%', 
      position: 'fixed', 
      bottom: 24, 
      right: 24, 
      maxWidth: 400,
      zIndex: 2000
    }}>
      {alerts.map(alert => (
        <Snackbar
          key={alert.id}
          open={true}
          autoHideDuration={alert.autoHideDuration || 6000}
          onClose={handleClose(alert.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            elevation={6}
            variant="filled"
            onClose={handleClose(alert.id)}
            severity={alert.type}
            sx={{ width: '100%' }}
          >
            {alert.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  );
};

export default AlertNotification;