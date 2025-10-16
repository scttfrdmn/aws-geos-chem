#!/bin/bash
#
# GEOS-Chem AWS Cloud Runner - Deployment Verification Script
#
# This script automatically verifies all deployed AWS resources
# Profile: aws
# Region: us-west-2
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
export AWS_PROFILE=aws
export AWS_REGION=us-west-2
PROJECT_PREFIX=geos-chem

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

log_fail() {
    echo -e "${RED}[✗]${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

test_start() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${BLUE}Testing:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v aws &> /dev/null; then
        log_fail "AWS CLI not found"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_fail "jq not found. Install with: brew install jq"
        exit 1
    fi

    if ! aws sts get-caller-identity --profile $AWS_PROFILE --region $AWS_REGION &> /dev/null; then
        log_fail "AWS credentials not configured for profile: $AWS_PROFILE"
        exit 1
    fi

    ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
    log_success "Prerequisites OK - Account: $ACCOUNT_ID, Region: $AWS_REGION"
}

# Verify CloudFormation stacks
verify_stacks() {
    log_info "\n=== CloudFormation Stacks ==="

    EXPECTED_STACKS=(
        "${PROJECT_PREFIX}-core-infra"
        "${PROJECT_PREFIX}-auth"
        "${PROJECT_PREFIX}-data"
        "${PROJECT_PREFIX}-compute"
        "${PROJECT_PREFIX}-job-management"
        "${PROJECT_PREFIX}-visualization"
        "${PROJECT_PREFIX}-cost-tracking"
        "${PROJECT_PREFIX}-benchmarking"
        "${PROJECT_PREFIX}-web-app"
    )

    for stack in "${EXPECTED_STACKS[@]}"; do
        test_start "Stack: $stack"

        STATUS=$(aws cloudformation describe-stacks \
            --stack-name $stack \
            --profile $AWS_PROFILE \
            --region $AWS_REGION \
            --query 'Stacks[0].StackStatus' \
            --output text 2>/dev/null || echo "NOT_FOUND")

        if [[ "$STATUS" == "CREATE_COMPLETE" || "$STATUS" == "UPDATE_COMPLETE" ]]; then
            log_success "Stack $stack: $STATUS"
        elif [[ "$STATUS" == "NOT_FOUND" ]]; then
            log_fail "Stack $stack not found"
        else
            log_warn "Stack $stack in state: $STATUS"
        fi
    done
}

# Verify VPC
verify_vpc() {
    log_info "\n=== VPC Configuration ==="

    test_start "VPC existence"

    VPC_ID=$(aws ec2 describe-vpcs \
        --filters "Name=tag:Project,Values=GEOS-Chem-Cloud-Runner" \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'Vpcs[0].VpcId' \
        --output text 2>/dev/null || echo "")

    if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
        log_success "VPC found: $VPC_ID"

        # Check subnets
        test_start "VPC subnets"
        SUBNET_COUNT=$(aws ec2 describe-subnets \
            --filters "Name=vpc-id,Values=$VPC_ID" \
            --profile $AWS_PROFILE \
            --region $AWS_REGION \
            --query 'length(Subnets)' \
            --output text)

        if [ "$SUBNET_COUNT" -ge 6 ]; then
            log_success "Subnets configured: $SUBNET_COUNT"
        else
            log_warn "Expected 6+ subnets, found: $SUBNET_COUNT"
        fi
    else
        log_fail "VPC not found"
    fi
}

