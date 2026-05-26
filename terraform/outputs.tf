output "ec2_ip" {
  description = "EC2 Elastic IP — use as EC2_HOST secret and in VITE_API_URL"
  value       = aws_eip.api.public_ip
}

output "cloudfront_domain" {
  description = "Frontend URL (CloudFront domain)"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "s3_bucket" {
  description = "S3 bucket name — use as S3_BUCKET secret in GitHub Actions"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — use as CLOUDFRONT_DISTRIBUTION_ID secret"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cicd_access_key_id" {
  description = "AWS_ACCESS_KEY_ID for GitHub Actions"
  value       = aws_iam_access_key.cicd.id
}

output "cicd_secret_access_key" {
  description = "AWS_SECRET_ACCESS_KEY for GitHub Actions — run: terraform output cicd_secret_access_key"
  value       = aws_iam_access_key.cicd.secret
  sensitive   = true
}
