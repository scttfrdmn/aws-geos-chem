/**
 * Lambda function for recommending the optimal instance type for GEOS-Chem simulations
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Configuration
const BENCHMARKS_TABLE = process.env.BENCHMARKS_TABLE || 'geos-chem-benchmarks';

/**
 * Handler function for instance recommendation requests
 */
exports.handler = async (event) => {
  try {
    console.log('Received instance recommendation request:', JSON.stringify(event));
    
    // Parse request body
    const requestBody = JSON.parse(event.body);
    
    // Get the recommended instance
    const recommendation = await getRecommendedInstance(requestBody);
    
    // Return the recommendation
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // For CORS support
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(recommendation)
    };
  } catch (error) {
    console.error('Error processing instance recommendation request:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // For CORS support
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ 
        error: 'Failed to recommend instance',
        message: error.message
      })
    };
  }
};

/**
 * Get the recommended instance type for a given simulation configuration
 * @param {Object} request - The instance recommendation request
 * @returns {Object} - Recommended instance configuration
 */
async function getRecommendedInstance(request) {
  // Query parameters to find benchmarks for the same simulation configuration
  const params = {
    TableName: BENCHMARKS_TABLE,
    IndexName: 'SimulationTypeIndex',
    KeyConditionExpression: 'simulation_type = :simType',
    ExpressionAttributeValues: {
      ':simType': request.chemistryOption || 'fullchem'
    }
  };
  
  // Add resolution filter based on simulation type
  if (request.simulationType === 'GC_CLASSIC') {
    params.FilterExpression = 'resolution = :res';
    params.ExpressionAttributeValues[':res'] = request.resolution || '4x5';
  } else if (request.simulationType === 'GCHP') {
    params.FilterExpression = 'resolution = :res';
    params.ExpressionAttributeValues[':res'] = request.cubedsphereRes || 'C90';
  }
  
  try {
    // Query benchmark table
    const result = await dynamoDB.query(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      // If no benchmarks found, use default recommendations
      return getDefaultRecommendation(request);
    }
    
    // Calculate price-performance ratio for each benchmark
    const benchmarksWithRatio = result.Items.map(benchmark => {
      const pricePerformanceRatio = benchmark.cost_per_sim_day / benchmark.throughput_days_per_day;
      return { ...benchmark, pricePerformanceRatio };
    });
    
    // Sort by price-performance ratio (best first)
    benchmarksWithRatio.sort((a, b) => a.pricePerformanceRatio - b.pricePerformanceRatio);
    
    // Get the best benchmark
    const bestBenchmark = benchmarksWithRatio[0];
    
    // Format the response
    return {
      processorType: bestBenchmark.processor_type,
      instanceType: bestBenchmark.instance_type,
      throughputDaysPerDay: bestBenchmark.throughput_days_per_day,
      costPerSimDay: bestBenchmark.cost_per_sim_day,
      relativePerformance: 1.0, // This is the reference benchmark
      relativeCost: 1.0, // This is the reference benchmark
      pricePerformanceRatio: bestBenchmark.pricePerformanceRatio,
      isRecommended: true,
      estimatedRuntime: calculateEstimatedRuntime(request, bestBenchmark),
      estimatedCost: calculateEstimatedCost(request, bestBenchmark),
      recommendationReason: generateRecommendationReason(bestBenchmark)
    };
  } catch (error) {
    console.error('Error getting instance recommendation:', error);
    return getDefaultRecommendation(request);
  }
}

/**
 * Calculate the estimated runtime for a simulation
 * @param {Object} request - The instance recommendation request
 * @param {Object} benchmark - The benchmark data
 * @returns {number} - Estimated runtime in hours
 */
function calculateEstimatedRuntime(request, benchmark) {
  const totalSimDays = request.simulationDays + (request.spinupDays || 0);
  const throughputDaysPerDay = benchmark.throughput_days_per_day;
  const wallClockDays = totalSimDays / throughputDaysPerDay;
  return wallClockDays * 24; // Convert to hours
}

/**
 * Calculate the estimated cost for a simulation
 * @param {Object} request - The instance recommendation request
 * @param {Object} benchmark - The benchmark data
 * @returns {number} - Estimated cost in dollars
 */
