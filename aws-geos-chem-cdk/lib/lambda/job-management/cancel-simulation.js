/**
 * cancel-simulation.js
 *
 * Lambda function to cancel a running simulation.
 * Stops the Step Functions execution and terminates the AWS Batch job.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { SFNClient, StopExecutionCommand } = require('@aws-sdk/client-sfn');
const { BatchClient, TerminateJobCommand } = require('@aws-sdk/client-batch');

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const sfnClient = new SFNClient({});
const batchClient = new BatchClient({});

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Cancel simulation request:', JSON.stringify(event, null, 2));

  try {
    // Extract user ID from Cognito authorizer context
    const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';

    // Extract simulation ID from path parameters
    const simulationId = event.pathParameters?.simulationId;

    if (!simulationId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Missing simulationId parameter'
        })
      };
    }

    // Get the simulation from DynamoDB
    const getResponse = await docClient.send(new GetCommand({
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId,
        simulationId
      }
    }));

    if (!getResponse.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Simulation not found'
        })
      };
    }

    const simulation = getResponse.Item;

    // Check if simulation can be cancelled
    const cancellableStatuses = ['SUBMITTED', 'PENDING', 'RUNNABLE', 'STARTING', 'RUNNING'];
    if (!cancellableStatuses.includes(simulation.status)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: `Cannot cancel simulation in ${simulation.status} status`,
          currentStatus: simulation.status
        })
      };
    }

    // Stop Step Functions execution if exists
    if (simulation.executionArn) {
      try {
        await sfnClient.send(new StopExecutionCommand({
          executionArn: simulation.executionArn,
          cause: 'User requested cancellation'
        }));
        console.log(`Stopped Step Functions execution: ${simulation.executionArn}`);
      } catch (error) {
        console.warn('Error stopping Step Functions execution:', error.message);
        // Continue with cancellation even if Step Functions stop fails
      }
    }

    // Terminate AWS Batch job if exists
    if (simulation.batchJobId) {
      try {
        await batchClient.send(new TerminateJobCommand({
          jobId: simulation.batchJobId,
          reason: 'User requested cancellation'
        }));
        console.log(`Terminated Batch job: ${simulation.batchJobId}`);
      } catch (error) {
        console.warn('Error terminating Batch job:', error.message);
        // Continue with status update even if Batch termination fails
      }
    }

    // Update simulation status in DynamoDB
    await docClient.send(new UpdateCommand({
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId,
        simulationId
      },
      UpdateExpression: 'SET #status = :status, statusDetails = :details, updatedAt = :timestamp, cancelledAt = :timestamp',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'CANCELLED',
        ':details': 'Cancelled by user',
        ':timestamp': new Date().toISOString()
      }
    }));

    console.log(`Simulation ${simulationId} cancelled successfully`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Simulation cancelled successfully',
        simulationId,
        status: 'CANCELLED'
      })
    };

  } catch (error) {
    console.error('Error cancelling simulation:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
