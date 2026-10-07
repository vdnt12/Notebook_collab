import type { NotebookRole, NotebookSettings } from '@/types'

export type Action =
  | 'notebook:view'
  | 'notebook:edit'
  | 'notebook:delete'
  | 'notebook:restore'
  | 'notebook:manage_members'
  | 'notebook:change_roles'
  | 'notebook:transfer_ownership'
  | 'notebook:settings'
  | 'topic:view'
  | 'topic:create'
  | 'topic:edit'
  | 'topic:rename'
  | 'topic:duplicate'
  | 'topic:reorder'
  | 'topic:delete'
  | 'comment:view'
  | 'comment:create'
  | 'comment:reply'
  | 'comment:resolve'
  | 'comment:delete'
  | 'file:view'
  | 'file:upload'
  | 'file:download'
  | 'file:delete'

export const ROLE_HIERARCHY: Record<NotebookRole, number> = {
  OWNER: 4,
  EDITOR: 3,
  COMMENTER: 2,
  VIEWER: 1,
}

export const DEFAULT_NOTEBOOK_SETTINGS: NotebookSettings = {
  editorsCanDelete: false,
  allowViewerDownload: true,
  allowLinkAccess: false,
}

/**
 * Central permission check function.
 * can(role, action, settings) -> boolean
 */
export function can(
  role: NotebookRole | null | undefined,
  action: Action,
  settings: NotebookSettings = DEFAULT_NOTEBOOK_SETTINGS
): boolean {
  if (!role) return false

  switch (action) {
    // Notebook actions
    case 'notebook:view':
      return true
    case 'notebook:edit':
    case 'notebook:settings':
    case 'notebook:manage_members':
    case 'notebook:change_roles':
    case 'notebook:delete':
    case 'notebook:restore':
    case 'notebook:transfer_ownership':
      return role === 'OWNER'

    // Topic actions
    case 'topic:view':
      return true
    case 'topic:create':
    case 'topic:edit':
    case 'topic:rename':
    case 'topic:duplicate':
    case 'topic:reorder':
      return role === 'OWNER' || role === 'EDITOR'
    case 'topic:delete':
      if (role === 'OWNER') return true
      if (role === 'EDITOR') return settings.editorsCanDelete
      return false

    // Comment actions
    case 'comment:view':
      return true
    case 'comment:create':
    case 'comment:reply':
    case 'comment:resolve':
      return role === 'OWNER' || role === 'EDITOR' || role === 'COMMENTER'
    case 'comment:delete':
      return role === 'OWNER'

    // File actions
    case 'file:view':
      return true
    case 'file:upload':
      return role === 'OWNER' || role === 'EDITOR'
    case 'file:download':
      if (role === 'VIEWER') return settings.allowViewerDownload
      return true
    case 'file:delete':
      return role === 'OWNER' || (role === 'EDITOR' && settings.editorsCanDelete)

    default:
      return false
  }
}
