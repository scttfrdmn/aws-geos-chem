// src/__mocks__/mockApi.ts
import { rest } from 'msw';
import { setupServer } from 'msw/node';

// Mock data
import { mockSimulations, mockNetCDFMetadata, mockTimeSeriesData } from './mockData';

// Setup request handlers
export const handlers = [
  // Simulations endpoints
  rest.get('/api/simulations', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ simulations: mockSimulations }));
  }),
  
  rest.get('/api/simulations/:simulationId', (req, res, ctx) => {
    const { simulationId } = req.params;
    const simulation = mockSimulations.find(sim => sim.id === simulationId);
    
    if (simulation) {
      return res(ctx.status(200), ctx.json(simulation));
    }
    
    return res(ctx.status(404), ctx.json({ message: 'Simulation not found' }));
  }),
  
  // Results endpoints
  rest.get('/api/results/:simulationId/files', (req, res, ctx) => {
    const path = req.url.searchParams.get('path') || '';
    
    // Mock file list based on path
    const files = [
      {
        key: `${path}/file1.nc`,
        name: 'file1.nc',
        size: 1024 * 1024,
        lastModified: '2023-01-01T00:00:00Z',
        type: 'file',
        path: `${path}/file1.nc`
      },
      {
        key: `${path}/file2.bpch`,
        name: 'file2.bpch',
        size: 2 * 1024 * 1024,
        lastModified: '2023-01-02T00:00:00Z',
        type: 'file',
        path: `${path}/file2.bpch`
      },
      {
        key: `${path}/subfolder`,
        name: 'subfolder',
        size: 0,
        lastModified: '2023-01-03T00:00:00Z',
        type: 'directory',
        path: `${path}/subfolder`
      }
    ];
    
    return res(ctx.status(200), ctx.json({ files }));
  }),
  
  // NetCDF Metadata
  rest.get('/api/results/:simulationId/netcdf-metadata', (req, res, ctx) => {
    const filePath = req.url.searchParams.get('filePath');
    
    // Return mock metadata
    return res(ctx.status(200), ctx.json({ metadata: mockNetCDFMetadata }));
  }),
  
  // NetCDF Data
  rest.get('/api/results/:simulationId/netcdf-data', (req, res, ctx) => {
    const filePath = req.url.searchParams.get('filePath');
    const variable = req.url.searchParams.get('variable');
    const dimensionsParam = req.url.searchParams.get('dimensions');
    
    let dimensions = {};
    try {
      if (dimensionsParam) {
        dimensions = JSON.parse(dimensionsParam);
      }
    } catch (e) {
      return res(ctx.status(400), ctx.json({ message: 'Invalid dimensions format' }));
    }
    
    // Mock variable data
    const variableData = {
      data: Array(100).fill(0).map(() => Math.random() * 100),
      shape: [10, 10],
      dims: ['lat', 'lon']
    };
    
    return res(ctx.status(200), ctx.json({ data: variableData, metadata: mockNetCDFMetadata }));
  }),
  
  // Spatial Visualization
  rest.post('/api/results/:simulationId/spatial-visualization', (req, res, ctx) => {
    const { simulationId } = req.params;
    const { variable, level, time, plotType, colormap } = req.body;
    
    // Mock response with an image URL
    return res(ctx.status(200), ctx.json({
      simulationId,
      imageUrl: `https://example.com/visualizations/${simulationId}_${variable}_${level}_${time}.png`,
      metadata: {
        variable,
        level,
        time,
        plotType,
        colormap,
        min: 0,
        max: 100,
        units: 'ppb'
      }
    }));
  }),
  
  // Spatial Difference Visualization
  rest.post('/api/results/spatial-difference', (req, res, ctx) => {
    const { simulationId1, simulationId2, variable, level, time, useRelativeDifference } = req.body;
    
    // Mock response with a difference image URL
    return res(ctx.status(200), ctx.json({
      simulationId1,
      simulationId2,
      imageUrl: `https://example.com/visualizations/diff_${simulationId1}_${simulationId2}_${variable}_${useRelativeDifference ? 'relative' : 'absolute'}.png`,
      metadata: {
        variable,
        level,
        time,
        useRelativeDifference,
        colormap: 'RdBu_r',
        min: useRelativeDifference ? -100 : -10,
        max: useRelativeDifference ? 100 : 10,
        units: useRelativeDifference ? '%' : 'ppb'
      }
    }));
  })
];

// Set up the server
export const server = setupServer(...handlers);

// Export the mock API for use in tests
export default server;