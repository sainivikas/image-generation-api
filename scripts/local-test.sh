#!/usr/bin/env bash
set -euo pipefail

# Ensure required environment variables are set
if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "OPENAI_API_KEY is required"
  exit 1
fi

if [ -z "${API_KEY:-}" ]; then
  echo "API_KEY is required"
  exit 1
fi

if [ -z "${IMAGES_BUCKET:-}" ]; then
  echo "IMAGES_BUCKET is required"
  exit 1
fi

PORT=${LOCAL_TEST_PORT:-4000}

npm run build >/dev/null

node dist/local-server.js &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1' EXIT

echo "Starting local server on http://localhost:${PORT}"
sleep 2

echo "Sending sample request to /v1/images/generate"
response=$(curl -s -X POST "http://localhost:${PORT}/v1/images/generate" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{"prompt":"A futuristic city skyline at sunset","style":"photorealistic"}')

echo "Response:"
echo "$response"
