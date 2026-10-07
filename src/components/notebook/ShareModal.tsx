'use client'

import { useState } from 'react'
import { X, UserPlus, Crown, Edit3, Eye, Trash2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()

  async function handleInvite() {
    if (!email.trim()) return
    setLoading(true)

    // Check if user exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .eq('email', email.trim().toLowerCase())
      .single()

    if (!profile) {
      toast.error('No CoNote user found with that email. They need to sign up first.')
      setLoading(false)
      return
    }

    // Check if already a member
    const existing = members.find(m => m.profile?.email === profile.email)
    if (existing || profile.id === notebook.owner_id) {
      toast.error('This person already has access')
      setLoading(false)
      return
    }

    // Add to notebook_members
    const { error } = await supabase
      .from('notebook_members')
      .insert({
        notebook_id: notebook.id,
        user_id: profile.id,
        role: inviteRole,
      })

    if (error) {
      toast.error('Failed to add collaborator')
    } else {
      toast.success(`${profile.name} added as ${inviteRole}`)
      setMembers(prev => [...prev, {
        id: Date.now().toString(),
        notebook_id: notebook.id,
        user_id: profile.id,
        role: inviteRole,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profile: profile as never,
      }])
      setEmail('')

      // Create notification
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'NOTEBOOK_INVITE',
        message: `You were added to "${notebook.name}"`,
        metadata: { notebook_id: notebook.id, role: inviteRole },
      })
    }
    setLoading(false)
  }

  async function handleRoleChange(memberId: string, newRole: NotebookRole | 'REMOVE') {
    if (newRole === 'REMOVE') {
      const { error } = await supabase.from('notebook_members').delete().eq('id', memberId)
      if (!error) {
        setMembers(prev => prev.filter(m => m.id !== memberId))
        toast.success('Access removed')
      }
      return
    }

    const { error } = await supabase
      .from('notebook_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    }
  }

  const roleIcons = {
    OWNER: <Crown size={13} style={{ color: 'hsl(var(--brand))' }} />,
    EDITOR: <Edit3 size={13} style={{ color: '#10b981' }} />,
    VIEWER: <Eye size={13} style={{ color: 'hsl(var(--muted))' }} />,
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-scale-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>
              Share "{notebook.name}"
            </h2>
            <p style={{ fontSize: 13, color: 'hsl(var(--muted))' }}>
              Add people to collaborate on this notebook
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon"><X size={16} /></button>
        </div>

        {/* Invite */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
            Add people
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              type="email"
              placeholder="Enter Google email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              style={{ flex: 1 }}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
              className="input"
              style={{ width: 'auto', flexShrink: 0 }}
            >
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={loading || !email.trim()}
              className="btn btn-primary"
              style={{ flexShrink: 0 }}
            >
              {loading ? '…' : <UserPlus size={14} />}
            </button>
          </div>
        </div>

        {/* Members list */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 12 }}>
            People with access
          </label>

          {/* Owner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 0', borderBottom: '1px solid hsl(var(--border))',
          }}>
            {notebook.owner?.avatar_url ? (
              <img src={notebook.owner.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'hsl(var(--brand))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 13, fontWeight: 700,
              }}>
                {getInitials(notebook.owner?.name || 'O')}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{notebook.owner?.name}</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--muted))' }}>{notebook.owner?.email}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'hsl(var(--brand))' }}>
              <Crown size={12} /> Owner
            </div>
          </div>

          {/* Members */}
          {members.map(member => (
            <div key={member.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0', borderBottom: '1px solid hsl(var(--border))',
            }}>
              {member.profile?.avatar_url ? (
                <img src={member.profile.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'hsl(215 20% 55%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 13, fontWeight: 700,
                }}>
                  {getInitials(member.profile?.name || 'U')}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{member.profile?.name}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--muted))' }}>{member.profile?.email}</div>
              </div>
              <select
                value={member.role}
                onChange={e => handleRoleChange(member.id, e.target.value as NotebookRole | 'REMOVE')}
                style={{
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 12.5,
                  background: 'hsl(var(--surface))',
                  color: 'hsl(var(--foreground))',
                  cursor: 'pointer',
                }}
              >
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
                <option value="REMOVE">Remove access</option>
              </select>
            </div>
          ))}

          {members.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: 'hsl(var(--muted))', fontSize: 13 }}>
              No collaborators yet. Add someone above.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid hsl(var(--border))' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12.5, color: 'hsl(var(--muted))',
            background: 'hsl(var(--surface))',
            padding: '8px 12px', borderRadius: 8,
          }}>
            <span>🔒</span>
            <span>Only authenticated users with access can open this notebook</span>
          </div>
        </div>
      </div>
    </div>
  )
}
