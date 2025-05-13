# GEOS-Chem AWS Cloud Runner - Cost Tracking Services

This directory contains the cost tracking and optimization services for the GEOS-Chem AWS Cloud Runner. These services help researchers track, estimate, and optimize costs for their GEOS-Chem simulations on AWS.

## Features

- **Real-time cost tracking**: Monitors active simulations and calculates costs based on wall-clock time
- **Cost estimation**: Predicts costs before running simulations
- **Budget management**: Sets and tracks spending limits
- **Cost optimization**: Recommends more cost-effective configurations
- **Cost reporting**: Generates detailed cost breakdowns

## Components

### Lambda Functions

- **daily-cost-update.js**: Fetches daily cost data from AWS Cost Explorer
- **cost-estimation.js**: Estimates costs for simulation configurations
- **budget-management.js**: Manages user-defined budgets and alerts
- **cost-report.js**: Generates detailed cost reports
- **optimization-recommendation.js**: Provides cost optimization suggestions
- **real-time-cost-tracker.js**: Tracks wall-clock times and calculates costs in real-time

### Database Tables

- **CostTrackingTable**: Stores cost data for simulations and resources
- **BudgetTable**: Stores user-defined budgets and spending limits

### Metrics and Monitoring

Real-time cost metrics are published to CloudWatch under the `GEOS-Chem` namespace:

- `RealTimeCost`: Aggregated costs for all active simulations
- `SimulationCost`: Cost by simulation ID and instance type
- `ElapsedHours`: Wall-clock time for each simulation
- `ActiveSimulations`: Count of active simulations

## Cost Tracking Architecture

1. When a simulation starts, its status is updated to "RUNNING" in the simulations table
2. The `real-time-cost-tracker` Lambda function runs every minute to:
   - Query for all active simulations
   - Calculate costs based on wall-clock time and instance type
   - Update the cost tracking table
   - Publish metrics to CloudWatch
3. When a simulation completes, final costs are calculated and stored
4. Daily aggregated costs are calculated by the `daily-cost-update` Lambda

## Wall Clock Time Tracking

Wall clock time tracking is implemented through:

1. Recording simulation start and end times in the DynamoDB simulations table
2. Minute-by-minute cost tracking based on elapsed time
3. Instance-specific pricing based on the instance type used

## Cost Rates

Current cost rates are defined in the `real-time-cost-tracker.js` Lambda:

```javascript
const COST_RATES = {
  // Instance type hourly costs (on-demand prices)
  EC2: {
    'c7g.4xlarge': 0.68,
    'c7g.8xlarge': 1.36,
    'c7g.16xlarge': 2.72,
    // ...more instance types
  },
  // Spot instance discount factor (approximate)
  SPOT_DISCOUNT: 0.7,
  // S3 storage pricing (per GB-month)
  S3: {
    STANDARD: 0.023,
    INTELLIGENT_TIERING: 0.023,
    STANDARD_IA: 0.01
  },
  // Data transfer costs (per GB)
  DATA_TRANSFER: {
    OUT_TO_INTERNET: 0.09
  }
};
```

## Usage

The cost tracking services are automatically deployed as part of the AWS CDK infrastructure. They integrate with the simulation workflow and web interface to provide cost information throughout the process:

1. **Before simulation**: Get cost estimates for different configurations
2. **During simulation**: Track real-time costs based on wall-clock time
3. **After simulation**: View detailed cost breakdowns and optimization suggestions

## API Endpoints

- `GET /costs/real-time`: Get real-time cost information for active simulations
- `POST /costs/estimate`: Get cost estimates for simulation configurations
- `GET /costs/reports`: Get detailed cost reports
- `GET /budgets`: List user budgets
- `POST /budgets`: Create a budget
- `GET /optimization`: Get optimization recommendations

## Dashboard

A CloudWatch dashboard is created automatically to visualize:

- Real-time simulation costs
- Active simulation count
- Daily and monthly cost trends

## Usage Examples

### Estimating Simulation Costs

```json
POST /costs/estimate
{
  "simulationConfig": {
    "simulationType": "fullchem",
    "resolution": "4x5",
    "durationDays": 30,
    "instanceType": "c7g.8xlarge",
    "useSpot": true
  }
}
```

### Creating a Budget

```json
POST /budgets
{
  "name": "Monthly Research Budget",
  "amount": 500,
  "timePeriod": "MONTHLY",
  "alertThreshold": 80
}
```

### Getting Real-time Costs

```
GET /costs/real-time
```

### Getting Cost Reports

```
GET /costs/reports?type=summary&timePeriod=2025-05
```

### Getting Optimization Recommendations

```
GET /optimization?type=all
```

## Best Practices

1. **Start with small test runs**: Use short durations for initial testing
2. **Use Spot instances**: Enable Spot instances for cost savings
3. **Set up budgets**: Create monthly budgets with alerts
4. **Monitor real-time costs**: Watch costs as your simulation runs
5. **Check optimization recommendations**: Review suggestions regularly