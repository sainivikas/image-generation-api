# Image Generation API

A synchronous image generation endpoint powered by Google Gemini, AWS Lambda, API Gateway, and S3. The lambda is authored in Node.js + TypeScript, validates an API key, stores each generated image in S3, and returns a permanent URL to the caller.

## Architecture

- **API**: AWS Lambda + API Gateway (HTTP API) for horizontal scaling and simplicity.
- **Compute**: Node.js + TypeScript handler bundles the Gemini call, validation, and S3 persistence.
- **Image storage**: S3 bucket with a public `GetObject` policy so URLs stay valid forever.
- **IaC**: Terraform manages the Lambda, IAM roles, S3 bucket, and HTTP API.

## Functional requirements covered

1. Secure endpoint (`x-api-key` header) that generates images from text prompts.
2. Optional reference images (URL or data URI) are fetched, encoded, and sent to Gemini.
3. Generated images are uploaded to S3 and returned as permanent HTTPS URLs.
4. Lambda + API Gateway auto-scale and the setup script packages and deploys the handler.
5. Sync-only API surface (no job queue).
6. Gemini key is supplied via environment variables.
7. No database is used.

## Tech stack

| Concern | Technology |
| --- | --- |
| Runtime | Node.js 20+ / TypeScript |
| HTTP layer | AWS API Gateway HTTP API |
| Image generation | Google Gemini via REST |
| Storage | AWS S3 |
| Deployment | Terraform + `./setup.sh` script |

## Getting started

### Prerequisites

- Node.js & npm (≥18).
- AWS CLI with valid credentials (`aws sts get-caller-identity`).
- Terraform 1.4+.
- `zip` command (packaging).

### Environment variables (local/testing)

| Variable | Description |
| --- | --- |
| `GEMINI_API_KEY` | Google Gemini API key (required). |
| `GEMINI_MODEL` | Optional model override (default `gemini-2.5-flash-image`). |
| `API_KEY` | Shared secret for `x-api-key` (defaults to `image-gen-dev`). |
| `IMAGES_BUCKET` | Optional bucket name for local testing (Terraform will create one when deploying). |
| `AWS_REGION` | AWS region for deployment; defaults to `us-east-1`. |
| `ENVIRONMENT` | Environment tag for resources (default `dev`). |
| `STAGE_NAME` | API Gateway stage name (default `prod`). |

These env vars are read by both the Lambda and the local helper server.

## Development

### Build

```bash
npm run build
```

Compiled code lands in `dist/` and is packaged into `lambda.zip`.

### Run locally

```bash
npm run start:local
```

The Express-powered helper reuses the same Lambda handler so you can exercise `/v1/images/generate` and `/health` without deploying.

### Local testing script

```bash
npm run local-test
```

`npm run local-test` (implemented in `scripts/local-test.sh`) builds the project, spins up the local server, and sends a sample request to verify the handler + Gemini integration.

Ensure `GEMINI_API_KEY`, `API_KEY`, and `IMAGES_BUCKET` are set before invoking the script.

### Gemini client smoke test (Python)

```bash
python gemini_test.py
```

This helper uses the official `google.ai.generativelanguage_v1beta` client plus `requests` to:

1. List a few available Gemini models.
2. Generate a text-only image.
3. Generate another image that blends a reference photo.

Install the dependencies first with `python3 -m pip install google-generativeai requests` and make sure `GEMINI_API_KEY` (and, if necessary, `GEMINI_MODEL`) are exported.

## Deployment

```bash
./setup.sh
```

`setup.sh` performs the following:

1. Validates prerequisites (`aws`, `terraform`, `node`, `npm`, `zip`).
2. Ensures `GEMINI_API_KEY` is provided.
3. Builds and packages the Lambda (`lambda.zip`).
4. Generates a unique bucket name if one is not provided.
5. Runs `terraform init`/`apply` with the provided API key, Gemini key, and bucket name.
6. Prints the API URL and a ready-to-use `curl` command.

The script also accepts overrides via environment variables:

- `IMAGES_BUCKET_NAME` for a predictable bucket name.
- `ENVIRONMENT` / `STAGE_NAME` / `AWS_REGION` for customization.

## Terraform layout

- `terraform/main.tf`: Defines the S3 bucket (with public read policy), IAM roles, Lambda, and HTTP API routes.
- `terraform/variables.tf`: Declares inputs for region, environment, bucket, API key, and Gemini key.
- `terraform/outputs.tf`: Exposes the API endpoint and bucket name.

Terraform references the freshly created `lambda.zip` at the repo root when deploying.

## API Reference

### POST `/v1/images/generate`

**Headers**

- `Content-Type: application/json`
- `x-api-key`: Shared secret (`API_KEY`).

**Body**

```json
{
  "prompt": "A timber cabin lit with warm lights at dusk",
  "style": "photorealistic",
  "width": 1024,
  "height": 1024,
  "referenceImages": [
    {"url": "https://example.com/reference.jpg", "description": "Golden hour lighting"}
  ]
}
```

**Success response (200)**

```json
{
  "jobId": "uuid",
  "status": "completed",
  "imageUrl": "https://<bucket>.s3.<region>.amazonaws.com/images/<uuid>.png",
  "createdAt": "2025-11-24T...",
  "completedAt": "2025-11-24T...",
  "processingTime": 3.42
}
```

### GET `/health`

Returns a 200 with `{ "status": "healthy", "timestamp": "..." }`.

## Testing the deployed API

```bash
curl -X POST "$(terraform output -raw api_endpoint)" \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: <API_KEY>' \
  -d '{"prompt": "A serene shoreline at sunrise"}'
```

`setup.sh` prints the exact `curl` command once deployment succeeds.

## Next steps

- Record the generated API URL and share the GitHub repo.
- Use `scripts/local-test.sh` for smoke-testing before deploying.
- Optionally add monitoring (CloudWatch dashboards) or CloudFront for CDN caching.
