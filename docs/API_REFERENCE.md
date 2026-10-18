# ComplaintEase Enterprise — API Reference

This reference documents the versioned Express REST API routes (`/api/v1`) and root deployment endpoints. All endpoints require JSON request payloads where applicable and return JSON envelopes.

---

## 1. Global Standards & Conventions

### Base URLs
- Local Development: `http://localhost:3000`
- API Version Prefix: `/api/v1`
- Root Healthcheck Alias: `/health`

### Authentication Headers
All protected routes require an `Authorization` header containing a valid Supabase GoTrue JWT:
```http
Authorization: Bearer <supabase_access_token>
```

### Common Error Envelope
All error responses adhere to the standard error shape:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of error",
    "requestId": "req-uuid-1234",
    "details": [] // Optional Zod validation issues
  }
}
```

### Concurrency & Version Headers
Every mutating operation on complaints requires `expected_version` in the request body. If the record's version in PostgreSQL does not equal `expected_version`, the server returns `409 Conflict` (`P0003`).

---

## 2. Health & System Endpoints

### `GET /health` & `GET /api/v1/health`
- **Purpose:** Verifies API liveness and database connectivity.
- **Auth:** Public (No token required).
- **Success Response (`200 OK`):**
  ```json
  {
    "status": "healthy",
    "uptime": 142.5,
    "timestamp": "2026-10-18T20:00:00.000Z",
    "database": {
      "status": "ok",
      "latencyMs": 14
    }
  }
  ```
- **Degraded Response (`503 Service Unavailable`):**
  Returned if database query exceeds timeout (3s) or fails.

---

## 3. Authentication Endpoints (`/api/v1/auth`)

### `POST /api/v1/auth/register`
- **Purpose:** Registers a new employee account in Supabase GoTrue and creates a public profile row.
- **Auth:** Public (Rate-limited to 50 requests/15m).
- **Request Body (`registerSchema`):**
  ```json
  {
    "email": "employee@example.com",
    "password": "Password123!",
    "full_name": "Jane Doe",
    "department_id": "11111111-1111-1111-1111-111111111111" // Optional
  }
  ```
- **Security Rule:** Any `role` passed in request payload is strictly ignored; public registration unconditionally grants `'employee'`.
- **Response (`201 Created`):**
  ```json
  {
    "user": { "id": "uuid", "email": "employee@example.com" },
    "profile": { "id": "uuid", "full_name": "Jane Doe", "role": "employee" }
  }
  ```

### `GET /api/v1/auth/me`
- **Purpose:** Returns profile and role information for the currently authenticated user.
- **Auth:** `requireAuth` (Any authenticated user).
- **Response (`200 OK`):**
  ```json
  {
    "id": "user-uuid",
    "email": "employee@example.com",
    "profile": {
      "id": "user-uuid",
      "full_name": "Jane Doe",
      "role": "employee",
      "department_id": "dept-uuid",
      "avatar_url": null,
      "created_at": "2026-10-18T10:00:00Z",
      "updated_at": "2026-10-18T10:00:00Z"
    }
  }
  ```

---

## 4. Complaints Endpoints (`/api/v1/complaints`)

### `GET /api/v1/complaints`
- **Purpose:** Lists complaints with filtering and keyset pagination.
- **Auth:** `requireAuth`.
- **Query Parameters (`listComplaintsSchema`):**
  - `status`: Filter by `ComplaintStatus`
  - `priority`: Filter by `ComplaintPriority`
  - `category_id`: UUID
  - `department_id`: UUID
  - `filter`: `'assigned'` (returns complaints assigned to caller)
  - `cursor`: Keyset pagination cursor (`<created_at>__<id>`)
  - `limit`: Number of records (1–100, default 20)
- **RLS Boundary:**
  - Employees only receive complaints they created OR complaints actively assigned to them.
  - Department heads receive complaints matching their department.
  - Admins receive all complaints.
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "title": "HVAC unit leaking in Plant B",
        "description": "Noticeable coolant puddle under Unit 4.",
        "status": "assigned",
        "priority": "high",
        "created_by": "user-uuid",
        "version": 2,
        "created_at": "2026-10-18T12:00:00Z",
        "category": { "id": "uuid", "name": "Facility Maintenance" },
        "department": { "id": "uuid", "name": "Operations" },
        "assigned_to": { "id": "specialist-uuid", "full_name": "John Specialist" }
      }
    ],
    "next_cursor": "2026-10-18T12:00:00Z__uuid",
    "total_count": 1
  }
  ```

### `POST /api/v1/complaints`
- **Purpose:** Creates a new complaint.
- **Auth:** `requireAuth` (Any authenticated user).
- **Request Body (`createComplaintSchema`):**
  ```json
  {
    "title": "Conveyor Belt Motor Overheating",
    "description": "Temperature probe reading 95C on line 2 conveyor drive.",
    "category_id": "uuid",
    "department_id": "uuid",
    "priority": "high"
  }
  ```
- **Atomicity:** Automatically executes trigger `trg_complaint_initial_history` in PostgreSQL, creating the initial `'submitted'` record in `status_history`.
- **Response (`201 Created`):** Returns the created complaint record with `version = 1`.

### `GET /api/v1/complaints/:id`
- **Purpose:** Fetches full details for a single complaint.
- **Auth:** `requireAuth`.
- **Response (`200 OK`):** Enriched complaint object.
- **Error (`404 Not Found`):** Returned if the complaint does not exist or if caller's RLS policy evaluates to 0 rows.

