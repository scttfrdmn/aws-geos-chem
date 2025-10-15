/**
 * update-simulation-status.js
 *
 * Lambda function to update simulation status and calculate final metrics.
 * Called by Step Functions on completion or failure.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 * - SNS_TOPIC_ARN: SNS topic for notifications (optional)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({});
const eventBridgeClient = new EventBridgeClient({});

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

// Instance hourly costs (October 2025 pricing)
const INSTANCE_COSTS = {
  // Graviton4 - Best price/performance (20-40% better than Graviton3)
  graviton4: {
    'c8g.4xlarge': 0.61,   // 16 vCPUs, 32 GB - NEW Graviton4
    'c8g.8xlarge': 1.22,   // 32 vCPUs, 64 GB
    'c8g.12xlarge': 1.83,  // 48 vCPUs, 96 GB
    'c8g.16xlarge': 2.44,  // 64 vCPUs, 128 GB
    'c8g.24xlarge': 3.66,  // 96 vCPUs, 192 GB
    'c8g.48xlarge': 7.32,  // 192 vCPUs, 384 GB
  },
  // Graviton3 - Still excellent value
  graviton3: {
    'c7g.4xlarge': 0.68,
    'c7g.8xlarge': 1.36,
    'c7g.12xlarge': 2.04,
    'c7g.16xlarge': 2.72,
  },
  // AMD EPYC Genoa - Best raw performance
  amd: {
    'c7a.4xlarge': 0.68,
    'c7a.8xlarge': 1.36,
    'c7a.12xlarge': 2.04,
    'c7a.16xlarge': 2.72,
    'c7a.24xlarge': 4.08,
    'c7a.32xlarge': 5.44,
    'c7a.48xlarge': 8.16,
  },
  // Intel Sapphire Rapids - Lower price/performance
  intel: {
    'c7i.4xlarge': 0.78,
    'c7i.8xlarge': 1.56,
    'c7i.12xlarge': 2.34,
    'c7i.16xlarge': 3.12,
    'c7i.24xlarge': 4.68,
    'c7i.48xlarge': 9.36,
  }
};

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Updating simulation status:', JSON.stringify(event, null, 2));

  const { userId, simulationId, status, statusDetails, runtimeSeconds, exitCode } = event;

  try {
    // 1. Get current simulation record
    const simulation = await getSimulation(userId, simulationId);

    // 2. Calculate final metrics if completed
    let metrics = {};
    if (status === 'COMPLETED' && runtimeSeconds) {
      metrics = await calculateFinalMetrics(simulation, runtimeSeconds);
    }

    // 3. Update simulation record
    const updateResult = await updateSimulation(userId, simulationId, {
      status,
      statusDetails,
      runtimeSeconds,
      exitCode,
      ...metrics
    });

    // 4. Send notifications
    await sendNotifications(simulation, status, metrics);

    // 5. Emit EventBridge event for downstream processing
    await emitStatusChangeEvent(simulation, status, metrics);

    console.log(`Updated simulation ${simulationId} to status ${status}`);

    return {
      ...event,
      updated: true,
      metrics,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error updating simulation status:', error);
    throw error;
  }
};

/**
 * Get simulation record from DynamoDB
 */
async function getSimulation(userId, simulationId) {
  const response = await docClient.send(new GetCommand({
    TableName: SIMULATIONS_TABLE,
    Key: { userId, simulationId }
  }));

  if (!response.Item) {
    throw new Error(`Simulation not found: ${simulationId}`);
  }

  return response.Item;
}

/**
 * Calculate final metrics for completed simulation
 */
async function calculateFinalMetrics(simulation, runtimeSeconds) {
  const config = simulation.configuration;
  const runtimeHours = runtimeSeconds / 3600;

  // Calculate simulation days
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const simulationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  // Get instance cost
  const instanceCost = getInstanceHourlyCost(config.processorType, config.instanceSize);

  // Apply spot discount if used
  const effectiveCost = config.useSpot ? instanceCost * 0.3 : instanceCost;

  // Calculate total compute cost
  const computeCost = effectiveCost * runtimeHours;

  // Estimate storage cost (simplified)
  const storageCost = estimateStorageCost(config, simulationDays);

  // Total cost
  const totalCost = computeCost + storageCost;

  // Calculate throughput (simulation days per wall-clock day)
  const throughput = (simulationDays * 86400) / runtimeSeconds;

  // Calculate hours per simulation day
  const hoursPerSimDay = runtimeHours / simulationDays;

  // Calculate cost per simulation day
  const costPerSimDay = effectiveCost * hoursPerSimDay;

  // CPU efficiency estimate (would be better with actual CloudWatch metrics)
  const cpuEfficiency = 92; // Placeholder - would come from actual monitoring

  return {
    actualCost: parseFloat(totalCost.toFixed(2)),
    actualRuntime: runtimeHours,
    computeCost: parseFloat(computeCost.toFixed(2)),
    storageCost: parseFloat(storageCost.toFixed(2)),
    throughputDaysPerDay: parseFloat(throughput.toFixed(2)),
    hoursPerSimDay: parseFloat(hoursPerSimDay.toFixed(4)),
    costPerSimDay: parseFloat(costPerSimDay.toFixed(4)),
    cpuEfficiency,
    simulationDays,
    completedAt: new Date().toISOString()
  };
}

