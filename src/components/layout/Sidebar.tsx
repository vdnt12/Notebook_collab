'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, BookOpen, Users, Star, Clock, Trash2,
  Settings, LogOut, Moon, Sun, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from '@/components/providers/ThemeProvider'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'

interface SidebarProps {
  profile: Profile | null
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/notebooks', label: 'My Notebooks', icon: BookOpen },
  { href: '/dashboard/shared', label: 'Shared With Me', icon: Users },
  { href: '/dashboard/starred', label: 'Starred', icon: Star },
  { href: '/dashboard/trash', label: 'Trash', icon: Trash2 },
]

export function Sidebar({ profile, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const [showUserMenu, setShowUserMenu] = useState(false)

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('[Logout Error]', err)
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid hsl(var(--border))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'hsl(var(--brand))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 15,
            }}>C</div>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'hsl(var(--foreground))' }}>CoNote</span>
          </Link>
          <button onClick={onClose} style={{ display: 'none' }} className="sidebar-close">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 8px', flex: 1 }}>
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className={`sidebar-nav-item ${pathname === href ? 'active' : ''}`}
            style={{ display: 'flex' }}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '8px', borderTop: '1px solid hsl(var(--border))' }}>
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="sidebar-nav-item"
          style={{ width: '100%' }}
        >
          {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <Link href="/dashboard/settings" className="sidebar-nav-item" style={{ display: 'flex' }}>
          <Settings size={16} />
          Settings
        </Link>

        {/* User */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer',
              transition: 'background 0.1s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--surface-2))')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'hsl(var(--brand))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 11, fontWeight: 700,
              }}>
                {getInitials(profile?.name || 'U')}
              </div>
            )}
            <div style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.name || 'User'}
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile?.email}
              </div>
            </div>
          </button>

          {showUserMenu && (
            <div style={{
              position: 'absolute',
              bottom: '100%', left: 0, right: 0,
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 10,
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              zIndex: 50,
              marginBottom: 4,
            }}>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 14px', border: 'none', background: 'none',
                  cursor: 'pointer', fontSize: 13.5, color: 'hsl(0 84% 60%)',
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'hsl(0 84% 60% / 0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-close { display: flex !important; }
        }
      `}</style>
    </aside>
  )
}
