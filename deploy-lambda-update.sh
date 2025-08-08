#!/bin/bash

# Deploy updated Lambda function
echo "Creating deployment package..."
cd amplify/backend/function/nhcProxy
zip -r nhc-cors-proxy-updated.zip src/

echo "Uploading to Lambda..."
aws lambda update-function-code \
  --function-name nhc-cors-proxy \
  --zip-file fileb://nhc-cors-proxy-updated.zip

echo "Updating function configuration..."
aws lambda update-function-configuration \
  --function-name nhc-cors-proxy \
  --timeout 30 \
  --memory-size 256

echo "Lambda function updated successfully!"
echo "Testing the function..."

# Test the function
aws lambda invoke \
  --function-name nhc-cors-proxy \
  --payload '{"httpMethod":"GET","pathParameters":{"proxy":"active-storms"},"queryStringParameters":null}' \
  --cli-binary-format raw-in-base64-out \
  response.json

echo "Test response:"
cat response.json
