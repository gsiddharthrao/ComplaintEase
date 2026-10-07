# Row Level Security (RLS) Permission Matrix

In ComplaintEase, database-level **Row Level Security (RLS)** represents the non-negotiable security boundary. Even if the backend API layer suffers a bug or omission, PostgreSQL guarantees that a user cannot read, insert, update, or delete unauthorized records.

All policies utilize the `SECURITY DEFINER` helper functions `current_user_role()` and `current_user_dept()` to completely avoid infinite recursive policy evaluations.

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
| | **UPDATE** | Own profile only (`id = auth.uid()`) | Allowed (All profiles) |
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
| | **INSERT** | Forbidden | Allowed (All) |
| | **UPDATE** | Forbidden | Allowed (All) |
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
| | **INSERT** | Function Only (`transition_complaint`) | Function Only (`transition_complaint`) |
| | **UPDATE** | **Forbidden** (Append-only) | **Forbidden** |
| | **DELETE** | **Forbidden** | **Forbidden** |
| **`audit_logs`** | **SELECT** | Forbidden | Allowed (Read-only forensic audit) |
| | **INSERT** | Trigger Only (`process_audit_log`) | Trigger Only |
| | **UPDATE** | **Forbidden** (Append-only Trigger P0006) | **Forbidden** |
| | **DELETE** | **Forbidden** | **Forbidden** |
| **`notifications`** | **SELECT** | Own notifications (`user_id = auth.uid()`) | Own notifications (`user_id = auth.uid()`) |
| | **INSERT** | Function / Trigger Only | Function / Trigger Only |
| | **UPDATE** | Own notifications (mark read) | Own notifications (mark read) |
| | **DELETE** | Forbidden | Forbidden |

---

## Key Architectural Principles

1. **Deny by Default:** Every table executes `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`. If no policy matches an operation, PostgreSQL rejects the query immediately.
2. **Security Definer Function Bypass:** In policies where subqueries check `profiles`, calling `current_user_role()` prevents recursive policy execution loops.
3. **Immutability Protection:** The `audit_logs` and `status_history` tables have no UPDATE or DELETE policies for application users; trigger `trg_protect_audit_logs` raises an explicit exception `55000` even if someone attempts a direct SQL mutation.

