'use client'

import React, { useState } from 'react'
import { X, UserPlus, Crown, Edit3, Eye, Trash2, Check, Link2, Copy } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Notebook, NotebookMember, NotebookRole } from '@/types'

interface ShareModalProps {
  notebook: Notebook & { user_role: string }
  members: NotebookMember[]
  onClose: () => void
}

export function ShareModal({ notebook, members: initialMembers, onClose }: ShareModalProps) {
  const [members, setMembers] = useState(initialMembers)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR')
  const [loading, setLoading] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const handleInvite = async () => {
    if (!email.trim()) return
    setLoading(true)

    try {
      const res = await fetch(`/api/notebooks/${notebook.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add collaborator')
      }
      toast.success(`${data.member.profile?.name || email} added as ${inviteRole}`)
      setMembers(prev => [...prev, data.member])
      setEmail('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to add collaborator')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (memberId: string, newRole: NotebookRole | 'REMOVE') => {
    try {
      const res = await fetch(`/api/notebooks/${notebook.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update access')
      }
      if (newRole === 'REMOVE') {
        setMembers(prev => prev.filter(m => m.id !== memberId))
        toast.success('Access removed')
        return
      }
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
      toast.success('Access updated')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update access')
    }
  }

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopiedLink(false), 2000)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 460, padding: 24 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 650, color: 'var(--text-primary)', margin: 0 }}>
              Share &quot;{notebook.name}&quot;
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
              Invite collaborators to write and read notes in real time.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon" style={{ width: 26, height: 26 }}>
            <X size={15} />
          </button>
        </div>

        {/* Invite Input Row (Section 20) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              type="email"
              placeholder="Invite by email address…"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              style={{ flex: 1, height: 36, fontSize: 13 }}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as any)}
              className="input"
              style={{ width: 'auto', height: 36, fontSize: 12.5, cursor: 'pointer' }}
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={loading || !email.trim()}
              className="btn btn-primary btn-sm"
              style={{ height: 36, padding: '0 12px' }}
            >
              {loading ? '…' : 'Invite'}
            </button>
          </div>
        </div>

        {/* People with access list (Section 20) */}
        <div>
          <div style={{
            fontSize: 11.5,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-muted)',
            marginBottom: 10,
          }}>
            People with access
          </div>

          {/* Owner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {notebook.owner?.avatar_url ? (
                <img src={notebook.owner.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
              ) : (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--text-primary)',
                  color: 'var(--background)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 650,
                }}>
                  {getInitials(notebook.owner?.name || 'O')}
                </div>
              )}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text-primary)' }}>
                  {notebook.owner?.name || 'Owner'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {notebook.owner?.email}
                </div>
              </div>
            </div>

            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
              Owner
            </span>
          </div>

          {/* Members */}
          {members.map(member => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {member.profile?.avatar_url ? (
                  <img src={member.profile.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                ) : (
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--surface-hover)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                  }}>
                    {getInitials(member.profile?.name || 'U')}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {member.profile?.name || 'Collaborator'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {member.profile?.email}
                  </div>
                </div>
              </div>

              <select
                value={member.role}
                onChange={e => handleRoleChange(member.id, e.target.value as any)}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 6px',
                  fontSize: 12,
                  background: 'var(--background)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
                <option value="REMOVE">Remove</option>
              </select>
            </div>
          ))}

          {members.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 12.5 }}>
              No other collaborators yet.
            </div>
          )}
        </div>

        {/* Copy Link Footer */}
        <div style={{
          marginTop: 20,
          paddingTop: 14,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={handleCopyLink}
            className="btn btn-secondary btn-sm"
            style={{ gap: 6, fontSize: 12 }}
          >
            {copiedLink ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
            <span>{copiedLink ? 'Link copied' : 'Copy link'}</span>
          </button>

          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            🔒 Private to notebook members
          </span>
        </div>
      </div>
    </div>
  )
}
