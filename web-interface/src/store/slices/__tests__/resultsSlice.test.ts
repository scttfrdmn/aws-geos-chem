// src/store/slices/__tests__/resultsSlice.test.ts
import reducer, {
  setSelectedVariables,
  clearSelectedFile,
  clearError,
  setCurrentPath,
  clearNetCDFMetadata,
  selectNetCDFMetadata,
  selectSpatialVisualization,
  selectSpatialDifference
} from '../resultsSlice';

describe('resultsSlice reducer', () => {
  const initialState = {
    currentSimulationId: null,
    files: [],
    currentPath: '',
    visualizations: [],
    selectedFile: null,
    netcdfMetadata: {
      'test.nc': {
        dimensions: [
          { name: 'time', size: 24 },
          { name: 'lat', size: 91 }
        ],
        variables: [
          { 
            name: 'SpeciesConc_O3',
            dimensions: ['time', 'lev', 'lat', 'lon'],
            shape: [24, 72, 91, 144],
            units: 'ppb'
          }
        ],
        globalAttributes: {}
      }
    },
    selectedVariables: [],
    spatialVisualizations: {
      'sim-1': {
        simulationId: 'sim-1',
        imageUrl: 'test-url',
        metadata: {
          variable: 'SpeciesConc_O3',
          level: 'surface',
          time: 0,
          plotType: 'horizontal',
          colormap: 'viridis',
          min: 0,
          max: 100,
          units: 'ppb'
        }
      }
    },
    spatialDifferences: {
      'sim-1_sim-2': {
        simulationId1: 'sim-1',
        simulationId2: 'sim-2',
        imageUrl: 'diff-url',
        metadata: {
          variable: 'SpeciesConc_O3',
          level: 'surface',
          time: 0,
          useRelativeDifference: false,
          colormap: 'RdBu_r',
          min: -10,
          max: 10,
          units: 'ppb'
        }
      }
    },
    loading: false,
    error: null,
    generatingVisualization: false
  };

  it('should handle initial state', () => {
    expect(reducer(undefined, { type: 'unknown' })).toEqual({
      currentSimulationId: null,
      files: [],
      currentPath: '',
      visualizations: [],
      selectedFile: null,
      netcdfMetadata: {},
      selectedVariables: [],
      spatialVisualizations: {},
      spatialDifferences: {},
      loading: false,
      error: null,
      generatingVisualization: false
    });
  });

  it('should handle setSelectedVariables', () => {
    const variables = ['SpeciesConc_O3', 'SpeciesConc_NO2'];
    const actualState = reducer(initialState, setSelectedVariables(variables));
    
    expect(actualState.selectedVariables).toEqual(variables);
  });

  it('should handle clearSelectedFile', () => {
    const stateWithSelectedFile = {
      ...initialState,
      selectedFile: { key: 'file1.nc', name: 'file1.nc', size: 1000, lastModified: '2023-01-01', type: 'file', path: '/path/to/file1.nc' }
    };
    
    const actualState = reducer(stateWithSelectedFile, clearSelectedFile());
    
    expect(actualState.selectedFile).toBeNull();
  });

  it('should handle clearError', () => {
    const stateWithError = {
      ...initialState,
      error: 'Test error message'
    };
    
    const actualState = reducer(stateWithError, clearError());
    
    expect(actualState.error).toBeNull();
  });

  it('should handle setCurrentPath', () => {
    const newPath = '/new/path';
    const actualState = reducer(initialState, setCurrentPath(newPath));
    
    expect(actualState.currentPath).toEqual(newPath);
  });

  it('should handle clearNetCDFMetadata', () => {
    const actualState = reducer(initialState, clearNetCDFMetadata());
    
    expect(actualState.netcdfMetadata).toEqual({});
  });

  // Selector tests
  describe('selectors', () => {
    const state = {
      results: initialState
    };

    it('selectNetCDFMetadata should return correct metadata', () => {
      const metadata = selectNetCDFMetadata('test.nc')(state);
      
      expect(metadata).toEqual(initialState.netcdfMetadata['test.nc']);
    });

    it('selectNetCDFMetadata should return undefined for non-existent file', () => {
      const metadata = selectNetCDFMetadata('non-existent.nc')(state);
      
      expect(metadata).toBeUndefined();
    });

    it('selectSpatialVisualization should return correct visualization', () => {
      const visualization = selectSpatialVisualization('sim-1')(state);
      
      expect(visualization).toEqual(initialState.spatialVisualizations['sim-1']);
    });

    it('selectSpatialDifference should return correct difference visualization', () => {
      const diffVisualization = selectSpatialDifference('sim-1', 'sim-2')(state);
      
      expect(diffVisualization).toEqual(initialState.spatialDifferences['sim-1_sim-2']);
    });
  });
});