### `POST /api/v1/complaints/:id/assign`
- **Purpose:** Assigns a field specialist (employee) to the complaint.
- **Auth:** `requireAuth` + `requireRole(['admin'])`.
- **Request Body (`assignSpecialistSchema`):**
  ```json
  {
    "assigned_to": "specialist-employee-uuid",
    "note": "Assigned to primary plant electrical specialist.",
    "expected_version": 1
  }
  ```
- **RPC Contract (`assign_specialist`):**
  - Locks complaint row with `FOR UPDATE`.
  - Rejects terminal complaints (`closed`, `rejected`) with `400` (`P0001`).
  - Rejects target assignees with `role != 'employee'` with `400` (`P0004`).
  - Rejects stale `expected_version` with `409 Conflict` (`P0003`).
  - Deactivates previous active assignments, inserts new assignment, updates status to `'assigned'`, and bumps version.
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "success": true,
      "complaint_id": "uuid",
      "assigned_to": "specialist-employee-uuid",
      "version": 2
    }
  }
  ```

### `POST /api/v1/complaints/:id/transition`
- **Purpose:** Advances the complaint state through the deterministic finite state machine.
- **Auth:** `requireAuth` (Role-specific permissions enforced by PostgreSQL `transition_complaint`).
- **Request Body (`transitionSchema`):**
  ```json
  {
    "new_status": "in_progress",
    "note": "Commencing on-site diagnostic.",
    "expected_version": 2
  }
  ```
- **State Transition Rules:**
  - Active assigned specialist: permitted transitions are `assigned -> in_progress` and `in_progress -> resolved`.
  - Complaint creator: permitted transition is strictly `resolved -> reopened`.
  - Admin: management transitions including `under_review`, `closed`, and `rejected`.
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "success": true,
      "complaint_id": "uuid",
      "status": "in_progress",
      "version": 3,
      "new_version": 3
    }
  }
  ```
- **Errors:**
  - `400 Bad Request` (`P0001`): Invalid transition for current status.
  - `403 Forbidden` (`P0004` / `42501`): Caller not authorized for this transition.
  - `409 Conflict` (`P0003`): Version conflict (record modified by another user).

---

## 5. Comments Endpoints (`/api/v1/complaints/:id/comments`)

### `GET /api/v1/complaints/:id/comments`
- **Purpose:** Fetches the threaded discussion for a complaint.
- **Auth:** `requireAuth`.
- **RLS Boundary:**
  - Employees (creator or assigned specialist) only receive rows where `is_internal = false`.
  - Department heads and Admins receive all comments including `is_internal = true`.
- **Response (`200 OK`):** Array of comment objects ordered by `created_at ASC`.

### `POST /api/v1/complaints/:id/comments`
- **Purpose:** Adds a new comment or internal note.
- **Auth:** `requireAuth`.
- **Request Body (`createCommentSchema`):**
  ```json
  {
    "body": "Replacement capacitor ordered, ETA 2 hours.",
    "is_internal": false
  }
  ```
- **Security Check:** Non-admins attempting `is_internal: true` are rejected by RLS `comments_insert`.

---

## 6. Attachments Endpoints (`/api/v1/complaints/:id/attachments`)

### `POST /api/v1/complaints/:id/attachments/upload-url`
- **Purpose:** Requests a signed upload URL to Supabase Storage.
- **Auth:** `requireAuth`.
- **Request Body (`uploadUrlSchema`):**
  ```json
  {
    "file_name": "diagnostic_log.pdf",
    "file_size": 245000,
    "mime_type": "application/pdf"
  }
  ```
- **Allowed MIME Types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`, `text/plain`, `application/msword`, `.docx`.
- **Response (`200 OK`):**
  ```json
  {
    "data": {
      "storage_path": "user-uuid/complaint-uuid/random-uuid.pdf",
      "upload_url": "https://<supabase>/storage/v1/object/upload/sign/attachments/...",
      "token": "signed-token"
    }
  }
  ```

### `POST /api/v1/complaints/:id/attachments`
- **Purpose:** Confirms successful file upload and registers metadata in PostgreSQL `attachments` table.
- **Auth:** `requireAuth`.
- **Request Body (`confirmAttachmentSchema`):**
  ```json
  {
    "file_name": "diagnostic_log.pdf",
    "file_size": 245000,
    "mime_type": "application/pdf",
    "storage_path": "user-uuid/complaint-uuid/random-uuid.pdf"
  }
  ```
- **Server-Side Validation:**
  - Verifies caller has access to complaint.
  - Verifies `storage_path` prefix matches `${req.user.id}/${complaint_id}/`.
  - Verifies file extension in path matches declared MIME type.
  - Inspects actual stored object metadata in Supabase Storage (`size <= 10MB`, size mismatch <= 1024 bytes).
- **Response (`201 Created`):** Inserted attachment record.

---

## 7. Admin Endpoints (`/api/v1/admin`)

### `GET /api/v1/admin/audit-logs`
- **Purpose:** Fetches immutable audit trail entries.
- **Auth:** `requireAuth` + `requireRole(['admin'])`.
- **Query Parameters:** `table_name`, `actor`, `limit` (default 50), `offset` (default 0).
- **Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "actor": "admin-uuid",
        "action": "UPDATE",
        "table_name": "complaints",
        "row_id": "complaint-uuid",
        "old_data": { "status": "assigned" },
        "new_data": { "status": "in_progress" },
        "created_at": "2026-10-18T14:00:00Z"
      }
    ],
    "total_count": 1
  }
  ```

### `PATCH /api/v1/admin/users/:id/role`
- **Purpose:** Updates a user's role or department.
- **Auth:** `requireAuth` + `requireRole(['admin'])`.
- **Security Check:** Prevents administrators from demoting their own role (`CANNOT_DEMOTE_SELF`).
