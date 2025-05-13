/**
 * optimization-recommendation.js
 * Lambda function to provide cost optimization recommendations for GEOS-Chem simulations
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const COST_TABLE = process.env.COST_TABLE;
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

// Instance comparisons for optimization
const INSTANCE_ALTERNATIVES = {
  // Graviton alternatives
  'c7g.16xlarge': [
    { type: 'c7g.8xlarge', factor: 0.51, description: 'Half the cores, better for I/O bound workloads' },
    { type: 'c6g.16xlarge', factor: 0.95, description: 'Graviton2, slightly lower cost' }
  ],
  'c7g.8xlarge': [
    { type: 'c6g.8xlarge', factor: 0.95, description: 'Graviton2, slightly lower cost' }
  ],
  'r7g.16xlarge': [
    { type: 'r7g.8xlarge', factor: 0.51, description: 'Half the cores, still plenty of memory' },
    { type: 'c7g.16xlarge', factor: 0.85, description: 'Less memory but more cost-effective for most simulations' }
  ],
  
  // Intel alternatives
  'c6i.16xlarge': [
    { type: 'c7g.16xlarge', factor: 0.9, description: 'Graviton3, better price-performance' },
    { type: 'c6i.8xlarge', factor: 0.51, description: 'Half the cores, better for I/O bound workloads' }
  ],
  'c6i.8xlarge': [
    { type: 'c7g.8xlarge', factor: 0.9, description: 'Graviton3, better price-performance' }
  ],
  
  // AMD alternatives
  'c6a.16xlarge': [
    { type: 'c7g.16xlarge', factor: 0.92, description: 'Graviton3, better price-performance' }
  ],
  'c6a.8xlarge': [
    { type: 'c7g.8xlarge', factor: 0.92, description: 'Graviton3, better price-performance' }
  ]
};

// Resolution optimization guidelines
const RESOLUTION_GUIDELINES = {
  '4x5': {
    description: 'Coarse resolution, good for long-term global simulations',
    nextStep: '2x2.5 for more detailed results'
  },
  '2x2.5': {
    description: 'Medium resolution, balanced performance',
    nextStep: '0.5x0.625 for regional studies'
  },
  '0.5x0.625': {
    description: 'Fine resolution, good for regional studies',
    nextStep: 'Consider nested domains instead of global'
  },
  'c24': {
    description: 'Coarse cubed-sphere resolution',
    nextStep: 'c48 for more balanced results'
  },
  'c48': {
    description: 'Medium cubed-sphere resolution',
    nextStep: 'c90 for more detailed results'
  },
  'c90': {
    description: 'Fine cubed-sphere resolution',
    nextStep: 'c180 for very detailed studies'
  },
  'c180': {
    description: 'Very fine cubed-sphere resolution',
    nextStep: 'Consider if this detail is necessary'
  }
};

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Optimization Recommendation - Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract HTTP method and query parameters
    const queryParams = event.queryStringParameters || {};
    
    // Get userId from request context (assuming API Gateway authorization)
    let userId;
    if (event.requestContext && event.requestContext.authorizer && event.requestContext.authorizer.claims) {
      userId = event.requestContext.authorizer.claims.sub;
    } else if (queryParams.userId) {
      // For testing, allow userId in query params
      userId = queryParams.userId;
    } else {
      return formatResponse(401, { message: 'Unauthorized - User identity not found' });
    }
    
    // Determine what type of recommendations to generate
    let recommendationType = queryParams.type || 'all';
    let simulationId = queryParams.simulationId;
    
    // Generate recommendations
    let recommendations;
    
    if (simulationId) {
      // Recommendations for a specific simulation
      recommendations = await generateSimulationRecommendations(userId, simulationId);
    } else {
      // General recommendations based on user's past simulations
      recommendations = await generateUserRecommendations(userId, recommendationType);
    }
    
    return formatResponse(200, {
      message: 'Optimization recommendations generated successfully',
      recommendations
    });
  } catch (error) {
    console.error('Error generating optimization recommendations:', error);
    return formatResponse(500, {
      message: 'Error generating optimization recommendations',
      error: error.message
    });
  }
};

/**
 * Generate optimization recommendations for a specific simulation
 */
