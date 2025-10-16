#!/bin/bash
#
# GEOS-Chem AWS Cloud Runner - End-to-End Test Script
#
# Tests complete workflow from submission to completion
# Profile: aws
# Region: us-west-2
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
export AWS_PROFILE=aws
export AWS_REGION=us-west-2

# Test configuration
MAX_WAIT_MINUTES=${MAX_WAIT_MINUTES:-60}
POLL_INTERVAL=${POLL_INTERVAL:-30}

# Logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_fail() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if [ ! -f aws-geos-chem-cdk/outputs/auth-outputs.json ]; then
        log_fail "Auth outputs not found. Run deploy.sh first."
        exit 1
    fi

    if [ ! -f aws-geos-chem-cdk/outputs/job-management-outputs.json ]; then
        log_fail "Job management outputs not found. Run deploy.sh first."
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_fail "jq not found. Install with: brew install jq"
        exit 1
    fi

    if ! command -v curl &> /dev/null; then
        log_fail "curl not found"
        exit 1
    fi

    log_success "Prerequisites OK"
}

# Get authentication token
get_auth_token() {
    log_info "Authenticating..."

    USER_POOL_ID=$(jq -r '.["geos-chem-auth"].UserPoolId' aws-geos-chem-cdk/outputs/auth-outputs.json)
    CLIENT_ID=$(jq -r '.["geos-chem-auth"].UserPoolClientId' aws-geos-chem-cdk/outputs/auth-outputs.json)

    TOKEN=$(aws cognito-idp admin-initiate-auth \
        --user-pool-id $USER_POOL_ID \
        --client-id $CLIENT_ID \
        --auth-flow ADMIN_NO_SRP_AUTH \
        --auth-parameters USERNAME=testuser@example.com,PASSWORD=TestPass123! \
        --profile $AWS_PROFILE \
        --region $AWS_REGION \
        --query 'AuthenticationResult.IdToken' \
        --output text 2>/dev/null)

    if [ -z "$TOKEN" ]; then
        log_fail "Failed to authenticate"
        exit 1
    fi

    log_success "Authenticated successfully"
}

# Get API URL
get_api_url() {
    API_URL=$(jq -r '.["geos-chem-job-management"].ApiUrl' aws-geos-chem-cdk/outputs/job-management-outputs.json)

    if [ -z "$API_URL" ] || [ "$API_URL" == "null" ]; then
        log_fail "API URL not found"
        exit 1
    fi

    log_info "API URL: $API_URL"
}

