'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { NotebookLogo } from '@/components/common/NotebookLogo'
import { Search, Moon, Sun, PanelLeft, Plus } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import type { Profile } from '@/types'

interface AppShellProps {
  profile: Profile | null
  children: React.ReactNode
}

export function AppShell({ profile, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()
  const router = useRouter()

  const openSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 38,
          }}
        />
      )}

      {/* Sidebar (Section 9, 10, 11) */}
      <Sidebar
        profile={profile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Area */}
      <div
        style={{
          flex: 1,
          marginLeft: sidebarCollapsed ? 0 : 'var(--sidebar-width)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left var(--transition-normal)',
          background: 'var(--background)',
        }}
      >
        {/* Top Bar (Section 7) */}
        <header className="notebook-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="btn-ghost btn-icon"
                title="Expand sidebar"
                style={{ width: 32, height: 32 }}
              >
                <PanelLeft size={16} />
              </button>
            )}

            {/* Mobile menu trigger */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn-ghost btn-icon md:hidden"
              style={{ display: 'none' }}
              id="mobile-menu-btn"
            >
              <PanelLeft size={16} />
            </button>

            <Link
              href="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <NotebookLogo size={16} color="var(--accent)" />
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Notebook</span>
            </Link>
          </div>

          {/* Right actions: Search, Theme, Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={openSearch}
              className="btn btn-secondary btn-sm"
              style={{
                height: 28,
                padding: '0 8px',
                fontSize: 12.5,
                gap: 6,
                color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Search size={13} />
              <span>Search</span>
              <kbd style={{
                fontSize: 10,
                opacity: 0.65,
                marginLeft: 2,
                fontFamily: 'inherit',
              }}>
                ⌘K
              </kbd>
            </button>

            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="btn-ghost btn-icon"
              style={{ width: 28, height: 28 }}
              title="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        {/* Content body */}
        <main style={{ flex: 1, padding: '0 32px' }}>
          {children}
        </main>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          #mobile-menu-btn { display: inline-flex !important; }
        }
      `}</style>
    </div>
  )
}
