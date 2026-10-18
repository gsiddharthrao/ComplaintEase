# ComplaintEase Enterprise — System Architecture

ComplaintEase is an enterprise incident management and complaint tracking platform designed around **defense-in-depth security**, **hybrid concurrency locking (OCC + Row Locks)**, **database-enforced Row-Level Security (RLS)**, and **tamper-resistant audit logging**.

---

## 1. High-Level System Architecture

The application is structured into four primary tiers:
1. **Presentation Tier (`apps/web`):** React 18, Vite, TypeScript, Tailwind CSS, TanStack Query v5, React Hook Form, and Supabase Realtime client.
2. **Application Tier (`apps/api`):** Node.js 20, Express, TypeScript, Zod, Pino logging, Helmet security headers, and express-rate-limit.
3. **Shared Contract Tier (`packages/shared`):** Canonical TypeScript enums, interfaces, and Zod validation schemas shared across web and API.
4. **Data & Storage Tier (`supabase/migrations`):** PostgreSQL 15, GoTrue Auth, Row-Level Security (RLS) policies, stored procedures (`transition_complaint`, `assign_specialist`), append-only audit triggers, and private storage buckets.

```mermaid
flowchart TD
    subgraph PresentationTier["Presentation Tier (apps/web — React 18 + Vite)"]
        UI["Tailwind CSS + Lucide Icons + Dark/Light Theme"]
        QueryCache["TanStack Query Cache & De-duplication"]
        Router["React Router v6 (<ProtectedRoute>)"]
        AuthContext["AuthContext (Supabase Auth Client)"]
        RealtimeHook["useRealtime (WebSocket CDC Subscriber)"]
    end

    subgraph IngressTier["Ingress & Edge Tier"]
        VercelCDN["Vercel Edge (Frontend Hosting)"]
        ReverseProxy["Reverse Proxy / SSL Termination"]
        RateLimiter["Tiered Rate Limiting (express-rate-limit)"]
    end

    subgraph ApplicationTier["Application Tier (apps/api — Node 20 / Express)"]
        SecHeaders["Helmet Security Headers & CORS Allowlist"]
        AuthGuard["requireAuth & requireRole Middleware"]
        Validator["Zod Schema Validation (validateBody / Query)"]
        RouteHandlers["Versioned Route Controllers (/api/v1)"]
        ClientFactory["createUserClient(jwt) (Per-Request Scoped)"]
    end

    subgraph DataTier["Data & Security Tier (PostgreSQL 15 / Supabase)"]
        AuthEngine["Supabase GoTrue (JWT Issuance & Verification)"]
        RLSEngine["PostgreSQL Row Level Security (Database Boundary)"]
        RelationalTables["Core 3NF Relational Tables (complaints, comments)"]
        FSM["transition_complaint() (FOR UPDATE + OCC Version)"]
        AssignRPC["assign_specialist() (Atomic Assignment & OCC)"]
        AuditTriggers["Tamper-Proof Audit Triggers (audit_logs)"]
        StorageEngine["Supabase Storage (attachments bucket)"]
        RealtimeEngine["Supabase Realtime (Postgres CDC Publication)"]
    end

    UI --> QueryCache
    QueryCache -->|REST API Requests| ReverseProxy
    ReverseProxy --> RateLimiter
    RateLimiter --> SecHeaders
    SecHeaders --> AuthGuard
    AuthGuard --> Validator
    Validator --> RouteHandlers
    RouteHandlers --> ClientFactory
    ClientFactory -->|Caller Token| RLSEngine
    RLSEngine --> RelationalTables
    RouteHandlers -->|RPC Call| FSM
    RouteHandlers -->|RPC Call| AssignRPC
    FSM --> RelationalTables
    AssignRPC --> RelationalTables
    RelationalTables --> AuditTriggers
    RelationalTables --> RealtimeEngine
    RealtimeEngine -.->|Push Notifications| RealtimeHook
    RealtimeHook --> QueryCache
    UI -->|Signed Upload/Download URLs| StorageEngine
```

---

## 2. Authentication & Authorization Flow

