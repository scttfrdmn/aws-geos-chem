# GEOS-Chem AWS Cloud Runner Testing Plan

This document outlines the testing strategy for the GEOS-Chem AWS Cloud Runner, with a focus on ensuring the stability and reliability of the visualization components.

## Table of Contents

- [Testing Strategy Overview](#testing-strategy-overview)
- [Unit Testing](#unit-testing)
- [Component Testing](#component-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Performance Testing](#performance-testing)
- [Test Data](#test-data)
- [CI/CD Integration](#cicd-integration)
- [Implementation Timeline](#implementation-timeline)

## Testing Strategy Overview

The testing strategy employs a pyramid approach with a focus on:

1. **Unit Tests**: Testing individual functions and utilities
2. **Component Tests**: Testing React components in isolation
3. **Integration Tests**: Testing interactions between components
4. **End-to-End Tests**: Testing full user workflows

The goal is to achieve:
- ~70% code coverage for core functionality
- Comprehensive test coverage for visualization components
- Automated test runs for all pull requests
- Regression test suite for critical workflows

## Unit Testing

Unit tests focus on testing individual functions, particularly those handling data transformations and calculations.

### Libraries and Tools

- **Jest**: Primary test runner
- **Testing Library**: For testing React hooks and utilities
- **Mock Service Worker**: For API mocking

### Key Areas for Unit Testing

1. **Redux Slices**
   - Action creators
   - Reducers
   - Selectors
   - Async thunks

2. **Utility Functions**
   - Statistical calculation functions
   - Data transformation helpers
   - Formatting utilities

3. **Hooks**
   - Custom React hooks
   - Side-effect handling

### Example Unit Test for Statistical Functions

```javascript
// __tests__/utils/statistical.test.js
import { calculateRMSE, calculateCorrelation, calculateMBE } from '../../utils/statistical';

describe('Statistical Utility Functions', () => {
  describe('calculateRMSE', () => {
    it('calculates root mean square error correctly', () => {
      const values1 = [1, 2, 3, 4, 5];
      const values2 = [1, 3, 3, 2, 5];
      const rmse = calculateRMSE(values1, values2);
      expect(rmse).toBeCloseTo(1.0);
    });

    it('handles empty arrays', () => {
      expect(calculateRMSE([], [])).toBeNaN();
    });
  });

  describe('calculateCorrelation', () => {
    it('calculates correlation coefficient correctly', () => {
      const values1 = [1, 2, 3, 4, 5];
      const values2 = [5, 4, 3, 2, 1];
      const correlation = calculateCorrelation(values1, values2);
      expect(correlation).toBeCloseTo(-1.0);
    });

    it('handles arrays with no variation', () => {
      const values1 = [2, 2, 2, 2];
      const values2 = [1, 3, 5, 7];
      expect(calculateCorrelation(values1, values2)).toBe(0);
    });
  });
});
```

### Example Redux Slice Test

```javascript
// __tests__/store/resultsSlice.test.js
import resultsReducer, {
  setSelectedVariables,
  clearNetCDFMetadata,
  selectNetCDFMetadata
} from '../../store/slices/resultsSlice';

describe('Results Slice', () => {
  const initialState = {
    netcdfMetadata: {
      'file1.nc': { dimensions: [], variables: [] }
    },
    selectedVariables: [],
    // ...other properties
  };

  it('should handle setSelectedVariables', () => {
    const variables = ['var1', 'var2'];
    const nextState = resultsReducer(initialState, setSelectedVariables(variables));
    expect(nextState.selectedVariables).toEqual(variables);
  });

  it('should handle clearNetCDFMetadata', () => {
    const nextState = resultsReducer(initialState, clearNetCDFMetadata());
    expect(nextState.netcdfMetadata).toEqual({});
  });

  it('should select metadata correctly', () => {
    const state = { results: initialState };
    const selector = selectNetCDFMetadata('file1.nc');
    expect(selector(state)).toEqual({ dimensions: [], variables: [] });
  });
});
```

## Component Testing

Component tests verify that individual React components render and behave correctly in isolation.

### Libraries and Tools

- **React Testing Library**: For testing React components
- **Jest DOM**: For enhanced DOM assertions
- **Mock Service Worker**: For API mocking in component tests

### Key Components to Test

1. **Visualization Components**
   - NetCDFViewer
   - BpchViewer
   - SpatialVisualization
   - TimeSeriesComparison
   - StatisticalAnalysis

2. **UI Components**
   - Form controls
   - Data grids
   - Charts and plots

3. **Container Components**
   - Page components
   - Layout components

### Example Component Test

```javascript
// __tests__/components/results/TimeSeriesComparison.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import TimeSeriesComparison from '../../../components/results/TimeSeriesComparison';
import { mockSimulations, mockTimeSeriesData } from '../../mocks/simulationData';

const mockStore = configureStore([thunk]);

describe('TimeSeriesComparison Component', () => {
  let store;

  beforeEach(() => {
    store = mockStore({
      simulations: {
        simulations: mockSimulations,
        loading: false,
        error: null
      },
      results: {
        files: [],
        loading: false,
        error: null
      }
    });
  });

  it('renders without crashing', () => {
    render(
      <Provider store={store}>
        <TimeSeriesComparison initialSimulationIds={['sim-1', 'sim-2']} />
      </Provider>
    );
    
    expect(screen.getByText(/time series comparison/i)).toBeInTheDocument();
  });

  it('allows variable selection', () => {
    render(
      <Provider store={store}>
        <TimeSeriesComparison initialSimulationIds={['sim-1', 'sim-2']} />
      </Provider>
    );
    
    const variableSelect = screen.getByLabelText(/variable to compare/i);
    fireEvent.change(variableSelect, { target: { value: 'SpeciesConc_O3' } });
    
    expect(store.getActions()).toContainEqual(
      expect.objectContaining({
        type: expect.stringContaining('fetchNetCDFData')
      })
    );
  });

  it('displays charts when data is available', async () => {
    // Update store with mock time series data
    store = mockStore({
      simulations: {
        simulations: mockSimulations,
        loading: false
      },
      results: {
        timeSeriesData: mockTimeSeriesData,
        loading: false
      }
    });

    render(
      <Provider store={store}>
        <TimeSeriesComparison initialSimulationIds={['sim-1', 'sim-2']} />
      </Provider>
    );
    
    // Check that charts are rendered
    expect(screen.getByRole('graphics-document')).toBeInTheDocument();
  });
});
```

## Integration Testing

Integration tests verify that different components work together correctly.

### Libraries and Tools

- **React Testing Library**: For testing component interactions
- **Cypress Component Testing**: For more complex component interactions
- **Mock Service Worker**: For API mocking

### Key Integration Scenarios

1. **Data Flow**
   - Redux state updates across components
   - Data passed between parent and child components

2. **User Interactions**
   - Form submissions
   - Visualization controls
   - Multi-step workflows

3. **Error Handling**
   - API error handling
   - User input validation
   - Fallback behaviors

### Example Integration Test

```javascript
// __tests__/integration/simulationComparison.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import configureStore from '../../store';
import SimulationComparisons from '../../pages/SimulationComparisons';

describe('Simulation Comparison Workflow', () => {
  let store;
  let history;

  beforeEach(() => {
    store = configureStore();
    history = createMemoryHistory();
    history.push('/comparisons/sim-1,sim-2');
  });

  it('navigates between comparison tabs', async () => {
    render(
      <Provider store={store}>
        <Router history={history}>
          <SimulationComparisons />
        </Router>
      </Provider>
    );
    
    // Check time series tab is active by default
    expect(screen.getByRole('tab', { name: /time series/i }).getAttribute('aria-selected')).toBe('true');
    
    // Click on spatial comparison tab
    fireEvent.click(screen.getByRole('tab', { name: /spatial comparison/i }));
    
    // Check spatial comparison tab is now active
    expect(screen.getByRole('tab', { name: /spatial comparison/i }).getAttribute('aria-selected')).toBe('true');
    
    // Verify spatial comparison component is rendered
    await waitFor(() => {
      expect(screen.getByText(/spatial distributions and patterns/i)).toBeInTheDocument();
    });
  });

  it('loads and displays simulation data', async () => {
    render(
      <Provider store={store}>
        <Router history={history}>
          <SimulationComparisons />
        </Router>
      </Provider>
    );
    
    // Verify simulations are loaded
    await waitFor(() => {
      expect(screen.getByText(/Simulation 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Simulation 2/i)).toBeInTheDocument();
    });
    
    // Select a variable
    const variableSelect = screen.getByLabelText(/variable to compare/i);
    fireEvent.change(variableSelect, { target: { value: 'SpeciesConc_O3' } });
    
    // Verify chart is displayed after data is loaded
    await waitFor(() => {
      expect(screen.getByRole('graphics-document')).toBeInTheDocument();
    });
  });
});
```

## End-to-End Testing

End-to-end tests verify complete user workflows across the application.

### Libraries and Tools

- **Cypress**: Primary E2E testing framework
- **Percy**: For visual regression testing

### Key User Workflows

1. **Simulation Comparison**
   - Selecting simulations for comparison
   - Generating comparison visualizations
   - Exporting comparison data

2. **File Browsing and Visualization**
   - Browsing simulation results
   - Opening and visualizing NetCDF files
   - Customizing visualization parameters

3. **Authentication and Authorization**
   - Login flow
   - Access to protected resources
   - Permission handling

### Example E2E Test

```javascript
// cypress/e2e/simulation-comparison.cy.js
describe('Simulation Comparison', () => {
  beforeEach(() => {
    cy.login(); // Custom command for authentication
    cy.visit('/simulations');
  });

  it('allows comparison of multiple simulations', () => {
    // Select two simulations
    cy.get('[data-testid="simulation-item"]').eq(0).find('[data-testid="compare-checkbox"]').check();
    cy.get('[data-testid="simulation-item"]').eq(1).find('[data-testid="compare-checkbox"]').check();
    
    // Click compare button
    cy.get('[data-testid="compare-button"]').click();
    
    // Verify we're on the comparison page
    cy.url().should('include', '/comparisons');
    
    // Verify both simulations are shown
    cy.get('[data-testid="selected-simulation"]').should('have.length', 2);
    
    // Select a variable to compare
    cy.get('[data-testid="variable-select"]').click();
    cy.get('[data-role="option"]').contains('SpeciesConc_O3').click();
    
    // Verify charts are displayed
    cy.get('[data-testid="time-series-chart"]').should('be.visible');
    
    // Switch to correlation tab
    cy.get('[role="tab"]').contains('Correlation').click();
    
    // Verify correlation plot is displayed
    cy.get('[data-testid="correlation-plot"]').should('be.visible');
    
    // Export data
    cy.get('[data-testid="export-button"]').click();
    
    // Verify file download occurs
    cy.verifyDownload('SpeciesConc_O3_comparison.csv');
  });

  it('supports spatial comparison of simulations', () => {
    // ... Similar test for spatial comparison
  });
});
```

## Performance Testing

Performance tests ensure the application remains responsive with large datasets.

### Areas for Performance Testing

1. **Visualization Rendering**
   - Large spatial datasets
   - Long time series
   - Multiple simultaneous visualizations

2. **Data Loading**
   - Large NetCDF files
   - Multiple file loading
   - API response times

3. **User Interactions**
   - UI responsiveness during data processing
   - Chart interaction performance
   - Filter/selection performance

### Performance Testing Approach

1. **Benchmark Tests**: Measure time for key operations
2. **Memory Profiling**: Monitor memory usage during visualization operations
3. **Synthetic Load Tests**: Test with progressively larger datasets

### Example Performance Test

```javascript
// performance/visualization.perf.js
import { performance } from 'perf_hooks';
import { renderSpatialData, processNetCDFData } from '../utils/visualizationUtils';

describe('Visualization Performance', () => {
  it('processNetCDFData handles large datasets efficiently', () => {
    // Generate synthetic dataset (e.g., 1000x500 grid)
    const largeDataset = generateSyntheticData(1000, 500);
    
    const start = performance.now();
    const processed = processNetCDFData(largeDataset);
    const end = performance.now();
    
    console.log(`processNetCDFData took ${end - start}ms`);
    
    // Assert processing time is within acceptable range
    expect(end - start).toBeLessThan(500); // Should process in under 500ms
  });

  it('renderSpatialData scales with data size', () => {
    // Test with different data sizes to establish scaling behavior
    const dataSizes = [
      [100, 100],   // Small
      [500, 500],   // Medium
      [1000, 1000]  // Large
    ];
    
    const times = dataSizes.map(([rows, cols]) => {
      const data = generateSyntheticData(rows, cols);
      
      const start = performance.now();
      renderSpatialData(data, mockCanvasContext);
      const end = performance.now();
      
      return { size: `${rows}x${cols}`, time: end - start };
    });
    
    console.table(times);
    
    // Check that the largest dataset renders in a reasonable time
    const largestTime = times[times.length - 1].time;
    expect(largestTime).toBeLessThan(1000); // Should render in under 1s
  });
});
```

## Test Data

To ensure effective testing, we'll use a combination of:

1. **Mock Data**: For unit and component tests
2. **Synthetic Data**: Generated data for performance tests
3. **Sample GEOS-Chem Outputs**: Real but small example outputs
4. **Large Test Datasets**: For performance and scalability testing

### Mock Data Example

```javascript
// __mocks__/simulationData.js
export const mockSimulations = [
  {
    id: 'sim-1',
    name: 'Simulation 1',
    status: 'completed',
    createdAt: '2023-01-01T00:00:00Z',
    description: 'Base simulation'
  },
  {
    id: 'sim-2',
    name: 'Simulation 2',
    status: 'completed',
    createdAt: '2023-01-02T00:00:00Z',
    description: 'Modified emissions'
  }
];

export const mockNetCDFMetadata = {
  dimensions: [
    { name: 'time', size: 24 },
    { name: 'lat', size: 91 },
    { name: 'lon', size: 144 },
    { name: 'lev', size: 72 }
  ],
  variables: [
    {
      name: 'SpeciesConc_O3',
      longName: 'Ozone Volume Mixing Ratio',
      units: 'mol mol-1',
      dimensions: ['time', 'lev', 'lat', 'lon'],
      shape: [24, 72, 91, 144]
    },
    // More variables...
  ],
  globalAttributes: {
    title: 'GEOS-Chem Output',
    model: 'GEOS-Chem 13.3.4'
  }
};

export const mockTimeSeriesData = [
  // Mock time series data for testing charts
];
```

## CI/CD Integration

The testing strategy will be integrated with the CI/CD pipeline to ensure code quality.

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
        cache: 'npm'
    
    - name: Install Dependencies
      run: npm ci
    
    - name: Lint
      run: npm run lint
    
    - name: Type Check
      run: npm run typecheck
    
    - name: Unit & Component Tests
      run: npm run test
    
    - name: Upload Coverage
      uses: codecov/codecov-action@v3
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
    
    - name: Build
      run: npm run build
    
    - name: E2E Tests
      run: npm run cypress:run
```

### Quality Gates

The following quality gates will be established:

1. **Code Coverage**: Minimum 70% coverage for core components
2. **Test Pass Rate**: All tests must pass
3. **Performance Thresholds**: Key operations must meet performance benchmarks
4. **TypeScript Compilation**: No type errors
5. **Linting**: No linting errors

## Implementation Timeline

The testing implementation will be phased over 8 weeks:

### Week 1-2: Initial Setup
- Set up testing framework and libraries
- Add initial unit tests for Redux slices
- Implement basic component tests

### Week 3-4: Core Component Testing
- Add tests for visualization components
- Implement mock service worker for API testing
- Create test data fixtures

### Week 5-6: Integration Testing
- Implement integration tests for key workflows
- Add performance benchmark tests
- Set up visual regression testing

### Week 7-8: E2E and CI/CD
- Implement end-to-end tests for critical paths
- Set up CI/CD integration
- Establish quality gates and metrics

## Conclusion

This testing plan provides a comprehensive approach to ensuring the quality, stability, and performance of the GEOS-Chem AWS Cloud Runner visualization components. By implementing tests at multiple levels of the testing pyramid, we can catch issues early and maintain a high level of confidence in the application's functionality.

The focus on automated testing integrated with CI/CD will ensure that code quality remains high throughout the development lifecycle, while performance testing will help identify optimization opportunities for working with large scientific datasets.