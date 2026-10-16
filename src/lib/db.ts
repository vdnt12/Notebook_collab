import { Pool, QueryResult, QueryResultRow } from 'pg'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { PGlite } from '@electric-sql/pglite'
import { APP_SCHEMA_SQL } from '@/lib/schema'
import { isEmbeddedDatabase } from '@/lib/local-mode'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

type Queryable = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ) => Promise<Pick<QueryResult<T>, 'rows' | 'rowCount'>>
}

const globalForDb = globalThis as unknown as {
  conotePool?: Pool
  conotePglite?: PGlite
  conoteSchemaEnsured?: boolean
}

function getPool(): Pool {
  if (!globalForDb.conotePool) {
    globalForDb.conotePool = new Pool({
      connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/conote',
      ssl:
        process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
          ? { rejectUnauthorized: false }
          : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    globalForDb.conotePool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err)
    })
  }
  return globalForDb.conotePool
}

async function getPGlite(): Promise<PGlite> {
  if (!globalForDb.conotePglite) {
    const dataDir = path.join(process.cwd(), '.data', 'conote')
    fs.mkdirSync(dataDir, { recursive: true })
    globalForDb.conotePglite = new PGlite(dataDir)
    await globalForDb.conotePglite.waitReady
    console.info('[Database] Using embedded PGlite at', dataDir)
  }
  return globalForDb.conotePglite
}

async function getClient(): Promise<Queryable> {
  if (!isEmbeddedDatabase()) {
    return getPool()
  }

  const lite = await getPGlite()
  return {
    async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
      const result = await lite.query<T>(text, params ?? [])
      return {
        rows: result.rows,
        rowCount: result.affectedRows ?? result.rows.length,
      }
    },
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<Pick<QueryResult<T>, 'rows' | 'rowCount'>> {
  await ensureAppSchema()
  const client = await getClient()
  return client.query<T>(text, params)
}

export async function ensureAppSchema(): Promise<void> {
  if (globalForDb.conoteSchemaEnsured) return
  try {
    if (isEmbeddedDatabase()) {
      const lite = await getPGlite()
      await lite.exec(APP_SCHEMA_SQL)
    } else {
      await getPool().query(APP_SCHEMA_SQL)
    }
    globalForDb.conoteSchemaEnsured = true
  } catch (err) {
    console.error('[ensureAppSchema Error]', err)
    throw err
  }
}

export interface UserRecord {
  id: string
  google_sub: string
  email: string
  email_verified: boolean
  name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
  last_active_at: string | null
  deleted_at: string | null
}

export interface SessionRecord {
  id: string
  user_id: string
  token_hash: string
  expires_at: string
  created_at: string
  last_used_at: string
  revoked_at: string | null
}

export async function getUserByGoogleSub(googleSub: string): Promise<UserRecord | null> {
  const res = await query<UserRecord>(
    `SELECT * FROM public.users WHERE google_sub = $1 AND deleted_at IS NULL LIMIT 1`,
    [googleSub]
  ).catch(() => ({ rows: [] }))
  if (res.rows[0]) return res.rows[0]

  const pRes = await query<any>(
    `SELECT id, google_id as google_sub, email, true as email_verified, name, avatar_url, created_at, updated_at, last_active_at, null as deleted_at FROM public.profiles WHERE google_id = $1 LIMIT 1`,
    [googleSub]
  ).catch(() => ({ rows: [] }))
  return pRes.rows[0] || null
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const res = await query<UserRecord>(
    `SELECT * FROM public.users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1`,
    [email]
  ).catch(() => ({ rows: [] }))
  if (res.rows[0]) return res.rows[0]

  const pRes = await query<any>(
    `SELECT id, google_id as google_sub, email, true as email_verified, name, avatar_url, created_at, updated_at, last_active_at, null as deleted_at FROM public.profiles WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  ).catch(() => ({ rows: [] }))
  return pRes.rows[0] || null
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const res = await query<UserRecord>(
    `SELECT * FROM public.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id]
  ).catch(() => ({ rows: [] }))
  if (res.rows[0]) return res.rows[0]

  const pRes = await query<any>(
    `SELECT id, google_id as google_sub, email, true as email_verified, name, avatar_url, created_at, updated_at, last_active_at, null as deleted_at FROM public.profiles WHERE id = $1 LIMIT 1`,
    [id]
  ).catch(() => ({ rows: [] }))
  return pRes.rows[0] || null
}

export async function upsertGoogleUser(params: {
  googleSub: string
  email: string
  emailVerified: boolean
  name: string
  avatarUrl: string | null
}): Promise<UserRecord> {
  const { googleSub, email, emailVerified, name, avatarUrl } = params

  const res = await query<UserRecord>(
    `
    INSERT INTO public.users (google_sub, email, email_verified, name, avatar_url, updated_at, last_active_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    ON CONFLICT (google_sub) DO UPDATE SET
      email = EXCLUDED.email,
      email_verified = EXCLUDED.email_verified,
      name = EXCLUDED.name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
      updated_at = NOW(),
      last_active_at = NOW()
    RETURNING *
    `,
    [googleSub, email.toLowerCase(), emailVerified, name, avatarUrl]
  )

  const user = res.rows[0]
  if (user?.id) {
    await seedStarterNotebooks(user.id).catch(() => {})
  }

  return user
}

