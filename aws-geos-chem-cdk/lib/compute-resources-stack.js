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
exports.ComputeResourcesStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const batch = __importStar(require("aws-cdk-lib/aws-batch"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
/**
 * Stack for GEOS-Chem compute resources
 * Includes Batch compute environments, job queues, and ECR repository
 */
class ComputeResourcesStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Get configuration with defaults
        const gravitonInstanceTypes = props.gravitonInstanceTypes ||
            ['c7g.4xlarge', 'c7g.8xlarge', 'c7g.16xlarge', 'm7g.8xlarge', 'r7g.4xlarge'];
        const x86InstanceTypes = props.x86InstanceTypes ||
            ['c6i.4xlarge', 'c6i.8xlarge', 'c6i.16xlarge', 'c6a.8xlarge', 'c6a.16xlarge'];
        const highMemInstanceTypes = props.highMemInstanceTypes ||
            ['r7g.4xlarge', 'r7g.8xlarge', 'r6i.8xlarge', 'r6i.16xlarge'];
        const batchMinVcpu = props.batchMinVcpu !== undefined ? props.batchMinVcpu : 0;
        const batchMaxVcpu = props.batchMaxVcpu !== undefined ? props.batchMaxVcpu : 1000;
        const batchDesiredVcpu = props.batchDesiredVcpu !== undefined ? props.batchDesiredVcpu : 0;
        const batchHighMemMaxVcpu = props.batchHighMemMaxVcpu !== undefined ? props.batchHighMemMaxVcpu : 500;
        const jobQueueName = props.jobQueueName || 'geos-chem-standard';
        const highPriorityQueueName = props.highPriorityQueueName || 'geos-chem-high-priority';
        const ecrRepositoryName = props.ecrRepositoryName || 'geos-chem';
        const ecrMaxImages = props.ecrMaxImages !== undefined ? props.ecrMaxImages : 10;
        // Convert instance type strings to InstanceType objects
        const parseInstanceType = (instanceTypeStr) => {
            const parts = instanceTypeStr.split('.');
            if (parts.length !== 2) {
                throw new Error(`Invalid instance type format: ${instanceTypeStr}`);
            }
            // Extract class and size
            const instanceClass = parts[0];
            const instanceSize = parts[1].toUpperCase();
            // Map instance class string to InstanceClass
            const classMap = {
                'c7g': ec2.InstanceClass.C7G,
                'c6i': ec2.InstanceClass.C6I,
                'c6a': ec2.InstanceClass.C6A,
                'm7g': ec2.InstanceClass.M7G,
                'r7g': ec2.InstanceClass.R7G,
                'r6i': ec2.InstanceClass.R6I
            };
            // Map instance size string to InstanceSize
            const sizeMap = {
                'XLARGE4': ec2.InstanceSize.XLARGE4,
                'XLARGE8': ec2.InstanceSize.XLARGE8,
                'XLARGE16': ec2.InstanceSize.XLARGE16
            };
            if (!classMap[instanceClass]) {
                throw new Error(`Unsupported instance class: ${instanceClass}`);
            }
            if (!sizeMap[instanceSize]) {
                throw new Error(`Unsupported instance size: ${instanceSize}`);
            }
            return ec2.InstanceType.of(classMap[instanceClass], sizeMap[instanceSize]);
        };
        // Parse instance types
        const gravitonInstances = gravitonInstanceTypes.map(parseInstanceType);
        const x86Instances = x86InstanceTypes.map(parseInstanceType);
        const highMemInstances = highMemInstanceTypes.map(parseInstanceType);
        // Create ECR repository for GEOS-Chem container images
        this.containerRepository = new ecr.Repository(this, 'GEOSChemRepository', {
            repositoryName: ecrRepositoryName,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            imageScanOnPush: true,
            lifecycleRules: [
                {
                    maxImageCount: ecrMaxImages,
                    description: `Keep only the ${ecrMaxImages} most recent images`
                }
            ]
        });
        // Create IAM roles for Batch
        const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
            assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole')
            ]
        });
        // Create IAM role for container instances
        const instanceRole = new iam.Role(this, 'BatchInstanceRole', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess')
            ]
        });
        // Create an instance profile from the role
        const instanceProfile = new iam.CfnInstanceProfile(this, 'BatchInstanceProfile', {
            roles: [instanceRole.roleName]
        });
        // Create security group for Batch compute resources
        const batchSG = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
            vpc: props.vpc,
            description: 'Security group for AWS Batch compute resources',
            allowAllOutbound: true
        });
        // Create On-Demand Graviton compute environment for testing
        const gravitonOnDemandEnvironment = new batch.ManagedEc2EcsComputeEnvironment(this, 'GravitonOnDemandComputeEnv', {
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroups: [batchSG],
            instanceTypes: gravitonInstances.slice(0, 2), // Use first 2 instance types
            minvCpus: batchMinVcpu,
            maxvCpus: Math.min(128, batchMaxVcpu), // Lower limit for on-demand
            instanceRole,
            useOptimalInstanceClasses: false
        });
        // Create Spot Graviton compute environment for cost savings
        this.gravitonEnvironment = new batch.ManagedEc2EcsComputeEnvironment(this, 'GravitonSpotComputeEnv', {
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroups: [batchSG],
            instanceTypes: gravitonInstances,
            minvCpus: batchMinVcpu,
            maxvCpus: batchMaxVcpu,
            instanceRole,
            spot: true,
            useOptimalInstanceClasses: false
        });
        // Create x86 compute environment
        this.x86Environment = new batch.ManagedEc2EcsComputeEnvironment(this, 'X86SpotComputeEnv', {
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroups: [batchSG],
            instanceTypes: x86Instances,
            minvCpus: batchMinVcpu,
            maxvCpus: batchMaxVcpu,
            instanceRole,
            spot: true,
            useOptimalInstanceClasses: false
        });
        // Create high-memory compute environment for memory-intensive simulations
        this.highMemoryEnvironment = new batch.ManagedEc2EcsComputeEnvironment(this, 'HighMemoryComputeEnv', {
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroups: [batchSG],
            instanceTypes: highMemInstances,
            minvCpus: batchMinVcpu,
            maxvCpus: batchHighMemMaxVcpu,
            instanceRole,
            spot: true,
            useOptimalInstanceClasses: false
        });
        // Create job queue with priority for optimal cost/performance
        this.jobQueue = new batch.JobQueue(this, 'GEOSChemStandardJobQueue', {
            computeEnvironments: [
                {
                    computeEnvironment: this.gravitonEnvironment, // Prefer Graviton for cost/performance
                    order: 1
                },
                {
                    computeEnvironment: this.x86Environment,
                    order: 2
                },
                {
                    computeEnvironment: gravitonOnDemandEnvironment, // Last resort, on-demand
                    order: 3
                }
            ],
            priority: 1,
            jobQueueName: jobQueueName
        });
        // Create high-priority job queue for important or urgent simulations
        this.highPriorityQueue = new batch.JobQueue(this, 'GEOSChemHighPriorityJobQueue', {
            computeEnvironments: [
                {
                    computeEnvironment: gravitonOnDemandEnvironment, // Use on-demand for high priority
                    order: 1
                },
                {
                    computeEnvironment: this.gravitonEnvironment,
                    order: 2
                },
                {
                    computeEnvironment: this.x86Environment,
                    order: 3
                }
            ],
            priority: 10,
            jobQueueName: highPriorityQueueName
        });
        // Create execution role for batch jobs
        const jobRole = new iam.Role(this, 'BatchJobRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
            ]
        });
        // Add permissions for S3 access to the job role
        jobRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:PutObject',
                's3:ListBucket'
            ],
            resources: [
                'arn:aws:s3:::gcgrid/*', // Input data from gcgrid bucket
                'arn:aws:s3:::*/*' // Any user buckets for input/output
            ]
        }));
        // Create job definition for GEOS-Chem on Graviton (ARM64)
        this.gravitonJobDefinition = new batch.EcsJobDefinition(this, 'GEOSChemGravitonJobDefinition', {
            jobDefinitionName: 'geos-chem-graviton',
            container: new batch.EcsEc2ContainerDefinition(this, 'GravitonContainer', {
                image: ecs.ContainerImage.fromEcrRepository(this.containerRepository, 'graviton-latest'),
                command: ['s3://gcgrid/GEOS_4x5/GEOS_FP/2016/01/', 'Ref::outputPath', 'Ref::configPath'],
                cpu: 4,
                memory: cdk.Size.mebibytes(8192),
                volumes: [
                    batch.EcsVolume.host({
                        name: 'scratch',
                        hostPath: '/tmp',
                        containerPath: '/scratch'
                    })
                ],
                privileged: true,
                jobRole,
                environment: {
                    'AWS_REGION': this.region
                },
                readonlyRootFilesystem: false
            }),
            timeout: cdk.Duration.hours(24),
            retryAttempts: 1,
            parameters: {
                'outputPath': '',
                'configPath': ''
            }
        });
        // Create job definition for GEOS-Chem on x86
        this.x86JobDefinition = new batch.EcsJobDefinition(this, 'GEOSChemX86JobDefinition', {
            jobDefinitionName: 'geos-chem-x86',
            container: new batch.EcsEc2ContainerDefinition(this, 'X86Container', {
                image: ecs.ContainerImage.fromEcrRepository(this.containerRepository, 'x86-latest'),
                command: ['s3://gcgrid/GEOS_4x5/GEOS_FP/2016/01/', 'Ref::outputPath', 'Ref::configPath'],
                cpu: 4,
                memory: cdk.Size.mebibytes(8192),
                volumes: [
                    batch.EcsVolume.host({
                        name: 'scratch',
                        hostPath: '/tmp',
                        containerPath: '/scratch'
                    })
                ],
                privileged: true,
                jobRole,
                environment: {
                    'AWS_REGION': this.region
                },
                readonlyRootFilesystem: false
            }),
            timeout: cdk.Duration.hours(24),
            retryAttempts: 1,
            parameters: {
                'outputPath': '',
                'configPath': ''
            }
        });
        // Create high-memory job definition for GEOS-Chem
        const highMemJobDefinition = new batch.EcsJobDefinition(this, 'GEOSChemHighMemJobDefinition', {
            jobDefinitionName: 'geos-chem-high-memory',
            container: new batch.EcsEc2ContainerDefinition(this, 'HighMemContainer', {
                image: ecs.ContainerImage.fromEcrRepository(this.containerRepository, 'graviton-latest'),
                command: ['s3://gcgrid/GEOS_4x5/GEOS_FP/2016/01/', 'Ref::outputPath', 'Ref::configPath'],
                cpu: 8,
                memory: cdk.Size.mebibytes(32768), // 32GB memory
                volumes: [
                    batch.EcsVolume.host({
                        name: 'scratch',
                        hostPath: '/tmp',
                        containerPath: '/scratch'
                    })
                ],
                privileged: true,
                jobRole,
                environment: {
                    'AWS_REGION': this.region
                },
                readonlyRootFilesystem: false
            }),
            timeout: cdk.Duration.hours(24),
            retryAttempts: 1,
            parameters: {
                'outputPath': '',
                'configPath': ''
            }
        });
        // Outputs
        new cdk.CfnOutput(this, 'StandardJobQueueName', {
            value: this.jobQueue.jobQueueName,
            description: 'Standard AWS Batch job queue for GEOS-Chem jobs'
        });
        new cdk.CfnOutput(this, 'HighPriorityJobQueueName', {
            value: this.highPriorityQueue.jobQueueName,
            description: 'High priority AWS Batch job queue for GEOS-Chem jobs'
        });
        new cdk.CfnOutput(this, 'GravitonJobDefinitionArn', {
            value: this.gravitonJobDefinition.jobDefinitionArn,
            description: 'GEOS-Chem Graviton job definition ARN'
        });
        new cdk.CfnOutput(this, 'X86JobDefinitionArn', {
            value: this.x86JobDefinition.jobDefinitionArn,
            description: 'GEOS-Chem x86 job definition ARN'
        });
        new cdk.CfnOutput(this, 'ECRRepositoryUri', {
            value: this.containerRepository.repositoryUri,
            description: 'ECR Repository URI for GEOS-Chem container images'
        });
        new cdk.CfnOutput(this, 'MaxVCPUs', {
            value: batchMaxVcpu.toString(),
            description: 'Maximum vCPUs for Batch compute environments'
        });
    }
}
exports.ComputeResourcesStack = ComputeResourcesStack;
