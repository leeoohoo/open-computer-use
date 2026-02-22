import React from 'react'
import { useAuthStore } from './stores/auth-store'
import { useConnectionStore } from './stores/connection-store'
import { useWindowStore } from './stores/window-store'
import { AuthScreen } from './components/AuthScreen'
import { Overlay } from './components/Overlay'

export default function App() {
  const { isAuthenticated, loading, checkSession } = useAuthStore()
  const { connect, init: initConnection } = useConnectionStore()
  const { mode, setMode, init: initWindow } = useWindowStore()

  // Check session on mount
  React.useEffect(() => {
    checkSession()
  }, [])

  // Subscribe to connection state changes from main process
  React.useEffect(() => {
    return initConnection()
  }, [])

  // Subscribe to window mode changes from main process
  React.useEffect(() => {
    return initWindow()
  }, [])

  // After auth succeeds, connect bridge and switch to compact overlay
  // When signed out, switch back to auth mode
  React.useEffect(() => {
    if (isAuthenticated) {
      connect()
      if (mode === 'auth') {
        setMode('compact')
      }
    } else if (mode !== 'auth') {
      setMode('auth')
    }
  }, [isAuthenticated])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950 rounded-2xl">
        <div className="flex items-center gap-3 text-neutral-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    )
  }

  if (!isAuthenticated || mode === 'auth') {
    return <AuthScreen />
  }

  return <Overlay />
}
