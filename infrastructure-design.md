# Infrastructure Design Document

## Overview

This document details the AWS infrastructure required to support the GEOS-Chem AWS Cloud Runner system. The architecture is designed to be scalable, cost-effective, and optimized for scientific computing workloads while maintaining ease of use for researchers without extensive cloud expertise.

## Infrastructure Architecture

![Infrastructure Architecture Diagram](infrastructure-diagram-placeholder.png)

## Core Components

### 1. User-Facing Components

#### 1.1 Web Application Hosting
- **S3 Bucket**: Hosts static web assets
- **CloudFront Distribution**: Global content delivery
- **Route 53**: DNS management
- **AWS Certificate Manager**: SSL/TLS certificates

#### 1.2 Authentication & Authorization
- **Amazon Cognito**: User pool for authentication
- **IAM Roles**: Fine-grained permission control
- **AWS WAF**: Web application firewall protection

#### 1.3 API Layer
- **API Gateway**: RESTful API endpoints
- **Lambda Authorizers**: Request authentication/authorization
- **AWS Shield**: DDoS protection

### 2. Backend Services

#### 2.1 Core Services
- **Lambda Functions**: Serverless computation for:
  - Configuration processing
  - Job management
  - Notification handling
  - Data processing
- **Step Functions**: State machines for workflow orchestration
- **EventBridge**: Event routing between components

#### 2.2 Data Storage
- **DynamoDB**: Metadata storage for:
  - User configurations
  - Job status and history
  - Performance metrics
- **Parameter Store**: Configuration and secrets
- **S3 Buckets**:
  - Input data storage
  - Results storage
  - Log archival
  - Configuration templates

#### 2.3 Monitoring & Logging
- **CloudWatch**: Metrics, logs, and alarms
- **X-Ray**: Distributed tracing
- **CloudTrail**: API activity logging

### 3. Compute Resources

#### 3.1 AWS Batch Environment (GC Classic)
- **Compute Environments**:
  - Managed compute environment for Graviton (ARM)
  - Managed compute environment for x86 (Intel/AMD)
- **Job Queues**:
  - Priority-based job queues
  - Separate queues for different processor architectures
- **Job Definitions**:
  - Container-based job definitions for GEOS-Chem
  - Parameter-driven configuration

#### 3.2 AWS ParallelCluster (GCHP)
- **Cluster Configurations**:
  - EFA-enabled HPC clusters
  - Auto-scaling capabilities
- **Scheduler Integration**:
  - Slurm integration for job management
- **Shared Storage**:
  - FSx for Lustre for high-performance I/O
  - EBS volumes for compute nodes

#### 3.3 Container Registry
- **Amazon ECR**: Storage for:
  - Base GEOS-Chem containers
  - Architecture-specific builds (ARM, x86)
  - Version-controlled images

### 4. Data Pipeline

#### 4.1 Input Data Management
- **DataSync**: Efficient data transfer
- **S3 Transfer Acceleration**: Optimized uploads
- **S3 Intelligent-Tiering**: Cost-optimization for storage

#### 4.2 Results Processing
- **Lambda Functions**: Post-processing triggers
- **Step Functions**: Coordinate multi-step processing
- **Amazon SQS**: Message queuing for processing tasks

## Detailed Component Specifications

### 1. Web Application Infrastructure

#### S3 Website Bucket
- **Bucket Policy**: Public read access, CORS enabled
- **Static Website**: Enabled with index and error documents
- **Versioning**: Enabled for rollback capability
- **Logging**: Access logging to separate bucket

#### CloudFront Distribution
- **Origin**: S3 website bucket
- **Behaviors**: Default caching policies
- **Security**: HTTPS required, TLSv1.2+
- **Functions**: Edge lambdas for authentication handling

#### API Gateway
- **Type**: REST API
- **Endpoints**: /simulations, /configurations, /results, /system
- **Authorization**: Cognito User Pools
- **Throttling**: Per-client rate limits
- **Logging**: Full request/response logging

### 2. Compute Infrastructure

