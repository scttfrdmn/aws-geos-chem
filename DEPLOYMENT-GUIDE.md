# GEOS-Chem AWS Cloud Runner - Deployment Guide

**Environment:** Development
**AWS Profile:** aws
**AWS Region:** us-west-2
**Date:** October 15, 2025

---

## Prerequisites

### 1. AWS Configuration
```bash
# Verify AWS CLI is configured
aws sts get-caller-identity --profile aws --region us-west-2

# Expected output:
# {
#     "UserId": "AIDAXXXXXXXXXXXXXXXXX",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-user"
# }
```

### 2. Required Tools
- AWS CLI v2.x
- AWS CDK v2.x (`npm install -g aws-cdk`)
- Node.js 18+
- Docker (for container builds)
- jq (for JSON parsing)

### 3. Verify Installation
```bash
aws --version          # Should be 2.x
cdk --version          # Should be 2.x
node --version         # Should be 18.x+
docker --version       # Should be 20.x+
```

---

## Step 1: CDK Bootstrap (First Time Only)

```bash
cd /Users/scttfrdmn/src/aws-geos-chem/aws-geos-chem-cdk

# Bootstrap CDK in us-west-2
export AWS_PROFILE=aws
export AWS_REGION=us-west-2

cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-west-2
```

**Expected Output:**
```
 ✅  Environment aws://123456789012/us-west-2 bootstrapped
```

---

## Step 2: Deploy Authentication Stack

```bash
# Set environment variables
export AWS_PROFILE=aws
export AWS_REGION=us-west-2
export ENV=dev

# Build TypeScript
npm run build

# Review changes
cdk diff geos-chem-auth

# Deploy auth stack
cdk deploy geos-chem-auth --require-approval never

# Save outputs
cdk deploy geos-chem-auth --outputs-file auth-outputs.json
```

**Expected Resources Created:**
- Cognito User Pool: `geos-chem-users`
- User Pool Client: `geos-chem-web-app`
- Identity Pool: `geos_chem_identity_pool`
- IAM roles for authenticated users

**Verification:**
```bash
# Get User Pool ID
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 \
  --profile aws --region us-west-2 \
  --query 'UserPools[?Name==`geos-chem-users`].Id' --output text)

echo "User Pool ID: $USER_POOL_ID"

# Get User Pool details
aws cognito-idp describe-user-pool \
  --user-pool-id $USER_POOL_ID \
  --profile aws --region us-west-2
```

---

## Step 3: Deploy Core Infrastructure Stack

### Option A: Deploy DataServicesStack (Recommended - already has DynamoDB/S3)
```bash
# Deploy data services stack
cdk deploy geos-chem-data --require-approval never

# Save outputs
cdk deploy geos-chem-data --outputs-file data-outputs.json
```

### Option B: Deploy CoreInfrastructureStack (Alternative)
```bash
# Deploy core infrastructure
cdk deploy geos-chem-core-infra --require-approval never
```

**Expected Resources Created:**
- VPC with public/private subnets
- DynamoDB table: `geos-chem-simulations`
- S3 buckets: `geos-chem-users-{ACCOUNT}`, `geos-chem-system-{ACCOUNT}`
- IAM roles
- Security groups

**Verification:**
```bash
# Verify DynamoDB table
aws dynamodb describe-table \
  --table-name geos-chem-simulations \
  --profile aws --region us-west-2

# Verify S3 buckets
aws s3 ls --profile aws --region us-west-2 | grep geos-chem

# Verify VPC
aws ec2 describe-vpcs \
  --filters "Name=tag:Project,Values=GEOS-Chem-Cloud-Runner" \
  --profile aws --region us-west-2
```

---

## Step 4: Build and Push Docker Containers

### Create ECR Repository
```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name geos-chem \
  --profile aws --region us-west-2

# Get ECR URI
ECR_REPO=$(aws ecr describe-repositories \
  --repository-names geos-chem \
  --profile aws --region us-west-2 \
  --query 'repositories[0].repositoryUri' --output text)

echo "ECR Repository: $ECR_REPO"
```

### Build ARM64 Container (Graviton)
```bash
cd /Users/scttfrdmn/src/aws-geos-chem/container

# Build for ARM64
docker buildx build --platform linux/arm64 \
  -t geos-chem:latest-arm64 \
  -f Dockerfile.benchmark.arm64 .

# Tag for ECR
docker tag geos-chem:latest-arm64 ${ECR_REPO}:latest-arm64

# Login to ECR
aws ecr get-login-password --region us-west-2 --profile aws | \
  docker login --username AWS --password-stdin ${ECR_REPO}

# Push to ECR
docker push ${ECR_REPO}:latest-arm64
```

