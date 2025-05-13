/**
 * submit-batch-job.js
 * Lambda function to submit a job to AWS Batch
 */

const AWS = require('aws-sdk');
const batch = new AWS.Batch();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;
const JOB_QUEUE = process.env.JOB_QUEUE;

/**
 * Handler for the submit-batch-job Lambda function
 */
exports.handler = async (event) => {
  console.log('Submit Batch Job Handler - Event:', JSON.stringify(event));
  
  try {
    const { simulationId, userId, validatedConfig, configLocation, outputLocation } = event;
    
    if (!simulationId || !userId || !validatedConfig || !configLocation || !outputLocation) {
      throw new Error('Missing required parameters');
    }
    
    // Select appropriate job definition based on instance type
    const jobDefinition = determineJobDefinition(validatedConfig.instanceType);
    
    // Set up job environment variables
    const envVars = [
      { name: 'SIMULATION_ID', value: simulationId },
      { name: 'USER_ID', value: userId },
      { name: 'OMP_NUM_THREADS', value: getThreadCount(validatedConfig.instanceType).toString() }
    ];
    
    // If custom parameters are provided, add them to environment variables
    if (validatedConfig.environmentVariables) {
      for (const [key, value] of Object.entries(validatedConfig.environmentVariables)) {
        envVars.push({ name: key, value: value.toString() });
      }
    }
    
    // Submit job to AWS Batch
    const jobParams = {
      jobName: `geos-chem-${simulationId}`,
      jobQueue: JOB_QUEUE,
      jobDefinition: jobDefinition,
      containerOverrides: {
        command: [configLocation, outputLocation, ''],
        environment: envVars,
        resourceRequirements: [
          {
            type: 'VCPU',
            value: getVCpuCount(validatedConfig.instanceType).toString()
          },
          {
            type: 'MEMORY',
            value: getMemorySize(validatedConfig.instanceType).toString()
          }
        ]
      },
      timeout: {
        attemptDurationSeconds: calculateTimeout(validatedConfig)
      }
    };
    
    // Submit job to AWS Batch
    console.log('Submitting job to AWS Batch with params:', JSON.stringify(jobParams));
    const batchResponse = await batch.submitJob(jobParams).promise();
    console.log('Batch response:', JSON.stringify(batchResponse));
    
    // Update simulation status in DynamoDB
    await dynamoDB.update({
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId: userId,
        simulationId: simulationId
      },
      UpdateExpression: 'SET #status = :status, batchJobId = :jobId, statusDetails = :details, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'RUNNING',
        ':jobId': batchResponse.jobId,
        ':details': 'Job submitted to AWS Batch',
        ':updatedAt': new Date().toISOString()
      }
    }).promise();
    
    // Return job details
    return {
      ...event,
      batchJobId: batchResponse.jobId,
      jobStatus: 'SUBMITTED'
    };
    
  } catch (error) {
    console.error('Error submitting batch job:', error);
    throw error;
  }
};

/**
 * Determine the appropriate job definition based on instance type
 * @param {string} instanceType - AWS instance type
 * @returns {string} - Job definition ARN
 */
function determineJobDefinition(instanceType) {
  // In a real implementation, these would be environment variables
  // or retrieved from a configuration store
  
  // Check if Graviton (ARM64) instance
  if (instanceType.startsWith('c7g') || instanceType.startsWith('m7g') || instanceType.startsWith('r7g')) {
    return 'geos-chem-graviton:1'; // This would be the full ARN in production
  } else {
    return 'geos-chem-x86:1'; // This would be the full ARN in production
  }
}

/**
 * Get the appropriate thread count for an instance type
 * @param {string} instanceType - AWS instance type
 * @returns {number} - Thread count
 */
function getThreadCount(instanceType) {
  // This mapping would be more complete in a production implementation
  const threadMapping = {
    'c7g.8xlarge': 32,
    'c7g.16xlarge': 64,
    'c6i.8xlarge': 32,
    'c6i.16xlarge': 64,
    'c6a.8xlarge': 32,
    'c6a.16xlarge': 64
  };
  
  return threadMapping[instanceType] || 4; // Default to 4 threads
}

/**
 * Get the appropriate vCPU count for an instance type
 * @param {string} instanceType - AWS instance type
 * @returns {number} - vCPU count
 */
function getVCpuCount(instanceType) {
  // The CPU counts would match the instance types
  return getThreadCount(instanceType);
}

/**
 * Get the appropriate memory size for an instance type
 * @param {string} instanceType - AWS instance type
 * @returns {number} - Memory size in MB
 */
function getMemorySize(instanceType) {
  const memoryMapping = {
    'c7g.8xlarge': 64000,  // 64 GB
    'c7g.16xlarge': 128000, // 128 GB
    'c6i.8xlarge': 64000,
    'c6i.16xlarge': 128000,
    'c6a.8xlarge': 64000,
    'c6a.16xlarge': 128000
  };
  
  return memoryMapping[instanceType] || 8000; // Default to 8 GB
}

/**
 * Calculate timeout duration for batch job based on configuration
 * @param {Object} config - Validated configuration
 * @returns {number} - Timeout in seconds
 */
function calculateTimeout(config) {
  // Basic timeout calculation - would be more sophisticated in production
  const baseDurationPerDay = 3600; // 1 hour per simulation day
  const durationDays = parseInt(config.durationDays) || 7;
  
  // Adjust for simulation type
  let typeMultiplier = 1.0;
  switch (config.simulationType) {
    case 'transport':
      typeMultiplier = 0.5; // Transport simulations are faster
      break;
    case 'aerosol':
      typeMultiplier = 0.8; // Aerosol simulations are somewhat faster
      break;
    case 'fullchem':
    default:
      typeMultiplier = 1.0;
  }
  
  // Add safety margin of 50%
  const safetyMargin = 1.5;
  
  // Calculate total seconds
  const timeoutSeconds = Math.ceil(baseDurationPerDay * durationDays * typeMultiplier * safetyMargin);
  
  // Cap at 24 hours (86400 seconds)
  return Math.min(timeoutSeconds, 86400);
}