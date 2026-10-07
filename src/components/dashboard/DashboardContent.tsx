'use client'

import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { NotebookCard } from './NotebookCard'
import { CreateNotebookModal } from './CreateNotebookModal'
import type { Notebook, Profile } from '@/types'

interface DashboardContentProps {
  notebooks: Notebook[]
  sharedNotebooks: Notebook[]
  userId: string
  profile: Profile | null
  greeting: string
}

export function DashboardContent({
  notebooks: initialNotebooks,
  sharedNotebooks,
  userId,
  profile,
  greeting,
}: DashboardContentProps) {
  const [notebooks, setNotebooks] = useState(initialNotebooks)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = notebooks.filter(nb =>
    nb.name.toLowerCase().includes(search.toLowerCase()) ||
    nb.description?.toLowerCase().includes(search.toLowerCase())
  )

  function handleNotebookCreated(nb: Notebook) {
    setNotebooks(prev => [{ ...nb, user_role: 'OWNER', topic_count: 0, member_count: 0 }, ...prev])
    setShowCreate(false)
  }

  function handleNotebookDeleted(id: string) {
    setNotebooks(prev => prev.filter(nb => nb.id !== id))
  }

  function handleNotebookUpdated(updated: Notebook) {
    setNotebooks(prev => prev.map(nb => nb.id === updated.id ? { ...nb, ...updated } : nb))
  }

  const name = profile?.name?.split(' ')[0] || 'there'

  return (
    <div style={{ paddingTop: 40, paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4, color: 'hsl(var(--foreground))' }}>
          {greeting}, {name} 👋
        </h1>
        <p style={{ color: 'hsl(var(--muted))', fontSize: 14 }}>
          {notebooks.length > 0
            ? `You have ${notebooks.length} notebook${notebooks.length !== 1 ? 's' : ''}`
            : 'Create your first notebook to get started'}
        </p>
      </div>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
          <Search size={14} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'hsl(var(--muted))',
          }} />
          <input
            className="input"
            placeholder="Search notebooks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn btn-primary"
          style={{ gap: 6, flexShrink: 0 }}
        >
          <Plus size={15} />
          New Notebook
        </button>
      </div>

      {/* My Notebooks */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'hsl(var(--foreground))' }}>
          My Notebooks
          {filtered.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 13, color: 'hsl(var(--muted))', fontWeight: 400 }}>
              {filtered.length}
            </span>
          )}
        </h2>

        {filtered.length === 0 ? (
          <EmptyState onCreateClick={() => setShowCreate(true)} hasSearch={search.length > 0} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(nb => (
              <NotebookCard
                key={nb.id}
                notebook={nb}
                onDeleted={handleNotebookDeleted}
                onUpdated={handleNotebookUpdated}
              />
            ))}
          </div>
        )}
      </section>

      {/* Shared With Me */}
      {sharedNotebooks.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            Shared With Me
            <span style={{ marginLeft: 8, fontSize: 13, color: 'hsl(var(--muted))', fontWeight: 400 }}>
              {sharedNotebooks.length}
            </span>
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {sharedNotebooks.map(nb => (
              <NotebookCard
                key={nb.id}
                notebook={nb}
                onDeleted={handleNotebookDeleted}
                onUpdated={handleNotebookUpdated}
              />
            ))}
          </div>
        </section>
      )}

      {showCreate && (
        <CreateNotebookModal
          onClose={() => setShowCreate(false)}
          onCreated={handleNotebookCreated}
          userId={userId}
        />
      )}
    </div>
  )
}

function EmptyState({ onCreateClick, hasSearch }: { onCreateClick: () => void; hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'hsl(var(--muted))' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--foreground))' }}>
          No results found
        </h3>
        <p style={{ fontSize: 14 }}>Try a different search term</p>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '60px 24px', color: 'hsl(var(--muted))' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'hsl(var(--foreground))' }}>
        Your notebooks are empty
      </h3>
      <p style={{ fontSize: 14, marginBottom: 24 }}>
        Create your first notebook and start collaborating.
      </p>
      <button onClick={onCreateClick} className="btn btn-primary">
        <Plus size={14} />
        Create Notebook
      </button>
    </div>
  )
}
