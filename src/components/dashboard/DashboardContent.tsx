'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, ArrowRight, Clock, Star, MoreHorizontal,
  FileText, Folder, BookOpen, Users, Edit3, Trash2
} from 'lucide-react'
import { CreateNotebookModal } from './CreateNotebookModal'
import { formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Notebook, Profile, Topic } from '@/types'

interface RecentTopicItem extends Topic {
  notebook_name?: string
  notebook_icon?: string
}

export interface DashboardContentProps {
  notebooks: Notebook[]
  sharedNotebooks: Notebook[]
  recentTopics?: RecentTopicItem[]
  userId: string
  profile: Profile | null
  greeting: string
}

export function DashboardContent({
  notebooks: initialNotebooks,
  sharedNotebooks,
  recentTopics = [],
  userId,
  profile,
  greeting,
}: DashboardContentProps) {
  const router = useRouter()
  const [notebooks, setNotebooks] = useState(initialNotebooks)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const name = profile?.name ? profile.name.split(' ')[0] : 'there'

  const filteredNotebooks = notebooks.filter(nb =>
    nb.name.toLowerCase().includes(search.toLowerCase()) ||
    (nb.description && nb.description.toLowerCase().includes(search.toLowerCase()))
  )

  const continueTopic = recentTopics[0] || null
  const displayRecentTopics = recentTopics.slice(continueTopic ? 1 : 0, 6)

  const handleNotebookCreated = (nb: Notebook) => {
    setNotebooks(prev => [{ ...nb, user_role: 'OWNER', topic_count: 1, member_count: 1 }, ...prev])
    setShowCreate(false)
    window.dispatchEvent(new CustomEvent('notebooks-updated'))
    toast.success(`Created "${nb.name}"`)
  }

  const handleDeleteNotebook = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    if (!confirm(`Move "${name}" to trash?`)) return

    try {
      const res = await fetch(`/api/notebooks/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setNotebooks(prev => prev.filter(nb => nb.id !== id))
        window.dispatchEvent(new CustomEvent('notebooks-updated'))
        toast.success('Notebook moved to trash')
      }
    } catch {
      toast.error('Failed to delete notebook')
    }
  }

  const handleToggleStar = async (id: string, isStarred: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    try {
      await fetch(`/api/notebooks/${id}/star`, {
        method: isStarred ? 'DELETE' : 'POST',
      })
      setNotebooks(prev => prev.map(nb => nb.id === id ? { ...nb, is_starred: !isStarred } : nb))
      toast.success(isStarred ? 'Removed from favorites' : 'Added to favorites')
    } catch {
      toast.error('Failed to update favorite')
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingTop: 48, paddingBottom: 80 }}>
      {/* 1. Minimal Header (Section 33) */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 650,
          letterSpacing: '-0.025em',
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}>
          {greeting}, {name}.
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Welcome back to your digital desk.
        </p>
      </div>

      {/* 2. Continue where you left off (Section 33) */}
      {continueTopic && (
        <section style={{ marginBottom: 44 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}>
            Continue where you left off
          </div>

          <div
            onClick={() => router.push(`/notebook/${continueTopic.notebook_id}?topicId=${continueTopic.id}`)}
            style={{
              padding: '20px 24px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            className="hover:border-[#C0C0BE] dark:hover:border-[#454545]"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {continueTopic.notebook_icon || '📓'} {continueTopic.notebook_name || 'Notebook'}
                </span>
                <span style={{ color: 'var(--border)' }}>•</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Edited {formatRelativeTime(continueTopic.updated_at)}
                </span>
              </div>

              <div style={{
                fontSize: 19,
                fontWeight: 650,
                color: 'var(--text-primary)',
                letterSpacing: '-0.015em',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>{continueTopic.icon || '📄'}</span>
                <span>{continueTopic.title}</span>
              </div>

              {continueTopic.content_text && (
                <div style={{
                  fontSize: 13.5,
                  color: 'var(--text-secondary)',
                  marginTop: 6,
                  maxWidth: 580,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {continueTopic.content_text}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 550,
            }}>
              <span>Open</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </section>
      )}

      {/* 3. Recent Notes (Section 33) */}
      {displayRecentTopics.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}>
            Recent
          </div>

          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: 'var(--background)',
          }}>
            {displayRecentTopics.map((topic, i) => (
              <div
                key={topic.id}
                onClick={() => router.push(`/notebook/${topic.notebook_id}?topicId=${topic.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
                className="hover:bg-[var(--surface-hover)]"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{topic.icon || '📄'}</span>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {topic.title}
                  </span>
                  <span style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginLeft: 6,
                  }}>
                    in {topic.notebook_name || 'Notebook'}
                  </span>
                </div>

                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {formatRelativeTime(topic.updated_at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. My Notebooks Section (Section 33) */}
      <section style={{ marginBottom: 48 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
          }}>
            My Notebooks
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Minimal search */}
            <div style={{ position: 'relative', width: 200 }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: 9,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                className="input"
                placeholder="Filter notebooks…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  paddingLeft: 28,
                  height: 30,
                  fontSize: 12.5,
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="btn btn-primary btn-sm"
              style={{ gap: 5 }}
            >
              <Plus size={13} />
              <span>New Notebook</span>
            </button>
          </div>
        </div>

        {filteredNotebooks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📓</div>
            <div style={{ fontSize: 14, fontWeight: 550, color: 'var(--text-primary)', marginBottom: 4 }}>
              {search ? 'No notebooks match your filter' : 'No notebooks yet'}
            </div>
            <p style={{ fontSize: 13, marginBottom: 16 }}>
              Create a notebook to organize topics and notes.
            </p>
            <button onClick={() => setShowCreate(true)} className="btn btn-secondary btn-sm">
              <Plus size={13} /> Create Notebook
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}>
            {filteredNotebooks.map(nb => (
              <div
                key={nb.id}
                onClick={() => router.push(`/notebook/${nb.id}`)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 124,
                  position: 'relative',
                }}
                className="hover:border-[#C0C0BE] dark:hover:border-[#454545]"
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--background)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 17,
                    }}>
                      {nb.icon || '📓'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <button
                        onClick={(e) => handleToggleStar(nb.id, Boolean(nb.is_starred), e)}
                        className="btn-ghost btn-icon"
                        style={{ width: 26, height: 26 }}
                        title={nb.is_starred ? 'Favorited' : 'Add to favorites'}
                      >
                        <Star
                          size={13}
                          fill={nb.is_starred ? '#D99000' : 'none'}
                          stroke={nb.is_starred ? '#D99000' : 'var(--text-muted)'}
                        />
                      </button>

                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenId(menuOpenId === nb.id ? null : nb.id)
                          }}
                          className="btn-ghost btn-icon"
                          style={{ width: 26, height: 26 }}
                        >
                          <MoreHorizontal size={13} />
                        </button>

                        {menuOpenId === nb.id && (
                          <>
                            <div
                              onClick={(e) => { e.stopPropagation(); setMenuOpenId(null) }}
                              style={{ position: 'fixed', inset: 0, zIndex: 60 }}
                            />
                            <div
                              className="menu-dropdown"
                              style={{ position: 'absolute', right: 0, top: '100%', marginTop: 2 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="menu-item"
                                onClick={() => router.push(`/notebook/${nb.id}`)}
                              >
                                <Edit3 size={13} /> Open
                              </button>
                              <button
                                className="menu-item menu-item-danger"
                                onClick={(e) => handleDeleteNotebook(nb.id, nb.name, e)}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <h3 style={{
                    fontSize: 15,
                    fontWeight: 650,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                    letterSpacing: '-0.01em',
                  }}>
                    {nb.name}
                  </h3>

                  {nb.description && (
                    <p style={{
                      fontSize: 12.5,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                      marginBottom: 8,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {nb.description}
                    </p>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                }}>
                  <span>{nb.topic_count || 0} page{nb.topic_count !== 1 ? 's' : ''}</span>
                  <span>{formatRelativeTime(nb.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Shared With Me (if any) */}
      {sharedNotebooks.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
            marginBottom: 16,
          }}>
            Shared With Me
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}>
            {sharedNotebooks.map(nb => (
              <div
                key={nb.id}
                onClick={() => router.push(`/notebook/${nb.id}`)}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{nb.icon || '📓'}</span>
                  <span style={{ fontWeight: 650, fontSize: 14.5 }}>{nb.name}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Collaborator · {nb.user_role}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create Notebook Dialog (Section 25) */}
      {showCreate && (
        <CreateNotebookModal
          onClose={() => setShowCreate(false)}
          onCreated={handleNotebookCreated}
          userId={userId}
        />
      )}
    </div>
  )
}