function calculateEstimatedCost(request, benchmark) {
  const totalSimDays = request.simulationDays + (request.spinupDays || 0);
  const costPerSimDay = benchmark.cost_per_sim_day;
  
  // Apply spot discount if requested
  const spotDiscount = request.useSpot ? 0.3 : 1.0; // 70% discount for spot
  
  // Calculate compute cost
  const computeCost = costPerSimDay * totalSimDays * spotDiscount;
  
  // Calculate storage cost (simplified estimation)
  const storageGB = calculateStorageSize(request);
  const storageCost = storageGB * 0.023 * 3; // $0.023 per GB-month for 3 months
  
  return computeCost + storageCost;
}

/**
 * Calculate storage size for a simulation
 * @param {Object} request - The instance recommendation request
 * @returns {number} - Estimated storage size in GB
 */
function calculateStorageSize(request) {
  // Base size by simulation type
  const baseSizeGB = request.simulationType === 'GC_CLASSIC' ? 10 : 20;
  
  // Resolution factor
  let resolutionFactor = 1.0;
  if (request.simulationType === 'GC_CLASSIC') {
    if (request.resolution === '4x5') {
      resolutionFactor = 1.0;
    } else if (request.resolution === '2x2.5') {
      resolutionFactor = 2.0;
    } else if (request.resolution === '0.5x0.625') {
      resolutionFactor = 8.0;
    } else if (request.resolution === '0.25x0.3125') {
      resolutionFactor = 16.0;
    }
  } else if (request.simulationType === 'GCHP') {
    if (request.cubedsphereRes === 'C24') {
      resolutionFactor = 1.0;
    } else if (request.cubedsphereRes === 'C48') {
      resolutionFactor = 4.0;
    } else if (request.cubedsphereRes === 'C90') {
      resolutionFactor = 12.0;
    } else if (request.cubedsphereRes === 'C180') {
      resolutionFactor = 36.0;
    } else if (request.cubedsphereRes === 'C360') {
      resolutionFactor = 96.0;
    }
  }
  
  // Output frequency factor
  let frequencyFactor = 1.0;
  if (request.outputFrequency === 'hourly') {
    frequencyFactor = 24.0;
  } else if (request.outputFrequency === '3-hourly') {
    frequencyFactor = 8.0;
  } else if (request.outputFrequency === 'daily') {
    frequencyFactor = 1.0;
  } else if (request.outputFrequency === 'monthly') {
    frequencyFactor = 0.033;
  }
  
  // Calculate storage size
  return baseSizeGB * resolutionFactor * frequencyFactor * (request.simulationDays / 30);
}

/**
 * Generate a reason for the recommendation
 * @param {Object} benchmark - The recommended benchmark
 * @returns {string} - Recommendation reason
 */
function generateRecommendationReason(benchmark) {
  const processorType = benchmark.processor_type.toLowerCase();
  const instanceType = benchmark.instance_type;
  
  // Generate reason based on processor type
  if (processorType.includes('graviton')) {
    return `${benchmark.processor_type} (${instanceType}) offers the best price-performance ratio for this configuration, with ${benchmark.throughput_days_per_day.toFixed(1)} simulation days per wall-clock day at $${benchmark.cost_per_sim_day.toFixed(2)} per simulation day.`;
  } else if (processorType.includes('intel')) {
    return `Intel ${instanceType} provides reliable performance with ${benchmark.throughput_days_per_day.toFixed(1)} simulation days per wall-clock day at $${benchmark.cost_per_sim_day.toFixed(2)} per simulation day.`;
  } else if (processorType.includes('amd')) {
    return `AMD ${instanceType} offers good value with ${benchmark.throughput_days_per_day.toFixed(1)} simulation days per wall-clock day at $${benchmark.cost_per_sim_day.toFixed(2)} per simulation day.`;
  } else {
    return `This instance type provides ${benchmark.throughput_days_per_day.toFixed(1)} simulation days per wall-clock day at $${benchmark.cost_per_sim_day.toFixed(2)} per simulation day, offering the best value based on our benchmarks.`;
  }
}

/**
 * Get default recommendation when no benchmark data is available
 * @param {Object} request - The instance recommendation request
 * @returns {Object} - Default recommendation
 */
