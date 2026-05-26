variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix used for all resource names"
  type        = string
  default     = "table-knight"
}

variable "instance_type" {
  description = "EC2 instance type (must be Graviton/arm64 for t4g)"
  type        = string
  default     = "t4g.small"
}

variable "ssh_public_key" {
  description = "SSH public key content for EC2 access (paste the contents of your .pub file)"
  type        = string
}

variable "db_password" {
  description = "Postgres password — stored in .env on the instance, never exposed publicly"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret for the API"
  type        = string
  sensitive   = true
}

variable "api_port" {
  description = "Port the Go API listens on (internal — not exposed publicly, Caddy proxies to it)"
  type        = number
  default     = 8080
}

variable "api_domain" {
  description = "Domain Caddy serves and gets a cert for (e.g. api.yourdomain.com)"
  type        = string
}

variable "frontend_url" {
  description = "Frontend origin — used for CORS and OAuth redirects (e.g. https://yourdomain.com)"
  type        = string
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  sensitive   = true
}
