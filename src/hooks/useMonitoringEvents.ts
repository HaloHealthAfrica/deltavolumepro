/**
 * ============================================================================
 * MONITORING EVENTS HOOKS
 * ============================================================================
 * 
 * React hooks for subscribing to real-time monitoring events via Pusher.
 * Provides connection state management, auto-reconnection, and cleanup.
 * 
 * @module hooks/useMonitoringEvents
 * @author DeltaStack Pro
 * @version 1.0.0
 */

'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { Channel as PusherChannel } from 'pusher-js'
import { getPusherClient } from '@/lib/realtime/pusher-client'
import { MONITORING_CHANNELS, MONITORING_EVENTS } from '@/lib/monitoring/interfaces'
import type {
  WebhookRequest,
  ProcessingStage,
  SystemAlert,
  SystemMetrics,
  SystemHealth,
  ProcessingStageType,
  ProcessingStageStatus,
  AlertSeverity,
} from '@/types/monitoring'

// ============================================================================
// TYPES
// ============================================================================

/** Connection state for the Pusher client */
export type ConnectionState = 
  | 'initialized'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'unavailable'
  | 'failed'
  | 'reconnecting'

/** Webhook event payload from real-time events */
export interface WebhookEventPayload {
  webhook: WebhookRequest
  timestamp: Date
}

/** Stage event payload from real-time events */
export interface StageEventPayload {
  signalId: string
  stage: ProcessingStageType
  status: ProcessingStageStatus
  processingStage?: ProcessingStage
  metadata?: Record<string, unknown>
  timestamp: Date
}

/** Alert event payload from real-time events */
export interface AlertEventPayload {
  alert: SystemAlert
  eventType: 'created' | 'acknowledged' | 'resolved'
  timestamp: Date
}

/** Metrics event payload from real-time events */
export interface MetricsEventPayload {
  metrics: SystemMetrics
  timestamp: Date
}

/** Health event payload from real-time events */
export interface HealthEventPayload {
  health: SystemHealth
  previousStatus?: string
  timestamp: Date
}

/** Callbacks for monitoring events */
export interface MonitoringEventCallbacks {
  // Webhook events
  onWebhookReceived?: (payload: WebhookEventPayload) => void
  onWebhookProcessed?: (payload: WebhookEventPayload) => void
  onWebhookFailed?: (payload: WebhookEventPayload) => void
  
  // Stage events
  onStageStarted?: (payload: StageEventPayload) => void
  onStageCompleted?: (payload: StageEventPayload) => void
  onStageFailed?: (payload: StageEventPayload) => void
  
  // Alert events
  onAlertCreated?: (payload: AlertEventPayload) => void
  onAlertAcknowledged?: (payload: AlertEventPayload) => void
  onAlertResolved?: (payload: AlertEventPayload) => void
  
  // Metrics events
  onMetricsUpdated?: (payload: MetricsEventPayload) => void
  
  // Health events
  onHealthChanged?: (payload: HealthEventPayload) => void
  
  // Connection events
  onConnectionStateChange?: (state: ConnectionState) => void
}

/** Options for the useMonitoringEvents hook */
export interface UseMonitoringEventsOptions {
  /** Whether to auto-connect on mount (default: true) */
  autoConnect?: boolean
  /** Channels to subscribe to (default: all) */
  channels?: (keyof typeof MONITORING_CHANNELS)[]
  /** Enable debug logging (default: false) */
  debug?: boolean
}

/** Return type for the useMonitoringEvents hook */
export interface UseMonitoringEventsReturn {
  /** Current connection state */
  connectionState: ConnectionState
  /** Whether currently connected */
  isConnected: boolean
  /** Whether currently reconnecting */
  isReconnecting: boolean
  /** Any connection error */
  error: Error | null
  /** Manually connect to Pusher */
  connect: () => void
  /** Manually disconnect from Pusher */
  disconnect: () => void
  /** Subscribe to a specific channel */
  subscribeToChannel: (channel: keyof typeof MONITORING_CHANNELS) => void
  /** Unsubscribe from a specific channel */
  unsubscribeFromChannel: (channel: keyof typeof MONITORING_CHANNELS) => void
  /** List of currently subscribed channels */
  subscribedChannels: string[]
}

