/**
 * monitor-job-status.js
 *
 * Lambda function to monitor AWS Batch job status and collect metrics.
 * Called periodically by Step Functions to check job progress.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 */

const { BatchClient, DescribeJobsCommand } = require('@aws-sdk/client-batch');
const { CloudWatchLogsClient, GetLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS clients
const batchClient = new BatchClient({});
const cwLogsClient = new CloudWatchLogsClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Monitoring job status:', JSON.stringify(event, null, 2));

  const { userId, simulationId, batchJobId } = event;

  if (!batchJobId) {
    throw new Error('batchJobId is required');
  }

  try {
    // 1. Get job status from AWS Batch
    const jobDetails = await getJobDetails(batchJobId);

    // 2. Extract relevant information
    const jobStatus = jobDetails.status;
    const statusReason = jobDetails.statusReason;
    const startedAt = jobDetails.startedAt;
    const stoppedAt = jobDetails.stoppedAt;
    const exitCode = jobDetails.container?.exitCode;

    // 3. Calculate runtime if available
    let runtimeSeconds = null;
    if (startedAt && stoppedAt) {
      runtimeSeconds = Math.floor((stoppedAt - startedAt) / 1000);
    }

    // 4. Parse resource metrics
    const resourceMetrics = parseResourceMetrics(jobDetails);

    // 5. Get recent log entries if job is running or completed
    let recentLogs = [];
    if (jobDetails.container?.logStreamName) {
      try {
        recentLogs = await getRecentLogEntries(
          jobDetails.container.logStreamName,
          5 // Get last 5 log entries
        );
      } catch (error) {
        console.warn('Unable to fetch logs:', error.message);
      }
    }

    // 6. Update DynamoDB with current status
    await updateJobStatus(userId, simulationId, {
      jobStatus,
      statusReason,
      startedAt: startedAt ? new Date(startedAt).toISOString() : null,
      stoppedAt: stoppedAt ? new Date(stoppedAt).toISOString() : null,
      runtimeSeconds,
      exitCode,
      resourceMetrics,
      lastChecked: new Date().toISOString()
    });

    // 7. Return status for Step Functions decision making
    return {
      ...event,
      jobStatus,
      statusReason,
      runtimeSeconds,
      exitCode,
      resourceMetrics,
      recentLogs: recentLogs.slice(0, 3), // Include only 3 most recent for Step Functions
      isComplete: ['SUCCEEDED', 'FAILED'].includes(jobStatus),
      isRunning: ['SUBMITTED', 'PENDING', 'RUNNABLE', 'STARTING', 'RUNNING'].includes(jobStatus)
    };

  } catch (error) {
    console.error('Error monitoring job status:', error);

    // Update DynamoDB with error
    await updateJobStatus(userId, simulationId, {
      jobStatus: 'UNKNOWN',
      statusReason: `Monitoring error: ${error.message}`,
      lastChecked: new Date().toISOString()
    });

    throw error;
  }
};

/**
 * Get job details from AWS Batch
 */
async function getJobDetails(jobId) {
  const response = await batchClient.send(new DescribeJobsCommand({
    jobs: [jobId]
  }));

  if (!response.jobs || response.jobs.length === 0) {
    throw new Error(`Job not found: ${jobId}`);
  }

  return response.jobs[0];
}

/**
 * Parse resource metrics from job details
 */
function parseResourceMetrics(jobDetails) {
  const metrics = {
    vcpus: null,
    memoryMB: null,
    instanceType: null,
    containerInstanceArn: null
  };

  // Get allocated resources
  if (jobDetails.container) {
    metrics.vcpus = jobDetails.container.vcpus;
    metrics.memoryMB = jobDetails.container.memory;
    metrics.containerInstanceArn = jobDetails.container.containerInstanceArn;
  }

  // Get instance type from job attempts
  if (jobDetails.attempts && jobDetails.attempts.length > 0) {
    const latestAttempt = jobDetails.attempts[jobDetails.attempts.length - 1];
    if (latestAttempt.container?.taskArn) {
      // Instance type would be in task metadata, but we'll get it from tags if available
      metrics.instanceType = extractInstanceType(latestAttempt);
    }
  }

  // Get exit code from container
  if (jobDetails.container?.exitCode !== undefined) {
    metrics.exitCode = jobDetails.container.exitCode;
  }

  // Get resource utilization if available (from CloudWatch)
  // This would require additional API calls to CloudWatch Metrics
  // For now, we'll set placeholders
  metrics.cpuUtilization = null;
  metrics.memoryUtilization = null;

  return metrics;
}

