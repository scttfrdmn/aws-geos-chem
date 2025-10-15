/**
 * get-simulation.js
 *
 * Lambda function to retrieve a specific simulation by ID.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Get simulation request:', JSON.stringify(event, null, 2));

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

    // Query DynamoDB for the simulation
    const response = await docClient.send(new GetCommand({
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId,
        simulationId
      }
    }));

    if (!response.Item) {
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

    console.log('Simulation retrieved successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response.Item)
    };

  } catch (error) {
    console.error('Error retrieving simulation:', error);

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
