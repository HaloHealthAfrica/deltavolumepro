/**
 * Pusher Client Configuration
 * Client-side Pusher for receiving real-time events
 */

'use client'

import PusherClient from 'pusher-js'
import { CHANNELS, EVENTS } from './pusher-server'

// Re-export for client use
export { CHANNELS, EVENTS }

// Singleton pattern for Pusher client instance
let pusherClientInstance: PusherClient | null = null

export function getPusherClient(): PusherClient | null {
  if (typeof window === 'undefined') return null

  if (!pusherClientInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2'

    if (!key) {
      console.warn('Pusher key not configured - real-time features disabled')
      return null
    }

    pusherClientInstance = new PusherClient(key, {
      cluster,
      forceTLS: true,
    })

    // Connection state logging
    pusherClientInstance.connection.bind('connected', () => {
      console.log('[Pusher] Connected')
    })

    pusherClientInstance.connection.bind('disconnected', () => {
      console.log('[Pusher] Disconnected')
    })

    pusherClientInstance.connection.bind('error', (err: Error) => {
      console.error('[Pusher] Connection error:', err)
    })
  }

  return pusherClientInstance
}

// Cleanup function for unmounting
export function disconnectPusher(): void {
  if (pusherClientInstance) {
    pusherClientInstance.disconnect()
    pusherClientInstance = null
  }
}
