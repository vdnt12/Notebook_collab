export interface SessionPayload {
  sub: string
  email: string
  name: string
  avatar_url?: string | null
  exp: number
  iat: number
}

const DEFAULT_SECRET = 'notebook_vdnt_jwt_secret_signing_key_2026'

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || DEFAULT_SECRET
}

function base64UrlEncode(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(s, 'base64'))
  }
  const binary = atob(s)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function signSessionToken(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  maxAgeSeconds: number = 30 * 24 * 60 * 60
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + maxAgeSeconds
  const fullPayload: SessionPayload = { ...payload, iat, exp }

  const enc = new TextEncoder()
  const dataB64 = base64UrlEncode(enc.encode(JSON.stringify(fullPayload)))
  const key = await getHmacKey(getSecret())
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(dataB64))
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuffer))

  return `${dataB64}.${sigB64}`
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') return null
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const [dataB64, sigB64] = parts

    const key = await getHmacKey(getSecret())
    const sigBytes = base64UrlDecode(sigB64)
    const enc = new TextEncoder()
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes as any, enc.encode(dataB64))

    if (!isValid) return null

    const jsonStr = new TextDecoder().decode(base64UrlDecode(dataB64))
    const payload: SessionPayload = JSON.parse(jsonStr)

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
