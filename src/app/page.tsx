import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import LoginPage from '@/app/login/page'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (user) {
    redirect('/dashboard')
  }

  return <LoginPage />
}
