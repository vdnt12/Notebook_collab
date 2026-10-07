# CoNote (notebook_vdnt) 📓✨

> **Production-Quality Collaborative Digital Notebook Web Application**
> Hierarchy: **USER → NOTEBOOK (Workspace) → TOPICS (Collaborative Pages) → CANVAS**

Built with **Next.js 16 (App Router + Turbopack)**, **TypeScript**, **Supabase** (Auth, PostgreSQL, RLS, Storage), **Tiptap v3 Rich Text Editor**, **Yjs (CRDTs for Real-Time Multi-User Collaboration)**, **Hocuspocus (WebSocket Collaboration Service)**, and **IndexedDB Offline Persistence**.

---

## 🌟 Implemented Architectural Features

### 1. 🔐 Authentication & Roles
- **Google OAuth**: One single auth system via Supabase Auth + Session middleware.
- **Centralized Permission Engine (`can(role, action, settings)`)**:
  - `OWNER`: Full control, member management, notebook settings, delete/archive.
  - `EDITOR`: Create, edit, rename, move, duplicate topics; upload files; comment. (`editorsCanDelete` setting toggles topic deletion rights).
  - `COMMENTER`: Read topics, post document comments, reply, resolve.
  - `VIEWER`: Read-only access. (`allowViewerDownload` setting toggles file attachment downloading).

### 2. 📁 Notebooks & Topics Hierarchy
- **Notebook Workspace Tabs**:
  - 📑 **Topics**: Drag-and-drop reordering with fractional indexing, emoji icons, inline renaming, deletion.
  - 📂 **Files & Media**: Multi-file upload, drag-and-drop, progress bar, image/PDF lightbox preview modal, secure download.
  - 🕒 **Activity Feed**: Grouped chronological audit log of workspace events (topic creation, edits, uploads, invites).
  - ⚙️ **Notebook Settings**: Rename, icon/color customization, permission toggles (`editorsCanDelete`, `allowViewerDownload`, `allowLinkAccess`), and danger zone trash/archive.

### 3. ✍️ Real-Time Collaborative Editor
- **Tiptap v3 + Yjs + Hocuspocus + IndexedDB**:
  - Offline-first editing with automatic local IndexedDB caching and synchronization upon reconnection.
  - Presence awareness with user avatars, name tags, and distinct remote cursor color highlights.
  - Quick `/` Slash Commands (Headings, Bullet/Task Lists, Code Blocks, Quotes, 3x3 Tables, YouTube Video Embeds).
  - Floating bubble menu on text selection (Bold, Italic, Underline, Strikethrough, Code).
  - Document comments sidebar (threaded discussions, replies, resolution).

### 4. ⚡ Command Palette (`⌘K` / `Ctrl+K`)
- Global keyboard navigation & instant fuzzy search across all notebooks, topics, and actions.
- Quick shortcuts to toggle Dark/Light themes, jump to starred/shared notebooks, or create workspaces.

---

## 🛠️ Quick Setup & Running

### 1. Start the Next.js Web Application

```bash
# Navigate to project
cd /Users/vedant/Desktop/notebook_vdnt

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 2. (Optional) Run the Standalone Hocuspocus Collaboration Server

```bash
npm run start:hocuspocus
```

### 3. Configure Cloud Supabase (When Ready)

1. Open your Supabase Dashboard -> **SQL Editor**.
2. Run the SQL statements provided in [`supabase/schema.sql`](supabase/schema.sql).
3. Paste your project credentials into [`.env.local`](.env.local):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=wss://demos.yjs.dev/ws
```

---

## 📂 Project Structure

```text
notebook_vdnt/
├── src/
│   ├── app/
│   │   ├── auth/callback/route.ts       # Supabase OAuth redirect handler
│   │   ├── dashboard/                   # Main dashboard (Notebooks, Starred, Shared, Trash, Settings)
│   │   ├── notebook/[notebookId]/       # Topic workspace & collaborative editor
│   │   ├── globals.css                  # Design system tokens, Tiptap styles & themes
│   │   ├── layout.tsx                   # Root layout with ThemeProvider, CommandPalette & Toaster
│   │   └── page.tsx                     # Landing page with instant demo access & OAuth
│   ├── components/
│   │   ├── common/                      # CommandPalette (Cmd+K)
│   │   ├── dashboard/                   # Notebook cards, creation modals, dashboard grid
│   │   ├── layout/                      # AppShell, Navigation Sidebar, user menu
│   │   ├── notebook/                    # NotebookShell, TopicList, TopicEditor, EditorToolbar, FilesTab, ActivityTab, SettingsTab, ShareModal
│   │   ├── providers/                   # ThemeProvider (Dark / Light / System)
│   │   └── settings/                    # User Profile & Preferences
│   ├── lib/
│   │   ├── brand.ts                     # Central brand configuration (APP_NAME, TAGLINE, ICONS)
│   │   ├── permissions.ts               # Centralized permission engine can(role, action, settings)
│   │   ├── demoData.ts                  # Mock offline/demo dataset (DAA, Physics, Project workspaces)
│   │   ├── supabase/                    # Client, Server, and Middleware Supabase helpers
│   │   └── utils.ts                     # Presence colors, date formatting, helpers
│   ├── types/                           # TypeScript interfaces for Notebooks, Topics, Files, Comments, etc.
│   └── middleware.ts                    # Auth session refresher and route guard
├── server/
│   └── hocuspocus.mjs                   # Dedicated Node.js WebSocket collaboration server
├── supabase/
│   └── schema.sql                       # Complete 14-table PostgreSQL schema, triggers, and RLS policies
└── next.config.ts
```
