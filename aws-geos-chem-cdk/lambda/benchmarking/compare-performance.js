/**
 * Lambda function for comparing GEOS-Chem performance across different instances
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Configuration
const BENCHMARKS_TABLE = process.env.BENCHMARKS_TABLE || 'geos-chem-benchmarks';

/**
 * Handler function for performance comparison requests
 */
exports.handler = async (event) => {
  try {
    console.log('Received performance comparison request:', JSON.stringify(event));
    
    // Parse request body
    const requestBody = JSON.parse(event.body);
    
    // Get performance comparisons
    const comparisons = await getPerformanceComparisons(requestBody);
    
    // Return the performance comparisons
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // For CORS support
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(comparisons)
    };
  } catch (error) {
    console.error('Error processing performance comparison request:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // For CORS support
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({ 
        error: 'Failed to compare performance',
        message: error.message
      })
    };
  }
};

/**
 * Get performance comparisons for different instance types
 * @param {Object} request - The cost estimation request
 * @returns {Array} - Array of performance comparison objects
 */
async function getPerformanceComparisons(request) {
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
    
    // Find the benchmark that matches the request configuration
    const requestedKey = `${request.processorType}-${request.instanceSize}`;
    let baseBenchmark = null;
    
    // Try to find exact match first
    for (const [key, benchmark] of Object.entries(benchmarksByType)) {
      if (key.toLowerCase().includes(requestedKey.toLowerCase())) {
        baseBenchmark = benchmark;
        break;
      }
    }
    
    // If no exact match found, use the first benchmark as base
    if (!baseBenchmark && result.Items.length > 0) {
      baseBenchmark = result.Items[0];
    }
    
    // If still no benchmark found, return empty array
    if (!baseBenchmark) {
      return [];
    }
    
    // Calculate relative performance and cost metrics
    const comparisons = [];
    
    Object.values(benchmarksByType).forEach(benchmark => {
      // Calculate relative performance (normalized to base benchmark)
      const relativePerformance = benchmark.throughput_days_per_day / baseBenchmark.throughput_days_per_day;
      
      // Calculate relative cost (normalized to base benchmark)
      const relativeCost = benchmark.cost_per_sim_day / baseBenchmark.cost_per_sim_day;
      
      // Calculate price-performance ratio (lower is better)
      const pricePerformanceRatio = relativeCost / relativePerformance;
      
      // Determine if this is the requested instance type
      const isRequested = benchmark === baseBenchmark;
      
      // Determine if this is the recommended instance
      const isRecommended = pricePerformanceRatio <= 1.0 && pricePerformanceRatio === Math.min(...Object.values(benchmarksByType).map(b => {
        return (b.cost_per_sim_day / baseBenchmark.cost_per_sim_day) / (b.throughput_days_per_day / baseBenchmark.throughput_days_per_day);
      }));
      
      comparisons.push({
        processorType: benchmark.processor_type,
        instanceType: benchmark.instance_type,
        throughputDaysPerDay: benchmark.throughput_days_per_day,
        costPerSimDay: benchmark.cost_per_sim_day,
        relativePerformance: relativePerformance,
        relativeCost: relativeCost,
        pricePerformanceRatio: pricePerformanceRatio,
        isRequested: isRequested,
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