/**
 * Get instance hourly cost
 */
function getInstanceHourlyCost(processorType, instanceSize) {
  // Map instance size to actual instance type
  const sizeMap = {
    small: '4xlarge',
    medium: '8xlarge',
    large: '16xlarge',
    xlarge: '24xlarge'
  };

  const instanceClass = sizeMap[instanceSize] || '8xlarge';

  // Get cost based on processor type
  let cost = 1.36; // Default fallback

  if (INSTANCE_COSTS[processorType]) {
    // Find matching instance type
    const instanceType = Object.keys(INSTANCE_COSTS[processorType])
      .find(type => type.includes(instanceClass));

    if (instanceType) {
      cost = INSTANCE_COSTS[processorType][instanceType];
    }
  }

  return cost;
}

/**
 * Estimate storage cost
 */
function estimateStorageCost(config, simulationDays) {
  // Base storage per day (GB)
  let baseStoragePerDay = 1;

  // Adjust for resolution
  if (config.resolution === '2x2.5') baseStoragePerDay = 2;
  if (config.resolution === '0.5x0.625') baseStoragePerDay = 8;
  if (config.resolution === '0.25x0.3125') baseStoragePerDay = 16;

  if (config.cubedsphereRes === 'C48') baseStoragePerDay = 4;
  if (config.cubedsphereRes === 'C90') baseStoragePerDay = 12;
  if (config.cubedsphereRes === 'C180') baseStoragePerDay = 36;
  if (config.cubedsphereRes === 'C360') baseStoragePerDay = 96;

  // Adjust for output frequency
  let frequencyFactor = 1;
  if (config.outputFrequency === 'hourly') frequencyFactor = 24;
  if (config.outputFrequency === '3-hourly') frequencyFactor = 8;
  if (config.outputFrequency === 'monthly') frequencyFactor = 0.033;

  // Total storage
  const totalStorageGB = baseStoragePerDay * simulationDays * frequencyFactor;

  // S3 cost ($0.023 per GB-month for standard, assume 3 months retention)
  const storageCost = totalStorageGB * 0.023 * 3;

  return storageCost;
}

/**
 * Update simulation record
 */
async function updateSimulation(userId, simulationId, updates) {
  const updateExpressions = [];
  const attributeNames = { '#status': 'status' };
  const attributeValues = { ':timestamp': new Date().toISOString() };

  // Build dynamic update expression
  Object.keys(updates).forEach((key, index) => {
    if (updates[key] !== undefined && updates[key] !== null) {
      const valueName = `:val${index}`;
      if (key === 'status') {
        updateExpressions.push('#status = ' + valueName);
      } else {
        updateExpressions.push(`${key} = ${valueName}`);
      }
      attributeValues[valueName] = updates[key];
    }
  });

  // Always update timestamp
  updateExpressions.push('updatedAt = :timestamp');

  await docClient.send(new UpdateCommand({
    TableName: SIMULATIONS_TABLE,
    Key: { userId, simulationId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues
  }));
}

/**
 * Send notifications (email, SNS, etc.)
 */
async function sendNotifications(simulation, status, metrics) {
  if (!SNS_TOPIC_ARN) {
    console.log('No SNS topic configured, skipping notifications');
    return;
  }

  try {
    const message = buildNotificationMessage(simulation, status, metrics);

    await snsClient.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `GEOS-Chem Simulation ${status}: ${simulation.name}`,
      Message: JSON.stringify(message, null, 2)
    }));

    console.log('Notification sent via SNS');
  } catch (error) {
    console.error('Error sending notification:', error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Build notification message
 */
function buildNotificationMessage(simulation, status, metrics) {
  const message = {
    simulationId: simulation.simulationId,
    userId: simulation.userId,
    name: simulation.name,
    status,
    configuration: simulation.configuration,
    timestamp: new Date().toISOString()
  };

  if (status === 'COMPLETED') {
    message.results = {
      runtime: `${metrics.actualRuntime?.toFixed(2)} hours`,
      cost: `$${metrics.actualCost?.toFixed(2)}`,
      throughput: `${metrics.throughputDaysPerDay?.toFixed(2)} sim days/day`,
      costPerSimDay: `$${metrics.costPerSimDay?.toFixed(4)}/sim day`
    };
    message.outputPath = simulation.outputPath;
  }

  return message;
}

/**
 * Emit EventBridge event for downstream processing
 */
async function emitStatusChangeEvent(simulation, status, metrics) {
  try {
    await eventBridgeClient.send(new PutEventsCommand({
      Entries: [
        {
          Source: 'geos-chem.simulations',
          DetailType: 'SimulationStatusChange',
          Detail: JSON.stringify({
            simulationId: simulation.simulationId,
            userId: simulation.userId,
            status,
            previousStatus: simulation.status,
            metrics,
            timestamp: new Date().toISOString()
          })
        }
      ]
    }));

    console.log('EventBridge event emitted');
  } catch (error) {
    console.error('Error emitting EventBridge event:', error);
    // Don't throw - events are non-critical
  }
}
