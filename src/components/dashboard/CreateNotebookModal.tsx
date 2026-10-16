'use client'

import React, { useState } from 'react'
import { X, Lock, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Notebook } from '@/types'

interface CreateNotebookModalProps {
  onClose: () => void
  onCreated: (nb: Notebook) => void
  userId: string
}

const EMOJI_OPTIONS = ['💻', '📚', '📝', '🚀', '🧠', '📊', '🎯', '📁', '🔬', '💡', '🎨', '⚙️']

export function CreateNotebookModal({ onClose, onCreated }: CreateNotebookModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('💻')
  const [privacy, setPrivacy] = useState<'Private' | 'Shared'>('Private')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Notebook name is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          icon,
          color: '#2F6FED',
          privacy,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create notebook')
      }

      onCreated(data.notebook)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create notebook')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        style={{
          maxWidth: 420,
          padding: '24px 24px 20px',
          borderRadius: 'var(--radius-modal)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
            Create notebook
          </h2>
          <button
            onClick={onClose}
            className="btn-ghost btn-icon"
            style={{ width: 26, height: 26 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body (Section 25) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 550, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Computer Science"
              className="input"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 550, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Icon
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJI_OPTIONS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcon(em)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-md)',
                    border: icon === em ? '1.5px solid var(--text-primary)' : '1px solid var(--border)',
                    background: icon === em ? 'var(--surface-selected)' : 'var(--background)',
                    cursor: 'pointer',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 550, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Privacy
            </label>
            <select
              value={privacy}
              onChange={e => setPrivacy(e.target.value as any)}
              className="input"
              style={{ cursor: 'pointer' }}
            >
              <option value="Private">Private</option>
              <option value="Shared">Shared with collaborators</option>
            </select>
          </div>
        </div>

        {/* Footer (Section 25) */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ height: 34 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="btn btn-primary btn-sm"
            style={{ height: 34 }}
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
