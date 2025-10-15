/**
 * Lambda function for estimating the cost of GEOS-Chem simulations based on benchmark data
 */

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Configuration
const BENCHMARK_BUCKET = process.env.BENCHMARK_BUCKET || 'geos-chem-benchmark-results';
const BENCHMARKS_TABLE = process.env.BENCHMARKS_TABLE || 'geos-chem-benchmarks';

/**
 * Handler function for cost estimation requests
 */
exports.handler = async (event) => {
  try {
    console.log('Received cost estimation request:', JSON.stringify(event));
    
    // Parse request body
    const requestBody = JSON.parse(event.body);
    
    // Get benchmark data for this configuration
    const benchmarkData = await getBenchmarkData(requestBody);
    
    // Calculate cost estimate
    const costEstimate = calculateCostEstimate(requestBody, benchmarkData);
    
    // Get performance comparisons for alternative configurations
    const comparisons = await getPerformanceComparisons(requestBody, benchmarkData);
    
    // Return the cost estimate and performance comparisons
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // For CORS support
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(costEstimate)
    };
  } catch (error) {
    console.error('Error processing cost estimation request:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // For CORS support
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ 
        error: 'Failed to estimate cost',
        message: error.message
      })
    };
  }
};

/**
 * Get benchmark data that matches the request configuration
 * @param {Object} request - The cost estimation request
 * @returns {Object} - Matching benchmark data
 */
async function getBenchmarkData(request) {
  // Query parameters to find the closest matching benchmark
  const params = {
    TableName: BENCHMARKS_TABLE,
    IndexName: 'SimulationTypeIndex',
    KeyConditionExpression: 'simulation_type = :simType',
    FilterExpression: 'architecture = :arch',
    ExpressionAttributeValues: {
      ':simType': request.chemistryOption || 'fullchem',
      ':arch': request.processorType.includes('graviton') ? 'arm64' : 'x86_64'
    }
  };
  
  // Add resolution filter based on simulation type
  if (request.simulationType === 'GC_CLASSIC') {
    params.FilterExpression += ' AND resolution = :res';
    params.ExpressionAttributeValues[':res'] = request.resolution || '4x5';
  } else if (request.simulationType === 'GCHP') {
    params.FilterExpression += ' AND resolution = :res';
    params.ExpressionAttributeValues[':res'] = request.cubedsphereRes || 'C90';
  }
  
  try {
    // Query benchmark table
    const result = await dynamoDB.query(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('No matching benchmarks found, using default estimates');
      return null;
    }
    
    // Find the closest instance type match
    const matchingBenchmarks = result.Items.filter(item => {
      return item.instance_type.includes(request.instanceSize) && 
             item.processor_type.toLowerCase().includes(request.processorType.toLowerCase());
    });
    
    if (matchingBenchmarks.length === 0) {
      console.log('No exact instance type matches, using similar configuration');
      return result.Items[0]; // Return any benchmark with matching simulation type
    }
    
    return matchingBenchmarks[0];
  } catch (error) {
    console.error('Error querying benchmark data:', error);
    return null;
  }
}

/**
 * Calculate cost estimate based on request and benchmark data
 * @param {Object} request - The cost estimation request
 * @param {Object} benchmarkData - The matching benchmark data
 * @returns {Object} - Cost estimate response
 */