/** Return type for useWebhookFeed hook */
export interface UseWebhookFeedReturn {
  /** Rolling buffer of webhook events (last 100) */
  webhooks: WebhookEventPayload[]
  /** Whether the hook is loading/connecting */
  isLoading: boolean
  /** Whether connected to real-time feed */
  isConnected: boolean
  /** Any error that occurred */
  error: Error | null
  /** Clear all webhooks from the buffer */
  clearWebhooks: () => void
  /** Pause receiving new webhooks */
  pause: () => void
  /** Resume receiving webhooks */
  resume: () => void
  /** Whether the feed is paused */
  isPaused: boolean
}

/** Return type for useProcessingStages hook */
export interface UseProcessingStagesReturn {
  /** Map of signal ID to processing stages */
  stages: Map<string, ProcessingStage[]>
  /** Get stages for a specific signal */
  getStagesForSignal: (signalId: string) => ProcessingStage[]
  /** Whether the hook is loading/connecting */
  isLoading: boolean
  /** Whether connected to real-time feed */
  isConnected: boolean
  /** Any error that occurred */
  error: Error | null
  /** Clear all stages */
  clearStages: () => void
}

/** Return type for useSystemAlerts hook */
export interface UseSystemAlertsReturn {
  /** List of active alerts */
  alerts: SystemAlert[]
  /** Number of unacknowledged alerts */
  unacknowledgedCount: number
  /** Highest severity among active alerts */
  highestSeverity: AlertSeverity | null
  /** Whether the hook is loading/connecting */
  isLoading: boolean
  /** Whether connected to real-time feed */
  isConnected: boolean
  /** Any error that occurred */
  error: Error | null
  /** Acknowledge an alert locally (optimistic update) */
  acknowledgeAlert: (alertId: string) => void
  /** Clear resolved alerts from the list */
  clearResolvedAlerts: () => void
}

/** Return type for useSystemMetrics hook */
export interface UseSystemMetricsReturn {
  /** Current system metrics */
  metrics: SystemMetrics | null
  /** Historical metrics (last N updates) */
  history: SystemMetrics[]
  /** Whether the hook is loading/connecting */
  isLoading: boolean
  /** Whether connected to real-time feed */
  isConnected: boolean
  /** Any error that occurred */
  error: Error | null
  /** Last update timestamp */
  lastUpdated: Date | null
}

