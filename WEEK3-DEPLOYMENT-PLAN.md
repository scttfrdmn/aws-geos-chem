# Week 3 Deployment Plan: AWS Infrastructure & Integration Testing

**Date:** October 15, 2025
**Sprint:** Phase 1, Week 3 (Days 1-5)
**Focus:** Deploy to AWS Dev Environment & Integration Testing

---

## Objectives

### Primary Goals
1. ✅ Deploy complete AWS infrastructure to dev environment
2. ✅ Configure Cognito authentication for frontend
3. ✅ Build and deploy Docker containers to ECR
4. ✅ Configure AWS Batch compute environments
5. ✅ Conduct end-to-end integration testing
6. ✅ Verify all workflows function correctly

### Success Criteria
- [ ] All CDK stacks deployed without errors
- [ ] Cognito user pool operational with test users
- [ ] API Gateway accessible with valid authentication
- [ ] Lambda functions executable via API
- [ ] Step Functions workflow completes successfully
- [ ] AWS Batch jobs run and complete
- [ ] Frontend can create and monitor simulations
- [ ] All tests pass

---

## Day 1: Cognito & Authentication Setup

### Morning: Cognito User Pool Configuration

#### Task 1.1: Create Auth Stack
**File:** `aws-geos-chem-cdk/lib/auth-stack.ts`

```typescript
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create User Pool
    this.userPool = new cognito.UserPool(this, 'GeosChemUserPool', {
      userPoolName: 'geos-chem-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true
      },
      autoVerify: {
        email: true
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Create User Pool Client
    this.userPoolClient = this.userPool.addClient('GeosChemWebClient', {
      userPoolClientName: 'web-client',
      authFlows: {
        userSrp: true,
        userPassword: true
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE
        ],
        callbackUrls: ['http://localhost:3000', 'https://your-domain.com'],
        logoutUrls: ['http://localhost:3000', 'https://your-domain.com']
      }
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'GeosChemUserPoolId'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: 'GeosChemUserPoolClientId'
    });
  }
}
```

**Acceptance Criteria:**
- [ ] User pool created
- [ ] Email verification enabled
- [ ] Password policy configured
- [ ] Client app created
- [ ] Outputs visible in CloudFormation

#### Task 1.2: Update API Gateway with Cognito Authorizer
**File:** `aws-geos-chem-cdk/lib/job-management-stack.ts`

Add Cognito authorizer to API Gateway:

```typescript
// In JobManagementStack constructor, add:
interface JobManagementStackProps extends cdk.StackProps {
  // ... existing props
  userPool: cognito.UserPool;  // NEW
}

// Create Cognito authorizer
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
  cognitoUserPools: [props.userPool],
  authorizerName: 'GeosChemAuthorizer',
  identitySource: 'method.request.header.Authorization'
});

// Update each method to use authorizer
simulationsResource.addMethod('POST', submitIntegration, {
  authorizer,  // NEW
  authorizationType: apigateway.AuthorizationType.COGNITO,  // NEW
  requestValidator,
  requestModels: {
    'application/json': simulationConfigModel
  }
});
```

**Acceptance Criteria:**
- [ ] Authorizer attached to API Gateway
- [ ] All endpoints require authentication
- [ ] Unauthorized requests return 401

### Afternoon: Frontend Cognito Configuration

#### Task 1.3: Configure AWS Amplify in Frontend
**File:** `web-interface/src/aws-exports.ts`

```typescript
const awsmobile = {
  aws_project_region: 'us-east-1',
  aws_cognito_region: 'us-east-1',
  aws_user_pools_id: 'us-east-1_XXXXXXXXX',  // From CloudFormation output
  aws_user_pools_web_client_id: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',  // From CloudFormation output
  aws_cloud_logic_custom: [
    {
      name: 'GeosChemAPI',
      endpoint: 'https://xxxxx.execute-api.us-east-1.amazonaws.com/prod',  // From CloudFormation output
      region: 'us-east-1'
    }
  ]
};

export default awsmobile;
```

**File:** `web-interface/src/index.tsx`

```typescript
import { Amplify } from 'aws-amplify';
import awsconfig from './aws-exports';

Amplify.configure(awsconfig);
```

**Acceptance Criteria:**
- [ ] Amplify configured with Cognito
- [ ] API endpoint configured
- [ ] Sign-up flow works
- [ ] Sign-in flow works
- [ ] Token refresh works

