import apiService from './apiService';

/**
 * Interface for simulation cost estimation request
 */
export interface CostEstimationRequest {
  simulationType: 'GC_CLASSIC' | 'GCHP';
  processorType: 'graviton3' | 'graviton4' | 'intel' | 'amd';
  instanceSize: 'small' | 'medium' | 'large' | 'xlarge';
  memory: 'standard' | 'high';
  resolution: string; // For GC_Classic: '4x5', '2x2.5', '0.5x0.625', '0.25x0.3125'
  cubedsphereRes?: string; // For GCHP: 'C24', 'C48', 'C90', 'C180', 'C360'
  chemistryOption: 'fullchem' | 'aerosol' | 'CH4' | 'CO2' | 'transport';
  simulationDays: number;
  spinupDays: number;
  outputFrequency: 'hourly' | '3-hourly' | 'daily' | 'monthly';
  useSpot: boolean;
  nodes?: number; // For GCHP
}

/**
 * Interface for simulation cost estimation response
 */
export interface CostEstimationResponse {
  estimatedCost: number;
  estimatedRuntime: number; // in hours
  computeCost: number;
  storageCost: number;
  throughputDaysPerDay: number;
  storageGB: number;
  recommendedInstanceType?: string;
  costSavingTips?: string[];
  benchmarkReference?: {
    benchmarkId: string;
    actualRuntime: number;
    actualCost: number;
    processorType: string;
    instanceType: string;
  };
}

/**
 * Interface for performance metrics and comparisons
 */
export interface PerformanceComparison {
  processorType: string;
  instanceType: string;
  throughputDaysPerDay: number;
  costPerSimDay: number;
  relativePerformance: number; // normalized to baseline
  relativeCost: number; // normalized to baseline
  pricePerformanceRatio: number; // lower is better
  isRecommended: boolean;
}

/**
 * Service for interacting with benchmark and cost estimation APIs
 */
class BenchmarkService {
  /**
   * Get cost estimation for a simulation configuration
   * @param params - The simulation configuration parameters
   * @returns Cost estimation data
   */
  async getEstimatedCost(params: CostEstimationRequest): Promise<CostEstimationResponse> {
    try {
      return await apiService.post<CostEstimationResponse>('/benchmarks/estimate-cost', params);
    } catch (error) {
      console.error('Error getting cost estimation:', error);
      throw error;
    }
  }

  /**
   * Get performance comparison across different processor types and instance sizes
   * @param params - The simulation configuration parameters
   * @returns Array of performance comparison data
   */
  async getPerformanceComparison(params: CostEstimationRequest): Promise<PerformanceComparison[]> {
    try {
      return await apiService.post<PerformanceComparison[]>('/benchmarks/compare', params);
    } catch (error) {
      console.error('Error getting performance comparison:', error);
      throw error;
    }
  }

  /**
   * Get the most cost-effective instance type for a given simulation
   * @param params - The simulation configuration parameters
   * @returns The recommended instance configuration
   */
  async getRecommendedInstance(params: CostEstimationRequest): Promise<PerformanceComparison> {
    try {
      return await apiService.post<PerformanceComparison>('/benchmarks/recommend', params);
    } catch (error) {
      console.error('Error getting instance recommendation:', error);
      throw error;
    }
  }

  /**
   * Get benchmark results for a specific configuration
   * @param benchmarkId - Optional specific benchmark ID
   * @param params - Filter parameters matching the benchmark configuration
   * @returns Detailed benchmark results
   */
  async getBenchmarkResults(
    benchmarkId?: string, 
    params?: Partial<CostEstimationRequest>
  ): Promise<any> {
    try {
      const path = benchmarkId 
        ? `/benchmarks/results/${benchmarkId}`
        : '/benchmarks/results';
        
      return await apiService.get(path, params);
    } catch (error) {
      console.error('Error getting benchmark results:', error);
      throw error;
    }
  }
}

export default new BenchmarkService();