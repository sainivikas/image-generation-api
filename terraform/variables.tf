variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "stage_name" {
  type    = string
  default = "prod"
}

variable "api_key" {
  type = string
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
}

variable "images_bucket_name" {
  type = string
}
