'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronRight, Plus, Search, Star, Clock, Trash2,
  Settings, LogOut, Moon, Sun, MoreHorizontal,
  FolderPlus, Edit2, Share2, PanelLeftClose, PanelLeft
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { NotebookLogo } from '@/components/common/NotebookLogo'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Profile, Notebook, Topic } from '@/types'

interface SidebarProps {
  profile: Profile | null
  isOpen?: boolean
  onClose?: () => void
  onOpenCreateNotebook?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  initialNotebooks?: Notebook[]
}

interface NotebookWithTopics extends Notebook {
  topics?: Topic[]
}

export function Sidebar({
  profile,
  isOpen = true,
  onClose,
  onOpenCreateNotebook,
  collapsed = false,
  onToggleCollapse,
  initialNotebooks = [],
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()

  const [notebooks, setNotebooks] = useState<NotebookWithTopics[]>(initialNotebooks)
  const [expandedNotebookIds, setExpandedNotebookIds] = useState<Set<string>>(new Set())
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [loading, setLoading] = useState(initialNotebooks.length === 0)

  // Fetch notebooks and topics
  const loadNotebooks = useCallback(async () => {
    try {
      const res = await fetch('/api/notebooks')
      const data = await res.json()
      if (res.ok && data.notebooks) {
        setNotebooks(data.notebooks)
        // Auto-expand active notebook if in URL
        const match = pathname.match(/\/notebook\/([^/]+)/)
        if (match && match[1]) {
          setExpandedNotebookIds(prev => new Set([...prev, match[1]]))
        } else if (data.notebooks.length > 0 && expandedNotebookIds.size === 0) {
          // Default expand first notebook
          setExpandedNotebookIds(new Set([data.notebooks[0].id]))
        }
      }
    } catch (err) {
      console.error('[Sidebar loadNotebooks Error]', err)
    } finally {
      setLoading(false)
    }
  }, [pathname])

  useEffect(() => {
    loadNotebooks()

    const handleUpdate = () => loadNotebooks()
    window.addEventListener('notebooks-updated', handleUpdate)
    return () => window.removeEventListener('notebooks-updated', handleUpdate)
  }, [loadNotebooks])

  // Auto-expand current notebook when pathname changes
  useEffect(() => {
    const match = pathname.match(/\/notebook\/([^/]+)/)
    if (match && match[1]) {
      setExpandedNotebookIds(prev => new Set([...prev, match[1]]))
    }
  }, [pathname])

  const toggleExpand = (notebookId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setExpandedNotebookIds(prev => {
      const next = new Set(prev)
      if (next.has(notebookId)) {
        next.delete(notebookId)
      } else {
        next.add(notebookId)
      }
      return next
    })
  }

  const handleCreateTopic = async (notebookId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled Note',
          icon: '📄',
          position: Date.now(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Note created')
        window.dispatchEvent(new CustomEvent('notebooks-updated'))
        router.push(`/notebook/${notebookId}?topicId=${data.topic.id}`)
      } else {
        throw new Error(data.error || 'Failed to create note')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create note')
    }
  }

  const handleToggleStar = async (notebookId: string, isStarred: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    try {
      await fetch(`/api/notebooks/${notebookId}/star`, {
        method: isStarred ? 'DELETE' : 'POST',
      })
      setNotebooks(prev => prev.map(nb => nb.id === notebookId ? { ...nb, is_starred: !isStarred } : nb))
      toast.success(isStarred ? 'Removed from favorites' : 'Added to favorites')
    } catch {
      toast.error('Failed to update favorite')
    }
  }

  const handleDeleteNotebook = async (notebookId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpenId(null)
    if (!confirm(`Delete "${name}"? This will move it to trash.`)) return

    try {
      const res = await fetch(`/api/notebooks/${notebookId}`, { method: 'DELETE' })
      if (res.ok) {
        setNotebooks(prev => prev.filter(nb => nb.id !== notebookId))
        toast.success('Moved to trash')
        if (pathname.includes(notebookId)) {
          router.push('/dashboard')
        }
      }
    } catch {
      toast.error('Failed to delete notebook')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('[Logout Error]', err)
    }
    router.push('/login')
    router.refresh()
  }

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  }

  const ownedNotebooks = notebooks.filter(nb => nb.user_role === 'OWNER')
  const sharedNotebooks = notebooks.filter(nb => nb.user_role && nb.user_role !== 'OWNER')

  return (
    <aside
      className={`notebook-sidebar ${isOpen ? 'open' : ''}`}
      style={{
        transform: collapsed ? 'translateX(-100%)' : undefined,
      }}
    >
      {/* 1. Header (Brand Logo & Name) */}
      <div className="notebook-sidebar-header">
        <Link
          href="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            textDecoration: 'none',
            color: 'var(--text-primary)',
          }}
        >
          <NotebookLogo size={19} color="var(--accent)" />
          <span style={{ fontWeight: 650, fontSize: 14.5, letterSpacing: '-0.015em' }}>
            Notebook
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="btn-ghost btn-icon"
              title="Collapse sidebar"
              style={{ width: 28, height: 28 }}
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Global Quick Search Button (Section 7, 23) */}
      <div style={{ padding: '10px 10px 6px' }}>
        <button
          onClick={openCommandPalette}
          className="sidebar-item-row"
          style={{
            width: '100%',
            justifyContent: 'space-between',
            border: '1px solid var(--border)',
            background: 'var(--background)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Search</span>
          </div>
          <kbd style={{
            fontSize: 10.5,
            padding: '1px 5px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-muted)',
            fontFamily: 'inherit',
          }}>
            ⌘K
          </kbd>
        </button>
      </div>

      {/* 3. Main Navigation Tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {/* WORKSPACE SECTION */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 }}>
          <div className="sidebar-section-title">Workspace</div>
          <button
            onClick={() => onOpenCreateNotebook ? onOpenCreateNotebook() : router.push('/dashboard')}
            className="sidebar-action-btn"
            style={{ opacity: 1, padding: 3 }}
            title="Create Notebook"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* My Notebooks List with Expansion (Section 11) */}
        <div>
          {ownedNotebooks.map(nb => {
            const isExpanded = expandedNotebookIds.has(nb.id)
            const isCurrentNb = pathname.startsWith(`/notebook/${nb.id}`)

            return (
              <div key={nb.id} style={{ marginBottom: 2 }}>
                {/* Notebook Row */}
                <div
                  className={`sidebar-item-row ${isCurrentNb && !pathname.includes('topicId') ? 'active' : ''}`}
                  onClick={() => router.push(`/notebook/${nb.id}`)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    <button
                      onClick={(e) => toggleExpand(nb.id, e)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <ChevronRight
                        size={13}
                        className={`sidebar-chevron ${isExpanded ? 'expanded' : ''}`}
                      />
                    </button>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>{nb.icon || '📓'}</span>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 13.5,
                    }}>
                      {nb.name}
                    </span>
                  </div>

                  {/* Actions on hover */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      onClick={(e) => handleCreateTopic(nb.id, e)}
                      className="sidebar-action-btn"
                      title="New Page"
                    >
                      <Plus size={12} />
                    </button>

                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(menuOpenId === nb.id ? null : nb.id)
                        }}
                        className="sidebar-action-btn"
                        title="More options"
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
                              onClick={() => { router.push(`/notebook/${nb.id}`); setMenuOpenId(null) }}
                            >
                              <Edit2 size={13} /> Open
                            </button>
                            <button
                              className="menu-item"
                              onClick={(e) => handleToggleStar(nb.id, Boolean(nb.is_starred), e)}
                            >
                              <Star size={13} /> {nb.is_starred ? 'Remove favorite' : 'Add to favorites'}
                            </button>
                            <button
                              className="menu-item menu-item-danger"
                              onClick={(e) => handleDeleteNotebook(nb.id, nb.name, e)}
                            >
                              <Trash2 size={13} /> Move to Trash
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nested Topics (Pages) */}
                {isExpanded && nb.topics && nb.topics.length > 0 && (
                  <div style={{
                    paddingLeft: 22,
                    marginLeft: 10,
                    borderLeft: '1px solid var(--border)',
                    marginTop: 2,
                    marginBottom: 4,
                  }}>
                    {nb.topics.map(topic => {
                      const isActiveTopic = pathname.includes(`/notebook/${nb.id}`) && (
                        typeof window !== 'undefined' && window.location.search.includes(`topicId=${topic.id}`)
                      )

                      return (
                        <Link
                          key={topic.id}
                          href={`/notebook/${nb.id}?topicId=${topic.id}`}
                          className={`sidebar-item-row ${isActiveTopic ? 'active' : ''}`}
                          style={{
                            fontSize: 13,
                            padding: '4px 8px',
                            gap: 7,
                          }}
                        >
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{topic.icon || '📄'}</span>
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {topic.title || 'Untitled'}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Quick "+ New Notebook" link (Section 9) */}
          <button
            onClick={() => onOpenCreateNotebook ? onOpenCreateNotebook() : router.push('/dashboard')}
            className="sidebar-item-row"
            style={{
              width: '100%',
              color: 'var(--text-muted)',
              fontSize: 13,
              marginTop: 4,
              border: 'none',
              background: 'transparent',
            }}
          >
            <Plus size={14} />
            <span>New Notebook</span>
          </button>
        </div>

        {/* SHARED SECTION (Section 9) */}
        {sharedNotebooks.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="sidebar-section-title">Shared</div>
            {sharedNotebooks.map(nb => (
              <Link
                key={nb.id}
                href={`/notebook/${nb.id}`}
                className={`sidebar-item-row ${pathname.startsWith(`/notebook/${nb.id}`) ? 'active' : ''}`}
              >
                <span style={{ fontSize: 13 }}>{nb.icon || '📓'}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5 }}>
                  {nb.name}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* QUICK ACCESS SECTION (Section 9) */}
        <div style={{ marginTop: 18 }}>
          <div className="sidebar-section-title">Quick Access</div>

          <Link
            href="/dashboard/starred"
            className={`sidebar-item-row ${pathname === '/dashboard/starred' ? 'active' : ''}`}
          >
            <Star size={14} style={{ color: 'var(--text-muted)' }} />
            <span>Favorites</span>
          </Link>

          <Link
            href="/dashboard"
            className={`sidebar-item-row ${pathname === '/dashboard' ? 'active' : ''}`}
          >
            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
            <span>Recent</span>
          </Link>

          <Link
            href="/dashboard/trash"
            className={`sidebar-item-row ${pathname === '/dashboard/trash' ? 'active' : ''}`}
          >
            <Trash2 size={14} style={{ color: 'var(--text-muted)' }} />
            <span>Trash</span>
          </Link>
        </div>
      </div>

      {/* 4. Bottom User & Settings Area */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--border)',
        background: 'var(--sidebar)',
      }}>
        {/* User Profile Pill */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="sidebar-item-row"
            style={{
              width: '100%',
              padding: '6px 8px',
              border: 'none',
              background: 'transparent',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--text-primary)',
                  color: 'var(--background)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 650,
                }}>
                  {getInitials(profile?.name || 'V')}
                </div>
              )}
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 550,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {profile?.name || 'Vedant'}
                </div>
              </div>
            </div>

            <MoreHorizontal size={13} style={{ color: 'var(--text-muted)' }} />
          </button>

          {/* User popup menu */}
          {showUserMenu && (
            <>
              <div
                onClick={() => setShowUserMenu(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 60 }}
              />
              <div
                className="menu-dropdown"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: 6,
                }}
              >
                <button
                  className="menu-item"
                  onClick={() => {
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                    setShowUserMenu(false)
                  }}
                >
                  {resolvedTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  <span>{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </button>

                <Link
                  href="/dashboard/settings"
                  className="menu-item"
                  onClick={() => setShowUserMenu(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <Settings size={14} />
                  <span>Settings</span>
                </Link>

                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                <button
                  className="menu-item menu-item-danger"
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
