import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ComputeResourcesStack } from '../lib/compute-resources-stack';
import { CoreInfrastructureStack } from '../lib/core-infrastructure-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as batch from 'aws-cdk-lib/aws-batch';

describe('ComputeResourcesStack', () => {
  let app: cdk.App;
  let coreStack: CoreInfrastructureStack;
  let computeStack: ComputeResourcesStack;
  let template: Template;
  
  beforeEach(() => {
    app = new cdk.App();
    coreStack = new CoreInfrastructureStack(app, 'TestCoreInfraStack');
    computeStack = new ComputeResourcesStack(app, 'TestComputeResourcesStack', {
      vpc: coreStack.vpc
    });
    template = Template.fromStack(computeStack);
  });
  
  test('ECR Repository Created With Expected Configuration', () => {
    // Verify the creation of the ECR repository
    template.resourceCountIs('AWS::ECR::Repository', 1);
    template.hasResourceProperties('AWS::ECR::Repository', {
      RepositoryName: 'geos-chem',
      ImageScanningConfiguration: {
        ScanOnPush: true
      },
      LifecyclePolicy: {
        LifecyclePolicyText: JSON.stringify({
          rules: [
            {
              rulePriority: 1,
              description: 'Keep only the 10 most recent images',
              selection: {
                tagStatus: 'any',
                countType: 'imageCountMoreThan',
                countNumber: 10
              },
              action: {
                type: 'expire'
              }
            }
          ]
        })
      }
    });
  });
  
  test('IAM Roles Created With Expected Configuration', () => {
    // Verify the BatchServiceRole is created correctly
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'batch.amazonaws.com'
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
              ':iam::aws:policy/service-role/AWSBatchServiceRole'
            ]
          ]
        }
      ]
    });
    
    // Verify the instance role is created correctly
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
      }
    });
  });
  
  test('Batch Compute Environments Created', () => {
    // Check that the compute environments are created
    const computeEnvs = template.findResources('AWS::Batch::ComputeEnvironment');
    expect(Object.keys(computeEnvs).length).toBeGreaterThanOrEqual(3);
    
    // Verify Graviton Spot compute environment
    template.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
      Type: 'MANAGED',
      State: 'ENABLED',
      ComputeResources: {
        Type: 'SPOT',
        AllocationStrategy: 'SPOT_CAPACITY_OPTIMIZED',
        MinvCpus: 0,
        MaxvCpus: 1000,
        DesiredvCpus: 0,
        InstanceTypes: expect.arrayContaining([
          'c7g.4xlarge', 
          'c7g.8xlarge'
        ]),
        Subnets: expect.any(Array)
      }
    });
  });
  
  test('Batch Job Queues Created', () => {
    // Verify that job queues are created
    template.resourceCountIs('AWS::Batch::JobQueue', 2);
    
    // Verify standard job queue
    template.hasResourceProperties('AWS::Batch::JobQueue', {
      JobQueueName: 'geos-chem-standard',
      Priority: 1,
      State: 'ENABLED',
      ComputeEnvironmentOrder: expect.arrayContaining([
        {
          Order: 10,
          ComputeEnvironment: {
            Ref: expect.any(String)
          }
        }
      ])
    });
    
    // Verify high priority job queue
    template.hasResourceProperties('AWS::Batch::JobQueue', {
      JobQueueName: 'geos-chem-high-priority',
      Priority: 10,
      State: 'ENABLED',
      ComputeEnvironmentOrder: expect.any(Array)
    });
  });
  
  test('Batch Job Definitions Created', () => {
    // Verify job definitions are created
    template.resourceCountIs('AWS::Batch::JobDefinition', 3);
    
    // Verify Graviton job definition
    template.hasResourceProperties('AWS::Batch::JobDefinition', {
      JobDefinitionName: 'geos-chem-graviton',
      Type: 'container',
      ContainerProperties: {
        Memory: 8192,
        Vcpus: 4,
        Privileged: true,
        MountPoints: [
          {
            ContainerPath: '/scratch',
            ReadOnly: false,
            SourceVolume: 'scratch'
          }
        ],
        Volumes: [
          {
            Host: {
              SourcePath: '/tmp'
            },
            Name: 'scratch'
          }
        ]
      },
      Parameters: {
        'outputPath': '',
        'configPath': ''
      },
      RetryStrategy: {
        Attempts: 1
      }
    });
  });
  
  test('Security Group Created For Batch', () => {
    // Verify security group for Batch
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
});