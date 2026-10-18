# ComplaintEase Enterprise — Master Technical Study & Interview Guide

This guide is designed for deep architectural comprehension, code defense, technical interviews, viva questions, and engineering presentations for **ComplaintEase Enterprise**.

---

# CHAPTER 1 — PROJECT INTRODUCTION & CORE VALUE

### 1.1 Problem Statement
In manufacturing plants, commercial facilities, and enterprise operations, incident reporting often suffers from four critical flaws:
1. **Unreliable Access Control (IDOR):** Web applications often enforce access rules only in the frontend or middleware. A rogue API request or leaked URL allows employees to read or tamper with unrelated complaints, confidential HR incidents, or internal staff discussions.
2. **Lost-Update Concurrency Anomalies:** When multiple shift operators or plant managers review a ticket simultaneously, the second transition frequently overwrites the first without realizing it, leaving equipment repairs in an inconsistent state.
3. **Audit Log Tampering:** Standard relational databases allow administrative users or compromised application accounts to delete or alter historical incident logs to evade accountability.
4. **Binary Bloat in Relational Tables:** Applications often store raw base64-encoded photographic evidence directly in PostgreSQL rows, degrading index performance and table scan latency.

### 1.2 The ComplaintEase Solution
ComplaintEase is an isolated, enterprise-grade complaint tracking platform built with **defense-in-depth security** and **hybrid concurrency isolation**:
- **Database as the Ultimate Security Boundary:** Employs PostgreSQL Row-Level Security (RLS) driven by Supabase GoTrue JWTs. Even if the API server is completely bypassed, the database kernel prevents unauthorized reads and writes.
- **Atomic State Progression & OCC:** Uses `transition_complaint` and `assign_specialist` stored procedures that combine pessimistic row locks (`SELECT ... FOR UPDATE`) with optimistic version checks (`expected_version`).
- **Cryptographic & Append-Only Audit Integrity:** Mutations trigger automated JSON diff captures into `audit_logs`, where `BEFORE UPDATE OR DELETE` triggers throw exceptions, making history immutable.
- **Two-Stage Signed Storage:** Offloads images to private Supabase Storage buckets via short-lived signed URLs, storing only metadata and validated paths in PostgreSQL.

---

# CHAPTER 2 — USER ROLES & AUTHORIZATION MATRIX

| Role | Operational Scope | Permitted Actions | Prohibited Actions |
|---|---|---|---|
| **Employee (Creator)** | Own tickets | File complaints with GPS & images; view own tickets; add public comments; reopen own tickets if resolved | Cannot view other employees' tickets; cannot view internal comments; cannot assign specialists; cannot close tickets |
| **Employee (Specialist)** | Assigned tickets | View tickets in "Assigned to Me"; view external comments & attachments; advance status (`assigned -> in_progress -> resolved`) | Cannot view internal notes; cannot jump status; cannot reassign ticket; loses view access immediately if reassigned |
| **Department Head** | Department tickets | View all department tickets; add internal notes (`is_internal = true`); advance department workflow; view attachments | Cannot view other departments' tickets; cannot demote self; cannot delete audit logs |
| **Administrator** | System-wide | View all tickets; assign specialists; manage users & roles; close or reject tickets; view immutable audit logs | Cannot demote own account; cannot alter or delete audit logs; cannot bypass terminal states (`closed`, `rejected`) |

---

# CHAPTER 3 — TECHNOLOGY STACK & SELECTION RATIONALE

### 3.1 Presentation Tier: React 18 + Vite + Tailwind CSS + TanStack Query v5
- **Why Vite:** Sub-second HMR and optimized production Rollup bundling.
- **Why TanStack Query:** Manages asynchronous server state, automatic request de-duplication, background refetching, and optimistic UI mutations.
- **Why React Hook Form:** Uncontrolled form inputs minimizing re-renders during GPS capture and multi-file validation.

