"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
class BenchmarkingStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.BenchmarkingStack = BenchmarkingStack;
