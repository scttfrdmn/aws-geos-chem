#!/bin/bash
#
# GEOS-Chem AWS Cloud Runner - Deployment Script
#
# This script deploys the complete infrastructure to AWS
# Profile: aws
# Region: us-west-2
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
export AWS_PROFILE=aws
export AWS_REGION=us-west-2
export ENV=dev
export PROJECT_PREFIX=geos-chem

# Logging
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it first."
        exit 1
    fi

    # Check CDK
    if ! command -v cdk &> /dev/null; then
        log_error "AWS CDK not found. Please install: npm install -g aws-cdk"
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker first."
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $AWS_PROFILE --region $AWS_REGION &> /dev/null; then
        log_error "AWS credentials not configured for profile: $AWS_PROFILE"
        exit 1
    fi

    ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
    log_info "AWS Account: $ACCOUNT_ID"
    log_info "AWS Region: $AWS_REGION"
    log_info "AWS Profile: $AWS_PROFILE"
}

# CDK Bootstrap
bootstrap_cdk() {
    log_info "Bootstrapping CDK (if not already done)..."

    cd aws-geos-chem-cdk

    if cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION --profile $AWS_PROFILE 2>&1 | grep -q "already bootstrapped"; then
        log_info "CDK already bootstrapped"
    else
        log_info "CDK bootstrap complete"
    fi
}

# Deploy Authentication Stack
deploy_auth() {
    log_info "Deploying Authentication Stack..."

    cd aws-geos-chem-cdk
    npm run build

    cdk deploy $PROJECT_PREFIX-auth \
        --require-approval never \
        --outputs-file outputs/auth-outputs.json \
        --profile $AWS_PROFILE \
        --region $AWS_REGION

    log_info "Authentication stack deployed"

    # Extract outputs
    if [ -f outputs/auth-outputs.json ]; then
        USER_POOL_ID=$(jq -r ".[\"$PROJECT_PREFIX-auth\"].UserPoolId" outputs/auth-outputs.json)
        CLIENT_ID=$(jq -r ".[\"$PROJECT_PREFIX-auth\"].UserPoolClientId" outputs/auth-outputs.json)

        log_info "User Pool ID: $USER_POOL_ID"
        log_info "Client ID: $CLIENT_ID"

        # Save for later use
        echo "export USER_POOL_ID=$USER_POOL_ID" > .env.deploy
        echo "export CLIENT_ID=$CLIENT_ID" >> .env.deploy
    fi
}

# Deploy Data Services Stack
deploy_data() {
    log_info "Deploying Data Services Stack..."

    cd aws-geos-chem-cdk

    cdk deploy $PROJECT_PREFIX-data \
        --require-approval never \
        --outputs-file outputs/data-outputs.json \
        --profile $AWS_PROFILE \
        --region $AWS_REGION

    log_info "Data services stack deployed"
}

# Build and push Docker containers
build_containers() {
    log_info "Building and pushing Docker containers..."

    # Create ECR repository if it doesn't exist
    if ! aws ecr describe-repositories \
        --repository-names geos-chem \
        --profile $AWS_PROFILE \
        --region $AWS_REGION &> /dev/null; then

        log_info "Creating ECR repository..."
        aws ecr create-repository \
            --repository-name geos-chem \
            --profile $AWS_PROFILE \
            --region $AWS_REGION
    fi

    # Get ECR URI
    ECR_REPO=$(aws ecr describe-repositories \
        --repository-names geos-chem \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'repositories[0].repositoryUri' --output text)

    log_info "ECR Repository: $ECR_REPO"

    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE | \
        docker login --username AWS --password-stdin $ECR_REPO

    cd container

    # Build ARM64 container
    log_info "Building ARM64 container..."
    docker buildx build --platform linux/arm64 \
        -t geos-chem:latest-arm64 \
        -f Dockerfile.benchmark.arm64 . \
        --load || log_warn "ARM64 build failed, skipping..."

    if docker images | grep -q "geos-chem.*latest-arm64"; then
        docker tag geos-chem:latest-arm64 ${ECR_REPO}:latest-arm64
        docker push ${ECR_REPO}:latest-arm64
        log_info "ARM64 container pushed"
    fi

    # Build AMD64 container
    log_info "Building AMD64 container..."
    docker buildx build --platform linux/amd64 \
        -t geos-chem:latest-amd64 \
        -f Dockerfile.benchmark.amd64 . \
        --load || log_warn "AMD64 build failed, skipping..."

    if docker images | grep -q "geos-chem.*latest-amd64"; then
        docker tag geos-chem:latest-amd64 ${ECR_REPO}:latest-amd64
        docker push ${ECR_REPO}:latest-amd64
        log_info "AMD64 container pushed"
    fi

    cd ..
}