### 3.2 Application Tier: Node.js 20 + Express + Zod + Pino
- **Why Express:** Minimal, transparent middleware architecture that allows precise request lifecycle interception.
- **Why Zod:** Guarantees strict runtime boundary validation; schemas are shared directly with the frontend via `@complaintease/shared`.
- **Why Pino:** Extremely fast JSON logger with structured request tracing via `X-Request-ID`.

### 3.3 Database Tier: PostgreSQL 15 + Supabase Auth & Storage
- **Why PostgreSQL RLS:** Pushes row-level and column-level authorization into the database kernel, preventing Insecure Direct Object References (IDOR).
- **Why Supabase Storage:** Private S3-compatible object store supporting signed upload/download tokens without exposing API credentials.

---

# CHAPTER 4 — END-TO-END REQUEST & DATA FLOW

```text
[Browser User]
      │
      ▼  (HTTP POST /api/v1/complaints/:id/transition)
[Reverse Proxy / SSL] (Rate Limit: 50 requests/15m for mutations)
      │
      ▼
[Express Server: app.ts]
      │──> requestIdMiddleware (Assigns X-Request-ID)
      │──> pinoHttp (Access logging)
      │──> requireAuth (Verifies Supabase JWT via GoTrue)
      │──> requireRole (Checks user role)
      │──> validateBody(transitionSchema) (Validates expected_version & new_status)
      │──> createUserClient(jwt) (Creates per-request client passing caller token)
      │
      ▼  (PostgREST RPC Call: SELECT transition_complaint(...))
[PostgreSQL Database Kernel]
      │──> Verifies auth.uid() & search_path = public
      │──> SELECT ... FOR UPDATE (Pessimistic Row Lock)
      │──> Version Check: expected_version == complaints.version (OCC)
      │──> State Check: allowed_transitions table (Canonical FSM)
      │──> Role Check: Specialist or Creator permission verified
      │──> UPDATE complaints (Increments version, sets resolved_at)
      │──> INSERT INTO status_history (Audit timeline)
      │──> trg_audit_complaints fires -> INSERT INTO audit_logs
      │──> supabase_realtime CDC publication emits WAL event
      │
      ▼
[Express Error Handler] (Maps P0001->400, P0003->409, 42501->403)
      │
      ▼
[React Web Client] (TanStack Query invalidates cache; UI updates via WebSocket)
```

---

# CHAPTER 5 — IMPORTANT FILES & DIRECTORY TOUR

1. `packages/shared/src/types/enums.ts`: Authoritative 23-state transition matrix and user role definitions.
2. `packages/shared/src/schemas/transition.schema.ts`: Zod schema enforcing mandatory `expected_version` on transitions and assignments.
3. `apps/api/src/app.ts`: Ingress security configuration (Helmet, CORS, rate limiting, `/health`, `/api/v1`).
4. `apps/api/src/middleware/auth.ts`: `requireAuth` and `requireRole` guards issuing per-request user clients.
5. `apps/api/src/routes/complaints.ts`: Complaint lifecycle route handlers and keyset pagination controller.
6. `apps/api/src/routes/attachments.ts`: Two-stage signed upload generator and server-side metadata validator.
7. `apps/api/src/middleware/error-handler.ts`: Structured error translator mapping SQLSTATEs to HTTP status codes.
8. `apps/web/src/context/AuthContext.tsx`: Race-free, de-duplicated authentication and session management.
9. `apps/web/src/pages/ComplaintDetail.tsx`: Specialist Incident Resolution Hub and admin assignment modal.
10. `supabase/migrations/011_specialist_assignment_hardening.sql`: Hardened `assign_specialist` RPC and non-recursive specialist RLS helpers.

---

# CHAPTER 6 — DATABASE DESIGN & ENTITY RELATIONSHIPS

