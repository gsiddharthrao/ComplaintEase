# ComplaintEase

Enterprise Complaint Management System — Monorepo

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind + React Router + TanStack Query |
| Backend | Node 20 + Express + TypeScript + Zod + Pino |
| Database | Supabase (Postgres + Auth + RLS + Realtime + Storage) |
| Tests | Vitest + Supertest + SQL RLS tests |
| CI/CD | GitHub Actions → Vercel (web) + Render (api) |

## Quick Start (under 10 commands)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_ORG/complaintease.git
cd complaintease

# 2. Install dependencies
pnpm install

# 3. Set environment variables
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
# → Edit both files with your Supabase project credentials

# 4. Push database migrations (requires Supabase CLI)
supabase db push

# 5. Run seed data
supabase db seed

# 6. Start local development
pnpm dev
```

Open http://localhost:5173 for the frontend, http://localhost:3000/health for the API.

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Employee | employee@demo.com | Demo1234! |
| Dept Head | depthead@demo.com | Demo1234! |
| Admin | admin@demo.com | Demo1234! |

## Monorepo Structure

```
complaintease/
├── apps/
│   ├── web/          # React 18 + Vite frontend
│   └── api/          # Express + TypeScript backend
├── packages/
│   └── shared/       # Shared types and Zod schemas
├── supabase/
│   ├── migrations/   # SQL migration files (applied in order)
│   ├── seed.sql      # Demo data + 10k complaint generator
│   └── tests/        # RLS SQL tests
└── docs/             # Architecture, ERD, decisions, interview Q&A
```

## Manual Setup Checklist

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full deployment guide.

- [ ] Create a Supabase project at https://supabase.com
- [ ] Copy project URL + anon key + service-role key into env files
- [ ] Install Supabase CLI: `npm install -g supabase`
- [ ] Link project: `supabase link --project-ref YOUR_PROJECT_REF`
- [ ] Push migrations: `supabase db push`
- [ ] Run seed: `supabase db seed`
- [ ] Create GitHub repo and push
- [ ] Connect repo to Vercel (web) and Render (api)
- [ ] Set env vars in Vercel and Render dashboards

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [ERD](docs/ERD.md)
- [RLS Matrix](docs/RLS_MATRIX.md)
- [State Machine](docs/STATE_MACHINE.md)
- [Design Decisions](docs/DECISIONS.md)
- [Performance](docs/PERFORMANCE.md)
- [Interview Q&A](docs/INTERVIEW_QA.md)
- [Code Walkthrough](docs/WALKTHROUGH.md)
- [Deploy Guide](docs/DEPLOY.md)
