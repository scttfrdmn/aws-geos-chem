import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CoreInfrastructureStack } from '../lib/core-infrastructure-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

describe('CoreInfrastructureStack', () => {
  let app: cdk.App;
  let stack: CoreInfrastructureStack;
  let template: Template;
  
  beforeEach(() => {
    app = new cdk.App();
    stack = new CoreInfrastructureStack(app, 'TestCoreInfraStack');
    template = Template.fromStack(stack);
  });
  
  test('VPC Created With Expected Configuration', () => {
    // Verify the creation of a VPC with the expected properties
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
      Tags: [
        {
          Key: 'Name',
          Value: 'TestCoreInfraStack/GEOS-Chem-VPC'
        }
      ]
    });
    
    // Verify subnet configurations
    template.resourceCountIs('AWS::EC2::Subnet', 6); // 2 AZs × 3 subnet types
  });
  
  test('Security Group Created With Expected Configuration', () => {
    // Verify the BatchSecurityGroup is created with expected properties
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for AWS Batch compute resources',
      SecurityGroupEgress: [
        {
          CidrIp: '0.0.0.0/0',
          Description: 'Allow all outbound traffic by default',
          IpProtocol: '-1'
        }
      ]
    });
  });
  
  test('IAM Role Created With Expected Configuration', () => {
    // Verify the BatchInstanceRole is created with expected policies
    template.resourceCountIs('AWS::IAM::Role', 1);
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'ec2.amazonaws.com'
            }
          }
        ]
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition'
              },
              ':iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
            ]
          ]
        },
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition'
              },
              ':iam::aws:policy/AmazonS3ReadOnlyAccess'
            ]
          ]
        }
      ]
    });
  });
  
  test('S3 Bucket Created With Expected Configuration', () => {
    // Verify the S3 bucket is created with expected properties
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256'
            }
          }
        ]
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      },
      VersioningConfiguration: {
        Status: 'Enabled'
      }
    });
  });
  
  test('Outputs Are Exported', () => {
    // Verify the stack exports the expected outputs
    template.hasOutput('VpcId', {});
    template.hasOutput('BucketName', {});
  });
});