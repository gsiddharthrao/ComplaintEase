# 40 Technical Interview Questions & Answers Specific to ComplaintEase

This comprehensive guide is prepared specifically for CSE students defending this enterprise architecture in technical interviews.

---

## Category 1: System Design & Architecture

### 1. What is the high-level architecture of ComplaintEase, and why did you choose it?
> **Answer:** ComplaintEase is a modern full-stack web application structured as an isolated pnpm monorepo. It features a React 18 + Vite SPA presentation layer, a stateless Node 20 / Express application layer, and a PostgreSQL database layer managed through Supabase. The key design pattern is **defense-in-depth**: authentication and validation happen at the API layer, while the non-negotiable security boundary (Row Level Security and append-only triggers) is enforced directly inside the database engine.

### 2. Why use a monorepo instead of separate git repositories?
> **Answer:** Monorepos allow sharing TypeScript interfaces and Zod validation schemas across both frontend and backend through the `@complaintease/shared` package. This eliminates code drift, enables end-to-end type safety, guarantees that form validations in React match API validations in Express, and simplifies atomic CI/CD testing.

### 3. How does the request lifecycle work from browser click to database response?
> **Answer:**
> 1. The user triggers an action in the React UI (e.g. submitting a comment).
> 2. `api-client.ts` intercepts the request and injects the Supabase JWT `Bearer` token into the `Authorization` header.
> 3. Express middleware processes the request: `helmet` adds security headers, `cors` validates the origin, `rateLimit` checks IP quotas, and `requireAuth` validates the JWT.
> 4. `requireAuth` constructs a per-request Supabase client authenticated as that user.
> 5. Zod middleware validates request payloads.
> 6. PostgREST / PostgreSQL receives the query with the JWT claims set in session context (`request.jwt.claims`).
> 7. PostgreSQL evaluates RLS policies on the requested rows and executes the query using available composite indexes.
> 8. The JSON response flows back to the Express controller, through the error handler (if applicable), and into TanStack Query cache.

### 4. What is the difference between client-side route guards and database RLS?
> **Answer:** Client-side route guards (`<ProtectedRoute>`) are purely UX conveniences that redirect unauthorized users to their dashboard. Any user can manipulate client-side JavaScript or send raw HTTP requests via `curl`. In contrast, PostgreSQL **Row Level Security (RLS)** is an unbypassable kernel-level guarantee: regardless of what query or API endpoint is hit, PostgreSQL inspects the user's cryptographic identity (`auth.uid()`) and returns only authorized rows.

### 5. Why did you choose TanStack Query over Redux or Zustand for server state?
> **Answer:** Server state (complaints, comments, notifications) is fundamentally different from client UI state (modals, form inputs). Server state is asynchronous, shared, and can become stale. TanStack Query provides out-of-the-box caching, background revalidation (`staleTime`), deduping of concurrent requests, optimistic updates, and clean cache invalidation when Supabase Realtime WebSocket events arrive.

### 6. How does real-time communication work in ComplaintEase?
> **Answer:** It uses Supabase Realtime, which hooks into PostgreSQL's Logical Replication Change Data Capture (CDC) stream (`supabase_realtime` publication). When a row in `complaints` or `notifications` changes, PostgreSQL emits a write-ahead log event that Supabase's Realtime server broadcasts via WebSockets to connected browsers. The client hook `useRealtime` listens for these events and invalidates TanStack Query keys.

---

## Category 2: Database Schema & 3NF Normalization

### 7. How does this schema satisfy Third Normal Form (3NF)?
> **Answer:**
> - **1NF:** Every column contains atomic scalar values (no CSV strings or arrays for relation data). Every table has a primary key (`UUID`).
> - **2NF:** It is in 1NF and all non-key attributes are fully dependent on the entire primary key.
> - **3NF:** It is in 2NF and there are no transitive dependencies ($X \rightarrow Y$ and $Y \rightarrow Z$). For example, department names are not duplicated in the `complaints` table; complaints reference `department_id`, and `departments` stores the name.

### 8. Why use UUIDs instead of auto-incrementing serial integers?
> **Answer:** UUIDv4 generated via `pgcrypto`'s `gen_random_uuid()` prevents enumeration attacks (where malicious users query `/complaints/1`, `/complaints/2` to scrape the database) and allows safe distributed ID generation without lock contention on an auto-incrementing sequence counter.

