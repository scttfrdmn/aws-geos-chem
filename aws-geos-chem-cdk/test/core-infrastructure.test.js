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
const core_infrastructure_stack_1 = require("../lib/core-infrastructure-stack");
describe('CoreInfrastructureStack', () => {
    let app;
    let stack;
    let template;
    beforeEach(() => {
        app = new cdk.App();
        stack = new core_infrastructure_stack_1.CoreInfrastructureStack(app, 'TestCoreInfraStack');
        template = assertions_1.Template.fromStack(stack);
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
