#!/bin/bash
# deploy-cluster.sh - Deploy and manage GCHP ParallelCluster

set -e

# Default values
CLUSTER_NAME="gchp-cluster"
REGION="us-east-1"
ENVIRONMENT="dev"
ACTION="create"
SUBNET_ID=""
KEY_PAIR_NAME=""
SCRIPTS_BUCKET=""

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Deploy and manage GCHP ParallelCluster"
    echo ""
    echo "Options:"
    echo "  -n, --name NAME       Cluster name (default: gchp-cluster)"
    echo "  -r, --region REGION   AWS region (default: us-east-1)"
    echo "  -e, --env ENV         Environment (dev, test, prod) (default: dev)"
    echo "  -s, --subnet SUBNET   Subnet ID (required)"
    echo "  -k, --key KEY_PAIR    EC2 Key Pair name (required)"
    echo "  -b, --bucket BUCKET   S3 bucket for scripts (required)"
    echo "  -a, --action ACTION   Action to perform (create, update, delete) (default: create)"
    echo "  -h, --help            Show this help message"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -n|--name)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--subnet)
            SUBNET_ID="$2"
            shift 2
            ;;
        -k|--key)
            KEY_PAIR_NAME="$2"
            shift 2
            ;;
        -b|--bucket)
            SCRIPTS_BUCKET="$2"
            shift 2
            ;;
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required parameters
if [ -z "$SUBNET_ID" ] || [ -z "$KEY_PAIR_NAME" ] || [ -z "$SCRIPTS_BUCKET" ]; then
    echo "Error: Missing required parameters"
    usage
fi

# Validate action
if [[ "$ACTION" != "create" && "$ACTION" != "update" && "$ACTION" != "delete" ]]; then
    echo "Error: Invalid action. Must be 'create', 'update', or 'delete'"
    usage
fi

# Check if pcluster CLI is installed
if ! command -v pcluster &> /dev/null; then
    echo "AWS ParallelCluster CLI not found. Installing..."
    pip install aws-parallelcluster
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS CLI not configured. Please run 'aws configure'"
    exit 1
fi

# Create temporary config file with substitutions
CONFIG_FILE="$(mktemp)"
cat gchp-cluster-config.yaml | \
    sed "s|\${AWS_REGION}|$REGION|g" | \
    sed "s|\${SUBNET_ID}|$SUBNET_ID|g" | \
    sed "s|\${KEY_PAIR_NAME}|$KEY_PAIR_NAME|g" | \
    sed "s|\${SCRIPTS_BUCKET}|$SCRIPTS_BUCKET|g" | \
    sed "s|\${ENVIRONMENT}|$ENVIRONMENT|g" > "$CONFIG_FILE"

echo "Generated configuration file at $CONFIG_FILE"

# Upload scripts to S3
echo "Uploading setup scripts to S3..."
aws s3 cp gchp-node-setup.sh "s3://$SCRIPTS_BUCKET/gchp-node-setup.sh"

# Perform requested action
case $ACTION in
    create)
        echo "Creating ParallelCluster '$CLUSTER_NAME'..."
        pcluster create-cluster \
            --cluster-name "$CLUSTER_NAME" \
            --cluster-configuration "$CONFIG_FILE" \
            --region "$REGION"
        ;;
    update)
        echo "Updating ParallelCluster '$CLUSTER_NAME'..."
        pcluster update-cluster \
            --cluster-name "$CLUSTER_NAME" \
            --cluster-configuration "$CONFIG_FILE" \
            --region "$REGION"
        ;;
    delete)
        echo "Deleting ParallelCluster '$CLUSTER_NAME'..."
        pcluster delete-cluster \
            --cluster-name "$CLUSTER_NAME" \
            --region "$REGION"
        ;;
esac

# Clean up temporary file
rm -f "$CONFIG_FILE"

# Check status if creating or updating
if [[ "$ACTION" == "create" || "$ACTION" == "update" ]]; then
    echo "Waiting for cluster operation to complete..."
    
    # Wait for cluster to reach CREATE_COMPLETE or UPDATE_COMPLETE
    while true; do
        status=$(pcluster describe-cluster --cluster-name "$CLUSTER_NAME" --region "$REGION" --query "clusterStatus" --output text)
        
        if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
            echo "Cluster operation completed successfully."
            break
        elif [[ "$status" == "CREATE_FAILED" || "$status" == "UPDATE_FAILED" || "$status" == "DELETE_FAILED" ]]; then
            echo "Cluster operation failed with status: $status"
            echo "Check the cluster events for more details:"
            pcluster describe-cluster --cluster-name "$CLUSTER_NAME" --region "$REGION" --query "clusterStackStatus" --output text
            exit 1
        fi
        
        echo "Current status: $status. Waiting..."
        sleep 30
    done
    
    # Get head node IP address
    head_node_ip=$(pcluster describe-cluster --cluster-name "$CLUSTER_NAME" --region "$REGION" --query "headNode.publicIpAddress" --output text)
    
    echo "======================================================"
    echo "GCHP ParallelCluster '$CLUSTER_NAME' is ready!"
    echo "Head node IP: $head_node_ip"
    echo
    echo "Connect to the head node:"
    echo "  ssh -i ~/.ssh/$KEY_PAIR_NAME.pem ubuntu@$head_node_ip"
    echo
    echo "Submit a GCHP job:"
    echo "  ssh -i ~/.ssh/$KEY_PAIR_NAME.pem ubuntu@$head_node_ip 'submit-gchp -c S3_CONFIG_PATH -o S3_OUTPUT_PATH -d DAYS -n NODES'"
    echo "======================================================"
fi

echo "Deployment script completed."