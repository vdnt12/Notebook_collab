'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NOTEBOOK_ICONS, NOTEBOOK_COLORS } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Notebook } from '@/types'

interface CreateNotebookModalProps {
  onClose: () => void
  onCreated: (nb: Notebook) => void
  userId: string
}

export function CreateNotebookModal({ onClose, onCreated, userId }: CreateNotebookModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('📚')
  const [color, setColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Please enter a notebook name')
      return
    }
    setLoading(true)

    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          icon,
          color,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create notebook')
      }

      onCreated(data.notebook)
      toast.success(`Created "${name}"!`)
      onClose()
    } catch (err: any) {
      console.error('[Create Notebook Error]', err)
      toast.error(err.message || 'Failed to create notebook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-scale-in">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create New Notebook</h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4, borderRadius: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Icon & Color Preview */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 14px', borderRadius: 10,
          background: 'hsl(var(--surface))',
          border: '1px solid hsl(var(--border))',
          marginBottom: 20,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
            boxShadow: 'var(--shadow)',
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{name.trim() || 'Untitled Notebook'}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted))' }}>
              {description.trim() || 'No description provided'}
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Notebook Name <span style={{ color: 'hsl(0 84% 60%)' }}>*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Physics, DAA, Project Notes…"
              className="input"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Description <span style={{ fontSize: 12, color: 'hsl(var(--muted))' }}>(optional)</span>
            </label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this notebook for?"
              className="input"
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Icon
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {NOTEBOOK_ICONS.map(ic => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: icon === ic ? '2px solid hsl(var(--brand))' : '1px solid hsl(var(--border))',
                    background: icon === ic ? 'hsl(var(--brand) / 0.1)' : 'hsl(var(--surface))',
                    fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Accent Color
            </label>
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
                    transition: 'transform 0.1s ease',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="btn btn-primary"
          >
            {loading ? 'Creating…' : 'Create Notebook'}
          </button>
        </div>
      </div>
    </div>
  )
}