/** Return type for useSystemHealth hook */
export interface UseSystemHealthReturn {
  /** Current system health status */
  health: SystemHealth | null
  /** Previous health status (for comparison) */
  previousHealth: SystemHealth | null
  /** Whether the hook is loading/connecting */
  isLoading: boolean
  /** Whether connected to real-time feed */
  isConnected: boolean
  /** Any error that occurred */
  error: Error | null
  /** Last update timestamp */
  lastUpdated: Date | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default buffer size for webhook feed */
const DEFAULT_WEBHOOK_BUFFER_SIZE = 100

/** Default metrics history size */
const DEFAULT_METRICS_HISTORY_SIZE = 60

/** Maximum reconnection attempts */
const MAX_RECONNECT_ATTEMPTS = 5

/** Base reconnection delay in milliseconds */
const BASE_RECONNECT_DELAY = 1000

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse date strings in event payloads to Date objects
 */
function parsePayload<T extends object>(data: T): T {
  if (!data || typeof data !== 'object') return data
  
  const parsed = { ...data } as { [K in keyof T]: T[K] }
  const dateFields = ['timestamp', 'createdAt', 'startedAt', 'completedAt', 'acknowledgedAt', 'resolvedAt', 'lastCheck'] as const
  
  for (const field of dateFields) {
    const key = field as keyof T
    if (key in parsed && typeof parsed[key] === 'string') {
      (parsed as Record<string, unknown>)[field] = new Date(parsed[key] as string)
    }
  }
  
  return parsed
}

/**
 * Calculate exponential backoff delay
 */
function getReconnectDelay(attempt: number): number {
  return BASE_RECONNECT_DELAY * Math.pow(2, attempt)
}

// ============================================================================
// MAIN HOOK: useMonitoringEvents
// ============================================================================

/**
 * Main hook for subscribing to real-time monitoring events
 * 
 * Connects to Pusher and subscribes to monitoring channels for receiving
 * real-time updates about webhooks, processing stages, alerts, metrics, and health.
 * 
 * @param callbacks - Event callbacks for different monitoring events
 * @param options - Configuration options
 * @returns Connection state and control functions
 * 
 * @example
 * ```tsx
 * const { isConnected, connectionState } = useMonitoringEvents({
 *   onWebhookReceived: (payload) => console.log('Webhook received:', payload),
 *   onAlertCreated: (payload) => console.log('Alert created:', payload),
 *   onHealthChanged: (payload) => console.log('Health changed:', payload),
 * })
 * ```
 */
export function useMonitoringEvents(
  callbacks: MonitoringEventCallbacks = {},
  options: UseMonitoringEventsOptions = {}
): UseMonitoringEventsReturn {
  const {
    autoConnect = true,
    channels = ['WEBHOOKS', 'STAGES', 'ALERTS', 'METRICS', 'HEALTH'],
    debug = false,
  } = options

  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('initialized')
  const [subscribedChannels, setSubscribedChannels] = useState<string[]>([])
  const [error, setError] = useState<Error | null>(null)
  
  // Refs for stable callback references
  const callbacksRef = useRef(callbacks)
  const channelRefs = useRef<Map<string, PusherChannel>>(new Map())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)

