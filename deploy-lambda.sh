#!/bin/bash

# AWS Lambda Deployment Script for NHC CORS Proxy
# This script creates the Lambda function and API Gateway manually

FUNCTION_NAME="nhc-cors-proxy"
REGION="us-east-1"
ROLE_NAME="nhc-proxy-lambda-role"

echo "🚀 Starting AWS Lambda deployment for NHC CORS Proxy..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ AWS credentials not configured or invalid"
    echo "Please run 'aws configure' with valid credentials"
    exit 1
fi

echo "✅ AWS credentials verified"

# Create IAM role for Lambda
echo "📝 Creating IAM role for Lambda function..."

# Create trust policy
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
    --role-name $ROLE_NAME \
    --assume-role-policy-document file://trust-policy.json \
    --description "Role for NHC CORS Proxy Lambda function" 2>/dev/null || echo "Role may already exist"

# Attach basic Lambda execution policy
aws iam attach-role-policy \
    --role-name $ROLE_NAME \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

echo "✅ IAM role created/updated"

# Get role ARN
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
echo "📋 Role ARN: $ROLE_ARN"

# Create deployment package
echo "📦 Creating deployment package..."
mkdir -p lambda-deploy
cp amplify/backend/function/nhcProxy/src/* lambda-deploy/
cd lambda-deploy
npm install --production
zip -r ../nhc-proxy-lambda.zip . -x "*.git*" "node_modules/.cache/*"
cd ..

echo "✅ Deployment package created"

# Create or update Lambda function
echo "🔧 Deploying Lambda function..."

# Wait for role to be ready
echo "⏳ Waiting for IAM role to be ready..."
sleep 10

# Check if function exists
if aws lambda get-function --function-name $FUNCTION_NAME >/dev/null 2>&1; then
    echo "🔄 Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://nhc-proxy-lambda.zip
else
    echo "🆕 Creating new Lambda function..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://nhc-proxy-lambda.zip \
        --description "CORS proxy for National Hurricane Center API" \
        --timeout 30 \
        --memory-size 128
fi

echo "✅ Lambda function deployed"

# Get function ARN
FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --query 'Configuration.FunctionArn' --output text)
echo "📋 Function ARN: $FUNCTION_ARN"

# Create API Gateway
echo "🌐 Creating API Gateway..."

# Create REST API
API_ID=$(aws apigateway create-rest-api \
    --name "nhc-cors-proxy-api" \
    --description "API Gateway for NHC CORS Proxy Lambda" \
    --query 'id' --output text)

echo "✅ API Gateway created: $API_ID"

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --query 'items[0].id' --output text)

# Create proxy resource
PROXY_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "{proxy+}" \
    --query 'id' --output text)

# Create ANY method
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --authorization-type NONE

# Integrate with Lambda
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$FUNCTION_ARN/invocations"

# Add Lambda permission for API Gateway
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id api-gateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:*:$API_ID/*/*/*" 2>/dev/null || echo "Permission may already exist"

# Deploy API
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name dev

echo "✅ API Gateway deployed"

# Get API endpoint
API_ENDPOINT="https://$API_ID.execute-api.$REGION.amazonaws.com/dev"
echo "🎯 API Endpoint: $API_ENDPOINT"

# Clean up
rm -f trust-policy.json
rm -f nhc-proxy-lambda.zip
rm -rf lambda-deploy

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📋 Summary:"
echo "   Function Name: $FUNCTION_NAME"
echo "   API Gateway ID: $API_ID"
echo "   API Endpoint: $API_ENDPOINT"
echo ""
echo "🔧 Next steps:"
echo "   1. Test the API: curl $API_ENDPOINT/active-storms"
echo "   2. Update your frontend with: export REACT_APP_LAMBDA_API_URL='$API_ENDPOINT'"
echo ""
