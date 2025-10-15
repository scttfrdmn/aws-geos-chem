/**
 * submit-simulation.js
 *
 * Lambda function to accept and validate simulation submissions from API Gateway.
 * Creates initial DynamoDB record and triggers Step Functions workflow.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 * - USERS_BUCKET: S3 bucket for user data
 * - SYSTEM_BUCKET: S3 bucket for system data
 * - STATE_MACHINE_ARN: ARN of the Step Functions workflow
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const sfnClient = new SFNClient({});

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;
const USERS_BUCKET = process.env.USERS_BUCKET;
const SYSTEM_BUCKET = process.env.SYSTEM_BUCKET;
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // Parse the request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    // Extract user ID from request context (set by Cognito authorizer)
    const userId = event.requestContext?.authorizer?.claims?.sub ||
                   event.requestContext?.authorizer?.principalId ||
                   'anonymous';

    // Validate required fields
    const validationError = validateSimulationConfig(body);
    if (validationError) {
      return createResponse(400, {
        error: 'Validation Error',
        message: validationError
      });
    }

    // Generate unique simulation ID
    const simulationId = uuidv4();
    const timestamp = new Date().toISOString();

    // Prepare simulation record
    const simulation = {
      userId,
      simulationId,
      name: body.name || `Simulation ${simulationId.substring(0, 8)}`,
      description: body.description || '',
      status: 'SUBMITTED',
      createdAt: timestamp,
      updatedAt: timestamp,

      // Configuration
      configuration: {
        simulationType: body.simulationType,
        processorType: body.processorType || 'graviton3',
        instanceSize: body.instanceSize || 'medium',
        memory: body.memory || 'standard',
        resolution: body.resolution,
        cubedsphereRes: body.cubedsphereRes,
        chemistryOption: body.chemistryOption || 'fullchem',
        startDate: body.startDate,
        endDate: body.endDate,
        spinupDays: body.spinupDays || 0,
        outputFrequency: body.outputFrequency || 'daily',
        useSpot: body.useSpot !== undefined ? body.useSpot : true,
        nodes: body.nodes || 1
      },

      // S3 paths
      inputPath: `s3://${USERS_BUCKET}/${userId}/simulations/${simulationId}/input/`,
      outputPath: `s3://${USERS_BUCKET}/${userId}/simulations/${simulationId}/output/`,
      configPath: `s3://${USERS_BUCKET}/${userId}/simulations/${simulationId}/config.json`,

      // Metadata
      estimatedCost: body.estimatedCost || 0,
      estimatedRuntime: body.estimatedRuntime || 0,
      actualCost: 0,
      actualRuntime: 0
    };

    // Write to DynamoDB
    await docClient.send(new PutCommand({
      TableName: SIMULATIONS_TABLE,
      Item: simulation,
      ConditionExpression: 'attribute_not_exists(simulationId)'
    }));

    console.log(`Created simulation record: ${simulationId}`);

    // Start Step Functions workflow
    const executionInput = {
      userId,
      simulationId,
      configuration: simulation.configuration,
      inputPath: simulation.inputPath,
      outputPath: simulation.outputPath,
      configPath: simulation.configPath
    };

    const executionName = `sim-${simulationId}`;

    await sfnClient.send(new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      name: executionName,
      input: JSON.stringify(executionInput)
    }));

    console.log(`Started Step Functions execution: ${executionName}`);

    // Return success response
    return createResponse(201, {
      simulationId,
      userId,
      status: 'SUBMITTED',
      message: 'Simulation submitted successfully',
      executionName,
      simulation
    });

  } catch (error) {
    console.error('Error submitting simulation:', error);

    // Handle specific error types
    if (error.name === 'ConditionalCheckFailedException') {
      return createResponse(409, {
        error: 'Conflict',
        message: 'Simulation ID already exists'
      });
    }

    return createResponse(500, {
      error: 'Internal Server Error',
      message: error.message || 'Failed to submit simulation'
    });
  }
};

/**
 * Validate simulation configuration
 */
function validateSimulationConfig(config) {
  // Required fields
  if (!config.simulationType) {
    return 'simulationType is required';
  }

  if (!['GC_CLASSIC', 'GCHP'].includes(config.simulationType)) {
    return 'simulationType must be GC_CLASSIC or GCHP';
  }

  // GC Classic specific validation
  if (config.simulationType === 'GC_CLASSIC') {
    if (!config.resolution) {
      return 'resolution is required for GC_CLASSIC';
    }
    if (!['4x5', '2x2.5', '0.5x0.625', '0.25x0.3125'].includes(config.resolution)) {
      return 'Invalid resolution for GC_CLASSIC';
    }
  }

  // GCHP specific validation
  if (config.simulationType === 'GCHP') {
    if (!config.cubedsphereRes) {
      return 'cubedsphereRes is required for GCHP';
    }
    if (!['C24', 'C48', 'C90', 'C180', 'C360'].includes(config.cubedsphereRes)) {
      return 'Invalid cubedsphereRes for GCHP';
    }
    if (config.nodes && config.nodes < 1) {
      return 'nodes must be at least 1 for GCHP';
    }
  }

  // Date validation
  if (!config.startDate || !config.endDate) {
    return 'startDate and endDate are required';
  }

  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return 'Invalid date format';
  }

  if (endDate <= startDate) {
    return 'endDate must be after startDate';
  }

  // Chemistry option validation
  const validChemistryOptions = ['fullchem', 'aerosol', 'CH4', 'CO2', 'transport'];
  if (config.chemistryOption && !validChemistryOptions.includes(config.chemistryOption)) {
    return `chemistryOption must be one of: ${validChemistryOptions.join(', ')}`;
  }

  // Processor type validation
  const validProcessorTypes = ['graviton3', 'graviton4', 'intel', 'amd'];
  if (config.processorType && !validProcessorTypes.includes(config.processorType)) {
    return `processorType must be one of: ${validProcessorTypes.join(', ')}`;
  }

  // Instance size validation
  const validInstanceSizes = ['small', 'medium', 'large', 'xlarge'];
  if (config.instanceSize && !validInstanceSizes.includes(config.instanceSize)) {
    return `instanceSize must be one of: ${validInstanceSizes.join(', ')}`;
  }

  return null; // No validation errors
}

/**
 * Create HTTP response
 */
function createResponse(statusCode, body) {
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
