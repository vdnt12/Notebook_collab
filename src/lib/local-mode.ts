export function isLocalAuthEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH === 'true') return true
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const hasSupabase = Boolean(
    supabaseUrl &&
    !supabaseUrl.includes('your-project') &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-anon-key')
  )

  // If Supabase is not configured, always allow local fallback sign-in so users are never locked out
  if (!hasSupabase) return true

  if (process.env.NEXT_PUBLIC_ENABLE_LOCAL_AUTH === 'false') return false
  return true
}

export function isEmbeddedDatabase(): boolean {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  return !url.trim()
}
