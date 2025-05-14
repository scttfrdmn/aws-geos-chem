// src/components/results/__tests__/TimeSeriesComparison.test.tsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import TimeSeriesComparison from '../TimeSeriesComparison';
import { mockSimulations, mockTimeSeriesData } from '../../../__mocks__/mockData';

// Create redux store mock
const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('TimeSeriesComparison Component', () => {
  let store: any;
  
  beforeEach(() => {
    // Initialize mock store with test state
    store = mockStore({
      simulations: {
        simulations: mockSimulations,
        loading: false,
        error: null
      },
      results: {
        files: [],
        visualizations: [],
        selectedFile: null,
        netcdfMetadata: {},
        selectedVariables: [],
        loading: false,
        error: null,
        generatingVisualization: false
      }
    });
    
    // Mock dispatch to track actions
    store.dispatch = jest.fn(store.dispatch);
  });
  
  it('renders without crashing', () => {
    render(
      <Provider store={store}>
        <TimeSeriesComparison initialSimulationIds={['sim-1', 'sim-2']} />
      </Provider>
    );
    
    expect(screen.getByText(/select simulations to compare/i)).toBeInTheDocument();
  });
  
  it('dispatches fetchSimulations on mount', () => {
    render(
      <Provider store={store}>
        <TimeSeriesComparison initialSimulationIds={['sim-1', 'sim-2']} />
      </Provider>
    );
    
    expect(store.dispatch).toHaveBeenCalledWith(expect.any(Function));
  });
  
  it('shows initial simulations as selected', () => {
    render(
      <Provider store={store}>
        <TimeSeriesComparison initialSimulationIds={['sim-1', 'sim-2']} />
      </Provider>
    );
    
    // The simulations tab should be active by default
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    
    // The Selected Simulations section should show after simulations load
    waitFor(() => {
      expect(screen.getByText(/selected simulations/i)).toBeInTheDocument();
    });
  });
  
  it('allows variable selection when data is available', async () => {
    // Update store to include available variables
    store = mockStore({
      simulations: {
        simulations: mockSimulations,
        loading: false,
        error: null
      },
      results: {
        files: [],
        visualizations: [],
        selectedFile: null,
        netcdfMetadata: {},
        selectedVariables: [],
        loading: false,
        error: null,
        generatingVisualization: false
      }
    });
    
    render(
      <Provider store={store}>
        <TimeSeriesComparison initialSimulationIds={['sim-1', 'sim-2']} />
      </Provider>
    );
    
    // Wait for the component to update with mock data
    await waitFor(() => {
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
    
    // Mock setting available variables
    await waitFor(() => {
      // Find the "Variable to Compare" label
      expect(screen.queryByText(/variable to compare/i)).toBeInTheDocument();
    });
  });
  
  it('renders time series chart when data is available', async () => {
    // Update store with mock time series data
    const timeSeriesState = {
      simulations: {
        simulations: mockSimulations,
        loading: false,
        error: null
      },
      results: {
        files: [],
        visualizations: [],
        selectedFile: null,
        netcdfMetadata: {},
        selectedVariables: ['SpeciesConc_O3'],
        timeSeriesData: mockTimeSeriesData['SpeciesConc_O3'],
        loading: false,
        error: null,
        generatingVisualization: false
      }
    };
    
    store = mockStore(timeSeriesState);
    
    render(
      <Provider store={store}>
        <TimeSeriesComparison 
          initialSimulationIds={['sim-1', 'sim-2']} 
        />
      </Provider>
    );
    
    // Select a variable
    const variableSelect = await screen.findByLabelText(/variable to compare/i);
    fireEvent.change(variableSelect, { target: { value: 'SpeciesConc_O3' } });
    
    // Switch to Time Series tab
    const timeSeriesTab = await screen.findByRole('tab', { name: /time series/i });
    fireEvent.click(timeSeriesTab);
    
    // The visualization should show up eventually
    await waitFor(() => {
      expect(screen.queryByText(/select simulations and a variable to compare/i)).not.toBeInTheDocument();
    });
  });
  
  it('shows normalize and difference toggles on time series tab', async () => {
    // Update store with mock time series data
    const timeSeriesState = {
      simulations: {
        simulations: mockSimulations,
        loading: false,
        error: null
      },
      results: {
        files: [],
        visualizations: [],
        selectedFile: null,
        netcdfMetadata: {},
        selectedVariables: ['SpeciesConc_O3'],
        timeSeriesData: mockTimeSeriesData['SpeciesConc_O3'],
        loading: false,
        error: null,
        generatingVisualization: false
      }
    };
    
    store = mockStore(timeSeriesState);
    
    render(
      <Provider store={store}>
        <TimeSeriesComparison 
          initialSimulationIds={['sim-1', 'sim-2']} 
        />
      </Provider>
    );
    
    // Switch to Time Series tab
    const timeSeriesTab = await screen.findByRole('tab', { name: /time series/i });
    fireEvent.click(timeSeriesTab);
    
    // Check for normalize toggle
    await waitFor(() => {
      expect(screen.queryByLabelText(/normalize/i)).toBeInTheDocument();
    });
    
    // Check for difference toggle
    await waitFor(() => {
      expect(screen.queryByLabelText(/show difference/i)).toBeInTheDocument();
    });
  });
  
  it('allows export to CSV', async () => {
    // Mock URL.createObjectURL and document.createElement
    const mockCreateObjectURL = jest.fn();
    URL.createObjectURL = mockCreateObjectURL;
    
    const mockLinkElement = {
      href: '',
      setAttribute: jest.fn(),
      click: jest.fn()
    };
    document.createElement = jest.fn().mockImplementation((tag) => {
      if (tag === 'a') {
        return mockLinkElement;
      }
      return document.createElement(tag);
    });
    document.body.appendChild = jest.fn();
    document.body.removeChild = jest.fn();
    
    // Update store with mock time series data
    const timeSeriesState = {
      simulations: {
        simulations: mockSimulations,
        loading: false,
        error: null
      },
      results: {
        files: [],
        visualizations: [],
        selectedFile: null,
        netcdfMetadata: {},
        selectedVariables: ['SpeciesConc_O3'],
        timeSeriesData: mockTimeSeriesData['SpeciesConc_O3'],
        loading: false,
        error: null,
        generatingVisualization: false
      }
    };
    
    store = mockStore(timeSeriesState);
    
    render(
      <Provider store={store}>
        <TimeSeriesComparison 
          initialSimulationIds={['sim-1', 'sim-2']} 
        />
      </Provider>
    );
    
    // Switch to Time Series tab
    const timeSeriesTab = await screen.findByRole('tab', { name: /time series/i });
    fireEvent.click(timeSeriesTab);
    
    // Find and click export button
    const exportButton = await screen.findByRole('button', { name: /export to csv/i });
    fireEvent.click(exportButton);
    
    // Check if link was created and clicked
    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLinkElement.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('_comparison.csv'));
      expect(mockLinkElement.click).toHaveBeenCalled();
    });
  });
});