### 9. Explain your foreign key `ON DELETE` rules. Why not make everything `CASCADE`?
> **Answer:**
> - **CASCADE** is used for strictly owned child entities where the child cannot exist without the parent, such as `comments` and `attachments` when a complaint is deleted.
> - **RESTRICT** is deliberately used for business records: you cannot delete a `department` or a `profile` that is referenced in complaints (`ON DELETE RESTRICT`). This prevents accidental deletion of organizational records that would orphan compliance history.
> - **SET NULL** is used for `profiles.department_id` so removing a department does not delete user accounts.

### 10. How is `profiles` linked to Supabase Auth?
> **Answer:** `profiles.id` is a primary key that has a foreign key constraint referencing `auth.users(id) ON DELETE CASCADE`. When a user registers in GoTrue, a PostgreSQL trigger `on_auth_user_created` fires and inserts an initial record into `public.profiles`.

### 11. How do you prevent multiple specialists from being marked active simultaneously on a complaint?
> **Answer:** We used a **Partial Unique Index** on the `assignments` table:
> ```sql
> CREATE UNIQUE INDEX idx_assignments_one_active
> ON assignments (complaint_id) WHERE is_active = true;
> ```
> This allows infinite historical assignments (`is_active = false`) for auditing, while the database physically rejects any attempt to insert or update a second active assignment for the same complaint.

### 12. Why did you use PostgreSQL ENUM types instead of VARCHAR with check constraints?
> **Answer:** Native enum types (`user_role`, `complaint_status`, `complaint_priority`) store data internally as 4-byte integers rather than variable-length strings, reducing table and index storage footprints while enforcing strict type validation directly in the PostgreSQL catalog.

---

## Category 3: Row Level Security (RLS) & Authorization

### 13. What is RLS recursion, and how does this codebase prevent it?
> **Answer:** Recursion happens when an RLS policy on Table A queries Table A or queries Table B whose policy queries Table A, resulting in an infinite evaluation loop (`infinite recursion detected in policy`). We prevent this using `SECURITY DEFINER` helper functions (`current_user_role()`, `current_user_dept()`). These functions run with owner privileges to read the user's role and department from `profiles`, bypassing RLS evaluation inside policy expressions.

### 14. Can an employee view another employee's complaints?
> **Answer:** No. The policy `complaints_select_employee` enforces:
> ```sql
> current_user_role() = 'employee' AND created_by = auth.uid()
> ```
> PostgreSQL appends this filter to the execution plan before scanning rows.

### 15. How do department heads access only their department's complaints?
> **Answer:** The policy `complaints_select_dept_head` checks:
> ```sql
> current_user_role() = 'dept_head' AND department_id = current_user_dept()
> ```
> Even if a department head sends a query for a different department ID, PostgreSQL filters it out and returns zero rows.

### 16. How do internal staff comments stay hidden from employees?
> **Answer:** On the `comments` table, `comments_select_employee` includes:
> ```sql
> is_internal = false AND EXISTS (
>   SELECT 1 FROM complaints c WHERE c.id = complaint_id AND c.created_by = auth.uid()
> )
> ```
> Any row where `is_internal = true` evaluates to false for employees and is omitted from the result set.

### 17. How do you prevent users from tampering with their own roles?
> **Answer:** The `profiles_update_own` policy only allows updating personal fields like `full_name` or `avatar_url`. Role modification policies are guarded by `current_user_role() = 'admin'`. Furthermore, the API registration endpoint verifies user metadata before provisioning.

### 18. What happens if RLS is enabled but no policy matches?
> **Answer:** In PostgreSQL, enabling RLS activates a **default-deny** posture. If no policy matches the current user and operation, the operation fails or returns an empty result set.

---

## Category 4: Concurrency, Locks & Finite State Machine

### 19. What is the lost-update problem, and how does ComplaintEase resolve it?
> **Answer:** The lost-update problem occurs when two users read version $V$, make conflicting decisions, and both write back, with the second write silently overwriting the first. ComplaintEase resolves this using **Optimistic Concurrency Control** combined with **Pessimistic Row Locking**:
> 1. Each complaint row has an integer `version`.
> 2. `transition_complaint()` takes `p_expected_version`.
> 3. Inside the transaction, it locks the row using `SELECT ... FOR UPDATE`.
> 4. If `complaint.version != p_expected_version`, it throws SQLSTATE `P0003` (`Conflict`), rolling back and prompting the user to refresh.
> 5. If valid, it increments `version = version + 1`.

