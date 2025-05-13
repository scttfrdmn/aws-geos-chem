# GEOS-Chem High Performance (GCHP) ParallelCluster

This directory contains configuration and setup scripts for running GEOS-Chem High Performance (GCHP) on AWS ParallelCluster. GCHP is a version of GEOS-Chem designed for multi-node execution using MPI, which requires specialized HPC infrastructure.

## Overview

AWS ParallelCluster is a cluster management tool that helps you deploy and manage high-performance computing (HPC) clusters in the AWS Cloud. The configuration in this directory sets up:

1. A head node for job submission and management
2. Auto-scaling compute nodes with:
   - Graviton (ARM64) compute nodes with EFA networking support
   - x86_64 compute nodes with EFA networking support
3. FSx for Lustre high-performance shared storage
4. EFS storage for input data
5. Slurm job scheduler integration

## Prerequisites

Before deploying the cluster, you need:

1. AWS CLI configured with appropriate permissions
2. AWS ParallelCluster CLI installed (`pip install aws-parallelcluster`)
3. An existing VPC with a subnet that has internet access
4. An EC2 key pair for SSH access
5. An S3 bucket for scripts and configurations
6. Appropriate IAM permissions to create and manage the required resources

## Files

- `gchp-cluster-config.yaml` - ParallelCluster configuration template
- `gchp-node-setup.sh` - Script to set up head node and compute nodes
- `deploy-cluster.sh` - Script to deploy and manage the ParallelCluster

## Deployment

To deploy the GCHP ParallelCluster:

```bash
# Make scripts executable
chmod +x deploy-cluster.sh

# Deploy the cluster
./deploy-cluster.sh \
  --name gchp-cluster \
  --region us-east-1 \
  --env dev \
  --subnet subnet-123456789 \
  --key your-key-pair-name \
  --bucket your-scripts-bucket
```

## Usage

After deployment, you can connect to the head node using SSH:

```bash
ssh -i ~/.ssh/your-key-pair.pem ubuntu@head-node-ip
```

### Submitting Jobs

To submit a GCHP simulation job, use the `submit-gchp` command on the head node:

```bash
submit-gchp \
  -c s3://your-bucket/configs/gchp-config.yml \
  -o s3://your-bucket/results/gchp-run-1 \
  -d 30 \
  -n 4 \
  -q gchp-graviton
```

Where:
- `-c` specifies the S3 path to the simulation configuration file
- `-o` specifies the S3 path for storing results
- `-d` specifies the simulation duration in days
- `-n` specifies the number of nodes to use (1-8)
- `-q` specifies the queue to use (`gchp-graviton` or `gchp-x86`)

### Monitoring Jobs

To check the status of your jobs:

```bash
# Check all jobs
gchp-status

# Check specific job
gchp-status 12345
```

### Cleaning Up Old Run Directories

To clean up old simulation run directories:

```bash
# Clean up run directories older than 14 days (with confirmation)
gchp-cleanup

# Clean up run directories older than 7 days (with confirmation)
gchp-cleanup -d 7

# Clean up run directories older than 30 days (without confirmation)
gchp-cleanup -d 30 -y
```

## Cluster Management

To update the cluster configuration:

```bash
./deploy-cluster.sh \
  --name gchp-cluster \
  --region us-east-1 \
  --env dev \
  --subnet subnet-123456789 \
  --key your-key-pair-name \
  --bucket your-scripts-bucket \
  --action update
```

To delete the cluster:

```bash
./deploy-cluster.sh \
  --name gchp-cluster \
  --region us-east-1 \
  --subnet subnet-123456789 \
  --key your-key-pair-name \
  --bucket your-scripts-bucket \
  --action delete
```

## Cost Considerations

The cluster is configured to use AWS Spot instances for compute nodes when available, which can reduce costs by up to 70%. Compute nodes automatically scale down when not in use to minimize costs. However, be aware of the following ongoing costs:

1. Head node (running continuously)
2. FSx for Lustre file system (1200 GB)
3. EFS file system
4. S3 storage for results

## Performance Considerations

For optimal performance:

1. Use Graviton (ARM64) instances for cost-effective performance
2. For large simulations requiring more memory, use the memory-optimized instances
3. Place input data in the EFS file system to avoid downloading it for each simulation
4. For I/O intensive workloads, consider adjusting the FSx for Lustre configuration