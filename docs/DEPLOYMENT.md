# ComplaintEase Enterprise — Deployment Guide

This guide details the production deployment architecture, hosting providers, environment variable setup, container configuration, and rollback strategies.

---

## 1. Production Architecture Overview

| Component | Target Provider | Runtime | Configuration File |
|---|---|---|---|
| **Web SPA** | Vercel | Static Edge CDN / Vite SPA | `vercel.json` |
| **API Backend** | Render | Docker Linux Container (Node 20 Alpine) | `render.yaml`, `apps/api/Dockerfile` |
| **Database & Storage** | Supabase Cloud | Managed PostgreSQL 15, GoTrue Auth, Storage | `supabase/migrations/` |

---

## 2. API Backend Deployment (Render)

The backend is packaged as a multi-stage Docker container deployed to Render via `render.yaml`.

### 2.1 Render Service Settings
- **Service Name:** `complaintease-api`
- **Runtime:** `docker`
- **Docker Context:** Repository root `.`
- **Dockerfile Path:** `./apps/api/Dockerfile`
- **Health Check Path:** `/health` (Verified root alias in Express `app.ts`)
- **Port:** `3000`

### 2.2 Required Environment Variables on Render
Configure these in the Render Dashboard (**Environment** tab):

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | HTTP port | `3000` |
| `SUPABASE_URL` | Cloud Supabase project endpoint | `https://kdsjbdxtakgslextabpi.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anonymous JWT key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret administrative key for health & maintenance | `eyJhbGciOi...` |
| `CORS_ORIGIN` | Allowed web origins (comma-separated) | `https://complaintease.vercel.app` |
| `RATE_LIMIT_MAX` | Global rate limit cap | `300` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `900000` |
| `LOG_LEVEL` | Pino log level | `info` |

---

## 3. Frontend SPA Deployment (Vercel)

The React 18 SPA is built with Vite and deployed to Vercel.

### 3.1 Vercel Project Settings
- **Root Directory:** Repository root `.`
- **Framework Preset:** Vite
- **Build Command:** `pnpm --filter @complaintease/shared build && pnpm --filter @complaintease/web build`
- **Output Directory:** `apps/web/dist`

### 3.2 Required Environment Variables on Vercel
Configure in Vercel Project Settings (**Environment Variables**):

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | `https://kdsjbdxtakgslextabpi.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous JWT key |
| `VITE_API_URL` | Render API endpoint (e.g. `https://complaintease-api.onrender.com`) |

---

## 4. Database Migrations Execution Order

Migrations in `supabase/migrations/` are applied sequentially:

```text
001_extensions_and_enums.sql            -> pgcrypto, pg_trgm, enums
002_core_tables.sql                    -> Core tables and foreign keys
003_indexes.sql                        -> Composite and trigram indexes
004_functions.sql                      -> Helper functions and transition logic
005_audit_triggers.sql                 -> Immutability triggers and audit log capture
006_rls.sql                            -> Baseline Row-Level Security policies
007_realtime_and_storage.sql           -> Storage bucket and Realtime publication
008_profile_trigger.sql                -> User creation profile hook
009_complaint_location_image.sql       -> Telemetry and GPS coordinates
010_security_workflow_hardening.sql    -> Force employee signup, protect profile columns, 23 FSM states
011_specialist_assignment_hardening.sql-> Specialist assignee role check, OCC version, RLS decoupling
```

> [!IMPORTANT]
> Migrations 001 through 011 have already been executed against production Supabase (`kdsjbdxtakgslextabpi`). **Never rerun applied migrations** or alter deployed history.

---

## 5. Rollback & Disaster Recovery Procedures

1. **Frontend Rollback:** Instant rollback in Vercel dashboard by promoting the previous successful deployment.
2. **Backend API Rollback:** Redeploy previous Git commit SHA in Render dashboard.
3. **Database Migration Safety:** All migrations are written to be non-destructive where possible. In the event of an emergency, write and execute a forward migration (`012_*.sql`) rather than attempting destructive down-migrations against live data.