### 20. Why use `SELECT ... FOR UPDATE` inside `transition_complaint()`?
> **Answer:** In PostgreSQL's default `READ COMMITTED` isolation level, without `FOR UPDATE`, two concurrent transactions could read the same version before either writes. `FOR UPDATE` places an exclusive write lock on the target row, forcing concurrent callers to block until the active transition transaction commits or rolls back.

### 21. How do you block users from doing direct `UPDATE complaints SET status = ...`?
> **Answer:** We implemented a `BEFORE UPDATE` trigger on `complaints` (`trg_block_direct_status_update`). When `OLD.status IS DISTINCT FROM NEW.status`, it inspects a transaction session variable (`current_setting('complaintease.in_transition', true)`). If the flag is not `'true'`, it raises SQLSTATE `P0005`, completely prohibiting direct updates.

### 22. What are the terminal states in your state machine?
> **Answer:** `closed` and `rejected`. In the `allowed_transitions` table, neither status has outgoing valid transitions.

### 23. Can an employee transition a complaint?
> **Answer:** An employee can only trigger a transition from `resolved` to `reopened` on their own complaint (`p_new_status = 'reopened' AND v_complaint.created_by = auth.uid()`). All other lifecycle progressions are restricted to department heads and admins.

### 24. What makes the `audit_logs` table tamper-proof?
> **Answer:**
> 1. We attach a `BEFORE UPDATE OR DELETE` trigger (`trg_protect_audit_logs`) that unconditionally throws SQLSTATE `55000` (`Audit log table is append-only`).
> 2. We revoke `UPDATE`, `DELETE`, and `TRUNCATE` privileges on the table from `authenticated`, `anon`, and `public` roles.

---

## Category 5: Indexing Strategy & Performance

### 25. Why does column order matter in composite indexes?
> **Answer:** In a B-tree composite index `(A, B, C)`, the index is sorted primarily by `A`, then by `B` within identical `A` values, then by `C`.
> The **Leftmost Prefix Rule** dictates that queries filtering on `A` or `(A, B)` can utilize the index, but queries filtering only on `B` or `C` cannot.
> For equality filters combined with sorting (`department_id = X AND status = Y ORDER BY created_at DESC`), putting equality columns first followed by the sorting column allows PostgreSQL to find the matching slice and read rows in sorted order without an extra sort step.

### 26. Explain the index `idx_complaints_dept_status_created`.
> **Answer:** It indexes `(department_id, status, created_at DESC)`. When a department head opens the triage board filtered by department and status, PostgreSQL jumps directly to the matching subset and traverses the B-tree backward in `created_at DESC` order, eliminating both table scans and in-memory quicksorts.

### 27. What is a Partial Index, and where did you use it?
> **Answer:** A partial index includes a `WHERE` clause so it only indexes rows satisfying a specific condition:
> ```sql
> CREATE INDEX idx_assignments_assigned_active
> ON assignments (assigned_to, is_active) WHERE is_active = true;
> ```
> In enterprise systems, 99% of assignment records are historical (`is_active = false`). Indexing only active assignments keeps the index size tiny (often fitting completely in CPU L2/L3 cache) and accelerates assignee lookups.

### 28. How does the full-text search index work?
> **Answer:** It uses the `pg_trgm` extension to build a Generalized Inverted Index (GIN) on trigrams of `(title || ' ' || description)`:
> ```sql
> CREATE INDEX idx_complaints_trgm_search
> ON complaints USING gin ((title || ' ' || description) gin_trgm_ops);
> ```
> A standard B-tree cannot optimize leading wildcard searches (`ILIKE '%keyword%'`). Trigram indexes break words into 3-character substrings, enabling fast fuzzy substring matching over 10,000+ rows.

### 29. What is Keyset Pagination, and why is it superior to `OFFSET`?
> **Answer:** In offset pagination (`LIMIT 20 OFFSET 50000`), the database must scan and discard 50,000 rows to return 20, creating $O(N)$ performance degradation and I/O thrashing.
> In keyset pagination, the client passes a cursor composed of the last seen values (`created_at < cursor_time OR (created_at = cursor_time AND id < cursor_id)`). The database executes a B-tree search directly to the first row of the page in $O(\log N)$ time, maintaining constant performance regardless of how deep the user paginates.

---

## Category 6: API Design & Backend Engineering

