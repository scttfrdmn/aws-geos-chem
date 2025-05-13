import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

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

    // Create S3 bucket for application data
    this.baseBucket = new s3.Bucket(this, 'GEOSChemBaseBucket', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN
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
  }
}