---

## Day 2: Core Infrastructure Deployment

### Morning: Deploy Core Stacks

#### Task 2.1: Deploy Auth Stack
```bash
cd aws-geos-chem-cdk
npm run build
cdk bootstrap aws://ACCOUNT-ID/us-east-1
cdk deploy AuthStack --profile your-profile
```

**Verification:**
```bash
aws cognito-idp list-user-pools --max-results 10 --profile your-profile
```

#### Task 2.2: Deploy Core Infrastructure Stack
```bash
cdk deploy CoreInfrastructureStack --profile your-profile
```

**Creates:**
- DynamoDB table: `geos-chem-simulations`
- S3 buckets: `geos-chem-users-ACCOUNT`, `geos-chem-system-ACCOUNT`
- VPC with public/private subnets
- Security groups
- IAM roles

**Verification:**
```bash
aws dynamodb list-tables --profile your-profile
aws s3 ls --profile your-profile
```

**Acceptance Criteria:**
- [ ] DynamoDB table created with GSIs
- [ ] S3 buckets created with policies
- [ ] VPC and subnets operational
- [ ] Security groups configured

### Afternoon: Compute Resources

#### Task 2.3: Build and Push Docker Containers
```bash
cd container

# Build ARM64 container for Graviton
docker buildx build --platform linux/arm64 \
  -t geos-chem:latest-arm64 \
  -f Dockerfile.benchmark.arm64 .

# Build AMD64 container for x86
docker buildx build --platform linux/amd64 \
  -t geos-chem:latest-amd64 \
  -f Dockerfile.benchmark.amd64 .

# Tag and push to ECR
aws ecr get-login-password --region us-east-1 --profile your-profile | \
  docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

docker tag geos-chem:latest-arm64 ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/geos-chem:latest-arm64
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/geos-chem:latest-arm64

docker tag geos-chem:latest-amd64 ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/geos-chem:latest-amd64
docker push ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/geos-chem:latest-amd64
```

**Acceptance Criteria:**
- [ ] ARM64 container built and pushed
- [ ] AMD64 container built and pushed
- [ ] ECR repositories created
- [ ] Images visible in ECR console

#### Task 2.4: Deploy Compute Resources Stack
```bash
cdk deploy ComputeResourcesStack --profile your-profile
```

**Creates:**
- EC2 Launch Templates (Graviton4, x86)
- AWS Batch Compute Environments (Graviton, x86, spot + on-demand)
- AWS Batch Job Queues
- AWS Batch Job Definitions
- IAM roles for Batch

**Verification:**
```bash
aws batch describe-compute-environments --profile your-profile
aws batch describe-job-queues --profile your-profile
aws batch describe-job-definitions --profile your-profile
```

**Acceptance Criteria:**
- [ ] Compute environments in VALID state
- [ ] Job queues in VALID state
- [ ] Job definitions registered
- [ ] Spot pricing configured

---

## Day 3: Application Stack Deployment

### Morning: Deploy Job Management Stack

#### Task 3.1: Deploy Job Management Stack
```bash
cdk deploy JobManagementStack --profile your-profile
```

**Creates:**
- 9 Lambda functions
- Step Functions state machine
- API Gateway REST API
- CloudWatch Log Groups
- IAM roles and policies

**Verification:**
```bash
aws lambda list-functions --profile your-profile | grep GeosChem
aws states list-state-machines --profile your-profile
aws apigateway get-rest-apis --profile your-profile
```

**Post-Deployment:**
1. Copy API Gateway URL from outputs
2. Copy State Machine ARN from outputs
3. Update frontend `aws-exports.ts` with API URL

**Acceptance Criteria:**
- [ ] All 9 Lambda functions deployed
- [ ] State machine created
- [ ] API Gateway operational
- [ ] Cognito authorizer attached
- [ ] CloudWatch logs receiving data

### Afternoon: Test API Endpoints

#### Task 3.2: Manual API Testing with Postman/curl

**Step 1: Get Cognito Token**
```bash
# Sign up test user
aws cognito-idp sign-up \
  --client-id YOUR_CLIENT_ID \
  --username testuser@example.com \
  --password TestPass123! \
  --user-attributes Name=email,Value=testuser@example.com \
  --profile your-profile

# Confirm user (dev only)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id YOUR_POOL_ID \
  --username testuser@example.com \
  --profile your-profile

# Get token
aws cognito-idp initiate-auth \
  --client-id YOUR_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=testuser@example.com,PASSWORD=TestPass123! \
  --profile your-profile \
  --query 'AuthenticationResult.IdToken' \
  --output text
```

