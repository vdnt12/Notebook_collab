'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Share2, Plus, Search, FileText, FolderOpen,
  Activity as ActivityIcon, Settings as SettingsIcon, MoreHorizontal, Sparkles
} from 'lucide-react'
import { TopicList } from './TopicList'
import { TopicEditor } from './TopicEditor'
import { ShareModal } from './ShareModal'
import { FilesTab } from './FilesTab'
import { ActivityTab } from './ActivityTab'
import { NotebookSettingsTab } from './NotebookSettingsTab'
import { getInitials } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_NOTEBOOK_SETTINGS } from '@/lib/permissions'
import toast from 'react-hot-toast'
import type { Notebook, Topic, NotebookMember, Profile, NotebookRole } from '@/types'

interface NotebookShellProps {
  notebook: Notebook & { user_role: NotebookRole }
  topics: Topic[]
  members: NotebookMember[]
  currentUser: Profile | null
  userId: string
}

type NotebookTab = 'topics' | 'files' | 'activity' | 'settings'

export function NotebookShell({
  notebook: initialNotebook,
  topics: initialTopics,
  members,
  currentUser,
  userId,
}: NotebookShellProps) {
  const router = useRouter()
  const [currentNotebook, setCurrentNotebook] = useState(initialNotebook)
  const [activeTab, setActiveTab] = useState<NotebookTab>('topics')
  const [topics, setTopics] = useState(initialTopics)
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(initialTopics[0] || null)
  const [showShare, setShowShare] = useState(false)
  const [topicSearch, setTopicSearch] = useState('')
  const supabase = createClient()

  const userRole = currentNotebook.user_role || 'VIEWER'
  const canEdit = userRole === 'OWNER' || userRole === 'EDITOR'
  const settings = currentNotebook.settings || DEFAULT_NOTEBOOK_SETTINGS

  useEffect(() => {
    if (topics.length > 0 && !selectedTopic) {
      setSelectedTopic(topics[0])
    }
  }, [topics, selectedTopic])

  // Realtime: listen for topic changes
  useEffect(() => {
    try {
      const channel = supabase
        .channel(`notebook-${currentNotebook.id}-topics`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'topics', filter: `notebook_id=eq.${currentNotebook.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newTopic = payload.new as Topic
              setTopics(prev => {
                if (prev.find(t => t.id === newTopic.id)) return prev
                return [...prev, newTopic].sort((a, b) => a.position - b.position)
              })
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Topic
              setTopics(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
              setSelectedTopic(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev)
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as Topic
              setTopics(prev => prev.filter(t => t.id !== deleted.id))
              setSelectedTopic(prev => prev?.id === deleted.id ? null : prev)
            }
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    } catch {
      // Offline fallback
    }
  }, [currentNotebook.id, supabase])

  async function createTopic() {
    if (!canEdit) {
      toast.error("You don't have permission to create topics")
      return
    }

    const newPosition = topics.length

    try {
      const res = await fetch(`/api/notebooks/${currentNotebook.id}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Topic',
          icon: '📄',
          position: newPosition,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create topic')
      }

      setTopics(prev => [...prev, data.topic])
      setSelectedTopic(data.topic)
      setActiveTab('topics')
      toast.success('New topic created!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create topic')
    }
  }

  async function deleteTopic(topicId: string) {
    if (userRole !== 'OWNER' && !settings.editorsCanDelete) {
      toast.error('Only the notebook owner can delete topics.')
      return
    }

    try {
      await supabase
        .from('topics')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', topicId)
    } catch {
      // Local fallback
    }

    const remaining = topics.filter(t => t.id !== topicId)
    setTopics(remaining)
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(remaining[0] || null)
    }
    toast.success('Topic removed')
  }

  async function renameTopic(topicId: string, newTitle: string) {
    if (!canEdit) return

    try {
      await supabase.from('topics').update({ title: newTitle }).eq('id', topicId)
    } catch {
      // Local fallback
    }

    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, title: newTitle } : t))
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(prev => prev ? { ...prev, title: newTitle } : null)
    }
  }

  const filteredTopics = topics.filter(t =>
    t.title.toLowerCase().includes(topicSearch.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'hsl(var(--background))' }}>
      {/* Top Header Bar */}
      <header style={{
        height: 52,
        borderBottom: '1px solid hsl(var(--border))',
        background: 'hsl(var(--surface))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
      }}>
        {/* Left: Back & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, fontSize: 13, color: 'hsl(var(--muted))' }}
          >
            <ArrowLeft size={15} />
            Dashboard
          </button>

          <div style={{ width: 1, height: 20, background: 'hsl(var(--border))' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: currentNotebook.color || '#6366f1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15,
            }}>
              {currentNotebook.icon || '📓'}
            </div>
            <span style={{ fontWeight: 700, fontSize: 14.5, color: 'hsl(var(--foreground))' }}>
              {currentNotebook.name}
            </span>
            <span className={`badge badge-${userRole.toLowerCase()}`}>
              {userRole}
            </span>
          </div>
        </div>

        {/* Center: Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--surface-2))', padding: 3, borderRadius: 8 }}>
          {[
            { key: 'topics' as NotebookTab, label: 'Topics', icon: FileText },
            { key: 'files' as NotebookTab, label: 'Files & Media', icon: FolderOpen },
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
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  fontSize: 12.5, fontWeight: active ? 600 : 500,
                  background: active ? 'hsl(var(--background))' : 'transparent',
                  color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted))',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right: Members & Share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Member Avatars */}
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
            {members.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                title={m.profile?.name || 'Member'}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'hsl(var(--brand))',
                  border: '2px solid hsl(var(--surface))',
                  marginLeft: i === 0 ? 0 : -8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'white', fontWeight: 700,
                  overflow: 'hidden',
                }}
              >
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  getInitials(m.profile?.name || 'U')
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowShare(true)}
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Share2 size={13} />
            Share
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeTab === 'topics' && (
          <>
            {/* Topics Sidebar */}
            <aside style={{
              width: 280,
              flexShrink: 0,
              borderRight: '1px solid hsl(var(--border))',
              background: 'hsl(var(--surface))',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}>
              {/* Search topics */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid hsl(var(--border))' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted))' }} />
                  <input
                    value={topicSearch}
                    onChange={e => setTopicSearch(e.target.value)}
                    placeholder="Search topics…"
                    style={{
                      width: '100%', padding: '6px 8px 6px 28px',
                      borderRadius: 6, border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
                      fontSize: 12.5, outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Topics list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 8px 8px', fontSize: 11.5, fontWeight: 600,
                  color: 'hsl(var(--muted-light))', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  <span>Topics ({topics.length})</span>
                  {canEdit && (
                    <button
                      onClick={createTopic}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'hsl(var(--brand))', display: 'flex', alignItems: 'center',
                      }}
                      title="Add Topic"
                    >
                      <Plus size={15} />
                    </button>
                  )}
                </div>

                <TopicList
                  topics={filteredTopics}
                  selectedTopicId={selectedTopic?.id || null}
                  onSelect={topic => setSelectedTopic(topic)}
                  onDelete={deleteTopic}
                  onRename={renameTopic}
                  canEdit={canEdit}
                  isOwner={userRole === 'OWNER'}
                />

                {filteredTopics.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'hsl(var(--muted))' }}>
                    <p style={{ fontSize: 13, marginBottom: 12 }}>No topics found</p>
                    {canEdit && (
                      <button
                        onClick={createTopic}
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '6px 14px' }}
                      >
                        <Plus size={13} />
                        Add Topic
                      </button>
                    )}
                  </div>
                )}
              </div>
            </aside>

            {/* Topic Editor Area */}
            <main style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {selectedTopic ? (
                <TopicEditor
                  key={selectedTopic.id}
                  topic={selectedTopic}
                  canEdit={canEdit}
                  userRole={userRole}
                  currentUser={currentUser}
                  notebookId={currentNotebook.id}
                />
              ) : (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'hsl(var(--muted))', gap: 12,
                }}>
                  <div style={{ fontSize: 44 }}>📄</div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Select or create a topic</div>
                  <p style={{ fontSize: 13.5, maxWidth: 300, textAlign: 'center' }}>
                    Choose a topic from the sidebar or click &ldquo;+&rdquo; to start writing.
                  </p>
                  {canEdit && (
                    <button onClick={createTopic} className="btn btn-primary" style={{ marginTop: 8 }}>
                      <Plus size={16} />
                      Create New Topic
                    </button>
                  )}
                </div>
              )}
            </main>
          </>
        )}

        {activeTab === 'files' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <FilesTab
              notebookId={currentNotebook.id}
              userRole={userRole}
              settings={settings}
            />
          </div>
        )}

        {activeTab === 'activity' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ActivityTab notebookName={currentNotebook.name} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <NotebookSettingsTab
              notebook={currentNotebook}
              onUpdate={updated => setCurrentNotebook(prev => ({ ...prev, ...updated }))}
            />
          </div>
        )}
      </div>

      {/* Share Modal */}
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
