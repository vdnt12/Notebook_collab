export function isLocalAuthEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH === 'true') return true
  if (process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH === 'false') return false
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  return process.env.NODE_ENV !== 'production' && !googleClientId
}

export function isEmbeddedDatabase(): boolean {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  return !url.trim()
}
