import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Props for DataServicesStack
 */
interface DataServicesStackProps extends cdk.StackProps {
  /** VPC for resources that need network access */
  vpc: ec2.Vpc;

  /** Number of days to retain logs (default: 90) */
  logRetentionDays?: number;

  /** Number of days before transitioning logs to IA storage (default: 30) */
  logTransitionDays?: number;

  /** Number of days before transitioning user data to Intelligent Tiering (default: 30) */
  userDataTransitionDays?: number;
}

/**
 * Stack for GEOS-Chem data services
 * Includes S3 buckets and DynamoDB tables
 */
export class DataServicesStack extends cdk.Stack {
  public readonly usersBucket: s3.Bucket;
  public readonly systemBucket: s3.Bucket;
  public readonly logsBucket: s3.Bucket;
  public readonly usersTable: dynamodb.Table;
  public readonly simulationsTable: dynamodb.Table;
  public readonly benchmarksTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataServicesStackProps) {
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