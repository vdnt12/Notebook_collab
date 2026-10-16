-- ==============================================================================
-- NOTEBOOK: Master Cloud Schema & Row Level Security (RLS)
-- Target: Supabase PostgreSQL (Free Tier)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. PROFILES (Linked directly to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_id TEXT,
  name TEXT NOT NULL DEFAULT 'User',
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_google_id ON public.profiles(google_id);

-- 3. NOTEBOOKS
CREATE TABLE IF NOT EXISTS public.notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📓' NOT NULL,
  color TEXT DEFAULT '#2F6FED' NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_notebooks_owner ON public.notebooks(owner_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_deleted ON public.notebooks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notebooks_search ON public.notebooks USING gin(search_vector);

-- 4. NOTEBOOK SETTINGS
CREATE TABLE IF NOT EXISTS public.notebook_settings (
  notebook_id UUID PRIMARY KEY REFERENCES public.notebooks(id) ON DELETE CASCADE,
  editors_can_delete BOOLEAN DEFAULT FALSE NOT NULL,
  allow_viewer_download BOOLEAN DEFAULT TRUE NOT NULL,
  allow_link_access BOOLEAN DEFAULT FALSE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 5. NOTEBOOK MEMBERS (Access control: OWNER, EDITOR, COMMENTER, VIEWER)
CREATE TABLE IF NOT EXISTS public.notebook_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('OWNER', 'EDITOR', 'COMMENTER', 'VIEWER')) NOT NULL DEFAULT 'VIEWER',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (notebook_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_user ON public.notebook_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_notebook ON public.notebook_members(notebook_id);

-- 6. TOPICS (Pages within a notebook)
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Topic',
  icon TEXT DEFAULT '📝' NOT NULL,
  parent_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 1000,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- 7. TOPIC DOCUMENTS (Collaborative state / Yjs binary snapshots)
CREATE TABLE IF NOT EXISTS public.topic_documents (
  topic_id UUID PRIMARY KEY REFERENCES public.topics(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 8. COMMENTS (Inline and page comments)
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_topic ON public.comments(topic_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);

-- 9. FILES (Topic attachments stored in Supabase Storage)
CREATE TABLE IF NOT EXISTS public.files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  uploader UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_topic ON public.files(topic_id);
CREATE INDEX IF NOT EXISTS idx_files_uploader ON public.files(uploader);

-- 10. ACTIVITY (Audit trail and recent collaborator activity)
CREATE TABLE IF NOT EXISTS public.activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  actor UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_notebook ON public.activity(notebook_id);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON public.activity(timestamp DESC);

-- 11. STARRED NOTEBOOKS
CREATE TABLE IF NOT EXISTS public.starred_notebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  UNIQUE (user_id, notebook_id)
);

CREATE INDEX IF NOT EXISTS idx_starred_user ON public.starred_notebooks(user_id);

-- ==============================================================================
-- 12. BACKWARD COMPATIBILITY VIEWS & ALIASES
-- ==============================================================================
CREATE OR REPLACE VIEW public.users AS
SELECT
  id,
  google_id AS google_sub,
  email,
  TRUE AS email_verified,
  name,
  avatar_url,
  created_at,
  updated_at,
  last_active_at,
  NULL::timestamptz AS deleted_at
FROM public.profiles;

-- ==============================================================================
-- 13. AUTOMATIC PROFILE PROVISIONING TRIGGER (auth.users -> public.profiles)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, google_id)
  VALUES (
    new.id,
    COALESCE(new.email, ''),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'User'),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'sub'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    last_active_at = NOW(),
    updated_at = NOW();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 14. NON-RECURSIVE SECURITY DEFINER HELPERS FOR RLS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_user_notebook_role(check_notebook_id UUID, check_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT 'OWNER' FROM public.notebooks WHERE id = check_notebook_id AND owner_id = check_user_id AND deleted_at IS NULL LIMIT 1),
    (SELECT role FROM public.notebook_members WHERE notebook_id = check_notebook_id AND user_id = check_user_id LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_notebook(check_notebook_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notebooks WHERE id = check_notebook_id AND owner_id = check_user_id AND deleted_at IS NULL
    UNION ALL
    SELECT 1 FROM public.notebook_members WHERE notebook_id = check_notebook_id AND user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_notebook(check_notebook_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notebooks WHERE id = check_notebook_id AND owner_id = check_user_id AND deleted_at IS NULL
    UNION ALL
    SELECT 1 FROM public.notebook_members WHERE notebook_id = check_notebook_id AND user_id = check_user_id AND role IN ('OWNER', 'EDITOR')
  );
$$;

-- Prevent accidental deletion/removal of notebook owner from membership
CREATE OR REPLACE FUNCTION public.protect_notebook_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.notebooks WHERE id = OLD.notebook_id AND owner_id = OLD.user_id) THEN
    RAISE EXCEPTION 'Cannot remove or modify the role of the notebook owner via membership operations.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS check_protect_owner ON public.notebook_members;
CREATE TRIGGER check_protect_owner
  BEFORE DELETE OR UPDATE ON public.notebook_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_notebook_owner();

-- ==============================================================================
-- 15. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starred_notebooks ENABLE ROW LEVEL SECURITY;

-- PROFILES RLS
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- NOTEBOOKS RLS
DROP POLICY IF EXISTS "Notebooks readable by authorized users" ON public.notebooks;
CREATE POLICY "Notebooks readable by authorized users"
  ON public.notebooks FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR public.can_read_notebook(id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can create notebooks" ON public.notebooks;
CREATE POLICY "Authenticated users can create notebooks"
  ON public.notebooks FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners and editors can update notebooks" ON public.notebooks;
CREATE POLICY "Owners and editors can update notebooks"
  ON public.notebooks FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR public.can_edit_notebook(id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.can_edit_notebook(id, auth.uid()));

DROP POLICY IF EXISTS "Only owners can delete notebooks" ON public.notebooks;
CREATE POLICY "Only owners can delete notebooks"
  ON public.notebooks FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- NOTEBOOK SETTINGS RLS
DROP POLICY IF EXISTS "Settings readable by notebook members" ON public.notebook_settings;
CREATE POLICY "Settings readable by notebook members"
  ON public.notebook_settings FOR SELECT
  TO authenticated
  USING (public.can_read_notebook(notebook_id, auth.uid()));

DROP POLICY IF EXISTS "Settings manageable by notebook owners" ON public.notebook_settings;
CREATE POLICY "Settings manageable by notebook owners"
  ON public.notebook_settings FOR ALL
  TO authenticated
  USING (public.get_user_notebook_role(notebook_id, auth.uid()) = 'OWNER')
  WITH CHECK (public.get_user_notebook_role(notebook_id, auth.uid()) = 'OWNER');

-- NOTEBOOK MEMBERS RLS
DROP POLICY IF EXISTS "Members readable by notebook participants" ON public.notebook_members;
CREATE POLICY "Members readable by notebook participants"
  ON public.notebook_members FOR SELECT
  TO authenticated
  USING (public.can_read_notebook(notebook_id, auth.uid()));

DROP POLICY IF EXISTS "Members can be added by owner" ON public.notebook_members;
CREATE POLICY "Members can be added by owner"
  ON public.notebook_members FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_notebook_role(notebook_id, auth.uid()) = 'OWNER');

DROP POLICY IF EXISTS "Member roles updated by owner" ON public.notebook_members;
CREATE POLICY "Member roles updated by owner"
  ON public.notebook_members FOR UPDATE
  TO authenticated
  USING (public.get_user_notebook_role(notebook_id, auth.uid()) = 'OWNER')
  WITH CHECK (public.get_user_notebook_role(notebook_id, auth.uid()) = 'OWNER');

DROP POLICY IF EXISTS "Members removed by owner or self" ON public.notebook_members;
CREATE POLICY "Members removed by owner or self"
  ON public.notebook_members FOR DELETE
  TO authenticated
  USING (public.get_user_notebook_role(notebook_id, auth.uid()) = 'OWNER' OR user_id = auth.uid());

-- TOPICS RLS
DROP POLICY IF EXISTS "Topics readable by notebook members" ON public.topics;
CREATE POLICY "Topics readable by notebook members"
  ON public.topics FOR SELECT
  TO authenticated
  USING (public.can_read_notebook(notebook_id, auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Topics creatable by owners and editors" ON public.topics;
CREATE POLICY "Topics creatable by owners and editors"
  ON public.topics FOR INSERT
  TO authenticated
  WITH CHECK (public.can_edit_notebook(notebook_id, auth.uid()));

DROP POLICY IF EXISTS "Topics updatable by owners and editors" ON public.topics;
CREATE POLICY "Topics updatable by owners and editors"
  ON public.topics FOR UPDATE
  TO authenticated
  USING (public.can_edit_notebook(notebook_id, auth.uid()))
  WITH CHECK (public.can_edit_notebook(notebook_id, auth.uid()));

DROP POLICY IF EXISTS "Topics deletable by owners and editors" ON public.topics;
CREATE POLICY "Topics deletable by owners and editors"
  ON public.topics FOR DELETE
  TO authenticated
  USING (public.can_edit_notebook(notebook_id, auth.uid()));

-- TOPIC DOCUMENTS RLS
DROP POLICY IF EXISTS "Documents readable by notebook members" ON public.topic_documents;
CREATE POLICY "Documents readable by notebook members"
  ON public.topic_documents FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND public.can_read_notebook(t.notebook_id, auth.uid())));

DROP POLICY IF EXISTS "Documents editable by editors" ON public.topic_documents;
CREATE POLICY "Documents editable by editors"
  ON public.topic_documents FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND public.can_edit_notebook(t.notebook_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND public.can_edit_notebook(t.notebook_id, auth.uid())));

-- COMMENTS RLS
DROP POLICY IF EXISTS "Comments readable by notebook members" ON public.comments;
CREATE POLICY "Comments readable by notebook members"
  ON public.comments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND public.can_read_notebook(t.notebook_id, auth.uid())));

DROP POLICY IF EXISTS "Comments insertable by authorized users" ON public.comments;
CREATE POLICY "Comments insertable by authorized users"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND public.can_read_notebook(t.notebook_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Comments updatable by author" ON public.comments;
CREATE POLICY "Comments updatable by author"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Comments deletable by author or owner" ON public.comments;
CREATE POLICY "Comments deletable by author or owner"
  ON public.comments FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.topics t
      JOIN public.notebooks n ON t.notebook_id = n.id
      WHERE t.id = topic_id AND n.owner_id = auth.uid()
    )
  );

