import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

interface CostTrackingStackProps extends cdk.StackProps {
  simulationsTable: dynamodb.Table;
}

export class CostTrackingStack extends cdk.Stack {
  public readonly costTable: dynamodb.Table;
  public readonly budgetTable: dynamodb.Table;
  public readonly costTrackingApi: apigateway.RestApi;
  public readonly costAlertTopic: sns.Topic;
  
  constructor(scope: Construct, id: string, props: CostTrackingStackProps) {
    super(scope, id, props);

    // Create DynamoDB table for cost tracking
    this.costTable = new dynamodb.Table(this, 'CostTrackingTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'resourceId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.DEFAULT,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Add GSI for time-based queries
    this.costTable.addGlobalSecondaryIndex({
      indexName: 'ByTimePeriod',
      partitionKey: {
        name: 'timePeriod', // YYYY-MM or YYYY-MM-DD
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Create DynamoDB table for budget tracking
    this.budgetTable = new dynamodb.Table(this, 'BudgetTable', {
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'budgetId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.DEFAULT,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Create SNS topic for cost alerts
    this.costAlertTopic = new sns.Topic(this, 'CostAlertTopic', {
      displayName: 'GEOS-Chem Cost Alerts'
    });

    // Create Lambda function for daily cost update
    const dailyCostUpdateLambda = new lambda.Function(this, 'DailyCostUpdateFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'daily-cost-update.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'cost-tracking', 'lambda')),
      timeout: cdk.Duration.minutes(5),
      environment: {
        COST_TABLE: this.costTable.tableName,
        BUDGET_TABLE: this.budgetTable.tableName,
        ALERT_TOPIC_ARN: this.costAlertTopic.topicArn
      }
    });

    // Create CloudWatch Events rule to trigger the Lambda daily
    const dailyRule = new events.Rule(this, 'DailyCostUpdateRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }), // Midnight every day
      description: 'Trigger daily cost updates for GEOS-Chem users'
    });
    dailyRule.addTarget(new targets.LambdaFunction(dailyCostUpdateLambda));

    // Create Lambda function for simulation cost estimation
    const costEstimationLambda = new lambda.Function(this, 'CostEstimationFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cost-estimation.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'cost-tracking', 'lambda')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      }
    });

    // Create Lambda function for budget management
    const budgetManagementLambda = new lambda.Function(this, 'BudgetManagementFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'budget-management.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'cost-tracking', 'lambda')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUDGET_TABLE: this.budgetTable.tableName,
        COST_TABLE: this.costTable.tableName,
        ALERT_TOPIC_ARN: this.costAlertTopic.topicArn
      }
    });

    // Create Lambda function for cost reports
    const costReportLambda = new lambda.Function(this, 'CostReportFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cost-report.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'cost-tracking', 'lambda')),
      timeout: cdk.Duration.minutes(1),
      environment: {
        COST_TABLE: this.costTable.tableName,
        BUDGET_TABLE: this.budgetTable.tableName,
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      }
    });

    // Create Lambda function for real-time cost tracking
    const realTimeCostTrackerLambda = new lambda.Function(this, 'RealTimeCostTrackerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'real-time-cost-tracker.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'cost-tracking', 'lambda')),
      timeout: cdk.Duration.minutes(1),
      environment: {
        COST_TABLE: this.costTable.tableName,
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      }
    });

    // Create CloudWatch Events rule to trigger the real-time cost tracker every minute
    const minutelyRule = new events.Rule(this, 'MinutelyCostUpdateRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)), // Run every minute
      description: 'Trigger real-time cost updates for active GEOS-Chem simulations'
    });
    minutelyRule.addTarget(new targets.LambdaFunction(realTimeCostTrackerLambda));

    // Grant permissions to real-time cost tracker
    this.costTable.grantReadWriteData(realTimeCostTrackerLambda);
    props.simulationsTable.grantReadData(realTimeCostTrackerLambda);

    // Create Lambda function for optimization recommendations
    const optimizationRecommendationLambda = new lambda.Function(this, 'OptimizationRecommendationFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'optimization-recommendation.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'cost-tracking', 'lambda')),
      timeout: cdk.Duration.minutes(1),
      environment: {
        COST_TABLE: this.costTable.tableName,
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      }
    });

    // Grant permissions to Lambda functions
    this.costTable.grantReadWriteData(dailyCostUpdateLambda);
    this.budgetTable.grantReadData(dailyCostUpdateLambda);
    this.costAlertTopic.grantPublish(dailyCostUpdateLambda);
    
    props.simulationsTable.grantReadData(costEstimationLambda);
    
    this.budgetTable.grantReadWriteData(budgetManagementLambda);
    this.costTable.grantReadData(budgetManagementLambda);
    this.costAlertTopic.grantPublish(budgetManagementLambda);
    
    this.costTable.grantReadData(costReportLambda);
    this.budgetTable.grantReadData(costReportLambda);
    props.simulationsTable.grantReadData(costReportLambda);
    
    this.costTable.grantReadData(optimizationRecommendationLambda);
    props.simulationsTable.grantReadData(optimizationRecommendationLambda);

    // Grant additional permissions for cost data access
    dailyCostUpdateLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ce:GetCostAndUsage',
          'ce:GetDimensionValues',
          'ce:GetTags'
        ],
        resources: ['*']
      })
    );

    // Create API Gateway
    this.costTrackingApi = new apigateway.RestApi(this, 'CostTrackingApi', {
      restApiName: 'GEOS-Chem Cost Tracking API',
      description: 'API for GEOS-Chem cost tracking and optimization',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
      }
    });

    // Create API resources
    const costResource = this.costTrackingApi.root.addResource('costs');
    const estimateResource = costResource.addResource('estimate');
    estimateResource.addMethod('POST', new apigateway.LambdaIntegration(costEstimationLambda));

    const reportsResource = costResource.addResource('reports');
    reportsResource.addMethod('GET', new apigateway.LambdaIntegration(costReportLambda));

    // Add real-time cost tracking endpoint
    const realTimeResource = costResource.addResource('real-time');
    realTimeResource.addMethod('GET', new apigateway.LambdaIntegration(realTimeCostTrackerLambda));

    const budgetResource = this.costTrackingApi.root.addResource('budgets');
    budgetResource.addMethod('GET', new apigateway.LambdaIntegration(budgetManagementLambda));
    budgetResource.addMethod('POST', new apigateway.LambdaIntegration(budgetManagementLambda));

    const budgetIdResource = budgetResource.addResource('{budgetId}');
    budgetIdResource.addMethod('GET', new apigateway.LambdaIntegration(budgetManagementLambda));
    budgetIdResource.addMethod('PUT', new apigateway.LambdaIntegration(budgetManagementLambda));
    budgetIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(budgetManagementLambda));

    const optimizationResource = this.costTrackingApi.root.addResource('optimization');
    optimizationResource.addMethod('GET', new apigateway.LambdaIntegration(optimizationRecommendationLambda));

    // Create CloudWatch Dashboard for cost monitoring
    const dashboard = new cloudwatch.Dashboard(this, 'CostDashboard', {
      dashboardName: 'GEOS-Chem-Cost-Dashboard'
    });

    // Create custom metrics for real-time cost tracking
    const realTimeCostMetric = new cloudwatch.Metric({
      namespace: 'GEOS-Chem',
      metricName: 'RealTimeCost',
      dimensionsMap: {
        Service: 'Simulations'
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(1),
      unit: cloudwatch.Unit.NONE
    });

    const activeSimulationsMetric = new cloudwatch.Metric({
      namespace: 'GEOS-Chem',
      metricName: 'ActiveSimulations',
      dimensionsMap: {
        Service: 'Batch'
      },
      statistic: 'Maximum',
      period: cdk.Duration.minutes(5),
      unit: cloudwatch.Unit.COUNT
    });

    // Add widgets to the dashboard
    dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# GEOS-Chem AWS Cloud Runner - Cost Dashboard\nMonitor your simulation costs and budgets',
        width: 24,
        height: 2
      }),

      new cloudwatch.GraphWidget({
        title: 'Real-time Simulation Costs (USD)',
        left: [realTimeCostMetric],
        width: 12,
        height: 6
      }),

      new cloudwatch.GraphWidget({
        title: 'Active Simulations',
        left: [activeSimulationsMetric],
        width: 12,
        height: 6
      }),

      new cloudwatch.TextWidget({
        markdown: '## Daily Costs',
        width: 24,
        height: 1
      })
    );

    // Update real-time cost tracker Lambda to publish metrics
    realTimeCostTrackerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudwatch:PutMetricData'
        ],
        resources: ['*']
      })
    );

    // Output values
    new cdk.CfnOutput(this, 'CostTableName', {
      value: this.costTable.tableName,
      description: 'DynamoDB table for cost tracking'
    });

    new cdk.CfnOutput(this, 'BudgetTableName', {
      value: this.budgetTable.tableName,
      description: 'DynamoDB table for budget tracking'
    });

    new cdk.CfnOutput(this, 'CostTrackingApiUrl', {
      value: this.costTrackingApi.url,
      description: 'URL for the Cost Tracking API'
    });

    new cdk.CfnOutput(this, 'CostAlertTopicArn', {
      value: this.costAlertTopic.topicArn,
      description: 'ARN of the SNS topic for cost alerts'
    });
  }
}