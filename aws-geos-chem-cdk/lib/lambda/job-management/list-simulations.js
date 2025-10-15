/**
 * list-simulations.js
 *
 * Lambda function to list all simulations for a user.
 * Supports filtering by status and pagination.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('List simulations request:', JSON.stringify(event, null, 2));

  try {
    // Extract user ID from Cognito authorizer context
    const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';

    // Extract query parameters
    const queryParams = event.queryStringParameters || {};
    const statusFilter = queryParams.status;
    const limit = parseInt(queryParams.limit || '50', 10);
    const nextToken = queryParams.nextToken;

    // Build query parameters
    const queryInput = {
      TableName: SIMULATIONS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      Limit: limit,
      ScanIndexForward: false // Return most recent first
    };

    // Add status filter if provided
    if (statusFilter) {
      queryInput.FilterExpression = '#status = :status';
      queryInput.ExpressionAttributeNames = {
        '#status': 'status'
      };
      queryInput.ExpressionAttributeValues[':status'] = statusFilter;
    }

    // Add pagination token if provided
    if (nextToken) {
      try {
        queryInput.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString('utf-8'));
      } catch (error) {
        console.error('Invalid nextToken:', error);
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Invalid nextToken parameter'
          })
        };
      }
    }

    // Query DynamoDB
    const response = await docClient.send(new QueryCommand(queryInput));

    // Build response
    const result = {
      simulations: response.Items || [],
      count: (response.Items || []).length
    };

    // Add pagination token if there are more results
    if (response.LastEvaluatedKey) {
      result.nextToken = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
    }

    console.log(`Retrieved ${result.count} simulations for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Error listing simulations:', error);

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