export async function upsertLocalUser(params: { email: string; name: string }): Promise<UserRecord> {
  const email = params.email.trim().toLowerCase()
  const name = params.name.trim() || email.split('@')[0] || 'Local User'
  const googleSub = `local:${email}`

  return upsertGoogleUser({
    googleSub,
    email,
    emailVerified: true,
    name,
    avatarUrl: null,
  })
}

export async function createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<SessionRecord> {
  const res = await query<SessionRecord>(
    `
    INSERT INTO public.sessions (user_id, token_hash, expires_at, created_at, last_used_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING *
    `,
    [userId, tokenHash, expiresAt.toISOString()]
  )
  return res.rows[0]
}

interface JoinedSessionRow {
  session_id: string
  user_id: string
  token_hash: string
  expires_at: string
  session_created_at: string
  session_last_used_at: string
  revoked_at: string | null
  google_sub: string
  email: string
  email_verified: boolean
  name: string
  avatar_url: string | null
  user_created_at: string
  user_updated_at: string
  user_last_active_at: string | null
}

export async function getSessionAndUser(tokenHash: string): Promise<{ session: SessionRecord; user: UserRecord } | null> {
  const res = await query<JoinedSessionRow>(
    `
    SELECT
      s.id as session_id,
      s.user_id,
      s.token_hash,
      s.expires_at,
      s.created_at as session_created_at,
      s.last_used_at as session_last_used_at,
      s.revoked_at,
      u.google_sub,
      u.email,
      u.email_verified,
      u.name,
      u.avatar_url,
      u.created_at as user_created_at,
      u.updated_at as user_updated_at,
      u.last_active_at as user_last_active_at
    FROM public.sessions s
    JOIN public.users u ON s.user_id = u.id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND u.deleted_at IS NULL
    LIMIT 1
    `,
    [tokenHash]
  )

  if (res.rows.length === 0) return null

  const row = res.rows[0]
  query(`UPDATE public.sessions SET last_used_at = NOW() WHERE token_hash = $1`, [tokenHash]).catch(() => {})

  return {
    session: {
      id: row.session_id,
      user_id: row.user_id,
      token_hash: row.token_hash,
      expires_at: row.expires_at,
      created_at: row.session_created_at,
      last_used_at: row.session_last_used_at,
      revoked_at: row.revoked_at,
    },
    user: {
      id: row.user_id,
      google_sub: row.google_sub,
      email: row.email,
      email_verified: row.email_verified,
      name: row.name,
      avatar_url: row.avatar_url,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at,
      last_active_at: row.user_last_active_at,
      deleted_at: null,
    },
  }
}

