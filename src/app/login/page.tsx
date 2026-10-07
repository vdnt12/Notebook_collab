'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { BRAND } from '@/lib/brand'
import { AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string; select_by?: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            prompt_parent_id?: string
            ux_mode?: 'popup' | 'redirect'
          }) => void
          renderButton: (
            element: HTMLElement,
            options: {
              type?: 'standard' | 'icon'
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              logo_alignment?: 'left' | 'center'
              width?: number
              locale?: string
            }
          ) => void
          prompt: (notification?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const buttonContainerRef = useRef<HTMLDivElement>(null)

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      if (!response.credential) {
        setErrorMessage("We couldn't sign you in. Please try again.")
        toast.error("We couldn't sign you in. Please try again.")
        return
      }

      setLoading(true)
      setErrorMessage(null)

      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ credential: response.credential }),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.error || "We couldn't sign you in. Please try again.")
        }

        toast.success(`Welcome back, ${data.user?.name || 'User'}!`)
        router.push('/dashboard')
        router.refresh()
      } catch (err: any) {
        console.error('[Google Authentication Error]', err)
        const msg = err.message || "We couldn't sign you in. Please try again."
        setErrorMessage(msg)
        toast.error(msg)
        setLoading(false)
      }
    },
    [router]
  )

  const initializeGIS = useCallback(() => {
    if (!window.google?.accounts?.id || !buttonContainerRef.current) return

    if (googleClientId && googleClientId.trim().length > 0) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId.trim(),
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        buttonContainerRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(buttonContainerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
        })
      } catch (err) {
        console.error('[GIS Initialization Error]', err)
      }
    }
  }, [googleClientId, handleCredentialResponse])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      initializeGIS()
    }
  }, [initializeGIS])

  function handleStandardButtonClick() {
    if (!googleClientId || googleClientId.trim().length === 0) {
      toast.error('Please configure NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local', {
        duration: 4000,
      })
      return
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt()
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--background))',
        padding: '24px 16px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      role="main"
    >
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initializeGIS}
      />

      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'hsl(var(--surface))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 20,
          padding: '44px 32px',
          boxShadow: 'var(--shadow-xl)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Brand Icon */}
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            background: 'hsl(var(--brand))',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
            margin: '0 auto 20px',
            boxShadow: '0 6px 20px 0 hsl(var(--brand) / 0.35)',
          }}
          aria-hidden="true"
        >
          {BRAND.logoText}
        </div>

        {/* Product Title & Copy */}
        <div style={{ marginBottom: 32 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'hsl(var(--brand))',
              display: 'block',
              marginBottom: 8,
            }}
          >
            {BRAND.name}
          </span>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              color: 'hsl(var(--foreground))',
              lineHeight: 1.25,
              marginBottom: 10,
            }}
          >
            Your notebook. <br />
            Everyone&apos;s workspace.
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'hsl(var(--muted))',
              lineHeight: 1.5,
              maxWidth: 300,
              margin: '0 auto',
            }}
          >
            Create, organize and collaborate on everything that matters.
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 14px',
              borderRadius: 10,
              background: 'hsl(0 84% 60% / 0.08)',
              border: '1px solid hsl(0 84% 60% / 0.25)',
              color: 'hsl(0 84% 60%)',
              fontSize: 13,
              marginBottom: 20,
              textAlign: 'left',
            }}
            role="alert"
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Official Google Button / Container */}
        <div
          style={{
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: 'hsl(var(--foreground))',
                fontSize: 14,
                fontWeight: 500,
                padding: '10px 0',
              }}
            >
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Verifying Google account…</span>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              {/* GIS rendered container (if Client ID is loaded) */}
              <div
                ref={buttonContainerRef}
                id="google-signin-button"
                style={{
                  display: googleClientId ? 'flex' : 'none',
                  justifyContent: 'center',
                  width: '100%',
                }}
              />

              {/* Standard Google Sign-In Button */}
              {!googleClientId && (
                <button
                  type="button"
                  onClick={handleStandardButtonClick}
                  aria-label="Continue with Google"
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '0 16px',
                    borderRadius: 4,
                    border: '1px solid #747775',
                    background: '#FFFFFF',
                    color: '#1F1F1F',
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: 'Roboto, Inter, sans-serif',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, box-shadow 0.15s',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FAFC'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF'
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span style={{ letterSpacing: '0.25px' }}>Continue with Google</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Security badge footer */}
        <p
          style={{
            marginTop: 24,
            fontSize: 12,
            color: 'hsl(var(--muted-light))',
            letterSpacing: '0.01em',
          }}
        >
          Official sign-in powered by Google Identity Services
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </main>
  )
}
