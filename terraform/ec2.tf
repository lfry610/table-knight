# Latest Ubuntu 22.04 ARM64 (matches t4g Graviton2)
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-arm64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_key_pair" "deploy" {
  key_name   = "${var.project_name}-deploy"
  public_key = var.ssh_public_key
}

resource "aws_security_group" "api" {
  name        = "${var.project_name}-api"
  description = "Table Knight API"

  # SSH — for CI/CD and manual access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP — required for ACME (Let's Encrypt) HTTP-01 challenge
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS — public API traffic via Caddy
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-api"
  }
}

resource "aws_instance" "api" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.deploy.key_name
  vpc_security_group_ids = [aws_security_group.api.id]

  user_data = templatefile("${path.module}/user_data.sh", {
    db_password          = var.db_password
    jwt_secret           = var.jwt_secret
    api_port             = var.api_port
    api_domain           = var.api_domain
    frontend_url         = var.frontend_url
    google_client_id     = var.google_client_id
    google_client_secret = var.google_client_secret
  })

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.project_name}-api"
  }
}

resource "aws_eip" "api" {
  instance = aws_instance.api.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-api"
  }
}