#### AWS Batch - Graviton Environment
- **Instance Types**:
  - c7g.4xlarge to c7g.16xlarge
  - c8g.8xlarge to c8g.48xlarge
  - hpc7g.4xlarge to hpc7g.16xlarge
- **Allocation Strategy**: SPOT_CAPACITY_OPTIMIZED for cost savings
- **Min/Max vCPUs**: 0/5000
- **Compute Environment Tags**: Environment, Project, Owner

#### AWS Batch - x86 Environment
- **Instance Types**:
  - c5.4xlarge to c5.24xlarge
  - c6i.8xlarge to c6i.32xlarge
  - c6a.8xlarge to c6a.48xlarge
- **Allocation Strategy**: SPOT_CAPACITY_OPTIMIZED for cost savings
- **Min/Max vCPUs**: 0/5000
- **Compute Environment Tags**: Environment, Project, Owner

#### Job Definitions
```json
{
  "jobDefinitionName": "geos-chem-classic-arm64",
  "type": "container",
  "containerProperties": {
    "image": "012345678901.dkr.ecr.us-east-1.amazonaws.com/geos-chem:arm64-latest",
    "vcpus": 16,
    "memory": 64000,
    "command": [
      "/app/entrypoint.sh",
      "Ref::inputPath",
      "Ref::outputPath",
      "Ref::configFile"
    ],
    "jobRoleArn": "arn:aws:iam::012345678901:role/BatchJobRole",
    "volumes": [
      {
        "host": {
          "sourcePath": "/tmp"
        },
        "name": "scratch"
      }
    ],
    "mountPoints": [
      {
        "containerPath": "/scratch",
        "sourceVolume": "scratch"
      }
    ],
    "environment": [
      {
        "name": "AWS_REGION",
        "value": "us-east-1"
      }
    ]
  }
}
```

#### ParallelCluster Configuration
```yaml
Region: us-east-1
Image:
  Os: ubuntu2204
HeadNode:
  InstanceType: c7g.2xlarge
  Networking:
    SubnetId: subnet-0123456789abcdef0
  Ssh:
    KeyName: my-key-pair
Scheduling:
  Scheduler: slurm
  SlurmQueues:
    - Name: compute
      ComputeResources:
        - Name: hpc7g
          InstanceType: hpc7g.16xlarge
          MinCount: 0
          MaxCount: 20
          Efa:
            Enabled: true
      Networking:
        SubnetIds:
          - subnet-0123456789abcdef0
        PlacementGroup:
          Enabled: true
      ComputeSettings:
        LocalStorage:
          RootVolume:
            Size: 200
            VolumeType: gp3
SharedStorage:
  - Name: fsx
    StorageType: FsxLustre
    MountDir: /fsx
    FsxLustreSettings:
      StorageCapacity: 1200
      DeploymentType: SCRATCH_2
```

### 3. Data Storage Architecture

#### S3 Bucket Structure
- **User Data Bucket**:
  - `/{userId}/configurations/` - User simulation configurations
  - `/{userId}/results/{jobId}/` - Simulation results
  - `/{userId}/uploads/` - User-provided input data
- **System Bucket**:
  - `/templates/` - Configuration templates
  - `/benchmarks/` - Benchmark results
  - `/containers/` - Container build artifacts
- **Logging Bucket**:
  - `/api-logs/` - API Gateway logs
  - `/batch-logs/` - AWS Batch job logs
  - `/access-logs/` - S3 and CloudFront access logs

#### DynamoDB Tables

**Users Table**
- Partition Key: `userId`
- Attributes:
  - `email`
  - `createdAt`
  - `lastLogin`
  - `preferences`
  - `quotaLimit`
  - `quotaUsed`

**Simulations Table**
- Partition Key: `userId`
- Sort Key: `simulationId`
- Attributes:
  - `name`
  - `description`
  - `status`
  - `createdAt`
  - `startedAt`
  - `completedAt`
  - `configurationType`
  - `instanceType`
  - `costEstimate`
  - `actualCost`
  - `resultLocation`

**Benchmarks Table**
- Partition Key: `configurationType`
- Sort Key: `instanceType`
- Attributes:
  - `throughputDaysPerDay`
  - `costPerSimDay`
  - `memoryUsage`
  - `cpuEfficiency`
  - `timestamp`
  - `dataSource`

