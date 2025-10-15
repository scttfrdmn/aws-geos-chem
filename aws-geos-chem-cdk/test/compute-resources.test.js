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
const cdk = __importStar(require("aws-cdk-lib"));
const assertions_1 = require("aws-cdk-lib/assertions");
const compute_resources_stack_1 = require("../lib/compute-resources-stack");
const core_infrastructure_stack_1 = require("../lib/core-infrastructure-stack");
describe('ComputeResourcesStack', () => {
    let app;
    let coreStack;
    let computeStack;
    let template;
    beforeEach(() => {
        app = new cdk.App();
        coreStack = new core_infrastructure_stack_1.CoreInfrastructureStack(app, 'TestCoreInfraStack');
        computeStack = new compute_resources_stack_1.ComputeResourcesStack(app, 'TestComputeResourcesStack', {
            vpc: coreStack.vpc
        });
        template = assertions_1.Template.fromStack(computeStack);
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
