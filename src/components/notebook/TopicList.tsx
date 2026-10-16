'use client'

import React, { useState } from 'react'
import { Trash2, Edit3, Check, X, MoreHorizontal, Copy } from 'lucide-react'
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

  const handleRename = (topic: Topic) => {
    setEditingId(topic.id)
    setEditTitle(topic.title)
    setMenuOpenId(null)
  }

  const submitRename = (topic: Topic) => {
    if (!editTitle.trim()) {
      setEditingId(null)
      return
    }
    onRename(topic.id, editTitle.trim())
    setEditingId(null)
  }

  const handleDelete = (topic: Topic) => {
    setMenuOpenId(null)
    if (!confirm(`Move "${topic.title}" to trash?`)) return
    onDelete(topic.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {topics.map(topic => {
        const isSelected = selectedTopicId === topic.id
        const isEditing = editingId === topic.id

        return (
          <div
            key={topic.id}
            className={`sidebar-item-row ${isSelected ? 'active' : ''}`}
            onClick={() => { if (!isEditing) onSelect(topic) }}
            style={{
              justifyContent: 'space-between',
              padding: '5px 8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 13.5, flexShrink: 0 }}>{topic.icon || '📄'}</span>

              {isEditing ? (
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
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                />
              ) : (
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 13,
                  fontWeight: isSelected ? 550 : 450,
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {topic.title}
                </span>
              )}
            </div>

            {/* Actions */}
            {canEdit && isEditing ? (
              <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => submitRename(topic)}
                  className="btn-ghost"
                  style={{ padding: 2, color: 'var(--success)' }}
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="btn-ghost"
                  style={{ padding: 2 }}
                >
                  <X size={12} />
                </button>
              </div>
            ) : canEdit && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setMenuOpenId(menuOpenId === topic.id ? null : topic.id)
                  }}
                  className="sidebar-action-btn"
                  style={{ opacity: menuOpenId === topic.id ? 1 : undefined }}
                >
                  <MoreHorizontal size={13} />
                </button>

                {menuOpenId === topic.id && (
                  <>
                    <div
                      onClick={e => { e.stopPropagation(); setMenuOpenId(null) }}
                      style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                    />
                    <div
                      className="menu-dropdown"
                      style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        className="menu-item"
                        onClick={() => handleRename(topic)}
                      >
                        <Edit3 size={12} /> Rename
                      </button>
                      {(isOwner || canEdit) && (
                        <button
                          className="menu-item menu-item-danger"
                          onClick={() => handleDelete(topic)}
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
        )
      })}
    </div>
  )
}
