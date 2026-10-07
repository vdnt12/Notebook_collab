'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import type { Profile } from '@/types'

interface AppShellProps {
  profile: Profile | null
  children: React.ReactNode
}

export function AppShell({ profile, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'hsl(0 0% 0% / 0.4)',
            zIndex: 39,
            display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      <Sidebar
        profile={profile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main style={{
        flex: 1,
        marginLeft: 'var(--sidebar-width)',
        minHeight: '100vh',
        background: 'hsl(var(--background))',
      }}>
        {/* Mobile top bar */}
        <div style={{
          display: 'none',
          position: 'sticky', top: 0, zIndex: 30,
          background: 'hsl(var(--background) / 0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid hsl(var(--border))',
          padding: '0 16px',
          height: 52,
          alignItems: 'center',
          justifyContent: 'space-between',
        }} className="mobile-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ padding: 8, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ☰
          </button>
          <span style={{ fontWeight: 700 }}>CoNote</span>
          <div />
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          {children}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-overlay { display: block !important; }
        }
      `}</style>
    </div>
  )
}
