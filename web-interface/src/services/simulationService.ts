import { API, Storage } from 'aws-amplify';
import { SimulationResults, Simulation } from '../types/simulation';

// API endpoints
const API_NAME = 'GeosChemAPI';
const SIMULATIONS_PATH = '/simulations';
const RESULTS_PATH = '/results';

/**
 * Fetch a list of all simulations
 */
export const getSimulations = async (): Promise<Simulation[]> => {
  try {
    return await API.get(API_NAME, SIMULATIONS_PATH, {});
  } catch (error) {
    console.error('Error fetching simulations:', error);
    throw error;
  }
};

/**
 * Fetch a single simulation by ID
 */
export const getSimulation = async (id: string): Promise<Simulation> => {
  try {
    return await API.get(API_NAME, `${SIMULATIONS_PATH}/${id}`, {});
  } catch (error) {
    console.error(`Error fetching simulation ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new simulation
 */
export const createSimulation = async (simulation: Omit<Simulation, 'id'>): Promise<Simulation> => {
  try {
    return await API.post(API_NAME, SIMULATIONS_PATH, {
      body: simulation
    });
  } catch (error) {
    console.error('Error creating simulation:', error);
    throw error;
  }
};

/**
 * Update an existing simulation
 */
export const updateSimulation = async (simulation: Simulation): Promise<Simulation> => {
  try {
    return await API.put(API_NAME, `${SIMULATIONS_PATH}/${simulation.id}`, {
      body: simulation
    });
  } catch (error) {
    console.error(`Error updating simulation ${simulation.id}:`, error);
    throw error;
  }
};

/**
 * Delete a simulation
 */
export const deleteSimulation = async (id: string): Promise<void> => {
  try {
    await API.del(API_NAME, `${SIMULATIONS_PATH}/${id}`, {});
  } catch (error) {
    console.error(`Error deleting simulation ${id}:`, error);
    throw error;
  }
};

/**
 * Start a simulation
 */
export const startSimulation = async (id: string): Promise<void> => {
  try {
    await API.post(API_NAME, `${SIMULATIONS_PATH}/${id}/start`, {});
  } catch (error) {
    console.error(`Error starting simulation ${id}:`, error);
    throw error;
  }
};

/**
 * Stop a simulation
 */
export const stopSimulation = async (id: string): Promise<void> => {
  try {
    await API.post(API_NAME, `${SIMULATIONS_PATH}/${id}/stop`, {});
  } catch (error) {
    console.error(`Error stopping simulation ${id}:`, error);
    throw error;
  }
};

/**
 * Fetch the status of a simulation
 */
export const getSimulationStatus = async (id: string): Promise<any> => {
  try {
    return await API.get(API_NAME, `${SIMULATIONS_PATH}/${id}/status`, {});
  } catch (error) {
    console.error(`Error fetching status for simulation ${id}:`, error);
    throw error;
  }
};

/**
 * Fetch the logs of a simulation
 */
export const getSimulationLogs = async (id: string, startTime?: string, endTime?: string, logLevel?: string): Promise<any> => {
  try {
    const queryParams: Record<string, string> = {};
    if (startTime) queryParams.startTime = startTime;
    if (endTime) queryParams.endTime = endTime;
    if (logLevel) queryParams.logLevel = logLevel;
    
    return await API.get(API_NAME, `${SIMULATIONS_PATH}/${id}/logs`, {
      queryStringParameters: queryParams
    });
  } catch (error) {
    console.error(`Error fetching logs for simulation ${id}:`, error);
    throw error;
  }
};

/**
 * Fetch the resource metrics of a simulation
 */
export const getSimulationMetrics = async (id: string, metric: string, period?: number, startTime?: string, endTime?: string): Promise<any> => {
  try {
    const queryParams: Record<string, string | number> = { metric };
    if (period) queryParams.period = period;
    if (startTime) queryParams.startTime = startTime;
    if (endTime) queryParams.endTime = endTime;
    
    return await API.get(API_NAME, `${SIMULATIONS_PATH}/${id}/metrics`, {
      queryStringParameters: queryParams
    });
  } catch (error) {
    console.error(`Error fetching metrics for simulation ${id}:`, error);
    throw error;
  }
};

/**
 * Fetch the results of a simulation
 */
export const fetchSimulationResults = async (id: string): Promise<SimulationResults> => {
  try {
    const response = await API.get(API_NAME, `${RESULTS_PATH}/${id}`, {});
    return {
      simulationId: id,
      ...response
    };
  } catch (error) {
    console.error(`Error fetching results for simulation ${id}:`, error);
    throw error;
  }
};

/**
 * Get the content of a file from a simulation's results
 */
export const getFileContent = async (simulationId: string, filePath: string): Promise<string> => {
  try {
    const key = `results/${simulationId}/${filePath}`;
    const fileData = await Storage.get(key, { download: true });
    
    // Handle the downloaded file
    if (fileData.Body) {
      // For text files
      if (isTextFile(filePath)) {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(fileData.Body as Blob);
        });
      } 
      // For binary files (like images), return as base64
      else {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(fileData.Body as Blob);
        });
      }
    }
    throw new Error('No file content received');
  } catch (error) {
    console.error(`Error fetching file content for ${filePath}:`, error);
    throw error;
  }
};

/**
 * Download a file from a simulation's results
 */
export const downloadFile = async (simulationId: string, filePath: string): Promise<void> => {
  try {
    const key = `results/${simulationId}/${filePath}`;
    const fileData = await Storage.get(key, { download: true });
    
    if (fileData.Body) {
      // Create a URL for the file and trigger download
      const url = URL.createObjectURL(fileData.Body as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    } else {
      throw new Error('No file content received');
    }
  } catch (error) {
    console.error(`Error downloading file ${filePath}:`, error);
    throw error;
  }
};

/**
 * Get visualization data for a simulation's results
 */
export const getVisualizationData = async (simulationId: string, datasetPath: string, variables: string[]): Promise<any> => {
  try {
    return await API.get(API_NAME, `${RESULTS_PATH}/${simulationId}/visualize`, {
      queryStringParameters: {
        dataset: datasetPath,
        variables: variables.join(',')
      }
    });
  } catch (error) {
    console.error(`Error fetching visualization data for ${datasetPath}:`, error);
    throw error;
  }
};

/**
 * Helper function to determine if a file is a text file based on extension
 */
const isTextFile = (filePath: string): boolean => {
  const textExtensions = [
    'txt', 'log', 'json', 'xml', 'csv', 'tsv', 'md', 
    'py', 'sh', 'js', 'ts', 'jsx', 'tsx', 'css', 'html',
    'f90', 'f', 'c', 'h', 'cpp', 'hpp', 'yaml', 'yml'
  ];
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  return textExtensions.includes(extension);
};