# Test 1: Full Chemistry Simulation (Graviton4)
test_fullchem_graviton4() {
    echo ""
    echo "=============================================="
    echo "Test 1: Full Chemistry - Graviton4"
    echo "=============================================="

    log_info "Submitting full chemistry simulation..."

    RESPONSE=$(curl -s -X POST "${API_URL}/simulations" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{
            "simulationName": "E2E Test - Full Chemistry Graviton4",
            "simulationType": "fullchem",
            "startDate": "2024-01-01",
            "endDate": "2024-01-02",
            "resolution": "4x5",
            "region": "global",
            "processorType": "graviton4",
            "instanceType": "c8g.4xlarge",
            "configuration": {
                "chemistry": "fullchem",
                "emissions": ["CEDS", "GFED"],
                "meteorology": "MERRA2"
            }
        }' 2>&1)

    # Check for errors
    if echo "$RESPONSE" | grep -q "error\|Error\|ERROR"; then
        log_fail "Simulation submission failed"
        echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
        return 1
    fi

    # Extract simulation ID
    SIMULATION_ID=$(echo "$RESPONSE" | jq -r '.simulationId // .simulation.simulationId // empty' 2>/dev/null)

    if [ -z "$SIMULATION_ID" ] || [ "$SIMULATION_ID" == "null" ]; then
        log_fail "Failed to get simulation ID"
        echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
        return 1
    fi

    log_success "Simulation submitted: $SIMULATION_ID"

    # Monitor simulation
    monitor_simulation "$SIMULATION_ID"
    RESULT=$?

    if [ $RESULT -eq 0 ]; then
        log_success "Test 1 PASSED: Full Chemistry Graviton4"
        return 0
    else
        log_fail "Test 1 FAILED: Full Chemistry Graviton4"
        return 1
    fi
}

# Test 2: Transport Tracers (AMD x86)
test_transport_amd() {
    echo ""
    echo "=============================================="
    echo "Test 2: Transport Tracers - AMD x86"
    echo "=============================================="

    log_info "Submitting transport tracers simulation..."

    RESPONSE=$(curl -s -X POST "${API_URL}/simulations" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{
            "simulationName": "E2E Test - Transport AMD",
            "simulationType": "TransportTracers",
            "startDate": "2024-01-01",
            "endDate": "2024-01-02",
            "resolution": "4x5",
            "region": "global",
            "processorType": "amd_x86",
            "instanceType": "c7a.4xlarge",
            "configuration": {
                "chemistry": "none",
                "meteorology": "MERRA2"
            }
        }' 2>&1)

    SIMULATION_ID=$(echo "$RESPONSE" | jq -r '.simulationId // .simulation.simulationId // empty' 2>/dev/null)

    if [ -z "$SIMULATION_ID" ] || [ "$SIMULATION_ID" == "null" ]; then
        log_fail "Failed to submit simulation"
        echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
        return 1
    fi

    log_success "Simulation submitted: $SIMULATION_ID"

    monitor_simulation "$SIMULATION_ID"
    RESULT=$?

    if [ $RESULT -eq 0 ]; then
        log_success "Test 2 PASSED: Transport Tracers AMD"
        return 0
    else
        log_fail "Test 2 FAILED: Transport Tracers AMD"
        return 1
    fi
}

# Test 3: Methane Simulation (Intel x86)
test_methane_intel() {
    echo ""
    echo "=============================================="
    echo "Test 3: Methane - Intel x86"
    echo "=============================================="

    log_info "Submitting methane simulation..."

    RESPONSE=$(curl -s -X POST "${API_URL}/simulations" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${TOKEN}" \
        -d '{
            "simulationName": "E2E Test - Methane Intel",
            "simulationType": "CH4",
            "startDate": "2024-01-01",
            "endDate": "2024-01-02",
            "resolution": "4x5",
            "region": "global",
            "processorType": "intel_x86",
            "instanceType": "c7i.4xlarge",
            "configuration": {
                "chemistry": "CH4",
                "meteorology": "MERRA2"
            }
        }' 2>&1)

    SIMULATION_ID=$(echo "$RESPONSE" | jq -r '.simulationId // .simulation.simulationId // empty' 2>/dev/null)

    if [ -z "$SIMULATION_ID" ] || [ "$SIMULATION_ID" == "null" ]; then
        log_fail "Failed to submit simulation"
        echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
        return 1
    fi

    log_success "Simulation submitted: $SIMULATION_ID"

    monitor_simulation "$SIMULATION_ID"
    RESULT=$?

    if [ $RESULT -eq 0 ]; then
        log_success "Test 3 PASSED: Methane Intel"
        return 0
    else
        log_fail "Test 3 FAILED: Methane Intel"
        return 1
    fi
}

# Monitor simulation progress
monitor_simulation() {
    local SIM_ID=$1
    local MAX_ITERATIONS=$((MAX_WAIT_MINUTES * 60 / POLL_INTERVAL))
    local ITERATION=0

    log_info "Monitoring simulation: $SIM_ID"
    log_info "Max wait time: $MAX_WAIT_MINUTES minutes"

    while [ $ITERATION -lt $MAX_ITERATIONS ]; do
        ITERATION=$((ITERATION + 1))

        # Get simulation status
        STATUS_RESPONSE=$(curl -s -X GET "${API_URL}/simulations/${SIM_ID}" \
            -H "Authorization: Bearer ${TOKEN}" 2>&1)

        STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status // .simulation.status // "UNKNOWN"' 2>/dev/null)

        ELAPSED=$((ITERATION * POLL_INTERVAL))
        log_info "[$ELAPSED s] Status: $STATUS"

        case "$STATUS" in
            "COMPLETED"|"SUCCEEDED")
                log_success "Simulation completed successfully!"

                # Verify results
                verify_results "$SIM_ID"
                return $?
                ;;

            "FAILED")
                log_fail "Simulation failed!"
                echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
                return 1
                ;;

            "CANCELLED"|"CANCELED")
                log_fail "Simulation was cancelled"
                return 1
                ;;

            "RUNNING"|"IN_PROGRESS"|"VALIDATING"|"PREPARING"|"SUBMITTED")
                # Continue monitoring
                ;;

            "UNKNOWN")
                log_warn "Unable to determine status"
                ;;

            *)
                log_warn "Unknown status: $STATUS"
                ;;
        esac

        sleep $POLL_INTERVAL
    done

    log_fail "Timeout: Simulation did not complete within $MAX_WAIT_MINUTES minutes"
    return 1
}

# Verify simulation results
verify_results() {
    local SIM_ID=$1

    log_info "Verifying results for $SIM_ID..."

    # Get simulation details
    DETAILS=$(curl -s -X GET "${API_URL}/simulations/${SIM_ID}" \
        -H "Authorization: Bearer ${TOKEN}")

    # Check for output files in S3
    USER_ID=$(echo "$DETAILS" | jq -r '.userId // "testuser@example.com"' 2>/dev/null)
    ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
    S3_BUCKET="geos-chem-users-${ACCOUNT_ID}"
    S3_PREFIX="${USER_ID}/${SIM_ID}"

    log_info "Checking S3 for results: s3://${S3_BUCKET}/${S3_PREFIX}/"

    FILE_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
        --recursive \
        --profile $AWS_PROFILE \
        --region $AWS_REGION 2>/dev/null | wc -l)

    if [ "$FILE_COUNT" -gt 0 ]; then
        log_success "Found $FILE_COUNT result files in S3"

        # List some files
        aws s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
            --recursive \
            --profile $AWS_PROFILE \
            --region $AWS_REGION \
            --human-readable 2>/dev/null | head -10

        return 0
    else
        log_warn "No result files found in S3"
        return 1
    fi
}

