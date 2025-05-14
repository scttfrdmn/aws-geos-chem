// src/__mocks__/mockData.ts

// Mock simulations
export const mockSimulations = [
  {
    id: 'sim-1',
    name: 'Baseline Simulation',
    description: 'Standard GEOS-Chem simulation with default settings',
    status: 'completed',
    createdAt: '2023-01-01T00:00:00Z',
    completedAt: '2023-01-01T06:00:00Z',
    config: {
      type: 'full-chemistry',
      resolution: '4x5',
      meteorology: 'GEOS-FP',
      simulationLength: {
        value: 7,
        unit: 'days'
      }
    }
  },
  {
    id: 'sim-2',
    name: 'Modified Emissions',
    description: 'Simulation with 50% reduced NOx emissions',
    status: 'completed',
    createdAt: '2023-01-02T00:00:00Z',
    completedAt: '2023-01-02T06:00:00Z',
    config: {
      type: 'full-chemistry',
      resolution: '4x5',
      meteorology: 'GEOS-FP',
      simulationLength: {
        value: 7,
        unit: 'days'
      },
      emissionScalingFactors: {
        NOx: 0.5
      }
    }
  },
  {
    id: 'sim-3',
    name: 'Hi-Res Simulation',
    description: 'High-resolution (0.5x0.625) nested simulation',
    status: 'completed',
    createdAt: '2023-01-03T00:00:00Z',
    completedAt: '2023-01-03T10:00:00Z',
    config: {
      type: 'full-chemistry',
      resolution: '0.5x0.625',
      meteorology: 'GEOS-FP',
      simulationLength: {
        value: 3,
        unit: 'days'
      },
      nestedDomain: {
        name: 'NA',
        description: 'North America'
      }
    }
  }
];

// Mock NetCDF metadata
export const mockNetCDFMetadata = {
  dimensions: [
    { name: 'time', size: 24, units: 'hours since 2023-01-01 00:00:00' },
    { name: 'lat', size: 91, units: 'degrees_north' },
    { name: 'lon', size: 144, units: 'degrees_east' },
    { name: 'lev', size: 72, units: 'hPa' }
  ],
  variables: [
    {
      name: 'SpeciesConc_O3',
      longName: 'Ozone Volume Mixing Ratio',
      units: 'mol mol-1',
      dimensions: ['time', 'lev', 'lat', 'lon'],
      shape: [24, 72, 91, 144],
      attributes: {
        standard_name: 'mole_fraction_of_ozone_in_air',
        units: 'mol mol-1',
        valid_range: [0, 1e-5]
      }
    },
    {
      name: 'SpeciesConc_NO2',
      longName: 'Nitrogen Dioxide Volume Mixing Ratio',
      units: 'mol mol-1',
      dimensions: ['time', 'lev', 'lat', 'lon'],
      shape: [24, 72, 91, 144],
      attributes: {
        standard_name: 'mole_fraction_of_nitrogen_dioxide_in_air',
        units: 'mol mol-1',
        valid_range: [0, 1e-5]
      }
    },
    {
      name: 'SpeciesConc_CO',
      longName: 'Carbon Monoxide Volume Mixing Ratio',
      units: 'mol mol-1',
      dimensions: ['time', 'lev', 'lat', 'lon'],
      shape: [24, 72, 91, 144],
      attributes: {
        standard_name: 'mole_fraction_of_carbon_monoxide_in_air',
        units: 'mol mol-1',
        valid_range: [0, 1e-5]
      }
    },
    {
      name: 'Met_TEMP',
      longName: 'Temperature',
      units: 'K',
      dimensions: ['time', 'lev', 'lat', 'lon'],
      shape: [24, 72, 91, 144],
      attributes: {
        standard_name: 'air_temperature',
        units: 'K',
        valid_range: [180, 330]
      }
    },
    {
      name: 'Met_PS',
      longName: 'Surface Pressure',
      units: 'hPa',
      dimensions: ['time', 'lat', 'lon'],
      shape: [24, 91, 144],
      attributes: {
        standard_name: 'surface_air_pressure',
        units: 'hPa',
        valid_range: [0, 1100]
      }
    }
  ],
  globalAttributes: {
    title: 'GEOS-Chem Output',
    model: 'GEOS-Chem 13.3.4',
    modelVersion: '13.3.4',
    meteorology: 'GEOS-FP',
    resolution: '4x5',
    simulationStart: '2023-01-01 00:00:00Z',
    simulationEnd: '2023-01-07 23:59:59Z',
    createdBy: 'GEOS-Chem AWS Cloud Runner'
  }
};

