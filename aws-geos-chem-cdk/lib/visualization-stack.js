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
exports.VisualizationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const path = __importStar(require("path"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class VisualizationStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.VisualizationStack = VisualizationStack;
