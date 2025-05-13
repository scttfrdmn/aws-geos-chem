/**
 * cost-estimation.js
 * Lambda function to estimate the cost of GEOS-Chem simulations
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

// Hourly pricing for different instance types (simplified)
const HOURLY_RATES = {
  // Graviton Instances
  'c7g.8xlarge': 1.2240,
  'c7g.16xlarge': 2.4480,
  'r7g.8xlarge': 1.5360,
  'r7g.16xlarge': 3.0720,
  'hpc7g.16xlarge': 3.2640,
  
  // Intel Instances
  'c6i.8xlarge': 1.3600,
  'c6i.16xlarge': 2.7200,
  
  // AMD Instances
  'c6a.8xlarge': 1.2240,
  'c6a.16xlarge': 2.4480
};

// Spot discount rate (approximate)
const SPOT_DISCOUNT = 0.7; // 70% discount

// Storage cost per GB per month
const STORAGE_COST_PER_GB = 0.023;

// Data transfer cost per GB (simplified)
const DATA_TRANSFER_COST_PER_GB = 0.09;

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Cost Estimation - Event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse request body
    let requestBody;
    if (event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (e) {
        return formatResponse(400, { message: 'Invalid request body' });
      }
    } else if (event.requestBody) {
      requestBody = event.requestBody;
    } else {
      return formatResponse(400, { message: 'Missing request body' });
    }
    
    // Extract simulation configuration
    const config = requestBody.simulationConfig;
    if (!config) {
      return formatResponse(400, { message: 'Missing simulation configuration' });
    }
    
    // Calculate cost estimate
    const estimate = calculateCostEstimate(config);
    
    // Return the estimate
    return formatResponse(200, {
      message: 'Cost estimation completed successfully',
      estimate
    });
  } catch (error) {
    console.error('Error in cost estimation:', error);
    return formatResponse(500, {
      message: 'Error calculating cost estimate',
      error: error.message
    });
  }
};

/**
 * Calculate cost estimate for a simulation
 */
function calculateCostEstimate(config) {
  // Extract relevant configuration
  const instanceType = config.instanceType || 'c7g.8xlarge';
  const useSpot = config.useSpot !== false; // Default to true
  const simulationType = config.simulationType || 'fullchem';
  const resolution = config.resolution || '4x5';
  const durationDays = parseInt(config.durationDays || 7);
  const domainType = config.domainType || 'global';
  const isGCHP = config.application === 'gchp';
  const nodes = parseInt(config.nodes || 1);
  
  // Base runtime factors for different simulation types
  const simulationTypeFactors = {
    'fullchem': 1.0,
    'tropchem': 0.8,
    'aerosol': 0.7,
    'transport': 0.5,
    'ch4': 0.6,
    'co2': 0.6
  };
  
  // Resolution factors
  const resolutionFactors = {
    // GC Classic resolutions
    '4x5': 1.0,
    '2x2.5': 2.5,
    '0.5x0.625': 5.0,
    // GCHP resolutions
    'c24': 0.8,
    'c48': 1.5,
    'c90': 3.0,
    'c180': 6.0,
    'c360': 12.0
  };
  
  // Get base hourly rate for the instance type
  let hourlyRate = HOURLY_RATES[instanceType] || 1.5; // Default if not found
  
  // Apply spot discount if using spot instances
  if (useSpot) {
    hourlyRate *= (1 - SPOT_DISCOUNT);
  }
  
  // Calculate total instance hours
  let instanceHours;
  
  if (isGCHP) {
    // For GCHP, account for multiple nodes
    const typeFactor = simulationTypeFactors[simulationType] || 1.0;
    const resFactor = resolutionFactors[resolution] || 1.0;
    
    // Calculate hours per simulation day based on factors
    const hoursPerSimDay = 0.5 * typeFactor * resFactor;
    
    // Total hours considering all nodes
    instanceHours = hoursPerSimDay * durationDays * nodes;
  } else {
    // For GC Classic
    const typeFactor = simulationTypeFactors[simulationType] || 1.0;
    const resFactor = resolutionFactors[resolution] || 1.0;
    
    // Additional factor for nested domains
    const domainFactor = domainType === 'nested' ? 1.5 : 1.0;
    
    // Calculate hours per simulation day based on factors
    const hoursPerSimDay = 0.5 * typeFactor * resFactor * domainFactor;
    
    // Total hours for a single instance
    instanceHours = hoursPerSimDay * durationDays;
  }
  
  // Calculate compute cost
  const computeCost = hourlyRate * instanceHours;
  
  // Estimate storage size and cost
  let storageSizeGB;
  
  if (isGCHP) {
    // GCHP generates more output data
    storageSizeGB = 2.0 * durationDays * (resolutionFactors[resolution] || 1.0);
  } else {
    storageSizeGB = 1.0 * durationDays * (resolutionFactors[resolution] || 1.0);
  }
  
  // For full chemistry, outputs are larger
  if (simulationType === 'fullchem') {
    storageSizeGB *= 1.5;
  }
  
  // Storage cost (for one month)
  const storageCost = storageSizeGB * STORAGE_COST_PER_GB;
  
  // Data transfer cost (assuming all data is downloaded once)
  const dataTransferCost = storageSizeGB * DATA_TRANSFER_COST_PER_GB;
  
  // Calculate total cost
  const totalCost = computeCost + storageCost + dataTransferCost;
  
  // Calculate cost per simulation day
  const costPerDay = totalCost / durationDays;
  
  // Create detailed estimate
  return {
    totalCost: roundToTwoDecimals(totalCost),
    costBreakdown: {
      computeCost: roundToTwoDecimals(computeCost),
      storageCost: roundToTwoDecimals(storageCost),
      dataTransferCost: roundToTwoDecimals(dataTransferCost)
    },
    costPerDay: roundToTwoDecimals(costPerDay),
    estimatedRuntime: {
      instanceHours: roundToTwoDecimals(instanceHours),
      wallClockHours: roundToTwoDecimals(instanceHours / nodes)
    },
    storage: {
      estimatedSizeGB: roundToTwoDecimals(storageSizeGB)
    },
    instanceDetails: {
      type: instanceType,
      hourlyRate: roundToTwoDecimals(hourlyRate),
      useSpot,
      nodes: isGCHP ? nodes : 1
    },
    simulationDetails: {
      type: simulationType,
      resolution,
      durationDays,
      application: isGCHP ? 'gchp' : 'gc-classic'
    }
  };
}

/**
 * Round a number to two decimal places
 */
function roundToTwoDecimals(num) {
  return Math.round(num * 100) / 100;
}

/**
 * Format API Gateway response
 */
function formatResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(body)
  };
}