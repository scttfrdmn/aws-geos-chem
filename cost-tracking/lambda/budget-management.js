/**
 * budget-management.js
 * Lambda function to manage user budgets for GEOS-Chem simulations
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

// Get environment variables
const BUDGET_TABLE = process.env.BUDGET_TABLE;
const COST_TABLE = process.env.COST_TABLE;
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN;

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Budget Management - Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract HTTP method and path
    const httpMethod = event.httpMethod;
    const resource = event.resource;
    const pathParameters = event.pathParameters || {};
    
    // Parse request body if present
    let requestBody;
    if (event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (e) {
        return formatResponse(400, { message: 'Invalid request body' });
      }
    }
    
    // Get userId from request context (assuming API Gateway authorization)
    let userId;
    if (event.requestContext && event.requestContext.authorizer && event.requestContext.authorizer.claims) {
      userId = event.requestContext.authorizer.claims.sub;
    } else if (requestBody && requestBody.userId) {
      // For testing, allow userId in body
      userId = requestBody.userId;
    } else {
      return formatResponse(401, { message: 'Unauthorized - User identity not found' });
    }
    
    // Handle different endpoints
    if (resource === '/budgets' && httpMethod === 'GET') {
      // List all budgets for a user
      return await listBudgets(userId, event.queryStringParameters);
    } else if (resource === '/budgets' && httpMethod === 'POST') {
      // Create a new budget
      return await createBudget(userId, requestBody);
    } else if (resource === '/budgets/{budgetId}' && httpMethod === 'GET') {
      // Get a specific budget
      return await getBudget(userId, pathParameters.budgetId);
    } else if (resource === '/budgets/{budgetId}' && httpMethod === 'PUT') {
      // Update a budget
      return await updateBudget(userId, pathParameters.budgetId, requestBody);
    } else if (resource === '/budgets/{budgetId}' && httpMethod === 'DELETE') {
      // Delete a budget
      return await deleteBudget(userId, pathParameters.budgetId);
    } else {
      return formatResponse(404, { message: 'Not found' });
    }
  } catch (error) {
    console.error('Error in budget management:', error);
    return formatResponse(500, {
      message: 'Error processing budget operation',
      error: error.message
    });
  }
};

/**
 * List all budgets for a user
 */
async function listBudgets(userId, queryParams) {
  try {
    // Define query parameters
    const params = {
      TableName: BUDGET_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId
      }
    };
    
    // Add filter for active/inactive budgets if specified
    if (queryParams && queryParams.status) {
      params.FilterExpression = 'budgetStatus = :status';
      params.ExpressionAttributeValues[':status'] = queryParams.status;
    }
    
    // Query the budgets
    const result = await dynamoDB.query(params).promise();
    
    // For each budget, get the current usage
    const budgets = [];
    for (const budget of result.Items) {
      // Get current usage if it's a monthly budget for the current month
      if (budget.timePeriod === 'MONTHLY' && isCurrentMonth(budget.periodStart, budget.periodEnd)) {
        const currentUsage = await getBudgetUsage(userId, budget.periodStart.substring(0, 7));
        budget.currentUsage = currentUsage;
        budget.percentUsed = calculatePercentage(currentUsage, budget.amount);
      }
      
      budgets.push(budget);
    }
    
    // Return the budgets
    return formatResponse(200, {
      message: 'Budgets retrieved successfully',
      budgets
    });
  } catch (error) {
    console.error('Error listing budgets:', error);
    throw error;
  }
}

/**
 * Create a new budget
 */
async function createBudget(userId, budgetData) {
  try {
    if (!budgetData.name || !budgetData.amount || !budgetData.timePeriod) {
      return formatResponse(400, {
        message: 'Missing required fields: name, amount, timePeriod'
      });
    }
    
    // Generate a unique budget ID
    const budgetId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Determine budget period
    let periodStart, periodEnd;
    if (budgetData.timePeriod === 'MONTHLY') {
      // Default to current month if not specified
      if (budgetData.periodStart) {
        periodStart = budgetData.periodStart;
      } else {
        const now = new Date();
        periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      }
      
      // Calculate end date (last day of the month)
      const year = parseInt(periodStart.substring(0, 4));
      const month = parseInt(periodStart.substring(5, 7));
      const lastDay = new Date(year, month, 0).getDate();
      periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // For other time periods, use the provided dates
      periodStart = budgetData.periodStart || timestamp.substring(0, 10);
      periodEnd = budgetData.periodEnd || '';
    }
    
    // Create budget record
    const budget = {
      userId,
      budgetId,
      name: budgetData.name,
      description: budgetData.description || '',
      amount: parseFloat(budgetData.amount),
      timePeriod: budgetData.timePeriod,
      periodStart,
      periodEnd,
      alertThreshold: parseFloat(budgetData.alertThreshold || 80),
      budgetStatus: 'ACTIVE',
      createdAt: timestamp,
      updatedAt: timestamp,
      alertEnabled: budgetData.alertEnabled !== false
    };
    
    // Save to DynamoDB
    await dynamoDB.put({
      TableName: BUDGET_TABLE,
      Item: budget
    }).promise();
    
    // Return the created budget
    return formatResponse(201, {
      message: 'Budget created successfully',
      budget
    });
  } catch (error) {
    console.error('Error creating budget:', error);
    throw error;
  }
}

/**
 * Get a specific budget with current usage
 */
