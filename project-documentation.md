# GEOS-Chem AWS Cloud Runner

## Project Overview

GEOS-Chem AWS Cloud Runner is a system that enables researchers to run GEOS-Chem atmospheric chemistry simulations on AWS in an efficient, cost-effective manner. The system provides a user-friendly web interface for configuring simulations, leverages AWS Batch for computation, and automates the deployment and management of resources.

## Objectives

- Create a simple, accessible way for researchers to run GEOS-Chem without requiring AWS expertise
- Optimize for cost-performance using AWS Graviton processors
- Support both GEOS-Chem Classic (single-node) and GEOS-Chem High Performance (multi-node) configurations
- Collect and provide benchmark data to guide configuration choices
- Minimize operational overhead through automation

## System Architecture

The system consists of four main components:

1. **Web Configuration Interface**: A web application for configuring and submitting simulations
2. **Job Management Service**: Handles job submission, monitoring, and resource management
3. **Compute Environment**: AWS Batch and optionally AWS ParallelCluster configurations
4. **Results Management**: Storage, processing, and retrieval of simulation outputs

![System Architecture Diagram](architecture-diagram-placeholder.png)

## Component Details

### 1. Web Configuration Interface

A static website hosted on S3 that provides:

- User authentication
- Simulation configuration forms (for both GC Classic and GCHP)
- Option selection for processor types (Graviton, Intel, AMD)
- Cost and performance estimation based on benchmark data
- Job monitoring and management
- Results visualization and download

**Technologies**:
- Frontend: HTML, JavaScript, CSS
- Hosting: Amazon S3 website
- Authentication: Amazon Cognito
- API: Amazon API Gateway + Lambda

### 2. Job Management Service

Serverless backend services that:

- Process and validate configuration submissions
- Generate appropriate job definitions
- Submit jobs to AWS Batch or ParallelCluster
- Monitor job status
- Manage data transfer between S3 and compute resources

**Technologies**:
- AWS Lambda functions
- AWS Step Functions for workflow orchestration
- Amazon DynamoDB for job metadata
- Amazon EventBridge for notifications

### 3. Compute Environment

Configurable compute resources that:

- Support various processor architectures (Graviton, Intel, AMD)
- Provide appropriate scaling for workloads
- Optimize for cost using Spot Instances where appropriate

**Technologies**:
- AWS Batch for GC Classic (single-node)
- AWS ParallelCluster for GCHP (multi-node with EFA)
- ECS/Docker for containerization
- Amazon S3 for data storage

### 4. Results Management

Services for handling simulation outputs:

- Automated post-processing of raw outputs
- Results visualization capabilities
- Long-term storage options
- Data sharing capabilities

**Technologies**:
- Amazon S3 for storage
- AWS Lambda for post-processing
- Amazon CloudFront for data distribution

## Implementation Plan

### Phase 1: Foundation (1-2 months)
- Set up basic infrastructure with AWS CDK or Terraform
- Create containerized GEOS-Chem environments for AWS Batch
- Develop simple web interface for GC Classic configurations
- Implement job submission and monitoring
- Establish basic results storage and retrieval

### Phase 2: Expansion (2-3 months)
- Add support for GCHP with ParallelCluster
- Implement comprehensive benchmarking across processor types
- Enhance web interface with cost estimation and recommendations
- Add results visualization capabilities
- Implement user authentication and multi-user support

### Phase 3: Optimization (3+ months)
- Refine performance across different instance types
- Implement advanced cost optimization strategies
- Add support for custom input data
- Develop comprehensive documentation and tutorials
- Implement community features (sharing configurations, results)

## Benchmark Strategy

Establish a comprehensive benchmark suite that covers:

1. **Scientific configurations**:
   - Full chemistry
   - Aerosol-only
   - Greenhouse gas simulations
   - Transport tracers

2. **Spatial and temporal scales**:
   - Various global resolutions
   - Nested domain simulations
   - Short, medium, and long-term runs

3. **Hardware configurations**:
   - Processor types: Graviton3, Graviton3E, Graviton4, Intel, AMD
   - Single-node vs. multi-node setups
   - Memory and network configurations

4. **Key metrics**:
   - Performance (throughput, scaling)
   - Cost (per simulation day/month)
   - Resource utilization (CPU, memory, network)

## Technical Considerations

### Container Strategy
- Base container with GEOS-Chem dependencies
- Separate containers for different architectures (ARM, x86)
- Runtime configuration via environment variables and mounted volumes

### Data Management
- Leverage existing GEOS-Chem data in AWS S3 (s3://gcgrid)
- Implement efficient data fetching to minimize transfer costs
- Store results in user-specific S3 buckets
- Implement lifecycle policies for cost management

### Security Considerations
- Fine-grained IAM permissions
- Secure API access with API Gateway
- User isolation for multi-tenant usage
- Data encryption at rest and in transit

## Cost Management

- Use Spot Instances where appropriate (70% savings)
- Implement auto-shutdown for idle resources
- Store data on S3 rather than EBS when not actively computing
- Provide clear cost estimation before job submission
- Implement budget alerting and limits

## Roadmap and Milestones

### Milestone 1: Proof of Concept
- Basic web interface
- Single-node GC Classic on Graviton
- Manual job submission and management
- S3-based results storage

### Milestone 2: Basic Production System
- Enhanced web interface
- Support for GCHP
- Automated job management
- Initial benchmarks for Graviton processors

### Milestone 3: Full-Featured Platform
- Comprehensive processor support
- Advanced benchmarking
- Cost optimization
- Community features

## Resources Required

- AWS account with appropriate limits
- Development environment
- Test cases for validation
- Initial funding for development and benchmarking costs
- Documentation and training materials

## Success Metrics

- Number of active users
- Simulation throughput
- Cost savings compared to traditional HPC
- User satisfaction and feedback
- Scientific publications enabled by the platform
