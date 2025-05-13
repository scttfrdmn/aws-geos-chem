import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setSidebarOpen } from '../../store/slices/uiSlice';

// MUI components
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  Tooltip
} from '@mui/material';

// MUI icons
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Science as ScienceIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  MonetizationOn as CostIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Notifications as NotificationsIcon,
  BatchPrediction as BatchIcon,
  Tune as TuneIcon
} from '@mui/icons-material';

// Custom components
import AlertNotification from '../common/AlertNotification';
import { NavLink } from 'react-router-dom';
import { signOut } from '../../store/slices/authSlice';
import { setThemeMode } from '../../store/slices/uiSlice';

// Drawer width
const drawerWidth = 240;

const MainLayout: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Get state from Redux
  const { sidebarOpen } = useSelector((state: RootState) => state.ui);
  const { user } = useSelector((state: RootState) => state.auth);
  const { themePreferences } = useSelector((state: RootState) => state.ui);
  
  // Local state for user menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Handlers
  const handleDrawerToggle = () => {
    dispatch(setSidebarOpen(!sidebarOpen));
  };
  
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = async () => {
    handleUserMenuClose();
    await dispatch(signOut());
  };
  
  const handleThemeToggle = () => {
    const newMode = themePreferences.mode === 'light' ? 'dark' : 'light';
    dispatch(setThemeMode(newMode));
  };
  
  // Navigation items
  const navItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Simulations', icon: <ScienceIcon />, path: '/simulations' },
    { text: 'Batch Processing', icon: <BatchIcon />, path: '/batches' },
    { text: 'Parameter Studies', icon: <TuneIcon />, path: '/parameter-studies' },
    { text: 'Results', icon: <AssessmentIcon />, path: '/results' },
    { text: 'Cost & Usage', icon: <CostIcon />, path: '/costs' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' }
  ];
  
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
          ml: { sm: sidebarOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen
          })
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            {sidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            GEOS-Chem Cloud Runner
          </Typography>
          
          {/* Theme toggle */}
          <Tooltip title={`Switch to ${themePreferences.mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton color="inherit" onClick={handleThemeToggle}>
              {themePreferences.mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
          
          {/* Notifications */}
          <Tooltip title="Notifications">
            <IconButton color="inherit">
              <NotificationsIcon />
            </IconButton>
          </Tooltip>
          
          {/* User avatar and menu */}
          <Box sx={{ ml: 2 }}>
            <Tooltip title="Account settings">
              <IconButton
                onClick={handleUserMenuOpen}
                size="small"
                aria-controls="user-menu"
                aria-haspopup="true"
              >
                <Avatar sx={{ width: 32, height: 32 }}>
                  {user?.attributes?.name ? user.attributes.name.charAt(0).toUpperCase() : 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              id="user-menu"
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleUserMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem component={NavLink} to="/account" onClick={handleUserMenuClose}>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                My Account
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* Sidebar / Drawer */}
      <Drawer
        variant={isMobile ? "temporary" : "persistent"}
        open={sidebarOpen}
        onClose={isMobile ? handleDrawerToggle : undefined}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', mt: 2 }}>
          <List>
            {navItems.map((item) => (
              <ListItem
                button
                key={item.text}
                component={NavLink}
                to={item.path}
                sx={{
                  color: 'inherit',
                  '&.active': {
                    color: 'primary.main',
                    bgcolor: 'action.selected',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    '.active &': {
                      color: 'primary.main',
                    },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      
      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: sidebarOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
          ml: { sm: sidebarOpen ? `${drawerWidth}px` : 0 },
          transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen
          }),
          pt: { xs: 8, sm: 9 } // Extra padding for the fixed AppBar
        }}
      >
        <Outlet />
      </Box>
      
      {/* Global alert notifications */}
      <AlertNotification />
    </Box>
  );
};

export default MainLayout;