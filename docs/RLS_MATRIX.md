# Row Level Security (RLS) Permission Matrix

In ComplaintEase, PostgreSQL **Row Level Security (RLS)** provides the database-level authorization boundary. Even if an application-layer check is bypassed or misconfigured, PostgreSQL enforces row access filters directly within the query execution plan.

All policies utilize the `SECURITY DEFINER` helper functions `current_user_role()` and `current_user_dept()` to avoid recursive policy evaluations during profile lookups.

---

## Complete Role × Table × Operation Matrix

| Table | Operation | Role: `employee` (Creator / Regular) | Role: `employee` (Assigned Specialist) | Role: `admin` |
|---|---|---|---|---|
| **`departments`** | **SELECT** | Allowed (All) | Allowed (All) | Allowed (All) |
| | **INSERT** | Forbidden | Forbidden | Allowed |
| | **UPDATE** | Forbidden | Forbidden | Allowed |
| | **DELETE** | Forbidden | Forbidden | Allowed (RESTRICT if referenced) |
| **`profiles`** | **SELECT** | Allowed (All, for name lookups) | Allowed (All) | Allowed (All) |
| | **INSERT** | Trigger Only (`auth.users`) | Trigger Only | Trigger / Admin API |
| | **UPDATE** | Own profile only (`id = auth.uid()`, **sensitive column modification blocked via trigger `trg_protect_profile_sensitive_columns` (42501)** for `role`, `department_id`, `id`, `created_at`) | Same as regular employee | Allowed (All profiles & roles) |
| | **DELETE** | Forbidden | Forbidden | Allowed (CASCADE via auth) |
| **`categories`** | **SELECT** | Allowed (All) | Allowed (All) | Allowed (All) |
| | **INSERT** | Forbidden | Forbidden | Allowed |
| | **UPDATE** | Forbidden | Forbidden | Allowed |
| | **DELETE** | Forbidden | Forbidden | Allowed |
| **`complaints`** | **SELECT** | Own complaints only (`created_by = auth.uid()`) | Assigned complaints (`is_complaint_assigned_to_user(id)`) | Allowed (All complaints) |
| | **INSERT** | Allowed (`created_by = auth.uid()`) | Allowed (`created_by = auth.uid()`) | Allowed (`created_by = auth.uid()`) |
| | **UPDATE** | Forbidden (Creator can reopen via `transition_complaint()`) | Forbidden (Specialist can advance via `transition_complaint()`) | Allowed (Non-status attributes) |
| | **DELETE** | **Forbidden** (Data retention policy) | **Forbidden** | **Forbidden** |
| **`assignments`** | **SELECT** | Assignments on own complaints | Assignments where `assigned_to = auth.uid()` | Allowed (All) |
| | **INSERT** | Forbidden | Forbidden | Allowed (All / via `assign_specialist`) |
| | **UPDATE** | Forbidden | Forbidden | Allowed (All / via `assign_specialist`) |
| | **DELETE** | Forbidden | Forbidden | Allowed |
| **`comments`** | **SELECT** | Own complaints, **external only** (`is_internal = false`) | Assigned complaints, **external only** (`is_internal = false`) | Allowed (All comments, including internal) |
| | **INSERT** | On own complaints (`is_internal = false`) | On assigned complaints (`is_internal = false`) | On any complaint (Internal allowed) |
| | **UPDATE** | Own comments only | Own comments only | Own comments only |
| | **DELETE** | Own comments only | Own comments only | Allowed (All comments) |
| **`attachments`** | **SELECT** | Attachments on own complaints | Attachments on assigned complaints | Allowed (All) |
| | **INSERT** | Allowed on own complaints | Allowed on assigned complaints | Allowed (All) |
| | **UPDATE** | Forbidden | Forbidden | Forbidden |
| | **DELETE** | Own attachments only | Own attachments only | Allowed (All) |
| **`status_history`** | **SELECT** | History on own complaints | History on assigned complaints | Allowed (All) |
| | **INSERT** | Trigger / Function Only (`trg_complaint_initial_history`, `transition_complaint`) | Function Only (`transition_complaint`) | Trigger / Function Only |
| | **UPDATE** | **Forbidden** (Append-only) | **Forbidden** | **Forbidden** |
| | **DELETE** | **Forbidden** | **Forbidden** | **Forbidden** |
| **`audit_logs`** | **SELECT** | Forbidden | Forbidden | Allowed (Forensic audit viewing) |
| | **INSERT** | Trigger Only (`audit_trigger_fn`) | Trigger Only | Trigger Only |
| | **UPDATE** | **Forbidden** (Trigger P0006) | **Forbidden** | **Forbidden** |
| | **DELETE** | **Forbidden** | **Forbidden** | **Forbidden** |
| **`notifications`** | **SELECT** | Own notifications (`user_id = auth.uid()`) | Own notifications (`user_id = auth.uid()`) | Own notifications (`user_id = auth.uid()`) |
| | **INSERT** | Function / Trigger Only | Function / Trigger Only | Function / Trigger Only |
| | **UPDATE** | Own notifications (mark read) | Own notifications (mark read) | Own notifications (mark read) |
| | **DELETE** | Forbidden | Forbidden | Forbidden |

