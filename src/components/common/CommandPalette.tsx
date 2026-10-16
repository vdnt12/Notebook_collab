'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, Moon, Sun, Star, Trash2, Home, ArrowRight, X,
  FileText, BookOpen, Settings, UserPlus
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import type { Topic, Notebook } from '@/types'

interface CommandPaletteProps {
  onOpenCreateNotebook?: () => void
}

interface SearchItem {
  id: string
  type: 'command' | 'topic' | 'notebook'
  title: string
  subtitle?: string
  icon?: string | React.ComponentType<{ size?: number; className?: string }>
  action: () => void
}

export function CommandPalette({ onOpenCreateNotebook }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [remoteResults, setRemoteResults] = useState<{ notebooks: any[]; topics: any[] }>({
    notebooks: [],
    topics: [],
  })

  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Listen for Cmd+K / Ctrl+K
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setIsOpen(prev => !prev)
    }
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }, [isOpen])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Fetch search results from backend
  const fetchSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (res.ok) {
        setRemoteResults({
          notebooks: data.notebooks || [],
          topics: data.topics || [],
        })
      }
    } catch (err) {
      console.error('[CommandPalette search Error]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setSelectedIndex(0)
      return
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      fetchSearch(query)
    }, 100)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [query, isOpen, fetchSearch])

  // Quick Action Commands (Section 24)
  const commands: SearchItem[] = [
    {
      id: 'cmd-new-notebook',
      type: 'command',
      title: 'Create notebook',
      subtitle: 'New workspace notebook',
      icon: Plus,
      action: () => {
        setIsOpen(false)
        if (onOpenCreateNotebook) {
          onOpenCreateNotebook()
        } else {
          router.push('/dashboard')
        }
      },
    },
    {
      id: 'cmd-toggle-theme',
      type: 'command',
      title: resolvedTheme === 'dark' ? 'Toggle light mode' : 'Toggle dark mode',
      subtitle: 'Change interface appearance',
      icon: resolvedTheme === 'dark' ? Sun : Moon,
      action: () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
        setIsOpen(false)
      },
    },
    {
      id: 'cmd-home',
      type: 'command',
      title: 'Go to desk',
      subtitle: 'Continue recent work',
      icon: Home,
      action: () => {
        router.push('/dashboard')
        setIsOpen(false)
      },
    },
    {
      id: 'cmd-favorites',
      type: 'command',
      title: 'Open favorites',
      subtitle: 'Starred notebooks and notes',
      icon: Star,
      action: () => {
        router.push('/dashboard/starred')
        setIsOpen(false)
      },
    },
    {
      id: 'cmd-settings',
      type: 'command',
      title: 'Open settings',
      subtitle: 'Account & preferences',
      icon: Settings,
      action: () => {
        router.push('/dashboard/settings')
        setIsOpen(false)
      },
    },
    {
      id: 'cmd-trash',
      type: 'command',
      title: 'Open trash',
      subtitle: 'Restore deleted notes',
      icon: Trash2,
      action: () => {
        router.push('/dashboard/trash')
        setIsOpen(false)
      },
    },
  ]

  // Filter commands if matching query
  const matchingCommands = query.trim()
    ? commands.filter(c =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(query.toLowerCase()))
      )
    : commands.slice(0, 3)

  // Map remote topic results
  const topicItems: SearchItem[] = remoteResults.topics.map(t => ({
    id: `topic-${t.id}`,
    type: 'topic',
    title: t.title,
    subtitle: t.notebook_name ? `in ${t.notebook_name}` : undefined,
    icon: t.icon || '📄',
    action: () => {
      router.push(`/notebook/${t.notebook_id}?topicId=${t.id}`)
      setIsOpen(false)
    },
  }))

  // Map remote notebook results
  const notebookItems: SearchItem[] = remoteResults.notebooks.map(nb => ({
    id: `nb-${nb.id}`,
    type: 'notebook',
    title: nb.name,
    subtitle: nb.description || 'Notebook',
    icon: nb.icon || '📓',
    action: () => {
      router.push(`/notebook/${nb.id}`)
      setIsOpen(false)
    },
  }))

  // Combined item list
  const allItems: SearchItem[] = [
    ...topicItems,
    ...notebookItems,
    ...matchingCommands,
  ]

  const handleSelect = (idx: number) => {
    if (allItems[idx]) {
      allItems[idx].action()
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(1, allItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(selectedIndex)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && setIsOpen(false)}
      style={{ zIndex: 1000 }}
    >
      <div
        className="modal"
        style={{
          maxWidth: 540,
          padding: 0,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-menu)',
        }}
      >
        {/* Search Input Bar (Section 23) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--background)',
        }}>
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search notes, notebooks, commands…"
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 14.5,
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="btn-ghost"
              style={{ padding: 2, borderRadius: 4 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px' }}>
          {allItems.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
              {loading ? 'Searching…' : 'No matching results found.'}
            </div>
          ) : (
            <div>
              {/* Note / Topics Section */}
              {topicItems.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    padding: '6px 10px 4px',
                  }}>
                    {query ? 'Notes' : 'Recent'}
                  </div>

                  {topicItems.map((item) => {
                    const idx = allItems.indexOf(item)
                    const isSelected = idx === selectedIndex

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(idx)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--surface-hover)' : 'transparent',
                          transition: 'background-color 80ms ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>
                            {typeof item.icon === 'string' ? item.icon : '📄'}
                          </span>
                          <span style={{
                            fontSize: 13.5,
                            fontWeight: isSelected ? 550 : 500,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                              {item.subtitle}
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>↵ Open</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Notebooks Section */}
              {notebookItems.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    padding: '6px 10px 4px',
                  }}>
                    Notebooks
                  </div>

                  {notebookItems.map((item) => {
                    const idx = allItems.indexOf(item)
                    const isSelected = idx === selectedIndex

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(idx)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--surface-hover)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>
                            {typeof item.icon === 'string' ? item.icon : '📓'}
                          </span>
                          <span style={{
                            fontSize: 13.5,
                            fontWeight: isSelected ? 550 : 500,
                            color: 'var(--text-primary)',
                          }}>
                            {item.title}
                          </span>
                        </div>

                        {isSelected && (
                          <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>↵ Open</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Commands Section */}
              {matchingCommands.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--text-muted)',
                    padding: '6px 10px 4px',
                  }}>
                    Commands
                  </div>

                  {matchingCommands.map((item) => {
                    const idx = allItems.indexOf(item)
                    const isSelected = idx === selectedIndex
                    const Icon = typeof item.icon === 'function' ? item.icon : Plus

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(idx)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--surface-hover)' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                          }}>
                            <Icon size={12} />
                          </div>
                          <div>
                            <span style={{ fontSize: 13.5, fontWeight: isSelected ? 550 : 500, color: 'var(--text-primary)' }}>
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <ArrowRight size={12} style={{ color: 'var(--accent)' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Minimal Footer (Section 23) */}
        <div style={{
          padding: '8px 14px',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11.5,
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> navigate</span>
            <span><kbd style={kbdStyle}>↵</kbd> open</span>
            <span><kbd style={kbdStyle}>esc</kbd> close</span>
          </div>
          <span>Notebook</span>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '1px 4px',
  fontSize: 10,
}
