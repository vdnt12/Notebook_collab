'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Edit3, Trash2, UserPlus, Shield, FileUp, Loader2 } from 'lucide-react'
import { formatRelativeTime, getInitials } from '@/lib/utils'

interface ActivityTabProps {
  notebookId: string
  notebookName: string
}

interface ActivityItem {
  id: string
  notebook_id: string
  actor: string
  action: string
  metadata?: any
  timestamp: string
  actor_name?: string
  actor_avatar?: string
}

export function ActivityTab({ notebookId, notebookName }: ActivityTabProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/notebooks/${notebookId}/activity`)
      const data = await res.json()
      if (res.ok && data.activities) {
        setActivities(data.activities)
      }
    } catch (err) {
      console.error('[ActivityTab load error]', err)
    } finally {
      setLoading(false)
    }
  }, [notebookId])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  function getActionDetails(act: ActivityItem) {
    const meta = typeof act.metadata === 'string' ? JSON.parse(act.metadata) : (act.metadata || {})
    const name = act.actor_name || 'Someone'

    switch (act.action) {
      case 'created_topic':
      case 'CREATE_TOPIC':
        return {
          icon: <Plus size={13} style={{ color: 'var(--success)' }} />,
          text: `${name} created note "${meta.topicTitle || meta.title || 'a note'}"`,
        }
      case 'edited_topic':
      case 'EDIT_TOPIC':
        return {
          icon: <Edit3 size={13} style={{ color: 'var(--accent)' }} />,
          text: `${name} edited "${meta.topicTitle || meta.title || 'a note'}"`,
        }
      case 'uploaded_file':
      case 'UPLOAD_FILE':
        return {
          icon: <FileUp size={13} style={{ color: 'var(--accent)' }} />,
          text: `${name} attached file "${meta.filename || meta.fileName || 'a file'}"`,
        }
      case 'DELETE_FILE':
        return {
          icon: <Trash2 size={13} style={{ color: 'var(--error)' }} />,
          text: `${name} removed file "${meta.filename || 'a file'}"`,
        }
      case 'invited_member':
      case 'INVITE_MEMBER':
        return {
          icon: <UserPlus size={13} style={{ color: '#f59e0b' }} />,
          text: `${name} invited ${meta.email || 'a collaborator'} as ${meta.role || 'viewer'}`,
        }
      default:
        return {
          icon: <Clock size={13} style={{ color: 'var(--text-muted)' }} />,
          text: `${name} updated ${notebookName}`,
        }
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 650, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          Recent Activity
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Chronological timeline of changes and collaboration in {notebookName}
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 8, color: 'var(--text-muted)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Loading activity…</span>
        </div>
      ) : activities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🕘</div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            No recent activity
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Changes made by you or your collaborators will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activities.map(act => {
            const { icon, text } = getActionDetails(act)
            return (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {text}
                  </span>
                </div>

                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 12 }}>
                  {formatRelativeTime(act.timestamp)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