export async function revokeSession(tokenHash: string): Promise<void> {
  await query(`UPDATE public.sessions SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash])
}

export async function seedStarterNotebooks(userId: string): Promise<void> {
  try {
    const check = await query(`SELECT id FROM public.notebooks WHERE owner_id = $1 LIMIT 1`, [userId])
    if (check.rows.length > 0) return

    // 1. Computer Science
    const csRes = await query<{ id: string }>(
      `INSERT INTO public.notebooks (name, description, icon, color, owner_id)
       VALUES ('Computer Science', 'Core algorithms, operating systems, and computer architecture', '💻', '#2F6FED', $1)
       RETURNING id`,
      [userId]
    )
    const csId = csRes.rows[0].id
    await query(`INSERT INTO public.notebook_settings (notebook_id) VALUES ($1) ON CONFLICT DO NOTHING`, [csId])
    await query(`INSERT INTO public.notebook_members (notebook_id, user_id, role) VALUES ($1, $2, 'OWNER') ON CONFLICT DO NOTHING`, [csId, userId])
    await query(`INSERT INTO public.starred_notebooks (user_id, notebook_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, csId])

    // Topics for Computer Science (DAA, Operating Systems, Computer Networks, SDTA)
    await query(
      `INSERT INTO public.topics (notebook_id, title, icon, position, created_by, content, content_text)
       VALUES ($1, 'DAA', '📄', 1000, $2, $3, $4)`,
      [
        csId,
        userId,
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Design & Analysis of Algorithms' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Greedy algorithms build up a solution piece by piece, always choosing the next piece that offers the most immediate benefit or highest heuristic score.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Core Paradigms' }] },
            {
              type: 'bulletList',
              content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Activity Selection Problem — Greedy choice optimal scheduling' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Huffman Coding — Variable length prefix codes for lossless compression' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prim\'s & Kruskal\'s Minimum Spanning Tree' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dijkstra\'s Shortest Path Algorithm' }] }] },
              ]
            },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Huffman Coding Implementation' }] },
            {
              type: 'codeBlock',
              attrs: { language: 'typescript' },
              content: [{ type: 'text', text: '// Optimal prefix tree node\ninterface HuffmanNode {\n  char?: string;\n  freq: number;\n  left?: HuffmanNode;\n  right?: HuffmanNode;\n}\n\nexport function buildHuffmanTree(freqMap: Map<string, number>): HuffmanNode {\n  // Min-priority queue based construction\n  return { freq: 100 };\n}' }]
            },
            {
              type: 'taskList',
              content: [
                { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Analyze amortized bounds for Fibonacci Heap' }] }] },
                { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Prove greedy choice property for interval scheduling' }] }] },
              ]
            }
          ]
        }),
        'Design & Analysis of Algorithms. Greedy algorithms build up a solution piece by piece... Activity Selection, Huffman Coding, Prims, Dijkstras.'
      ]
    )

    await query(
      `INSERT INTO public.topics (notebook_id, title, icon, position, created_by, content, content_text)
       VALUES ($1, 'Operating Systems', '💻', 2000, $2, $3, $4)`,
      [
        csId,
        userId,
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Operating Systems & Concurrency' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Paging divides virtual memory into uniform blocks called pages. The Memory Management Unit (MMU) uses page tables with Translation Lookaside Buffers (TLB) for microsecond translation.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Process Scheduling' }] },
            {
              type: 'bulletList',
              content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Completely Fair Scheduler (CFS) using red-black trees' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Round Robin with dynamic quantum adjustment' }] }] },
              ]
            }
          ]
        }),
        'Operating Systems & Concurrency. Memory Management, paging, TLB, CFS scheduler.'
      ]
    )

    await query(
      `INSERT INTO public.topics (notebook_id, title, icon, position, created_by, content, content_text)
       VALUES ($1, 'Computer Networks', '🌐', 3000, $2, $3, $4)`,
      [
        csId,
        userId,
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Computer Networks & Transport Protocols' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Detailed analysis of TCP 3-way handshake, sliding window flow control, and modern BBR congestion avoidance.' }] },
          ]
        }),
        'Computer Networks & Transport Protocols. TCP handshake, sliding window, BBR congestion control.'
      ]
    )

    await query(
      `INSERT INTO public.topics (notebook_id, title, icon, position, created_by, content, content_text)
       VALUES ($1, 'SDTA', '📐', 4000, $2, $3, $4)`,
      [
        csId,
        userId,
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Software Design & Testing Architecture' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Hexagonal / Ports and Adapters architecture, property-based testing with FastCheck, and end-to-end integration patterns.' }] },
          ]
        }),
        'Software Design & Testing Architecture. Hexagonal architecture, property-based testing.'
      ]
    )

    // 2. Projects
    const projRes = await query<{ id: string }>(
      `INSERT INTO public.notebooks (name, description, icon, color, owner_id)
       VALUES ('Projects', 'Engineering architectures, flight dynamics, and distributed systems', '🚀', '#10B981', $1)
       RETURNING id`,
      [userId]
    )
    const projId = projRes.rows[0].id
    await query(`INSERT INTO public.notebook_settings (notebook_id) VALUES ($1) ON CONFLICT DO NOTHING`, [projId])
    await query(`INSERT INTO public.notebook_members (notebook_id, user_id, role) VALUES ($1, $2, 'OWNER') ON CONFLICT DO NOTHING`, [projId, userId])

    await query(
      `INSERT INTO public.topics (notebook_id, title, icon, position, created_by, content, content_text)
       VALUES ($1, 'Hybrid UAV Project', '🚁', 1000, $2, $3, $4)`,
      [
        projId,
        userId,
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Hybrid VTOL UAV Autonomous Controller' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Transition aerodynamics from multirotor hover to fixed-wing cruise using state machine controllers and high-frequency IMU filtering.' }] },
          ]
        }),
        'Hybrid VTOL UAV Autonomous Controller. Multirotor hover, fixed-wing aerodynamics, state machines.'
      ]
    )

    // 3. Personal
    const persRes = await query<{ id: string }>(
      `INSERT INTO public.notebooks (name, description, icon, color, owner_id)
       VALUES ('Personal', 'Reading lists, study roadmaps, and personal notes', '📓', '#8B5CF6', $1)
       RETURNING id`,
      [userId]
    )
    const persId = persRes.rows[0].id
    await query(`INSERT INTO public.notebook_settings (notebook_id) VALUES ($1) ON CONFLICT DO NOTHING`, [persId])
    await query(`INSERT INTO public.notebook_members (notebook_id, user_id, role) VALUES ($1, $2, 'OWNER') ON CONFLICT DO NOTHING`, [persId, userId])

    await query(
      `INSERT INTO public.topics (notebook_id, title, icon, position, created_by, content, content_text)
       VALUES ($1, 'Reading List & Ideas', '📚', 1000, $2, $3, $4)`,
      [
        persId,
        userId,
        JSON.stringify({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Reading List & Research Topics' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Notes from Designing Data-Intensive Applications (Kleppmann) and real-time CRDT synchronization models.' }] },
          ]
        }),
        'Reading List & Research Topics. Designing Data-Intensive Applications, CRDT models.'
      ]
    )
  } catch (err) {
    console.error('[seedStarterNotebooks Error]', err)
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
