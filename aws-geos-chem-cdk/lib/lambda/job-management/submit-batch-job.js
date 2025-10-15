/**
 * submit-batch-job.js
 *
 * Lambda function to submit a validated simulation to AWS Batch.
 * Selects appropriate compute environment and job definition based on configuration.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 * - JOB_QUEUE_GRAVITON: Job queue for Graviton instances
 * - JOB_QUEUE_X86: Job queue for x86 instances
 * - ECR_REPOSITORY: ECR repository URI
 */

const { BatchClient, SubmitJobCommand } = require('@aws-sdk/client-batch');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS clients
const batchClient = new BatchClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;
const JOB_QUEUE_GRAVITON = process.env.JOB_QUEUE_GRAVITON || 'geos-chem-graviton-queue';
const JOB_QUEUE_X86 = process.env.JOB_QUEUE_X86 || 'geos-chem-x86-queue';
const ECR_REPOSITORY = process.env.ECR_REPOSITORY;
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';
const AWS_ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Submitting Batch job:', JSON.stringify(event, null, 2));

  const { userId, simulationId, configuration, inputPath, outputPath, configPath } = event;

  try {
    // 1. Select appropriate job queue and definition
    const { jobQueue, jobDefinition, containerImage } = selectJobResources(configuration);

    // 2. Determine resource requirements
    const { vcpus, memory } = calculateResourceRequirements(configuration);

    // 3. Build container command and environment
    const containerOverrides = buildContainerOverrides(
      configuration,
      inputPath,
      outputPath,
      configPath,
      vcpus,
      memory
    );

    // 4. Submit job to AWS Batch
    const jobName = `geos-chem-${simulationId.substring(0, 8)}`;

    const submitParams = {
      jobName,
      jobQueue,
      jobDefinition,
      containerOverrides,
      timeout: {
        attemptDurationSeconds: calculateTimeout(configuration)
      },
      tags: {
        userId,
        simulationId,
        simulationType: configuration.simulationType,
        processorType: configuration.processorType
      }
    };

    // Add multi-node configuration for GCHP
    if (configuration.simulationType === 'GCHP' && configuration.nodes > 1) {
      submitParams.nodeOverrides = {
        numNodes: configuration.nodes,
        nodePropertyOverrides: [
          {
            targetNodes: '0:',
            containerOverrides: containerOverrides
          }
        ]
      };
    }

    console.log('Submitting job with params:', JSON.stringify(submitParams, null, 2));

    const response = await batchClient.send(new SubmitJobCommand(submitParams));

    const jobId = response.jobId;
    const jobArn = response.jobArn;

    console.log(`Batch job submitted: ${jobId}`);

    // 5. Update DynamoDB with job information
    await updateSimulationWithJobInfo(userId, simulationId, jobId, jobArn, jobQueue, jobDefinition);

    // Return job information for Step Functions
    return {
      ...event,
      batchJobId: jobId,
      batchJobArn: jobArn,
      jobQueue,
      jobDefinition,
      jobStatus: 'SUBMITTED',
      submittedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error submitting Batch job:', error);

    // Update DynamoDB with error
    await updateSimulationStatus(userId, simulationId, 'FAILED', `Job submission failed: ${error.message}`);

    throw error;
  }
};

/**
 * Select job resources based on configuration
 */
function selectJobResources(config) {
  const processorType = config.processorType || 'graviton3';
  const simulationType = config.simulationType;

  // Determine job queue based on processor
  let jobQueue;
  if (processorType.startsWith('graviton')) {
    jobQueue = JOB_QUEUE_GRAVITON;
  } else {
    jobQueue = JOB_QUEUE_X86;
  }

  // Determine job definition (for now use a standard definition)
  // In production, you might have multiple definitions for different configurations
  let jobDefinition;
  if (simulationType === 'GCHP' && config.nodes > 1) {
    jobDefinition = `geos-chem-gchp-multinode-${processorType}`;
  } else if (simulationType === 'GCHP') {
    jobDefinition = `geos-chem-gchp-${processorType}`;
  } else {
    jobDefinition = `geos-chem-classic-${processorType}`;
  }

  // Determine container image
  const architecture = processorType.startsWith('graviton') ? 'arm64' : 'amd64';
  const containerImage = ECR_REPOSITORY
    ? `${ECR_REPOSITORY}:latest-${architecture}`
    : `${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/geos-chem:latest-${architecture}`;

  return { jobQueue, jobDefinition, containerImage };
}

/**
 * Calculate resource requirements
 */
