/**
 * update-simulation-status.js
 * Lambda function to update simulation status in DynamoDB
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

/**
 * Handler for the update-simulation-status Lambda function
 */
exports.handler = async (event) => {
  console.log('Update Simulation Status Handler - Event:', JSON.stringify(event));
  
  try {
    const { simulationId, userId, status, statusDetails } = event;
    
    if (!simulationId || !userId || !status) {
      throw new Error('Missing required parameters: simulationId, userId, status');
    }
    
    // Update simulation status in DynamoDB
    const updateParams = {
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId,
        simulationId
      },
      UpdateExpression: 'SET #status = :status, statusDetails = :details, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':details': statusDetails || '',
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    // If status is COMPLETED, update progress to 100%
    if (status === 'COMPLETED') {
      updateParams.UpdateExpression += ', progress = :progress';
      updateParams.ExpressionAttributeValues[':progress'] = 100;
    }
    
    // Add completion time for terminal statuses
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      updateParams.UpdateExpression += ', completedAt = :completedAt';
      updateParams.ExpressionAttributeValues[':completedAt'] = new Date().toISOString();
    }
    
    const result = await dynamoDB.update(updateParams).promise();
    
    // Return the updated item
    return {
      ...event,
      updatedSimulation: result.Attributes
    };
    
  } catch (error) {
    console.error('Error updating simulation status:', error);
    throw error;
  }
};

// Utility function to validate status enum
function isValidStatus(status) {
  const validStatuses = [
    'SUBMITTED',
    'VALIDATING',
    'QUEUED',
    'RUNNING',
    'PROCESSING_RESULTS',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  ];
  
  return validStatuses.includes(status);
}