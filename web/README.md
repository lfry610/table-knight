# table-knight-web

React + Vite frontend for Table Knight.

## Stack

- **React 18** + **TypeScript**
- **Vite** — dev server + bundler
- **Tailwind CSS** — styling
- **shadcn/ui** (Radix UI) — accessible component primitives
- **TanStack Query** — server state, caching, background refetch
- **Zustand** — auth state (persisted to localStorage)
- **React Router v6** — client-side routing
- **React Hook Form** — form handling
- **Axios** — HTTP client with JWT interceptor

## Project structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui primitives (Button, Input, Card, etc.)
│   └── layout/       # AppLayout, AuthLayout, ProtectedRoute
├── pages/
│   ├── auth/         # LoginPage, RegisterPage
│   ├── dashboard/    # DashboardPage
│   ├── collection/   # CollectionPage
│   ├── groups/       # GroupsPage, GroupDetailPage
│   └── sessions/     # SessionsPage, LogSessionPage
├── hooks/            # custom hooks (add yours here)
├── lib/
│   ├── api.ts        # typed axios API calls + all types
│   └── utils.ts      # cn() helper
└── store/
    └── auth.ts       # Zustand auth store
```

## Getting started

```bash
cp .env.example .env
npm install
npm run dev
```

The dev server proxies `/api/*` to your Go backend (default: `http://localhost:8080`).

## Building for production

```bash
npm run build       # outputs to dist/
npm run preview     # preview the production build locally
```
