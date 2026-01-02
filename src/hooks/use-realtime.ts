/**
 * Real-time Hooks
 * React hooks for subscribing to real-time events
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Channel as PusherChannel } from 'pusher-js'
import { getPusherClient, CHANNELS, EVENTS } from '@/lib/realtime/pusher-client'
import type {
  SignalReceivedPayload,
  SignalDecisionPayload,
  TradeOpenedPayload,
  TradeUpdatedPayload,
  TradeClosedPayload,
  PositionPnLPayload,
  NotificationPayload,
} from '@/lib/realtime/broadcaster'

// Connection status hook
export function useRealtimeConnection() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<string>('disconnected')

  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher) return

    const handleStateChange = (states: { current: string; previous: string }) => {
      setConnectionState(states.current)
      setIsConnected(states.current === 'connected')
    }

    pusher.connection.bind('state_change', handleStateChange)
    
    // Set initial state
    setConnectionState(pusher.connection.state)
    setIsConnected(pusher.connection.state === 'connected')

    return () => {
      pusher.connection.unbind('state_change', handleStateChange)
    }
  }, [])

  return { isConnected, connectionState }
}

// Generic channel subscription hook
function useChannel(channelName: string) {
  const channelRef = useRef<PusherChannel | null>(null)

  useEffect(() => {
    const pusher = getPusherClient()
    if (!pusher) return

    channelRef.current = pusher.subscribe(channelName)

    return () => {
      if (channelRef.current) {
        pusher.unsubscribe(channelName)
        channelRef.current = null
      }
    }
  }, [channelName])

  return channelRef
}

// Signal events hook
export function useSignalEvents(callbacks?: {
  onSignalReceived?: (signal: SignalReceivedPayload) => void
  onSignalDecision?: (decision: SignalDecisionPayload) => void
}) {
  const [latestSignal, setLatestSignal] = useState<SignalReceivedPayload | null>(null)
  const [latestDecision, setLatestDecision] = useState<SignalDecisionPayload | null>(null)
  const channelRef = useChannel(CHANNELS.SIGNALS)

  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return

    const handleSignalReceived = (data: SignalReceivedPayload) => {
      setLatestSignal(data)
      callbacks?.onSignalReceived?.(data)
    }

    const handleSignalDecision = (data: SignalDecisionPayload) => {
      setLatestDecision(data)
      callbacks?.onSignalDecision?.(data)
    }

    channel.bind(EVENTS.SIGNAL_RECEIVED, handleSignalReceived)
    channel.bind(EVENTS.SIGNAL_DECISION, handleSignalDecision)

    return () => {
      channel.unbind(EVENTS.SIGNAL_RECEIVED, handleSignalReceived)
      channel.unbind(EVENTS.SIGNAL_DECISION, handleSignalDecision)
    }
  }, [callbacks])

  return { latestSignal, latestDecision }
}

// Trade events hook
export function useTradeEvents(callbacks?: {
  onTradeOpened?: (trade: TradeOpenedPayload) => void
  onTradeUpdated?: (trade: TradeUpdatedPayload) => void
  onTradeClosed?: (trade: TradeClosedPayload) => void
}) {
  const [trades, setTrades] = useState<Map<string, TradeUpdatedPayload>>(new Map())
  const channelRef = useChannel(CHANNELS.TRADES)

  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return

    const handleTradeOpened = (data: TradeOpenedPayload) => {
      callbacks?.onTradeOpened?.(data)
    }

    const handleTradeUpdated = (data: TradeUpdatedPayload) => {
      setTrades(prev => new Map(prev).set(data.id, data))
      callbacks?.onTradeUpdated?.(data)
    }

    const handleTradeClosed = (data: TradeClosedPayload) => {
      setTrades(prev => {
        const next = new Map(prev)
        next.delete(data.id)
        return next
      })
      callbacks?.onTradeClosed?.(data)
    }

    channel.bind(EVENTS.TRADE_OPENED, handleTradeOpened)
    channel.bind(EVENTS.TRADE_UPDATED, handleTradeUpdated)
    channel.bind(EVENTS.TRADE_CLOSED, handleTradeClosed)

    return () => {
      channel.unbind(EVENTS.TRADE_OPENED, handleTradeOpened)
      channel.unbind(EVENTS.TRADE_UPDATED, handleTradeUpdated)
      channel.unbind(EVENTS.TRADE_CLOSED, handleTradeClosed)
    }
  }, [callbacks])

  return { trades: Array.from(trades.values()) }
}

// Position P&L updates hook
export function usePositionPnL(callbacks?: {
  onPnLUpdate?: (position: PositionPnLPayload) => void
}) {
  const [positions, setPositions] = useState<Map<string, PositionPnLPayload>>(new Map())
  const channelRef = useChannel(CHANNELS.POSITIONS)

  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return

    const handlePnLUpdate = (data: PositionPnLPayload) => {
      setPositions(prev => new Map(prev).set(data.id, data))
      callbacks?.onPnLUpdate?.(data)
    }

    channel.bind(EVENTS.POSITION_PNL_UPDATE, handlePnLUpdate)

    return () => {
      channel.unbind(EVENTS.POSITION_PNL_UPDATE, handlePnLUpdate)
    }
  }, [callbacks])

  return { positions: Array.from(positions.values()) }
}

// Notifications hook
export function useNotifications(maxNotifications = 10) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([])
  const channelRef = useChannel(CHANNELS.NOTIFICATIONS)

  const addNotification = useCallback((notification: NotificationPayload) => {
    setNotifications(prev => {
      const next = [notification, ...prev]
      return next.slice(0, maxNotifications)
    })
  }, [maxNotifications])

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  useEffect(() => {
    const channel = channelRef.current
    if (!channel) return

    const events = [
      EVENTS.NOTIFICATION_INFO,
      EVENTS.NOTIFICATION_WARNING,
      EVENTS.NOTIFICATION_ERROR,
      EVENTS.NOTIFICATION_SUCCESS,
    ]

    events.forEach(event => {
      channel.bind(event, addNotification)
    })

    return () => {
      events.forEach(event => {
        channel.unbind(event, addNotification)
      })
    }
  }, [addNotification])

  return { notifications, clearNotification, clearAll }
}
