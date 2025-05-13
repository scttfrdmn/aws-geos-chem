import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';

interface VisualizationStackProps extends cdk.StackProps {
  usersBucket: s3.Bucket;
  simulationsTable: dynamodb.Table;
}

export class VisualizationStack extends cdk.Stack {
  public readonly visualizationApi: apigateway.RestApi;
  public readonly visualizationBucket: s3.Bucket;
  
  constructor(scope: Construct, id: string, props: VisualizationStackProps) {
    super(scope, id, props);

    // Create S3 bucket for visualizations
    this.visualizationBucket = new s3.Bucket(this, 'VisualizationBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000
        }
      ],
      lifecycleRules: [
        {
          id: 'ExpireVisualizationsAfter30Days',
          expiration: cdk.Duration.days(30),
          prefix: 'visualizations/'
        }
      ]
    });

    // Create Lambda layer for scientific packages
    const scientificLayer = new lambda.LayerVersion(this, 'ScientificLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'visualization', 'layer')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Scientific Python packages for data visualization (numpy, matplotlib, xarray, cartopy)',
    });

    // Create Lambda for generating visualizations
    const generateVisualizationLambda = new lambda.Function(this, 'GenerateVisualizationFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'generate-visualization.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'visualization', 'lambda')),
      timeout: cdk.Duration.minutes(3),
      memorySize: 1024,
      environment: {
        VISUALIZATION_BUCKET: this.visualizationBucket.bucketName
      },
      layers: [scientificLayer]
    });

    // Create Lambda for listing variables
    const listVariablesLambda = new lambda.Function(this, 'ListVariablesFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'list-variables.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'visualization', 'lambda')),
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
      layers: [scientificLayer]
    });

    // Create Lambda for generating summary
    const generateSummaryLambda = new lambda.Function(this, 'GenerateSummaryFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'generate-summary.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'visualization', 'lambda')),
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      }
    });

    // Grant permissions to Lambda functions
    this.visualizationBucket.grantReadWrite(generateVisualizationLambda);
    this.visualizationBucket.grantReadWrite(generateSummaryLambda);
    props.usersBucket.grantRead(generateVisualizationLambda);
    props.usersBucket.grantRead(listVariablesLambda);
    props.usersBucket.grantRead(generateSummaryLambda);
    props.simulationsTable.grantReadData(generateSummaryLambda);

    // Create API Gateway
    this.visualizationApi = new apigateway.RestApi(this, 'VisualizationApi', {
      restApiName: 'GEOS-Chem Visualization API',
      description: 'API for visualizing GEOS-Chem simulation results',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
      },
      deployOptions: {
        stageName: 'v1',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true
      }
    });

    // Create API resources and methods
    const visualizationsResource = this.visualizationApi.root.addResource('visualizations');

    // Generate visualization endpoint
    const generateResource = visualizationsResource.addResource('generate');
    generateResource.addMethod('POST', new apigateway.LambdaIntegration(generateVisualizationLambda));

    // List variables endpoint
    const variablesResource = visualizationsResource.addResource('variables');
    variablesResource.addMethod('POST', new apigateway.LambdaIntegration(listVariablesLambda));

    // Generate summary endpoint
    const summaryResource = visualizationsResource.addResource('summary');
    summaryResource.addMethod('POST', new apigateway.LambdaIntegration(generateSummaryLambda));

    // Add CloudWatch logging
    new logs.LogGroup(this, 'VisualizationApiLogs', {
      logGroupName: `/aws/apigateway/${this.visualizationApi.restApiName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Output values
    new cdk.CfnOutput(this, 'VisualizationApiUrl', {
      value: this.visualizationApi.url,
      description: 'URL of the Visualization API'
    });

    new cdk.CfnOutput(this, 'VisualizationBucketName', {
      value: this.visualizationBucket.bucketName,
      description: 'Name of the Visualization S3 bucket'
    });
  }
}