# Step-by-Step Deployment Guide

Follow these steps to deploy ComplaintEase live to **Supabase**, **Render**, and **Vercel**.

---

## 1. Supabase Project Setup (Database, Auth, Storage)

1. **Create Project:**
   - Log into [Supabase Dashboard](https://supabase.com/dashboard) and click **New Project**.
   - Note down your **Project URL**, **anon/public API key**, and **service_role API key** from **Project Settings → API**.

2. **Push Database Migrations:**
   Install the Supabase CLI if not already installed:
   ```bash
   npm install -g supabase
   ```
   Link your local repository to your Supabase project:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
   Apply all migrations in sequential order:
   ```bash
   supabase db push
   ```

3. **Run the Database Seed & Create Demo Users:**
   In your terminal, navigate to the API directory and run the user provisioning script:
   ```bash
   cd apps/api
   SUPABASE_URL="https://<project>.supabase.co" \
   SUPABASE_ANON_KEY="<your-anon-key>" \
   SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>" \
   pnpm run seed
   ```
   Then apply the relational seed data (departments, categories, and test complaints) using the Supabase SQL Editor:
   - Open Supabase SQL Editor.
   - Paste the contents of `supabase/seed.sql` and run.

4. **Verify Storage Bucket:**
   - Check **Storage** in the Supabase Dashboard. Ensure the private bucket named `attachments` exists.

---

## 2. Backend Deployment on Render

1. Log in to [Render](https://render.com).
2. Click **New +** → **Blueprint** or **Web Service**.
3. Connect your GitHub repository.
4. Select **Docker** as the runtime:
   - **Dockerfile Path:** `./apps/api/Dockerfile`
   - **Docker Context:** `.` (root directory)
5. Configure Environment Variables in the Render dashboard:
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
   - `SUPABASE_URL`: `https://<your-project>.supabase.co`
   - `SUPABASE_ANON_KEY`: `<your-anon-key>`
   - `SUPABASE_SERVICE_ROLE_KEY`: `<your-service-role-key>`
   - `CORS_ORIGIN`: `https://<your-vercel-domain>.vercel.app`
6. Click **Create Web Service**.
7. Note down your Render API public URL (e.g. `https://complaintease-api.onrender.com`).

---

## 3. Frontend Deployment on Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository.
4. Set the following build settings:
   - **Framework Preset:** Vite
   - **Root Directory:** Leave as root or select `apps/web` (with `vercel.json` at root, leaving as root is recommended)
   - **Build Command:** `pnpm --filter @complaintease/shared build && pnpm --filter @complaintease/web build`
   - **Output Directory:** `apps/web/dist`
5. Configure Environment Variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL`: `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `<your-anon-key>`
   - `VITE_API_URL`: `https://complaintease-api.onrender.com/api/v1`
6. Click **Deploy**.

---

## 4. Post-Deployment Verification

1. Open your Vercel URL in a browser.
2. Test login with the seeded demo credentials:
   - Employee: `employee@demo.com` / `Demo1234!`
   - Admin: `admin@demo.com` / `Demo1234!`
3. Verify that creating a complaint works, status transitions function properly, and real-time updates broadcast over WebSockets.

