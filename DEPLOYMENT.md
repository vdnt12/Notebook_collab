# Notebook — Global Vercel Deployment & Production Operations Guide

This document describes how to deploy **Notebook** globally via Vercel connected to your GitHub repository `https://github.com/vdnt12/Notebook_collab`, with a 100% free infrastructure budget ($0/month).

---

## 1. Zero-Cost Infrastructure Policy ($0/month)

| Service | Free Tier Allocation | Notebook Usage | Cost |
| :--- | :--- | :--- | :--- |
| **Vercel** | Hobby Plan (100GB bandwidth, fast global edge network) | Frontend hosting, SSR App Router | **$0** |
| **Supabase Database** | 500MB PostgreSQL, 2 free projects, compute paused after 1 week inactive | Notebooks, topics, comments, profiles, activity | **$0** |
| **Supabase Auth** | 50,000 monthly active users (MAU), social OAuth included | Google OAuth authentication & sessions | **$0** |
| **Supabase Storage** | 1GB storage, 2GB download bandwidth per month | Private attachments (PDFs, images, documents) | **$0** |
| **Supabase Realtime**| 200 concurrent connections, 2M messages/month | Active collaborator presence & live changes | **$0** |
| **Google Cloud** | Google Identity Services OAuth 2.0 Web Client | Google sign-in consent screen | **$0** |

> [!NOTE]
> No paid plans, billing cards, or paid add-ons are required. If usage limits are ever approached, the application gracefully protects your quota.

---

## 2. Step-by-Step Vercel Deployment

### Step 1: Push Code to GitHub

Ensure all latest improvements and migrations are pushed to the `main` branch of your repository:
```bash
git add .
git commit -m "feat: complete Supabase cloud backend, Google OAuth, RLS, and Vercel production setup"
git push origin main
```

### Step 2: Connect GitHub Repository to Vercel

1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New…** → **Project**.
3. Under **Import Git Repository**, locate `vdnt12/Notebook_collab`.
   *(If not listed, click "Adjust GitHub App Permissions" and authorize access to `Notebook_collab`).*
4. Click **Import**.

### Step 3: Configure Project Settings

In the Vercel project configuration screen:
- **Project Name**: `notebook` (or your preferred name)
- **Framework Preset**: `Next.js` (detected automatically)
- **Root Directory**:
  - If your repository root directly contains `package.json`, leave as `./`.
  - If your repository contains a subfolder (e.g., `notebook_vdnt`), click **Edit** and select `notebook_vdnt`.
- **Build Command**: `next build` (default)
- **Output Directory**: `.next` (default)

### Step 4: Add Production Environment Variables

Expand the **Environment Variables** section and add the following variables for the **Production** environment:

| Variable Name | Value Description | Example / Source |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Public Key | `eyJhbGciOi...` (from Supabase API Settings) |
| `DATABASE_URL` | Pooled Postgres Connection String | `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `NEXT_PUBLIC_APP_URL` | Your Vercel production URL | `https://your-project.vercel.app` |
| `NEXT_PUBLIC_ENABLE_LOCAL_AUTH` | Disable local mock auth in production | `false` |

> [!CAUTION]
> Never check your `DATABASE_URL` or secret keys into Git. Only configure them securely in Vercel's Environment Variables dashboard.

### Step 5: Deploy

1. Click **Deploy**.
2. Vercel will clone the repository, run `npm install`, compile Next.js 16 with Turbopack, and deploy your site globally.
3. Once the build finishes, you will receive a production HTTPS URL (e.g., `https://notebook-xxx.vercel.app`).

---

## 3. Post-Deployment Authentication Configuration

Once you have your production URL (e.g., `https://notebook-app.vercel.app`):

### 1. Update Supabase Redirect URLs
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **URL Configuration**.
2. Set **Site URL**: `https://notebook-app.vercel.app`
3. In **Redirect URLs**, add:
   - `https://notebook-app.vercel.app/auth/callback`
4. Click **Save**.

### 2. Update Google Cloud OAuth Origins
1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Click to edit your **OAuth 2.0 Client ID**.
3. Under **Authorized JavaScript origins**, add:
   - `https://notebook-app.vercel.app`
4. Under **Authorized redirect URIs**, verify:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
5. Click **Save**.

---

## 4. Verification & Testing Checklist

Verify the deployed application with these checks:

- [ ] **Public Access**: Visit `https://your-project.vercel.app` in an incognito window without running any local server.
- [ ] **Login Screen**: Verify the clean minimalist login card appears with "Continue with Google".
- [ ] **Google OAuth Flow**: Click "Continue with Google". Verify the browser redirects to Google's consent screen.
- [ ] **Callback & Profile**: After signing in, verify redirect to `/dashboard` with your Google name and avatar.
- [ ] **Notebook Creation**: Click **+ New Notebook**; create a notebook (e.g., "Computer Science"). Verify it persists in Supabase.
- [ ] **Note Editing & Autosave**: Create a note; type content. Observe the subtle `Saving…` → `✓ Saved` status indicator.
- [ ] **Refresh & Persistence**: Refresh the browser page (`⌘R`). Verify all notes and content remain intact from the cloud database.
- [ ] **File Attachments**: Go to the **Files** tab. Upload a PDF or image attachment; verify upload progress and download link.
- [ ] **Comments Drawer**: Add a comment on a note; verify it appears in the right comments drawer.
- [ ] **Collaborator Presence**: Open the notebook in two different browser sessions or devices; verify the real-time presence indicators.
- [ ] **Sign Out**: Click your profile/settings and sign out. Verify session cookies are revoked and you return to `/login`.

---

## 5. Continuous Deployment & Troubleshooting

- **Continuous Deployment**: Every push to the `main` branch of `vdnt12/Notebook_collab` will automatically trigger a new production build on Vercel.
- **Preview Deployments**: Pull requests create isolated preview environments.
- **Troubleshooting**:
  - *OAuth Error "redirect_uri_mismatch"*: Verify that `https://<project-ref>.supabase.co/auth/v1/callback` is added to Google Cloud Credentials.
  - *CORS / Cookie Issues*: Ensure `NEXT_PUBLIC_APP_URL` matches the exact domain and uses `https://`.
  - *Database Connection timeout*: Ensure you are using the pooled connection string on port `6543` with `?pgbouncer=true`.
