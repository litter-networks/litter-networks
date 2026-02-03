terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Note: CloudFront is a global service but some resources (like ACM certificates)
# require you to use us-east-1. Adjust your provider configuration as needed.
provider "aws" {
  region = "us-east-1"
}

#########################################
# Litter Networks CloudFront WAF
#########################################
resource "aws_wafv2_web_acl" "litter_networks_cloudfront" {
  name        = "LitterNetworksCloudFrontWAF"
  description = "Managed by Terraform for all Litter Networks CloudFront distributions"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "LitterNetworksCloudFrontWAF"
    sampled_requests_enabled   = true
  }

  rule {
    name     = "LN-RateLimit-Per-IP"
    priority = 0

    statement {
      rate_based_statement {
        aggregate_key_type = "IP"
        limit              = 1000
      }
    }

    action {
      count {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "LN-RateLimit-Per-IP"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "LN-Amazon-IP-Reputation"
    priority = 1

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "LN-Amazon-IP-Reputation"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "LN-Common-Rule-Set"
    priority = 2

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "LN-Common-Rule-Set"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "LN-Known-Bad-Inputs"
    priority = 3

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    override_action {
      none {}
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "LN-Known-Bad-Inputs"
      sampled_requests_enabled   = true
    }
  }
}

#########################################
# CloudFront Origin Access Control (OAC)
#########################################
resource "aws_cloudfront_origin_access_control" "lambda_origin_access_control" {
  name                              = "CloudFrontLambdaAccessControl"
  description                       = "IAM-protected access from CloudFront to Lambda Function URL"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "s3_origin_access_control" {
  name                              = "CloudFrontS3AccessControl"
  description                       = "Origin Access Control for S3 buckets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

#########################################################
# CloudFront LNWeb-API General (Public) Cache Policy
#########################################################

resource "aws_cloudfront_cache_policy" "public_api_cache_policy" {
  name = "LNWebAPI-PublicCachePolicy"

  min_ttl     = 0
  default_ttl = 600   # 10 minutes default (if API doesn't override)
  max_ttl     = 86400 # Max 24 hours

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "Cache-Control"]
      }
    }

    cookies_config {
      cookie_behavior = "none" # ✅ Do NOT cache based on cookies
    }

    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

#########################################################
# CloudFront LNWeb-API Per-User Cache Policy
#########################################################

resource "aws_cloudfront_cache_policy" "user_api_cache_policy" {
  name = "LNWebAPI-UserCachePolicy"

  min_ttl     = 0
  default_ttl = 60   # Default 1 minute per user (if API doesn't override)
  max_ttl     = 3600 # Max 1 hour per user

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "Cache-Control"]
      }
    }

    cookies_config {
      cookie_behavior = "all" # ✅ Cache responses separately per user
    }

    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

resource "aws_cloudfront_cache_policy" "no_cache" {
  name = "LitterNetworksNoCachePolicy"

  default_ttl = 1
  max_ttl     = 1
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    headers_config {
      header_behavior = "none"
    }

    cookies_config {
      cookie_behavior = "none"
    }

    query_strings_config {
      query_string_behavior = "all"
    }
  }
}

resource "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "LitterNetworksAllViewerOriginRequestPolicy-v2"

  headers_config {
    header_behavior = "allViewer"
  }

  cookies_config {
    cookie_behavior = "none"
  }

  query_strings_config {
    query_string_behavior = "all"
  }
}


#########################################
# CloudFront Distribution – Dynamic API
#########################################
resource "aws_cloudfront_function" "spa_rewrite" {
  name    = "lnweb-spa-rewrite"
  runtime = "cloudfront-js-1.0"
  comment = "Rewrite SPA navigations to index.html"
  publish = true
  code    = file("${path.module}/spa-rewrite.js")
}

resource "aws_cloudfront_distribution" "dynamic" {
  comment = "Dynamic CloudFront distribution for Litter Networks"
  aliases = [
    "api.litternetworks.org",
    "aws.litternetworks.org",
    "static.litternetworks.org",
    "www.litternetworks.org",
    "litternetworks.org",
  ]
  enabled             = true
  http_version        = "http2"
  price_class         = "PriceClass_100"
  wait_for_deployment = true
  web_acl_id          = aws_wafv2_web_acl.litter_networks_cloudfront.arn
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.no_cache.id
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    default_ttl                = 0
    max_ttl                    = 0
    min_ttl                    = 0
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
    smooth_streaming           = false
    target_origin_id           = "lnweb-public.s3.eu-west-2.amazonaws.com"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.dynamic_headers.id
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }

    grpc_config {
      enabled = false
    }
  }

  # origin for LNWeb-API Lambda
  origin {
    domain_name              = "fgyayclezk4ljagx4iempqdvdm0szpkb.lambda-url.eu-west-2.on.aws"
    origin_id                = "LNWeb-API-Lambda"
    origin_access_control_id = aws_cloudfront_origin_access_control.lambda_origin_access_control.id

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_keepalive_timeout = 5
      origin_protocol_policy   = "https-only"
      origin_read_timeout      = 30
      origin_ssl_protocols     = ["TLSv1.2"]
    }
  }

  origin {
    connection_attempts      = 3
    connection_timeout       = 10
    domain_name              = "lnweb-public.s3.eu-west-2.amazonaws.com"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_origin_access_control.id
    origin_id                = "lnweb-public.s3.eu-west-2.amazonaws.com"
  }

  ordered_cache_behavior {
    path_pattern               = "/api/*"
    allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods             = ["GET", "HEAD", "OPTIONS"]
    compress                   = true
    default_ttl                = 0
    max_ttl                    = 0
    min_ttl                    = 0
    cache_policy_id            = aws_cloudfront_cache_policy.public_api_cache_policy.id
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
    smooth_streaming           = false
    target_origin_id           = "LNWeb-API-Lambda"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.dynamic_headers.id

    grpc_config {
      enabled = false
    }
  }

  restrictions {
    geo_restriction {
      locations        = []
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = "arn:aws:acm:us-east-1:851725192804:certificate/e41d37e5-5756-4659-a315-2ee68bcfb67a"
    cloudfront_default_certificate = false
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }

}