async function getBudget(userId, budgetId) {
  try {
    if (!budgetId) {
      return formatResponse(400, { message: 'Budget ID is required' });
    }
    
    // Get the budget
    const params = {
      TableName: BUDGET_TABLE,
      Key: {
        userId,
        budgetId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return formatResponse(404, { message: 'Budget not found' });
    }
    
    const budget = result.Item;
    
    // Get current usage if it's a monthly budget for the current month
    if (budget.timePeriod === 'MONTHLY' && isCurrentMonth(budget.periodStart, budget.periodEnd)) {
      const currentUsage = await getBudgetUsage(userId, budget.periodStart.substring(0, 7));
      budget.currentUsage = currentUsage;
      budget.percentUsed = calculatePercentage(currentUsage, budget.amount);
    }
    
    return formatResponse(200, {
      message: 'Budget retrieved successfully',
      budget
    });
  } catch (error) {
    console.error('Error getting budget:', error);
    throw error;
  }
}

/**
 * Update a budget
 */
async function updateBudget(userId, budgetId, budgetData) {
  try {
    if (!budgetId) {
      return formatResponse(400, { message: 'Budget ID is required' });
    }
    
    // Check if budget exists
    const params = {
      TableName: BUDGET_TABLE,
      Key: {
        userId,
        budgetId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return formatResponse(404, { message: 'Budget not found' });
    }
    
    const existingBudget = result.Item;
    const timestamp = new Date().toISOString();
    
    // Prepare update expression and attributes
    let updateExpression = 'SET updatedAt = :updatedAt';
    const expressionAttributeValues = {
      ':updatedAt': timestamp
    };
    
    // Update fields if provided
    if (budgetData.name) {
      updateExpression += ', #name = :name';
      expressionAttributeValues[':name'] = budgetData.name;
    }
    
    if (budgetData.description !== undefined) {
      updateExpression += ', description = :desc';
      expressionAttributeValues[':desc'] = budgetData.description;
    }
    
    if (budgetData.amount) {
      updateExpression += ', amount = :amount';
      expressionAttributeValues[':amount'] = parseFloat(budgetData.amount);
    }
    
    if (budgetData.alertThreshold) {
      updateExpression += ', alertThreshold = :threshold';
      expressionAttributeValues[':threshold'] = parseFloat(budgetData.alertThreshold);
    }
    
    if (budgetData.budgetStatus) {
      updateExpression += ', budgetStatus = :status';
      expressionAttributeValues[':status'] = budgetData.budgetStatus;
    }
    
    if (budgetData.alertEnabled !== undefined) {
      updateExpression += ', alertEnabled = :alertEnabled';
      expressionAttributeValues[':alertEnabled'] = budgetData.alertEnabled;
    }
    
    // Update the budget
    const updateParams = {
      TableName: BUDGET_TABLE,
      Key: {
        userId,
        budgetId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    // Add ExpressionAttributeNames if needed
    if (budgetData.name) {
      updateParams.ExpressionAttributeNames = {
        '#name': 'name'
      };
    }
    
    const updateResult = await dynamoDB.update(updateParams).promise();
    
    return formatResponse(200, {
      message: 'Budget updated successfully',
      budget: updateResult.Attributes
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    throw error;
  }
}

/**
 * Delete a budget
 */
async function deleteBudget(userId, budgetId) {
  try {
    if (!budgetId) {
      return formatResponse(400, { message: 'Budget ID is required' });
    }
    
    // Delete the budget
    const params = {
      TableName: BUDGET_TABLE,
      Key: {
        userId,
        budgetId
      }
    };
    
    await dynamoDB.delete(params).promise();
    
    return formatResponse(200, {
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting budget:', error);
    throw error;
  }
}

/**
 * Get usage for a budget period
 */
async function getBudgetUsage(userId, monthStr) {
  try {
    const params = {
      TableName: COST_TABLE,
      IndexName: 'ByTimePeriod',
      KeyConditionExpression: 'timePeriod = :tp AND userId = :uid',
      ExpressionAttributeValues: {
        ':tp': monthStr,
        ':uid': userId
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    
    // Sum all costs
    let totalCost = 0;
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        totalCost += parseFloat(item.cost) || 0;
      }
    }
    
    return totalCost;
  } catch (error) {
    console.error('Error getting budget usage:', error);
    return 0;
  }
}

/**
 * Check if a period includes the current month
 */
function isCurrentMonth(startDate, endDate) {
  if (!startDate) return false;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const startYear = parseInt(startDate.substring(0, 4));
  const startMonth = parseInt(startDate.substring(5, 7));
  
  if (endDate) {
    const endYear = parseInt(endDate.substring(0, 4));
    const endMonth = parseInt(endDate.substring(5, 7));
    
    // Check if current month is between start and end dates
    if (startYear < currentYear && currentYear < endYear) {
      return true;
    } else if (startYear === currentYear && endYear > currentYear) {
      return currentMonth >= startMonth;
    } else if (startYear < currentYear && endYear === currentYear) {
      return currentMonth <= endMonth;
    } else if (startYear === currentYear && endYear === currentYear) {
      return currentMonth >= startMonth && currentMonth <= endMonth;
    }
    
    return false;
  } else {
    // No end date, just check if it's the current month
    return startYear === currentYear && startMonth === currentMonth;
  }
}

/**
 * Calculate percentage
 */
function calculatePercentage(value, total) {
  if (!total || total <= 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Format API Gateway response
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