-- FILES RLS
DROP POLICY IF EXISTS "Files readable by notebook members" ON public.files;
CREATE POLICY "Files readable by notebook members"
  ON public.files FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND public.can_read_notebook(t.notebook_id, auth.uid())));

DROP POLICY IF EXISTS "Files uploadable by editors" ON public.files;
CREATE POLICY "Files uploadable by editors"
  ON public.files FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader = auth.uid() AND
    EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND public.can_edit_notebook(t.notebook_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Files deletable by uploader or owner" ON public.files;
CREATE POLICY "Files deletable by uploader or owner"
  ON public.files FOR DELETE
  TO authenticated
  USING (
    uploader = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.topics t
      JOIN public.notebooks n ON t.notebook_id = n.id
      WHERE t.id = topic_id AND n.owner_id = auth.uid()
    )
  );

-- ACTIVITY RLS
DROP POLICY IF EXISTS "Activity viewable by notebook members" ON public.activity;
CREATE POLICY "Activity viewable by notebook members"
  ON public.activity FOR SELECT
  TO authenticated
  USING (public.can_read_notebook(notebook_id, auth.uid()));

DROP POLICY IF EXISTS "Activity insertable by actor" ON public.activity;
CREATE POLICY "Activity insertable by actor"
  ON public.activity FOR INSERT
  TO authenticated
  WITH CHECK (actor = auth.uid() AND public.can_read_notebook(notebook_id, auth.uid()));