### 4. Security Architecture

#### IAM Roles

**Web Application Role**
- Permissions:
  - Cognito user pool read
  - DynamoDB read/write for application tables
  - S3 read for templates
  - API Gateway invoke

**Batch Job Role**
- Permissions:
  - S3 read for input data
  - S3 read/write for results
  - CloudWatch Logs write
  - ECR image pull
  - Parameter Store read

**Lambda Execution Roles**
- Granular permissions based on function purpose
- Follows principle of least privilege

#### Data Protection

**Encryption**
- S3 buckets: SSE-S3 encryption
- DynamoDB: Encryption at rest
- EBS volumes: Encrypted with CMK
- Data in transit: TLS 1.2+

**Access Controls**
- Bucket policies restricting access
- IAM policies for service accounts
- CORS configuration for API requests

## Deployment Methodology

### Infrastructure as Code

All infrastructure will be defined using AWS CDK in TypeScript, with components organized into logical stacks:

1. **Core Infrastructure Stack**
   - VPC and networking components
   - Security groups and IAM roles
   - Base S3 buckets

2. **Web Application Stack**
   - S3 website bucket
   - CloudFront distribution
   - Cognito user pool
   - API Gateway and base Lambdas

3. **Compute Resources Stack**
   - AWS Batch environments
   - ParallelCluster template
   - Container definitions

4. **Data Services Stack**
   - DynamoDB tables
   - Additional S3 buckets
   - Monitoring components

### Deployment Pipeline

- **Source Control**: GitHub repository
- **CI/CD**: AWS CodePipeline
- **Build**: AWS CodeBuild
- **Testing**: Automated tests in pipeline
- **Deployment**: CloudFormation change sets
- **Environments**: Dev, Staging, Production

## Cost Optimization Strategies

### Compute Optimization
- Spot Instances for Batch workloads (70% savings)
- Auto-scaling to zero when not in use
- Instance right-sizing based on workload
- Graviton instances for better price-performance

### Storage Optimization
- S3 Intelligent-Tiering for long-term storage
- Lifecycle policies for transitioning to cheaper storage
- Cleanup of temporary processing files

### Network Optimization
- CloudFront caching for web assets
- Region selection to minimize data transfer costs
- Compression of data payloads

## Monitoring and Alerting

### Key Metrics
- Job success/failure rates
- Compute resource utilization
- API response times
- Cost tracking

### Alerting Conditions
- Job failures
- Abnormal cost spikes
- Service availability issues
- Security events

### Dashboard Components
- System health overview
- Cost tracking and forecasting
- Resource utilization trends
- User activity monitoring

## Disaster Recovery

### Backup Strategy
- DynamoDB point-in-time recovery
- S3 bucket versioning
- Configuration backups
- Infrastructure as Code version control

### Recovery Procedures
- RTO (Recovery Time Objective): 2 hours
- RPO (Recovery Point Objective): 15 minutes
- Automated recovery procedures
- Manual recovery documentation

## Scaling Considerations

### User Scaling
- Cognito user pools scale automatically
- API Gateway with throttling and quotas
- DynamoDB capacity auto-scaling

### Compute Scaling
- AWS Batch environments scale based on queue depth
- ParallelCluster with auto-scaling groups
- Containerized applications for consistent deployment

### Storage Scaling
- S3 scales automatically
- DynamoDB provisioned capacity adjustment
- Monitoring-based scaling triggers

## Next Steps

1. Initial AWS environment setup
2. Core infrastructure deployment
3. Container definition and testing
4. Web interface development
5. Integration and system testing
6. Benchmark suite execution
7. Production deployment
8. Monitoring and optimization

## Appendix

### AWS Service Limits to Monitor
- VPC limits
- EC2 Spot Instance limits
- API Gateway requests per second
- Lambda concurrent executions
- S3 request rates

### Reference Architecture Diagrams
(Include detailed architecture diagrams here)

### Cost Estimation
(Include detailed cost projections for different usage patterns)
