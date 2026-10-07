# Architectural Decision Records (ADRs)

This document captures every major engineering trade-off, architectural choice, and rejected alternative in ComplaintEase.

---

## ADR 1: Per-Request Scoped Supabase Client vs. Service-Role Admin Client

- **Decision:** Authenticated API requests instantiate a per-request Supabase client configured with the caller's JWT (`Authorization: Bearer <token>`). The `service_role` superuser key is strictly prohibited for serving end-user requests and restricted solely to background user provisioning.
- **Alternatives Rejected:**
  - *Single Global Service Client:* Using the service role key everywhere and relying solely on Express middleware `if (user.role !== 'admin')` checks.
- **Trade-offs & Rationale:**
  - *Pros:* Guarantees defense-in-depth. If an engineer forgets a route guard or writes a flawed WHERE clause, PostgreSQL RLS silently prevents unauthorized reads or writes.
  - *Cons:* Slightly higher memory allocation creating per-request client instances (sub-millisecond in V8).

---

## ADR 2: PostgreSQL Stored Function for Transitions vs. Node.js Application Logic

- **Decision:** State machine transitions, role enforcement, optimistic lock verification, and status history logging are encapsulated in the database function `transition_complaint()`. A database trigger raises SQLSTATE `P0005` on direct `UPDATE complaints SET status = ...`.
- **Alternatives Rejected:**
  - *Application-layer FSM:* Checking status transitions and versions purely inside Express handlers.
- **Trade-offs & Rationale:**
  - *Pros:* Guarantees transactional atomicity (ACID). No race condition can occur between status modification and history logging. Bypassing the API through direct SQL or third-party webhooks cannot violate business invariants.
  - *Cons:* Requires PL/pgSQL development and migrations rather than purely TypeScript code.

---

## ADR 3: Keyset Pagination vs. Offset-Based (`LIMIT / OFFSET`) Pagination

- **Decision:** Complaint list queries utilize keyset (cursor) pagination using composite cursors (`created_at__id`).
- **Alternatives Rejected:**
  - *Standard `LIMIT n OFFSET m`:* Traditional page-number pagination.
- **Trade-offs & Rationale:**
  - *Pros:* At 100,000+ or 1,000,000 rows, `OFFSET 50000` forces the database to read and discard 50,000 rows ($O(N)$ scanning time). Keyset pagination uses the index B-tree (`created_at < cursor`) to seek directly to the desired page in $O(\log N)$ time. Prevents duplicate rows or missed rows when items are added during scrolling.
  - *Cons:* Clients cannot jump directly to an arbitrary page number like "Page 47" without traversing previous cursors.

---

## ADR 4: Tamper-Proof Audit Triggers vs. Application Audit Logging

- **Decision:** The `audit_logs` table is populated via PostgreSQL `AFTER INSERT OR UPDATE OR DELETE` triggers using `row_to_json()` diffs. A `BEFORE UPDATE OR DELETE` trigger aborts any attempt to alter or delete audit rows (SQLSTATE `55000`).
- **Alternatives Rejected:**
  - *Express Middleware Audit Logger:* Logging changes by sending an insert to `audit_logs` after successful HTTP requests.
- **Trade-offs & Rationale:**
  - *Pros:* Application crashes or network disconnections cannot cause missing audit entries. Even superusers or malicious admins cannot alter the historical audit trail without destroying the table trigger.
  - *Cons:* Modest write overhead on high-frequency tables (mitigated in bulk seed by temporarily toggling the trigger).

---

## ADR 5: Avoiding N+1 Queries via PostgREST Relational Joins

- **Decision:** The API retrieves complaint lists with embedded foreign key relations (`category:categories(...)`, `department:departments(...)`, `creator:profiles(...)`, `assignments(...)`) in a single PostgREST query.
- **Alternatives Rejected:**
  - *Sequential Query Loops:* Fetching 20 complaints and executing separate queries in a `for` loop to look up categories and creators ($1 + 20 + 20 = 41$ queries).
- **Trade-offs & Rationale:**
  - *Pros:* Reduces database round-trips from $O(N)$ to exactly 1 query per HTTP request, slashing network latency and database connection pool saturation.
  - *Cons:* Complex SQL joins require proper composite foreign key indexes to prevent nested loop table scans.

---

## ADR 6: Virtualized Lists vs. Standard DOM Rendering for Large Datasets

- **Decision:** Long complaint listings utilize the custom `VirtualList` component which calculates windowed offsets and renders only the items visible in the viewport plus overscan buffer.
- **Alternatives Rejected:**
  - *Rendering all 1,000+ DOM nodes:* Standard `.map()` rendering of every list item into the DOM tree.
- **Trade-offs & Rationale:**
  - *Pros:* Keeps the active DOM node count under 50 elements regardless of dataset size, eliminating mobile browser scroll lag and maintaining 60 FPS interactions.
  - *Cons:* Requires a fixed item height calculation for accurate virtual scrollbar sizing.

---

## ADR 7: Two-Role Security Model (`employee` & `admin`) vs. Multi-Tier Role Hierarchy

- **Decision:** Streamlined system authorization to strictly two roles: `employee` (complaint creator) and `admin` (system-wide manager/operator).
- **Alternatives Rejected:**
  - *Three-Tier Model with `dept_head`:* Introducing intermediate departmental managers between regular staff and administrators.
- **Trade-offs & Rationale:**
  - *Pros:* Dramatically simplifies database RLS policy evaluation trees (eliminates nested department-boundary lookups per row) and prevents authorization deadlock when department heads transition between divisions. Administrators have centralized authority to assign specialists, triage tickets, and advance lifecycle transitions across all departments.
  - *Cons:* In organizations with thousands of staff, admin oversight may need to be delegated to specific departmental groups in future iterations.