  // Update callbacks ref when callbacks change
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  // Debug logger
  const log = useCallback((message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[useMonitoringEvents] ${message}`, ...args)
    }
  }, [debug])

  // Subscribe to a channel
  const subscribeToChannel = useCallback((channelKey: keyof typeof MONITORING_CHANNELS) => {
    const pusher = getPusherClient()
    if (!pusher) {
      log('Pusher client not available')
      return
    }

    const channelName = MONITORING_CHANNELS[channelKey]
    
    if (channelRefs.current.has(channelName)) {
      log(`Already subscribed to ${channelName}`)
      return
    }

    log(`Subscribing to channel: ${channelName}`)
    const channel = pusher.subscribe(channelName)
    channelRefs.current.set(channelName, channel)

    // Bind events based on channel type
    switch (channelKey) {
      case 'WEBHOOKS':
        channel.bind(MONITORING_EVENTS.WEBHOOK_RECEIVED, (data: WebhookEventPayload) => {
          log('Webhook received event:', data)
          callbacksRef.current.onWebhookReceived?.(parsePayload(data))
        })
        channel.bind(MONITORING_EVENTS.WEBHOOK_PROCESSED, (data: WebhookEventPayload) => {
          log('Webhook processed event:', data)
          callbacksRef.current.onWebhookProcessed?.(parsePayload(data))
        })
        channel.bind(MONITORING_EVENTS.WEBHOOK_FAILED, (data: WebhookEventPayload) => {
          log('Webhook failed event:', data)
          callbacksRef.current.onWebhookFailed?.(parsePayload(data))
        })
        break

      case 'STAGES':
        channel.bind(MONITORING_EVENTS.STAGE_STARTED, (data: StageEventPayload) => {
          log('Stage started event:', data)
          callbacksRef.current.onStageStarted?.(parsePayload(data))
        })
        channel.bind(MONITORING_EVENTS.STAGE_COMPLETED, (data: StageEventPayload) => {
          log('Stage completed event:', data)
          callbacksRef.current.onStageCompleted?.(parsePayload(data))
        })
        channel.bind(MONITORING_EVENTS.STAGE_FAILED, (data: StageEventPayload) => {
          log('Stage failed event:', data)
          callbacksRef.current.onStageFailed?.(parsePayload(data))
        })
        break

      case 'ALERTS':
        channel.bind(MONITORING_EVENTS.ALERT_CREATED, (data: AlertEventPayload) => {
          log('Alert created event:', data)
          callbacksRef.current.onAlertCreated?.(parsePayload(data))
        })
        channel.bind(MONITORING_EVENTS.ALERT_ACKNOWLEDGED, (data: AlertEventPayload) => {
          log('Alert acknowledged event:', data)
          callbacksRef.current.onAlertAcknowledged?.(parsePayload(data))
        })
        channel.bind(MONITORING_EVENTS.ALERT_RESOLVED, (data: AlertEventPayload) => {
          log('Alert resolved event:', data)
          callbacksRef.current.onAlertResolved?.(parsePayload(data))
        })
        break

      case 'METRICS':
        channel.bind(MONITORING_EVENTS.METRICS_UPDATED, (data: MetricsEventPayload) => {
          log('Metrics updated event:', data)
          callbacksRef.current.onMetricsUpdated?.(parsePayload(data))
        })
        break

      case 'HEALTH':
        channel.bind(MONITORING_EVENTS.HEALTH_CHANGED, (data: HealthEventPayload) => {
          log('Health changed event:', data)
          callbacksRef.current.onHealthChanged?.(parsePayload(data))
        })
        break
    }

    setSubscribedChannels(prev => [...prev, channelName])
  }, [log])

  // Unsubscribe from a channel
  const unsubscribeFromChannel = useCallback((channelKey: keyof typeof MONITORING_CHANNELS) => {
    const pusher = getPusherClient()
    if (!pusher) return

    const channelName = MONITORING_CHANNELS[channelKey]
    const channel = channelRefs.current.get(channelName)
    
    if (channel) {
      log(`Unsubscribing from channel: ${channelName}`)
      channel.unbind_all()
      pusher.unsubscribe(channelName)
      channelRefs.current.delete(channelName)
      setSubscribedChannels(prev => prev.filter(c => c !== channelName))
    }
  }, [log])

  // Handle reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      log('Max reconnect attempts reached')
      setConnectionState('failed')
      setError(new Error('Maximum reconnection attempts exceeded'))
      return
    }

    const delay = getReconnectDelay(reconnectAttempts.current)
    log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1})`)
    setConnectionState('reconnecting')
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttempts.current++
      const pusher = getPusherClient()
      if (pusher) {
        pusher.connect()
      }
    }, delay)
  }, [log])

  // Connect to Pusher
  const connect = useCallback(() => {
    const pusher = getPusherClient()
    if (!pusher) {
      log('Pusher client not available - check configuration')
      setConnectionState('unavailable')
      setError(new Error('Pusher client not available'))
      return
    }

    log('Connecting to Pusher...')
    setError(null)
    pusher.connect()
  }, [log])

  // Disconnect from Pusher
  const disconnect = useCallback(() => {
    const pusher = getPusherClient()
    if (!pusher) return

    log('Disconnecting from Pusher...')
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Unsubscribe from all channels
    channelRefs.current.forEach((channel, channelName) => {
      channel.unbind_all()
      pusher.unsubscribe(channelName)
    })
    channelRefs.current.clear()
    setSubscribedChannels([])

    pusher.disconnect()
    setConnectionState('disconnected')
  }, [log])

  // Setup connection state handlers
  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher) {
      setConnectionState('unavailable')
      return
    }

    const handleStateChange = (states: { current: string; previous: string }) => {
      log(`Connection state changed: ${states.previous} -> ${states.current}`)
      
      const newState = states.current as ConnectionState
      setConnectionState(newState)
      callbacksRef.current.onConnectionStateChange?.(newState)

      // Handle reconnection
      if (newState === 'disconnected' || newState === 'unavailable') {
        scheduleReconnect()
      } else if (newState === 'connected') {
        // Reset reconnect attempts on successful connection
        reconnectAttempts.current = 0
        setError(null)
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }
    }

    const handleConnected = () => {
      log('Connected to Pusher')
      setConnectionState('connected')
      reconnectAttempts.current = 0
      setError(null)
      
      // Subscribe to configured channels
      channels.forEach(channelKey => {
        subscribeToChannel(channelKey)
      })
    }

    const handleDisconnected = () => {
      log('Disconnected from Pusher')
      setConnectionState('disconnected')
    }

    const handleError = (err: Error) => {
      log('Pusher connection error:', err)
      setConnectionState('failed')
      setError(err)
    }

    // Bind connection events
    pusher.connection.bind('state_change', handleStateChange)
    pusher.connection.bind('connected', handleConnected)
    pusher.connection.bind('disconnected', handleDisconnected)
    pusher.connection.bind('error', handleError)

    // Set initial state
    setConnectionState(pusher.connection.state as ConnectionState)

    // Auto-connect if enabled
    if (autoConnect && pusher.connection.state !== 'connected') {
      connect()
    } else if (pusher.connection.state === 'connected') {
      // Already connected, subscribe to channels
      channels.forEach(channelKey => {
        subscribeToChannel(channelKey)
      })
    }

    // Cleanup
    return () => {
      pusher.connection.unbind('state_change', handleStateChange)
      pusher.connection.unbind('connected', handleConnected)
      pusher.connection.unbind('disconnected', handleDisconnected)
      pusher.connection.unbind('error', handleError)

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }

      // Unsubscribe from all channels
      channelRefs.current.forEach((channel, channelName) => {
        channel.unbind_all()
        pusher.unsubscribe(channelName)
      })
      channelRefs.current.clear()
    }
  }, [autoConnect, channels, connect, log, scheduleReconnect, subscribeToChannel])

  // Derived state
  const isConnected = connectionState === 'connected'
  const isReconnecting = connectionState === 'reconnecting' || 
    (connectionState === 'connecting' && reconnectAttempts.current > 0)

  return {
    connectionState,
    isConnected,
    isReconnecting,
    error,
    connect,
    disconnect,
    subscribeToChannel,
    unsubscribeFromChannel,
    subscribedChannels,
  }
}

