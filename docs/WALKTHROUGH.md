# File-by-File Code Walkthrough & Reading Guide

This walkthrough guides you through the ComplaintEase codebase in logical pedagogical order, explaining the purpose, key functions, and mechanics of every critical file.

---

## Recommended Reading Order

```mermaid
flowchart LR
    A["1. Database Schema & RLS"] --> B["2. Shared Contract"]
    B --> C["3. API Core & Middleware"]
    C --> D["4. API Route Handlers"]
    D --> E["5. Frontend Foundations"]
    E --> F["6. Frontend Pages & UI"]
```

---

## 1. Database Migrations (`/supabase/migrations`)

### `001_extensions_and_enums.sql`
- **Purpose:** Foundation migration setting up extensions and enumerated types.
- **Key Concepts:**
  - `CREATE EXTENSION pgcrypto`: Provides `gen_random_uuid()` for generating collision-resistant primary keys.
  - `CREATE EXTENSION pg_trgm`: Enables trigram-based string similarity indexing.
  - Custom Enums: `user_role` (`employee`, `admin`), `complaint_status`, and `complaint_priority`.

### `002_core_tables.sql`
- **Purpose:** Normalized 3NF tables with strict relational integrity constraints.
- **Key Concepts:**
  - `departments`: Enterprise divisions.
  - `profiles`: 1:1 extension of Supabase's `auth.users` with cascading deletion.
  - `complaints`: Core business entity with `version` integer for optimistic locking.
  - `assignments`: Tracks assignment history; features a partial unique index `idx_assignments_one_active` ensuring only one active assignee per ticket.
  - `comments`: Supports public discussion and staff-only internal notes (`is_internal = true`).
  - `audit_logs`: Audit trail table capturing JSON diffs.

### `003_indexes.sql`
- **Purpose:** Performance indexes designed for real query patterns.
- **Key Concepts:**
  - `idx_complaints_dept_status_created`: Composite index on `(department_id, status, created_at DESC)` for department triage queries.
  - `idx_complaints_created_by_created`: Composite index on `(created_by, created_at DESC)` for employee queries.
  - `idx_complaints_search`: GIN trigram index on `(title || ' ' || description)` for fast full-text substring search.
  - `idx_assignments_assigned_status`: Partial index on active assignments (`is_active = true`).

### `004_functions.sql`
- **Purpose:** Core business logic and transition state machine.
- **Key Concepts:**
  - `current_user_role()` & `current_user_dept()`: `SECURITY DEFINER` helpers that avoid RLS recursion loops.
  - `allowed_transitions`: Master lookup table of valid lifecycle pairs.
  - `transition_complaint()`: Atomic function that executes `SELECT ... FOR UPDATE` (pessimistic lock), checks `expected_version` (optimistic lock), validates the transition against `allowed_transitions`, verifies caller role permissions, updates status, and appends to `status_history`.
  - `enforce_status_via_function()`: Trigger function that raises SQLSTATE `P0005` on direct status updates.

### `005_audit_triggers.sql`
- **Purpose:** Append-only audit trail and updated-at timestamps.
- **Key Concepts:**
  - `audit_trigger_fn()`: Trigger function that writes JSONB diffs of `OLD` and `NEW` records to `audit_logs`.
  - `prevent_audit_tampering()`: BEFORE UPDATE/DELETE trigger that raises error code `P0006` to prevent tampering with audit records.
  - `touch_updated_at()`: Trigger keeping `updated_at` timestamps accurate automatically.

### `006_rls.sql`
- **Purpose:** Row Level Security policies for all application tables.
- **Key Concepts:**
  - Granular `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies for `employee` and `admin`.
  - Hides internal comments from employees (`is_internal = false`).
  - Restricts employees to their own complaints (`created_by = auth.uid()`), while granting admins global management capability.

### `007_realtime_and_storage.sql`
- **Purpose:** Realtime logical replication publication and private Supabase Storage bucket for file attachments.
- **Key Concepts:**
  - Adds `complaints`, `comments`, and `notifications` to `supabase_realtime` publication.
  - Creates the `attachments` storage bucket with strict 10 MB size limits and whitelisted MIME types.

### `008_profile_trigger.sql`
- **Purpose:** Automatically provisions a `public.profiles` row upon new user creation in `auth.users`.

### `009_complaint_location_image.sql`
- **Purpose:** Adds geolocation coordinates (`location_lat`, `location_lng`), physical address (`location_address`), photographic evidence URL (`image_url`), and the composite spatial index `idx_complaints_location`.

---

## 2. Shared Types & Schemas (`/packages/shared`)

### `src/types/enums.ts`
- Defines TypeScript union types matching PostgreSQL enums (`UserRole`, `ComplaintStatus`, `ComplaintPriority`).
- Exports `ALLOWED_TRANSITIONS` and `TRANSITION_PERMISSIONS` mappings.

### `src/types/complaint.ts`, `user.ts`, `comment.ts`
- Strong TypeScript interfaces mirroring database rows and API responses (`Complaint`, `ComplaintWithRelations`, `Profile`).

### `src/schemas/complaint.schema.ts`, `auth.schema.ts`, `transition.schema.ts`
- Zod schemas that validate data structures uniformly on both frontend and backend.

---

## 3. Backend API (`/apps/api`)

### `src/config/env.ts`
- Validates environment variables (`PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) on server startup using Zod.

