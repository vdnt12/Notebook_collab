'use client'

import { Clock, Plus, Edit3, Trash2, UserPlus, Shield, FileUp } from 'lucide-react'
import type { Activity } from '@/types'

interface ActivityTabProps {
  notebookName: string
}

const SAMPLE_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    notebook_id: 'nb-daa',
    user_id: 'user-1',
    action: 'created_topic',
    metadata: { topicTitle: 'Sorting Algorithms' },
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    profile: { id: 'user-1', google_id: null, name: 'Vedant', email: 'vedant@example.com', avatar_url: null, created_at: '', updated_at: '', last_active_at: null },
  },
  {
    id: 'act-2',
    notebook_id: 'nb-daa',
    user_id: 'user-2',
    action: 'edited_topic',
    metadata: { topicTitle: 'Graph Algorithms' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    profile: { id: 'user-2', google_id: null, name: 'Alex Chen', email: 'alex@example.com', avatar_url: null, created_at: '', updated_at: '', last_active_at: null },
  },
  {
    id: 'act-3',
    notebook_id: 'nb-daa',
    user_id: 'user-1',
    action: 'uploaded_file',
    metadata: { fileName: 'algorithms_cheatsheet.pdf' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    profile: { id: 'user-1', google_id: null, name: 'Vedant', email: 'vedant@example.com', avatar_url: null, created_at: '', updated_at: '', last_active_at: null },
  },
  {
    id: 'act-4',
    notebook_id: 'nb-daa',
    user_id: 'user-1',
    action: 'invited_member',
    metadata: { email: 'alex@example.com', role: 'EDITOR' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    profile: { id: 'user-1', google_id: null, name: 'Vedant', email: 'vedant@example.com', avatar_url: null, created_at: '', updated_at: '', last_active_at: null },
  },
]

export function ActivityTab({ notebookName }: ActivityTabProps) {
  function getActionIcon(action: string) {
    switch (action) {
      case 'created_topic':
        return <Plus size={14} style={{ color: '#10b981' }} />
      case 'edited_topic':
        return <Edit3 size={14} style={{ color: '#6366f1' }} />
      case 'uploaded_file':
        return <FileUp size={14} style={{ color: '#ec4899' }} />
      case 'invited_member':
        return <UserPlus size={14} style={{ color: '#f59e0b' }} />
      default:
        return <Clock size={14} style={{ color: 'hsl(var(--muted))' }} />
    }
  }

  function getActionDescription(act: Activity) {
    const name = act.profile?.name || 'Someone'
    switch (act.action) {
      case 'created_topic':
        return (
          <>
            <strong>{name}</strong> created topic <span style={{ color: 'hsl(var(--brand))' }}>&ldquo;{String(act.metadata?.topicTitle || 'Untitled')}&rdquo;</span>
          </>
        )
      case 'edited_topic':
        return (
          <>
            <strong>{name}</strong> updated notes in <span style={{ color: 'hsl(var(--brand))' }}>&ldquo;{String(act.metadata?.topicTitle || 'Topic')}&rdquo;</span>
          </>
        )
      case 'uploaded_file':
        return (
          <>
            <strong>{name}</strong> attached file <code>{String(act.metadata?.fileName || 'file')}</code>
          </>
        )
      case 'invited_member':
        return (
          <>
            <strong>{name}</strong> invited <strong>{String(act.metadata?.email)}</strong> as <em>{String(act.metadata?.role)}</em>
          </>
        )
      default:
        return <span>{name} made updates in {notebookName}</span>
    }
  }

  function formatRelative(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 840, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Notebook Activity & History</h2>
      <p style={{ fontSize: 13.5, color: 'hsl(var(--muted))', marginBottom: 28 }}>
        Audit trail of collaborative topic creation, edits, file uploads, and membership events.
      </p>

      <div style={{ position: 'relative', paddingLeft: 20, borderLeft: '2px solid hsl(var(--border))' }}>
        {SAMPLE_ACTIVITIES.map(act => (
          <div key={act.id} style={{ marginBottom: 28, position: 'relative' }}>
            {/* Timeline node */}
            <div style={{
              position: 'absolute', left: -29, top: 2,
              width: 20, height: 20, borderRadius: '50%',
              background: 'hsl(var(--surface))',
              border: '2px solid hsl(var(--border))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {getActionIcon(act.action)}
            </div>

            <div style={{ fontSize: 13.5, color: 'hsl(var(--foreground))', lineHeight: 1.5 }}>
              {getActionDescription(act)}
            </div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted))', marginTop: 4 }}>
              {formatRelative(act.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
