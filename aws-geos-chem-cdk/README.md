# GEOS-Chem AWS Cloud Runner - CDK Infrastructure

This repository contains the AWS CDK infrastructure code for the GEOS-Chem AWS Cloud Runner system. It defines all necessary AWS resources to run GEOS-Chem atmospheric chemistry simulations in the AWS cloud efficiently and cost-effectively.

## Architecture

The GEOS-Chem AWS Cloud Runner infrastructure consists of the following stacks:

1. **Core Infrastructure Stack**
   - VPC and networking components
   - Security groups
   - IAM roles
   - Base S3 buckets

2. **Data Services Stack**
   - S3 buckets for user data, system data, and logs
   - DynamoDB tables for users, simulations, and benchmarks

3. **Compute Resources Stack**
   - AWS Batch compute environments (Graviton and x86)
   - Job queues and definitions
   - ECR repositories for container images

4. **Job Management Stack**
   - Step Functions workflow
   - Lambda functions for job submission and monitoring
   - DynamoDB integration

5. **Visualization Stack**
   - API for visualization generation
   - Lambda functions for data processing
   - S3 storage for visualization outputs

6. **Auth Stack**
   - Cognito User Pool and Identity Pool
   - API Gateway for authentication operations
   - Lambda triggers for user management

7. **Cost Tracking Stack**
   - DynamoDB tables for cost tracking and budgets
   - Lambda functions for cost tracking and optimization
   - APIs for cost reporting

8. **Web Application Stack**
   - S3 website hosting
   - CloudFront distribution
   - API Gateway integration

## Prerequisites

Before deploying this infrastructure, you need:

1. [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
2. [Node.js](https://nodejs.org/) (v18 or higher)
3. [AWS CDK](https://aws.amazon.com/cdk/) (v2 or higher)

## Getting Started

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Bootstrap your AWS environment (if not already done):
```bash
npm run bootstrap
```

## Deployment

Deploying to different environments:

```bash
# Deploy to development environment
npm run deploy:dev

# Deploy to test environment
npm run deploy:test

# Deploy to production environment
npm run deploy:prod
```

For more targeted deployments, you can use the individual stack deployment scripts:

```bash
# Deploy only the core infrastructure stack
npm run deploy:core

# Deploy only the compute resources stack
npm run deploy:compute

# Deploy only the data services stack
npm run deploy:data

# Deploy only the web application stack
npm run deploy:web
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Configuration

Environment-specific configuration is stored in the `config/` directory:

- `default.env`: Default configuration values used by all environments.
- `dev.env`: Development environment specific overrides.
- `test.env`: Test environment specific overrides.
- `prod.env`: Production environment specific overrides.

You can customize these configuration files to adjust instance types, resource limits, and other parameters.

## Cleanup

To clean up resources created by the GEOS-Chem AWS Cloud Runner:

```bash
# Clean up development environment
npm run cleanup dev

# Clean up test environment
npm run cleanup test

# Clean up production environment
npm run cleanup prod
```

## Useful Commands

* `npm run build`   - Compile TypeScript to JavaScript
* `npm run watch`   - Watch for changes and compile
* `npm run cdk -- list`  - List all stacks in the app
* `npm run synth`   - Synthesize CloudFormation template
* `npm run diff`    - Compare deployed stack with current state

## Security Considerations

- All S3 buckets have public access blocked
- HTTPS is enforced for web application access
- IAM roles follow least privilege principle
- DynamoDB tables are encrypted
- API access is secured with Cognito authentication

## Cost Optimization

- AWS Batch environments scale to zero when not in use
- Spot Instances are used for compute resources
- S3 lifecycle rules for cost-effective storage
- Auto-scaling based on demand
- Budget tracking and cost allocation

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests (`npm test`)
4. Submit a pull request

## License

ISC