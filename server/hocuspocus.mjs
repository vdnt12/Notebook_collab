import { Server } from '@hocuspocus/server'
import pkg from 'pg'
const { Pool } = pkg
import crypto from 'crypto'

const PORT = process.env.HOCUSPOCUS_PORT || 1234
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/conote'

let pool = null
try {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' && !DATABASE_URL.includes('localhost')
      ? { rejectUnauthorized: false }
      : false,
  })
} catch (err) {
  console.error('[Hocuspocus DB Init Error]', err)
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

const server = new Server({
  port: Number(PORT),
  extensions: [],

  async onAuthenticate(data) {
    const { token, documentName } = data
    console.log(`[Hocuspocus] Authenticating connection for document: ${documentName}`)

    if (!token) {
      throw new Error('Unauthorized: Session token is required')
    }

    if (!pool) {
      throw new Error('Database connection unavailable')
    }

    try {
      const tokenHash = hashToken(token)
      const sessionRes = await pool.query(
        `
        SELECT s.user_id, u.name, u.email
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

      if (sessionRes.rows.length === 0) {
        throw new Error('Unauthorized: Invalid or expired session')
      }

      const user = sessionRes.rows[0]
      const topicId = documentName.replace('conote-topic-', '')

      // Query topic and notebook authorization
      const topicRes = await pool.query(
        `
        SELECT t.id, t.notebook_id, n.owner_id
        FROM public.topics t
        JOIN public.notebooks n ON t.notebook_id = n.id
        WHERE t.id = $1 AND t.deleted_at IS NULL AND n.deleted_at IS NULL
        LIMIT 1
        `,
        [topicId]
      )

      if (topicRes.rows.length === 0) {
        throw new Error('Topic not found')
      }

      const topic = topicRes.rows[0]
      let userRole = 'VIEWER'

      if (topic.owner_id === user.user_id) {
        userRole = 'OWNER'
      } else {
        const memberRes = await pool.query(
          `SELECT role FROM public.notebook_members WHERE notebook_id = $1 AND user_id = $2 LIMIT 1`,
          [topic.notebook_id, user.user_id]
        )

        if (memberRes.rows.length === 0) {
          throw new Error('Access denied to this notebook')
        }
        userRole = memberRes.rows[0].role
      }

      const isReadOnly = userRole === 'VIEWER' || userRole === 'COMMENTER'

      return {
        user: {
          id: user.user_id,
          name: user.name,
          email: user.email,
          role: userRole,
        },
        readOnly: isReadOnly,
      }
    } catch (err) {
      console.error('[Hocuspocus Auth Error]', err.message || err)
      throw err
    }
  },

  async onLoadDocument(data) {
    console.log(`[Hocuspocus] Loading document: ${data.documentName}`)
    return null
  },

  async onStoreDocument(data) {
    console.log(`[Hocuspocus] Storing document snapshot: ${data.documentName}`)
    if (pool) {
      try {
        const topicId = data.documentName.replace('conote-topic-', '')
        const state = Buffer.from(data.state).toString('base64')

        await pool.query(
          `
          INSERT INTO public.topic_documents (topic_id, data, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (topic_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
          `,
          [topicId, state]
        )
      } catch (err) {
        console.error('[Hocuspocus Store Error]', err)
      }
    }
  },
})

server.listen().then(() => {
  console.log(`🚀 CoNote Hocuspocus Collaboration WebSocket Server running on port ${PORT}`)
})