/**
 * Extract instance type from attempt details
 */
function extractInstanceType(attempt) {
  // Try to extract from container details
  if (attempt.container?.reason) {
    const match = attempt.container.reason.match(/instance type: ([a-z0-9.]+)/i);
    if (match) {
      return match[1];
    }
  }

  // Try to extract from task ARN metadata
  // In practice, you'd need to call ECS DescribeTasks with the taskArn
  // For now, return null
  return null;
}

/**
 * Get recent log entries from CloudWatch Logs
 */
async function getRecentLogEntries(logStreamName, limit = 10) {
  const logGroupName = '/aws/batch/job'; // Default AWS Batch log group

  try {
    const response = await cwLogsClient.send(new GetLogEventsCommand({
      logGroupName,
      logStreamName,
      limit,
      startFromHead: false // Get most recent entries
    }));

    return (response.events || []).map(event => ({
      timestamp: new Date(event.timestamp).toISOString(),
      message: event.message
    }));

  } catch (error) {
    console.warn(`Unable to fetch logs from ${logGroupName}/${logStreamName}:`, error.message);
    return [];
  }
}

/**
 * Update job status in DynamoDB
 */
async function updateJobStatus(userId, simulationId, statusInfo) {
  const updateExpressions = [];
  const attributeNames = { '#status': 'status' };
  const attributeValues = { ':timestamp': new Date().toISOString() };

  // Build dynamic update expression based on available data
  if (statusInfo.jobStatus) {
    updateExpressions.push('jobStatus = :jobStatus');
    attributeValues[':jobStatus'] = statusInfo.jobStatus;

    // Map Batch status to simulation status
    const simStatus = mapBatchStatusToSimStatus(statusInfo.jobStatus);
    updateExpressions.push('#status = :status');
    attributeValues[':status'] = simStatus;
  }

  if (statusInfo.statusReason) {
    updateExpressions.push('statusReason = :statusReason');
    attributeValues[':statusReason'] = statusInfo.statusReason;
  }

  if (statusInfo.startedAt) {
    updateExpressions.push('startedAt = :startedAt');
    attributeValues[':startedAt'] = statusInfo.startedAt;
  }

  if (statusInfo.stoppedAt) {
    updateExpressions.push('stoppedAt = :stoppedAt');
    attributeValues[':stoppedAt'] = statusInfo.stoppedAt;
  }

  if (statusInfo.runtimeSeconds !== null) {
    updateExpressions.push('runtimeSeconds = :runtimeSeconds');
    attributeValues[':runtimeSeconds'] = statusInfo.runtimeSeconds;
  }

  if (statusInfo.exitCode !== undefined) {
    updateExpressions.push('exitCode = :exitCode');
    attributeValues[':exitCode'] = statusInfo.exitCode;
  }

  if (statusInfo.resourceMetrics) {
    updateExpressions.push('resourceMetrics = :resourceMetrics');
    attributeValues[':resourceMetrics'] = statusInfo.resourceMetrics;
  }

  if (statusInfo.lastChecked) {
    updateExpressions.push('lastChecked = :lastChecked');
    attributeValues[':lastChecked'] = statusInfo.lastChecked;
  }

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
 * Map AWS Batch status to simulation status
 */
function mapBatchStatusToSimStatus(batchStatus) {
  const statusMap = {
    'SUBMITTED': 'SUBMITTED',
    'PENDING': 'PENDING',
    'RUNNABLE': 'PENDING',
    'STARTING': 'RUNNING',
    'RUNNING': 'RUNNING',
    'SUCCEEDED': 'COMPLETED',
    'FAILED': 'FAILED'
  };

  return statusMap[batchStatus] || 'UNKNOWN';
}