function getDefaultRecommendation(request) {
  // Default recommendation based on simulation type and resolution
  let recommendation = {
    processorType: 'Graviton3',
    instanceType: 'c7g.8xlarge',
    isRecommended: true
  };
  
  if (request.simulationType === 'GC_CLASSIC') {
    if (request.resolution === '4x5') {
      recommendation = {
        processorType: 'Graviton3',
        instanceType: 'c7g.4xlarge',
        throughputDaysPerDay: 24.0,
        costPerSimDay: 1.36,
        relativePerformance: 1.0,
        relativeCost: 1.0,
        pricePerformanceRatio: 0.057,
        isRecommended: true,
        recommendationReason: 'Graviton3 offers excellent price-performance for standard resolution GEOS-Chem simulations.'
      };
    } else if (request.resolution === '2x2.5') {
      recommendation = {
        processorType: 'Graviton3',
        instanceType: 'c7g.8xlarge',
        throughputDaysPerDay: 16.0,
        costPerSimDay: 2.04,
        relativePerformance: 1.0,
        relativeCost: 1.0,
        pricePerformanceRatio: 0.128,
        isRecommended: true,
        recommendationReason: 'Graviton3 c7g.8xlarge provides a good balance of performance and cost for 2x2.5 resolution.'
      };
    } else if (request.resolution === '0.5x0.625') {
      recommendation = {
        processorType: 'Graviton3',
        instanceType: 'c7g.16xlarge',
        throughputDaysPerDay: 9.6,
        costPerSimDay: 6.8,
        relativePerformance: 1.0,
        relativeCost: 1.0,
        pricePerformanceRatio: 0.708,
        isRecommended: true,
        recommendationReason: 'For nested domains, Graviton3 c7g.16xlarge provides the necessary memory and compute resources.'
      };
    }
  } else if (request.simulationType === 'GCHP') {
    if (request.cubedsphereRes === 'C24' || request.cubedsphereRes === 'C48') {
      recommendation = {
        processorType: 'Graviton3E',
        instanceType: 'hpc7g.4xlarge',
        throughputDaysPerDay: 8.0,
        costPerSimDay: 5.1,
        relativePerformance: 1.0,
        relativeCost: 1.0,
        pricePerformanceRatio: 0.638,
        isRecommended: true,
        recommendationReason: 'For GCHP with C48 resolution, Graviton3E with EFA networking is recommended for optimal MPI performance.'
      };
    } else if (request.cubedsphereRes === 'C90') {
      recommendation = {
        processorType: 'Graviton3E',
        instanceType: 'hpc7g.8xlarge',
        throughputDaysPerDay: 4.8,
        costPerSimDay: 8.5,
        relativePerformance: 1.0,
        relativeCost: 1.0,
        pricePerformanceRatio: 1.77,
        isRecommended: true,
        recommendationReason: 'For C90 resolution, Graviton3E hpc7g.8xlarge provides the necessary performance for GCHP simulations.'
      };
    } else if (request.cubedsphereRes === 'C180' || request.cubedsphereRes === 'C360') {
      recommendation = {
        processorType: 'Graviton3E',
        instanceType: 'hpc7g.16xlarge',
        throughputDaysPerDay: 2.4,
        costPerSimDay: 17.0,
        relativePerformance: 1.0,
        relativeCost: 1.0,
        pricePerformanceRatio: 7.08,
        isRecommended: true,
        recommendationReason: 'For high resolution GCHP, Graviton3E hpc7g.16xlarge with multiple nodes is required for acceptable performance.'
      };
    }
  }
  
  // Calculate estimated runtime and cost
  const totalSimDays = request.simulationDays + (request.spinupDays || 0);
  const wallClockDays = totalSimDays / recommendation.throughputDaysPerDay;
  const wallClockHours = wallClockDays * 24;
  
  const spotDiscount = request.useSpot ? 0.3 : 1.0;
  const computeCost = recommendation.costPerSimDay * totalSimDays * spotDiscount;
  const storageGB = calculateStorageSize(request);
  const storageCost = storageGB * 0.023 * 3;
  
  // Add calculated fields
  recommendation.estimatedRuntime = wallClockHours;
  recommendation.estimatedCost = computeCost + storageCost;
  
  return recommendation;
}