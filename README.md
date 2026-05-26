# Table Knight

A full-stack board game companion app. Track your collection, log play sessions, build curated game lists, and follow friends' gaming activity — all in one place.

Live at **[tableknight.app](https://tableknight.app)**

---

## Features

- **Collection management** — add games from BoardGameGeek with one-click status tracking (owned, want-to-play, for-trade, wishlist)
- **Session logging** — record plays with players, results, scores, duration, and notes
- **Round Table** — pin your five most-played games as your personal hall of fame
- **Lists** — curate ranked game lists with box art poster grids and drag-to-reorder
- **Social feed** — follow friends and see their sessions, new additions, and lists in real time
- **Crews** — group play organisations with shared session history and collective collection view
- **Reviews** — rate and review games with per-game aggregate stats
- **Google OAuth** — sign in with Google or register with email/password
- **BGG integration** — game data (art, ratings, weight, player count) fetched and cached from BoardGameGeek's XML API

---

## Stack

### Backend — `api/`

| Layer | Technology |
|---|---|
| Language | Go 1.25 |
| HTTP router | [chi](https://github.com/go-chi/chi) v5 |
| Database driver | [pgx/v5](https://github.com/jackc/pgx) with connection pooling |
| Query layer | [sqlc](https://sqlc.dev) — compile-time type-safe SQL |
| Auth | JWT (golang-jwt/jwt v5) + bcrypt password hashing |
| OAuth | Google OAuth 2.0 (server-side flow via golang.org/x/oauth2) |
| Migrations | Custom embedded migration runner (Go embed + sequential SQL files) |
| Rate limiting | go-chi/httprate (per-IP on auth endpoints) |
| Reverse proxy | [Caddy](https://caddyserver.com) (automatic HTTPS via Let's Encrypt) |

### Frontend — `web/`

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v3 + CSS custom properties design tokens |
| Components | Radix UI primitives (accessible, unstyled) |
| Server state | TanStack Query v5 (caching, background refetch, optimistic updates) |
| Client state | Zustand (auth, persisted to localStorage) |
| Routing | React Router v6 |
| Forms | React Hook Form |
| HTTP | Axios with JWT interceptor and 401 auto-redirect |

### Database

PostgreSQL 16 running in Docker on the EC2 instance. Schema managed through 12 sequential migration files applied automatically on startup via an embedded migration runner.

Key design decisions:
- Games are fetched from BGG on-demand and cached locally — no BGG dependency at read time
- `list_games` uses a composite primary key `(list_id, game_id)` with a separate `UNIQUE (list_id, position)` constraint; reordering is done via delete-and-reinsert in a transaction to avoid constraint conflicts
- Activity feed is a denormalised `activity` table written to on every significant event, enabling `O(1)` feed reads

---

## Architecture

```
┌─────────────────────────────────────────┐
│  CloudFront CDN (HTTPS)                 │
│  React SPA → S3 static hosting          │
└─────────────────┬───────────────────────┘
                  │ VITE_API_URL
                  ▼
┌─────────────────────────────────────────┐
│  EC2 t4g.small (Ubuntu ARM64)           │
│                                         │
│  ┌─────────┐    ┌───────────────────┐   │
│  │  Caddy  │───▶│  Go API (:8080)   │   │
│  │ (HTTPS) │    │  chi router       │   │
│  └─────────┘    └────────┬──────────┘   │
│                          │              │
│              ┌───────────▼──────────┐   │
│              │  PostgreSQL 16       │   │
│              │  (Docker container)  │   │
│              └──────────────────────┘   │
└─────────────────────────────────────────┘
```

- Caddy handles TLS termination and proxies to the Go process on port 8080
- Postgres runs in a Docker container with a named volume for persistence, bound to `127.0.0.1` only
- The frontend is a fully static SPA — no SSR — served from S3 via CloudFront with a `403/404 → index.html` rewrite rule for client-side routing

---

## Infrastructure — Terraform

All AWS infrastructure is defined as code in `terraform/`. A single `terraform apply` provisions the complete production environment:

| Resource | Purpose |
|---|---|
| `aws_instance` (t4g.small) | Go API + Caddy + Postgres |
| `aws_eip` | Static IP for EC2 — DNS A record target |
| `aws_security_group` | Ports 22, 80, 443 only |
| `aws_s3_bucket` | Frontend static assets |
| `aws_cloudfront_distribution` | CDN with HTTPS, SPA routing, `PriceClass_100` |
| `aws_cloudfront_origin_access_control` | S3 bucket locked to CloudFront only (no public access) |
| `aws_iam_user` + `aws_iam_access_key` | Least-privilege CI/CD user (S3 sync + CloudFront invalidation only) |

EC2 bootstrap is handled by a `user_data.sh` templatefile that installs Caddy, Docker, pulls the Postgres image, writes the systemd unit, and populates `/opt/table-knight/.env` — the instance is fully operational from a cold start with no manual steps.

### Provision from scratch

```bash
cd terraform
terraform init
terraform apply          # ~3 minutes
terraform output         # get values for GitHub secrets
terraform output cicd_secret_access_key   # sensitive
```

---

## CI/CD — GitHub Actions

Two independent workflows trigger on push to `main` with path filters — only the changed service redeploys.

### API — `.github/workflows/api.yml`

```
push to main (api/**)
    │
    ├── go test ./...
    ├── go build (GOOS=linux GOARCH=arm64)
    ├── upload binary as artifact
    │
    └── scp binary → EC2
        ssh: swap binary + systemctl restart table-knight-api
```

Zero-downtime swap: the binary is copied to `/tmp`, then moved atomically over the running binary and the systemd service is restarted. Total deploy time: ~45 seconds.

### Web — `.github/workflows/web.yml`

```
push to main (web/**)
    │
    ├── npm ci
    ├── npm run build (VITE_API_URL injected from secrets)
    ├── aws s3 sync dist/ → S3 --delete
    └── cloudfront create-invalidation /*
```

### Required GitHub Secrets

| Secret | Source |
|---|---|
| `EC2_HOST` | `terraform output ec2_ip` |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Private key matching `ssh_public_key` in tfvars |
| `AWS_ACCESS_KEY_ID` | `terraform output cicd_access_key_id` |
| `AWS_SECRET_ACCESS_KEY` | `terraform output cicd_secret_access_key` |
| `S3_BUCKET` | `terraform output s3_bucket` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `terraform output cloudfront_distribution_id` |
| `VITE_API_URL` | `https://api.yourdomain.com` |

---

## Local Development

### Prerequisites

- Go 1.21+
- Node 20+
- Docker

### Backend

```bash
# Start Postgres
docker compose up -d

# Copy and configure env
cp api/.env.example api/.env   # set DATABASE_URL, JWT_SECRET

# Run (with hot reload via air)
cd api && air
# or without air:
cd api && go run ./cmd/server
```

The API starts on `http://localhost:8080`. Migrations run automatically on startup.

### Frontend

```bash
cd web
npm install
npm run dev
```

The Vite dev server starts on `http://localhost:5173` and proxies `/api/*` to `localhost:8080` — no CORS config needed locally.

### sqlc (regenerate query types)

```bash
cd api && sqlc generate
```

---

## Project Structure

```
table-knight/
├── api/
│   ├── cmd/
│   │   └── server/          # main.go — router setup, dependency wiring
│   ├── db/
│   │   ├── migrations/      # sequential SQL migration files (001–012)
│   │   └── queries/         # SQL queries consumed by sqlc
│   └── internal/
│       ├── config/          # env-based config with validation
│       ├── db/              # sqlc-generated type-safe query functions
│       ├── handlers/        # HTTP handlers (auth, games, sessions, lists…)
│       ├── middleware/       # JWT authentication middleware
│       ├── migrate/         # embedded migration runner
│       └── respond/         # JSON response helpers
├── web/
│   └── src/
│       ├── components/      # layout, UI primitives, icons
│       ├── lib/             # axios API client, typed interfaces
│       ├── pages/           # route-level components
│       └── store/           # Zustand auth store
├── terraform/               # complete AWS infrastructure as code
└── docker-compose.yml       # local Postgres for development
```

---

## Security

- Passwords hashed with bcrypt (cost 12)
- JWT tokens signed with HMAC-SHA256, validated on every protected request
- Auth endpoints rate-limited to 10 requests/minute per IP
- S3 bucket fully private — accessible only via CloudFront OAC (no public URLs)
- CI/CD IAM user scoped to S3 sync and CloudFront invalidation only — no console access, no other permissions
- Postgres bound to `127.0.0.1` only — not reachable from outside the instance
- CORS locked to the frontend origin in production (`APP_ENV=production`)