// Generate mock time series data for simulations
export const generateMockTimeSeries = (simulationId: string, variable: string, length: number = 24) => {
  // Base values for different variables
  const baseValues: Record<string, number> = {
    'SpeciesConc_O3': 30, // ppb
    'SpeciesConc_NO2': 10, // ppb
    'SpeciesConc_CO': 150, // ppb
    'Met_TEMP': 298, // K
    'Met_PS': 1013 // hPa
  };
  
  // Units for different variables
  const units: Record<string, string> = {
    'SpeciesConc_O3': 'ppb',
    'SpeciesConc_NO2': 'ppb',
    'SpeciesConc_CO': 'ppb',
    'Met_TEMP': 'K',
    'Met_PS': 'hPa'
  };
  
  // Simulation-specific adjustments
  const simAdjustments: Record<string, number> = {
    'sim-1': 1.0, // Baseline
    'sim-2': simulationId === 'sim-2' && variable === 'SpeciesConc_NO2' ? 0.5 : 0.9, // 50% NOx reduction
    'sim-3': 1.2 // Different resolution sometimes leads to higher concentrations
  };
  
  // Create time steps (hourly for 24 hours)
  const times = Array.from({ length }, (_, i) => `${i}:00`);
  
  // Generate values with a diurnal cycle and some noise
  const baseValue = baseValues[variable] || 10;
  const adjustment = simAdjustments[simulationId] || 1.0;
  
  const values = times.map((_, i) => {
    // Diurnal cycle with peak around noon
    const hourFactor = Math.sin((i / length) * Math.PI) * 0.3 + 0.7;
    // Add some random noise
    const noise = (Math.random() - 0.5) * 0.1;
    
    return baseValue * adjustment * hourFactor * (1 + noise);
  });
  
  return {
    simulationId,
    simulationName: mockSimulations.find(sim => sim.id === simulationId)?.name || simulationId,
    variable,
    units: units[variable] || '',
    times,
    values,
    color: simulationId === 'sim-1' ? '#8884d8' : simulationId === 'sim-2' ? '#82ca9d' : '#ff7300',
    visible: true
  };
};

// Mock time series data for multiple simulations and variables
export const mockTimeSeriesData = {
  'SpeciesConc_O3': [
    generateMockTimeSeries('sim-1', 'SpeciesConc_O3'),
    generateMockTimeSeries('sim-2', 'SpeciesConc_O3'),
    generateMockTimeSeries('sim-3', 'SpeciesConc_O3')
  ],
  'SpeciesConc_NO2': [
    generateMockTimeSeries('sim-1', 'SpeciesConc_NO2'),
    generateMockTimeSeries('sim-2', 'SpeciesConc_NO2'),
    generateMockTimeSeries('sim-3', 'SpeciesConc_NO2')
  ],
  'Met_TEMP': [
    generateMockTimeSeries('sim-1', 'Met_TEMP'),
    generateMockTimeSeries('sim-2', 'Met_TEMP'),
    generateMockTimeSeries('sim-3', 'Met_TEMP')
  ]
};

// Generate mock spatial data for a variable
export const generateMockSpatialData = (
  variable: string, 
  latSize: number = 46, 
  lonSize: number = 72
) => {
  // Generate latitude and longitude arrays
  const lats = Array.from({ length: latSize }, (_, i) => -90 + (i * 180 / (latSize - 1)));
  const lons = Array.from({ length: lonSize }, (_, i) => -180 + (i * 360 / (lonSize - 1)));
  
  // Base values for different variables
  const baseValues: Record<string, number> = {
    'SpeciesConc_O3': 30, // ppb
    'SpeciesConc_NO2': 10, // ppb
    'SpeciesConc_CO': 150, // ppb
    'Met_TEMP': 298, // K
    'Met_PS': 1013 // hPa
  };
  
  // Units for different variables
  const units: Record<string, string> = {
    'SpeciesConc_O3': 'ppb',
    'SpeciesConc_NO2': 'ppb',
    'SpeciesConc_CO': 'ppb',
    'Met_TEMP': 'K',
    'Met_PS': 'hPa'
  };
  
  const baseValue = baseValues[variable] || 10;
  
  // Generate 2D array of values with a realistic spatial pattern
  const values = lats.map((lat, i) => {
    return lons.map((lon, j) => {
      // Create a pattern with higher values in the northern hemisphere 
      // and some wave patterns for realism
      const latFactor = (lat + 90) / 180; // 0 to 1 from south to north
      const lonWave = Math.sin((lon + 180) / 360 * Math.PI * 3); // Wave pattern in longitude
      const latWave = Math.sin((lat + 90) / 180 * Math.PI * 2); // Wave pattern in latitude
      
      // Combine factors with some randomness
      const value = baseValue * (0.7 + 0.6 * latFactor + 0.2 * lonWave + 0.1 * latWave + 0.1 * Math.random());
      
      return Math.max(0, value); // Ensure non-negative values
    });
  });
  
  return {
    lats,
    lons,
    values,
    units: units[variable] || '',
    variable
  };
};

// Mock spatial data for various variables
export const mockSpatialData = {
  'SpeciesConc_O3': generateMockSpatialData('SpeciesConc_O3'),
  'SpeciesConc_NO2': generateMockSpatialData('SpeciesConc_NO2'),
  'SpeciesConc_CO': generateMockSpatialData('SpeciesConc_CO'),
  'Met_TEMP': generateMockSpatialData('Met_TEMP'),
  'Met_PS': generateMockSpatialData('Met_PS')
};