### Build AMD64 Container (x86)
```bash
# Build for AMD64
docker buildx build --platform linux/amd64 \
  -t geos-chem:latest-amd64 \
  -f Dockerfile.benchmark.amd64 .

# Tag for ECR
docker tag geos-chem:latest-amd64 ${ECR_REPO}:latest-amd64

# Push to ECR
docker push ${ECR_REPO}:latest-amd64
```

**Verification:**
```bash
# List images in ECR
aws ecr list-images \
  --repository-name geos-chem \
  --profile aws --region us-west-2
```

---

## Step 5: Deploy Compute Resources Stack

```bash
cd /Users/scttfrdmn/src/aws-geos-chem/aws-geos-chem-cdk

# Update environment variables for Graviton4
export GRAVITON_INSTANCE_TYPES=c8g.4xlarge,c8g.8xlarge,c8g.16xlarge
export X86_INSTANCE_TYPES=c7i.4xlarge,c7i.8xlarge

# Deploy compute stack
cdk deploy geos-chem-compute --require-approval never

# Save outputs
cdk deploy geos-chem-compute --outputs-file compute-outputs.json
```

**Expected Resources Created:**
- AWS Batch Compute Environments (Graviton spot, x86 spot)
- AWS Batch Job Queues
- AWS Batch Job Definitions
- EC2 Launch Templates
- IAM roles for Batch

**Verification:**
```bash
# Verify compute environments
aws batch describe-compute-environments \
  --profile aws --region us-west-2 \
  --query 'computeEnvironments[].{Name:computeEnvironmentName,State:state,Status:status}'

# Verify job queues
aws batch describe-job-queues \
  --profile aws --region us-west-2 \
  --query 'jobQueues[].{Name:jobQueueName,State:state,Status:status}'

# Verify job definitions
aws batch describe-job-definitions \
  --status ACTIVE \
  --profile aws --region us-west-2
```

---

## Step 6: Deploy Job Management Stack

```bash
cd /Users/scttfrdmn/src/aws-geos-chem/aws-geos-chem-cdk

# Deploy job management stack with Lambda functions
cdk deploy geos-chem-job-management --require-approval never

# Save outputs - IMPORTANT for frontend config
cdk deploy geos-chem-job-management --outputs-file job-management-outputs.json
```

**Expected Resources Created:**
- 9 Lambda functions
- Step Functions state machine
- API Gateway REST API
- CloudWatch Log Groups
- IAM roles and policies

**Verification:**
```bash
# List Lambda functions
aws lambda list-functions \
  --profile aws --region us-west-2 \
  --query 'Functions[?contains(FunctionName, `GeosChem`)].FunctionName'

# Get API Gateway URL
API_ID=$(aws apigateway get-rest-apis \
  --profile aws --region us-west-2 \
  --query 'items[?name==`GEOS-Chem Simulations API`].id' --output text)

API_URL="https://${API_ID}.execute-api.us-west-2.amazonaws.com/prod"
echo "API Gateway URL: $API_URL"

# Test API health (should return 401 without auth)
curl -X GET "${API_URL}/simulations"
# Expected: {"message":"Unauthorized"}
```

---

## Step 7: Create Test User in Cognito

```bash
# Get User Pool ID and Client ID
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 \
  --profile aws --region us-west-2 \
  --query 'UserPools[?Name==`geos-chem-users`].Id' --output text)

CLIENT_ID=$(aws cognito-idp list-user-pool-clients \
  --user-pool-id $USER_POOL_ID \
  --profile aws --region us-west-2 \
  --query 'UserPoolClients[0].ClientId' --output text)

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"

# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS \
  --profile aws --region us-west-2

# Set permanent password (for dev/testing only)
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --password TestPass123! \
  --permanent \
  --profile aws --region us-west-2

# Get authentication token
aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=testuser@example.com,PASSWORD=TestPass123! \
  --profile aws --region us-west-2 \
  --query 'AuthenticationResult.IdToken' --output text > /tmp/cognito-token.txt

# Save token for testing
export COGNITO_TOKEN=$(cat /tmp/cognito-token.txt)
echo "Token saved to \$COGNITO_TOKEN"
```

