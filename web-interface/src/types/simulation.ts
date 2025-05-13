// Simulation status enum
export enum SimulationStatus {
  PENDING = 'PENDING',
  CONFIGURING = 'CONFIGURING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  STOPPING = 'STOPPING'
}

// Domain resolution types
export type Resolution = '4x5' | '2x2.5' | '0.5x0.625' | '0.25x0.3125' | 'Custom';

// Region types
export type Region = 'Global' | 'North America' | 'Europe' | 'Asia' | 'Custom';

// Resource types
export type InstanceType = 
  't3.medium' | 't3.large' | 't3.xlarge' | 't3.2xlarge' |
  'c5.large' | 'c5.xlarge' | 'c5.2xlarge' | 'c5.4xlarge' | 'c5.9xlarge' |
  'c5n.large' | 'c5n.xlarge' | 'c5n.2xlarge' | 'c5n.4xlarge' | 'c5n.9xlarge' |
  'r5.large' | 'r5.xlarge' | 'r5.2xlarge' | 'r5.4xlarge';

// Log level enum
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR'
}

// Simulation configuration interface
export interface SimulationConfig {
  simulationType: 'fullchem' | 'transport' | 'aerosol' | 'custom';
  scientificOptions: {
    chemistry: boolean;
    aerosols: boolean;
    transport: boolean;
    deposition: boolean;
    cloudProcesses: boolean;
    carbonCycle: boolean;
    customMechanisms?: string[];
  };
  domain: {
    region: Region;
    resolution: Resolution;
    customBounds?: {
      minLon: number;
      maxLon: number;
      minLat: number;
      maxLat: number;
    };
    customResolution?: {
      lonRes: number;
      latRes: number;
    };
    verticalLevels: number;
  };
  timeConfig: {
    startDate: string;
    endDate: string;
    timestep: number;
    outputFrequency: number;
    spinupPeriod?: number;
  };
  computeResources: {
    instanceType: InstanceType;
    nodeCount: number;
    maxWallTime: number;
    storage: number;
    priority: 'low' | 'medium' | 'high';
  };
  costEstimate?: {
    estimatedCost: number;
    estimatedRuntime: number;
  };
  additionalOptions: {
    saveCheckpoints: boolean;
    checkpointFrequency?: number;
    enableRestarts: boolean;
    saveDebugOutput: boolean;
    outputFormat: 'netcdf' | 'binary' | 'both';
    compressionLevel: number;
    customEnvironmentVariables?: Record<string, string>;
  };
}

// Simulation interface
export interface Simulation {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  username: string;
  status: SimulationStatus;
  config: SimulationConfig;
  costToDate?: number;
  estimatedTimeRemaining?: number;
  progress?: number;
  lastStatusChange?: string;
  jobId?: string;
  logGroupName?: string;
  tags?: string[];
}

// File item in results
export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  children?: FileItem[];
}

// Simulation results interface
export interface SimulationResults {
  simulationId: string;
  files: FileItem[];
  totalSize: number;
  completedAt?: string;
  outputSummary?: {
    fileCount: number;
    dataVariables?: string[];
    dataDescriptions?: Record<string, string>;
    visualizableDatasets?: string[];
  };
}

// Simulation event/timeline interface
export interface SimulationEvent {
  id: string;
  simulationId: string;
  timestamp: string;
  eventType: 'status_change' | 'error' | 'info' | 'warning' | 'checkpoint' | 'resource_change';
  message: string;
  details?: any;
}

// Simulation cost data
export interface SimulationCost {
  simulationId: string;
  totalCost: number;
  computeCost: number;
  storageCost: number;
  dataTransferCost: number;
  costByHour: Array<{
    timestamp: string;
    cost: number;
  }>;
}

// Simulation metric data point
export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

// Simulation metrics
export interface SimulationMetrics {
  simulationId: string;
  cpu: MetricDataPoint[];
  memory: MetricDataPoint[];
  disk: MetricDataPoint[];
  network: {
    in: MetricDataPoint[];
    out: MetricDataPoint[];
  };
}