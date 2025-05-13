import React from 'react';
import { Chip, ChipProps } from '@mui/material';

// MUI icons
import {
  PlayArrow as PlayIcon,
  Check as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Sync as RunningIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

interface StatusChipProps {
  status: 'CREATED' | 'SUBMITTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  size?: ChipProps['size'];
}

const StatusChip: React.FC<StatusChipProps> = ({ status, size = 'small' }) => {
  // Define status configurations
  const statusConfigs = {
    CREATED: {
      label: 'Created',
      color: 'default' as ChipProps['color'],
      icon: <PendingIcon fontSize="small" />
    },
    SUBMITTED: {
      label: 'Submitted',
      color: 'info' as ChipProps['color'],
      icon: <PlayIcon fontSize="small" />
    },
    RUNNING: {
      label: 'Running',
      color: 'primary' as ChipProps['color'],
      icon: <RunningIcon fontSize="small" />
    },
    SUCCEEDED: {
      label: 'Succeeded',
      color: 'success' as ChipProps['color'],
      icon: <SuccessIcon fontSize="small" />
    },
    FAILED: {
      label: 'Failed',
      color: 'error' as ChipProps['color'],
      icon: <ErrorIcon fontSize="small" />
    },
    CANCELED: {
      label: 'Canceled',
      color: 'warning' as ChipProps['color'],
      icon: <CancelIcon fontSize="small" />
    }
  };
  
  const config = statusConfigs[status];
  
  return (
    <Chip
      label={config.label}
      color={config.color}
      icon={config.icon}
      size={size}
    />
  );
};

export default StatusChip;