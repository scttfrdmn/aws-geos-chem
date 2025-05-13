/**
 * auth-operations.js
 * Lambda function for custom authentication operations
 */

const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();

// Get configuration from environment variables
const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;

/**
 * Main handler for authentication operations
 */
exports.handler = async (event, context) => {
  console.log('Auth Operations Event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the HTTP method and path
    const httpMethod = event.httpMethod;
    const resource = event.resource;
    
    // Parse the request body if it exists
    let requestBody;
    if (event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (e) {
        return formatResponse(400, { message: 'Invalid request body' });
      }
    }
    
    // Handle different API endpoints
    if (resource === '/users' && httpMethod === 'POST') {
      // Create a new user
      return await createUser(requestBody);
    } else if (resource === '/users' && httpMethod === 'GET') {
      // List all users
      return await listUsers(event.queryStringParameters);
    } else if (resource === '/users/{userId}' && httpMethod === 'GET') {
      // Get a specific user
      return await getUser(event.pathParameters.userId);
    } else if (resource === '/users/{userId}' && httpMethod === 'PUT') {
      // Update a user
      return await updateUser(event.pathParameters.userId, requestBody);
    } else if (resource === '/users/{userId}' && httpMethod === 'DELETE') {
      // Delete a user
      return await deleteUser(event.pathParameters.userId);
    } else {
      // Unknown endpoint
      return formatResponse(404, { message: 'Not found' });
    }
  } catch (error) {
    console.error('Error in auth operation:', error);
    return formatResponse(500, { message: 'Internal server error', error: error.message });
  }
};

/**
 * Create a new user
 */
