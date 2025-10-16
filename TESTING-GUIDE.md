# GEOS-Chem AWS Cloud Runner - Integration Testing Guide

## Week 3, Days 3-5: Deployment Testing and Validation

This guide provides comprehensive testing procedures to verify the deployment of the GEOS-Chem AWS Cloud Runner system.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Verification](#deployment-verification)
3. [Authentication Testing](#authentication-testing)
4. [API Gateway Testing](#api-gateway-testing)
5. [Lambda Function Testing](#lambda-function-testing)
6. [Step Functions Testing](#step-functions-testing)
7. [AWS Batch Testing](#aws-batch-testing)
8. [End-to-End Workflow Testing](#end-to-end-workflow-testing)
9. [Frontend Integration Testing](#frontend-integration-testing)
10. [Performance Validation](#performance-validation)
11. [Security Testing](#security-testing)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before testing, ensure:

- ✅ Deployment script completed: `./deploy.sh`
- ✅ AWS CLI configured with profile `aws`
- ✅ Region set to `us-west-2`
- ✅ jq installed for JSON parsing
- ✅ curl installed for API testing

```bash
export AWS_PROFILE=aws
export AWS_REGION=us-west-2

# Verify AWS credentials
aws sts get-caller-identity --profile $AWS_PROFILE --region $AWS_REGION
```

---

## Deployment Verification

### 1. Verify CDK Stacks

Check all CloudFormation stacks are deployed successfully:

```bash
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `geos-chem`)].{Name:StackName, Status:StackStatus}' \
  --output table \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

**Expected Output:**
```
-------------------------------------------------------------
|                        ListStacks                          |
+-----------------------------------+------------------------+
|               Name                |        Status          |
+-----------------------------------+------------------------+
|  geos-chem-core-infra            |  CREATE_COMPLETE       |
|  geos-chem-auth                  |  CREATE_COMPLETE       |
|  geos-chem-data                  |  CREATE_COMPLETE       |
|  geos-chem-compute               |  CREATE_COMPLETE       |
|  geos-chem-job-management        |  CREATE_COMPLETE       |
|  geos-chem-visualization         |  CREATE_COMPLETE       |
|  geos-chem-cost-tracking         |  CREATE_COMPLETE       |
|  geos-chem-benchmarking          |  CREATE_COMPLETE       |
|  geos-chem-web-app               |  CREATE_COMPLETE       |
+-----------------------------------+------------------------+
```

### 2. Verify Stack Outputs

Load deployment outputs:

```bash
cd aws-geos-chem-cdk/outputs

# Check auth outputs
cat auth-outputs.json | jq '.'

# Check job management outputs
cat job-management-outputs.json | jq '.'

# Check compute outputs
cat compute-outputs.json | jq '.'
```

### 3. Verify Core Resources

**DynamoDB Table:**
```bash
aws dynamodb describe-table \
  --table-name geos-chem-simulations \
  --query 'Table.{Name:TableName, Status:TableStatus, GSIs:GlobalSecondaryIndexes[*].IndexName}' \
  --output json \
  --profile $AWS_PROFILE \
  --region $AWS_REGION | jq '.'
```

**Expected:**
- Status: ACTIVE
- GSIs: userId-status-index, userId-createdAt-index

**S3 Buckets:**
```bash
aws s3 ls --profile $AWS_PROFILE --region $AWS_REGION | grep geos-chem
```

**Expected:**
- geos-chem-users-{ACCOUNT_ID}
- geos-chem-system-{ACCOUNT_ID}
- cdk-* (CDK staging buckets)

**VPC:**
```bash
aws ec2 describe-vpcs \
  --filters "Name=tag:Project,Values=GEOS-Chem-Cloud-Runner" \
  --query 'Vpcs[*].{VpcId:VpcId, CIDR:CidrBlock, State:State}' \
  --output table \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

**Expected:** VPC with 10.0.0.0/16 CIDR, State: available

---

## Authentication Testing

### 1. Verify Cognito User Pool

```bash
# Get User Pool ID from outputs
USER_POOL_ID=$(jq -r '.["geos-chem-auth"].UserPoolId' aws-geos-chem-cdk/outputs/auth-outputs.json)
CLIENT_ID=$(jq -r '.["geos-chem-auth"].UserPoolClientId' aws-geos-chem-cdk/outputs/auth-outputs.json)

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"

# Describe user pool
aws cognito-idp describe-user-pool \
  --user-pool-id $USER_POOL_ID \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'UserPool.{Name:Name, Status:Status, MfaConfiguration:MfaConfiguration}' \
  --output json | jq '.'
```

### 2. Verify Test User

```bash
aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query '{Username:Username, Status:UserStatus, Attributes:UserAttributes}' \
  --output json | jq '.'
```

**Expected Status:** CONFIRMED

### 3. Test Authentication Flow

```bash
# Authenticate test user
TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=testuser@example.com,PASSWORD=TestPass123! \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'AuthenticationResult.IdToken' \
  --output text)

echo "JWT Token obtained: ${TOKEN:0:50}..."
```

### 4. Verify JWT Token

```bash
# Decode JWT token (base64)
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.'
```

**Expected Claims:**
- sub (user ID)
- cognito:username
- email
- exp (expiration)

---

## API Gateway Testing

### 1. Get API URL

```bash
API_URL=$(jq -r '.["geos-chem-job-management"].ApiUrl' aws-geos-chem-cdk/outputs/job-management-outputs.json)
echo "API Gateway URL: $API_URL"
```

### 2. Test Unauthenticated Request (Should Fail)

```bash
curl -X GET "${API_URL}/simulations" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** HTTP 401 Unauthorized with message: `{"message":"Unauthorized"}`

### 3. Test Authenticated GET Request

```bash
curl -X GET "${API_URL}/simulations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -w "\nHTTP Status: %{http_code}\n" | jq '.'
```

**Expected:** HTTP 200 with empty simulations array:
```json
{
  "simulations": []
}
```

### 4. Test Submit Simulation

```bash
curl -X POST "${API_URL}/simulations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "simulationName": "Test Simulation 1",
    "simulationType": "fullchem",
    "startDate": "2024-01-01",
    "endDate": "2024-01-07",
    "resolution": "4x5",
    "region": "global",
    "processorType": "graviton4",
    "instanceType": "c8g.4xlarge",
    "configuration": {
      "chemistry": "fullchem",
      "emissions": ["CEDS", "GFED"],
      "meteorology": "MERRA2"
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n" | jq '.'
```

**Expected:** HTTP 200 with simulation details:
```json
{
  "simulationId": "sim-xxxxxx",
  "status": "SUBMITTED",
  "message": "Simulation submitted successfully",
  "stepFunctionArn": "arn:aws:states:us-west-2:..."
}
```

### 5. Test Get Specific Simulation

```bash
# Save simulation ID from previous response
SIMULATION_ID="sim-xxxxxx"

curl -X GET "${API_URL}/simulations/${SIMULATION_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -w "\nHTTP Status: %{http_code}\n" | jq '.'
```

**Expected:** HTTP 200 with simulation details

### 6. Test Cancel Simulation

```bash
curl -X POST "${API_URL}/simulations/${SIMULATION_ID}/cancel" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -w "\nHTTP Status: %{http_code}\n" | jq '.'
```

**Expected:** HTTP 200 with cancellation confirmation

---

## Lambda Function Testing

### 1. List Deployed Lambda Functions

```bash
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `geos-chem`)].{Name:FunctionName, Runtime:Runtime, LastModified:LastModified}' \
  --output table \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

**Expected Functions:**
- geos-chem-submit-simulation
- geos-chem-get-simulations
- geos-chem-get-simulation
- geos-chem-cancel-simulation
- geos-chem-validate-config
- geos-chem-prepare-input
- geos-chem-start-batch-job
- geos-chem-monitor-job
- geos-chem-process-results
- geos-chem-notification

### 2. Check Lambda Execution Logs

```bash
# View logs for submit-simulation function
LOG_GROUP="/aws/lambda/geos-chem-submit-simulation"

aws logs tail $LOG_GROUP \
  --follow \
  --format short \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

### 3. Test Lambda Function Directly

```bash
# Test validate-config Lambda
aws lambda invoke \
  --function-name geos-chem-validate-config \
  --payload '{
    "simulationType": "fullchem",
    "startDate": "2024-01-01",
    "endDate": "2024-01-07",
    "resolution": "4x5"
  }' \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  response.json

cat response.json | jq '.'
```

**Expected:**
```json
{
  "valid": true,
  "configuration": { ... }
}
```

### 4. Check Lambda Metrics

```bash
# Get invocations in last hour
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=geos-chem-submit-simulation \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --output json | jq '.'
```

---

## Step Functions Testing

### 1. List State Machines

```bash
aws stepfunctions list-state-machines \
  --query 'stateMachines[?contains(name, `geos-chem`)].{Name:name, Status:status}' \
  --output table \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

**Expected:** geos-chem-simulation-workflow (ACTIVE)

### 2. Start Test Execution

```bash
STATE_MACHINE_ARN=$(aws stepfunctions list-state-machines \
  --query 'stateMachines[?contains(name, `geos-chem-simulation-workflow`)].stateMachineArn' \
  --output text \
  --profile $AWS_PROFILE \
  --region $AWS_REGION)

EXECUTION_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE_ARN \
  --input '{
    "simulationId": "test-sim-001",
    "userId": "testuser@example.com",
    "simulationType": "fullchem",
    "startDate": "2024-01-01",
    "endDate": "2024-01-02",
    "resolution": "4x5",
    "processorType": "graviton4",
    "instanceType": "c8g.4xlarge"
  }' \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'executionArn' \
  --output text)

echo "Execution ARN: $EXECUTION_ARN"
```

### 3. Monitor Execution

```bash
# Check execution status
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query '{Status:status, StartDate:startDate, StopDate:stopDate}' \
  --output json | jq '.'
```

### 4. Get Execution History

```bash
aws stepfunctions get-execution-history \
  --execution-arn $EXECUTION_ARN \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'events[*].{Type:type, Timestamp:timestamp, Details:stateEnteredEventDetails.name}' \
  --output table
```

### 5. View State Machine Graph

```bash
# Get state machine definition
aws stepfunctions describe-state-machine \
  --state-machine-arn $STATE_MACHINE_ARN \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'definition' \
  --output text | jq '.' > state-machine-definition.json

echo "State machine definition saved to state-machine-definition.json"
```

---

## AWS Batch Testing

### 1. Verify Compute Environments

```bash
aws batch describe-compute-environments \
  --query 'computeEnvironments[*].{Name:computeEnvironmentName, State:state, Status:status, Type:type}' \
  --output table \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

**Expected Compute Environments:**
- geos-chem-graviton4-compute-env (ENABLED, VALID)
- geos-chem-x86-intel-compute-env (ENABLED, VALID)
- geos-chem-x86-amd-compute-env (ENABLED, VALID)

### 2. Verify Job Queues

```bash
aws batch describe-job-queues \
  --query 'jobQueues[*].{Name:jobQueueName, State:state, Status:status, Priority:priority}' \
  --output table \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

**Expected Job Queues:**
- geos-chem-standard (ENABLED, VALID)
- geos-chem-high-priority (ENABLED, VALID)

### 3. Verify Job Definitions

```bash
aws batch describe-job-definitions \
  --status ACTIVE \
  --query 'jobDefinitions[?contains(jobDefinitionName, `geos-chem`)].{Name:jobDefinitionName, Revision:revision, Type:type}' \
  --output table \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

### 4. Submit Test Batch Job

```bash
JOB_ID=$(aws batch submit-job \
  --job-name geos-chem-test-job \
  --job-queue geos-chem-standard \
  --job-definition geos-chem-fullchem:1 \
  --container-overrides '{
    "environment": [
      {"name": "SIMULATION_ID", "value": "test-001"},
      {"name": "START_DATE", "value": "20240101"},
      {"name": "END_DATE", "value": "20240102"}
    ]
  }' \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'jobId' \
  --output text)

echo "Job ID: $JOB_ID"
```

### 5. Monitor Batch Job

```bash
# Watch job status
watch -n 5 "aws batch describe-jobs \
  --jobs $JOB_ID \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'jobs[0].{JobName:jobName, Status:status, StatusReason:statusReason}' \
  --output table"
```

### 6. Get Job Logs

```bash
# Get log stream name
LOG_STREAM=$(aws batch describe-jobs \
  --jobs $JOB_ID \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'jobs[0].container.logStreamName' \
  --output text)

# View logs
aws logs get-log-events \
  --log-group-name /aws/batch/job \
  --log-stream-name $LOG_STREAM \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'events[*].message' \
  --output text
```

---

## End-to-End Workflow Testing

### Test Scenario 1: Full Chemistry Simulation (Graviton4)

```bash
#!/bin/bash
# test-e2e-fullchem.sh

export AWS_PROFILE=aws
export AWS_REGION=us-west-2

# Get auth token
TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=testuser@example.com,PASSWORD=TestPass123! \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Submit simulation
API_URL=$(jq -r '.["geos-chem-job-management"].ApiUrl' aws-geos-chem-cdk/outputs/job-management-outputs.json)

RESPONSE=$(curl -s -X POST "${API_URL}/simulations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "simulationName": "E2E Test - Full Chemistry",
    "simulationType": "fullchem",
    "startDate": "2024-01-01",
    "endDate": "2024-01-07",
    "resolution": "4x5",
    "region": "global",
    "processorType": "graviton4",
    "instanceType": "c8g.4xlarge",
    "configuration": {
      "chemistry": "fullchem",
      "emissions": ["CEDS", "GFED"],
      "meteorology": "MERRA2"
    }
  }')

echo "$RESPONSE" | jq '.'

# Extract simulation ID
SIMULATION_ID=$(echo "$RESPONSE" | jq -r '.simulationId')
echo "Simulation ID: $SIMULATION_ID"

# Monitor progress
echo "Monitoring simulation progress..."
for i in {1..30}; do
  STATUS=$(curl -s -X GET "${API_URL}/simulations/${SIMULATION_ID}" \
    -H "Authorization: Bearer ${TOKEN}" | jq -r '.status')

  echo "[$i/30] Status: $STATUS"

  if [ "$STATUS" = "COMPLETED" ]; then
    echo "✅ Simulation completed successfully!"
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo "❌ Simulation failed!"
    exit 1
  fi

  sleep 30
done

# Get results
RESULTS=$(curl -s -X GET "${API_URL}/simulations/${SIMULATION_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$RESULTS" | jq '.'
```

### Test Scenario 2: Transport-Only Simulation (AMD x86)

```bash
#!/bin/bash
# test-e2e-transport.sh

# Similar structure but with:
# "simulationType": "TransportTracers"
# "processorType": "amd_x86"
# "instanceType": "c7a.4xlarge"
```

### Test Scenario 3: Methane Simulation (Intel x86)

```bash
#!/bin/bash
# test-e2e-methane.sh

# Similar structure but with:
# "simulationType": "CH4"
# "processorType": "intel_x86"
# "instanceType": "c7i.4xlarge"
```

---

## Frontend Integration Testing

### 1. Configure Frontend

Verify `web-interface/src/aws-exports.ts` was generated:

```bash
cat web-interface/src/aws-exports.ts
```

**Expected:**
```typescript
const awsmobile = {
  aws_project_region: 'us-west-2',
  aws_cognito_region: 'us-west-2',
  aws_user_pools_id: 'us-west-2_xxxxxx',
  aws_user_pools_web_client_id: 'xxxxxxxxxxxxx',
  aws_cloud_logic_custom: [
    {
      name: 'GeosChemAPI',
      endpoint: 'https://xxxxxx.execute-api.us-west-2.amazonaws.com/prod',
      region: 'us-west-2'
    }
  ]
};
```

### 2. Start Frontend Development Server

```bash
cd web-interface
npm install
npm start
```

**Expected:** Application starts on http://localhost:3000

### 3. Manual Frontend Testing

**Login Page:**
- [ ] Navigate to http://localhost:3000
- [ ] Enter credentials: testuser@example.com / TestPass123!
- [ ] Verify successful login
- [ ] Check JWT token stored in session

**Simulation Wizard:**
- [ ] Click "New Simulation"
- [ ] Step through configuration wizard
- [ ] Verify all form fields working
- [ ] Verify processor type defaults to Graviton4
- [ ] Verify cost estimation displays
- [ ] Submit simulation
- [ ] Verify success notification

**Dashboard:**
- [ ] View simulations list
- [ ] Check status updates (polling)
- [ ] Click on simulation for details
- [ ] Verify metrics display
- [ ] Test cancel simulation

**Results Viewer:**
- [ ] Navigate to completed simulation
- [ ] Verify output files listed
- [ ] Download result file
- [ ] View visualization (if available)

---

## Performance Validation

### 1. API Latency Testing

```bash
# Test API response times
for i in {1..10}; do
  START=$(date +%s%N)
  curl -s -X GET "${API_URL}/simulations" \
    -H "Authorization: Bearer ${TOKEN}" > /dev/null
  END=$(date +%s%N)
  DURATION=$((($END - $START) / 1000000))
  echo "Request $i: ${DURATION}ms"
done
```

**Target:** < 500ms per request

### 2. Lambda Cold Start Testing

```bash
# Test Lambda cold start
aws lambda update-function-configuration \
  --function-name geos-chem-get-simulations \
  --description "Cold start test" \
  --profile $AWS_PROFILE \
  --region $AWS_REGION

# Wait for update
sleep 10

# Invoke and measure
time aws lambda invoke \
  --function-name geos-chem-get-simulations \
  --payload '{"userId": "testuser@example.com"}' \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  response.json
```

**Target:** < 3s cold start, < 200ms warm

### 3. Batch Job Startup Time

```bash
# Measure time from SUBMITTED to RUNNING
JOB_ID="<job-id>"

SUBMIT_TIME=$(aws batch describe-jobs \
  --jobs $JOB_ID \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'jobs[0].createdAt' \
  --output text)

RUNNING_TIME=$(aws batch describe-jobs \
  --jobs $JOB_ID \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'jobs[0].startedAt' \
  --output text)

echo "Startup time: $((RUNNING_TIME - SUBMIT_TIME))ms"
```

**Target:** < 5 minutes for first job, < 30s for warm pool

---

## Security Testing

### 1. Verify Cognito Authorization

```bash
# Test without token (should fail)
curl -X GET "${API_URL}/simulations" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** 401 Unauthorized

```bash
# Test with invalid token (should fail)
curl -X GET "${API_URL}/simulations" \
  -H "Authorization: Bearer invalid-token" \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected:** 401 Unauthorized

### 2. Verify S3 Bucket Security

```bash
# Verify bucket is not public
aws s3api get-bucket-policy-status \
  --bucket geos-chem-users-$ACCOUNT_ID \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'PolicyStatus.IsPublic'
```

**Expected:** false

```bash
# Verify encryption
aws s3api get-bucket-encryption \
  --bucket geos-chem-users-$ACCOUNT_ID \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

**Expected:** AES256 or aws:kms

### 3. Verify DynamoDB Encryption

```bash
aws dynamodb describe-table \
  --table-name geos-chem-simulations \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'Table.SSEDescription'
```

**Expected:** Status: ENABLED

### 4. Verify IAM Role Permissions

```bash
# Check Lambda execution role has minimal permissions
ROLE_NAME="geos-chem-job-management-lambda-role"

aws iam get-role-policy \
  --role-name $ROLE_NAME \
  --policy-name inline-policy \
  --profile $AWS_PROFILE \
  --region $AWS_REGION
```

**Verify:** Only necessary permissions granted (least privilege)

---

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

**Symptom:** 401 Unauthorized from API

**Debug:**
```bash
# Verify token is valid
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq '.exp'

# Check if expired
EXPIRY=$(echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.exp')
CURRENT=$(date +%s)
echo "Token expires in: $((EXPIRY - CURRENT)) seconds"
```

**Solution:** Re-authenticate if expired

#### 2. Lambda Function Errors

**Symptom:** 500 Internal Server Error from API

**Debug:**
```bash
# View recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/geos-chem-submit-simulation \
  --filter-pattern "ERROR" \
  --start-time $(($(date +%s) - 3600))000 \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'events[*].message' \
  --output text
```

**Solution:** Check Lambda environment variables, IAM permissions

#### 3. Batch Jobs Not Starting

**Symptom:** Jobs stuck in RUNNABLE state

**Debug:**
```bash
# Check compute environment status
aws batch describe-compute-environments \
  --compute-environments geos-chem-graviton4-compute-env \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'computeEnvironments[0].{State:state, Status:status, StatusReason:statusReason}'
```

**Solution:**
- Check VPC subnets have available IPs
- Verify service limits not exceeded
- Check compute environment is ENABLED

#### 4. Step Functions Execution Failures

**Symptom:** Execution shows FAILED status

**Debug:**
```bash
# Get failure reason
aws stepfunctions describe-execution \
  --execution-arn $EXECUTION_ARN \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query '{Status:status, Error:error, Cause:cause}'
```

**Solution:** Check individual step logs, verify IAM permissions

#### 5. Container Image Issues

**Symptom:** Batch job fails with image pull error

**Debug:**
```bash
# Verify ECR repository and images
aws ecr describe-images \
  --repository-name geos-chem \
  --profile $AWS_PROFILE \
  --region $AWS_REGION \
  --query 'imageDetails[*].{Tags:imageTags, Size:imageSizeInBytes, Pushed:imagePushedAt}'
```

**Solution:** Re-build and push containers

---

## Success Criteria

✅ **Deployment Complete:**
- [ ] All 9 CloudFormation stacks deployed successfully
- [ ] No errors in CloudFormation events
- [ ] All resources created with correct tags

✅ **Authentication Working:**
- [ ] User can authenticate with Cognito
- [ ] JWT tokens generated correctly
- [ ] API rejects unauthenticated requests
- [ ] API accepts authenticated requests

✅ **API Functional:**
- [ ] GET /simulations returns 200
- [ ] POST /simulations creates simulation
- [ ] GET /simulations/{id} returns details
- [ ] POST /simulations/{id}/cancel works

✅ **Lambda Functions:**
- [ ] All 10 functions deployed
- [ ] Functions execute without errors
- [ ] CloudWatch logs show successful invocations
- [ ] Cold start times < 3s

✅ **Step Functions:**
- [ ] State machine can be started
- [ ] Workflow completes all steps
- [ ] Proper error handling
- [ ] Results written to DynamoDB

✅ **AWS Batch:**
- [ ] Compute environments active
- [ ] Job queues accepting jobs
- [ ] Jobs transition to RUNNING
- [ ] Container executes successfully
- [ ] Logs available in CloudWatch

✅ **End-to-End:**
- [ ] Submit simulation via API
- [ ] Simulation progresses through states
- [ ] Results saved to S3
- [ ] DynamoDB updated correctly
- [ ] User can retrieve results

✅ **Frontend:**
- [ ] Application loads
- [ ] Login successful
- [ ] Can create simulation
- [ ] Dashboard shows simulations
- [ ] Status updates appear
- [ ] Results viewable

✅ **Security:**
- [ ] S3 buckets not public
- [ ] Encryption enabled
- [ ] IAM roles follow least privilege
- [ ] API requires authentication

✅ **Performance:**
- [ ] API latency < 500ms
- [ ] Lambda warm execution < 200ms
- [ ] Batch job startup < 5 min (first job)
- [ ] Frontend responsive

---

## Test Execution Checklist

### Day 3: Core Infrastructure Testing
- [ ] Verify all CloudFormation stacks
- [ ] Test Cognito authentication
- [ ] Test API Gateway endpoints
- [ ] Check Lambda function logs
- [ ] Document any issues

### Day 4: Workflow Testing
- [ ] Test Step Functions execution
- [ ] Submit AWS Batch jobs
- [ ] Monitor job execution
- [ ] Verify results in S3/DynamoDB
- [ ] Run end-to-end scenarios

### Day 5: Integration & Documentation
- [ ] Test frontend integration
- [ ] Run security validation
- [ ] Performance testing
- [ ] Create test report
- [ ] Document any remediation needed

---

## Test Report Template

```markdown
# Week 3 Testing Report
Date: YYYY-MM-DD
Tester: [Name]

## Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X

## Infrastructure (X/Y)
- ✅ CloudFormation stacks deployed
- ✅ VPC and networking configured
- ❌ Issue with compute environment

## Authentication (X/Y)
- ✅ Cognito working
- ✅ JWT tokens valid
- ✅ API authorization functional

## API Gateway (X/Y)
- ✅ All endpoints responding
- ✅ Request validation working
- ⚠️ Latency higher than expected

## Lambda Functions (X/Y)
- ✅ All functions deployed
- ❌ validate-config has timeout issue

## AWS Batch (X/Y)
- ✅ Jobs submitted
- ⚠️ Startup time 7 minutes (target 5)

## End-to-End (X/Y)
- ✅ Full chemistry simulation complete
- ✅ Results in S3
- ✅ DynamoDB updated

## Issues Found
1. Issue description
   - Severity: High/Medium/Low
   - Impact: Description
   - Remediation: Steps to fix

## Recommendations
- Recommendation 1
- Recommendation 2

## Next Steps
- Action item 1
- Action item 2
```

---

## Additional Resources

- **CloudWatch Logs Insights Queries:** See `cloudwatch-queries.md`
- **Performance Benchmarks:** See `benchmarking/BENCHMARK-SUMMARY.md`
- **Troubleshooting Guide:** See `TROUBLESHOOTING.md`
- **Security Checklist:** See `SECURITY-CHECKLIST.md`

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Author:** GEOS-Chem AWS Cloud Runner Team
