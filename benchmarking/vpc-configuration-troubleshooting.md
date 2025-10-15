# VPC Configuration Troubleshooting Guide

This document outlines the steps to diagnose and resolve VPC configuration issues with AWS Batch compute environments for the GEOS-Chem benchmarking system.

## Diagnosing VPC Configuration Issues

If your compute environment shows an INVALID status with a message about security groups, follow these steps to diagnose the issue:

### 1. Check Compute Environment Status

```bash
aws batch describe-compute-environments --compute-environments geos-chem-graviton
```

Look for the `status` and `statusReason` fields. Common error messages related to VPC configuration:

```
"status": "INVALID",
"statusReason": "CLIENT_ERROR - One or more security groups in the launch template are not linked to the VPCs configured in the Auto Scaling group"
```

### 2. Check Subnet's VPC

Identify which VPC contains the subnet used by your compute environment:

```bash
# Get the subnet ID from compute environment description
SUBNET_ID=$(aws batch describe-compute-environments --compute-environments geos-chem-graviton --query 'computeEnvironments[0].computeResources.subnets[0]' --output text)

# Check which VPC this subnet belongs to
aws ec2 describe-subnets --subnet-ids $SUBNET_ID | jq '.Subnets[] | {SubnetId, VpcId, CidrBlock, AvailabilityZone}'
```

### 3. Check Security Group's VPC

Verify which VPC contains the security group used by your compute environment:

```bash
# Get the security group ID from compute environment description
SG_ID=$(aws batch describe-compute-environments --compute-environments geos-chem-graviton --query 'computeEnvironments[0].computeResources.securityGroupIds[0]' --output text)

# Check which VPC this security group belongs to
aws ec2 describe-security-groups --group-ids $SG_ID | jq '.SecurityGroups[] | {GroupId, VpcId, GroupName, Description}'
```

### 4. Compare VPC IDs

If the VPC IDs for the subnet and security group are different, you've found the issue. Security groups and subnets used in the same compute environment must be in the same VPC.

## Resolving VPC Configuration Issues

### 1. Create a New Security Group in the Correct VPC

Create a new security group in the same VPC as the subnet:

```bash
# Get the VPC ID of the subnet
SUBNET_VPC_ID=$(aws ec2 describe-subnets --subnet-ids $SUBNET_ID --query 'Subnets[0].VpcId' --output text)

# Create a new security group in this VPC
aws ec2 create-security-group \
  --group-name geos-chem-benchmark-sg \
  --description "Security group for GEOS-Chem benchmarking" \
  --vpc-id $SUBNET_VPC_ID
```

### 2. Configure Security Group Rules

Add necessary inbound and outbound rules to the new security group:

```bash
# Add SSH access (example rule)
aws ec2 authorize-security-group-ingress \
  --group-id $NEW_SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0
```

### 3. Update Compute Environment

Update the compute environment to use the new security group:

```bash
aws batch update-compute-environment \
  --compute-environment geos-chem-graviton \
  --compute-resources "securityGroupIds=$NEW_SG_ID"
```

### 4. Verify Compute Environment Status

Check if the compute environment status changes to VALID:

```bash
aws batch describe-compute-environments --compute-environments geos-chem-graviton
```

Wait until you see:

```
"status": "VALID",
"statusReason": "ComputeEnvironment Healthy"
```

### 5. Update Jobs (if needed)

If jobs were previously submitted and are stuck in RUNNABLE state with an error message about the compute environment being invalid, you may need to cancel those jobs and resubmit them:

```bash
# List jobs in RUNNABLE state
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status RUNNABLE

# Cancel a stuck job if needed
aws batch cancel-job --job-id JOB_ID --reason "Fixing compute environment VPC configuration"

# Resubmit the job after compute environment is VALID
```

## Preventing VPC Configuration Issues

To prevent VPC configuration issues in the future:

1. **Always Validate VPC Components**: Before creating a compute environment, verify that all networking components (subnets, security groups) are in the same VPC.

2. **Use CloudFormation or CDK**: Define all networking resources in the same CloudFormation or CDK stack to ensure consistency.

3. **Document VPC Details**: Keep a record of which VPC is used for the benchmarking infrastructure.

4. **Update Deployment Scripts**: Modify deployment scripts to automatically validate VPC consistency before creating resources.

## Example Commands for Quick VPC Validation

```bash
# Get all VPCs
aws ec2 describe-vpcs | jq '.Vpcs[] | {VpcId, CidrBlock}'

# Create a validation script
cat > validate-vpc-config.sh << 'EOF'
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
EOF
chmod +x validate-vpc-config.sh
```

## Related AWS Documentation

- [AWS Batch Compute Environments](https://docs.aws.amazon.com/batch/latest/userguide/compute_environments.html)
- [Amazon VPC User Guide](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
- [Security Groups for Your VPC](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html)