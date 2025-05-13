/**
 * cost-report.js
 * Lambda function to generate cost reports for GEOS-Chem simulations
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const COST_TABLE = process.env.COST_TABLE;
const BUDGET_TABLE = process.env.BUDGET_TABLE;
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  console.log('Cost Report - Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract HTTP method and query parameters
    const queryParams = event.queryStringParameters || {};
    
    // Get userId from request context (assuming API Gateway authorization)
    let userId;
    if (event.requestContext && event.requestContext.authorizer && event.requestContext.authorizer.claims) {
      userId = event.requestContext.authorizer.claims.sub;
    } else if (queryParams.userId) {
      // For testing, allow userId in query params
      userId = queryParams.userId;
    } else {
      return formatResponse(401, { message: 'Unauthorized - User identity not found' });
    }
    
    // Get the report type
    const reportType = queryParams.type || 'summary';
    
    // Get time period
    const timePeriod = queryParams.timePeriod || getCurrentMonth();
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate || new Date().toISOString().substring(0, 10);
    
    // Generate the appropriate report
    let report;
    
    switch (reportType) {
      case 'summary':
        report = await generateSummaryReport(userId, timePeriod);
        break;
      case 'detailed':
        report = await generateDetailedReport(userId, timePeriod);
        break;
      case 'simulation':
        if (!queryParams.simulationId) {
          return formatResponse(400, { message: 'simulationId is required for simulation reports' });
        }
        report = await generateSimulationReport(userId, queryParams.simulationId);
        break;
      case 'timeline':
        report = await generateTimelineReport(userId, startDate, endDate);
        break;
      default:
        return formatResponse(400, { message: 'Invalid report type' });
    }
    
    return formatResponse(200, {
      message: 'Cost report generated successfully',
      report
    });
  } catch (error) {
    console.error('Error generating cost report:', error);
    return formatResponse(500, {
      message: 'Error generating cost report',
      error: error.message
    });
  }
};

/**
 * Generate a summary cost report for a user
 */