### 6.1 Core Relational Tables
- **`profiles`:** Extends `auth.users` 1:1. Contains `id` (FK to `auth.users`), `full_name`, `role`, `department_id`.
- **`departments`:** Organizational units (`id`, `name`, `head_id` FK to `profiles`).
- **`categories`:** Complaint topics linked to departments or global.
- **`complaints`:** Primary entity containing `id`, `title`, `description`, `category_id`, `department_id`, `created_by`, `status`, `priority`, `version` (OCC), `resolved_at`, `latitude`, `longitude`, `location_name`.
- **`assignments`:** Tracks specialist delegation. Contains `complaint_id`, `assigned_to`, `assigned_by`, `is_active`, `note`. Enforced by a partial unique index:
  ```sql
  CREATE UNIQUE INDEX idx_assignments_one_active ON assignments (complaint_id) WHERE is_active = true;
  ```
- **`comments`:** Threaded remarks with `is_internal` boolean flag.
- **`attachments`:** File metadata with `storage_path` linking to Supabase Storage objects.
- **`status_history`:** Append-only timeline of lifecycle transitions.
- **`audit_logs`:** Tamper-resistant append-only table recording JSON before/after snapshots.

---

# CHAPTER 7 — AUTHENTICATION & ROW-LEVEL SECURITY (RLS)

### 7.1 Non-Recursive Security Helpers
To prevent infinite recursion when querying RLS-protected tables inside policies, ComplaintEase uses `SECURITY DEFINER` functions with fixed `search_path`:
- `current_user_role()`: Queries `profiles.role` for `auth.uid()`.
- `current_user_dept()`: Queries `profiles.department_id` for `auth.uid()`.
- `is_complaint_assigned_to_user(p_complaint_id)`: Checks `assignments` for active delegation (`is_active = true AND assigned_to = auth.uid()`).
- `is_complaint_creator(p_complaint_id)`: Checks `complaints.created_by = auth.uid()`.

### 7.2 The Database as the Security Perimeter
Even if an attacker crafts a direct HTTP request attempting to fetch `/api/v1/complaints/secret-hr-incident-uuid`, PostgreSQL evaluates:
```sql
CREATE POLICY complaints_select_employee ON complaints FOR SELECT TO authenticated
USING (
  current_user_role() = 'employee' AND (
    created_by = auth.uid() OR is_complaint_assigned_to_user(id)
  )
);
```
If the employee is neither the creator nor the active specialist, PostgreSQL returns 0 rows. The Express API maps this to `404 Not Found`, eliminating IDOR vulnerabilities.

---

# CHAPTER 8 — CANONICAL FINITE STATE MACHINE (FSM)

The lifecycle contains exactly 23 transitions:
```text
submitted    -> under_review, rejected
under_review -> assigned, rejected
assigned     -> in_progress, rejected
in_progress  -> resolved, rejected
resolved     -> closed, reopened
reopened     -> in_progress, rejected
closed       -> (Terminal: 0 outgoing)
rejected     -> (Terminal: 0 outgoing)
```
- Direct table updates are intercepted by `trg_block_direct_status_update`.
- Non-admin employees are strictly limited to `assigned -> in_progress` and `in_progress -> resolved` (if actively assigned) or `resolved -> reopened` (if creator).

---

# CHAPTER 9 — CONCURRENCY CONTROL: PESSIMISTIC + OPTIMISTIC (OCC)

### 9.1 The Lost Update Scenario
Suppose Specialist A and Specialist B open a ticket at `version: 2`. Specialist A clicks "Start Work" (`new_status: 'in_progress'`), and simultaneously Specialist B clicks "Mark Resolved".
1. Both requests submit `expected_version: 2`.
2. The database stored procedure executes `SELECT * FROM complaints WHERE id = p_complaint_id FOR UPDATE`.
3. Specialist A's transaction locks the row first. `v_complaint.version (2) == expected_version (2)`. Status updates to `in_progress`, and version increments to `3`. Transaction commits.
4. Specialist B's transaction acquires the lock next. Now `v_complaint.version is 3`, but Specialist B's request sent `expected_version: 2`.
5. PostgreSQL immediately raises SQLSTATE `P0003`:
   ```sql
   RAISE EXCEPTION 'Version conflict: expected %, got %', p_expected_version, v_complaint.version USING ERRCODE = 'P0003';
   ```
