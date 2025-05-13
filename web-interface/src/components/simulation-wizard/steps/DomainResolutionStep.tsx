import React from 'react';
import {
  Typography,
  Box,
  Grid,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Card,
  CardContent,
  CardMedia,
  Divider,
  Select,
  MenuItem,
  InputLabel,
  SelectChangeEvent,
  Paper,
  Tabs,
  Tab,
  useTheme,
  Alert
} from '@mui/material';

import {
  Public as GlobalIcon,
  CropFree as RegionalIcon,
  ViewComfy as GridIcon
} from '@mui/icons-material';

// Placeholder for domain images
const placeholderImage = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22288%22%20height%3D%22180%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20288%20180%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_17a3f093956%20text%20%7B%20fill%3A%23566573%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A14pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_17a3f093956%22%3E%3Crect%20width%3D%22288%22%20height%3D%22180%22%20fill%3D%22%23e6e6e6%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2296.5%22%20y%3D%2296.4%22%3EDomain%20Image%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';

interface DomainResolutionStepProps {
  formValues: any;
  onChange: (field: string, value: any) => void;
}

const DomainResolutionStep: React.FC<DomainResolutionStepProps> = ({ formValues, onChange }) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = React.useState(0);
  
  // Handle tab change for GC Classic vs GCHP
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Handle nested region selection
  const handleNestedRegionChange = (event: SelectChangeEvent) => {
    onChange('nestedRegion', event.target.value);
  };
  
  // Handle cubed-sphere resolution change
  const handleCubedsphereResChange = (event: SelectChangeEvent) => {
    onChange('cubedsphereRes', event.target.value);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Domain and Resolution Configuration
      </Typography>
      
      <Typography variant="body1" paragraph>
        Select the geographic domain and resolution for your simulation.
      </Typography>
      
      {/* Different configuration for GC Classic vs GCHP */}
      {formValues.simulationType === 'GC_CLASSIC' ? (
        <Box>
          <Grid container spacing={3}>
            {/* Domain Selection */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <GridIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">GEOS-Chem Classic Domain</Typography>
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                <FormControl component="fieldset">
                  <FormLabel component="legend">Select Domain Type</FormLabel>
                  <RadioGroup
                    row
                    name="domain-type"
                    value={formValues.domain}
                    onChange={(e) => onChange('domain', e.target.value)}
                  >
                    <FormControlLabel
                      value="global"
                      control={<Radio />}
                      label="Global Domain"
                    />
                    <FormControlLabel
                      value="nested"
                      control={<Radio />}
                      label="Nested Domain"
                    />
                  </RadioGroup>
                </FormControl>
                
                {/* Global Domain Options */}
                {formValues.domain === 'global' && (
                  <Box sx={{ mt: 3 }}>
                    <FormControl component="fieldset" sx={{ width: '100%' }}>
                      <FormLabel component="legend">Global Resolution</FormLabel>
                      <RadioGroup
                        row
                        name="global-resolution"
                        value={formValues.resolution}
                        onChange={(e) => onChange('resolution', e.target.value)}
                      >
                        <FormControlLabel
                          value="4x5"
                          control={<Radio />}
                          label="4° × 5° (Coarse)"
                        />
                        <FormControlLabel
                          value="2x2.5"
                          control={<Radio />}
                          label="2° × 2.5° (Fine)"
                        />
                      </RadioGroup>
                    </FormControl>
                    
                    <Grid container spacing={2} sx={{ mt: 2 }}>
                      <Grid item xs={12} sm={6}>
                        <Card variant="outlined" sx={{ 
                          border: formValues.resolution === '4x5' ? 2 : 1,
                          borderColor: formValues.resolution === '4x5' ? 'primary.main' : 'divider'
                        }}>
                          <CardMedia
                            component="img"
                            height="140"
                            image={placeholderImage}
                            alt="4° × 5° Resolution"
                          />
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              4° × 5° Resolution
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              • 72 × 46 grid cells globally<br />
                              • Lower computational cost<br />
                              • Good for long-term simulations<br />
                              • Faster run times<br />
                              • Standard resolution for many studies
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Card variant="outlined" sx={{ 
                          border: formValues.resolution === '2x2.5' ? 2 : 1,
                          borderColor: formValues.resolution === '2x2.5' ? 'primary.main' : 'divider'
                        }}>
                          <CardMedia
                            component="img"
                            height="140"
                            image={placeholderImage}
                            alt="2° × 2.5° Resolution"
                          />
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              2° × 2.5° Resolution
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              • 144 × 91 grid cells globally<br />
                              • Higher computational cost<br />
                              • Better for detailed studies<br />
                              • More accurate transport<br />
                              • Higher fidelity results
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Box>
                )}
                
                {/* Nested Domain Options */}
                {formValues.domain === 'nested' && (
                  <Box sx={{ mt: 3 }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="nested-region-label">Nested Region</InputLabel>
                          <Select
                            labelId="nested-region-label"
                            id="nested-region"
                            value={formValues.nestedRegion}
                            label="Nested Region"
                            onChange={handleNestedRegionChange}
                          >
                            <MenuItem value="">Select a region</MenuItem>
                            <MenuItem value="asia">Asia (AS)</MenuItem>
                            <MenuItem value="namerica">North America (NA)</MenuItem>
                            <MenuItem value="europe">Europe (EU)</MenuItem>
                            <MenuItem value="custom">Custom Region</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel id="nested-resolution-label">Resolution</InputLabel>
                          <Select
                            labelId="nested-resolution-label"
                            id="nested-resolution"
                            value={formValues.resolution}
                            label="Resolution"
                            onChange={(e) => onChange('resolution', e.target.value)}
                          >
                            <MenuItem value="0.5x0.625">0.5° × 0.625° (Native)</MenuItem>
                            <MenuItem value="0.25x0.3125">0.25° × 0.3125° (Highest)</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                    
                    {/* Show selected region preview */}
                    {formValues.nestedRegion && formValues.nestedRegion !== 'custom' && (
                      <Card variant="outlined" sx={{ mt: 3 }}>
                        <CardMedia
                          component="img"
                          height="250"
                          image={placeholderImage}
                          alt={`${formValues.nestedRegion} nested domain`}
                        />
                        <CardContent>
                          <Typography variant="h6" gutterBottom>
                            {formValues.nestedRegion === 'asia' && 'Asia Nested Domain'}
                            {formValues.nestedRegion === 'namerica' && 'North America Nested Domain'}
                            {formValues.nestedRegion === 'europe' && 'Europe Nested Domain'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {formValues.nestedRegion === 'asia' && 'Covers East and South Asia, including China, India, and Southeast Asia.'}
                            {formValues.nestedRegion === 'namerica' && 'Covers the continental United States, Canada, and parts of Mexico.'}
                            {formValues.nestedRegion === 'europe' && 'Covers Western and Eastern Europe, including the UK and parts of Russia.'}
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Custom region note */}
                    {formValues.nestedRegion === 'custom' && (
                      <Alert severity="info" sx={{ mt: 3 }}>
                        Custom nested domains can be configured after simulation creation. You will be able to specify the exact latitude and longitude boundaries.
                      </Alert>
                    )}
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <Box>
          {/* GCHP Configuration */}
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <GridIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">GCHP Cubed-Sphere Grid</Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <Typography variant="body2" paragraph>
              GCHP uses a cubed-sphere grid for better performance and scaling across multiple processors. 
              Select a resolution based on your scientific needs and computational resources.
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="cubedsphere-res-label">Cubed-Sphere Resolution</InputLabel>
              <Select
                labelId="cubedsphere-res-label"
                id="cubedsphere-res"
                value={formValues.cubedsphereRes}
                label="Cubed-Sphere Resolution"
                onChange={handleCubedsphereResChange}
              >
                <MenuItem value="">Select a resolution</MenuItem>
                <MenuItem value="C24">C24 (~4° resolution)</MenuItem>
                <MenuItem value="C48">C48 (~2° resolution)</MenuItem>
                <MenuItem value="C90">C90 (~1° resolution)</MenuItem>
                <MenuItem value="C180">C180 (~0.5° resolution)</MenuItem>
                <MenuItem value="C360">C360 (~0.25° resolution)</MenuItem>
              </Select>
            </FormControl>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardMedia
                    component="img"
                    height="200"
                    image={placeholderImage}
                    alt="Cubed-Sphere Grid"
                  />
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Cubed-Sphere Grid
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      The cubed-sphere grid is formed by projecting a cube onto a sphere, resulting in six identical faces.
                      This avoids the "pole problem" of traditional lat-lon grids and enables better scaling on parallel computers.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent sx={{ height: '100%' }}>
                    <Typography variant="h6" gutterBottom>
                      Resolution Comparison
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Approximate Grid Sizes:</Typography>
                      <Typography variant="body2">• C24: 24×24×6 = 3,456 cells (~4°)</Typography>
                      <Typography variant="body2">• C48: 48×48×6 = 13,824 cells (~2°)</Typography>
                      <Typography variant="body2">• C90: 90×90×6 = 48,600 cells (~1°)</Typography>
                      <Typography variant="body2">• C180: 180×180×6 = 194,400 cells (~0.5°)</Typography>
                      <Typography variant="body2">• C360: 360×360×6 = 777,600 cells (~0.25°)</Typography>
                    </Box>
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        Higher resolutions require significantly more computational resources.
                        C90-C180 typically requires multiple nodes for efficient execution.
                        C360 is for advanced high-performance computing environments only.
                      </Typography>
                    </Alert>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
            
            {formValues.cubedsphereRes === 'C180' || formValues.cubedsphereRes === 'C360' ? (
              <Alert severity="warning" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  You've selected a high-resolution configuration. This will require significant computational resources
                  and will be more expensive to run. Make sure your scientific requirements justify this resolution.
                </Typography>
              </Alert>
            ) : null}
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default DomainResolutionStep;