Authentication and token verification follow a zero-trust model:
1. User logs in directly against Supabase GoTrue Auth.
2. Web client stores access and refresh tokens in memory/local storage and transmits the JWT via `Authorization: Bearer <token>`.
3. Express `requireAuth` verifies the token with Supabase and extracts the user profile.
4. Express `requireRole` checks the user role at the perimeter for fast rejection (403).
5. All database operations execute through a user-scoped Supabase client (`createUserClient(token)`), activating PostgreSQL `auth.uid()` and RLS policies.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant Auth as Supabase Auth (GoTrue)
    participant API as Express API (/api/v1)
    participant DB as PostgreSQL + RLS

    User->>Auth: signInWithPassword(email, password)
    Auth-->>User: Returns JWT access_token + refresh_token
    Note over User: JWT payload contains user UUID (sub)

    User->>API: GET /api/v1/complaints (Bearer JWT)
    Note over API: requireAuth extracts Bearer token

    API->>Auth: supabase.auth.getUser(token)
    Auth-->>API: Valid user payload (ID, email)

    API->>API: Fetch caller profile role from profiles table
    API->>API: requireRole checks endpoint permission

    API->>API: createUserClient(token)
    Note over API: Client headers set Authorization: Bearer JWT

    API->>DB: SELECT * FROM complaints WHERE ...
    Note over DB: Postgres inspects auth.uid() and current_user_role()
    Note over DB: Evaluates complaints_select_employee RLS policy
    DB-->>API: Returns strictly authorized rows
    API-->>User: 200 OK with sanitized complaint payload
```

---

## 3. Canonical Complaint Lifecycle (State Machine)

The complaint state machine is strictly defined in `@complaintease/shared` (`ALLOWED_TRANSITIONS`) and enforced in PostgreSQL (`allowed_transitions` table and `transition_complaint` RPC).
- Contains exactly **23 valid status transitions**.
- `closed` and `rejected` are **strictly terminal** (0 outgoing transitions).
- Direct table updates (`UPDATE complaints SET status = ...`) are rejected by trigger `trg_block_direct_status_update`.

```mermaid
stateDiagram-v2
    [*] --> submitted: Employee Files Complaint

    submitted --> under_review: Dept Head / Admin Review
    submitted --> rejected: Dept Head / Admin Rejection

    under_review --> assigned: Admin Assigns Specialist
    under_review --> rejected: Dept Head / Admin Rejection

    assigned --> in_progress: Specialist Starts Work
    assigned --> rejected: Admin Rejection

    in_progress --> resolved: Specialist Marks Resolved
    in_progress --> rejected: Admin Rejection

    resolved --> closed: Admin Closes Ticket
    resolved --> reopened: Creator Reopens Ticket

    reopened --> in_progress: Specialist / Admin Resumes Work
    reopened --> rejected: Admin Rejection

    closed --> [*]: Terminal State
    rejected --> [*]: Terminal State
```

---

## 4. Admin Assignment & Specialist Incident Resolution Sequence

This flow illustrates the end-to-end operational collaboration between an administrator, an assigned specialist, and the complaint creator:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrator
    actor Specialist as Field Specialist (Employee)
    participant API as Express API
    participant RPC as assign_specialist / transition_complaint
    participant DB as PostgreSQL Database
    participant CDC as Realtime CDC Engine

    Admin->>API: POST /api/v1/complaints/:id/assign { assigned_to, expected_version: 1 }
    API->>RPC: SELECT assign_specialist(id, target_emp_id, 'Assigned to HVAC tech', 1)
    Note over RPC: Locks row with FOR UPDATE
    Note over RPC: Verifies caller is admin (42501)
    Note over RPC: Verifies target role = 'employee' (P0004)
    Note over RPC: Deactivates old assignments (is_active = false)
    Note over RPC: Inserts new active assignment (is_active = true)
    Note over RPC: Updates status to 'assigned', bumps version to 2
    RPC->>DB: Commit transaction
    DB->>CDC: Emit UPDATE on complaints table
    CDC-->>Specialist: WebSocket push: complaint status changed to 'assigned'

    Specialist->>API: GET /api/v1/complaints?filter=assigned
    API-->>Specialist: Complaint visible under "Assigned to Me" (via is_complaint_assigned_to_user)

    Specialist->>API: POST /api/v1/complaints/:id/transition { new_status: 'in_progress', expected_version: 2 }
    API->>RPC: SELECT transition_complaint(id, 'in_progress', 'Started diagnostic', 2)
    Note over RPC: Verifies specialist is active assignee
    Note over RPC: Updates status to 'in_progress', bumps version to 3
    RPC-->>API: Returns { version: 3, new_version: 3 }
    API-->>Specialist: 200 OK

    Specialist->>API: POST /api/v1/complaints/:id/transition { new_status: 'resolved', expected_version: 3 }
    API->>RPC: SELECT transition_complaint(id, 'resolved', 'Filter replaced', 3)
    Note over RPC: Sets resolved_at = now(), bumps version to 4
    RPC-->>API: Returns { version: 4, new_version: 4 }
    API-->>Specialist: 200 OK
    DB->>CDC: Emit status_changed notification to Creator
```

