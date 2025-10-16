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
exports.CoreInfrastructureStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
/**
 * Core infrastructure stack for GEOS-Chem AWS Cloud Runner
 * Includes VPC, IAM roles, and base S3 bucket
 */
class CoreInfrastructureStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Get configuration with defaults
        const vpcCidr = (props === null || props === void 0 ? void 0 : props.vpcCidr) || '10.0.0.0/16';
        const maxAzs = (props === null || props === void 0 ? void 0 : props.maxAzs) || 2;
        const natGateways = (props === null || props === void 0 ? void 0 : props.natGateways) || 1;
        // Create a VPC for all resources
        this.vpc = new ec2.Vpc(this, 'GEOS-Chem-VPC', {
            ipAddresses: ec2.IpAddresses.cidr(vpcCidr),
            maxAzs: maxAzs,
            natGateways: natGateways,
            subnetConfiguration: [
                {
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24
                },
                {
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24
                },
                {
                    name: 'Isolated',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 28
                }
            ]
        });
        // Create security groups
        const batchSG = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
            vpc: this.vpc,
            description: 'Security group for AWS Batch compute resources',
            allowAllOutbound: true
        });
        // Create IAM roles for compute resources
        this.batchInstanceRole = new iam.Role(this, 'BatchInstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
            ]
        });
        // Create S3 buckets
        this.baseBucket = new s3.Bucket(this, 'GEOSChemBaseBucket', {
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });
        this.usersBucket = new s3.Bucket(this, 'GEOSChemUsersBucket', {
            bucketName: `geos-chem-users-${cdk.Aws.ACCOUNT_ID}`,
            versioned: false,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            lifecycleRules: [
                {
                    id: 'DeleteOldSimulations',
                    enabled: true,
                    expiration: cdk.Duration.days(90), // Delete simulation data after 90 days
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7)
                }
            ]
        });
        this.systemBucket = new s3.Bucket(this, 'GEOSChemSystemBucket', {
            bucketName: `geos-chem-system-${cdk.Aws.ACCOUNT_ID}`,
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });
        // Create DynamoDB table for simulations
        this.simulationsTable = new dynamodb.Table(this, 'SimulationsTable', {
            tableName: 'geos-chem-simulations',
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'simulationId',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
        });
        // Add GSI for querying by status
        this.simulationsTable.addGlobalSecondaryIndex({
            indexName: 'userId-status-index',
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'status',
                type: dynamodb.AttributeType.STRING
            },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // Add GSI for querying by creation date
        this.simulationsTable.addGlobalSecondaryIndex({
            indexName: 'userId-createdAt-index',
            partitionKey: {
                name: 'userId',
                type: dynamodb.AttributeType.STRING
            },
            sortKey: {
                name: 'createdAt',
                type: dynamodb.AttributeType.STRING
            },
            projectionType: dynamodb.ProjectionType.ALL
        });
        // Output values
        new cdk.CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'VPC ID for GEOS-Chem resources'
        });
        new cdk.CfnOutput(this, 'BucketName', {
            value: this.baseBucket.bucketName,
            description: 'S3 bucket for GEOS-Chem data'
        });
        new cdk.CfnOutput(this, 'VpcCidr', {
            value: vpcCidr,
            description: 'VPC CIDR block'
        });
        new cdk.CfnOutput(this, 'AvailabilityZones', {
            value: this.availabilityZones.join(','),
            description: 'Availability Zones used in the VPC'
        });
        new cdk.CfnOutput(this, 'SimulationsTableName', {
            value: this.simulationsTable.tableName,
            description: 'DynamoDB table for simulations',
            exportName: 'GeosChemSimulationsTableName'
        });
        new cdk.CfnOutput(this, 'UsersBucketName', {
            value: this.usersBucket.bucketName,
            description: 'S3 bucket for user data',
            exportName: 'GeosChemUsersBucketName'
        });
        new cdk.CfnOutput(this, 'SystemBucketName', {
            value: this.systemBucket.bucketName,
            description: 'S3 bucket for system data',
            exportName: 'GeosChemSystemBucketName'
        });
    }
}
exports.CoreInfrastructureStack = CoreInfrastructureStack;