### `src/utils/supabase.ts`
- `createUserClient(token)`: Instantiates a per-request Supabase client with the user's Bearer token so PostgreSQL receives the user identity and evaluates RLS.
- `getAdminClient()`: Service role client restricted to seed scripts and user provisioning.

### `src/middleware/auth.ts`
- `requireAuth`: Verifies the incoming Bearer token, checks authentication with Supabase Auth, and attaches `req.supabase`, `req.user`, and `req.profile` to the Express Request.
- `requireRole(allowedRoles)`: Rejects requests with HTTP 403 if the user does not have an allowed role.

### `src/middleware/error-handler.ts`
- Centralized error handler that maps PostgreSQL error codes (`P0001`, `P0003`, `P0005`, `P0006`, `42501`) to standardized HTTP JSON responses with request IDs.

### `src/routes/complaints.ts`
- `GET /complaints`: Implements keyset pagination (`created_at__id`) and PostgREST embedded joins to fetch complaints without N+1 queries.
- `POST /complaints`: Inserts new incidents with optional GPS telemetry and image data.
- `POST /complaints/:id/transition`: Invokes the database function `transition_complaint()`.
- `POST /complaints/:id/assign`: Assigns a specialist and updates status.

### `src/routes/auth.ts`, `comments.ts`, `attachments.ts`, `admin.ts`, `health.ts`
- Handles profile registration/lookups, threaded comment creation, file attachment metadata with signed URLs, administrative metrics, and liveness health checks.

---

## 4. Frontend Application (`/apps/web`)

### `src/lib/supabase.ts` & `src/lib/api-client.ts`
- Browser Supabase client and typed HTTP fetch wrapper that automatically attaches the user's JWT token to outgoing requests.

### `src/context/AuthContext.tsx`
- Manages user session state, handles login/logout, and listens to Supabase auth events via `onAuthStateChange`.

### `src/hooks/useRealtime.ts`
- Sets up Supabase Realtime WebSocket subscriptions on `complaints`, `comments`, and `notifications`, automatically invalidating TanStack Query caches on changes.

### `src/components/auth/ProtectedRoute.tsx`
- Route wrapper that verifies authentication and role permissions before rendering protected pages.

### `src/pages/Login.tsx`
- Dual-portal authentication interface:
  - **Command Center Tab:** Streamlined administrative login with security status indicators.
  - **Staff Portal Tab:** Employee login and self-registration toggle with department selection and form validation.

### `src/pages/employee/EmployeeDashboard.tsx`
- Employee landing view displaying personal incident filings, real-time status counters, search and filter controls, and quick action buttons to file new complaints.

### `src/pages/employee/NewComplaint.tsx`
- High-fidelity incident filing interface featuring:
  - Live GPS acquisition via HTML5 Geolocation API (`navigator.geolocation.getCurrentPosition`).
  - Fallback manual location input for room/bay descriptions.
  - Photographic evidence upload with local drag-and-drop preview and client-side validation.
  - Real-time form validation via React Hook Form and shared Zod schemas.

### `src/pages/admin/AdminPanel.tsx`
- Enterprise operations command center providing:
  - Global incident triage feed with real-time WebSocket updates.
  - Quick status transition action buttons with version-aware conflict prevention.
  - 1-click specialist assignment modal.
  - Integrated interactive location mapping (`LocationMap.tsx`) for geotagged incidents.
  - Department and category management tabs.

### `src/pages/ComplaintDetail.tsx`
- Comprehensive single-incident view featuring:
  - Incident header with status and priority badges.
  - Lifecycle state machine action controls and assignment drawer.
  - Interactive timeline showing historical transitions and notes.
  - Threaded comment section with internal note filtering for administrative staff.
  - Photographic evidence display with high-resolution lightbox modal.

### `src/components/common/VirtualList.tsx`
- Custom virtualized windowing component that renders only visible list items, ensuring smooth scrolling over large datasets.
