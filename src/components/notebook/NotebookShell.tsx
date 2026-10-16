'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Share2, Plus, Search, FileText, FolderOpen,
  Activity as ActivityIcon, Settings as SettingsIcon, MoreHorizontal,
  ChevronRight, PanelLeft, Moon, Sun, Lock
} from 'lucide-react'
import { TopicList } from './TopicList'
import { TopicEditor } from './TopicEditor'
import { ShareModal } from './ShareModal'
import { FilesTab } from './FilesTab'
import { ActivityTab } from './ActivityTab'
import { NotebookSettingsTab } from './NotebookSettingsTab'
import { NotebookLogo } from '@/components/common/NotebookLogo'
import { getInitials } from '@/lib/utils'
import { DEFAULT_NOTEBOOK_SETTINGS } from '@/lib/permissions'
import { useTheme } from '@/components/providers/ThemeProvider'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import type { Notebook, Topic, NotebookMember, Profile, NotebookRole } from '@/types'

interface NotebookShellProps {
  notebook: Notebook & { user_role: NotebookRole }
  topics: Topic[]
  members: NotebookMember[]
  currentUser: Profile | null
  userId: string
}

type NotebookTab = 'note' | 'files' | 'activity' | 'settings'

export function NotebookShell({
  notebook: initialNotebook,
  topics: initialTopics,
  members,
  currentUser,
  userId,
}: NotebookShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTheme, resolvedTheme } = useTheme()

  const [currentNotebook, setCurrentNotebook] = useState(initialNotebook)
  const [topics, setTopics] = useState(initialTopics)
  const [onlineUsers, setOnlineUsers] = useState<Array<{ id: string; name: string; avatar_url?: string }>>([])
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(() => {
    const topicIdFromUrl = searchParams.get('topicId')
    if (topicIdFromUrl) {
      const match = initialTopics.find(t => t.id === topicIdFromUrl)
      if (match) return match
    }
    return initialTopics[0] || null
  })

  const [activeTab, setActiveTab] = useState<NotebookTab>('note')
  const [showShare, setShowShare] = useState(false)
  const [topicSearch, setTopicSearch] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const userRole = currentNotebook.user_role || 'VIEWER'
  const canEdit = userRole === 'OWNER' || userRole === 'EDITOR'
  const settings = currentNotebook.settings || DEFAULT_NOTEBOOK_SETTINGS

  // Supabase Realtime for Presence and Live Topic Updates (Section 20 & 21)
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const supabase = createClient()
    const channelName = `notebook:${currentNotebook.id}`
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: userId },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: Array<{ id: string; name: string; avatar_url?: string }> = []
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id && !users.some(u => u.id === p.user_id)) {
              users.push({
                id: p.user_id,
                name: p.name || 'Collaborator',
                avatar_url: p.avatar_url || undefined,
              })
            }
          })
        })
        setOnlineUsers(users)
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'topics',
          filter: `notebook_id=eq.${currentNotebook.id}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setTopics(prev => {
              if (prev.some(t => t.id === payload.new.id)) return prev
              return [...prev, payload.new as Topic]
            })
          } else if (payload.eventType === 'UPDATE') {
            setTopics(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t))
            setSelectedTopic(prev => prev && prev.id === payload.new.id ? { ...prev, ...payload.new } : prev)
          } else if (payload.eventType === 'DELETE') {
            setTopics(prev => prev.filter(t => t.id !== payload.old.id))
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            name: currentUser?.name || 'User',
            avatar_url: currentUser?.avatar_url || null,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentNotebook.id, userId, currentUser])

  // Sync selectedTopic when searchParams change
  useEffect(() => {
    const topicIdFromUrl = searchParams.get('topicId')
    if (topicIdFromUrl && topics.length > 0) {
      const match = topics.find(t => t.id === topicIdFromUrl)
      if (match && match.id !== selectedTopic?.id) {
        setSelectedTopic(match)
        setActiveTab('note')
      }
    } else if (!selectedTopic && topics.length > 0) {
      setSelectedTopic(topics[0])
    }
  }, [searchParams, topics, selectedTopic])

  // Instant topic creation (Section 26)
  const createTopic = async () => {
    if (!canEdit) {
      toast.error("You don't have permission to create notes")
      return
    }

    const newPosition = Date.now()

    try {
      const res = await fetch(`/api/notebooks/${currentNotebook.id}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Note',
          icon: '📄',
          position: newPosition,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create note')
      }

      setTopics(prev => [...prev, data.topic])
      setSelectedTopic(data.topic)
      setActiveTab('note')
      window.dispatchEvent(new CustomEvent('notebooks-updated'))
      toast.success('Note created')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create note')
    }
  }

  const deleteTopic = async (topicId: string) => {
    if (userRole !== 'OWNER' && !settings.editorsCanDelete) {
      toast.error('Only the notebook owner can delete notes.')
      return
    }

    try {
      await fetch(`/api/topics/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_at: true }),
      })
    } catch {
      // Fallback
    }

    const remaining = topics.filter(t => t.id !== topicId)
    setTopics(remaining)
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(remaining[0] || null)
    }
    window.dispatchEvent(new CustomEvent('notebooks-updated'))
    toast.success('Note removed')
  }

  const renameTopic = async (topicId: string, newTitle: string) => {
    if (!canEdit) return

    try {
      await fetch(`/api/topics/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
    } catch {
      // Fallback
    }

    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, title: newTitle } : t))
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(prev => prev ? { ...prev, title: newTitle } : null)
    }
    window.dispatchEvent(new CustomEvent('notebooks-updated'))
  }

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  }

  const filteredTopics = topics.filter(t =>
    t.title.toLowerCase().includes(topicSearch.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--background)' }}>
      {/* 1. Top Bar Navigation (Section 7) */}
      <header className="notebook-topbar">
        {/* Left: Breadcrumbs [Notebook logo] > [Notebook Name] > [Topic] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Link
            href="/dashboard"
            className="btn-ghost btn-sm"
            style={{
              padding: '4px 6px',
              gap: 6,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <NotebookLogo size={16} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 550 }}>Notebook</span>
          </Link>

          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>

          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}>
            <span>{currentNotebook.icon || '📓'}</span>
            <span>{currentNotebook.name}</span>
          </span>

          {selectedTopic && activeTab === 'note' && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>
              <span style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {selectedTopic.title}
              </span>
            </>
          )}
        </div>

        {/* Center: Minimal Section Switcher */}
        <div style={{
          display: 'flex',
          gap: 2,
          padding: 2,
          borderRadius: 'var(--radius-md)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}>
          {[
            { key: 'note' as NotebookTab, label: 'Note', icon: FileText },
            { key: 'files' as NotebookTab, label: 'Files', icon: FolderOpen },
            { key: 'activity' as NotebookTab, label: 'Activity', icon: ActivityIcon },
            { key: 'settings' as NotebookTab, label: 'Settings', icon: SettingsIcon },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  background: active ? 'var(--background)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Right: Search, Collaborators Avatars, Share (Section 20) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={openSearch}
            className="btn btn-secondary btn-sm"
            style={{
              height: 28,
              padding: '0 8px',
              fontSize: 12,
              gap: 5,
              color: 'var(--text-secondary)',
            }}
          >
            <Search size={12} />
            <kbd style={{ fontSize: 10, fontFamily: 'inherit', opacity: 0.7 }}>⌘K</kbd>
          </button>

          {/* Overlapping member / online presence avatars (Section 20 & 21) */}
          <div className="avatar-stack" onClick={() => setShowShare(true)} style={{ cursor: 'pointer' }} title="Collaborators">
            {onlineUsers.length > 0 ? (
              onlineUsers.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  className="avatar-stack-item"
                  title={`${u.name} (Online)`}
                  style={{ position: 'relative' }}
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    getInitials(u.name || 'U')
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--success)',
                      border: '1.5px solid var(--background)',
                    }}
                  />
                </div>
              ))
            ) : (
              members.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="avatar-stack-item"
                  title={m.profile?.name || 'Member'}
                >
                  {m.profile?.avatar_url ? (
                    <img src={m.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    getInitials(m.profile?.name || 'U')
                  )}
                </div>
              ))
            )}
            {Math.max(members.length, onlineUsers.length) > 3 && (
              <div
                className="avatar-stack-item"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 10 }}
              >
                +{Math.max(members.length, onlineUsers.length) - 3}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowShare(true)}
            className="btn btn-primary btn-sm"
            style={{ gap: 5, height: 28 }}
          >
            <Share2 size={12} />
            <span>Share</span>
          </button>

          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="btn-ghost btn-icon"
            style={{ width: 28, height: 28 }}
            title="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </header>

      {/* 2. Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeTab === 'note' && (
          <>
            {/* Collapsible Topics Sidebar (Section 9, 11) */}
            <aside
              style={{
                width: sidebarCollapsed ? 0 : 250,
                borderRight: sidebarCollapsed ? 'none' : '1px solid var(--border)',
                background: 'var(--sidebar)',
                display: sidebarCollapsed ? 'none' : 'flex',
                flexDirection: 'column',
                height: '100%',
                transition: 'width var(--transition-normal)',
                userSelect: 'none',
              }}
            >
              {/* Search filter in notebook topics */}
              <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={12}
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    value={topicSearch}
                    onChange={e => setTopicSearch(e.target.value)}
                    placeholder="Filter pages…"
                    style={{
                      width: '100%',
                      padding: '5px 8px 5px 26px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              {/* Topics list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px 6px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  <span>Pages ({topics.length})</span>
                  {canEdit && (
                    <button
                      onClick={createTopic}
                      className="btn-ghost"
                      style={{ padding: 2, borderRadius: 4 }}
                      title="New Note"
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>

                <TopicList
                  topics={filteredTopics}
                  selectedTopicId={selectedTopic?.id || null}
                  onSelect={t => setSelectedTopic(t)}
                  onDelete={deleteTopic}
                  onRename={renameTopic}
                  canEdit={canEdit}
                  isOwner={userRole === 'OWNER'}
                />

                {filteredTopics.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: 12.5, marginBottom: 8 }}>No pages found</p>
                    {canEdit && (
                      <button
                        onClick={createTopic}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11.5 }}
                      >
                        <Plus size={12} /> Add Page
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom toggle */}
              <div style={{
                padding: '8px 10px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="btn-ghost btn-sm"
                  style={{ fontSize: 11.5, gap: 4, padding: '2px 6px' }}
                >
                  <PanelLeft size={12} />
                  <span>Hide pages</span>
                </button>

                {canEdit && (
                  <button
                    onClick={createTopic}
                    className="btn-ghost btn-sm"
                    style={{ fontSize: 11.5, gap: 4, padding: '2px 6px' }}
                  >
                    <Plus size={12} />
                    <span>New</span>
                  </button>
                )}
              </div>
            </aside>

            {/* Main Note Canvas */}
            <main style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {sidebarCollapsed && (
                <div style={{ padding: '8px 16px 0' }}>
                  <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="btn-ghost btn-sm"
                    style={{ fontSize: 12, gap: 5 }}
                  >
                    <PanelLeft size={13} />
                    <span>Show pages</span>
                  </button>
                </div>
              )}

              {selectedTopic ? (
                <TopicEditor
                  key={selectedTopic.id}
                  topic={selectedTopic}
                  canEdit={canEdit}
                  userRole={userRole}
                  currentUser={currentUser}
                  notebookId={currentNotebook.id}
                  onTitleChange={newTitle => {
                    setTopics(prev => prev.map(t => t.id === selectedTopic.id ? { ...t, title: newTitle } : t))
                  }}
                  onIconChange={newIcon => {
                    setTopics(prev => prev.map(t => t.id === selectedTopic.id ? { ...t, icon: newIcon } : t))
                  }}
                />
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  gap: 12,
                }}>
                  <div style={{ fontSize: 36 }}>✦</div>
                  <div style={{ fontSize: 15, fontWeight: 550, color: 'var(--text-primary)' }}>
                    Nothing here yet
                  </div>
                  <p style={{ fontSize: 13, maxWidth: 300, textAlign: 'center' }}>
                    Create your first note to get started.
                  </p>
                  {canEdit && (
                    <button onClick={createTopic} className="btn btn-primary btn-sm">
                      <Plus size={13} />
                      <span>New Note</span>
                    </button>
                  )}
                </div>
              )}
            </main>
          </>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <FilesTab
              notebookId={currentNotebook.id}
              userRole={userRole}
              settings={settings}
            />
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ActivityTab notebookId={currentNotebook.id} notebookName={currentNotebook.name} />
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <NotebookSettingsTab
              notebook={currentNotebook}
              onUpdate={updated => setCurrentNotebook(prev => ({ ...prev, ...updated }))}
            />
          </div>
        )}
      </div>

      {/* Share Modal (Section 20) */}
      {showShare && (
        <ShareModal
          notebook={currentNotebook}
          members={members}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}
