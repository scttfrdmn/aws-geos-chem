import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

/**
 * Props for CoreInfrastructureStack
 */
export interface CoreInfrastructureStackProps extends cdk.StackProps {
  /**
   * CIDR block for the VPC
   * @default '10.0.0.0/16'
   */
  vpcCidr?: string;

  /**
   * Maximum number of Availability Zones to use
   * @default 2
   */
  maxAzs?: number;

  /**
   * Number of NAT Gateways to create
   * @default 1
   */
  natGateways?: number;
}

/**
 * Core infrastructure stack for GEOS-Chem AWS Cloud Runner
 * Includes VPC, IAM roles, and base S3 bucket
 */
export class CoreInfrastructureStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly batchInstanceRole: iam.Role;
  public readonly baseBucket: s3.Bucket;
  public readonly simulationsTable: dynamodb.Table;
  public readonly usersBucket: s3.Bucket;
  public readonly systemBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: CoreInfrastructureStackProps) {
    super(scope, id, props);

    // Get configuration with defaults
    const vpcCidr = props?.vpcCidr || '10.0.0.0/16';
    const maxAzs = props?.maxAzs || 2;
    const natGateways = props?.natGateways || 1;

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