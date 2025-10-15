# Benchmarking Status Report

## Overview
This report documents the status of the GEOS-Chem benchmarking system implementation and the troubleshooting steps taken to address issues encountered.

## Current Status

- **Compute Environment**: VALID
  - Fixed issue where security group and subnet were in different VPCs
  - Created new security group in correct VPC: `sg-0b4a0197cd5878b0d`
  - Updated compute environment to use the new security group
  - Configured minimum vCPUs to 16 to trigger scaling

- **Job Queue**: VALID
  - Queue is properly connected to the compute environment

- **Benchmark Jobs**:
  - 5 jobs are in RUNNABLE state
  - New error identified: "MISCONFIGURATION:JOB_RESOURCE_REQUIREMENT - The job resource requirement (vCPU/memory/GPU) is higher than that can be met by the CE(s) attached to the job queue."
  - Compute environment has c7g.4xlarge instances with 16 vCPUs and 32GiB memory
  - Job definition also requests 16 vCPUs and 32GiB memory

## Issues Encountered and Resolved

1. **VPC Configuration Mismatch**
   - **Issue**: Security group was in VPC `vpc-095b2a5443d394b4a` while subnet was in VPC `vpc-0d5f032a26b3846da`
   - **Resolution**: Created a new security group in the correct VPC and updated the compute environment

2. **Compute Environment Scaling**
   - **Issue**: Compute environment wasn't scaling up automatically
   - **Resolution**: Set minimum vCPUs to 16 to force scaling

## Current Issues

1. **Job Resource Requirements Mismatch**
   - **Issue**: Jobs report that their resource requirements cannot be met by the compute environment
   - **Analysis**: 
     - Compute environment uses c7g.4xlarge instances with 16 vCPUs, 32GiB memory
     - Job definition requests 16 vCPUs, 32GiB memory
     - These should match, but jobs still show resource mismatch error
   - **Potential causes**:
     - AWS Batch reserves some resources for system overhead
     - There may be an architecture mismatch
     - The job definition might not be compatible with the compute environment

## Next Steps

1. **Adjust Job Resource Requirements**
   - Update job definition to request slightly less than 16 vCPUs (e.g., 14 vCPUs) to account for overhead
   - Update job definition to request slightly less memory (e.g., 30GiB) to account for overhead

2. **Verify Image Compatibility**
   - Ensure the Docker image is compatible with the ARM64 architecture used by Graviton instances
   - Test with a simpler container image

3. **Check AWS Batch Quotas**
   - Confirm there are no service quota issues preventing instance launch

4. **Monitor Infrastructure**
   - Continue monitoring compute environment status
   - Check for any instances being provisioned

## Lessons Learned

1. **Infrastructure Configuration**
   - Security groups and subnets must be in the same VPC
   - Verify VPC dependencies when deploying infrastructure with CDK

2. **AWS Batch Scaling**
   - Setting a minimum vCPU count helps trigger instance launching
   - There may be a delay between scaling decision and instance availability

3. **Resource Requirements**
   - AWS Batch needs some overhead beyond the exact instance specifications
   - Job resource requirements should be slightly lower than the total available on the instance

## Commands for Monitoring

```bash
# Check job status
export AWS_PROFILE=aws && export AWS_REGION=us-west-2
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status RUNNING
aws batch list-jobs --job-queue geos-chem-graviton-queue --job-status SUCCEEDED

# Check compute environment
aws batch describe-compute-environments --compute-environments geos-chem-graviton

# Check EC2 instances
aws ec2 describe-instances --filters "Name=tag:aws:batch:compute-environment,Values=geos-chem-graviton"

# Check job status reasons
aws batch describe-jobs --jobs JOB_ID | jq '.jobs[0].statusReason'
```