### 30. How does ComplaintEase avoid N+1 queries?
> **Answer:** The N+1 problem occurs when an application executes 1 query to fetch $N$ complaints and then $N$ additional queries to fetch associated categories, departments, and authors.
> ComplaintEase uses PostgREST embedded relational joins:
> ```typescript
> supabase.from('complaints').select(`
>   *, category:categories(id, name),
>   department:departments(id, name),
>   creator:profiles!created_by(id, full_name),
>   assignments(id, is_active, assigned_to:profiles(id, full_name))
> `);
> ```
> PostgreSQL executes the join in a single SQL query, reducing round-trips from $O(N)$ to exactly $O(1)$.

### 31. Why should the backend never use the Supabase `service_role` key for user queries?
> **Answer:** The `service_role` key completely bypasses Row Level Security. If used for user queries, the database runs everything with superuser privileges, forfeiting database-level security and placing the entire burden of access control on application code.

### 32. What is the centralized error handling pattern in `errorHandler`?
> **Answer:** The middleware intercepts all errors passed to `next(err)`. It maps known PostgreSQL error codes (`P0001` -> 400, `P0002` -> 404, `P0003` -> 409, `42501` -> 403, `55000` -> 403) and formats every error into a predictable JSON shape containing `code`, `message`, `details`, and `requestId`.

### 33. Why use `pino` instead of `console.log`?
> **Answer:** `console.log` is synchronous and blocks the Node.js event loop during heavy I/O. `pino` is an asynchronous, high-throughput structured logger that outputs JSON logs with request IDs, timestamps, and log levels (`info`, `warn`, `error`), making logs easily searchable in tools like Datadog, Grafana Loki, or CloudWatch.

### 34. How does the rate limiter protect the API?
> **Answer:** `express-rate-limit` tracks IP request frequency within a configurable time window (15 minutes). If an IP exceeds 100 requests, it returns HTTP `429 Too Many Requests`, protecting against denial of service and credential brute-forcing.

---

## Category 7: Frontend Engineering & React

### 35. How does `React.lazy()` improve initial page load performance?
> **Answer:** Without code splitting, Vite bundles the entire application into a single massive JavaScript file. By wrapping pages in `lazy(() => import('./pages/...'))`, Vite generates separate chunk files for each page. The user's browser only downloads the bundle for the page they are viewing, reducing First Contentful Paint (FCP) and Time to Interactive (TTI).

### 36. How does the `VirtualList` component achieve 60 FPS scrolling?
> **Answer:** When rendering 10,000 complaints, standard React DOM rendering creates tens of thousands of DOM elements, consuming huge memory and freezing the main thread. `VirtualList` monitors scroll position and calculates the visible window, rendering only the ~10 items visible on screen plus a buffer. As the user scrolls, it updates the transform offset and reuses DOM elements.

### 37. Why use React Hook Form with Zod resolvers?
> **Answer:** Traditional controlled React forms trigger a full component re-render on every keystroke. React Hook Form uses uncontrolled inputs with native refs, minimizing re-renders. Paired with `@hookform/resolvers/zod`, it validates form inputs using the shared Zod schema from `@complaintease/shared`.

---

## Category 8: Scaling & Self-Critique

### 38. How would you scale ComplaintEase to 1,000,000 complaints?
> **Answer:**
> 1. **Table Partitioning:** Declaratively partition the `complaints` and `status_history` tables by range on `created_at` (e.g. yearly or monthly partitions) so queries only scan relevant partition tables.
> 2. **Read Replicas:** Route read-heavy queries (`GET /complaints`) to PostgreSQL read replicas using connection pooling (Supavisor / PgBouncer) while directing writes to the primary node.
> 3. **Redis Caching:** Cache frequently accessed static records like departments and categories in Redis with cache-aside invalidation.
> 4. **Cold Storage Archival:** Move `closed` and `rejected` complaints older than 12 months to an archival table or object storage (S3/Parquet) for compliance queries.

### 39. What are the potential bottlenecks in the current system?
> **Answer:**
> 1. Realtime CDC publication on high-write tables: streaming every status update via WebSockets can saturate network bandwidth if thousands of complaints transition simultaneously.
> 2. Full-text search with trigrams on millions of rows: while GIN trigram indexes are fast, dedicated search engines like Elasticsearch or Typesense are more scalable for complex natural language queries.

### 40. If you were rewriting ComplaintEase today, what would you change?
> **Answer:**
> 1. **GraphQL / tRPC:** Instead of custom REST endpoints, tRPC would provide end-to-end type safety between backend and frontend without manual fetch clients.
> 2. **Outbox Pattern for Notifications:** Instead of creating notifications directly inside triggers, write events to a transactional Outbox table and use background workers (e.g. BullMQ / Temporal) to handle notifications, WebSockets, and external email delivery.

