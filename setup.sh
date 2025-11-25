#!/usr/bin/env bash
set -euo pipefail

readonly REQUIRED_COMMANDS=(aws terraform node npm zip)

for cmd in "${REQUIRED_COMMANDS[@]}"; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "❌ $cmd is required"
    exit 1
  fi
done

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "❌ AWS credentials are missing or invalid"
  exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-$(aws configure get region || echo "us-east-1")}
echo "✅ AWS credentials valid (Account: $AWS_ACCOUNT_ID, Region: $AWS_REGION)"

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "❌ GEMINI_API_KEY must be set"
  exit 1
fi

API_KEY=${API_KEY:-image-gen-dev}
IMAGES_BUCKET_NAME=${IMAGES_BUCKET_NAME:-}
ENVIRONMENT=${ENVIRONMENT:-dev}
STAGE_NAME=${STAGE_NAME:-prod}

if [ -z "$IMAGES_BUCKET_NAME" ]; then
  TIMESTAMP=$(date +%s)
  IMAGES_BUCKET_NAME=$(printf "image-gen-%s-%s-%s" "$ENVIRONMENT" "$AWS_ACCOUNT_ID" "$TIMESTAMP")
  IMAGES_BUCKET_NAME=$(echo "$IMAGES_BUCKET_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g' | sed -E 's/^-+|-+$//g' | cut -c1-63)
fi

if [ -z "$IMAGES_BUCKET_NAME" ]; then
  echo "❌ Unable to derive a valid S3 bucket name"
  exit 1
fi

echo "ℹ️ Environment: $ENVIRONMENT"
echo "ℹ️ Images bucket: $IMAGES_BUCKET_NAME"

npm ci
npm run build
npm run package:lambda

if [ ! -f lambda.zip ]; then
  echo "❌ lambda.zip was not created"
  exit 1
fi

pushd terraform >/dev/null
terraform init -input=false
terraform apply -auto-approve \
  -var "aws_region=$AWS_REGION" \
  -var "environment=$ENVIRONMENT" \
  -var "stage_name=$STAGE_NAME" \
  -var "images_bucket_name=$IMAGES_BUCKET_NAME" \
  -var "api_key=$API_KEY" \
  -var "gemini_api_key=$GEMINI_API_KEY"

API_URL=$(terraform output -raw api_endpoint)
popd >/dev/null

cat <<SUMMARY
✅ Deployment complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API URL:   $API_URL
API Key:   $API_KEY
Bucket:    $IMAGES_BUCKET_NAME
Stage:     $STAGE_NAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test:
  curl -X POST "$API_URL" \
    -H 'Content-Type: application/json' \
    -H 'x-api-key: $API_KEY' \
    -d '{"prompt":"A serene shoreline at sunrise"}'
SUMMARY
