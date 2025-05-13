/**
 * submit-simulation.js
 * Lambda function to handle simulation submission from the web interface
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const stepFunctions = new AWS.StepFunctions();
const s3 = new AWS.S3();

// Get environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;
const USERS_BUCKET = process.env.USERS_BUCKET;
const SYSTEM_BUCKET = process.env.SYSTEM_BUCKET;

/**
 * Handler for the submit-simulation Lambda function
 */
exports.handler = async (event) => {
  console.log('Submit Simulation Handler - Event:', JSON.stringify(event));
  
  try {
    // Parse input from API Gateway
    const userId = event.userId;
    const simulationConfig = event.simulationConfig;
    const simulationName = event.simulationName || 'Untitled Simulation';
    
    if (!userId || !simulationConfig) {
      throw new Error('Missing required parameters: userId and simulationConfig');
    }
    
    // Generate unique simulation ID
    const simulationId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Save simulation configuration to S3
    const configKey = `${userId}/configurations/${simulationId}/config.json`;
    await s3.putObject({
      Bucket: USERS_BUCKET,
      Key: configKey,
      Body: JSON.stringify(simulationConfig),
      ContentType: 'application/json'
    }).promise();
    
    // Calculate cost estimate based on config (simplified)
    const costEstimate = calculateCostEstimate(simulationConfig);
    
    // Create simulation record in DynamoDB
    const simulationRecord = {
      userId: userId,
      simulationId: simulationId,
      name: simulationName,
      status: 'SUBMITTED',
      createdAt: timestamp,
      updatedAt: timestamp,
      configLocation: `s3://${USERS_BUCKET}/${configKey}`,
      costEstimate: costEstimate,
      simulationType: simulationConfig.simulationType || 'standard',
      instanceType: simulationConfig.instanceType || 'graviton',
      description: simulationConfig.description || ''
    };
    
    await dynamoDB.put({
      TableName: SIMULATIONS_TABLE,
      Item: simulationRecord
    }).promise();
    
    // Prepare state machine input
    const workflowInput = {
      simulationId: simulationId,
      userId: userId,
      configLocation: `s3://${USERS_BUCKET}/${configKey}`,
      outputLocation: `s3://${USERS_BUCKET}/${userId}/results/${simulationId}/`,
      simulationConfig
    };
    
    // Return simulation details
    return {
      simulationId: simulationId,
      status: 'SUBMITTED',
      message: 'Simulation submitted successfully',
      ...workflowInput
    };
  } catch (error) {
    console.error('Error submitting simulation:', error);
    throw error;
  }
};

/**
 * Calculate cost estimate based on simulation configuration
 * @param {Object} config - Simulation configuration
 * @returns {Number} - Estimated cost in USD
 */
function calculateCostEstimate(config) {
  // Basic cost estimation logic - would be more sophisticated in production
  // with actual pricing data and benchmark-based calculations
  
  let baseCostPerHour = 0;
  
  // Instance type costs (simplified)
  switch (config.instanceType) {
    case 'c7g.8xlarge':
      baseCostPerHour = 1.20; // Graviton
      break;
    case 'c7g.16xlarge':
      baseCostPerHour = 2.40; // Graviton
      break;
    case 'c6i.8xlarge':
      baseCostPerHour = 1.32; // Intel
      break;
    case 'c6i.16xlarge':
      baseCostPerHour = 2.64; // Intel
      break;
    default:
      baseCostPerHour = 1.50; // Default
  }
  
  // Adjust for simulation type
  const simulationType = config.simulationType || 'fullchem';
  let typeMultiplier = 1.0;
  
  switch (simulationType) {
    case 'fullchem':
      typeMultiplier = 1.0;
      break;
    case 'aerosol':
      typeMultiplier = 0.8;
      break;
    case 'transport':
      typeMultiplier = 0.6;
      break;
    default:
      typeMultiplier = 1.0;
  }
  
  // Adjust for simulation duration
  const durationDays = config.durationDays || 7;
  
  // Calculate estimated runtime in hours
  const estimatedRuntimeHours = durationDays * typeMultiplier * 0.5; // 0.5 = approximately 12 hours per simulation day
  
  // Calculate total cost
  const totalCost = baseCostPerHour * estimatedRuntimeHours;
  
  // Add storage costs (simplified)
  const storageCost = 0.05 * durationDays; // $0.05 per simulation day for storage
  
  // Round to 2 decimal places
  return Math.round((totalCost + storageCost) * 100) / 100;
}