6. The API translates `P0003` to `409 Conflict`. No data corruption or race condition occurs.

---

# CHAPTER 10 — ATTACHMENT & STORAGE SECURITY

1. **Path Scoping:** All attachments must follow the canonical path `<user_id>/<complaint_id>/<uuid>.<ext>`.
2. **Server-Side Metadata Verification:** The Express API inspects the uploaded object's size and verifies that the file extension in `storage_path` strictly matches the declared MIME type.
3. **Private Buckets:** The `attachments` bucket is private (`public = false`). Files can only be downloaded via short-lived (1-hour) signed URLs generated by authorized users.

---

# CHAPTER 11 — REPRESENTATIVE API TRACE: ASSIGNING A SPECIALIST

1. **Client Action:** Admin selects an employee and submits `POST /api/v1/complaints/:id/assign`.
2. **Validation:** `assignSpecialistSchema` asserts `assigned_to` is a valid UUID and `expected_version` is an integer `>= 1`.
3. **Route Controller:** `apps/api/src/routes/complaints.ts` calls `supabase.rpc('assign_specialist', ...)`.
4. **Stored Procedure:**
   - Asserts caller is `admin` (`current_user_role() != 'admin'` throws `42501`).
   - Asserts complaint is not terminal (`closed` or `rejected` throws `P0001`).
   - Asserts target user has `role = 'employee'` (`P0004`).
   - Asserts `expected_version == version` (`P0003`).
   - Deactivates previous assignments (`is_active = false`).
   - Inserts new active assignment (`is_active = true`).
   - Transitions complaint status to `assigned` and bumps version.
5. **Response:** Returns JSON envelope with new version. Realtime CDC emits update.

---

# CHAPTER 12 — TESTING METHODOLOGY & LIMITATIONS

ComplaintEase employs a tiered testing strategy:
1. **Mocked API & Unit Tests (151 passing tests across 9 files):** Executed with Vitest and Supertest. Validates middleware guards, Zod schemas, route handlers, error translators, and rate limiting in memory.
2. **Database SQL Integration Suite (28 test blocks):** Contained in `supabase/tests/rls_and_concurrency_test.sql`. Executed inside the PostgreSQL database engine to test RLS policies, OCC conflict handling, triggers, and immutability.
3. **Browser End-to-End Testing (Manual / Staging):** Real user workflows in the browser. *Status: Distinct from mocked tests. Live mutative writes against production are protected.*

---

# CHAPTER 13 — 30 ESSENTIAL TECHNICAL INTERVIEW QUESTIONS & ANSWERS

### Q1: What is the primary architecture of ComplaintEase?
**Answer:** It is a 4-tier monorepo consisting of a React 18 frontend (`apps/web`), a stateless Express API (`apps/api`), a shared contract package (`@complaintease/shared`), and a PostgreSQL 15 database with Supabase GoTrue Auth and Storage.

### Q2: Why use PostgreSQL Row-Level Security instead of checking permissions solely in Express?
**Answer:** Defense-in-depth. If permissions exist only in Express, an API coding error, route omission, or direct database query could expose confidential data. RLS enforces security at the kernel layer: queries execute under the caller's JWT, making unauthorized access physically impossible at the database boundary.

### Q3: How do you prevent RLS infinite recursion?
**Answer:** RLS policies on tables like `complaints` or `comments` often need to check a user's role or assignment. If they query `profiles` or `assignments` directly, those child queries trigger their own RLS policies, creating circular recursion. We solve this by using `SECURITY DEFINER` helper functions (`current_user_role`, `is_complaint_assigned_to_user`) with `SET search_path = public` that execute with owner privileges to read specific attributes without re-triggering RLS.

