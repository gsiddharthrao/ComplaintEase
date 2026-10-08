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
   Apply all migrations in sequential order (or execute `001_extensions_and_enums.sql` through `009_complaint_location_image.sql` in the Supabase SQL Editor):
   ```bash
   supabase db push
   ```

3. **Populate Relational Seed Data:**
   - Open the Supabase SQL Editor.
   - Run `supabase/seed.sql` to populate initial departments, categories, and synthetic test complaints.

4. **Provision Initial Administrator:**
   In your terminal, navigate to the API directory and run the user provisioning script using your administrator credentials:
   ```bash
   cd apps/api
   SUPABASE_URL="https://<project>.supabase.co" \
   SUPABASE_ANON_KEY="<your-anon-key>" \
   SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>" \
   ADMIN_EMAIL="admin@yourdomain.com" \
   ADMIN_PASSWORD="YourSecurePassword123!" \
   pnpm run seed
   ```
   Alternatively, pass them as arguments: `pnpm seed <email> <password> [name]`.

5. **Verify Storage Bucket:**
   - Check **Storage** in the Supabase Dashboard. Ensure the private bucket named `attachments` exists (created automatically by migration 007).

---

## 2. Backend Deployment on Render

1. Log in to [Render](https://render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`gsiddharthrao/ComplaintEase-Enterprise-`).
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
3. Import your GitHub repository (`gsiddharthrao/ComplaintEase-Enterprise-`).
4. Set the build settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `./` (root directory with `vercel.json`)
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
2. Verify Admin Login using the credentials provisioned in Step 1.4 via the Command Center tab.
3. Test Staff Self-Registration via the Staff Portal tab (`/login?portal=staff&mode=register`).
4. Verify incident filing with GPS coordinates and photo attachment.
5. In the Command Center, verify real-time status transitions, specialist assignment, and WebSocket notifications.