#########################################
# CloudFront Distribution – Static CDN
#########################################
resource "aws_cloudfront_distribution" "static" {
  comment             = "Static CloudFront distribution for Litter Networks"
  aliases             = ["cdn.litternetworks.org"]
  default_root_object = "all"
  enabled             = true
  http_version        = "http2and3"
  price_class         = "PriceClass_100"
  wait_for_deployment = true
  web_acl_id          = aws_wafv2_web_acl.litter_networks_cloudfront.arn

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.no_cache.id
    cached_methods             = ["GET", "HEAD"]
    compress                   = false
    default_ttl                = 0
    max_ttl                    = 0
    min_ttl                    = 0
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
    smooth_streaming           = false
    target_origin_id           = "lnweb-public.s3.eu-west-2.amazonaws.com"
    viewer_protocol_policy     = "https-only"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.static_headers.id

    grpc_config {
      enabled = false
    }
  }

  ordered_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.no_cache.id
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    default_ttl                = 0
    max_ttl                    = 0
    min_ttl                    = 0
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
    path_pattern               = "/images/*"
    smooth_streaming           = false
    target_origin_id           = "lnweb-public.s3.eu-west-2.amazonaws.com"
    viewer_protocol_policy     = "https-only"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.static_headers.id

    grpc_config {
      enabled = false
    }
  }

  ordered_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.no_cache.id
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    default_ttl                = 0
    max_ttl                    = 0
    min_ttl                    = 0
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
    path_pattern               = "/maps/*"
    smooth_streaming           = false
    target_origin_id           = "lnweb-public.s3.eu-west-2.amazonaws.com"
    viewer_protocol_policy     = "https-only"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.static_headers.id

    grpc_config {
      enabled = false
    }
  }

  ordered_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.no_cache.id
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    default_ttl                = 0
    max_ttl                    = 0
    min_ttl                    = 0
    origin_request_policy_id   = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
    path_pattern               = "/docs/*"
    smooth_streaming           = false
    target_origin_id           = "lnweb-docs.s3.eu-west-2.amazonaws.com"
    viewer_protocol_policy     = "https-only"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.static_headers.id

    grpc_config {
      enabled = false
    }
  }

  origin {
    connection_attempts      = 3
    connection_timeout       = 10
    domain_name              = "lnweb-docs.s3.eu-west-2.amazonaws.com"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_origin_access_control.id
    origin_id                = "lnweb-docs.s3.eu-west-2.amazonaws.com"
  }

  origin {
    connection_attempts      = 3
    connection_timeout       = 10
    domain_name              = "lnweb-public.s3.eu-west-2.amazonaws.com"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_origin_access_control.id
    origin_id                = "lnweb-public.s3.eu-west-2.amazonaws.com"
  }

  restrictions {
    geo_restriction {
      locations        = []
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = "arn:aws:acm:us-east-1:851725192804:certificate/e41d37e5-5756-4659-a315-2ee68bcfb67a"
    cloudfront_default_certificate = false
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }

}

#########################################
# CloudFront Response Headers Policies
#########################################
resource "aws_cloudfront_response_headers_policy" "dynamic_headers" {
  name = "LitterNetworksDynamicHeaders"

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; img-src 'self' https://cdn.litternetworks.org https://lnweb-docs.s3.eu-west-2.amazonaws.com https://*.tile.openstreetmap.org https://*.arcgisonline.com blob: data:; script-src 'self' https://cdn.litternetworks.org https://code.jquery.com https://www.google.com https://www.gstatic.com; style-src 'self' https://cdn.litternetworks.org 'sha256-UP0QZg7irvSMvOBz9mH2PIIE28+57UiavRfeVea0l3g='; connect-src 'self' https://cdn.litternetworks.org https://api.openrouteservice.org; frame-src 'self' https://www.youtube.com https://www.google.com; frame-ancestors 'self' https://litternetworks.org https://www.google.com"
      override                = true
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "static_headers" {
  name = "LitterNetworksStaticHeaders"

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["*"]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }

    access_control_allow_origins {
      items = ["*"]
    }

    origin_override = true
  }

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self'; img-src 'self' https://cdn.litternetworks.org https://lnweb-docs.s3.eu-west-2.amazonaws.com; script-src 'self' https://cdn.litternetworks.org; style-src 'self' https://cdn.litternetworks.org; connect-src 'self' https://cdn.litternetworks.org; frame-src 'self'; frame-ancestors 'self' https://*.litternetworks.org"
      override                = true
    }
  }
}
