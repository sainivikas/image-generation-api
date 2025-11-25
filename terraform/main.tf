terraform {
  required_version = ">= 1.4"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "images" {
  bucket        = var.images_bucket_name
  acl           = "private"
  force_destroy = true
  tags = {
    Environment = var.environment
    ManagedBy   = "image-gen-assignment"
  }
}

resource "aws_s3_bucket_public_access_block" "images" {
  bucket                  = aws_s3_bucket.images.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_read" {
  bucket = aws_s3_bucket.images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowPublicGet"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = ["${aws_s3_bucket.images.arn}/*"]
      }
    ]
  })
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda_execution" {
  name               = "image-gen-api-${var.environment}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  description        = "Execution role for the image generation Lambda"
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_s3" {
  statement {
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:PutObjectAcl"
    ]
    resources = ["${aws_s3_bucket.images.arn}/*"]
  }
}

resource "aws_iam_role_policy" "lambda_s3" {
  name   = "image-gen-s3-access"
  role   = aws_iam_role.lambda_execution.id
  policy = data.aws_iam_policy_document.lambda_s3.json
}

resource "aws_lambda_function" "image_generator" {
  function_name = "image-gen-api-${var.environment}"
  handler       = "dist/lambda/handler.handler"
  runtime       = "nodejs20.x"
  role          = aws_iam_role.lambda_execution.arn
  memory_size   = 2048
  timeout       = 60
  filename      = "../lambda.zip"
  source_code_hash = filebase64sha256("../lambda.zip")
  architectures = ["x86_64"]

  environment {
    variables = {
      GEMINI_API_KEY = var.gemini_api_key
      IMAGES_BUCKET  = aws_s3_bucket.images.bucket
      API_KEY        = var.api_key
      #AWS_REGION     = var.aws_region
      ENVIRONMENT    = var.environment
      STAGE_NAME     = var.stage_name
    }
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = "image-gen-api-${var.environment}"
  protocol_type = "HTTP"
  cors_configuration {
    allow_methods = ["POST", "OPTIONS"]
    allow_headers = ["Content-Type", "x-api-key"]
    allow_origins = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.image_generator.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "generate" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /v1/images/generate"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = var.stage_name
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  function_name = aws_lambda_function.image_generator.function_name
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
