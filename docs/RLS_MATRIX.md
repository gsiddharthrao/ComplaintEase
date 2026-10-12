# Row Level Security (RLS) Permission Matrix

In ComplaintEase, PostgreSQL **Row Level Security (RLS)** provides the database-level authorization boundary. Even if an application-layer check is bypassed or misconfigured, PostgreSQL enforces row access filters directly within the query execution plan.

All policies utilize the `SECURITY DEFINER` helper functions `current_user_role()` and `current_user_dept()` to avoid recursive policy evaluations during profile lookups.

---

## Complete Role × Table × Operation Matrix

| Table | Operation | Role: `employee` | Role: `admin` |
|---|---|---|---|
| **`departments`** | **SELECT** | Allowed (All) | Allowed (All) |
| | **INSERT** | Forbidden | Allowed |
| | **UPDATE** | Forbidden | Allowed |
| | **DELETE** | Forbidden | Allowed (RESTRICT if referenced) |
| **`profiles`** | **SELECT** | Allowed (All, for name lookups) | Allowed (All) |
| | **INSERT** | Trigger Only (`auth.users`) | Trigger / Admin API |
| | **UPDATE** | Own profile only (`id = auth.uid()`, **sensitive column modification blocked via trigger `trg_protect_profile_sensitive_columns` (42501)** for `role`, `department_id`, `id`, `created_at`) | Allowed (All profiles & roles) |
| | **DELETE** | Forbidden | Allowed (CASCADE via auth) |
| **`categories`** | **SELECT** | Allowed (All) | Allowed (All) |
| | **INSERT** | Forbidden | Allowed |
| | **UPDATE** | Forbidden | Allowed |
| | **DELETE** | Forbidden | Allowed |
| **`complaints`** | **SELECT** | Own complaints only (`created_by = auth.uid()`) | Allowed (All complaints) |
| | **INSERT** | Allowed (`created_by = auth.uid()`) | Allowed (`created_by = auth.uid()`) |
| | **UPDATE** | Forbidden (Status via `transition_complaint()`) | Allowed (Non-status attributes) |
| | **DELETE** | **Forbidden** (Data retention policy) | **Forbidden** |
| **`assignments`** | **SELECT** | Assignments on own complaints | Allowed (All) |
| | **INSERT** | Forbidden | Allowed (All / via `assign_specialist`) |
| | **UPDATE** | Forbidden | Allowed (All / via `assign_specialist`) |
| | **DELETE** | Forbidden | Allowed |
| **`comments`** | **SELECT** | Own complaints, **non-internal only** (`is_internal = false`) | Allowed (All comments, including internal) |
| | **INSERT** | On own complaints (`is_internal = false`) | On any complaint (Internal allowed) |
| | **UPDATE** | Own comments only | Own comments only |
| | **DELETE** | Own comments only | Allowed (All comments) |
| **`attachments`** | **SELECT** | Attachments on own complaints | Allowed (All) |
| | **INSERT** | Allowed on own complaints | Allowed (All) |
| | **UPDATE** | Forbidden | Forbidden |
| | **DELETE** | Own attachments only | Allowed (All) |
| **`status_history`** | **SELECT** | History on own complaints | Allowed (All) |
| | **INSERT** | Trigger / Function Only (`trg_complaint_initial_history`, `transition_complaint`) | Trigger / Function Only |
| | **UPDATE** | **Forbidden** (Append-only) | **Forbidden** |
| | **DELETE** | **Forbidden** | **Forbidden** |
| **`audit_logs`** | **SELECT** | Forbidden | Allowed (Forensic audit viewing) |
| | **INSERT** | Trigger Only (`audit_trigger_fn`) | Trigger Only |
| | **UPDATE** | **Forbidden** (Trigger P0006) | **Forbidden** |
| | **DELETE** | **Forbidden** | **Forbidden** |
| **`notifications`** | **SELECT** | Own notifications (`user_id = auth.uid()`) | Own notifications (`user_id = auth.uid()`) |
| | **INSERT** | Function / Trigger Only | Function / Trigger Only |
| | **UPDATE** | Own notifications (mark read) | Own notifications (mark read) |
| | **DELETE** | Forbidden | Forbidden |

---

## Storage Objects (`storage.objects`) Policy Matrix

Supabase Storage files are isolated in the private bucket `attachments` under the canonical path convention `<user_id>/<complaint_id>/<filename>` (with backward-compatible support for `<complaint_id>/<filename>`):

| Bucket & Path | Operation | Role: `employee` | Role: `admin` |
|---|---|---|---|
| `attachments/<user_id>/<complaint_id>/*` | **SELECT** | Allowed if `complaints.created_by = auth.uid()` | Allowed (All objects) |
| | **INSERT** | Allowed if path segment 1 = `auth.uid()` AND `complaints.created_by = auth.uid()` | Allowed (All objects) |
| | **UPDATE** | Forbidden | Forbidden |
| | **DELETE** | Allowed if path segment 1 = `auth.uid()` AND `complaints.created_by = auth.uid()` | Allowed (All objects) |

---

## Key Architectural Principles

1. **Deny by Default:** Every table executes `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`. If no policy matches an operation, PostgreSQL rejects the query immediately.
2. **Security Definer Function Bypass:** In policies where subqueries check `profiles`, calling `current_user_role()` prevents recursive policy execution loops.
3. **Sensitive Profile Column Protection (`trg_protect_profile_sensitive_columns`):** Even though employees possess `UPDATE` permissions on their own profile row, a `BEFORE UPDATE` trigger on `profiles` (`protect_profile_sensitive_columns()`) raises SQLSTATE `42501` whenever a non-admin attempts to mutate sensitive columns (`role`, `department_id`, `id`, or `created_at`). Non-admin users are strictly restricted to updating benign self-service fields (`full_name`, `avatar_url`, `updated_at`).
4. **Autonomous Initial History Creation (`trg_complaint_initial_history`):** Initial complaint status tracking is handled by an `AFTER INSERT` trigger on `complaints` executing `record_initial_complaint_status_history()`. This eliminates the need for Express API handlers to use `getAdminClient()` for initial history writes.
5. **Tamper-Resistant Audit Logging:** The `audit_logs` and `status_history` tables have no application UPDATE or DELETE policies. Furthermore, trigger `trg_protect_audit_logs` executes `prevent_audit_tampering()` to raise error `P0006` on any attempted UPDATE or DELETE, providing tamper resistance against application-layer modifications.