function calculateCostEstimate(request, benchmarkData) {
  // Instance hourly costs (simplified, would be more detailed in production)
  const instanceCosts = {
    'graviton3': {
      'small': 0.68,
      'medium': 1.36,
      'large': 2.72,
      'xlarge': 5.44
    },
    'graviton4': {
      'small': 0.76,
      'medium': 1.52,
      'large': 3.04,
      'xlarge': 6.08
    },
    'intel': {
      'small': 0.70,
      'medium': 1.40,
      'large': 2.80,
      'xlarge': 5.60
    },
    'amd': {
      'small': 0.67,
      'medium': 1.34,
      'large': 2.68,
      'xlarge': 5.36
    }
  };
  
  // Calculate storage size based on configuration
  const calculateStorageGB = () => {
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
    const simDays = request.simulationDays;
    return baseSizeGB * resolutionFactor * frequencyFactor * (simDays / 30);
  };
  
  // If we have benchmark data, use it to calculate costs
  if (benchmarkData) {
    // Get throughput from benchmark (simulation days per wall day)
    const throughputDaysPerDay = benchmarkData.throughput_days_per_day || 1.0;
    
    // Calculate wall clock hours based on throughput and simulation days
    const totalSimDays = request.simulationDays + (request.spinupDays || 0);
    const wallClockDays = totalSimDays / throughputDaysPerDay;
    const wallClockHours = wallClockDays * 24;
    
    // Calculate compute cost based on instance type and wall clock hours
    const hourlyRate = instanceCosts[request.processorType][request.instanceSize];
    const spotDiscount = request.useSpot ? 0.3 : 1.0; // 70% discount for spot
    const computeCost = hourlyRate * spotDiscount * wallClockHours;
    
    // Calculate storage cost
    const storageGB = calculateStorageGB();
    const storageCost = storageGB * 0.023 * 3; // $0.023 per GB-month for 3 months
    
    // Total cost
    const totalCost = computeCost + storageCost;
    
    // Generate cost saving tips
    const costSavingTips = generateCostSavingTips(request, totalCost, computeCost, storageCost);
    
    // Generate benchmark reference
    const benchmarkReference = {
      benchmarkId: benchmarkData.benchmark_id,
      actualRuntime: benchmarkData.wall_time_hours,
      actualCost: benchmarkData.cost_per_sim_day * totalSimDays,
      processorType: benchmarkData.processor_type,
      instanceType: benchmarkData.instance_type
    };
    
    return {
      estimatedCost: totalCost,
      estimatedRuntime: wallClockHours,
      computeCost: computeCost,
      storageCost: storageCost,
      throughputDaysPerDay: throughputDaysPerDay,
      storageGB: storageGB,
      recommendedInstanceType: determineRecommendedInstance(request),
      costSavingTips: costSavingTips,
      benchmarkReference: benchmarkReference
    };
  } else {
    // Fall back to simple estimation if no benchmark data is available
    // This matches the client-side estimation logic as a fallback
    
    // Calculate wall clock hours based on simulation configuration
    let baseHoursPerSimDay = 0.1; // 6 minutes per simulation day
    
    // Adjust for resolution/domain
    if (request.simulationType === 'GC_CLASSIC') {
      if (request.resolution === '4x5') {
        baseHoursPerSimDay = 0.1;
      } else if (request.resolution === '2x2.5') {
        baseHoursPerSimDay = 0.3;
      } else if (request.resolution === '0.5x0.625') {
        baseHoursPerSimDay = 0.5;
      } else if (request.resolution === '0.25x0.3125') {
        baseHoursPerSimDay = 1.0;
      }
    } else if (request.simulationType === 'GCHP') {
      if (request.cubedsphereRes === 'C24') {
        baseHoursPerSimDay = 0.2;
      } else if (request.cubedsphereRes === 'C48') {
        baseHoursPerSimDay = 0.5;
      } else if (request.cubedsphereRes === 'C90') {
        baseHoursPerSimDay = 1.0;
      } else if (request.cubedsphereRes === 'C180') {
        baseHoursPerSimDay = 2.5;
      } else if (request.cubedsphereRes === 'C360') {
        baseHoursPerSimDay = 8.0;
      }
    }
    
    // Adjust for chemistry complexity
    if (request.chemistryOption === 'fullchem') {
      baseHoursPerSimDay *= 1.0;
    } else if (request.chemistryOption === 'aerosol') {
      baseHoursPerSimDay *= 0.7;
    } else if (request.chemistryOption === 'CH4' || request.chemistryOption === 'CO2') {
      baseHoursPerSimDay *= 0.5;
    } else if (request.chemistryOption === 'transport') {
      baseHoursPerSimDay *= 0.3;
    }
    
    // Adjust for instance size
    let instanceSpeedupFactor = 1.0;
    if (request.instanceSize === 'small') {
      instanceSpeedupFactor = 0.5;
    } else if (request.instanceSize === 'medium') {
      instanceSpeedupFactor = 1.0;
    } else if (request.instanceSize === 'large') {
      instanceSpeedupFactor = 1.8;
    } else if (request.instanceSize === 'xlarge') {
      instanceSpeedupFactor = 3.2;
    }
    
    // Calculate total runtime
    const totalSimDays = request.simulationDays + (request.spinupDays || 0);
    const wallClockHours = (baseHoursPerSimDay * totalSimDays) / instanceSpeedupFactor;
    
    // Calculate cost
    const hourlyRate = instanceCosts[request.processorType][request.instanceSize];
    const spotDiscount = request.useSpot ? 0.3 : 1.0;
    const computeCost = hourlyRate * spotDiscount * wallClockHours;
    
    // Calculate storage
    const storageGB = calculateStorageGB();
    const storageCost = storageGB * 0.023 * 3;
    
    // Total cost
    const totalCost = computeCost + storageCost;
    
    // Generate cost saving tips
    const costSavingTips = generateCostSavingTips(request, totalCost, computeCost, storageCost);
    
    // Calculate throughput
    const throughputDaysPerDay = (24 / baseHoursPerSimDay) * instanceSpeedupFactor;
    
    return {
      estimatedCost: totalCost,
      estimatedRuntime: wallClockHours,
      computeCost: computeCost,
      storageCost: storageCost,
      throughputDaysPerDay: throughputDaysPerDay,
      storageGB: storageGB,
      recommendedInstanceType: determineRecommendedInstance(request),
      costSavingTips: costSavingTips
    };
  }
}

