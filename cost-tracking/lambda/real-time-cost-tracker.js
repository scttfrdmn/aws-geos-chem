/**
 * real-time-cost-tracker.js
 * 
 * Lambda function to track wall clock time and estimate costs in real-time
 * for AWS resources used by GEOS-Chem simulations.
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Constants for cost calculation
const COST_RATES = {
  // Instance type hourly costs (on-demand prices)
  EC2: {
    'c7g.4xlarge': 0.68,
    'c7g.8xlarge': 1.36,
    'c7g.16xlarge': 2.72,
    'c6i.4xlarge': 0.68,
    'c6i.8xlarge': 1.36,
    'c6i.16xlarge': 2.72,
    'r7g.4xlarge': 1.06,
    'r7g.8xlarge': 2.12,
    'r6i.8xlarge': 2.12,
    'r6i.16xlarge': 4.24
  },
  // Spot instance discount factor (approximate)
  SPOT_DISCOUNT: 0.7,
  // S3 storage pricing (per GB-month)
  S3: {
    STANDARD: 0.023,
    INTELLIGENT_TIERING: 0.023,
    STANDARD_IA: 0.01
  },
  // Data transfer costs (per GB)
  DATA_TRANSFER: {
    OUT_TO_INTERNET: 0.09
  }
};

/**
 * Calculates the current cost of a running simulation
 * @param {Object} simulation - Simulation record from DynamoDB
 * @returns {Object} - Updated cost information
 */
async function calculateCurrentCost(simulation) {
  // Calculate elapsed time
  const startTime = new Date(simulation.startedAt || simulation.createdAt);
  const currentTime = new Date();
  const elapsedHours = (currentTime - startTime) / (1000 * 60 * 60);
  
  // Get instance properties
  const instanceType = simulation.instanceType || 'c7g.8xlarge';
  const isSpot = simulation.useSpot !== false; // Default to spot if not specified
  
  // Calculate compute costs
  let hourlyRate = COST_RATES.EC2[instanceType] || 1.36; // Default to c7g.8xlarge price
  if (isSpot) {
    hourlyRate *= COST_RATES.SPOT_DISCOUNT;
  }
  
  const computeCost = hourlyRate * elapsedHours;
  
  // Estimate storage costs
  const estimatedStorageGB = simulation.estimatedStorageGB || 5;
  const storageCost = (estimatedStorageGB * COST_RATES.S3.STANDARD) / 30 * elapsedHours / 24;
  
  // Estimate data transfer costs
  const estimatedDataTransferGB = simulation.estimatedDataTransferGB || 1;
  const dataTransferCost = estimatedDataTransferGB * COST_RATES.DATA_TRANSFER.OUT_TO_INTERNET;
  
  // Calculate total cost
  const totalCost = computeCost + storageCost + dataTransferCost;
  
  return {
    computeCost: parseFloat(computeCost.toFixed(4)),
    storageCost: parseFloat(storageCost.toFixed(4)),
    dataTransferCost: parseFloat(dataTransferCost.toFixed(4)),
    totalCost: parseFloat(totalCost.toFixed(4)),
    elapsedHours: parseFloat(elapsedHours.toFixed(2)),
    lastUpdated: currentTime.toISOString(),
    instanceType,
    isSpot
  };
}

/**
 * Update active simulations with current cost estimates
 * and publish metrics to CloudWatch
 */
async function updateActiveCostEstimates(costTable) {
  const dynamoDB = new AWS.DynamoDB.DocumentClient();
  const cloudWatch = new AWS.CloudWatch();

  try {
    // Query for active simulations
    const { Items: activeSimulations } = await dynamoDB.query({
      TableName: process.env.SIMULATIONS_TABLE,
      IndexName: 'statusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'RUNNING'
      }
    }).promise();

    if (!activeSimulations || activeSimulations.length === 0) {
      console.log('No active simulations found');

      // Publish zero active simulations metric
      await cloudWatch.putMetricData({
        Namespace: 'GEOS-Chem',
        MetricData: [
          {
            MetricName: 'ActiveSimulations',
            Dimensions: [
              { Name: 'Service', Value: 'Batch' }
            ],
            Value: 0,
            Unit: 'Count',
            Timestamp: new Date()
          }
        ]
      }).promise();

      return { processedCount: 0, totalCost: 0 };
    }

    console.log(`Found ${activeSimulations.length} active simulations`);

    // Calculate metrics for CloudWatch
    let totalCost = 0;
    let metricData = [];

    // Process each active simulation
    const updatePromises = activeSimulations.map(async (simulation) => {
      // Calculate current cost
      const costInfo = await calculateCurrentCost(simulation);
      totalCost += costInfo.totalCost;

      // Add per-simulation metrics
      metricData.push(
        {
          MetricName: 'SimulationCost',
          Dimensions: [
            { Name: 'SimulationId', Value: simulation.simulationId },
            { Name: 'InstanceType', Value: costInfo.instanceType }
          ],
          Value: costInfo.totalCost,
          Unit: 'None',
          Timestamp: new Date()
        },
        {
          MetricName: 'ElapsedHours',
          Dimensions: [
            { Name: 'SimulationId', Value: simulation.simulationId }
          ],
          Value: costInfo.elapsedHours,
          Unit: 'Hours',
          Timestamp: new Date()
        }
      );

      // Update the real-time cost tracking table
      await dynamoDB.put({
        TableName: costTable,
        Item: {
          userId: simulation.userId,
          resourceId: `simulation:${simulation.simulationId}`,
          costType: 'real-time',
          simulationId: simulation.simulationId,
          simulationName: simulation.name || 'Unnamed Simulation',
          estimatedCost: costInfo.totalCost,
          costBreakdown: costInfo,
          timePeriod: new Date().toISOString().split('T')[0], // YYYY-MM-DD
          updatedAt: new Date().toISOString()
        }
      }).promise();

      return simulation.simulationId;
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    // Add aggregated metrics
    metricData.push(
      {
        MetricName: 'RealTimeCost',
        Dimensions: [
          { Name: 'Service', Value: 'Simulations' }
        ],
        Value: totalCost,
        Unit: 'None',
        Timestamp: new Date()
      },
      {
        MetricName: 'ActiveSimulations',
        Dimensions: [
          { Name: 'Service', Value: 'Batch' }
        ],
        Value: activeSimulations.length,
        Unit: 'Count',
        Timestamp: new Date()
      }
    );

    // Publish metrics in batches (maximum 20 per call)
    const metricBatches = [];
    for (let i = 0; i < metricData.length; i += 20) {
      metricBatches.push(metricData.slice(i, i + 20));
    }

    const metricPromises = metricBatches.map(async (batch) => {
      await cloudWatch.putMetricData({
        Namespace: 'GEOS-Chem',
        MetricData: batch
      }).promise();
    });

    await Promise.all(metricPromises);

    return {
      processedCount: activeSimulations.length,
      totalCost: totalCost
    };
  } catch (error) {
    console.error('Error updating active cost estimates:', error);
    throw error;
  }
}

/**
 * Lambda handler function
 */
exports.handler = async (event) => {
  try {
    const costTable = process.env.COST_TABLE;
    if (!costTable) {
      throw new Error('Missing required environment variable: COST_TABLE');
    }
    
    // Update cost estimates for all active simulations
    const result = await updateActiveCostEstimates(costTable);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Real-time cost estimates updated successfully',
        processedCount: result.processedCount
      })
    };
  } catch (error) {
    console.error('Error in real-time cost tracker:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error updating real-time cost estimates',
        error: error.message
      })
    };
  }
};