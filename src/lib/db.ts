import { Pool, QueryResult, QueryResultRow } from 'pg'
import crypto from 'crypto'

// Use DATABASE_URL or POSTGRES_URL from environment
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    if (!connectionString) {
      console.warn('[Database] DATABASE_URL is not set. Database queries requiring PostgreSQL will fail.')
    }
    pool = new Pool({
      connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/conote',
      ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
        ? { rejectUnauthorized: false }
        : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err)
    })
  }
  return pool
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const p = getPool()
  return p.query<T>(text, params)
}

// Ensure users and sessions tables exist
let schemaEnsured = false
export async function ensureAuthSchema(): Promise<void> {
  if (schemaEnsured) return
  try {
    const p = getPool()
    await p.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS public.users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        google_sub TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        email_verified BOOLEAN DEFAULT TRUE,
        name TEXT NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
        last_active_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
        deleted_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS public.sessions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
        last_used_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
        revoked_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON public.sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_users_google_sub ON public.users(google_sub);
      CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
    `)
    schemaEnsured = true
  } catch (err) {
    console.error('[ensureAuthSchema Error]', err)
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
  await ensureAuthSchema()
  const res = await query<UserRecord>(
    `SELECT * FROM public.users WHERE google_sub = $1 AND deleted_at IS NULL LIMIT 1`,
    [googleSub]
  )
  return res.rows[0] || null
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  await ensureAuthSchema()
  const res = await query<UserRecord>(
    `SELECT * FROM public.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id]
  )
  return res.rows[0] || null
}

export async function upsertGoogleUser(params: {
  googleSub: string
  email: string
  emailVerified: boolean
  name: string
  avatarUrl: string | null
}): Promise<UserRecord> {
  await ensureAuthSchema()
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

  return res.rows[0]
}

export async function createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<SessionRecord> {
  await ensureAuthSchema()
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
  await ensureAuthSchema()
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
      u.id as user_id,
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
  // Update last_used_at asynchronously
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
  await ensureAuthSchema()
  await query(`UPDATE public.sessions SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash])
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
