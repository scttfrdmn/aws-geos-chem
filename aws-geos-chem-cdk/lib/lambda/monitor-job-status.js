/**
 * monitor-job-status.js
 * Lambda function to monitor the status of AWS Batch jobs
 */

const AWS = require('aws-sdk');
const batch = new AWS.Batch();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

/**
 * Handler for the monitor-job-status Lambda function
 */
exports.handler = async (event) => {
  console.log('Monitor Job Status Handler - Event:', JSON.stringify(event));
  
  try {
    const { simulationId, userId, batchJobId } = event;
    
    if (!simulationId || !userId || !batchJobId) {
      throw new Error('Missing required parameters');
    }
    
    // Get job details from AWS Batch
    const jobResponse = await batch.describeJobs({
      jobs: [batchJobId]
    }).promise();
    
    if (!jobResponse.jobs || jobResponse.jobs.length === 0) {
      throw new Error(`Job not found: ${batchJobId}`);
    }
    
    const job = jobResponse.jobs[0];
    const jobStatus = job.status;
    console.log(`Job ${batchJobId} status: ${jobStatus}`);
    
    // Update simulation status in DynamoDB
    await updateSimulationStatus(userId, simulationId, jobStatus, job);
    
    // Return job status for step function
    return {
      ...event,
      jobStatus,
      jobDetails: {
        startedAt: job.startedAt,
        stoppedAt: job.stoppedAt,
        statusReason: job.statusReason || '',
        container: {
          exitCode: job.container?.exitCode,
          reason: job.container?.reason || ''
        }
      }
    };
    
  } catch (error) {
    console.error('Error monitoring job status:', error);
    throw error;
  }
};

/**
 * Update simulation status in DynamoDB
 * @param {string} userId - User ID
 * @param {string} simulationId - Simulation ID
 * @param {string} jobStatus - AWS Batch job status
 * @param {Object} job - AWS Batch job details
 */
async function updateSimulationStatus(userId, simulationId, jobStatus, job) {
  let status = '';
  let statusDetails = '';
  
  // Map Batch job status to simulation status
  switch (jobStatus) {
    case 'SUBMITTED':
    case 'PENDING':
    case 'RUNNABLE':
      status = 'QUEUED';
      statusDetails = 'Simulation is queued for execution';
      break;
    case 'STARTING':
    case 'RUNNING':
      status = 'RUNNING';
      statusDetails = 'Simulation is currently running';
      break;
    case 'SUCCEEDED':
      status = 'PROCESSING_RESULTS';
      statusDetails = 'Simulation completed, processing results';
      break;
    case 'FAILED':
      status = 'FAILED';
      statusDetails = job.container?.reason || job.statusReason || 'Simulation failed';
      break;
    default:
      status = 'UNKNOWN';
      statusDetails = `Unknown status: ${jobStatus}`;
  }
  
  // Calculate progress if running
  let progress = 0;
  if (jobStatus === 'RUNNING' && job.startedAt) {
    // This is a simple estimate - in a real implementation, you might
    // parse logs or use other metrics to determine actual progress
    const now = Date.now();
    const startTime = job.startedAt;
    const runTime = now - startTime;
    
    // Get expected duration from DynamoDB
    const simulationData = await dynamoDB.get({
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId,
        simulationId
      }
    }).promise();
    
    if (simulationData.Item && simulationData.Item.expectedDurationMs) {
      const expectedDuration = simulationData.Item.expectedDurationMs;
      progress = Math.min(Math.floor((runTime / expectedDuration) * 100), 99);
    } else {
      // Default to time-based estimate if no expected duration
      // Assume max job time is 24 hours
      const maxJobTimeMs = 24 * 60 * 60 * 1000;
      progress = Math.min(Math.floor((runTime / maxJobTimeMs) * 100), 99);
    }
  } else if (jobStatus === 'SUCCEEDED') {
    progress = 100;
  }
  
  // Update DynamoDB
  await dynamoDB.update({
    TableName: SIMULATIONS_TABLE,
    Key: {
      userId,
      simulationId
    },
    UpdateExpression: 'SET #status = :status, statusDetails = :details, progress = :progress, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': status,
      ':details': statusDetails,
      ':progress': progress,
      ':updatedAt': new Date().toISOString()
    }
  }).promise();
}