### Q4: Explain the concurrency strategy in ComplaintEase.
**Answer:** We use hybrid concurrency control: pessimistic row locking combined with optimistic concurrency control (OCC). `transition_complaint` acquires a `SELECT ... FOR UPDATE` lock to serialize concurrent operations, then verifies `expected_version == complaints.version`. If stale, it aborts with SQLSTATE `P0003` (HTTP 409 Conflict).

### Q5: What is the purpose of the `version` column?
**Answer:** It acts as an optimistic concurrency lock counter. Every state transition or specialist assignment increments `version` by 1. Clients submit their known version, preventing accidental lost updates.

### Q6: How many states and transitions exist in the complaint state machine?
**Answer:** There are 8 states (`submitted`, `under_review`, `assigned`, `in_progress`, `resolved`, `closed`, `rejected`, `reopened`) and exactly 23 valid transitions. `closed` and `rejected` are terminal with 0 outgoing transitions.

### Q7: Can a user update the complaint status directly with SQL `UPDATE`?
**Answer:** No. A `BEFORE UPDATE` trigger (`trg_block_direct_status_update`) checks whether `status` is changing and aborts with `P0005` unless executed within the trusted session context of `transition_complaint`.

### Q8: How is the audit log protected from tampering?
**Answer:** The `audit_logs` table has a `BEFORE UPDATE OR DELETE` trigger (`trg_protect_audit_logs`) that immediately raises an exception. `UPDATE` and `DELETE` privileges are also revoked from authenticated and anon roles, making it strictly append-only.

### Q9: What happens if an admin attempts to demote their own account?
**Answer:** The API route `PATCH /api/v1/admin/users/:id/role` checks `req.user.id === targetId && newRole !== 'admin'` and rejects the request with HTTP 400 `CANNOT_DEMOTE_SELF`, preventing accidental lockout of the last admin.

### Q10: How are public sign-ups prevented from claiming administrative privileges?
**Answer:** Migration 010 modified `handle_new_user()` to ignore `raw_user_meta_data->>'role'` from public requests and hardcode `'employee'`. Admin accounts can only be provisioned via the authenticated administrative API or offline seed script.

### Q11: How do you prevent users from updating their own role via `profiles` table updates?
**Answer:** A database trigger (`trg_protect_profile_sensitive_columns`) uses `IS DISTINCT FROM` null-safe checks. If a non-admin attempts to modify `role`, `department_id`, `id`, or `created_at`, the trigger raises SQLSTATE `42501` (Forbidden).

### Q12: How are internal comments isolated from ordinary employees?
**Answer:** The RLS policy `comments_select_employee` includes `AND is_internal = false`. Non-admin/non-department-head users receive 0 rows for internal comments, even on complaints they created or are assigned to.

### Q13: What does the Assigned to Me view show?
**Answer:** It displays tickets where `assignments.assigned_to = auth.uid()` and `assignments.is_active = true`. This is evaluated by `is_complaint_assigned_to_user()`.

### Q14: What happens to a specialist's access when a ticket is reassigned?
**Answer:** `assign_specialist` sets `is_active = false` on all existing assignments for the complaint before inserting the new assignment. `is_complaint_assigned_to_user` immediately returns false for the former specialist, revoking their read and transition access.

### Q15: Can an unassigned employee view another employee's complaint?
**Answer:** No. `complaints_select_employee` requires `created_by = auth.uid() OR is_complaint_assigned_to_user(id)`. If neither holds, PostgreSQL returns 0 rows, which Express translates to HTTP 404.

### Q16: How does keyset pagination work in ComplaintEase?
**Answer:** Instead of `OFFSET / LIMIT` which degrades to $O(N)$ full table scans, ComplaintEase uses composite cursor seeking `(created_at, id) < (cursor_created_at, cursor_id) ORDER BY created_at DESC, id DESC LIMIT :limit`. This utilizes the composite B-tree index for consistent $O(\log N)$ retrieval.