// ============================================================================
// SPECIFIC HOOK: useWebhookFeed
// ============================================================================

/**
 * Hook for subscribing to real-time webhook events with a rolling buffer
 * 
 * Maintains a buffer of the last N webhook events (default 100) and provides
 * controls for pausing/resuming the feed.
 * 
 * @param bufferSize - Maximum number of webhooks to keep in buffer (default: 100)
 * @returns Webhook feed state and controls
 * 
 * @example
 * ```tsx
 * const { webhooks, isConnected, pause, resume } = useWebhookFeed(50)
 * 
 * return (
 *   <div>
 *     {webhooks.map(w => (
 *       <WebhookItem key={w.webhook.id} webhook={w.webhook} />
 *     ))}
 *   </div>
 * )
 * ```
 */
export function useWebhookFeed(bufferSize: number = DEFAULT_WEBHOOK_BUFFER_SIZE): UseWebhookFeedReturn {
  const [webhooks, setWebhooks] = useState<WebhookEventPayload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  
  const isPausedRef = useRef(isPaused)
  
  // Keep ref in sync with state
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // Add webhook to buffer
  const addWebhook = useCallback((payload: WebhookEventPayload) => {
    if (isPausedRef.current) return
    
    setWebhooks(prev => {
      const next = [payload, ...prev]
      return next.slice(0, bufferSize)
    })
  }, [bufferSize])

  // Clear all webhooks
  const clearWebhooks = useCallback(() => {
    setWebhooks([])
  }, [])

  // Pause/resume controls
  const pause = useCallback(() => setIsPaused(true), [])
  const resume = useCallback(() => setIsPaused(false), [])

  // Use the main monitoring events hook
  const { isConnected, error: connectionError } = useMonitoringEvents({
    onWebhookReceived: addWebhook,
    onWebhookProcessed: addWebhook,
    onWebhookFailed: addWebhook,
    onConnectionStateChange: (state) => {
      setIsLoading(state === 'connecting' || state === 'initialized')
    },
  }, {
    channels: ['WEBHOOKS'],
  })

  // Sync error state
  useEffect(() => {
    setError(connectionError)
  }, [connectionError])

  // Update loading state based on connection
  useEffect(() => {
    if (isConnected) {
      setIsLoading(false)
    }
  }, [isConnected])

  return {
    webhooks,
    isLoading,
    isConnected,
    error,
    clearWebhooks,
    pause,
    resume,
    isPaused,
  }
}

