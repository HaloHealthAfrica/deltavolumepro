/**
 * Pusher Server Configuration
 * Server-side Pusher client for broadcasting real-time events
 */

import Pusher from 'pusher'

// Singleton pattern for Pusher server instance
let pusherInstance: Pusher | null = null

export function getPusherServer(): Pusher {
  if (!pusherInstance) {
    const appId = process.env.PUSHER_APP_ID
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY
    const secret = process.env.PUSHER_SECRET
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2'

    if (!appId || !key || !secret) {
      // Return a mock pusher for development without credentials
      console.warn('Pusher credentials not configured - real-time features disabled')
      return createMockPusher()
    }

    pusherInstance = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    })
  }

  return pusherInstance
}

// Mock Pusher for development without credentials
function createMockPusher(): Pusher {
  return {
    trigger: async (channel: string, event: string, data: unknown) => {
      console.log(`[Mock Pusher] ${channel}:${event}`, data)
      return { status: 200 }
    },
    triggerBatch: async (events: Array<{ channel: string; name: string; data: unknown }>) => {
      events.forEach(e => console.log(`[Mock Pusher] ${e.channel}:${e.name}`, e.data))
      return { status: 200 }
    },
  } as unknown as Pusher
}

// Channel names
export const CHANNELS = {
  SIGNALS: 'signals',
  TRADES: 'trades',
  POSITIONS: 'positions',
  NOTIFICATIONS: 'notifications',
  SYSTEM: 'system',
} as const

// Event names
export const EVENTS = {
  // Signal events
  SIGNAL_RECEIVED: 'signal:received',
  SIGNAL_ENRICHED: 'signal:enriched',
  SIGNAL_DECISION: 'signal:decision',
  
  // Trade events
  TRADE_OPENED: 'trade:opened',
  TRADE_UPDATED: 'trade:updated',
  TRADE_CLOSED: 'trade:closed',
  
  // Position events
  POSITION_PNL_UPDATE: 'position:pnl-update',
  POSITION_EXIT_TRIGGERED: 'position:exit-triggered',
  
  // Notification events
  NOTIFICATION_INFO: 'notification:info',
  NOTIFICATION_WARNING: 'notification:warning',
  NOTIFICATION_ERROR: 'notification:error',
  NOTIFICATION_SUCCESS: 'notification:success',
  
  // System events
  SYSTEM_STATUS: 'system:status',
  SYSTEM_HEALTH: 'system:health',
} as const

export type Channel = typeof CHANNELS[keyof typeof CHANNELS]
export type Event = typeof EVENTS[keyof typeof EVENTS]
