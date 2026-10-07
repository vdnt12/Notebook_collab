'use client'

import React, { useState } from 'react'
import { Trash2, Edit3, Check, X, MoreHorizontal } from 'lucide-react'
import type { Topic } from '@/types'

interface TopicListProps {
  topics: Topic[]
  selectedTopicId: string | null
  onSelect: (t: Topic) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  canEdit: boolean
  isOwner?: boolean
}

export function TopicList({
  topics,
  selectedTopicId,
  onSelect,
  onDelete,
  onRename,
  canEdit,
  isOwner = false,
}: TopicListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  function handleRename(topic: Topic) {
    setEditingId(topic.id)
    setEditTitle(topic.title)
  }

  function submitRename(topic: Topic) {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    onRename(topic.id, editTitle.trim())
    setEditingId(null)
  }

  function handleDelete(topic: Topic) {
    setMenuOpenId(null)
    if (!confirm(`Delete "${topic.title}"?`)) return
    onDelete(topic.id)
  }

  return (
    <div>
      {topics.map(topic => (
        <div
          key={topic.id}
          className={`topic-item ${selectedTopicId === topic.id ? 'active' : ''}`}
          onClick={() => { if (editingId !== topic.id) onSelect(topic) }}
          style={{ position: 'relative' }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>{topic.icon || '📄'}</span>

          {editingId === topic.id ? (
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitRename(topic)
                if (e.key === 'Escape') setEditingId(null)
              }}
              onClick={e => e.stopPropagation()}
              autoFocus
              style={{
                flex: 1, border: 'none', outline: 'none',
                background: 'transparent', fontSize: 'inherit',
                color: 'inherit', fontFamily: 'inherit',
              }}
            />
          ) : (
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {topic.title}
            </span>
          )}

          {canEdit && editingId === topic.id ? (
            <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
              <button
                onClick={() => submitRename(topic)}
                className="btn btn-ghost btn-icon"
                style={{ padding: 3, color: 'hsl(142 71% 45%)' }}
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="btn btn-ghost btn-icon"
                style={{ padding: 3 }}
              >
                <X size={12} />
              </button>
            </div>
          ) : canEdit && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === topic.id ? null : topic.id) }}
                className="btn btn-ghost btn-icon"
                style={{ padding: 3, opacity: menuOpenId === topic.id ? 1 : 0.6 }}
              >
                <MoreHorizontal size={12} />
              </button>

              {menuOpenId === topic.id && (
                <>
                  <div
                    onClick={e => { e.stopPropagation(); setMenuOpenId(null) }}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  />
                  <div style={{
                    position: 'absolute', right: 0, top: '100%',
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8, zIndex: 50, minWidth: 140,
                    boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
                    marginTop: 4,
                  }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleRename(topic); setMenuOpenId(null) }}
                      style={topicMenuItemStyle}
                    >
                      <Edit3 size={12} /> Rename
                    </button>
                    {isOwner && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(topic) }}
                        style={{ ...topicMenuItemStyle, color: 'hsl(0 84% 60%)' }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const topicMenuItemStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
  padding: '7px 12px', border: 'none', background: 'none',
  cursor: 'pointer', fontSize: 13, color: 'hsl(var(--foreground))', textAlign: 'left',
}
