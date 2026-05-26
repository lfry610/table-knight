# Dedicated IAM user for GitHub Actions — scoped to only what CI/CD needs
resource "aws_iam_user" "cicd" {
  name = "${var.project_name}-cicd"
}

data "aws_iam_policy_document" "cicd" {
  statement {
    sid    = "S3Deploy"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListBucket",
    ]
    resources = [
      aws_s3_bucket.frontend.arn,
      "${aws_s3_bucket.frontend.arn}/*",
    ]
  }

  statement {
    sid       = "CloudFrontInvalidate"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.frontend.arn]
  }
}

resource "aws_iam_user_policy" "cicd" {
  name   = "${var.project_name}-cicd"
  user   = aws_iam_user.cicd.name
  policy = data.aws_iam_policy_document.cicd.json
}

resource "aws_iam_access_key" "cicd" {
  user = aws_iam_user.cicd.name
}