# Deploy Compute Resources Stack
deploy_compute() {
    log_info "Deploying Compute Resources Stack..."

    cd aws-geos-chem-cdk

    # Set Graviton4 instance types
    export GRAVITON_INSTANCE_TYPES=c8g.4xlarge,c8g.8xlarge
    export X86_INSTANCE_TYPES=c7i.4xlarge,c7i.8xlarge

    cdk deploy $PROJECT_PREFIX-compute \
        --require-approval never \
        --outputs-file outputs/compute-outputs.json \
        --profile $AWS_PROFILE \
        --region $AWS_REGION

    log_info "Compute resources stack deployed"
}

# Deploy Job Management Stack
deploy_job_management() {
    log_info "Deploying Job Management Stack..."

    cd aws-geos-chem-cdk

    cdk deploy $PROJECT_PREFIX-job-management \
        --require-approval never \
        --outputs-file outputs/job-management-outputs.json \
        --profile $AWS_PROFILE \
        --region $AWS_REGION

    log_info "Job management stack deployed"

    # Extract API URL
    if [ -f outputs/job-management-outputs.json ]; then
        API_URL=$(jq -r ".[\"$PROJECT_PREFIX-job-management\"].ApiUrl" outputs/job-management-outputs.json)
        log_info "API Gateway URL: $API_URL"

        echo "export API_URL=$API_URL" >> .env.deploy
    fi
}

# Create test user
create_test_user() {
    log_info "Creating test user..."

    source aws-geos-chem-cdk/.env.deploy

    # Create user
    if aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username testuser@example.com \
        --user-attributes Name=email,Value=testuser@example.com \
        --temporary-password TempPass123! \
        --message-action SUPPRESS \
        --profile $AWS_PROFILE \
        --region $AWS_REGION 2>&1 | grep -q "UsernameExistsException"; then

        log_info "Test user already exists"
    else
        log_info "Test user created"
    fi

    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username testuser@example.com \
        --password TestPass123! \
        --permanent \
        --profile $AWS_PROFILE \
        --region $AWS_REGION 2>/dev/null || true

    log_info "Test user credentials:"
    log_info "  Email: testuser@example.com"
    log_info "  Password: TestPass123!"
}

# Test API
test_api() {
    log_info "Testing API..."

    source aws-geos-chem-cdk/.env.deploy

    # Get token
    TOKEN=$(aws cognito-idp admin-initiate-auth \
        --user-pool-id $USER_POOL_ID \
        --client-id $CLIENT_ID \
        --auth-flow ADMIN_NO_SRP_AUTH \
        --auth-parameters USERNAME=testuser@example.com,PASSWORD=TestPass123! \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'AuthenticationResult.IdToken' --output text)

    # Test unauthenticated request (should fail)
    log_info "Testing unauthenticated request..."
    if curl -s -X GET "${API_URL}/simulations" | grep -q "Unauthorized"; then
        log_info "✓ Unauthenticated request correctly rejected"
    else
        log_warn "✗ Unauthenticated request not properly blocked"
    fi

    # Test authenticated request
    log_info "Testing authenticated request..."
    RESPONSE=$(curl -s -X GET "${API_URL}/simulations" \
        -H "Authorization: Bearer ${TOKEN}")

    if echo $RESPONSE | jq . &> /dev/null; then
        log_info "✓ Authenticated request successful"
        echo $RESPONSE | jq .
    else
        log_error "✗ Authenticated request failed"
        echo $RESPONSE
    fi
}

# Generate frontend config
generate_frontend_config() {
    log_info "Generating frontend configuration..."

    source aws-geos-chem-cdk/.env.deploy

    cat > web-interface/src/aws-exports.ts << EOF
const awsmobile = {
  aws_project_region: '${AWS_REGION}',
  aws_cognito_region: '${AWS_REGION}',
  aws_user_pools_id: '${USER_POOL_ID}',
  aws_user_pools_web_client_id: '${CLIENT_ID}',
  aws_cloud_logic_custom: [
    {
      name: 'GeosChemAPI',
      endpoint: '${API_URL}',
      region: '${AWS_REGION}'
    }
  ]
};

export default awsmobile;
EOF

    log_info "Frontend configuration generated: web-interface/src/aws-exports.ts"
}

# Main deployment flow
main() {
    log_info "Starting GEOS-Chem AWS Cloud Runner Deployment"
    log_info "=============================================="

    # Check prerequisites
    check_prerequisites

    # Get account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)

    # Create outputs directory
    mkdir -p aws-geos-chem-cdk/outputs

    # Deploy stacks
    bootstrap_cdk
    deploy_auth
    deploy_data
    build_containers
    deploy_compute
    deploy_job_management

    # Setup and test
    create_test_user
    test_api
    generate_frontend_config

    log_info "=============================================="
    log_info "Deployment Complete!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Start frontend: cd web-interface && npm install && npm start"
    log_info "2. Open browser: http://localhost:3000"
    log_info "3. Sign in with: testuser@example.com / TestPass123!"
    log_info ""
    log_info "API URL: $API_URL"
    log_info "User Pool ID: $USER_POOL_ID"
    log_info ""
    log_info "Configuration saved to: aws-geos-chem-cdk/.env.deploy"
}

# Run main function
main
