import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class BenchmarkingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for benchmark data
    const benchmarkBucket = new s3.Bucket(this, 'GeosChem-Benchmark-Results', {
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // DynamoDB table for benchmark data
    const benchmarksTable = new dynamodb.Table(this, 'GeosChem-Benchmarks', {
      partitionKey: { name: 'benchmark_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // Create global secondary index for simulation type
    benchmarksTable.addGlobalSecondaryIndex({
      indexName: 'SimulationTypeIndex',
      partitionKey: { name: 'simulation_type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
    });

    // Lambda function for cost estimation
    const estimateCostFunction = new lambda.Function(this, 'EstimateCostFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'estimate-cost.handler',
      code: lambda.Code.fromAsset('lambda/benchmarking'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BENCHMARK_BUCKET: benchmarkBucket.bucketName,
        BENCHMARKS_TABLE: benchmarksTable.tableName,
      },
    });

    // Lambda function for performance comparison
    const comparePerformanceFunction = new lambda.Function(this, 'ComparePerformanceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'compare-performance.handler',
      code: lambda.Code.fromAsset('lambda/benchmarking'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BENCHMARKS_TABLE: benchmarksTable.tableName,
      },
    });

    // Lambda function for instance recommendation
    const recommendInstanceFunction = new lambda.Function(this, 'RecommendInstanceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'recommend-instance.handler',
      code: lambda.Code.fromAsset('lambda/benchmarking'),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        BENCHMARKS_TABLE: benchmarksTable.tableName,
      },
    });

    // Grant permissions to Lambda functions
    benchmarkBucket.grantRead(estimateCostFunction);
    benchmarksTable.grantReadData(estimateCostFunction);
    benchmarksTable.grantReadData(comparePerformanceFunction);
    benchmarksTable.grantReadData(recommendInstanceFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'BenchmarkingApi', {
      restApiName: 'GEOS-Chem Benchmarking API',
      description: 'API for GEOS-Chem benchmarking and cost estimation',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
        allowCredentials: true,
      },
    });

    // API resources and methods
    const benchmarksResource = api.root.addResource('benchmarks');
    
    // Cost estimation endpoint
    const estimateCostResource = benchmarksResource.addResource('estimate-cost');
    estimateCostResource.addMethod('POST', new apigateway.LambdaIntegration(estimateCostFunction));
    
    // Performance comparison endpoint
    const compareResource = benchmarksResource.addResource('compare');
    compareResource.addMethod('POST', new apigateway.LambdaIntegration(comparePerformanceFunction));
    
    // Instance recommendation endpoint
    const recommendResource = benchmarksResource.addResource('recommend');
    recommendResource.addMethod('POST', new apigateway.LambdaIntegration(recommendInstanceFunction));
    
    // Results endpoint (for getting benchmark results)
    const resultsResource = benchmarksResource.addResource('results');
    
    // Add specific benchmark ID path parameter
    const benchmarkIdResource = resultsResource.addResource('{benchmarkId}');
    benchmarkIdResource.addMethod('GET', new apigateway.LambdaIntegration(estimateCostFunction));

    // Outputs
    new cdk.CfnOutput(this, 'BenchmarkBucketName', {
      value: benchmarkBucket.bucketName,
      description: 'Benchmark results bucket name',
    });

    new cdk.CfnOutput(this, 'BenchmarksTableName', {
      value: benchmarksTable.tableName,
      description: 'Benchmarks DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'BenchmarkingApiUrl', {
      value: api.url,
      description: 'Benchmarking API URL',
    });
  }
}