// ============================================================================
// SPECIFIC HOOK: useProcessingStages
// ============================================================================

/**
 * Hook for subscribing to real-time processing stage updates
 * 
 * Tracks processing stages for signals, optionally filtered by a specific signal ID.
 * 
 * @param signalId - Optional signal ID to filter stages for
 * @returns Processing stages state and controls
 * 
 * @example
 * ```tsx
 * // Track all stages
 * const { stages, getStagesForSignal } = useProcessingStages()
 * 
 * // Track stages for a specific signal
 * const { stages } = useProcessingStages('signal-123')
 * ```
 */
export function useProcessingStages(signalId?: string): UseProcessingStagesReturn {
  const [stages, setStages] = useState<Map<string, ProcessingStage[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  const signalIdRef = useRef(signalId)
  
  // Keep ref in sync
  useEffect(() => {
    signalIdRef.current = signalId
  }, [signalId])

  // Handle stage event
  const handleStageEvent = useCallback((payload: StageEventPayload) => {
    // Filter by signal ID if specified
    if (signalIdRef.current && payload.signalId !== signalIdRef.current) {
      return
    }

    setStages(prev => {
      const next = new Map(prev)
      const existingStages = next.get(payload.signalId) || []
      
      // Create a ProcessingStage from the payload
      const stage: ProcessingStage = payload.processingStage || {
        id: `${payload.signalId}-${payload.stage}`,
        createdAt: payload.timestamp,
        signalId: payload.signalId,
        stage: payload.stage,
        startedAt: payload.timestamp,
        completedAt: payload.status === 'completed' || payload.status === 'failed' ? payload.timestamp : undefined,
        status: payload.status,
        metadata: payload.metadata as Record<string, unknown> | undefined,
      }

      // Update or add the stage
      const stageIndex = existingStages.findIndex(s => s.stage === payload.stage)
      if (stageIndex >= 0) {
        existingStages[stageIndex] = { ...existingStages[stageIndex], ...stage }
      } else {
        existingStages.push(stage)
      }

      next.set(payload.signalId, existingStages)
      return next
    })
  }, [])

  // Get stages for a specific signal
  const getStagesForSignal = useCallback((id: string): ProcessingStage[] => {
    return stages.get(id) || []
  }, [stages])

  // Clear all stages
  const clearStages = useCallback(() => {
    setStages(new Map())
  }, [])

  // Use the main monitoring events hook
  const { isConnected, error: connectionError } = useMonitoringEvents({
    onStageStarted: handleStageEvent,
    onStageCompleted: handleStageEvent,
    onStageFailed: handleStageEvent,
    onConnectionStateChange: (state) => {
      setIsLoading(state === 'connecting' || state === 'initialized')
    },
  }, {
    channels: ['STAGES'],
  })

  // Sync error state
  useEffect(() => {
    setError(connectionError)
  }, [connectionError])

  // Update loading state
  useEffect(() => {
    if (isConnected) {
      setIsLoading(false)
    }
  }, [isConnected])

  return {
    stages,
    getStagesForSignal,
    isLoading,
    isConnected,
    error,
    clearStages,
  }
}

// ============================================================================
// SPECIFIC HOOK: useSystemAlerts
// ============================================================================

/** Alert severity priority for comparison */
const SEVERITY_PRIORITY: Record<AlertSeverity, number> = {
  critical: 4,
  error: 3,
  warning: 2,
  info: 1,
}

/**
 * Hook for subscribing to real-time system alerts
 * 
 * Tracks active alerts and provides utilities for managing alert state.
 * 
 * @returns System alerts state and controls
 * 
 * @example
 * ```tsx
 * const { alerts, unacknowledgedCount, highestSeverity } = useSystemAlerts()
 * 
 * return (
 *   <div>
 *     <Badge color={highestSeverity === 'critical' ? 'red' : 'yellow'}>
 *       {unacknowledgedCount} alerts
 *     </Badge>
 *     {alerts.map(alert => <AlertItem key={alert.id} alert={alert} />)}
 *   </div>
 * )
 * ```
 */
export function useSystemAlerts(): UseSystemAlertsReturn {
  const [alerts, setAlerts] = useState<SystemAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Handle alert created
  const handleAlertCreated = useCallback((payload: AlertEventPayload) => {
    setAlerts(prev => {
      // Check if alert already exists
      if (prev.some(a => a.id === payload.alert.id)) {
        return prev
      }
      return [payload.alert, ...prev]
    })
  }, [])

  // Handle alert acknowledged
  const handleAlertAcknowledged = useCallback((payload: AlertEventPayload) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === payload.alert.id 
        ? { ...alert, acknowledged: true, acknowledgedAt: payload.timestamp }
        : alert
    ))
  }, [])

  // Handle alert resolved
  const handleAlertResolved = useCallback((payload: AlertEventPayload) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === payload.alert.id 
        ? { ...alert, resolved: true, resolvedAt: payload.timestamp }
        : alert
    ))
  }, [])

  // Acknowledge alert locally (optimistic update)
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true, acknowledgedAt: new Date() }
        : alert
    ))
  }, [])

  // Clear resolved alerts
  const clearResolvedAlerts = useCallback(() => {
    setAlerts(prev => prev.filter(alert => !alert.resolved))
  }, [])

  // Use the main monitoring events hook
  const { isConnected, error: connectionError } = useMonitoringEvents({
    onAlertCreated: handleAlertCreated,
    onAlertAcknowledged: handleAlertAcknowledged,
    onAlertResolved: handleAlertResolved,
    onConnectionStateChange: (state) => {
      setIsLoading(state === 'connecting' || state === 'initialized')
    },
  }, {
    channels: ['ALERTS'],
  })

  // Sync error state
  useEffect(() => {
    setError(connectionError)
  }, [connectionError])

  // Update loading state
  useEffect(() => {
    if (isConnected) {
      setIsLoading(false)
    }
  }, [isConnected])

  // Computed values
  const unacknowledgedCount = useMemo(() => 
    alerts.filter(a => !a.acknowledged && !a.resolved).length,
    [alerts]
  )

  const highestSeverity = useMemo(() => {
    const activeAlerts = alerts.filter(a => !a.resolved)
    if (activeAlerts.length === 0) return null
    
    return activeAlerts.reduce((highest, alert) => {
      if (!highest) return alert.severity
      return SEVERITY_PRIORITY[alert.severity] > SEVERITY_PRIORITY[highest] 
        ? alert.severity 
        : highest
    }, null as AlertSeverity | null)
  }, [alerts])

  return {
    alerts,
    unacknowledgedCount,
    highestSeverity,
    isLoading,
    isConnected,
    error,
    acknowledgeAlert,
    clearResolvedAlerts,
  }
}

