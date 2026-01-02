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
  // Monitoring channels
  MONITORING_WEBHOOKS: 'monitoring-webhooks',
  MONITORING_STAGES: 'monitoring-stages',
  MONITORING_ALERTS: 'monitoring-alerts',
  MONITORING_METRICS: 'monitoring-metrics',
  MONITORING_HEALTH: 'monitoring-health',
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
  
  // Monitoring webhook events
  WEBHOOK_RECEIVED: 'webhook:received',
  WEBHOOK_PROCESSED: 'webhook:processed',
  WEBHOOK_FAILED: 'webhook:failed',
  
  // Monitoring stage events
  STAGE_STARTED: 'stage:started',
  STAGE_COMPLETED: 'stage:completed',
  STAGE_FAILED: 'stage:failed',
  
  // Monitoring alert events
  ALERT_CREATED: 'alert:created',
  ALERT_ACKNOWLEDGED: 'alert:acknowledged',
  ALERT_RESOLVED: 'alert:resolved',
  
  // Monitoring metrics events
  METRICS_UPDATED: 'metrics:updated',
  
  // Monitoring health events
  HEALTH_CHANGED: 'health:changed',
} as const

export type Channel = typeof CHANNELS[keyof typeof CHANNELS]
export type Event = typeof EVENTS[keyof typeof EVENTS]

// Monitoring-specific channel type
export type MonitoringChannel = 
  | typeof CHANNELS.MONITORING_WEBHOOKS
  | typeof CHANNELS.MONITORING_STAGES
  | typeof CHANNELS.MONITORING_ALERTS
  | typeof CHANNELS.MONITORING_METRICS
  | typeof CHANNELS.MONITORING_HEALTH

// Monitoring-specific event type
export type MonitoringEvent =
  | typeof EVENTS.WEBHOOK_RECEIVED
  | typeof EVENTS.WEBHOOK_PROCESSED
  | typeof EVENTS.WEBHOOK_FAILED
  | typeof EVENTS.STAGE_STARTED
  | typeof EVENTS.STAGE_COMPLETED
  | typeof EVENTS.STAGE_FAILED
  | typeof EVENTS.ALERT_CREATED
  | typeof EVENTS.ALERT_ACKNOWLEDGED
  | typeof EVENTS.ALERT_RESOLVED
  | typeof EVENTS.METRICS_UPDATED
  | typeof EVENTS.HEALTH_CHANGED
