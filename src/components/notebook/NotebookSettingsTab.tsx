'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Trash2, Check, AlertTriangle, Lock } from 'lucide-react'
import { NOTEBOOK_ICONS, NOTEBOOK_COLORS } from '@/lib/utils'
import { can } from '@/lib/permissions'
import toast from 'react-hot-toast'
import type { Notebook, NotebookSettings, NotebookRole } from '@/types'

interface NotebookSettingsTabProps {
  notebook: Notebook & { user_role: string }
  onUpdate: (updated: Partial<Notebook>) => void
}

export function NotebookSettingsTab({ notebook, onUpdate }: NotebookSettingsTabProps) {
  const router = useRouter()
  const isOwner = notebook.user_role === 'OWNER'

  const [name, setName] = useState(notebook.name)
  const [description, setDescription] = useState(notebook.description || '')
  const [icon, setIcon] = useState(notebook.icon || '📓')
  const [color, setColor] = useState(notebook.color || '#6366f1')

  const [settings, setSettings] = useState<NotebookSettings>(
    notebook.settings || {
      editorsCanDelete: false,
      allowViewerDownload: true,
      allowLinkAccess: false,
    }
  )

  async function handleSaveGeneral() {
    if (!isOwner) {
      toast.error('Only the notebook owner can modify settings.')
      return
    }
    try {
      const res = await fetch(`/api/notebooks/${notebook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, icon, color }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings')
      }
      onUpdate({ name, description, icon, color, settings })
      toast.success('Notebook settings saved!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    }
  }

  async function handleArchive() {
    if (!isOwner) return
    if (!confirm(`Archive "${notebook.name}" and move to trash?`)) return
    try {
      const res = await fetch(`/api/notebooks/${notebook.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to archive notebook')
      }
      toast.success('Notebook moved to trash.')
      router.push('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive notebook')
    }
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 840, margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Notebook Settings</h2>
      <p style={{ fontSize: 13.5, color: 'hsl(var(--muted))', marginBottom: 28 }}>
        Configure workspace name, branding, permissions, and security controls.
      </p>

      {/* General Settings */}
      <div style={{
        background: 'hsl(var(--surface))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 14,
        padding: '24px',
        marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 650, marginBottom: 16 }}>General & Appearance</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Notebook Name
            </label>
            <input
              value={name}
              disabled={!isOwner}
              onChange={e => setName(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={description}
              disabled={!isOwner}
              onChange={e => setDescription(e.target.value)}
              className="input"
              rows={3}
            />
          </div>

          {/* Icon & Color */}
          {isOwner && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Icon</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {NOTEBOOK_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      style={{
                        width: 36, height: 36, borderRadius: 8,
                        border: icon === ic ? '2px solid hsl(var(--brand))' : '1px solid hsl(var(--border))',
                        background: icon === ic ? 'hsl(var(--brand) / 0.1)' : 'hsl(var(--background))',
                        fontSize: 18, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Accent Color</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {NOTEBOOK_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: c,
                        border: color === c ? '3px solid white' : '2px solid transparent',
                        outline: color === c ? `2px solid ${c}` : 'none',
                        cursor: 'pointer',
                        transform: color === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Permissions Settings */}
      <div style={{
        background: 'hsl(var(--surface))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 14,
        padding: '24px',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={18} style={{ color: 'hsl(var(--brand))' }} />
          <h3 style={{ fontSize: 16, fontWeight: 650 }}>Role & Permission Rules</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* editorsCanDelete */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: isOwner ? 'pointer' : 'default' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Allow Editors to Delete Topics</div>
              <div style={{ fontSize: 12.5, color: 'hsl(var(--muted))' }}>
                When disabled, only the Notebook Owner can delete topics or files.
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!isOwner}
              checked={settings.editorsCanDelete}
              onChange={e => setSettings(prev => ({ ...prev, editorsCanDelete: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </label>

          {/* allowViewerDownload */}
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: isOwner ? 'pointer' : 'default' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Allow Viewers to Download Files</div>
              <div style={{ fontSize: 12.5, color: 'hsl(var(--muted))' }}>
                When disabled, Viewers can preview documents in-app but cannot download attachments.
              </div>
            </div>
            <input
              type="checkbox"
              disabled={!isOwner}
              checked={settings.allowViewerDownload}
              onChange={e => setSettings(prev => ({ ...prev, allowViewerDownload: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
          </label>
        </div>

        {isOwner && (
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveGeneral} className="btn btn-primary" style={{ fontSize: 13 }}>
              <Check size={14} /> Save Settings
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div style={{
          background: 'hsl(0 84% 60% / 0.05)',
          border: '1px solid hsl(0 84% 60% / 0.25)',
          borderRadius: 14,
          padding: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'hsl(0 84% 60%)' }}>
            <AlertTriangle size={18} />
            <h3 style={{ fontSize: 16, fontWeight: 650 }}>Danger Zone</h3>
          </div>
          <p style={{ fontSize: 13, color: 'hsl(var(--muted))', marginBottom: 16 }}>
            Archive or delete this entire notebook and all of its collaborative pages.
          </p>

          <button
            onClick={handleArchive}
            className="btn btn-danger"
            style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Trash2 size={14} /> Move Notebook to Trash
          </button>
        </div>
      )}
    </div>
  )
}
