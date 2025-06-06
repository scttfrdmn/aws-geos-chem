# GEOS-Chem AWS Cloud Runner

A comprehensive solution for running GEOS-Chem atmospheric chemistry simulations on AWS cloud infrastructure with cost-efficiency, scalability, and ease of use.

## Overview

The GEOS-Chem AWS Cloud Runner enables researchers to run GEOS-Chem simulations in the cloud without requiring expertise in cloud infrastructure. It provides:

- Automated deployment of AWS resources
- Efficient use of Graviton and x86 instances with spot pricing
- Real-time cost tracking and optimization
- Result visualization and analysis
- Integration with existing GEOS-Chem workflows

## Components

The project is organized into several key components:

### AWS CDK Infrastructure

The [aws-geos-chem-cdk](./aws-geos-chem-cdk/) directory contains the AWS Cloud Development Kit (CDK) code to deploy the necessary infrastructure:

- VPC and networking components
- AWS Batch compute environments and job queues
- Lambda functions for job submission and monitoring
- Step Functions workflow for simulation orchestration
- S3 buckets for data storage
- DynamoDB tables for metadata
- CloudWatch dashboards for monitoring
- Cost tracking and optimization services

### Docker Container

The [container](./container/) directory includes the Dockerfile and scripts for the GEOS-Chem container images:

- Optimized for Graviton (ARM64) and x86 architectures
- Pre-configured with necessary dependencies
- Automated data download and result processing

### ParallelCluster Configuration

The [parallel-cluster](./parallel-cluster/) directory contains the configuration for AWS ParallelCluster, used for multi-node GCHP simulations:

- HPC cluster configuration with EFA networking
- FSx for Lustre for shared storage
- Auto-scaling configuration
- Integration with the main workflow

### Benchmarking Tools

The [benchmarking](./benchmarking/) directory includes tools to evaluate performance and cost:

- Scripts to run standardized benchmarks
- Analysis tools to process and visualize results
- Comparison across instance types and configurations

### Visualization Service

The [visualization](./visualization/) directory contains the components for visualization of simulation results:

- Lambda functions to generate plots and maps
- Layer with scientific Python packages
- APIs for web interface integration

### Cost Tracking Service

The [cost-tracking](./cost-tracking/) directory provides real-time cost monitoring and optimization:

- Wall-clock time tracking for each simulation
- Cost estimation based on instance type and usage
- Budget management and alerts
- Optimization recommendations

## Getting Started

1. **Prerequisites**:
   - AWS account with appropriate permissions
   - AWS CLI configured
   - Node.js 18.x or later
   - AWS CDK v2 installed (`npm install -g aws-cdk`)

2. **Installation**:
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/aws-geos-chem.git
   cd aws-geos-chem/aws-geos-chem-cdk
   
   # Install dependencies
   npm install
   
   # Bootstrap AWS environment (if not already done)
   npm run bootstrap
   ```

3. **Deployment**:
   ```bash
   # Deploy to development environment
   npm run deploy:dev

   # Deploy with a specific AWS profile
   npm run deploy:dev -- --profile=my-custom-profile

   # Deploy to test or production environments
   npm run deploy:test
   npm run deploy:prod
   ```

4. **Running a Simulation**:
   After deployment, you can run simulations using the web interface or directly through the API.

## Development

### Linting

The project includes linting for TypeScript, JavaScript, Python, and Bash scripts:

```bash
# From project root
./scripts/lint_all.sh

# From aws-geos-chem-cdk directory
npm run lint        # TypeScript and JavaScript only
npm run lint:py     # Python only
npm run lint:bash   # Bash scripts only
npm run lint:all    # All languages
npm run lint:fix    # Fix auto-fixable issues in TypeScript and JavaScript
```

### AWS Profiles

The project supports using different AWS profiles for different environments:

1. **Configuration Files**: Each environment (dev, test, prod) has its own configuration in `aws-geos-chem-cdk/config/` that can specify a different AWS profile.

2. **Command Line**: You can override the profile at runtime:
   ```bash
   npm run deploy:dev -- --profile=my-custom-profile
   ```

3. **Environment Variables**: Standard AWS environment variables are also respected.

## Documentation

- [Infrastructure Design](./infrastructure-design.md)
- [Container Definition](./container-definition.md)
- [Benchmarking Plan](./benchmarking-plan.md)
- [Web Interface Specification](./web-interface-spec.md)
- [Project Documentation](./project-documentation.md)

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](./LICENSE) file for details.

## Contributors

- Original implementation by Claude + scttfrdmn