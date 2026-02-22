import React from 'react'
import { useAuthStore } from '../stores/auth-store'

export function AuthScreen() {
  const { signIn, loading } = useAuthStore()
  const [error, setError] = React.useState<string | null>(null)

  const handleSignIn = async () => {
    setError(null)
    const success = await signIn()
    if (!success) {
      setError('Sign in failed. Please try again.')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-950 rounded-xl overflow-hidden">
      {/* Draggable title bar (frameless window) */}
      <div className="titlebar-drag flex items-center justify-between px-4 py-2 flex-shrink-0">
        <span className="text-[11px] text-neutral-600 font-medium">Coasty Desktop</span>
        <div className="titlebar-no-drag flex items-center gap-1">
          {/* Close button */}
          <button
            onClick={() => window.close()}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center flex-1 px-8">
        <div className="w-full max-w-sm space-y-7 text-center">
          {/* Logo */}
          <div className="flex flex-col items-center gap-5">
            <svg className="w-16 h-16" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="authLogoGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
                  <stop offset="30%" stopColor="rgba(255,255,255,0.1)" stopOpacity={1} />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.3)" stopOpacity={1} />
                  <stop offset="70%" stopColor="rgba(255,255,255,0.6)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgba(255,255,255,1)" stopOpacity={1} />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="100" fill="url(#authLogoGrad)" />
            </svg>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Coasty</h1>
              <p className="mt-2 text-neutral-400 text-sm leading-relaxed">
                Your computer, autopiloted.
              </p>
            </div>
          </div>

          {/* Sign-in card */}
          <div className="bg-neutral-900/80 border border-neutral-800/60 rounded-xl p-6 space-y-5">
            <p className="text-neutral-400 text-[13px] leading-relaxed">
              One prompt. Coasty browses, clicks, types, and ships it. Sign in to connect your machine.
            </p>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-neutral-900 rounded-lg font-medium hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </div>

          <p className="text-neutral-600 text-xs">
            By continuing, you agree to let Coasty automate tasks on this machine.
          </p>
        </div>
      </div>
    </div>
  )
}
