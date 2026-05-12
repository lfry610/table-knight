.PHONY: dev build test lint migrate sqlc docker-up docker-down deploy

# ── Local dev ──────────────────────────────────────────────────────────────────
dev:
	@go run ./cmd/server

# Hot reload (requires: go install github.com/air-verse/air@latest)
watch:
	@air -c .air.toml

build:
	@CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o bin/server ./cmd/server

test:
	@go test ./... -v -race -count=1

lint:
	@golangci-lint run ./...

# ── Database ───────────────────────────────────────────────────────────────────
migrate:
	@psql "$(DATABASE_URL)" -f db/migrations/001_initial_schema.sql
	@echo "Migration complete"

migrate-down:
	@psql "$(DATABASE_URL)" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	@echo "Schema dropped"

# ── sqlc ──────────────────────────────────────────────────────────────────────
# Requires: go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
sqlc:
	@sqlc generate
	@echo "sqlc generated"

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up:
	@docker compose up -d
	@echo "Services running — API: http://localhost:8080"

docker-down:
	@docker compose down

docker-logs:
	@docker compose logs -f api

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy:
	@chmod +x deploy.sh && ./deploy.sh $(ENV)
