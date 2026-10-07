'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, MoreHorizontal, Trash2, Edit3, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime, getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Notebook } from '@/types'

interface NotebookCardProps {
  notebook: Notebook
  onDeleted: (id: string) => void
  onUpdated: (nb: Notebook) => void
}

export function NotebookCard({ notebook, onDeleted, onUpdated }: NotebookCardProps) {
  const router = useRouter()
  const [isStarred, setIsStarred] = useState(notebook.is_starred)
  const [showMenu, setShowMenu] = useState(false)
  const supabase = createClient()

  async function handleStar(e: React.MouseEvent) {
    e.stopPropagation()
    const newStarred = !isStarred
    setIsStarred(newStarred)

    if (newStarred) {
      await supabase.from('starred_notebooks').insert({ notebook_id: notebook.id })
    } else {
      await supabase.from('starred_notebooks').delete()
        .match({ notebook_id: notebook.id })
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setShowMenu(false)

    if (!confirm(`Delete "${notebook.name}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/notebooks/${notebook.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete notebook')
      }
      toast.success('Notebook deleted')
      onDeleted(notebook.id)
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete notebook')
    }
  }

  function handleOpen() {
    router.push(`/notebook/${notebook.id}`)
  }

  const color = notebook.color || '#6366f1'
  const memberCount = notebook.member_count || 0
  const topicCount = notebook.topic_count || 0

  return (
    <div
      className="notebook-card animate-fade-in"
      onClick={handleOpen}
      style={{ cursor: 'pointer' }}
    >
      {/* Color stripe */}
      <div style={{
        height: 4,
        borderRadius: '6px 6px 0 0',
        background: color,
        margin: '-20px -20px 16px',
        opacity: 0.8,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          {notebook.icon}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleStar}
            className="btn btn-ghost btn-icon"
            title={isStarred ? 'Unstar' : 'Star'}
          >
            <Star
              size={14}
              fill={isStarred ? '#f59e0b' : 'none'}
              stroke={isStarred ? '#f59e0b' : 'currentColor'}
            />
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setShowMenu(!showMenu) }}
              className="btn btn-ghost btn-icon"
            >
              <MoreHorizontal size={14} />
            </button>
            {showMenu && (
              <>
                <div
                  onClick={e => { e.stopPropagation(); setShowMenu(false) }}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />
                <div style={{
                  position: 'absolute', right: 0, top: '100%',
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 10,
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 50, minWidth: 160, overflow: 'hidden',
                  marginTop: 4,
                }}>
                  <button
                    onClick={e => { e.stopPropagation(); handleOpen(); setShowMenu(false) }}
                    style={menuItemStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--surface))')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Edit3 size={13} /> Open
                  </button>
                  {notebook.user_role === 'OWNER' && (
                    <button
                      onClick={handleDelete}
                      style={{ ...menuItemStyle, color: 'hsl(0 84% 60%)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'hsl(0 84% 60% / 0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Name & description */}
      <h3 style={{ fontWeight: 650, fontSize: 15.5, marginBottom: 4, color: 'hsl(var(--foreground))', lineHeight: 1.3 }}>
        {notebook.name}
      </h3>
      {notebook.description && (
        <p style={{ fontSize: 13, color: 'hsl(var(--muted))', marginBottom: 14, lineHeight: 1.5 }}>
          {notebook.description.length > 70
            ? notebook.description.slice(0, 70) + '…'
            : notebook.description}
        </p>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 'auto', paddingTop: 14,
        borderTop: '1px solid hsl(var(--border))',
        fontSize: 12.5, color: 'hsl(var(--muted))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={12} />
          {memberCount + 1} member{memberCount !== 0 ? 's' : ''}
          · {topicCount} topic{topicCount !== 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className={`badge badge-${notebook.user_role?.toLowerCase()}`}>
            {notebook.user_role}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 11.5, color: 'hsl(var(--muted-light))' }}>
        Updated {formatRelativeTime(notebook.updated_at)}
      </div>
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 13.5,
  color: 'hsl(var(--foreground))',
  textAlign: 'left',
  transition: 'background 0.1s ease',
}
