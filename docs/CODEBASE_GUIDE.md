# ComplaintEase Enterprise — Codebase Guide & Module Map

This guide provides a structural reference to navigate the ComplaintEase monorepo, mapping features across the frontend, API, shared contracts, database migrations, and automated test suites.

---

## 1. Monorepo Structure Overview

```text
complaint_project/
├── apps/
│   ├── web/                    # React 18 + Vite frontend Single Page Application
│   └── api/                    # Node.js 20 + Express REST API backend
├── packages/
│   └── shared/                 # Shared TypeScript models, enums, and Zod schemas
├── supabase/
│   ├── migrations/             # Idempotent PostgreSQL DDL migrations (001 - 011)
│   ├── tests/                  # SQL-level RLS and concurrency test suite
│   ├── seed.sql                # Relational demo seed data and 10k test generator
│   └── config.toml             # Supabase CLI local development configuration
├── docs/                       # Architecture, security, API reference, study guide
├── .github/workflows/          # CI/CD GitHub Actions pipelines
├── package.json                # Monorepo root package definition
├── pnpm-workspace.yaml         # PNPM workspace package declarations
├── tsconfig.base.json          # Shared root TypeScript compiler configuration
└── render.yaml                 # Render cloud web service deployment configuration
```

---

## 2. Package-by-Package Architecture

### 2.1 `@complaintease/shared` (`packages/shared/`)
Central single source of truth for contracts shared across the API and Web applications:
- **`src/types/enums.ts`:**
  - `UserRole`: `'employee' | 'dept_head' | 'admin'`
  - `ComplaintStatus`: `'submitted' | 'under_review' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | 'rejected' | 'reopened'`
  - `ComplaintPriority`: `'low' | 'medium' | 'high' | 'critical'`
  - `ALLOWED_TRANSITIONS`: 23 canonical transitions with terminal `closed` and `rejected`.
  - `SPECIALIST_PERMITTED_TRANSITIONS`: `['in_progress', 'resolved']`
  - `CREATOR_PERMITTED_TRANSITIONS`: `['reopened']`
- **`src/types/`:** Data interfaces for `Complaint`, `Profile`, `Comment`, `Department`, `Notification`.
- **`src/schemas/`:** Zod validation schemas:
  - `complaint.schema.ts`: `createComplaintSchema`, `listComplaintsSchema`
  - `transition.schema.ts`: `transitionSchema`, `assignSpecialistSchema` (with mandatory `expected_version`)
  - `auth.schema.ts`: `loginSchema`, `registerSchema`
  - `comment.schema.ts`: `createCommentSchema`

### 2.2 Express API (`apps/api/`)
Stateless REST API implementing security guards and issuing per-request scoped database clients:
- **Entrypoints:**
  - `src/server.ts`: Starts the HTTP server on configured `PORT` (default 3000).
  - `src/app.ts`: Express application setup, security headers (`helmet`), CORS, rate limiters, root `/health`, and `/api/v1` routes.
- **Middleware (`src/middleware/`):**
  - `auth.ts`: `requireAuth` (validates GoTrue JWT, attaches `req.user`, `req.profile`, and `req.supabase`), `requireRole` (RBAC guard).
  - `validate.ts`: `validateBody`, `validateQuery` using Zod schemas.
  - `error-handler.ts`: Maps database error codes (`P0001`–`P0006`, `42501`, `PGRST116`) to HTTP status codes (`400`, `403`, `404`, `409`).
  - `request-id.ts`: Generates UUID tracing header `X-Request-ID`.
- **Routes (`src/routes/`):**
  - `health.ts`: Database-backed health check mounted at `/health` and `/api/v1/health`.
  - `auth.ts`: Registration (`POST /auth/register`), current session (`GET /auth/me`), login helper.
  - `complaints.ts`: List with keyset pagination (`GET /complaints`), create (`POST /complaints`), details (`GET /complaints/:id`), assign specialist (`POST /complaints/:id/assign`), transition status (`POST /complaints/:id/transition`).
  - `comments.ts`: List comments (`GET /complaints/:id/comments`), create comment (`POST /complaints/:id/comments`).
  - `attachments.ts`: Create signed upload URL (`POST /complaints/:id/attachments/upload-url`), confirm attachment (`POST /complaints/:id/attachments`), list attachments with signed download URLs (`GET /complaints/:id/attachments`).
  - `notifications.ts`: List unread (`GET /notifications`), mark read (`PATCH /notifications/:id/read`).
  - `admin.ts`: User management (`GET /admin/users`, `PATCH /admin/users/:id/role`), audit log viewer (`GET /admin/audit-logs`).
- **Configuration & Utilities (`src/config/`, `src/utils/`):**
  - `config/env.ts`: Zod-validated environment configuration with production safeguard.
  - `utils/supabase.ts`: `createUserClient(token)` (per-request user client) and `getAdminClient()` (system maintenance).
  - `utils/logger.ts`: Pino logger configuration.
  - `scripts/seed-users.ts`: Administrator provisioning script with pagination and password overwrite safeguards.

### 2.3 React Web Application (`apps/web/`)
Modern React SPA providing role-specific dashboards, incident mapping, and live updates:
- **Entrypoints:**
  - `src/main.tsx`: Mounts React DOM tree with TanStack QueryClient and BrowserRouter.
  - `src/App.tsx`: Top-level route switch, protected routes, and theme provider.