async function createUser(userData) {
  if (!userData || !userData.email || !userData.password) {
    return formatResponse(400, { message: 'Email and password are required' });
  }
  
  try {
    // Create the user in Cognito
    const params = {
      UserPoolId: USER_POOL_ID,
      Username: userData.email,
      TemporaryPassword: userData.password,
      MessageAction: 'SUPPRESS', // Don't send welcome email, we'll do it ourselves
      UserAttributes: [
        {
          Name: 'email',
          Value: userData.email
        },
        {
          Name: 'email_verified',
          Value: 'true'
        }
      ]
    };
    
    // Add optional attributes if provided
    if (userData.givenName) {
      params.UserAttributes.push({
        Name: 'given_name',
        Value: userData.givenName
      });
    }
    
    if (userData.familyName) {
      params.UserAttributes.push({
        Name: 'family_name',
        Value: userData.familyName
      });
    }
    
    if (userData.institution) {
      params.UserAttributes.push({
        Name: 'custom:institution',
        Value: userData.institution
      });
    }
    
    if (userData.researchArea) {
      params.UserAttributes.push({
        Name: 'custom:researchArea',
        Value: userData.researchArea
      });
    }
    
    if (userData.country) {
      params.UserAttributes.push({
        Name: 'custom:country',
        Value: userData.country
      });
    }
    
    const result = await cognito.adminCreateUser(params).promise();
    
    return formatResponse(201, {
      message: 'User created successfully',
      user: {
        username: result.User.Username,
        userStatus: result.User.UserStatus,
        created: result.User.UserCreateDate
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return formatResponse(500, { message: 'Error creating user', error: error.message });
  }
}

/**
 * List all users
 */
async function listUsers(queryParams) {
  try {
    const params = {
      UserPoolId: USER_POOL_ID,
      Limit: 60
    };
    
    // Add pagination token if provided
    if (queryParams && queryParams.paginationToken) {
      params.PaginationToken = queryParams.paginationToken;
    }
    
    // Add filter if provided
    if (queryParams && queryParams.filter) {
      params.Filter = queryParams.filter;
    }
    
    const result = await cognito.listUsers(params).promise();
    
    // Format the users
    const users = result.Users.map(user => {
      const userAttributes = {};
      
      // Convert attributes array to object
      user.Attributes.forEach(attr => {
        userAttributes[attr.Name] = attr.Value;
      });
      
      return {
        username: user.Username,
        enabled: user.Enabled,
        userStatus: user.UserStatus,
        created: user.UserCreateDate,
        lastModified: user.UserLastModifiedDate,
        attributes: userAttributes
      };
    });
    
    return formatResponse(200, {
      users,
      paginationToken: result.PaginationToken
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return formatResponse(500, { message: 'Error listing users', error: error.message });
  }
}

/**
 * Get a specific user
 */
async function getUser(userId) {
  if (!userId) {
    return formatResponse(400, { message: 'User ID is required' });
  }
  
  try {
    const params = {
      UserPoolId: USER_POOL_ID,
      Username: userId
    };
    
    const result = await cognito.adminGetUser(params).promise();
    
    // Format the user
    const userAttributes = {};
    
    // Convert attributes array to object
    result.UserAttributes.forEach(attr => {
      userAttributes[attr.Name] = attr.Value;
    });
    
    const user = {
      username: result.Username,
      enabled: result.Enabled,
      userStatus: result.UserStatus,
      created: result.UserCreateDate,
      lastModified: result.UserLastModifiedDate,
      attributes: userAttributes
    };
    
    return formatResponse(200, { user });
  } catch (error) {
    if (error.code === 'UserNotFoundException') {
      return formatResponse(404, { message: 'User not found' });
    }
    
    console.error('Error getting user:', error);
    return formatResponse(500, { message: 'Error getting user', error: error.message });
  }
}

/**
 * Update a user
 */
async function updateUser(userId, userData) {
  if (!userId) {
    return formatResponse(400, { message: 'User ID is required' });
  }
  
  if (!userData) {
    return formatResponse(400, { message: 'User data is required' });
  }
  
  try {
    // Prepare the attributes to update
    const userAttributes = [];
    
    // Add attributes if provided
    if (userData.email) {
      userAttributes.push({
        Name: 'email',
        Value: userData.email
      });
      
      userAttributes.push({
        Name: 'email_verified',
        Value: 'true'
      });
    }
    
    if (userData.givenName) {
      userAttributes.push({
        Name: 'given_name',
        Value: userData.givenName
      });
    }
    
    if (userData.familyName) {
      userAttributes.push({
        Name: 'family_name',
        Value: userData.familyName
      });
    }
    
    if (userData.institution) {
      userAttributes.push({
        Name: 'custom:institution',
        Value: userData.institution
      });
    }
    
    if (userData.researchArea) {
      userAttributes.push({
        Name: 'custom:researchArea',
        Value: userData.researchArea
      });
    }
    
    if (userData.country) {
      userAttributes.push({
        Name: 'custom:country',
        Value: userData.country
      });
    }
    
    // Only update if there are attributes to update
    if (userAttributes.length > 0) {
      const params = {
        UserPoolId: USER_POOL_ID,
        Username: userId,
        UserAttributes: userAttributes
      };
      
      await cognito.adminUpdateUserAttributes(params).promise();
    }
    
    // Update password if provided
    if (userData.password) {
      const params = {
        UserPoolId: USER_POOL_ID,
        Username: userId,
        Password: userData.password,
        Permanent: true
      };
      
      await cognito.adminSetUserPassword(params).promise();
    }
    
    return formatResponse(200, { message: 'User updated successfully' });
  } catch (error) {
    if (error.code === 'UserNotFoundException') {
      return formatResponse(404, { message: 'User not found' });
    }
    
    console.error('Error updating user:', error);
    return formatResponse(500, { message: 'Error updating user', error: error.message });
  }
}

/**
 * Delete a user
 */
async function deleteUser(userId) {
  if (!userId) {
    return formatResponse(400, { message: 'User ID is required' });
  }
  
  try {
    const params = {
      UserPoolId: USER_POOL_ID,
      Username: userId
    };
    
    await cognito.adminDeleteUser(params).promise();
    
    return formatResponse(200, { message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === 'UserNotFoundException') {
      return formatResponse(404, { message: 'User not found' });
    }
    
    console.error('Error deleting user:', error);
    return formatResponse(500, { message: 'Error deleting user', error: error.message });
  }
}

/**
 * Format the API Gateway response
 */
function formatResponse(statusCode, body) {
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