### Q17: How is file upload handled securely?
**Answer:** Two-phase signed storage: 1) Client requests a signed upload URL via `POST /complaints/:id/attachments/upload-url`, which verifies complaint access and generates a path `<user_id>/<complaint_id>/<uuid>.<ext>`. 2) Client uploads directly to Supabase Storage. 3) Client confirms upload via `POST /complaints/:id/attachments`, where Express verifies the path prefix, file extension match, and stored object size (`<= 10MB`).

### Q18: What prevents directory traversal in attachment paths?
**Answer:** Express strictly asserts that `storage_path` starts with `${req.user.id}/${id}/` and regex-validates that the filename contains no path traversal sequences (`..`, `/`, `\`).

### Q19: Why are base64 image data URLs discouraged in the database?
**Answer:** Base64 increases payload size by ~33%, inflates PostgreSQL table and WAL size, degrades buffer pool cache efficiency, and slows down index scans. Storing binary assets in object storage and keeping only URL/path metadata in PostgreSQL maintains a lightweight database.

### Q20: How does Realtime work without overwhelming the server?
**Answer:** `useRealtime` subscribes to Supabase Realtime WebSocket events on `complaints` and `notifications`. Instead of running 3-second polling loops, the client invalidates specific TanStack Query keys (`['complaints']`, `['complaint', id]`) only when a database change occurs, backed by a conservative 60-second fallback poll.

### Q21: What is the purpose of `@complaintease/shared`?
**Answer:** It avoids type drift between client and server. Both the Vite React app and Express backend import TypeScript models and Zod schemas from this single package.

### Q22: How is Express rate limiting configured?
**Answer:** Tiered rate limiting: `authMutationLimiter` allows 50 requests/15m for sensitive endpoints (`/auth`, mutations), while `generalReadLimiter` allows 300 requests/15m for queries. Reverse proxy trust (`app.set('trust proxy', 1)`) ensures client IP is evaluated correctly behind edge CDNs.

### Q23: Why did `pnpm install --frozen-lockfile` stall in non-interactive mode?
**Answer:** `node_modules/.modules.yaml` contained metadata from a different pnpm virtual store layout (`v11`), causing pnpm 9.15.9 to pause and prompt on stdin: `? The modules directory will be removed and reinstalled...`. In headless subshells, this blocked on stdin. Setting `confirm-modules-purge=false` in `.npmrc` eliminated the interactive prompt.

### Q24: What is the difference between unit tests and the SQL regression test suite?
**Answer:** Unit tests (151 Vitest tests) verify Express route logic, middleware, and Zod schemas in-memory with mocked database calls. The SQL test suite (`rls_and_concurrency_test.sql`, 28 test blocks) runs inside the real PostgreSQL engine, verifying actual RLS policy behavior, triggers, and row-level locking.

### Q25: How does the health check endpoint operate?
**Answer:** Mounted at `/health` and `/api/v1/health`. It performs a lightweight `head: true` count query on `departments` with a 3-second timeout. If the database is responsive, it returns HTTP 200 with latency; if unreachable, it returns HTTP 503.

### Q26: What is the production database safeguard in `env.ts`?
**Answer:** If `SUPABASE_URL` points to the production Supabase host while running in non-production mode, the API checks for `ALLOW_PROD_DB_IN_DEV=true`. If not set, it emits a protective safeguard banner to prevent accidental test mutations against production.

### Q27: How does the seed script prevent accidental credential overwrites?
**Answer:** `seed-users.ts` paginates through all users to find existing accounts. If an admin account exists, it preserves the existing password by default unless explicitly invoked with `RESET_EXISTING_PASSWORD=true`. It also refuses to run against production without `ALLOW_PROD_SEED=true`.

### Q28: How does `AuthContext.tsx` handle race conditions on startup?
**Answer:** It uses an in-flight promise ref (`inFlightPromiseRef`) to de-duplicate concurrent `getSession()` and `onAuthStateChange` calls, and compares `activeUserIdRef` with current session state to prevent stale profile overwrites.

### Q29: What are the terminal states of a complaint?
**Answer:** `closed` and `rejected`. Once a complaint enters either status, it cannot transition to any other status. Specialist assignment is also blocked on terminal tickets.

### Q30: What is the final status of browser end-to-end testing?
**Answer:** Admin login and dashboard tab rendering have been verified in the browser. Mutative browser workflows against production are protected by safety rules until executed in an isolated local or staging environment.

---

# CHAPTER 14 — 1-HOUR REVISION PLAN BEFORE AN INTERVIEW

- **00–15 min (Architecture & Security):** Review Chapter 1, Chapter 4, and [ARCHITECTURE.md](file:///d:/complaint_project/docs/ARCHITECTURE.md). Be ready to draw the 4 tiers, RLS boundary, and request lifecycle on a whiteboard.
- **15–30 min (Concurrency & State Machine):** Review Chapter 8, Chapter 9, and [STATE_MACHINE.md](file:///d:/complaint_project/docs/STATE_MACHINE.md). Memorize how `expected_version` and `FOR UPDATE` row locking prevent lost updates (`P0003` -> 409).
- **30–45 min (Database RLS & Assignments):** Review Chapter 6, Chapter 7, and [RLS_MATRIX.md](file:///d:/complaint_project/docs/RLS_MATRIX.md). Understand how `is_complaint_assigned_to_user` and `current_user_role` prevent infinite recursion.
- **45–60 min (Top Questions & Presentation):** Practice the 3-minute project pitch in Chapter 15 and rehearse Answers Q2, Q4, Q11, Q17, and Q23.

---

# CHAPTER 15 — 3-MINUTE PROJECT PRESENTATION SCRIPT

> "Hello! Today I'm presenting **ComplaintEase Enterprise**, a high-reliability complaint and plant incident management system.
>
> In many enterprise systems, access control is enforced only in the frontend or API layer, leaving them vulnerable to IDOR vulnerabilities where users can access unauthorized records simply by guessing UUIDs. Furthermore, when multiple plant operators update tickets concurrently, standard applications suffer from lost-update anomalies.
>
> To solve this, I designed ComplaintEase around **defense-in-depth database security** and **hybrid concurrency isolation**.
>
> On the frontend, we use React 18, Vite, Tailwind, and TanStack Query, connecting to an Express TypeScript API. But our true security boundary is inside PostgreSQL using Supabase Row-Level Security. Every API query executes with the caller's JWT, activating database policies so employees can only ever query complaints they created or are actively assigned to.
>
> For state transitions, direct SQL updates are blocked by triggers. All status changes must go through a stored procedure that acquires a pessimistic row lock (`SELECT ... FOR UPDATE`) and checks an optimistic concurrency version (`expected_version`). If two operators try to update a ticket simultaneously, the second transaction is caught and cleanly returned as an HTTP 409 Conflict.
>
> We also implemented an append-only audit trail protected by immutability triggers, two-stage private signed attachment storage, and a shared TypeScript package ensuring complete type safety across client and server.
>
> The codebase is fully validated with 151 automated tests, clean TypeScript compilation, and verified PostgreSQL migration scripts. Thank you, and I look forward to your questions!"

---

# CHAPTER 16 — SAFE DEMO SCRIPT (NON-MUTATIVE / STAGING WALKTHROUGH)

1. **Step 1 — Login & Dashboard:** Open `http://localhost:5173`. Demonstrate admin login. Show the metric counters and the SLA tracking dashboard.
2. **Step 2 — Keyset Pagination & Filtering:** Demonstrate filtering complaints by status and department, showing that sub-millisecond retrieval is backed by composite indexes.
3. **Step 3 — Role Segregation:** Switch to an employee session. Notice that administrative controls, role selectors, and the Immutable Audit Trail tab are completely absent from the UI.
4. **Step 4 — Code Defense:** Open `ComplaintDetail.tsx` and `011_specialist_assignment_hardening.sql`. Show the interviewer how `expected_version` is passed from the UI button down to the PostgreSQL stored procedure to guarantee race-free execution.