# Verify S3 buckets
verify_s3() {
    log_info "\n=== S3 Buckets ==="

    EXPECTED_BUCKETS=(
        "geos-chem-users-${ACCOUNT_ID}"
        "geos-chem-system-${ACCOUNT_ID}"
    )

    for bucket in "${EXPECTED_BUCKETS[@]}"; do
        test_start "Bucket: $bucket"

        if aws s3api head-bucket --bucket $bucket --profile $AWS_PROFILE --region $AWS_REGION 2>/dev/null; then
            log_success "Bucket exists: $bucket"

            # Check encryption
            ENCRYPTION=$(aws s3api get-bucket-encryption \
                --bucket $bucket \
                --profile $AWS_PROFILE \
                --region $AWS_REGION \
                --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' \
                --output text 2>/dev/null || echo "NONE")

            if [ "$ENCRYPTION" != "NONE" ]; then
                log_success "Encryption enabled: $ENCRYPTION"
            else
                log_fail "Encryption not enabled on $bucket"
            fi
        else
            log_fail "Bucket not found: $bucket"
        fi
    done
}

# Verify DynamoDB table
verify_dynamodb() {
    log_info "\n=== DynamoDB Tables ==="

    test_start "Simulations table"

    TABLE_STATUS=$(aws dynamodb describe-table \
        --table-name geos-chem-simulations \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'Table.TableStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND")

    if [ "$TABLE_STATUS" == "ACTIVE" ]; then
        log_success "Table active: geos-chem-simulations"

        # Check GSIs
        GSI_COUNT=$(aws dynamodb describe-table \
            --table-name geos-chem-simulations \
            --profile $AWS_PROFILE \
            --region $AWS_REGION \
            --query 'length(Table.GlobalSecondaryIndexes)' \
            --output text 2>/dev/null || echo "0")

        if [ "$GSI_COUNT" -ge 2 ]; then
            log_success "Global Secondary Indexes: $GSI_COUNT"
        else
            log_warn "Expected 2+ GSIs, found: $GSI_COUNT"
        fi

        # Check encryption
        ENCRYPTION=$(aws dynamodb describe-table \
            --table-name geos-chem-simulations \
            --profile $AWS_PROFILE \
            --region $AWS_REGION \
            --query 'Table.SSEDescription.Status' \
            --output text 2>/dev/null || echo "DISABLED")

        if [ "$ENCRYPTION" == "ENABLED" ]; then
            log_success "Encryption enabled"
        else
            log_fail "Encryption not enabled"
        fi
    else
        log_fail "Table not found or not active: $TABLE_STATUS"
    fi
}

# Verify Cognito
verify_cognito() {
    log_info "\n=== Cognito User Pool ==="

    test_start "User Pool existence"

    # Get User Pool ID from outputs if available
    if [ -f aws-geos-chem-cdk/outputs/auth-outputs.json ]; then
        USER_POOL_ID=$(jq -r '.["geos-chem-auth"].UserPoolId' aws-geos-chem-cdk/outputs/auth-outputs.json 2>/dev/null || echo "")

        if [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "null" ]; then
            log_success "User Pool ID: $USER_POOL_ID"

            # Check user pool status
            POOL_STATUS=$(aws cognito-idp describe-user-pool \
                --user-pool-id $USER_POOL_ID \
                --profile $AWS_PROFILE \
                --region $AWS_REGION \
                --query 'UserPool.Status' \
                --output text 2>/dev/null || echo "ERROR")

            if [ "$POOL_STATUS" == "Enabled" ] || [ "$POOL_STATUS" == "ENABLED" ]; then
                log_success "User Pool enabled"
            else
                log_warn "User Pool status: $POOL_STATUS"
            fi

            # Check client
            CLIENT_ID=$(jq -r '.["geos-chem-auth"].UserPoolClientId' aws-geos-chem-cdk/outputs/auth-outputs.json 2>/dev/null || echo "")
            if [ -n "$CLIENT_ID" ] && [ "$CLIENT_ID" != "null" ]; then
                log_success "User Pool Client ID: $CLIENT_ID"
            else
                log_fail "User Pool Client ID not found"
            fi
        else
            log_fail "User Pool ID not found in outputs"
        fi
    else
        log_warn "Auth outputs file not found - skipping detailed checks"
    fi
}

# Verify Lambda functions
verify_lambda() {
    log_info "\n=== Lambda Functions ==="

    EXPECTED_FUNCTIONS=(
        "geos-chem-submit-simulation"
        "geos-chem-get-simulations"
        "geos-chem-get-simulation"
        "geos-chem-cancel-simulation"
        "geos-chem-validate-config"
        "geos-chem-prepare-input"
        "geos-chem-start-batch-job"
        "geos-chem-monitor-job"
        "geos-chem-process-results"
        "geos-chem-notification"
    )

    for function in "${EXPECTED_FUNCTIONS[@]}"; do
        test_start "Function: $function"

        STATE=$(aws lambda get-function \
            --function-name $function \
            --profile $AWS_PROFILE \
            --region $AWS_REGION \
            --query 'Configuration.State' \
            --output text 2>/dev/null || echo "NOT_FOUND")

        if [ "$STATE" == "Active" ]; then
            log_success "Function active: $function"
        elif [ "$STATE" == "NOT_FOUND" ]; then
            log_fail "Function not found: $function"
        else
            log_warn "Function state: $STATE"
        fi
    done
}

# Verify API Gateway
verify_api_gateway() {
    log_info "\n=== API Gateway ==="

    test_start "API Gateway existence"

    if [ -f aws-geos-chem-cdk/outputs/job-management-outputs.json ]; then
        API_URL=$(jq -r '.["geos-chem-job-management"].ApiUrl' aws-geos-chem-cdk/outputs/job-management-outputs.json 2>/dev/null || echo "")

        if [ -n "$API_URL" ] && [ "$API_URL" != "null" ]; then
            log_success "API URL: $API_URL"

            # Test unauthenticated request (should fail)
            test_start "API authentication enforcement"
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/simulations")

            if [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
                log_success "Unauthenticated requests correctly rejected"
            else
                log_fail "API not enforcing authentication (HTTP $HTTP_CODE)"
            fi
        else
            log_fail "API URL not found in outputs"
        fi
    else
        log_warn "Job management outputs file not found"
    fi
}

# Verify Step Functions
verify_step_functions() {
    log_info "\n=== Step Functions ==="

    test_start "State Machine existence"

    STATE_MACHINES=$(aws stepfunctions list-state-machines \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'stateMachines[?contains(name, `geos-chem`)].name' \
        --output text 2>/dev/null || echo "")

    if [ -n "$STATE_MACHINES" ]; then
        for machine in $STATE_MACHINES; do
            log_success "State Machine found: $machine"
        done
    else
        log_warn "No Step Functions state machines found"
    fi
}

# Verify AWS Batch
verify_batch() {
    log_info "\n=== AWS Batch ==="

    test_start "Compute Environments"

    COMPUTE_ENVS=$(aws batch describe-compute-environments \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'computeEnvironments[?contains(computeEnvironmentName, `geos-chem`)].{Name:computeEnvironmentName, Status:status, State:state}' \
        --output json 2>/dev/null || echo "[]")

    ENV_COUNT=$(echo "$COMPUTE_ENVS" | jq '. | length')

    if [ "$ENV_COUNT" -gt 0 ]; then
        log_success "Compute Environments found: $ENV_COUNT"

        echo "$COMPUTE_ENVS" | jq -r '.[] | "  - \(.Name): \(.State) / \(.Status)"'

        # Check if any are in INVALID state
        INVALID=$(echo "$COMPUTE_ENVS" | jq -r '.[] | select(.Status == "INVALID") | .Name')
        if [ -n "$INVALID" ]; then
            log_fail "Invalid compute environments: $INVALID"
        fi
    else
        log_warn "No compute environments found"
    fi

    test_start "Job Queues"

    JOB_QUEUES=$(aws batch describe-job-queues \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'jobQueues[?contains(jobQueueName, `geos-chem`)].{Name:jobQueueName, Status:status, State:state}' \
        --output json 2>/dev/null || echo "[]")

    QUEUE_COUNT=$(echo "$JOB_QUEUES" | jq '. | length')

    if [ "$QUEUE_COUNT" -gt 0 ]; then
        log_success "Job Queues found: $QUEUE_COUNT"

        echo "$JOB_QUEUES" | jq -r '.[] | "  - \(.Name): \(.State) / \(.Status)"'
    else
        log_warn "No job queues found"
    fi

    test_start "Job Definitions"

    JOB_DEFS=$(aws batch describe-job-definitions \
        --status ACTIVE \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'jobDefinitions[?contains(jobDefinitionName, `geos-chem`)] | length(@)' \
        --output text 2>/dev/null || echo "0")

    if [ "$JOB_DEFS" -gt 0 ]; then
        log_success "Job Definitions found: $JOB_DEFS"
    else
        log_warn "No job definitions found"
    fi
}

# Verify ECR
verify_ecr() {
    log_info "\n=== ECR Repository ==="

    test_start "ECR repository"

    if aws ecr describe-repositories \
        --repository-names geos-chem \
        --profile $AWS_PROFILE \
        --region $AWS_REGION &> /dev/null; then

        log_success "ECR repository exists: geos-chem"

        # Check images
        IMAGE_COUNT=$(aws ecr describe-images \
            --repository-name geos-chem \
            --profile $AWS_PROFILE \
            --region $AWS_REGION \
            --query 'length(imageDetails)' \
            --output text 2>/dev/null || echo "0")

        if [ "$IMAGE_COUNT" -gt 0 ]; then
            log_success "Container images found: $IMAGE_COUNT"

            # List image tags
            aws ecr describe-images \
                --repository-name geos-chem \
                --profile $AWS_PROFILE \
                --region $AWS_REGION \
                --query 'imageDetails[*].imageTags' \
                --output text 2>/dev/null | tr '\t' '\n' | sort -u | sed 's/^/  - /'
        else
            log_warn "No container images found in repository"
        fi
    else
        log_fail "ECR repository not found: geos-chem"
    fi
}

# Generate summary report
generate_summary() {
    log_info "\n=== Verification Summary ==="

    echo ""
    echo "Total Tests:    $TOTAL_TESTS"
    echo -e "${GREEN}Passed:${NC}         $PASSED_TESTS"
    echo -e "${RED}Failed:${NC}         $FAILED_TESTS"
    echo -e "${YELLOW}Warnings:${NC}       $WARNINGS"
    echo ""

    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ All critical tests passed!${NC}"
        echo -e "Pass rate: ${GREEN}${PASS_RATE}%${NC}"
        echo ""
        echo "Deployment verification: SUCCESS"
        return 0
    elif [ $PASS_RATE -ge 80 ]; then
        echo -e "${YELLOW}⚠ Most tests passed, but some issues found${NC}"
        echo -e "Pass rate: ${YELLOW}${PASS_RATE}%${NC}"
        echo ""
        echo "Deployment verification: PARTIAL SUCCESS"
        return 1
    else
        echo -e "${RED}✗ Multiple tests failed${NC}"
        echo -e "Pass rate: ${RED}${PASS_RATE}%${NC}"
        echo ""
        echo "Deployment verification: FAILED"
        return 2
    fi
}

# Save results to file
save_results() {
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    REPORT_FILE="verification-report-${TIMESTAMP}.txt"

    {
        echo "GEOS-Chem AWS Cloud Runner - Deployment Verification Report"
        echo "============================================================"
        echo "Date: $(date)"
        echo "Account: $ACCOUNT_ID"
        echo "Region: $AWS_REGION"
        echo ""
        echo "Results:"
        echo "  Total Tests: $TOTAL_TESTS"
        echo "  Passed: $PASSED_TESTS"
        echo "  Failed: $FAILED_TESTS"
        echo "  Warnings: $WARNINGS"
        echo ""
        echo "Pass Rate: $((PASSED_TESTS * 100 / TOTAL_TESTS))%"
    } > "$REPORT_FILE"

    log_info "Report saved to: $REPORT_FILE"
}

# Main execution
main() {
    echo "=============================================="
    echo "GEOS-Chem AWS Cloud Runner"
    echo "Deployment Verification"
    echo "=============================================="
    echo ""

    check_prerequisites

    verify_stacks
    verify_vpc
    verify_s3
    verify_dynamodb
    verify_cognito
    verify_lambda
    verify_api_gateway
    verify_step_functions
    verify_batch
    verify_ecr

    generate_summary
    RESULT=$?

    save_results

    exit $RESULT
}

# Run main function
main
