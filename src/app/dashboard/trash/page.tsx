import { requireAuth } from '@/lib/auth/session'
import { query } from '@/lib/db'

export default async function TrashPage() {
  const user = await requireAuth()

  let trashedNotebooks: any[] = []

  try {
    const res = await query(
      `
      SELECT * FROM public.notebooks
      WHERE owner_id = $1 AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
      `,
      [user.id]
    )
    trashedNotebooks = res.rows || []
  } catch (err) {
    console.error('[TrashPage Query Error]', err)
  }

  return (
    <div style={{ paddingTop: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Trash</h1>
      <p style={{ color: 'hsl(var(--muted))', fontSize: 13.5, marginBottom: 24 }}>
        Deleted notebooks and pages can be restored here.
      </p>

      {trashedNotebooks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: 'hsl(var(--muted))' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🗑️</div>
          <p style={{ fontSize: 14, fontWeight: 500 }}>Trash is empty</p>
          <p style={{ fontSize: 12.5, color: 'hsl(var(--muted-light))', marginTop: 4 }}>
            Items moved to trash will appear here before permanent removal.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {trashedNotebooks.map((nb) => (
            <div
              key={nb.id}
              style={{
                background: 'hsl(var(--surface))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 12,
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{nb.icon || '📓'}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{nb.name}</div>
                  <div style={{ fontSize: 11.5, color: 'hsl(var(--muted))' }}>
                    Deleted on {new Date(nb.deleted_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