# Test API endpoints
test_api_endpoints() {
    echo ""
    echo "=============================================="
    echo "API Endpoint Tests"
    echo "=============================================="

    # Test 1: GET simulations (should work)
    log_info "Testing GET /simulations..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X GET "${API_URL}/simulations" \
        -H "Authorization: Bearer ${TOKEN}")

    if [ "$HTTP_CODE" == "200" ]; then
        log_success "GET /simulations: OK"
    else
        log_fail "GET /simulations: HTTP $HTTP_CODE"
    fi

    # Test 2: Unauthenticated request (should fail)
    log_info "Testing unauthenticated request..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X GET "${API_URL}/simulations")

    if [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
        log_success "Unauthenticated request correctly rejected"
    else
        log_fail "Unauthenticated request not rejected: HTTP $HTTP_CODE"
    fi

    # Test 3: Invalid request body (should fail)
    log_info "Testing invalid request validation..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST "${API_URL}/simulations" \
        -H "Authorization: Bearer ${TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"invalid": "data"}')

    if [ "$HTTP_CODE" == "400" ]; then
        log_success "Invalid request correctly rejected"
    else
        log_warn "Invalid request handling: HTTP $HTTP_CODE"
    fi
}

# Generate test report
generate_report() {
    local PASSED=$1
    local TOTAL=$2
    local FAILED=$((TOTAL - PASSED))

    echo ""
    echo "=============================================="
    echo "Test Report"
    echo "=============================================="
    echo ""
    echo "Total Tests:     $TOTAL"
    echo "Passed:          $PASSED"
    echo "Failed:          $FAILED"
    echo ""

    PASS_RATE=$((PASSED * 100 / TOTAL))
    echo "Pass Rate:       $PASS_RATE%"
    echo ""

    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo "=============================================="
    echo "GEOS-Chem AWS Cloud Runner"
    echo "End-to-End Testing"
    echo "=============================================="
    echo ""

    check_prerequisites
    get_auth_token
    get_api_url

    # Test API endpoints first
    test_api_endpoints

    # Run simulation tests
    PASSED_TESTS=0
    TOTAL_TESTS=3

    # Allow tests to fail without exiting
    set +e

    # Test 1: Full Chemistry Graviton4
    if test_fullchem_graviton4; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi

    # Test 2: Transport Tracers AMD
    if test_transport_amd; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi

    # Test 3: Methane Intel
    if test_methane_intel; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi

    set -e

    # Generate report
    generate_report $PASSED_TESTS $TOTAL_TESTS
    RESULT=$?

    # Save report
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    REPORT_FILE="e2e-test-report-${TIMESTAMP}.txt"

    {
        echo "GEOS-Chem AWS Cloud Runner - E2E Test Report"
        echo "============================================"
        echo "Date: $(date)"
        echo "Region: $AWS_REGION"
        echo ""
        echo "Results:"
        echo "  Total Tests: $TOTAL_TESTS"
        echo "  Passed: $PASSED_TESTS"
        echo "  Failed: $((TOTAL_TESTS - PASSED_TESTS))"
        echo ""
        echo "Pass Rate: $PASS_RATE%"
    } > "$REPORT_FILE"

    log_info "Report saved to: $REPORT_FILE"

    exit $RESULT
}

# Parse command line options
QUICK_TEST=false
TEST_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            QUICK_TEST=true
            MAX_WAIT_MINUTES=10
            shift
            ;;
        --test)
            TEST_NAME="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --quick          Run quick test (10 min timeout)"
            echo "  --test NAME      Run specific test (fullchem|transport|methane)"
            echo "  --help           Show this help"
            echo ""
            echo "Environment variables:"
            echo "  MAX_WAIT_MINUTES  Maximum wait time (default: 60)"
            echo "  POLL_INTERVAL     Poll interval in seconds (default: 30)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main or specific test
if [ -n "$TEST_NAME" ]; then
    check_prerequisites
    get_auth_token
    get_api_url

    case "$TEST_NAME" in
        fullchem)
            test_fullchem_graviton4
            ;;
        transport)
            test_transport_amd
            ;;
        methane)
            test_methane_intel
            ;;
        *)
            echo "Unknown test: $TEST_NAME"
            exit 1
            ;;
    esac
else
    main
fi
