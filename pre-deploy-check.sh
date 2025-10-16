#!/bin/bash
echo "=== Pre-Deployment Environment Check ==="
echo ""

echo "1. AWS CLI:"
which aws && aws --version || echo "❌ AWS CLI not found"
echo ""

echo "2. AWS Profile 'aws' credentials:"
aws sts get-caller-identity --profile aws --region us-west-2 2>/dev/null && echo "✅ AWS credentials OK" || echo "❌ AWS credentials not configured"
echo ""

echo "3. CDK CLI:"
which cdk && cdk --version || echo "❌ CDK not found"
echo ""

echo "4. Docker:"
which docker && docker --version || echo "❌ Docker not found"
docker info > /dev/null 2>&1 && echo "✅ Docker daemon running" || echo "❌ Docker daemon not running"
echo ""

echo "5. jq:"
which jq && jq --version || echo "❌ jq not found (install with: brew install jq)"
echo ""

echo "6. Node.js:"
which node && node --version || echo "❌ Node.js not found"
echo ""

echo "7. Current directory:"
pwd
echo ""

echo "=== Ready to deploy? ==="
echo "If all checks pass, run: ./deploy.sh"