---

## 5. Attachment Upload & Storage Access-Control Flow

Attachments follow a two-phase signed storage architecture to prevent storing binary data in the relational database while strictly checking ownership and file integrity:

```mermaid
sequenceDiagram
    autonumber
    actor User as Authenticated User
    participant API as Express API
    participant Storage as Supabase Storage (attachments)
    participant DB as PostgreSQL (attachments table)

    User->>API: POST /api/v1/complaints/:id/attachments/upload-url { file_name, file_size, mime_type }
    Note over API: Validates complaint access via RLS
    Note over API: Generates storage path: <user_id>/<complaint_id>/<uuid>.<ext>
    API->>Storage: createSignedUploadUrl(storage_path)
    Storage-->>API: Signed upload URL & token
    API-->>User: 200 OK with upload URL & storage_path

    User->>Storage: PUT <signed_upload_url> (binary file payload)
    Storage-->>User: 200 Upload Successful

    User->>API: POST /api/v1/complaints/:id/attachments { file_name, file_size, mime_type, storage_path }
    Note over API: 1. Verifies complaint access
    Note over API: 2. Verifies path starts with <user_id>/<complaint_id>/
    Note over API: 3. Verifies extension matches declared MIME type
    Note over API: 4. Inspects stored object metadata (size <= 10MB)
    API->>DB: INSERT INTO attachments (complaint_id, uploaded_by, storage_path, ...)
    DB-->>API: Attachment metadata record
    API-->>User: 201 Created

    User->>API: GET /api/v1/complaints/:id/attachments
    API->>DB: SELECT * FROM attachments WHERE complaint_id = :id (Scoped by RLS)
    API->>Storage: createSignedUrl(storage_path, 3600)
    API-->>User: Returns attachment metadata with 1-hour private signed download URLs
```

---

## 6. Deployment Topology & Environments

ComplaintEase defines clear boundaries across development, staging, and production:

```mermaid
flowchart LR
    subgraph LocalEnv["Local Development Environment"]
        DevWeb["Vite Dev Server (:5173)"]
        DevAPI["Express Dev Server (:3000)"]
        LocalSupabase["Supabase CLI / Local Docker (:54321 / :54322)"]
        DevWeb --> DevAPI
        DevAPI --> LocalSupabase
    end

    subgraph ProdEnv["Production Environment (Live Cloud)"]
        VercelProd["Vercel Edge (React SPA)"]
        RenderProd["Render Web Service (Express Docker)"]
        SupabaseProd["Supabase Managed Cloud (kdsjbdxtakgslextabpi)"]
        VercelProd -->|HTTPS| RenderProd
        RenderProd -->|TLS / PgBouncer| SupabaseProd
        VercelProd -->|WSS / Realtime| SupabaseProd
    end

    subgraph CI["GitHub Actions CI/CD Pipeline"]
        Runner["ubuntu-latest Runner"]
        Steps["pnpm install --frozen-lockfile<br>shared build<br>typecheck<br>automated tests (163)<br>production build"]
        Runner --> Steps
    end
```

---

## 7. Key Architecture Invariants

1. **Database as the Absolute Security Boundary:** The API layer provides fast parameter validation and RBAC guards, but PostgreSQL Row Level Security (RLS) is the non-bypassable barrier. Non-admin users cannot access unassigned or third-party complaints, even if API code is modified.
2. **Deterministic State Progression:** No application role can transition tickets out of order, jump from closed/rejected, or execute raw status updates.
3. **Optimistic Concurrency Control (OCC):** Every mutating operation on complaints requires `expected_version`. Stale concurrent requests fail fast with HTTP 409 Conflict without causing database state corruption.
4. **Immutable Audit Trail:** Audited events are captured in `audit_logs` by database triggers and cannot be updated or deleted even by database administrators.
