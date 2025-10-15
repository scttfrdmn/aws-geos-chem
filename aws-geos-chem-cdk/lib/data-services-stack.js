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
exports.DataServicesStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
/**
 * Stack for GEOS-Chem data services
 * Includes S3 buckets and DynamoDB tables
 */
class DataServicesStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Get configuration with defaults
        const logRetentionDays = props.logRetentionDays || 90;
        const logTransitionDays = props.logTransitionDays || 30;
        const userDataTransitionDays = props.userDataTransitionDays || 30;
        // Create S3 buckets for user data
        this.usersBucket = new s3.Bucket(this, 'UserDataBucket', {
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            lifecycleRules: [
                {
                    id: 'IntelligentTieringRule',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INTELLIGENT_TIERING,
                            transitionAfter: cdk.Duration.days(userDataTransitionDays)
                        }
                    ]
                }
            ],
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });
        // Create S3 bucket for system data
        this.systemBucket = new s3.Bucket(this, 'SystemBucket', {
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });
        // Create S3 bucket for logs
        this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
            versioned: false,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            lifecycleRules: [
                {
                    id: 'LogRetention',
                    expiration: cdk.Duration.days(logRetentionDays),
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(logTransitionDays)
                        }
                    ]
                }
            ],
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        // Create DynamoDB tables
        this.usersTable = new dynamodb.Table(this, 'UsersTable', {
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.DEFAULT,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });
        this.simulationsTable = new dynamodb.Table(this, 'SimulationsTable', {
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'simulationId',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.DEFAULT,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });
        // Global secondary index on status for easier queries
        this.simulationsTable.addGlobalSecondaryIndex({
            indexName: 'statusIndex',
            partitionKey: {
                name: 'status',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'createdAt',
                type: dynamodb.AttributeType.STRING
            },
            projectionType: dynamodb.ProjectionType.ALL
        });
        this.benchmarksTable = new dynamodb.Table(this, 'BenchmarksTable', {
            partitionKey: {
                name: 'configurationType',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'instanceType',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.DEFAULT,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });
        // Outputs
        new cdk.CfnOutput(this, 'UsersBucketName', {
            value: this.usersBucket.bucketName,
            description: 'S3 bucket for user data'
        });
        new cdk.CfnOutput(this, 'SystemBucketName', {
            value: this.systemBucket.bucketName,
            description: 'S3 bucket for system data'
        });
        new cdk.CfnOutput(this, 'LogsBucketName', {
            value: this.logsBucket.bucketName,
            description: 'S3 bucket for logs'
        });
        new cdk.CfnOutput(this, 'LogRetentionDays', {
            value: logRetentionDays.toString(),
            description: 'Number of days to retain logs'
        });
        new cdk.CfnOutput(this, 'UsersTableName', {
            value: this.usersTable.tableName,
            description: 'DynamoDB table for users'
        });
        new cdk.CfnOutput(this, 'SimulationsTableName', {
            value: this.simulationsTable.tableName,
            description: 'DynamoDB table for simulations'
        });
        new cdk.CfnOutput(this, 'BenchmarksTableName', {
            value: this.benchmarksTable.tableName,
            description: 'DynamoDB table for benchmarks'
        });
    }
}
exports.DataServicesStack = DataServicesStack;