-- STARRED NOTEBOOKS RLS
DROP POLICY IF EXISTS "Starred notebooks accessible by owner" ON public.starred_notebooks;
CREATE POLICY "Starred notebooks accessible by owner"
  ON public.starred_notebooks FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- 16. SUPABASE REALTIME REPLICATION SETUP
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.topics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;

-- ==============================================================================
-- 17. SUPABASE STORAGE BUCKET & STORAGE POLICIES
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notebook-attachments',
  'notebook-attachments',
  false,
  26214400, -- 25MB max per file on Free tier
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/markdown', 'application/json'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 26214400;

-- Storage RLS: allow authenticated users to read files if they can read the notebook
DROP POLICY IF EXISTS "Storage attachments readable by notebook members" ON storage.objects;
CREATE POLICY "Storage attachments readable by notebook members"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'notebook-attachments' AND
    public.can_read_notebook((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- Storage RLS: allow editors to upload attachments
DROP POLICY IF EXISTS "Storage attachments insertable by notebook editors" ON storage.objects;
CREATE POLICY "Storage attachments insertable by notebook editors"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'notebook-attachments' AND
    public.can_edit_notebook((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- Storage RLS: allow file uploader or notebook owner to delete attachments
DROP POLICY IF EXISTS "Storage attachments deletable by owner or uploader" ON storage.objects;
CREATE POLICY "Storage attachments deletable by owner or uploader"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'notebook-attachments' AND
    (
      auth.uid() = owner OR
      public.get_user_notebook_role((storage.foldername(name))[1]::uuid, auth.uid()) = 'OWNER'
    )
  );
