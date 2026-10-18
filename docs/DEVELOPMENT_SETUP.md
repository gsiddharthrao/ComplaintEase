# ComplaintEase Enterprise — Development & Setup Guide

This guide provides step-by-step instructions for running, testing, and developing ComplaintEase locally on Windows, macOS, and Linux.

---

## 1. Prerequisites

| Tool | Required Version | Verification Command | Notes |
|---|---|---|---|
| **Node.js** | `>= 20.0.0` (Active LTS) | `node --version` | Recommended: Node v20 or v22 LTS |
| **pnpm** | `>= 8.0.0` (Recommended: `9.15.x`) | `pnpm --version` | Managed via Corepack or npm |
| **Git** | `>= 2.40.0` | `git --version` | Required for version control |
| **Docker Desktop** | Optional / For Local Supabase | `docker --version` | Required only if running local Supabase emulator |
| **Supabase CLI** | Optional / For Local DB | `npx supabase --version` | Version `2.121.x` supported |

---

## 2. Dependency Installation

ComplaintEase is a PNPM monorepo. Dependencies must be installed using frozen lockfile mode:

```bash
# Clone the repository
git clone https://github.com/gsiddharthrao/ComplaintEase.git
cd ComplaintEase

# Checkout the working feature branch
git checkout fix/complaintease-security-workflow

# Install workspace dependencies with strict lockfile verification
pnpm install --frozen-lockfile
```

> [!NOTE]
> `.npmrc` is configured with `confirm-modules-purge=false` to ensure non-interactive background terminals and CI runners do not stall on store layout updates.

---

## 3. Environment Configuration

ComplaintEase uses separate environment configuration files for the API and Web applications.

> [!CAUTION]
> **Production Safeguard:** Never paste production Supabase credentials into local development files unless specifically running a controlled maintenance task. By default, the API will emit a protective warning if connected to production in non-production mode.

### Step 3.1: API Environment (`apps/api/.env`)
Copy the example template:
```bash
cp apps/api/.env.example apps/api/.env
```

Configure `apps/api/.env`:
```ini
PORT=3000
NODE_ENV=development

# For local development with Supabase CLI (default ports):
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_MAX=300
RATE_LIMIT_WINDOW_MS=900000
LOG_LEVEL=info

# Set to true only if deliberately targeting production database during development
ALLOW_PROD_DB_IN_DEV=false
```

### Step 3.2: Frontend Environment (`apps/web/.env.local`)
Copy the example template:
```bash
cp apps/web/.env.example apps/web/.env.local
```

Configure `apps/web/.env.local`:
```ini
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
VITE_API_URL=http://localhost:3000
```

---

## 4. Local Database Setup

### Option A: Local Supabase CLI (Recommended for Offline Development)
If Docker Desktop is running:
```bash
# 1. Initialize local Supabase stack
npx supabase start

# 2. Apply ordered migrations (001 through 011)
# Canonical migrations are stored in supabase/migrations/
# The Supabase CLI executes all .sql files in alphanumeric order.

# 3. Seed demo accounts and departments
pnpm --filter @complaintease/api seed
```

### Option B: Cloud Staging Project
Create a separate, disposable staging project at https://supabase.com and run migrations 001–011 in the Supabase SQL Editor.

---

## 5. Running the Application Locally

Build the shared package first, then start both the API and Web dev servers:

```bash
# 1. Build the shared types and schemas package
pnpm --filter @complaintease/shared build

# 2. Start the Express API backend (Port 3000)
pnpm --filter @complaintease/api dev

# 3. In a separate terminal, start the Vite React frontend (Port 5173)
pnpm --filter @complaintease/web dev
```

Open your browser to:
- **Frontend Dashboard:** [http://localhost:5173](http://localhost:5173)
- **API Health Endpoint:** [http://localhost:3000/health](http://localhost:3000/health)

---

## 6. Testing & Quality Verification

Run all test suites locally to ensure regression-free code:

```bash
# 1. Build shared contract package
pnpm --filter @complaintease/shared build

# 2. Typecheck all packages (shared, api, web)
pnpm -r typecheck

# 3. Run automated unit & integration test suites (163 tests)
pnpm -r test

# 4. Run production compilation build
pnpm -r build

# 5. Check Git diff formatting and whitespace hygiene
git diff --check
```

---

## 7. Useful Diagnostic & Troubleshooting Commands

| Task | Command |
|---|---|
| Check node and pnpm versions | `node --version && pnpm --version` |
| Verify NPM registry connection | `pnpm config get registry` |
| View active background tasks | `git status -s` |
| Verify root health check | `curl http://localhost:3000/health` |
| Inspect database connectivity | `pnpm --filter @complaintease/api test -- api-endpoints.test.ts` |
