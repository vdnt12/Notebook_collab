'use client'

import { useState } from 'react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { getInitials } from '@/lib/utils'
import { Moon, Sun, Monitor, LogOut, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types'

interface SettingsPageProps {
  profile: Profile | null
}

export function SettingsPage({ profile }: SettingsPageProps) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('[Logout Error]', err)
    }
    router.push('/login')
    router.refresh()
    toast.success('Signed out')
  }

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ] as const

  return (
    <div style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 600 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32 }}>Settings</h1>

      {/* Profile */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
          Account
        </h2>
        <div style={{
          background: 'hsl(var(--surface))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 14,
          padding: '20px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%' }} />
          ) : (
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'hsl(var(--brand))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 18, fontWeight: 700,
            }}>
              {getInitials(profile?.name || 'U')}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{profile?.name}</div>
            <div style={{ color: 'hsl(var(--muted))', fontSize: 14 }}>{profile?.email}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-light))', marginTop: 4 }}>
              {profile?.google_id?.startsWith('local:') ? 'Signed in locally' : 'Signed in with Google'}
            </div>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--muted))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
          Appearance
        </h2>
        <div style={{
          background: 'hsl(var(--surface))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 14,
          padding: '20px',
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Theme</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  border: `2px solid ${theme === value ? 'hsl(var(--brand))' : 'hsl(var(--border))'}`,
                  background: theme === value ? 'hsl(var(--brand) / 0.08)' : 'hsl(var(--background))',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  color: theme === value ? 'hsl(var(--brand))' : 'hsl(var(--muted))',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={18} />
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'hsl(0 84% 60%)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
          Danger Zone
        </h2>
        <div style={{
          background: 'hsl(var(--surface))',
          border: '1px solid hsl(0 84% 60% / 0.2)',
          borderRadius: 14,
          padding: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 500 }}>Sign out</div>
            <div style={{ fontSize: 13, color: 'hsl(var(--muted))', marginTop: 2 }}>
              Sign out of your CoNote account
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn"
            style={{
              background: 'hsl(0 84% 60%)', color: 'white',
              gap: 6,
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </section>
    </div>
  )
}
