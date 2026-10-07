-- ==============================================================================
-- CoNote (notebook_vdnt) — Master Collaborative Notebook Database Schema
-- Standard Google Authentication, Sessions, and PostgreSQL Core Tables
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==============================================================================
-- 1. USERS & SESSIONS (Standard Google Identity Services & Server Sessions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT TRUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_google_sub ON public.users(google_sub);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  last_used_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON public.sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);

-- ==============================================================================
-- 2. NOTEBOOKS & NOTEBOOK SETTINGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📓' NOT NULL,
  color TEXT DEFAULT '#6366f1' NOT NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Search vector
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED
);

CREATE TABLE IF NOT EXISTS public.notebook_settings (
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE PRIMARY KEY,
  editors_can_delete BOOLEAN DEFAULT FALSE NOT NULL,
  allow_viewer_download BOOLEAN DEFAULT TRUE NOT NULL,
  allow_link_access BOOLEAN DEFAULT FALSE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notebooks_owner ON public.notebooks(owner_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_deleted ON public.notebooks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notebooks_search ON public.notebooks USING gin(search_vector);

-- ==============================================================================
-- 3. NOTEBOOK MEMBERS (OWNER / EDITOR / COMMENTER / VIEWER)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notebook_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('OWNER', 'EDITOR', 'COMMENTER', 'VIEWER')) NOT NULL DEFAULT 'VIEWER',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (notebook_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON public.notebook_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_notebook ON public.notebook_members(notebook_id);

-- ==============================================================================
-- 4. TOPICS (COLLABORATIVE PAGES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Topic',
  icon TEXT DEFAULT '📝' NOT NULL,
  parent_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 1000,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content JSONB,
  content_text TEXT,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content_text, '')), 'B')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_topics_notebook ON public.topics(notebook_id);
CREATE INDEX IF NOT EXISTS idx_topics_position ON public.topics(notebook_id, position);
CREATE INDEX IF NOT EXISTS idx_topics_search ON public.topics USING gin(search_vector);

-- ==============================================================================
-- 5. YJS COLLABORATIVE DOCUMENTS & SNAPSHOTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.topic_documents (
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ==============================================================================
-- 6. STARRED NOTEBOOKS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.starred_notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (user_id, notebook_id)
);

CREATE INDEX IF NOT EXISTS idx_starred_user ON public.starred_notebooks(user_id);