async function generateSummaryReport(userId, timePeriod) {
  try {
    // Get all costs for the time period
    const costs = await getCostsForPeriod(userId, timePeriod);
    
    // Get budgets for the user
    const budgets = await getBudgetsForUser(userId);
    
    // Calculate total cost
    let totalCost = 0;
    const resourceCosts = {};
    const dailyCosts = {};
    
    for (const cost of costs) {
      const costAmount = parseFloat(cost.cost) || 0;
      totalCost += costAmount;
      
      // Group by resource
      const resourceId = cost.resourceId.split('#')[1] || cost.resourceId; // Extract simulation ID
      
      if (!resourceCosts[resourceId]) {
        resourceCosts[resourceId] = 0;
      }
      resourceCosts[resourceId] += costAmount;
      
      // Group by date
      const date = cost.date;
      if (!dailyCosts[date]) {
        dailyCosts[date] = 0;
      }
      dailyCosts[date] += costAmount;
    }
    
    // Find applicable budgets
    const applicableBudgets = budgets.filter(budget => {
      if (budget.timePeriod === 'MONTHLY' && budget.periodStart.startsWith(timePeriod)) {
        return true;
      }
      return false;
    });
    
    // Calculate budget status
    const budgetStatus = applicableBudgets.map(budget => {
      const percentUsed = calculatePercentage(totalCost, budget.amount);
      return {
        budgetId: budget.budgetId,
        name: budget.name,
        amount: budget.amount,
        used: totalCost,
        remaining: Math.max(0, budget.amount - totalCost),
        percentUsed
      };
    });
    
    // Sort resources by cost (descending)
    const topResources = Object.entries(resourceCosts)
      .map(([id, cost]) => ({ id, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5); // Top 5
    
    // Convert daily costs to array sorted by date
    const dailyCostTrend = Object.entries(dailyCosts)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Create summary report
    return {
      userId,
      timePeriod,
      totalCost,
      budgetStatus,
      topResources,
      dailyCostTrend,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating summary report:', error);
    throw error;
  }
}

/**
 * Generate a detailed cost report for a user
 */
async function generateDetailedReport(userId, timePeriod) {
  try {
    // Get all costs for the time period
    const costs = await getCostsForPeriod(userId, timePeriod);
    
    // Get all simulations for the user
    const simulations = await getSimulationsForUser(userId);
    
    // Group costs by simulation
    const simulationCosts = {};
    
    for (const cost of costs) {
      // Extract simulation ID from resourceId
      const parts = cost.resourceId.split('#');
      if (parts.length >= 2 && parts[0] === 'simulation') {
        const simulationId = parts[1];
        
        if (!simulationCosts[simulationId]) {
          simulationCosts[simulationId] = {
            simulationId,
            name: 'Unknown Simulation',
            totalCost: 0,
            dailyCosts: {}
          };
        }
        
        // Add to total cost
        simulationCosts[simulationId].totalCost += parseFloat(cost.cost) || 0;
        
        // Group by date
        const date = cost.date;
        if (!simulationCosts[simulationId].dailyCosts[date]) {
          simulationCosts[simulationId].dailyCosts[date] = 0;
        }
        simulationCosts[simulationId].dailyCosts[date] += parseFloat(cost.cost) || 0;
      }
    }
    
    // Add simulation names where available
    for (const simulationId in simulationCosts) {
      const simulation = simulations.find(s => s.simulationId === simulationId);
      if (simulation) {
        simulationCosts[simulationId].name = simulation.name || `Simulation ${simulationId}`;
        simulationCosts[simulationId].type = simulation.simulationType || 'Unknown';
        simulationCosts[simulationId].status = simulation.status || 'Unknown';
      }
    }
    
    // Calculate total cost
    const totalCost = Object.values(simulationCosts).reduce((sum, sim) => sum + sim.totalCost, 0);
    
    // Convert to array and sort by total cost (descending)
    const simulationsArray = Object.values(simulationCosts)
      .map(sim => ({
        ...sim,
        dailyCosts: Object.entries(sim.dailyCosts)
          .map(([date, cost]) => ({ date, cost }))
          .sort((a, b) => a.date.localeCompare(b.date))
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
    
    // Create detailed report
    return {
      userId,
      timePeriod,
      totalCost,
      simulationCount: simulationsArray.length,
      simulations: simulationsArray,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating detailed report:', error);
    throw error;
  }
}

/**
 * Generate a cost report for a specific simulation
 */
async function generateSimulationReport(userId, simulationId) {
  try {
    // Get simulation details
    const simulation = await getSimulation(userId, simulationId);
    if (!simulation) {
      throw new Error(`Simulation ${simulationId} not found for user ${userId}`);
    }
    
    // Get all costs for the simulation
    const costs = await getCostsForSimulation(userId, simulationId);
    
    // Calculate total cost
    let totalCost = 0;
    const dailyCosts = {};
    
    for (const cost of costs) {
      const costAmount = parseFloat(cost.cost) || 0;
      totalCost += costAmount;
      
      // Group by date
      const date = cost.date;
      if (!dailyCosts[date]) {
        dailyCosts[date] = 0;
      }
      dailyCosts[date] += costAmount;
    }
    
    // Convert daily costs to array sorted by date
    const dailyCostTrend = Object.entries(dailyCosts)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate cost metrics
    let costPerDay = 0;
    if (simulation.durationDays) {
      costPerDay = totalCost / parseFloat(simulation.durationDays);
    }
    
    // Create simulation report
    return {
      userId,
      simulationId,
      name: simulation.name || `Simulation ${simulationId}`,
      status: simulation.status || 'Unknown',
      type: simulation.simulationType || 'Unknown',
      durationDays: simulation.durationDays || 0,
      instanceType: simulation.instanceType || 'Unknown',
      totalCost,
      costPerDay,
      dailyCostTrend,
      startedAt: simulation.startedAt,
      completedAt: simulation.completedAt,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating simulation report:', error);
    throw error;
  }
}

/**
 * Generate a timeline report for costs across multiple months
 */
async function generateTimelineReport(userId, startDate, endDate) {
  try {
    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1); // Default to Jan 1 of current year
    const end = new Date(endDate);
    
    // Generate list of months between start and end
    const months = [];
    const currentMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (currentMonth <= end) {
      months.push(formatMonth(currentMonth));
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    // Get costs for each month
    const monthlyCosts = [];
    
    for (const month of months) {
      const costs = await getCostsForPeriod(userId, month);
      
      // Calculate total cost for the month
      let totalCost = 0;
      for (const cost of costs) {
        totalCost += parseFloat(cost.cost) || 0;
      }
      
      monthlyCosts.push({
        month,
        totalCost,
        costCount: costs.length
      });
    }
    
    // Calculate total cost
    const totalCost = monthlyCosts.reduce((sum, month) => sum + month.totalCost, 0);
    
    // Create timeline report
    return {
      userId,
      startDate: startDate || formatDate(start),
      endDate,
      totalCost,
      monthlyCosts,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating timeline report:', error);
    throw error;
  }
}

/**
 * Get costs for a specific time period
 */
async function getCostsForPeriod(userId, timePeriod) {
  try {
    const params = {
      TableName: COST_TABLE,
      IndexName: 'ByTimePeriod',
      KeyConditionExpression: 'timePeriod = :tp AND userId = :uid',
      ExpressionAttributeValues: {
        ':tp': timePeriod,
        ':uid': userId
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Error getting costs for period:', error);
    return [];
  }
}

/**
 * Get costs for a specific simulation
 */
async function getCostsForSimulation(userId, simulationId) {
  try {
    const params = {
      TableName: COST_TABLE,
      KeyConditionExpression: 'userId = :uid',
      FilterExpression: 'contains(resourceId, :simId)',
      ExpressionAttributeValues: {
        ':uid': userId,
        ':simId': simulationId
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Error getting costs for simulation:', error);
    return [];
  }
}

/**
 * Get budgets for a user
 */
async function getBudgetsForUser(userId) {
  try {
    const params = {
      TableName: BUDGET_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Error getting budgets for user:', error);
    return [];
  }
}

/**
 * Get simulations for a user
 */
async function getSimulationsForUser(userId) {
  try {
    const params = {
      TableName: SIMULATIONS_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId
      }
    };
    
    const result = await dynamoDB.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error('Error getting simulations for user:', error);
    return [];
  }
}

/**
 * Get a specific simulation
 */
async function getSimulation(userId, simulationId) {
  try {
    const params = {
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId,
        simulationId
      }
    };
    
    const result = await dynamoDB.get(params).promise();
    return result.Item;
  } catch (error) {
    console.error('Error getting simulation:', error);
    return null;
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
 * Get current month in YYYY-MM format
 */
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Format date as YYYY-MM
 */
function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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