**Step 2: Test POST /simulations**
```bash
export TOKEN="your-id-token-here"
export API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com/prod"

curl -X POST "${API_URL}/simulations" \
  -H "Authorization: Bearer ${TOKEN}" \
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
  }'
```

**Expected Response:**
```json
{
  "simulationId": "uuid-here",
  "status": "SUBMITTED",
  "userId": "cognito-sub-id",
  "createdAt": "2025-10-15T12:00:00Z",
  ...
}
```

**Step 3: Test GET /simulations**
```bash
curl -X GET "${API_URL}/simulations" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Step 4: Test GET /simulations/{id}**
```bash
SIMULATION_ID="uuid-from-previous-response"
curl -X GET "${API_URL}/simulations/${SIMULATION_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Step 5: Test POST /simulations/{id}/cancel**
```bash
curl -X POST "${API_URL}/simulations/${SIMULATION_ID}/cancel" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Acceptance Criteria:**
- [ ] POST returns 200 with simulation object
- [ ] GET /simulations returns list
- [ ] GET /simulations/{id} returns single simulation
- [ ] Cancel endpoint returns 200
- [ ] Unauthorized requests return 401
- [ ] Invalid requests return 400

---

## Day 4: Frontend Integration & E2E Testing

### Morning: Frontend Integration

#### Task 4.1: Update Frontend Configuration
```bash
cd web-interface
npm install
npm start
```

**Update `.env.development`:**
```env
REACT_APP_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_REGION=us-east-1
REACT_APP_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
```

#### Task 4.2: Test User Flows in Browser

**Flow 1: Sign Up**
1. Navigate to http://localhost:3000
2. Click "Sign Up"
3. Enter email and password
4. Verify email
5. Sign in

**Flow 2: Create Simulation**
1. Click "New Simulation"
2. Complete wizard:
   - Select GC_CLASSIC
   - Set dates: 2020-01-01 to 2020-01-07
   - Choose 4x5 resolution
   - Select Graviton4 processor
   - Enable spot instances
3. Submit
4. Verify simulation appears in list

**Flow 3: Monitor Simulation**
1. Click on simulation in list
2. View status updates
3. Check progress bar
4. View logs (when available)

**Flow 4: Cancel Simulation**
1. Click "Cancel" button
2. Confirm cancellation
3. Verify status changes to CANCELLED

**Acceptance Criteria:**
- [ ] User can sign up and sign in
- [ ] Simulation wizard completes
- [ ] Simulation appears in list
- [ ] Status updates in real-time
- [ ] Cancel button works
- [ ] Error messages display correctly

### Afternoon: End-to-End Testing

#### Task 4.3: Run Complete Workflow Test

**Test Scenario: 7-Day 4x5 Simulation**

1. **Create Simulation via Frontend**
   - Type: GC_CLASSIC
   - Dates: 2020-01-01 to 2020-01-07
   - Resolution: 4x5
   - Processor: Graviton4 c8g.4xlarge
   - Spot: Enabled

2. **Monitor Step Functions**
   ```bash
   # Get execution ARN from DynamoDB
   aws dynamodb get-item \
     --table-name geos-chem-simulations \
     --key '{"userId":{"S":"user-id"},"simulationId":{"S":"sim-id"}}' \
     --profile your-profile

   # Watch execution
   aws stepfunctions describe-execution \
     --execution-arn "arn:aws:states:..." \
     --profile your-profile
   ```

3. **Monitor AWS Batch Job**
   ```bash
   # Get job ID from DynamoDB
   # Watch job status
   aws batch describe-jobs \
     --jobs "job-id" \
     --profile your-profile
   ```

4. **Check CloudWatch Logs**
   ```bash
   aws logs tail /aws/batch/job --follow --profile your-profile
   ```

5. **Verify Results in S3**
   ```bash
   aws s3 ls s3://geos-chem-users-ACCOUNT/user-id/sim-id/output/ --profile your-profile
   ```

6. **Verify DynamoDB Updates**
   - Check status transitions
   - Verify cost calculations
   - Check timestamps

**Acceptance Criteria:**
- [ ] Step Functions execution completes
- [ ] AWS Batch job runs successfully
- [ ] Results written to S3
- [ ] DynamoDB updated with final status and cost
- [ ] Frontend displays results

---

## Day 5: Testing, Debugging, & Documentation

### Morning: Comprehensive Testing

#### Task 5.1: Error Scenario Testing

**Test 1: Invalid Configuration**
```bash
# Missing required fields
curl -X POST "${API_URL}/simulations" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"simulationType": "GC_CLASSIC"}'

