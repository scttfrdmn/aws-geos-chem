# AWS Batch Best Practices for GEOS-Chem Benchmarking

This document outlines best practices and lessons learned when using AWS Batch for GEOS-Chem benchmarking.

## Resource Requirements

### 1. Account for AWS Batch Overhead

AWS Batch reserves some resources on each instance for system overhead. When creating job definitions, request slightly less than the total available resources on the instance:

| Instance Type | Total vCPUs | Total Memory | Recommended vCPUs | Recommended Memory |
|---------------|-------------|--------------|-------------------|-------------------|
| c7g.4xlarge   | 16          | 32 GiB       | 15                | 30 GiB            |
| c6i.4xlarge   | 16          | 32 GiB       | 15                | 30 GiB            |
| c6g.4xlarge   | 16          | 32 GiB       | 15                | 30 GiB            |

**Example Job Definition:**
```json
{
  "resourceRequirements": [
    {"type": "VCPU", "value": "15"},
    {"type": "MEMORY", "value": "30000"}
  ]
}
```

### 2. Right-size Job Requirements

Ensure that your job resource requirements match the capabilities of your instances. If jobs request more resources than available on the instance, they will remain in RUNNABLE state with this error:

```
MISCONFIGURATION:JOB_RESOURCE_REQUIREMENT - The job resource requirement (vCPU/memory/GPU) is higher than that can be met by the CE(s) attached to the job queue.
```

## VPC Configuration

### 1. Security Groups and Subnets Must Be in Same VPC

A common error occurs when the security group and subnet specified in the compute environment are in different VPCs:

```
CLIENT_ERROR - One or more security groups in the launch template are not linked to the VPCs configured in the Auto Scaling group
```

To fix this issue:
1. Determine which VPC contains your subnet: `aws ec2 describe-subnets --subnet-ids <subnet-id>`
2. Create a security group in that VPC: `aws ec2 create-security-group --vpc-id <vpc-id> --group-name <name>`
3. Update the compute environment to use the new security group

### 2. VPC Validation Script

Use this script to validate VPC configuration before creating resources:

```bash
#!/bin/bash
SUBNET_ID=$1
SG_ID=$2

SUBNET_VPC=$(aws ec2 describe-subnets --subnet-ids $SUBNET_ID --query 'Subnets[0].VpcId' --output text)
SG_VPC=$(aws ec2 describe-security-groups --group-ids $SG_ID --query 'SecurityGroups[0].VpcId' --output text)

echo "Subnet $SUBNET_ID is in VPC $SUBNET_VPC"
echo "Security Group $SG_ID is in VPC $SG_VPC"

if [ "$SUBNET_VPC" = "$SG_VPC" ]; then
  echo "✅ VPC configuration is valid"
  exit 0
else
  echo "❌ VPC configuration is invalid - subnet and security group are in different VPCs"
  exit 1
fi
```

## Architectures and Instance Types

### 1. Separate Compute Environments by Architecture

AWS Batch compute environments cannot mix ARM64 (Graviton) and x86 instance types. Use separate compute environments for different architectures:

- Graviton (ARM64): c7g, c6g, m7g instances
- x86: c6i, m6i, r6i instances

### 2. Instance Type Considerations

When selecting instance types, consider:
- CPU efficiency (C-series has highest CPU-to-memory ratio)
- Memory requirements (M-series has balanced CPU-to-memory ratio)
- Processor generation (newer generations are generally more efficient)

## Container Images

### 1. Multi-architecture Considerations

When building containers for ARM64 (Graviton):
- Use `--platform=linux/arm64` with Docker build
- Test containers locally if possible before pushing to ECR
- Include the `--allowerasing` flag with dnf/yum to resolve package conflicts

### 2. Container Tag Best Practices

Use a consistent tagging strategy:
- Tag with both version (`benchmark-v1`) and `latest`
- Include architecture information in the tag if maintaining multiple architectures

## Scaling Behavior

### 1. Triggering Scale-Up

To trigger instance provisioning when no instances are running:
- Set `minvCpus` to a non-zero value (e.g., 16)
- AWS Batch may still take some time to provision instances

### 2. Monitoring Scaling

Monitor the `desiredvCpus` value to see if AWS Batch is trying to scale:

```bash
aws batch describe-compute-environments --compute-environments <name> | jq '.computeEnvironments[].computeResources.desiredvCpus'
```

## AWS Region Configuration

### 1. Explicit Region Configuration

Always specify the AWS region to avoid "No region" errors:
- Set in environment: `export AWS_REGION=us-west-2`
- Configure AWS profile: `aws configure set region us-west-2 --profile aws`
- Include in boto3 clients: `boto3.client('batch', region_name=region)`

### 2. Region-specific Resources

Resources like ECR repos and AMIs are region-specific. Ensure you're using the correct region for all commands.

## Job Monitoring and Troubleshooting

### 1. Common Status Reasons and Solutions

| Status Reason | Meaning | Solution |
|---------------|---------|----------|
| RESOURCE_REQUIREMENT | Job requires more resources than available | Reduce job resource requirements |
| INVALID_COMPUTE_ENVIRONMENT | Issue with compute environment | Check compute environment status |
| NO_CAPACITY_IN_QUEUE | No instances available | Check if scaling is happening |

### 2. Useful Monitoring Commands

```bash
# Check job statuses
aws batch list-jobs --job-queue <queue> --job-status RUNNABLE

# Check specific job details
aws batch describe-jobs --jobs <job-id>

# Check compute environment status
aws batch describe-compute-environments --compute-environments <name>

# Check for instance scaling
aws ec2 describe-instances --filters "Name=tag:aws:batch:compute-environment,Values=<env>"
```

## Cost Optimization

### 1. Scale to Zero

Configure compute environments to scale to zero when not in use:
- Set `minvCpus` to 0 when not running benchmarks
- Set `desiredvCpus` to 0 when cleaning up

### 2. Instance Selection

Choose the most cost-effective instance type for your workload:
- Consider using Spot instances for non-critical benchmarks
- Use Graviton instances for cost savings (up to 20% cheaper than x86)

## Security Best Practices

### 1. IAM Roles and Policies

Use the principle of least privilege:
- Create specific IAM roles for batch jobs
- Limit permissions to what's actually needed

### 2. Security Groups

Restrict network access to only what's needed:
- Limit inbound rules to necessary ports
- Consider using VPC endpoints for AWS services