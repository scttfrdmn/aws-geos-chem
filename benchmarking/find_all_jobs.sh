#!/bin/bash
# find_all_jobs.sh - Search for all AWS Batch jobs across queues and statuses

set -e

# Set environment variables for AWS profile
export AWS_PROFILE=aws
export AWS_REGION=us-west-2

echo "Searching for all AWS Batch jobs..."
echo "Using AWS Profile: ${AWS_PROFILE}"
echo "Using AWS Region: ${AWS_REGION}"

# List all job queues
echo "=== Available Job Queues ==="
aws batch describe-job-queues --query "jobQueues[].jobQueueName" --output table

# List job statuses in all queues
QUEUES=("geos-chem-graviton-queue" "geos-chem-intel-queue-new" "geos-chem-amd-queue-new")
STATUSES=("SUBMITTED" "PENDING" "RUNNABLE" "STARTING" "RUNNING" "SUCCEEDED" "FAILED")

for QUEUE in "${QUEUES[@]}"; do
  echo "=== Checking jobs in queue: ${QUEUE} ==="
  
  for STATUS in "${STATUSES[@]}"; do
    echo "Status: ${STATUS}"
    aws batch list-jobs --job-queue "${QUEUE}" --job-status "${STATUS}" --query "jobSummaryList[].{JobId:jobId,JobName:jobName,Status:status,CreatedAt:createdAt}" --output table
    echo ""
  done
done

# Try to check for jobs from any queue with known job IDs
echo "=== Checking specific job IDs ==="
JOB_IDS=(
  "5eb42700-4d1e-4d99-9c22-9c982719256e"  # Graviton job
  "a27f1478-c204-4aab-9dfa-5f1760d171b9"  # Intel job
)

for JOB_ID in "${JOB_IDS[@]}"; do
  echo "Job ID: ${JOB_ID}"
  aws batch describe-jobs --jobs "${JOB_ID}" --query "jobs[0].{JobId:jobId,JobName:jobName,Status:status,CreatedAt:createdAt,StatusReason:statusReason}" --output table
done

# List recent CloudWatch logs
echo "=== CloudWatch Logs ==="
aws logs describe-log-groups --query "logGroups[].logGroupName" --output table