// ============================================================================
// SPECIFIC HOOK: useSystemMetrics
// ============================================================================

/**
 * Hook for subscribing to real-time system metrics updates
 * 
 * Tracks current metrics and maintains a history of recent updates.
 * 
 * @param historySize - Number of historical metrics to keep (default: 60)
 * @returns System metrics state
 * 
 * @example
 * ```tsx
 * const { metrics, history, lastUpdated } = useSystemMetrics()
 * 
 * return (
 *   <div>
 *     <p>CPU: {metrics?.cpuUsage}%</p>
 *     <p>Memory: {metrics?.memoryUsage}%</p>
 *     <p>Last updated: {lastUpdated?.toLocaleTimeString()}</p>
 *   </div>
 * )
 * ```
 */
export function useSystemMetrics(historySize: number = DEFAULT_METRICS_HISTORY_SIZE): UseSystemMetricsReturn {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [history, setHistory] = useState<SystemMetrics[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Handle metrics update
  const handleMetricsUpdate = useCallback((payload: MetricsEventPayload) => {
    setMetrics(payload.metrics)
    setLastUpdated(payload.timestamp)
    
    setHistory(prev => {
      const next = [payload.metrics, ...prev]
      return next.slice(0, historySize)
    })
  }, [historySize])

  // Use the main monitoring events hook
  const { isConnected, error: connectionError } = useMonitoringEvents({
    onMetricsUpdated: handleMetricsUpdate,
    onConnectionStateChange: (state) => {
      setIsLoading(state === 'connecting' || state === 'initialized')
    },
  }, {
    channels: ['METRICS'],
  })

  // Sync error state
  useEffect(() => {
    setError(connectionError)
  }, [connectionError])

  // Update loading state
  useEffect(() => {
    if (isConnected) {
      setIsLoading(false)
    }
  }, [isConnected])

  return {
    metrics,
    history,
    isLoading,
    isConnected,
    error,
    lastUpdated,
  }
}

// ============================================================================
// SPECIFIC HOOK: useSystemHealth
// ============================================================================

/**
 * Hook for subscribing to real-time system health status
 * 
 * Tracks current health status and previous status for comparison.
 * 
 * @returns System health state
 * 
 * @example
 * ```tsx
 * const { health, previousHealth, isConnected } = useSystemHealth()
 * 
 * const statusChanged = health?.status !== previousHealth?.status
 * 
 * return (
 *   <div>
 *     <StatusBadge status={health?.status} />
 *     {statusChanged && <span>Status changed!</span>}
 *   </div>
 * )
 * ```
 */
export function useSystemHealth(): UseSystemHealthReturn {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [previousHealth, setPreviousHealth] = useState<SystemHealth | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Handle health change
  const handleHealthChange = useCallback((payload: HealthEventPayload) => {
    setPreviousHealth(health)
    setHealth(payload.health)
    setLastUpdated(payload.timestamp)
  }, [health])

  // Use the main monitoring events hook
  const { isConnected, error: connectionError } = useMonitoringEvents({
    onHealthChanged: handleHealthChange,
    onConnectionStateChange: (state) => {
      setIsLoading(state === 'connecting' || state === 'initialized')
    },
  }, {
    channels: ['HEALTH'],
  })

  // Sync error state
  useEffect(() => {
    setError(connectionError)
  }, [connectionError])

  // Update loading state
  useEffect(() => {
    if (isConnected) {
      setIsLoading(false)
    }
  }, [isConnected])

  return {
    health,
    previousHealth,
    isLoading,
    isConnected,
    error,
    lastUpdated,
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useMonitoringEvents

// Re-export types for convenience
export type {
  WebhookRequest,
  ProcessingStage,
  SystemAlert,
  SystemMetrics,
  SystemHealth,
  ProcessingStageType,
  ProcessingStageStatus,
  AlertSeverity,
} from '@/types/monitoring'

export { MONITORING_CHANNELS, MONITORING_EVENTS } from '@/lib/monitoring/interfaces'