/**
 * Generate cost saving tips based on the configuration
 * @param {Object} request - The cost estimation request
 * @param {number} totalCost - The total estimated cost
 * @param {number} computeCost - The compute cost component
 * @param {number} storageCost - The storage cost component
 * @returns {string[]} - Array of cost saving tips
 */
function generateCostSavingTips(request, totalCost, computeCost, storageCost) {
  const tips = [];
  
  // Spot instance tip
  if (!request.useSpot) {
    tips.push('Use spot instances for up to 70% compute cost savings');
  }
  
  // Output frequency tip (if storage cost is significant)
  if (storageCost > totalCost * 0.2) {
    if (request.outputFrequency === 'hourly') {
      tips.push('Reduce output frequency from hourly to daily to save approximately 95% on storage costs');
    } else if (request.outputFrequency === '3-hourly') {
      tips.push('Reduce output frequency from 3-hourly to daily to save approximately 87% on storage costs');
    }
  }
  
  // Resolution tip for high-resolution runs
  if (request.simulationType === 'GC_CLASSIC') {
    if (request.resolution === '0.25x0.3125' || request.resolution === '0.5x0.625') {
      tips.push('Consider using a coarser resolution for preliminary or sensitivity runs');
    }
  } else if (request.simulationType === 'GCHP') {
    if (request.cubedsphereRes === 'C180' || request.cubedsphereRes === 'C360') {
      tips.push('Consider using a coarser resolution (C90) for preliminary or sensitivity runs');
    }
  }
  
  // Break up long simulations
  if (request.simulationDays > 90) {
    tips.push('Break long simulations into smaller segments to manage costs and enable checkpointing');
  }
  
  // Instance size optimization
  if (request.instanceSize === 'xlarge' && computeCost > 500) {
    tips.push('Consider using multiple smaller instances for better cost efficiency on long runs');
  }
  
  // Always include Graviton recommendation if not already using it
  if (!request.processorType.includes('graviton')) {
    tips.push('Consider using Graviton processors for better price-performance ratio');
  }
  
  return tips;
}

