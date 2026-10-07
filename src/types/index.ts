export type NotebookRole = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED'

export interface Profile {
  id: string
  google_id: string | null
  name: string
  email: string
  avatar_url: string | null
  created_at: string
  updated_at: string
  last_active_at: string | null
}

export interface NotebookSettings {
  editorsCanDelete: boolean
  allowViewerDownload: boolean
  allowLinkAccess: boolean
}

export interface Notebook {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  owner_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by?: string | null
  settings?: NotebookSettings
  // Joined fields
  owner?: Profile
  member_count?: number
  topic_count?: number
  user_role?: NotebookRole
  is_starred?: boolean
}

export interface NotebookMember {
  id: string
  notebook_id: string
  user_id: string
  role: NotebookRole
  created_at: string
  updated_at: string
  // Joined
  profile?: Profile
}

export interface Topic {
  id: string
  notebook_id: string
  title: string
  icon: string
  parent_id?: string | null
  position: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  deleted_by?: string | null
  content?: unknown
  content_text?: string
  // Joined
  creator?: Profile
  is_starred?: boolean
}

export interface NotebookFile {
  id: string
  notebook_id: string
  uploaded_by: string
  original_name: string
  storage_key: string
  mime_declared: string
  mime_detected?: string
  size: number
  sha256?: string
  status: 'uploading' | 'ready' | 'blocked'
  preview_url?: string
  created_at: string
  deleted_at?: string | null
  // Joined
  uploader?: Profile
}

export interface Comment {
  id: string
  notebook_id: string
  topic_id: string
  author_id: string
  content: string
  resolved: boolean
  parent_id?: string | null
  created_at: string
  updated_at: string
  // Joined
  author?: Profile
  replies?: Comment[]
}

export interface Invitation {
  id: string
  notebook_id: string
  inviter_id: string
  invitee_email: string
  invitee_user_id: string | null
  role: NotebookRole
  status: InvitationStatus
  token_hash?: string
  created_at: string
  expires_at: string
  // Joined
  notebook?: Notebook
  inviter?: Profile
}

export interface Activity {
  id: string
  notebook_id: string
  topic_id?: string | null
  user_id: string
  action: string
  metadata?: Record<string, unknown>
  created_at: string
  // Joined
  profile?: Profile
}