---

## Step 8: Test API with Authentication

```bash
# Get API URL from outputs
API_URL=$(jq -r '.["geos-chem-job-management"].ApiUrl' job-management-outputs.json)

echo "Testing API at: $API_URL"

# Test POST /simulations (create simulation)
curl -X POST "${API_URL}/simulations" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationType": "GC_CLASSIC",
    "startDate": "2020-01-01",
    "endDate": "2020-01-07",
    "resolution": "4x5",
    "chemistry": "fullchem",
    "processorType": "graviton4",
    "instanceSize": "medium",
    "useSpot": true
  }' | jq .

# Save simulation ID
SIMULATION_ID=$(curl -s -X POST "${API_URL}/simulations" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationType": "GC_CLASSIC",
    "startDate": "2020-01-01",
    "endDate": "2020-01-07",
    "resolution": "4x5",
    "chemistry": "fullchem",
    "processorType": "graviton4",
    "instanceSize": "medium",
    "useSpot": true
  }' | jq -r .simulationId)

echo "Created simulation: $SIMULATION_ID"

# Test GET /simulations (list)
curl -X GET "${API_URL}/simulations" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" | jq .

# Test GET /simulations/{id} (get specific)
curl -X GET "${API_URL}/simulations/${SIMULATION_ID}" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" | jq .

# Monitor Step Functions execution
EXECUTION_ARN=$(aws dynamodb get-item \
  --table-name geos-chem-simulations \
  --key "{\"userId\":{\"S\":\"$(aws cognito-idp get-user --access-token $COGNITO_TOKEN --profile aws --region us-west-2 --query Username --output text)\"},\"simulationId\":{\"S\":\"${SIMULATION_ID}\"}}" \
  --profile aws --region us-west-2 \
  --query 'Item.executionArn.S' --output text)

# Watch execution status
watch -n 5 "aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --profile aws --region us-west-2 \
  --query '{Status:status,StartDate:startDate}'"
```

---

## Step 9: Configure Frontend

```bash
cd /Users/scttfrdmn/src/aws-geos-chem/web-interface

# Create aws-exports.ts
cat > src/aws-exports.ts << EOF
const awsmobile = {
  aws_project_region: 'us-west-2',
  aws_cognito_region: 'us-west-2',
  aws_user_pools_id: '${USER_POOL_ID}',
  aws_user_pools_web_client_id: '${CLIENT_ID}',
  aws_cloud_logic_custom: [
    {
      name: 'GeosChemAPI',
      endpoint: '${API_URL}',
      region: 'us-west-2'
    }
  ]
};

export default awsmobile;
EOF

# Install dependencies
npm install

# Start development server
npm start
```

**Frontend will be available at:** http://localhost:3000

---

## Step 10: Verify Complete Workflow

### Test End-to-End Simulation

```bash
# 1. Create simulation via API
SIMULATION_ID=$(curl -s -X POST "${API_URL}/simulations" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationType": "GC_CLASSIC",
    "startDate": "2020-01-01",
    "endDate": "2020-01-07",
    "resolution": "4x5",
    "chemistry": "fullchem",
    "processorType": "graviton4",
    "instanceSize": "medium",
    "useSpot": true
  }' | jq -r .simulationId)

echo "Simulation ID: $SIMULATION_ID"

# 2. Monitor simulation status
while true; do
  STATUS=$(curl -s -X GET "${API_URL}/simulations/${SIMULATION_ID}" \
    -H "Authorization: Bearer ${COGNITO_TOKEN}" | jq -r .status)
  echo "Status: $STATUS"

  if [[ "$STATUS" == "SUCCEEDED" ]] || [[ "$STATUS" == "FAILED" ]]; then
    break
  fi

  sleep 30
done

# 3. Get final simulation details
curl -X GET "${API_URL}/simulations/${SIMULATION_ID}" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" | jq .
```

---

## Troubleshooting

### Issue: CDK Bootstrap Fails
```bash
# Check AWS credentials
aws sts get-caller-identity --profile aws --region us-west-2

# Ensure you have AdministratorAccess or equivalent permissions
# Required permissions:
# - CloudFormation:*
# - IAM:*
# - S3:*
# - ECR:*
# - Lambda:*
# - DynamoDB:*
# - Cognito:*
```

### Issue: Docker Build Fails
```bash
# Check Docker is running
docker ps

# Check buildx is installed
docker buildx version

# If buildx not available:
docker buildx create --use
```