# Expected: 400 Bad Request
```

**Test 2: Non-Existent Simulation**
```bash
curl -X GET "${API_URL}/simulations/non-existent-id" \
  -H "Authorization: Bearer ${TOKEN}"

# Expected: 404 Not Found
```

**Test 3: Cancel Completed Simulation**
```bash
# Try to cancel a completed simulation
# Expected: 400 with error message
```

**Test 4: Rate Limiting**
```bash
# Send 150 requests in quick succession
for i in {1..150}; do
  curl -X GET "${API_URL}/simulations" \
    -H "Authorization: Bearer ${TOKEN}" &
done
wait

# Expected: Some requests return 429 Too Many Requests
```

**Test 5: Cross-User Access**
```bash
# Create simulation with User A token
# Try to access with User B token
# Expected: 404 or 403
```

**Acceptance Criteria:**
- [ ] Invalid requests properly rejected
- [ ] Error messages are helpful
- [ ] Rate limiting works
- [ ] Cross-user access prevented
- [ ] All errors logged to CloudWatch

#### Task 5.2: Performance Testing

**Concurrent Users Test:**
```bash
# Apache Bench
ab -n 1000 -c 10 -H "Authorization: Bearer ${TOKEN}" \
  "${API_URL}/simulations"
```

**Metrics to Check:**
- Average response time < 500ms
- 99th percentile < 2000ms
- No errors
- Lambda cold starts acceptable

**Acceptance Criteria:**
- [ ] API handles 10 concurrent users
- [ ] Response times acceptable
- [ ] No timeouts
- [ ] CloudWatch metrics look healthy

### Afternoon: Documentation & Cleanup

#### Task 5.3: Update Documentation

**Files to Update:**
1. **README.md** - Add deployment instructions
2. **DEPLOYMENT-GUIDE.md** (new) - Detailed deployment steps
3. **API-REFERENCE.md** (new) - Complete API documentation
4. **TROUBLESHOOTING.md** (new) - Common issues and solutions

#### Task 5.4: Create Week 3 Completion Report

Document:
- All resources deployed
- Test results
- Known issues
- Performance metrics
- Cost tracking
- Next steps

---

## Deployment Checklist

### Pre-Deployment
- [ ] AWS CLI configured with credentials
- [ ] AWS CDK installed (`npm install -g aws-cdk`)
- [ ] Docker installed and running
- [ ] Node.js 18+ installed
- [ ] Account limits checked (Lambda, Batch, etc.)

### Day 1: Authentication
- [ ] Auth stack deployed
- [ ] User pool created
- [ ] Test user created
- [ ] API Gateway authorizer configured
- [ ] Frontend Amplify configured

### Day 2: Infrastructure
- [ ] Core infrastructure stack deployed
- [ ] DynamoDB table operational
- [ ] S3 buckets created
- [ ] Docker containers built and pushed
- [ ] Compute resources stack deployed
- [ ] AWS Batch environments operational

### Day 3: Application
- [ ] Job management stack deployed
- [ ] Lambda functions operational
- [ ] Step Functions state machine created
- [ ] API Gateway endpoints tested
- [ ] CloudWatch logs working

### Day 4: Integration
- [ ] Frontend connected to backend
- [ ] User sign-up/sign-in working
- [ ] Simulation creation working
- [ ] End-to-end workflow tested
- [ ] Monitoring operational

### Day 5: Validation
- [ ] Error scenarios tested
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation updated
- [ ] Week 3 report completed

---

## Resource Naming Conventions

### Stacks
- `GeosChemAuthStack-dev`
- `GeosChemCoreStack-dev`
- `GeosChemComputeStack-dev`
- `GeosChemJobManagementStack-dev`

### DynamoDB
- Table: `geos-chem-simulations-dev`
- GSI: `userId-status-index`, `userId-createdAt-index`

### S3
- `geos-chem-users-{account-id}-dev`
- `geos-chem-system-{account-id}-dev`

### Lambda Functions
- `GeosChemSubmitSimulation-dev`
- `GeosChemValidateConfiguration-dev`
- `GeosChemSubmitBatchJob-dev`
- `GeosChemMonitorJobStatus-dev`
- `GeosChemUpdateSimulationStatus-dev`
- `GeosChemProcessResults-dev`
- `GeosChemGetSimulation-dev`
- `GeosChemListSimulations-dev`
- `GeosChemCancelSimulation-dev`

### AWS Batch
- Compute Environments: `geos-chem-graviton-spot-dev`, `geos-chem-x86-spot-dev`
- Job Queues: `geos-chem-graviton-queue-dev`, `geos-chem-x86-queue-dev`
- Job Definitions: `geos-chem-classic-graviton-dev`, `geos-chem-classic-x86-dev`

---

## Cost Tracking

### Expected Week 3 Costs

**Development/Testing:**
- API Gateway: $0 (free tier)
- Lambda: $0 (free tier)
- DynamoDB: ~$2 (on-demand, low volume)
- S3: ~$1 (storage + requests)
- CloudWatch: ~$1 (logs)
- Cognito: $0 (free tier)
- **Subtotal: ~$4**

**Batch Job Testing:**
- c8g.4xlarge spot (2 hours): ~$0.36
- Data transfer: ~$0.50
- EBS volumes: ~$0.20
- **Subtotal: ~$1.06**

**Total Week 3: ~$5**

---

## Troubleshooting Guide

### Issue: CDK Deploy Fails
**Symptoms:** Stack rollback during deployment
**Causes:**
- Missing IAM permissions
- Resource limits exceeded
- Incorrect configuration

**Solutions:**
1. Check CloudFormation events for specific error
2. Verify IAM permissions with `cdk doctor`
3. Check AWS service quotas
4. Review CDK diff: `cdk diff`

### Issue: Lambda Function Timeout
**Symptoms:** 500 errors from API, Lambda timeout logs
**Causes:**
- DynamoDB query taking too long
- Network connectivity issues
- Cold start delays

**Solutions:**
1. Increase Lambda timeout
2. Add DynamoDB GSI for query patterns
3. Enable VPC endpoints if using VPC
4. Add Lambda Reserved Concurrency

### Issue: AWS Batch Job Fails
**Symptoms:** Job status FAILED, no results in S3
**Causes:**
- Container image issues
- Missing input data
- Insufficient resources
- Network issues

**Solutions:**
1. Check CloudWatch logs for container
2. Verify S3 input data exists
3. Increase job memory/vCPUs
4. Check VPC/subnet configuration
5. Verify IAM role has S3 permissions

### Issue: Cognito Authentication Fails
**Symptoms:** 401 errors from API, sign-in fails
**Causes:**
- Incorrect User Pool ID/Client ID
- Token expired
- User not confirmed
- CORS issues

**Solutions:**
1. Verify Cognito configuration in frontend
2. Confirm user via AWS CLI
3. Check token expiration (1 hour default)
4. Verify API Gateway CORS configuration

---

## Success Metrics

### Deployment Success
- [ ] All stacks deployed: GREEN status
- [ ] No errors in CloudWatch Logs
- [ ] All automated tests passing
- [ ] Manual test scenarios completed

### Performance Success
- [ ] API response time < 500ms (p95)
- [ ] Lambda cold start < 3s
- [ ] Batch job startup < 5 minutes
- [ ] Frontend load time < 2s

### Functional Success
- [ ] User can sign up and sign in
- [ ] User can create simulation
- [ ] Simulation runs to completion
- [ ] Results visible in frontend
- [ ] User can cancel simulation

---

## Next Steps: Week 4

### Week 4 Focus: Testing & Optimization

**Days 1-2: Unit Testing**
- Write Jest tests for all Lambda functions
- Achieve 80%+ code coverage
- Mock AWS SDK calls
- Test error scenarios

**Days 3-4: Performance Optimization**
- Analyze CloudWatch metrics
- Optimize Lambda cold starts
- Tune DynamoDB provisioning
- Optimize Batch job startup

**Day 5: Security Audit**
- Review IAM policies
- Check for over-permissioned roles
- Verify encryption at rest
- Test cross-user isolation

---

**Document Prepared By:** AWS GEOS-Chem Implementation Team
**Date:** October 15, 2025
**Status:** 🟡 Ready to Begin Week 3 Deployment