async function generateSimulationRecommendations(userId, simulationId) {
  try {
    // Get simulation details
    const simulation = await getSimulation(userId, simulationId);
    if (!simulation) {
      throw new Error(`Simulation ${simulationId} not found for user ${userId}`);
    }
    
    // Get costs for the simulation
    const costs = await getCostsForSimulation(userId, simulationId);
    
    // Calculate total cost
    let totalCost = 0;
    for (const cost of costs) {
      totalCost += parseFloat(cost.cost) || 0;
    }
    
    // Generate instance recommendations
    const instanceRecommendations = generateInstanceRecommendations(simulation);
    
    // Generate resolution recommendations
    const resolutionRecommendations = generateResolutionRecommendations(simulation);
    
    // Generate runtime recommendations
    const runtimeRecommendations = generateRuntimeRecommendations(simulation);
    
    // Combine all recommendations
    const allRecommendations = [
      ...instanceRecommendations,
      ...resolutionRecommendations,
      ...runtimeRecommendations
    ];
    
    // Sort by potential savings (descending)
    allRecommendations.sort((a, b) => b.potentialSavingsPercent - a.potentialSavingsPercent);
    
    return {
      simulationId,
      name: simulation.name || `Simulation ${simulationId}`,
      currentCost: totalCost,
      recommendations: allRecommendations,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating simulation recommendations:', error);
    throw error;
  }
}

/**
 * Generate general optimization recommendations for a user
 */
async function generateUserRecommendations(userId, recommendationType) {
  try {
    // Get user's simulations
    const simulations = await getSimulationsForUser(userId);
    
    // Group simulations by type
    const simulationsByType = {};
    for (const sim of simulations) {
      const type = sim.simulationType || 'unknown';
      if (!simulationsByType[type]) {
        simulationsByType[type] = [];
      }
      simulationsByType[type].push(sim);
    }
    
    // Generate different types of recommendations
    const recommendations = {
      instanceOptimization: [],
      spotUsage: [],
      resolutionGuidance: [],
      parallelCluster: []
    };
    
    // Generate instance optimization recommendations
    if (recommendationType === 'all' || recommendationType === 'instance') {
      recommendations.instanceOptimization = generateInstanceTypeRecommendations(simulations);
    }
    
    // Generate spot usage recommendations
    if (recommendationType === 'all' || recommendationType === 'spot') {
      recommendations.spotUsage = generateSpotRecommendations(simulations);
    }
    
    // Generate resolution guidance
    if (recommendationType === 'all' || recommendationType === 'resolution') {
      recommendations.resolutionGuidance = generateResolutionGuidance(simulations);
    }
    
    // Generate parallel cluster recommendations for GCHP
    if (recommendationType === 'all' || recommendationType === 'parallel') {
      recommendations.parallelCluster = generateParallelClusterRecommendations(simulations);
    }
    
    return {
      userId,
      simulationCount: simulations.length,
      recommendationTypes: Object.keys(recommendations).filter(key => recommendations[key].length > 0),
      recommendations,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating user recommendations:', error);
    throw error;
  }
}

/**
 * Generate instance recommendations for a simulation
 */
function generateInstanceRecommendations(simulation) {
  const recommendations = [];
  
  // Extract simulation details
  const instanceType = simulation.instanceType;
  const simulationType = simulation.simulationType;
  const useSpot = simulation.useSpot || false;
  
  // If no instance type, return empty recommendations
  if (!instanceType) {
    return recommendations;
  }
  
  // Check if we have alternatives for this instance type
  if (INSTANCE_ALTERNATIVES[instanceType]) {
    const alternatives = INSTANCE_ALTERNATIVES[instanceType];
    
    for (const alt of alternatives) {
      // Calculate potential savings
      let potentialSavingsPercent = (1 - alt.factor) * 100;
      
      // Create recommendation
      recommendations.push({
        type: 'instance',
        currentValue: instanceType,
        recommendedValue: alt.type,
        description: alt.description,
        potentialSavingsPercent,
        impact: 'medium'
      });
    }
  }
  
  // Recommend spot instances if not already using them
  if (!useSpot) {
    recommendations.push({
      type: 'spot',
      currentValue: 'On-Demand',
      recommendedValue: 'Spot',
      description: 'Use Spot instances for significant cost savings (up to 70%)',
      potentialSavingsPercent: 70,
      impact: 'high'
    });
  }
  
  return recommendations;
}

/**
 * Generate resolution recommendations for a simulation
 */
function generateResolutionRecommendations(simulation) {
  const recommendations = [];
  
  // Extract simulation details
  const resolution = simulation.resolution;
  const simulationType = simulation.simulationType;
  
  // If no resolution, return empty recommendations
  if (!resolution) {
    return recommendations;
  }
  
  // Check if we have guidelines for this resolution
  if (RESOLUTION_GUIDELINES[resolution]) {
    const guideline = RESOLUTION_GUIDELINES[resolution];
    
    // Check if this is a high-resolution simulation
    if (resolution === '0.5x0.625' || resolution === 'c180') {
      recommendations.push({
        type: 'resolution',
        currentValue: resolution,
        recommendedValue: resolution.startsWith('c') ? 'c90' : '2x2.5',
        description: 'Using lower resolution for initial runs can save costs during development',
        potentialSavingsPercent: 75,
        impact: 'high'
      });
    }
    
    // For medium resolutions, suggest coarser resolution for long runs
    if (resolution === '2x2.5' || resolution === 'c90') {
      const simDays = parseInt(simulation.durationDays || 0);
      if (simDays > 30) {
        recommendations.push({
          type: 'resolution',
          currentValue: resolution,
          recommendedValue: resolution.startsWith('c') ? 'c48' : '4x5',
          description: 'For long simulations, consider using coarser resolution to reduce costs',
          potentialSavingsPercent: 60,
          impact: 'medium'
        });
      }
    }
  }
  
  return recommendations;
}

/**
 * Generate runtime recommendations for a simulation
 */
function generateRuntimeRecommendations(simulation) {
  const recommendations = [];
  
  // Extract simulation details
  const simulationType = simulation.simulationType;
  const durationDays = parseInt(simulation.durationDays || 0);
  
  // Recommend shorter test runs for development
  if (durationDays > 30) {
    recommendations.push({
      type: 'duration',
      currentValue: `${durationDays} days`,
      recommendedValue: '7 days',
      description: 'For initial testing, shorter simulation periods can save costs',
      potentialSavingsPercent: Math.round((1 - 7 / durationDays) * 100),
      impact: 'medium'
    });
  }
  
  // For full chemistry, suggest aerosol-only or transport for initial testing
  if (simulationType === 'fullchem') {
    recommendations.push({
      type: 'simulationType',
      currentValue: 'fullchem',
      recommendedValue: 'aerosol',
      description: 'For aerosol-focused studies, aerosol-only simulations are more cost-effective',
      potentialSavingsPercent: 30,
      impact: 'medium'
    });
  }
  
  return recommendations;
}

/**
 * Generate instance type recommendations based on simulation history
 */
function generateInstanceTypeRecommendations(simulations) {
  const recommendations = [];
  
  // Group simulations by instance type
  const instanceCounts = {};
  
  for (const sim of simulations) {
    const instanceType = sim.instanceType;
    if (!instanceType) continue;
    
    if (!instanceCounts[instanceType]) {
      instanceCounts[instanceType] = 0;
    }
    instanceCounts[instanceType]++;
  }
  
  // Check for non-Graviton instances
  const nonGravitonCount = Object.entries(instanceCounts)
    .filter(([type, count]) => !type.includes('g.'))
    .reduce((sum, [type, count]) => sum + count, 0);
  
  const totalCount = simulations.length;
  
  if (nonGravitonCount > 0 && totalCount > 0) {
    const percentage = Math.round((nonGravitonCount / totalCount) * 100);
    
    if (percentage > 30) {
      recommendations.push({
        type: 'instanceStrategy',
        description: `${percentage}% of your simulations use non-Graviton instances. Consider switching to Graviton for better price-performance.`,
        potentialSavingsPercent: 10,
        impact: 'medium'
      });
    }
  }
  
  // Check for oversized instances
  const largeInstanceCount = Object.entries(instanceCounts)
    .filter(([type, count]) => type.includes('16xlarge'))
    .reduce((sum, [type, count]) => sum + count, 0);
  
  if (largeInstanceCount > 0 && totalCount > 0) {
    const percentage = Math.round((largeInstanceCount / totalCount) * 100);
    
    if (percentage > 50) {
      recommendations.push({
        type: 'instanceSize',
        description: `${percentage}% of your simulations use large 16xlarge instances. For I/O bound workloads, smaller instances may be more cost-effective.`,
        potentialSavingsPercent: 15,
        impact: 'medium'
      });
    }
  }
  
  return recommendations;
}

/**
 * Generate spot instance recommendations
 */
function generateSpotRecommendations(simulations) {
  const recommendations = [];
  
  // Count on-demand vs spot usage
  let onDemandCount = 0;
  let spotCount = 0;
  
  for (const sim of simulations) {
    if (sim.useSpot === true) {
      spotCount++;
    } else {
      onDemandCount++;
    }
  }
  
  const totalCount = onDemandCount + spotCount;
  
  if (totalCount > 0 && onDemandCount > 0) {
    const percentage = Math.round((onDemandCount / totalCount) * 100);
    
    if (percentage > 30) {
      recommendations.push({
        type: 'spotUsage',
        description: `${percentage}% of your simulations use On-Demand instances. Switching to Spot instances can save up to 70% on compute costs.`,
        potentialSavingsPercent: 70,
        impact: 'high'
      });
    }
  }
  
  return recommendations;
}

/**
 * Generate resolution guidance
 */
function generateResolutionGuidance(simulations) {
  const recommendations = [];
  
  // Group simulations by resolution
  const resolutionCounts = {};
  
  for (const sim of simulations) {
    const resolution = sim.resolution;
    if (!resolution) continue;
    
    if (!resolutionCounts[resolution]) {
      resolutionCounts[resolution] = 0;
    }
    resolutionCounts[resolution]++;
  }
  
  // Check for high-resolution simulations
  const highResCount = Object.entries(resolutionCounts)
    .filter(([res, count]) => res === '0.5x0.625' || res === 'c180' || res === 'c360')
    .reduce((sum, [res, count]) => sum + count, 0);
  
  const totalCount = simulations.length;
  
  if (highResCount > 0 && totalCount > 0) {
    const percentage = Math.round((highResCount / totalCount) * 100);
    
    if (percentage > 20) {
      recommendations.push({
        type: 'resolution',
        description: `${percentage}% of your simulations use high-resolution configurations. Consider using coarser resolutions for initial testing and development.`,
        potentialSavingsPercent: 75,
        impact: 'high'
      });
    }
  }
  
  return recommendations;
}

/**
 * Generate parallel cluster recommendations
 */
function generateParallelClusterRecommendations(simulations) {
  const recommendations = [];
  
  // Count GC Classic vs GCHP
  let gcClassicCount = 0;
  let gchpCount = 0;
  
  for (const sim of simulations) {
    if (sim.application === 'gchp') {
      gchpCount++;
    } else {
      gcClassicCount++;
    }
  }
  
  // If user has both types, recommend optimizing
  if (gcClassicCount > 0 && gchpCount > 0) {
    recommendations.push({
      type: 'parallelCluster',
      description: 'You are running both GC Classic and GCHP simulations. For GCHP, ensure you are using ParallelCluster with EFA for optimal performance.',
      impact: 'medium'
    });
  } else if (gchpCount > 0) {
    // If user is running GCHP, recommend ParallelCluster
    recommendations.push({
      type: 'parallelCluster',
      description: 'For your GCHP simulations, ensure you are using ParallelCluster with EFA for optimal performance and cost-efficiency.',
      impact: 'medium'
    });
  } else if (gcClassicCount > 10) {
    // If user has many GC Classic simulations, suggest trying GCHP
    recommendations.push({
      type: 'gchp',
      description: 'You have run multiple GC Classic simulations. For high-resolution studies, consider trying GCHP with ParallelCluster for better scaling.',
      impact: 'low'
    });
  }
  
  return recommendations;
}

/**
 * Get costs for a specific simulation
 */
async function getCostsForSimulation(userId, simulationId) {
  try {
    const params = {
      TableName: COST_TABLE,
      KeyConditionExpression: 'userId = :uid',
      FilterExpression: 'contains(resourceId, :simId)',
      ExpressionAttributeValues: {
        ':uid': userId,
        ':simId': simulationId
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Error getting costs for simulation:', error);
    return [];
  }
}

/**
 * Get a specific simulation
 */
async function getSimulation(userId, simulationId) {
  try {
    const params = {
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId,
        simulationId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('Error getting simulation:', error);
    return null;
  }
}

/**
 * Get simulations for a user
 */
async function getSimulationsForUser(userId) {
  try {
    const params = {
      TableName: SIMULATIONS_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Error getting simulations for user:', error);
    return [];
  }
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