/**
 * Determine the recommended instance type for this configuration
 * @param {Object} request - The cost estimation request
 * @returns {string} - Recommended instance type
 */
function determineRecommendedInstance(request) {
  // Default recommendation based on existing benchmarks and simulation type
  // In a production environment, this would be based on actual benchmark data analysis
  
  if (request.simulationType === 'GC_CLASSIC') {
    if (request.resolution === '4x5' || request.resolution === '2x2.5') {
      return 'graviton3 (c7g.4xlarge)';
    } else if (request.resolution === '0.5x0.625') {
      return 'graviton3 (c7g.8xlarge)';
    } else if (request.resolution === '0.25x0.3125') {
      return 'graviton3 (c7g.16xlarge)';
    }
  } else if (request.simulationType === 'GCHP') {
    if (request.cubedsphereRes === 'C24' || request.cubedsphereRes === 'C48') {
      return 'graviton3e (hpc7g.4xlarge) with 2 nodes';
    } else if (request.cubedsphereRes === 'C90') {
      return 'graviton3e (hpc7g.8xlarge) with 2 nodes';
    } else if (request.cubedsphereRes === 'C180') {
      return 'graviton3e (hpc7g.16xlarge) with 4 nodes';
    } else if (request.cubedsphereRes === 'C360') {
      return 'graviton3e (hpc7g.16xlarge) with 8 nodes';
    }
  }
  
  // Default fallback if no specific recommendation
  return 'graviton3 (c7g.8xlarge)';
}

/**
 * Get performance comparisons for different instance types
 * @param {Object} request - The cost estimation request
 * @param {Object} benchmarkData - The matching benchmark data for the requested configuration
 * @returns {Array} - Array of performance comparison objects
 */
async function getPerformanceComparisons(request, benchmarkData) {
  // Query parameters to find benchmarks for the same simulation configuration but different instance types
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
      console.log('No benchmarks found for comparison');
      return [];
    }
    
    // Group benchmarks by processor type and instance type
    const benchmarksByType = {};
    result.Items.forEach(item => {
      const key = `${item.processor_type}-${item.instance_type}`;
      benchmarksByType[key] = item;
    });
    
    // Calculate relative performance and cost metrics
    const comparisons = [];
    const baseBenchmark = benchmarkData || result.Items[0]; // Use requested benchmark as base, or first result if not available
    
    Object.values(benchmarksByType).forEach(benchmark => {
      // Calculate relative performance (normalized to base benchmark)
      const relativePerformance = benchmark.throughput_days_per_day / baseBenchmark.throughput_days_per_day;
      
      // Calculate relative cost (normalized to base benchmark)
      const relativeCost = benchmark.cost_per_sim_day / baseBenchmark.cost_per_sim_day;
      
      // Calculate price-performance ratio (lower is better)
      const pricePerformanceRatio = relativeCost / relativePerformance;
      
      // Determine if this is the recommended instance
      const isRecommended = pricePerformanceRatio === 1.0 || pricePerformanceRatio < 0.95;
      
      comparisons.push({
        processorType: benchmark.processor_type,
        instanceType: benchmark.instance_type,
        throughputDaysPerDay: benchmark.throughput_days_per_day,
        costPerSimDay: benchmark.cost_per_sim_day,
        relativePerformance: relativePerformance,
        relativeCost: relativeCost,
        pricePerformanceRatio: pricePerformanceRatio,
        isRecommended: isRecommended
      });
    });
    
    // Sort by price-performance ratio (best first)
    comparisons.sort((a, b) => a.pricePerformanceRatio - b.pricePerformanceRatio);
    
    // Mark the best one as recommended if none are already marked
    if (!comparisons.some(c => c.isRecommended)) {
      comparisons[0].isRecommended = true;
    }
    
    return comparisons;
  } catch (error) {
    console.error('Error getting performance comparisons:', error);
    return [];
  }
}