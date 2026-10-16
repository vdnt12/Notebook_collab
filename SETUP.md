# Notebook — Cloud Backend & Google Authentication Setup Guide

This guide walks you through setting up the free cloud infrastructure for **Notebook**, including **Supabase (PostgreSQL, Auth, Storage, Realtime)** and **Google OAuth**.

---

## Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Global Vercel Deployment (HTTPS)                     │
│                        Next.js 16 + React 19                           │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│            Supabase Auth             │  │   Google Cloud OAuth 2.0     │
│   • Google Social Login Provider     │  │   • User Profile & Email     │
│   • Secure PKCE Session Management   │  │   • Authorized Origins       │
│   • Profile Synchronization          │  │   • Callback to Supabase     │
└──────────────────┬───────────────────┘  └──────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Supabase Cloud Services                           │
│  • PostgreSQL with Row Level Security (RLS)                            │
│  • Storage (Private bucket: notebook-attachments)                      │
│  • Realtime (Presence & Live Postgres Changes)                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create a Supabase Project (100% Free)

1. Sign in to [Supabase](https://supabase.com) (or create a free account).
2. Click **New Project**.
3. Fill in the project details:
   - **Name**: `Notebook` (or your choice).
   - **Database Password**: Generate a secure password and save it securely.
   - **Region**: Select the region closest to you and your users (e.g., `South Asia (Mumbai)` or `East US`).
   - **Pricing Plan**: **Free ($0/month)**.
4. Click **Create new project** and wait ~1–2 minutes for provisioning to finish.

### Retrieve Supabase API Credentials
1. Go to **Project Settings** (gear icon on the left) → **API**.
2. Copy:
   - **Project URL** (`https://<project-ref>.supabase.co`) → for `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API Keys** → `anon` `public` key → for `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Retrieve Database Connection String
1. Go to **Project Settings** → **Database**.
2. Scroll to **Connection string** and select **URI**.
3. Check the **Use connection pooling** box (port `6543`, `Transaction` mode).
4. Copy the connection URI:
   ```text
   postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   Replace `[YOUR-PASSWORD]` with the database password created above → for `DATABASE_URL`.

---

## Step 2: Run Database Schema & RLS Migrations

1. In the Supabase Dashboard, click **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open the file [`supabase/migrations/20261017000000_cloud_schema_and_rls.sql`](supabase/migrations/20261017000000_cloud_schema_and_rls.sql) in this repository.
4. Copy the entire contents of the SQL file and paste it into the Supabase SQL Editor.
5. Click **Run** (green button).

### What this migration sets up:
- **Tables**: `profiles`, `notebooks`, `notebook_settings`, `notebook_members`, `topics`, `topic_documents`, `comments`, `files`, `activity`, `starred_notebooks`.
- **Triggers**: `on_auth_user_created` automatically syncs new Google users into `public.profiles`.
- **Row Level Security (RLS)**: Enforces Owner, Editor, Commenter, and Viewer permissions non-recursively.
- **Storage Bucket**: Private bucket `notebook-attachments` with a 25MB file-size limit and restricted RLS access policies.
- **Realtime Replication**: Enables live events on `topics`, `comments`, `activity`, and `files`.

---

## Step 3: Configure Google Cloud OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `Notebook-Collab`).
3. In the left navigation, go to **APIs & Services** → **OAuth consent screen**:
   - Choose **External** → Click **Create**.
   - **App name**: `Notebook`
   - **User support email**: Your email
   - **Developer contact information**: Your email
   - Click **Save and Continue**.
   - On the **Scopes** page, click **Add or Remove Scopes**:
     - Check `.../auth/userinfo.email`
     - Check `.../auth/userinfo.profile`
     - Check `openid`
   - Click **Update** → **Save and Continue**.
   - Under **Test users**, add your own Google email address if publishing status is Testing.
   - Click **Save and Continue**.

4. Go to **APIs & Services** → **Credentials**:
   - Click **+ Create Credentials** → **OAuth client ID**.
   - **Application type**: **Web application**.
   - **Name**: `Notebook Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for local development)
     - `https://<project-ref>.supabase.co`
     - `https://your-vercel-app.vercel.app` (add once deployed)
   - **Authorized redirect URIs**:
     - `https://<project-ref>.supabase.co/auth/v1/callback`
   - Click **Create**.
   - Copy the **Client ID** and **Client Secret**.

---

## Step 4: Link Google OAuth into Supabase

1. Go back to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication** (shield icon) → **Providers** → **Google**.
3. Toggle Google to **Enabled**.
4. Paste:
   - **Client ID** (from Google Cloud)
   - **Client Secret** (from Google Cloud)
5. Click **Save**.

### Configure Supabase Allowed Redirect URLs
1. In the Supabase Dashboard, go to **Authentication** → **URL Configuration**.
2. Set **Site URL**:
   - Local: `http://localhost:3000`
   - Or Production: `https://your-vercel-app.vercel.app`
3. Under **Redirect URLs**, click **Add URL** and add:
   - `http://localhost:3000/auth/callback`
   - `https://your-vercel-app.vercel.app/auth/callback`
4. Click **Save**.

---

## Step 5: Configure Local Environment

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in the values:
   ```ini
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_ENABLE_LOCAL_AUTH=false
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Visit `http://localhost:3000` and click **Continue with Google** to test real cloud authentication!
