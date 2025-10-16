import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';

/**
 * Props for ComputeResourcesStack
 */
interface ComputeResourcesStackProps extends cdk.StackProps {
  /** VPC for compute resources */
  vpc: ec2.Vpc;

  /** Array of Graviton instance type strings (e.g., ['c7g.4xlarge']) */
  gravitonInstanceTypes?: string[];

  /** Array of x86 instance type strings (e.g., ['c6i.4xlarge']) */
  x86InstanceTypes?: string[];

  /** Array of high-memory instance type strings (e.g., ['r7g.4xlarge']) */
  highMemInstanceTypes?: string[];

  /** Minimum vCPUs for Batch compute environments */
  batchMinVcpu?: number;

  /** Maximum vCPUs for Batch compute environments */
  batchMaxVcpu?: number;

  /** Desired vCPUs for Batch compute environments */
  batchDesiredVcpu?: number;

  /** Maximum vCPUs for high-memory compute environment */
  batchHighMemMaxVcpu?: number;

  /** Name for the standard job queue */
  jobQueueName?: string;

  /** Name for the high priority job queue */
  highPriorityQueueName?: string;

  /** Name for the ECR repository */
  ecrRepositoryName?: string;

  /** Maximum number of images to keep in ECR */
  ecrMaxImages?: number;
}

/**
 * Stack for GEOS-Chem compute resources
 * Includes Batch compute environments, job queues, and ECR repository
 */
export class ComputeResourcesStack extends cdk.Stack {
  public readonly gravitonEnvironment: batch.IComputeEnvironment;
  public readonly x86Environment: batch.IComputeEnvironment;
  public readonly highMemoryEnvironment: batch.IComputeEnvironment;
  public readonly jobQueue: batch.IJobQueue;
  public readonly highPriorityQueue: batch.IJobQueue;
  public readonly containerRepository: ecr.Repository;
  public readonly gravitonJobDefinition: batch.IJobDefinition;
  public readonly x86JobDefinition: batch.IJobDefinition;

  constructor(scope: Construct, id: string, props: ComputeResourcesStackProps) {
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

    // Don't parse instance types - AWS Batch L2 constructs accept instance type arrays directly
    const gravitonInstances = gravitonInstanceTypes.map(t => new ec2.InstanceType(t));
    const x86Instances = x86InstanceTypes.map(t => new ec2.InstanceType(t));
    const highMemInstances = highMemInstanceTypes.map(t => new ec2.InstanceType(t));

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
        'arn:aws:s3:::gcgrid/*',  // Input data from gcgrid bucket
        'arn:aws:s3:::*/*'        // Any user buckets for input/output
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
          'GEOS_REGION': this.region
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
          'GEOS_REGION': this.region
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
        memory: cdk.Size.mebibytes(32768),  // 32GB memory
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
          'GEOS_REGION': this.region
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