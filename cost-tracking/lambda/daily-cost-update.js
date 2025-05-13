/**
 * daily-cost-update.js
 * Lambda function to fetch daily AWS cost and update user cost tracking data
 */

const AWS = require('aws-sdk');
const costExplorer = new AWS.CostExplorer({ region: 'us-east-1' });
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

// Get environment variables
const COST_TABLE = process.env.COST_TABLE;
const BUDGET_TABLE = process.env.BUDGET_TABLE;
const ALERT_TOPIC_ARN = process.env.ALERT_TOPIC_ARN;

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Daily Cost Update - Event:', JSON.stringify(event, null, 2));
  
  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterday_str = formatDate(yesterday);
    const yesterday_month = yesterday_str.substring(0, 7); // YYYY-MM
    
    // Get daily costs from AWS Cost Explorer
    const costData = await getDailyCosts(yesterday_str);
    
    // Get all active budgets
    const budgets = await getAllBudgets();
    
    // Process costs and check against budgets
    const alerts = await processCostsAndCheckBudgets(costData, budgets, yesterday_str, yesterday_month);
    
    // Send alerts if needed
    if (alerts.length > 0) {
      await sendAlerts(alerts);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Daily cost update completed successfully',
        date: yesterday_str,
        totalCost: costData.totalCost,
        userCosts: costData.userCosts.length,
        alerts: alerts.length
      })
    };
  } catch (error) {
    console.error('Error in daily cost update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing daily cost update',
        error: error.message
      })
    };
  }
};

/**
 * Get daily costs from AWS Cost Explorer
 */
async function getDailyCosts(dateStr) {
  // Define the time period for yesterday
  const timePeriod = {
    Start: dateStr,
    End: dateStr
  };
  
  // Request cost data from Cost Explorer, grouped by tags
  const params = {
    TimePeriod: timePeriod,
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
    GroupBy: [
      {
        Type: 'TAG',
        Key: 'UserId'
      },
      {
        Type: 'TAG',
        Key: 'SimulationId'
      }
    ]
  };
  
  try {
    const costAndUsage = await costExplorer.getCostAndUsage(params).promise();
    
    // Process the results
    let totalCost = 0;
    const userCosts = [];
    
    if (costAndUsage.ResultsByTime && costAndUsage.ResultsByTime.length > 0) {
      const results = costAndUsage.ResultsByTime[0];
      
      // Calculate total cost
      totalCost = parseFloat(results.Total.UnblendedCost.Amount || 0);
      
      // Process cost by user and simulation
      if (results.Groups) {
        for (const group of results.Groups) {
          const keys = group.Keys;
          
          // Extract user ID and simulation ID from tags
          let userId = 'unknown';
          let simulationId = 'unknown';
          
          for (const key of keys) {
            if (key.startsWith('UserId$')) {
              userId = key.replace('UserId$', '');
            } else if (key.startsWith('SimulationId$')) {
              simulationId = key.replace('SimulationId$', '');
            }
          }
          
          // Calculate cost for this group
          const cost = parseFloat(group.Metrics.UnblendedCost.Amount || 0);
          
          // Create cost record
          if (cost > 0) {
            userCosts.push({
              userId,
              simulationId,
              cost,
              date: dateStr
            });
          }
        }
      }
    }
    
    return {
      totalCost,
      userCosts
    };
  } catch (error) {
    console.error('Error getting cost data from Cost Explorer:', error);
    throw error;
  }
}

/**
 * Get all active budgets from DynamoDB
 */
async function getAllBudgets() {
  try {
    const params = {
      TableName: BUDGET_TABLE,
      FilterExpression: 'budgetStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'ACTIVE'
      }
    };
    
    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Error getting budgets:', error);
    return [];
  }
}

/**
 * Process costs and check against budgets
 */
async function processCostsAndCheckBudgets(costData, budgets, dateStr, monthStr) {
  const alerts = [];
  const updates = [];
  
  // Process each user's costs
  for (const userCost of costData.userCosts) {
    const { userId, simulationId, cost, date } = userCost;
    
    // Skip records with no cost
    if (!cost || cost <= 0) {
      continue;
    }
    
    // Create a daily cost record
    const dailyCostItem = {
      userId: userId,
      resourceId: `simulation#${simulationId}#${date}`,
      resourceType: 'Simulation',
      cost: cost,
      date: date,
      timePeriod: monthStr,
      createdAt: new Date().toISOString()
    };
    
    // Add to updates
    updates.push(
      dynamoDB.put({
        TableName: COST_TABLE,
        Item: dailyCostItem
      }).promise()
    );
    
    // Check if this user has any budgets
    const userBudgets = budgets.filter(b => b.userId === userId);
    
    for (const budget of userBudgets) {
      // Check if the budget period matches
      if (budget.timePeriod === 'MONTHLY' && budget.periodStart.startsWith(monthStr)) {
        // Get user's current monthly spend
        const userMonthlySpend = await getUserMonthlySpend(userId, monthStr);
        
        // Check if user is approaching or exceeding budget
        const totalSpend = userMonthlySpend + cost;
        const budgetAmount = parseFloat(budget.amount);
        const threshold = parseFloat(budget.alertThreshold) || 80;
        const percentageUsed = (totalSpend / budgetAmount) * 100;
        
        if (percentageUsed >= threshold) {
          // Create alert
          alerts.push({
            userId,
            budgetId: budget.budgetId,
            budgetName: budget.name,
            budgetAmount,
            currentSpend: totalSpend,
            percentageUsed,
            threshold,
            date: dateStr
          });
        }
      }
    }
  }
  
  // Execute all updates in parallel
  if (updates.length > 0) {
    await Promise.all(updates);
  }
  
  return alerts;
}

/**
 * Get user's monthly spend
 */
async function getUserMonthlySpend(userId, monthStr) {
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
    console.error('Error getting user monthly spend:', error);
    return 0;
  }
}

/**
 * Send alerts via SNS
 */
async function sendAlerts(alerts) {
  const promises = [];
  
  for (const alert of alerts) {
    const message = {
      userId: alert.userId,
      type: 'BUDGET_ALERT',
      budget: {
        budgetId: alert.budgetId,
        name: alert.budgetName,
        amount: alert.budgetAmount,
        currentSpend: alert.currentSpend,
        percentageUsed: alert.percentageUsed,
        threshold: alert.threshold
      },
      date: alert.date,
      message: `Budget Alert: You have used ${alert.percentageUsed.toFixed(2)}% of your budget "${alert.budgetName}" (${alert.currentSpend.toFixed(2)} of ${alert.budgetAmount})`
    };
    
    const params = {
      TopicArn: ALERT_TOPIC_ARN,
      Message: JSON.stringify(message),
      MessageAttributes: {
        'userId': {
          DataType: 'String',
          StringValue: alert.userId
        },
        'alertType': {
          DataType: 'String',
          StringValue: 'BUDGET_ALERT'
        }
      }
    };
    
    promises.push(sns.publish(params).promise());
  }
  
  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}