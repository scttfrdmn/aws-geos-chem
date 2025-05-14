import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Chip,
  TextField,
  SelectChangeEvent
} from '@mui/material';

// For color scale
import { interpolateRainbow, interpolateViridis, interpolateInferno, interpolateTurbo } from 'd3-scale-chromatic';
import { scaleSequential } from 'd3-scale';

interface SpatialVisualizationProps {
  data: {
    longitude: number[];
    latitude: number[];
    values: number[][];
    variable: string;
    units: string;
    level?: number;
    time?: string;
  };
  title?: string;
  description?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`spatial-viz-tabpanel-${index}`}
      aria-labelledby={`spatial-viz-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const SpatialVisualization: React.FC<SpatialVisualizationProps> = ({ 
  data, 
  title = 'Spatial Visualization', 
  description = 'Geographic distribution of GEOS-Chem model outputs' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorScale, setColorScale] = useState<string>('viridis');
  const [dataMin, setDataMin] = useState<number>(0);
  const [dataMax, setDataMax] = useState<number>(100);
  const [rangeMin, setRangeMin] = useState<number>(0);
  const [rangeMax, setRangeMax] = useState<number>(100);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [centerLon, setCenterLon] = useState<number>(0);
  const [centerLat, setCenterLat] = useState<number>(0);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCoastlines, setShowCoastlines] = useState<boolean>(true);
  
  // Initialize data range when data changes
  useEffect(() => {
    if (data && data.values) {
      // Flatten the 2D array to find min and max values
      const flatValues = data.values.flat().filter(v => !isNaN(v) && v !== undefined && v !== null);
      
      if (flatValues.length > 0) {
        const min = Math.min(...flatValues);
        const max = Math.max(...flatValues);
        
        setDataMin(min);
        setDataMax(max);
        setRangeMin(min);
        setRangeMax(max);
      }
    }
  }, [data]);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Handle color scale change
  const handleColorScaleChange = (event: SelectChangeEvent<string>) => {
    setColorScale(event.target.value);
  };
  
  // Handle zoom level change
  const handleZoomChange = (event: Event, newValue: number | number[]) => {
    setZoomLevel(newValue as number);
  };
  
  // Handle center position change
  const handleCenterLonChange = (event: Event, newValue: number | number[]) => {
    setCenterLon(newValue as number);
  };
  
  const handleCenterLatChange = (event: Event, newValue: number | number[]) => {
    setCenterLat(newValue as number);
  };
  
  // Handle data range slider change
  const handleRangeChange = (event: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      setRangeMin(newValue[0]);
      setRangeMax(newValue[1]);
    }
  };
  
  // Handle range input change
  const handleRangeMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!isNaN(value)) {
      setRangeMin(value);
    }
  };
  
  const handleRangeMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!isNaN(value)) {
      setRangeMax(value);
    }
  };
  
  // Toggle grid lines
  const handleGridToggle = () => {
    setShowGrid(!showGrid);
  };
  
  // Toggle coastlines
  const handleCoastlinesToggle = () => {
    setShowCoastlines(!showCoastlines);
  };
  
  // Get color from a value using the selected color scale
  const getColor = (value: number): string => {
    // If value is outside the range, clamp it
    const clampedValue = Math.max(rangeMin, Math.min(value, rangeMax));
    
    // Normalize the value to the range [0, 1]
    const normalizedValue = (clampedValue - rangeMin) / (rangeMax - rangeMin);
    
    // Apply the appropriate color scale
    switch (colorScale) {
      case 'rainbow':
        return interpolateRainbow(normalizedValue);
      case 'viridis':
        return interpolateViridis(normalizedValue);
      case 'inferno':
        return interpolateInferno(normalizedValue);
      case 'turbo':
        return interpolateTurbo(normalizedValue);
      default:
        return interpolateViridis(normalizedValue);
    }
  };
  
  // Draw the map when data, color scale, or canvas reference changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || !data.values || !data.longitude || !data.latitude) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate pixel dimensions
    const pixelWidth = canvas.width / data.longitude.length;
    const pixelHeight = canvas.height / data.latitude.length;
    
    // Scale factors for zoom
    const scaleFactorX = zoomLevel;
    const scaleFactorY = zoomLevel;
    
    // Draw the data grid
    for (let latIndex = 0; latIndex < data.latitude.length; latIndex++) {
      for (let lonIndex = 0; lonIndex < data.longitude.length; lonIndex++) {
        const value = data.values[latIndex][lonIndex];
        
        // Skip if value is undefined, NaN, or null
        if (value === undefined || isNaN(value) || value === null) {
          continue;
        }
        
        // Map longitude and latitude to canvas coordinates with zoom and center offsets
        const canvasX = ((lonIndex / data.longitude.length) * canvas.width - (centerLon / 360) * canvas.width) * scaleFactorX + canvas.width / 2;
        const canvasY = ((1 - latIndex / data.latitude.length) * canvas.height - (centerLat / 180) * canvas.height) * scaleFactorY + canvas.height / 2;
        
        // Check if the pixel is within the canvas bounds
        if (canvasX >= 0 && canvasX < canvas.width && canvasY >= 0 && canvasY < canvas.height) {
          // Set the fill color based on the value
          ctx.fillStyle = getColor(value);
          
          // Draw a rectangle at the pixel location
          ctx.fillRect(
            canvasX - pixelWidth * scaleFactorX / 2,
            canvasY - pixelHeight * scaleFactorY / 2,
            pixelWidth * scaleFactorX,
            pixelHeight * scaleFactorY
          );
        }
      }
    }
    
    // Draw grid lines if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 0.5;
      
      // Draw longitude grid lines every 30 degrees
      for (let lon = -180; lon <= 180; lon += 30) {
        const canvasX = ((lon + 180) / 360 * canvas.width - (centerLon / 360) * canvas.width) * scaleFactorX + canvas.width / 2;
        if (canvasX >= 0 && canvasX <= canvas.width) {
          ctx.beginPath();
          ctx.moveTo(canvasX, 0);
          ctx.lineTo(canvasX, canvas.height);
          ctx.stroke();
        }
      }
      
      // Draw latitude grid lines every 30 degrees
      for (let lat = -90; lat <= 90; lat += 30) {
        const canvasY = ((90 - lat) / 180 * canvas.height - (centerLat / 180) * canvas.height) * scaleFactorY + canvas.height / 2;
        if (canvasY >= 0 && canvasY <= canvas.height) {
          ctx.beginPath();
          ctx.moveTo(0, canvasY);
          ctx.lineTo(canvas.width, canvasY);
          ctx.stroke();
        }
      }
    }
    
    // Simplified coastlines drawing
    // In a real implementation, this would use GeoJSON data for actual coastlines
    if (showCoastlines) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 1;
      
      // Draw a simple outline for demonstration purposes
      // This would be replaced with actual coastline data in a real implementation
      ctx.beginPath();
      
      // These are just placeholder coordinates - would be replaced with real data
      const coastlineCoords = [
        { lon: -80, lat: 40 },
        { lon: -70, lat: 38 },
        { lon: -65, lat: 42 },
        { lon: -60, lat: 45 }
      ];
      
      let isFirst = true;
      coastlineCoords.forEach(coord => {
        const canvasX = ((coord.lon + 180) / 360 * canvas.width - (centerLon / 360) * canvas.width) * scaleFactorX + canvas.width / 2;
        const canvasY = ((90 - coord.lat) / 180 * canvas.height - (centerLat / 180) * canvas.height) * scaleFactorY + canvas.height / 2;
        
        if (isFirst) {
          ctx.moveTo(canvasX, canvasY);
          isFirst = false;
        } else {
          ctx.lineTo(canvasX, canvasY);
        }
      });
      
      ctx.stroke();
    }
    
    // Draw a color bar
    const colorBarWidth = 20;
    const colorBarHeight = canvas.height * 0.8;
    const colorBarX = canvas.width - colorBarWidth - 10;
    const colorBarY = (canvas.height - colorBarHeight) / 2;
    
    for (let y = 0; y < colorBarHeight; y++) {
      const normalizedValue = 1 - (y / colorBarHeight);
      const value = rangeMin + normalizedValue * (rangeMax - rangeMin);
      
      ctx.fillStyle = getColor(value);
      ctx.fillRect(colorBarX, colorBarY + y, colorBarWidth, 1);
    }
    
    // Draw color bar labels
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    
    // Draw min value at the bottom
    ctx.fillText(rangeMin.toFixed(2), colorBarX - 5, colorBarY + colorBarHeight + 15);
    
    // Draw max value at the top
    ctx.fillText(rangeMax.toFixed(2), colorBarX - 5, colorBarY - 5);
    
    // Draw middle value
    const middleValue = (rangeMin + rangeMax) / 2;
    ctx.fillText(middleValue.toFixed(2), colorBarX - 5, colorBarY + colorBarHeight / 2);
    
    // Draw units
    ctx.fillText(data.units || '', colorBarX - 5, colorBarY + colorBarHeight + 35);
    
  }, [data, colorScale, zoomLevel, centerLon, centerLat, showGrid, showCoastlines, rangeMin, rangeMax]);
  
  // Draw a color scale for the legend
  const drawColorScale = () => {
    const width = 300;
    const height = 20;
    
    return (
      <Box sx={{ width, height, position: 'relative', my: 2 }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(to right, ${getColor(rangeMin)}, ${getColor((rangeMin + rangeMax) / 2)}, ${getColor(rangeMax)})`,
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption">{rangeMin.toFixed(2)}</Typography>
          <Typography variant="caption">{((rangeMin + rangeMax) / 2).toFixed(2)}</Typography>
          <Typography variant="caption">{rangeMax.toFixed(2)}</Typography>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center' }}>
          {data.units || ''}
        </Typography>
      </Box>
    );
  };
  
  return (
    <Box>
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="spatial visualization tabs"
          >
            <Tab label="Map View" id="spatial-viz-tab-0" aria-controls="spatial-viz-tabpanel-0" />
            <Tab label="Settings" id="spatial-viz-tab-1" aria-controls="spatial-viz-tabpanel-1" />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">{title}</Typography>
              <Chip 
                label={`${data.variable} ${data.level ? `Level ${data.level}` : ''} ${data.time ? `at ${data.time}` : ''}`}
                color="primary" 
                variant="outlined" 
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary" paragraph>
              {description}
            </Typography>
            
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <canvas 
                ref={canvasRef} 
                width={800} 
                height={400} 
                style={{ width: '100%', height: 'auto', maxWidth: '800px', border: '1px solid #ddd' }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              {drawColorScale()}
            </Box>
            
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel id="color-scale-label">Color Scale</InputLabel>
                  <Select
                    labelId="color-scale-label"
                    id="color-scale"
                    value={colorScale}
                    label="Color Scale"
                    onChange={handleColorScaleChange}
                  >
                    <MenuItem value="viridis">Viridis</MenuItem>
                    <MenuItem value="inferno">Inferno</MenuItem>
                    <MenuItem value="rainbow">Rainbow</MenuItem>
                    <MenuItem value="turbo">Turbo</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant={showGrid ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleGridToggle}
                  >
                    {showGrid ? 'Hide Grid' : 'Show Grid'}
                  </Button>
                  
                  <Button
                    variant={showCoastlines ? 'contained' : 'outlined'}
                    size="small"
                    onClick={handleCoastlinesToggle}
                  >
                    {showCoastlines ? 'Hide Coastlines' : 'Show Coastlines'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Visualization Settings
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Data Range
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <TextField
                  label="Min"
                  type="number"
                  size="small"
                  value={rangeMin}
                  onChange={handleRangeMinChange}
                  InputProps={{ inputProps: { step: 'any' } }}
                  sx={{ width: 100 }}
                />
                <Slider
                  value={[rangeMin, rangeMax]}
                  onChange={handleRangeChange}
                  min={dataMin}
                  max={dataMax}
                  step={(dataMax - dataMin) / 100}
                  valueLabelDisplay="auto"
                  sx={{ flexGrow: 1 }}
                />
                <TextField
                  label="Max"
                  type="number"
                  size="small"
                  value={rangeMax}
                  onChange={handleRangeMaxChange}
                  InputProps={{ inputProps: { step: 'any' } }}
                  sx={{ width: 100 }}
                />
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Zoom Level
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={zoomLevel}
                  onChange={handleZoomChange}
                  min={0.5}
                  max={5}
                  step={0.1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0.5, label: '0.5x' },
                    { value: 1, label: '1x' },
                    { value: 3, label: '3x' },
                    { value: 5, label: '5x' }
                  ]}
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                Center Longitude
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={centerLon}
                  onChange={handleCenterLonChange}
                  min={-180}
                  max={180}
                  step={1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: -180, label: '-180°' },
                    { value: 0, label: '0°' },
                    { value: 180, label: '180°' }
                  ]}
                />
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" gutterBottom>
                Center Latitude
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={centerLat}
                  onChange={handleCenterLatChange}
                  min={-90}
                  max={90}
                  step={1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: -90, label: '-90°' },
                    { value: 0, label: '0°' },
                    { value: 90, label: '90°' }
                  ]}
                />
              </Box>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default SpatialVisualization;