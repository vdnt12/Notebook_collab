'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, BookOpen, Plus, Moon, Sun, Star, Users, Trash2, Home, ArrowRight, X
} from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

interface CommandPaletteProps {
  onOpenCreateNotebook?: () => void
}

interface PaletteItem {
  id: string
  category: string
  label: string
  desc?: string
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  action: () => void
}

export function CommandPalette({ onOpenCreateNotebook }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
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

  const items: PaletteItem[] = [
    // Actions
    {
      id: 'act-new-nb',
      category: 'Actions',
      label: 'Create New Notebook',
      icon: Plus,
      action: () => {
        setIsOpen(false)
        if (onOpenCreateNotebook) onOpenCreateNotebook()
      },
    },
    {
      id: 'act-toggle-theme',
      category: 'Actions',
      label: resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      icon: resolvedTheme === 'dark' ? Sun : Moon,
      action: () => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
        setIsOpen(false)
      },
    },
    // Navigation
    { id: 'nav-home', category: 'Navigation', label: 'Dashboard', icon: Home, action: () => { router.push('/dashboard'); setIsOpen(false) } },
    { id: 'nav-notebooks', category: 'Navigation', label: 'My Notebooks', icon: BookOpen, action: () => { router.push('/dashboard/notebooks'); setIsOpen(false) } },
    { id: 'nav-shared', category: 'Navigation', label: 'Shared With Me', icon: Users, action: () => { router.push('/dashboard/shared'); setIsOpen(false) } },
    { id: 'nav-starred', category: 'Navigation', label: 'Starred Notebooks', icon: Star, action: () => { router.push('/dashboard/starred'); setIsOpen(false) } },
    { id: 'nav-trash', category: 'Navigation', label: 'Trash', icon: Trash2, action: () => { router.push('/dashboard/trash'); setIsOpen(false) } },
  ]

  const filtered = query.trim()
    ? items.filter(it => it.label.toLowerCase().includes(query.toLowerCase()) || (it.desc && it.desc.toLowerCase().includes(query.toLowerCase())))
    : items

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = (index: number) => {
    if (filtered[index]) {
      filtered[index].action()
    }
  }

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(selectedIndex)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay animate-fade-in"
      onClick={e => e.target === e.currentTarget && setIsOpen(false)}
      style={{ zIndex: 999 }}
    >
      <div
        className="modal animate-scale-in"
        style={{ maxWidth: 580, padding: 0, overflow: 'hidden', borderRadius: 16 }}
      >
        {/* Search header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--surface))',
        }}>
          <Search size={18} style={{ color: 'hsl(var(--muted))', flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleListKeyDown}
            placeholder="Search commands, navigate… (⌘K)"
            autoFocus
            style={{
              flex: 1, border: 'none', background: 'transparent',
              outline: 'none', fontSize: 14.5, color: 'hsl(var(--foreground))',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => setIsOpen(false)}
            className="btn-ghost"
            style={{ padding: 4, borderRadius: 6 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Results list */}
        <div
          style={{ maxHeight: 360, overflowY: 'auto', padding: '8px' }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'hsl(var(--muted))', fontSize: 13.5 }}>
              No matching commands found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              const isSelected = idx === selectedIndex
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8,
                    cursor: 'pointer',
                    background: isSelected ? 'hsl(var(--brand) / 0.12)' : 'transparent',
                    color: isSelected ? 'hsl(var(--brand))' : 'hsl(var(--foreground))',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: isSelected ? 'hsl(var(--brand) / 0.2)' : 'hsl(var(--surface-2))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isSelected ? 'hsl(var(--brand))' : 'hsl(var(--muted))',
                    }}>
                      <Icon size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: isSelected ? 600 : 500 }}>
                        {item.label}
                      </div>
                      {item.desc && (
                        <div style={{ fontSize: 11.5, color: 'hsl(var(--muted))' }}>{item.desc}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'hsl(var(--muted-light))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight size={13} style={{ color: 'hsl(var(--brand))' }} />}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div style={{
          padding: '8px 16px', background: 'hsl(var(--surface))',
          borderTop: '1px solid hsl(var(--border))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11.5, color: 'hsl(var(--muted))',
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> navigate</span>
            <span><kbd style={kbdStyle}>↵</kbd> select</span>
            <span><kbd style={kbdStyle}>esc</kbd> close</span>
          </div>
          <span>CoNote Command Palette</span>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  background: 'hsl(var(--surface-2))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 4,
  padding: '2px 5px',
  fontSize: 10.5,
  fontFamily: 'inherit',
}
