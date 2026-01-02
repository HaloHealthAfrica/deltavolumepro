/**
 * Real-time Provider
 * Wraps the app with real-time connection and notification handling
 */

'use client'

import { useEffect } from 'react'
import { getPusherClient, disconnectPusher } from '@/lib/realtime/pusher-client'
import { NotificationContainer } from '@/components/realtime'

interface RealtimeProviderProps {
  children: React.ReactNode
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  useEffect(() => {
    // Initialize Pusher connection on mount
    getPusherClient()

    // Cleanup on unmount
    return () => {
      disconnectPusher()
    }
  }, [])

  return (
    <>
      {children}
      <NotificationContainer />
    </>
  )
}
