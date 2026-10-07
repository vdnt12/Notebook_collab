import { requireAuth } from '@/lib/auth/session'
import { SettingsPage } from '@/components/settings/SettingsPage'
import type { Profile } from '@/types'

export default async function Settings() {
  const user = await requireAuth()

  const userProfile: Profile = {
    id: user.id,
    google_id: user.google_sub,
    name: user.name,
    email: user.email,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_active_at: user.last_active_at,
  }

  return <SettingsPage profile={userProfile} />
}