function calculateResourceRequirements(config) {
  let vcpus = 16;
  let memory = 32768; // MB

  // Base on instance size
  switch (config.instanceSize) {
    case 'small':
      vcpus = 4;
      memory = 8192;
      break;
    case 'medium':
      vcpus = 16;
      memory = 32768;
      break;
    case 'large':
      vcpus = 32;
      memory = 65536;
      break;
    case 'xlarge':
      vcpus = 64;
      memory = 131072;
      break;
  }

  // Adjust for memory type
  if (config.memory === 'high') {
    memory = Math.floor(memory * 1.5);
  }

  // Adjust for resolution (high-resolution needs more memory)
  if (config.resolution === '0.25x0.3125' || config.cubedsphereRes === 'C360') {
    memory = Math.floor(memory * 1.5);
  }

  return { vcpus, memory };
}

/**
 * Build container overrides
 */
function buildContainerOverrides(config, inputPath, outputPath, configPath, vcpus, memory) {
  // Build configuration JSON to pass to container
  const simConfig = {
    simulationType: config.simulationType,
    resolution: config.resolution,
    cubedsphereRes: config.cubedsphereRes,
    chemistryOption: config.chemistryOption,
    startDate: config.startDate,
    endDate: config.endDate,
    spinupDays: config.spinupDays,
    outputFrequency: config.outputFrequency,
    nodes: config.nodes
  };

  return {
    vcpus,
    memory,
    command: [
      '--config', JSON.stringify(simConfig),
      '--input-path', inputPath,
      '--output-path', outputPath,
      '--config-path', configPath
    ],
    environment: [
      {
        name: 'SIMULATION_TYPE',
        value: config.simulationType
      },
      {
        name: 'RESOLUTION',
        value: config.resolution || config.cubedsphereRes || '4x5'
      },
      {
        name: 'CHEMISTRY',
        value: config.chemistryOption || 'fullchem'
      },
      {
        name: 'OMP_NUM_THREADS',
        value: vcpus.toString()
      },
      {
        name: 'OMP_STACKSIZE',
        value: '500m'
      },
      {
        name: 'AWS_DEFAULT_REGION',
        value: AWS_REGION
      }
    ]
  };
}

/**
 * Calculate job timeout based on configuration
 */
function calculateTimeout(config) {
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  // Estimate: 1 hour per simulation day for baseline, adjust for resolution
  let hoursPerDay = 1;

  if (config.resolution === '4x5') hoursPerDay = 0.5;
  if (config.resolution === '2x2.5') hoursPerDay = 1;
  if (config.resolution === '0.5x0.625') hoursPerDay = 2;
  if (config.resolution === '0.25x0.3125') hoursPerDay = 4;

  // GCHP adjustments
  if (config.simulationType === 'GCHP') {
    if (config.cubedsphereRes === 'C24') hoursPerDay = 0.5;
    if (config.cubedsphereRes === 'C48') hoursPerDay = 1;
    if (config.cubedsphereRes === 'C90') hoursPerDay = 2;
    if (config.cubedsphereRes === 'C180') hoursPerDay = 4;
    if (config.cubedsphereRes === 'C360') hoursPerDay = 8;
  }

  // Calculate total timeout with safety margin
  const estimatedHours = durationDays * hoursPerDay;
  const timeoutHours = Math.ceil(estimatedHours * 1.5); // 50% safety margin
  const timeoutSeconds = Math.min(timeoutHours * 3600, 172800); // Max 48 hours

  return timeoutSeconds;
}

/**
 * Update simulation record with job information
 */
async function updateSimulationWithJobInfo(userId, simulationId, jobId, jobArn, jobQueue, jobDefinition) {
  await docClient.send(new UpdateCommand({
    TableName: SIMULATIONS_TABLE,
    Key: { userId, simulationId },
    UpdateExpression:
      'SET #status = :status, batchJobId = :jobId, batchJobArn = :jobArn, ' +
      'jobQueue = :jobQueue, jobDefinition = :jobDefinition, ' +
      'submittedAt = :timestamp, updatedAt = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': 'RUNNING',
      ':jobId': jobId,
      ':jobArn': jobArn,
      ':jobQueue': jobQueue,
      ':jobDefinition': jobDefinition,
      ':timestamp': new Date().toISOString()
    }
  }));
}

/**
 * Update simulation status
 */
async function updateSimulationStatus(userId, simulationId, status, statusDetails) {
  await docClient.send(new UpdateCommand({
    TableName: SIMULATIONS_TABLE,
    Key: { userId, simulationId },
    UpdateExpression: 'SET #status = :status, statusDetails = :details, updatedAt = :timestamp',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':details': statusDetails,
      ':timestamp': new Date().toISOString()
    }
  }));
}
