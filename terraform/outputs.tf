output "api_endpoint" {
  value = "${aws_apigatewayv2_stage.default.invoke_url}/v1/images/generate"
}

output "images_bucket" {
  value = aws_s3_bucket.images.bucket
}