### Issue: Lambda Functions Timeout
```bash
# Check CloudWatch Logs
aws logs tail /aws/lambda/GeosChemSubmitSimulation-dev \
  --follow \
  --profile aws --region us-west-2

# Common causes:
# - VPC configuration issues
# - DynamoDB table not created
# - IAM permissions missing
```

### Issue: API Returns 401 Unauthorized
```bash
# Verify token is valid
echo $COGNITO_TOKEN | cut -d'.' -f2 | base64 -d | jq .

# Token should have:
# - "exp" (expiration) in the future
# - "sub" (user ID)
# - "cognito:username"

# Get new token if expired:
aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=testuser@example.com,PASSWORD=TestPass123! \
  --profile aws --region us-west-2 \
  --query 'AuthenticationResult.IdToken' --output text
```

### Issue: AWS Batch Job Fails
```bash
# Get job ID from DynamoDB
JOB_ID=$(aws dynamodb get-item \
  --table-name geos-chem-simulations \
  --key "{\"userId\":{\"S\":\"user-id\"},\"simulationId\":{\"S\":\"${SIMULATION_ID}\"}}" \
  --profile aws --region us-west-2 \
  --query 'Item.batchJobId.S' --output text)

# Describe job
aws batch describe-jobs \
  --jobs $JOB_ID \
  --profile aws --region us-west-2

# Get CloudWatch logs
LOG_STREAM=$(aws batch describe-jobs --jobs $JOB_ID --profile aws --region us-west-2 \
  --query 'jobs[0].container.logStreamName' --output text)

aws logs get-log-events \
  --log-group-name /aws/batch/job \
  --log-stream-name $LOG_STREAM \
  --profile aws --region us-west-2
```

---

## Cleanup (When Done Testing)

```bash
# WARNING: This will delete all resources and data

# Delete all stacks in reverse order
cdk destroy geos-chem-job-management --profile aws --region us-west-2 --force
cdk destroy geos-chem-compute --profile aws --region us-west-2 --force
cdk destroy geos-chem-data --profile aws --region us-west-2 --force
cdk destroy geos-chem-auth --profile aws --region us-west-2 --force
cdk destroy geos-chem-core-infra --profile aws --region us-west-2 --force

# Empty and delete S3 buckets
aws s3 rm s3://geos-chem-users-$(aws sts get-caller-identity --query Account --output text) \
  --recursive --profile aws --region us-west-2
aws s3 rb s3://geos-chem-users-$(aws sts get-caller-identity --query Account --output text) \
  --profile aws --region us-west-2

# Delete ECR repository
aws ecr delete-repository \
  --repository-name geos-chem \
  --force \
  --profile aws --region us-west-2

# Delete CloudWatch log groups
aws logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/GeosChem \
  --profile aws --region us-west-2 \
  --query 'logGroups[].logGroupName' --output text | \
  xargs -I {} aws logs delete-log-group --log-group-name {} --profile aws --region us-west-2
```

---

## Estimated Costs

### Development Environment (per month)
- **API Gateway:** ~$3.50 (1M requests, first 1M free)
- **Lambda:** ~$2 (400k GB-seconds free tier)
- **DynamoDB:** ~$5 (on-demand, low volume)
- **S3:** ~$1 (5GB free tier)
- **CloudWatch:** ~$1 (logs)
- **Cognito:** $0 (50k MAU free)
- **Batch Testing:** ~$5 (spot instances)

**Total:** ~$17.50/month

### Per Simulation (4x5, 7 days)
- **Compute (Graviton4 c8g.4xlarge spot):** $0.18/hr × 8 hrs = $1.44
- **Storage:** ~$0.05
- **API/Lambda overhead:** ~$0.002

**Total per simulation:** ~$1.49

---

## Success Criteria

✅ All CDK stacks deployed without errors
✅ Cognito user pool operational
✅ DynamoDB table created with GSIs
✅ S3 buckets created
✅ Docker containers in ECR
✅ AWS Batch compute environments VALID
✅ Lambda functions executable
✅ API Gateway returns 401 without token
✅ API Gateway returns 200 with valid token
✅ Test simulation runs to completion
✅ Frontend can connect and authenticate

---

**Deployment Guide Version:** 1.0
**Last Updated:** October 15, 2025
**Maintainer:** AWS GEOS-Chem Implementation Team