- **Contexts (`src/context/`):**
  - `AuthContext.tsx`: Supabase session management, login/logout, de-duplicated in-flight profile fetcher.
  - `ThemeContext.tsx`: Dark/Light theme switcher with local storage persistence.
- **Hooks (`src/hooks/`):**
  - `useRealtime.ts`: Subscribes to PostgreSQL CDC via Supabase Realtime and invalidates TanStack Query keys.
- **Pages (`src/pages/`):**
  - `Login.tsx`: User sign-in with demo credentials quick-fill.
  - `Register.tsx`: Employee self-registration (defaults unconditionally to `employee`).
  - `employee/EmployeeDashboard.tsx`: Filterable complaints table, status tabs ("My Complaints", "Assigned to Me").
  - `employee/NewComplaint.tsx`: Multi-step form with HTML5 GPS coordinate capture and two-stage image upload.
  - `admin/AdminPanel.tsx`: Administrator dashboard with metric cards, SLA monitor, category/department management, and immutable audit logs table.
  - `ComplaintDetail.tsx`: Comprehensive incident view, timeline history, attachments list, comments thread, assignment selector, and Specialist Incident Resolution Hub ("Start Work", "Mark Resolved").
- **Components (`src/components/`):**
  - `layout/`: `Layout.tsx`, `Navbar.tsx`, `Sidebar.tsx`.
  - `complaints/`: `StatusBadge.tsx`, `PriorityBadge.tsx`, `Timeline.tsx`, `CommentsThread.tsx`, `AttachmentsList.tsx`.
  - `common/`: `LocationMap.tsx` (OpenStreetMap integration), `VirtualList.tsx`, `ThemeToggle.tsx`.

### 2.4 Database Schema & Migrations (`supabase/migrations/`)
Ordered SQL migrations executed against PostgreSQL:
- **`001_extensions_and_enums.sql`:** Enables `pgcrypto`, `pg_trgm`, creates enums `user_role`, `complaint_status`, `complaint_priority`.
- **`002_core_tables.sql`:** Creates tables `departments`, `profiles`, `categories`, `complaints`, `assignments`, `comments`, `attachments`, `status_history`, `audit_logs`, `notifications`.
- **`003_indexes.sql`:** Indexes for department queries, keyset pagination, active assignments, and trigram text search.
- **`004_functions.sql`:** Defines `current_user_role()`, `current_user_dept()`, `allowed_transitions` table, `transition_complaint()` RPC, and direct update blocker trigger.
- **`005_audit_triggers.sql`:** Audit triggers on core tables and immutability trigger on `audit_logs`.
- **`006_rls.sql`:** Baseline Row-Level Security policies.
- **`007_realtime_and_storage.sql`:** Realtime publication setup, `attachments` storage bucket, and notification triggers.
- **`008_profile_trigger.sql`:** Trigger on `auth.users` creating a profile row.
- **`009_complaint_location_image.sql`:** Adds `latitude`, `longitude`, `location_name`, `image_url` to `complaints`.
- **`010_security_workflow_hardening.sql`:** Hardens public signup (forces `employee`), profile column immutability trigger, atomic initial status history trigger, 23 canonical transitions sync, scoped storage policies, and baseline assignment RPC.
- **`011_specialist_assignment_hardening.sql`:** Hardens `assign_specialist()` with mandatory `expected_version` and target role check (`role = 'employee'`), non-recursive `SECURITY DEFINER` helpers (`is_complaint_assigned_to_user`, `is_complaint_creator`), decoupled specialist RLS policies, and specialist transition permissions in `transition_complaint()`.

---

## 3. Feature Implementation Trace Matrix

| Feature | Frontend View | Express API Route | Shared Schema | Database Implementation |
|---|---|---|---|---|
| **File Complaint** | `NewComplaint.tsx` | `POST /complaints` | `createComplaintSchema` | `complaints` INSERT policy + `trg_complaint_initial_history` |
| **List Assigned** | `EmployeeDashboard.tsx` (`assigned` tab) | `GET /complaints?filter=assigned` | `listComplaintsSchema` | `complaints_select_employee` via `is_complaint_assigned_to_user` |
| **Assign Specialist** | `ComplaintDetail.tsx` (Admin modal) | `POST /complaints/:id/assign` | `assignSpecialistSchema` | RPC `assign_specialist` (`FOR UPDATE` lock, OCC check) |
| **Progress Work** | `ComplaintDetail.tsx` (Resolution Hub) | `POST /complaints/:id/transition` | `transitionSchema` | RPC `transition_complaint` (`assigned -> in_progress -> resolved`) |
| **Reopen Ticket** | `ComplaintDetail.tsx` (Creator button) | `POST /complaints/:id/transition` | `transitionSchema` | RPC `transition_complaint` (`resolved -> reopened`) |
| **Upload File** | `NewComplaint.tsx` / `AttachmentsList.tsx` | `POST /complaints/:id/attachments/upload-url` + `confirm` | `uploadUrlSchema` / `confirmAttachmentSchema` | `storage.objects` scoped policies + `attachments` INSERT RLS |
| **Internal Notes** | `CommentsThread.tsx` (Dept Head/Admin) | `POST /complaints/:id/comments` (`is_internal: true`) | `createCommentSchema` | `comments_select_employee` filters `is_internal = false` |
| **Audit Logs** | `AdminPanel.tsx` ("Immutable Audit Trail") | `GET /admin/audit-logs` | Response unwrapped array | `audit_logs_select_admin` policy + tamper-proof trigger |