---

## Storage Objects (`storage.objects`) Policy Matrix

Supabase Storage files are isolated in the private bucket `attachments` under canonical paths `<user_id>/<complaint_id>/<filename>` or `<complaint_id>/<filename>`. Migration 011 grants both the incident creator and the designated specialist read/write privileges:

| Bucket & Path | Operation | Role: `employee` (Creator) | Role: `employee` (Specialist) | Role: `admin` |
|---|---|---|---|---|
| `attachments/<user_id>/<complaint_id>/*` or `attachments/<complaint_id>/*` | **SELECT** | Allowed if `is_complaint_creator(complaint_id)` | Allowed if `is_complaint_assigned_to_user(complaint_id)` | Allowed (All objects) |
| | **INSERT** | Allowed if `is_complaint_creator(complaint_id)` | Allowed if `is_complaint_assigned_to_user(complaint_id)` | Allowed (All objects) |
| | **UPDATE** | Forbidden | Forbidden | Forbidden |
| | **DELETE** | Allowed if path owner = `auth.uid()` | Allowed if path owner = `auth.uid()` | Allowed (All objects) |

---

## Key Architectural Principles

1. **Deny by Default:** Every table executes `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`. If no policy matches an operation, PostgreSQL rejects the query immediately.
2. **Non-Recursive Security Definer Helpers:**
   - Circular evaluation loops (e.g. `complaints` querying `assignments` while `assignments` queries `complaints`) are prevented by non-recursive helper functions:
     - `is_complaint_assigned_to_user(p_complaint_id UUID)`: reads `assignments` with `auth.uid()` without triggering `complaints` RLS.
     - `is_complaint_creator(p_complaint_id UUID)`: reads `complaints.created_by` without triggering policy cascade.
     - Both functions execute with `SECURITY DEFINER`, `SET search_path = public`, `STABLE`, and are granted to `authenticated` and `service_role`.
3. **Sensitive Profile Column Protection (`trg_protect_profile_sensitive_columns`):** Even though employees possess `UPDATE` permissions on their own profile row, a `BEFORE UPDATE` trigger on `profiles` (`protect_profile_sensitive_columns()`) raises SQLSTATE `42501` whenever a non-admin attempts to mutate sensitive columns (`role`, `department_id`, `id`, or `created_at`). Non-admin users are strictly restricted to updating benign self-service fields (`full_name`, `avatar_url`, `updated_at`).
4. **Autonomous Initial History Creation (`trg_complaint_initial_history`):** Initial complaint status tracking is handled by an `AFTER INSERT` trigger on `complaints` executing `record_initial_complaint_status_history()`. This eliminates the need for Express API handlers to use `getAdminClient()` for initial history writes.
5. **Tamper-Resistant Audit Logging:** The `audit_logs` and `status_history` tables have no application UPDATE or DELETE policies. Furthermore, trigger `trg_protect_audit_logs` executes `prevent_audit_tampering()` to raise error `P0006` on any attempted UPDATE or DELETE, providing tamper resistance against application-layer modifications.
6. **Unified Attachments INSERT Authorization (SEC-01):** To prevent duplicate permissive policies and preserve admin upload capabilities, Migration 011 unifies `attachments` insertion under a single `"attachments_insert_authenticated"` policy. Legacy variants (`attachments_insert`, `attachments_insert_employee`) are dropped. The policy requires `uploaded_by = auth.uid()` and authorizes admins or employees who either created the complaint or are actively assigned to it via non-recursive security-definer helpers.
7. **Guarded Storage Scoped Evaluation & Path Disambiguation (SEC-03):** Supabase Storage policies (`storage_insert_scoped`, `storage_select_scoped`, `storage_delete_scoped`) enforce:
   - Case-insensitive UUID matching (`~*`) for uppercase/lowercase client UUID strings.
   - Guarded `CASE WHEN ... ~* ... THEN ...::uuid ELSE false END` evaluation order to prevent PostgreSQL `22P02 invalid input syntax for type uuid` runtime errors on malformed object keys.
   - Strict segment count differentiation: 3-part canonical paths require `split_part(name, '/', 3) <> '' AND split_part(name, '/', 4) = ''`, while 2-part legacy paths require `split_part(name, '/', 2) <> '' AND split_part(name, '/', 3) = ''`, eliminating path collision between user UIDs and complaint IDs.
