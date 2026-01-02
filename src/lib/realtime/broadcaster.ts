/**
 * Real-time Event Broadcaster
 * Centralized service for broadcasting events to connected clients
 */

import { getPusherServer, CHANNELS, EVENTS, type Channel, type Event } from './pusher-server'
import type { Signal, Trade, Decision } from '@prisma/client'

// Event payload types
export interface SignalReceivedPayload {
  id: string
  ticker: string
  action: string
  quality: number
  entryPrice: number
  timeframeMinutes: number
  timestamp: Date
}

export interface SignalEnrichedPayload {
  signalId: string
  ticker: string
  enrichedPrice: number
  volumePressure: number
  dataQuality: number
  sources: string[]
}

export interface SignalDecisionPayload {
  signalId: string
  ticker: string
  decision: string
  confidence: number
  reasoning: string[]
  instrumentType: string
}

export interface TradeOpenedPayload {
  id: string
  ticker: string
  side: string
  quantity: number
  entryPrice: number
  entryValue: number
  stopLoss: number
  target1: number
  broker: string
  instrumentType: string
}

export interface TradeUpdatedPayload {
  id: string
  ticker: string
  currentPrice: number
  pnl: number
  pnlPercent: number
  rMultiple: number
}

export interface TradeClosedPayload {
  id: string
  ticker: string
  side: string
  exitPrice: number
  pnl: number
  rMultiple: number
  exitReason: string
  holdingPeriod: number
}

export interface PositionPnLPayload {
  id: string
  ticker: string
  currentPrice: number
  pnl: number
  pnlPercent: number
  rMultiple: number
}

export interface NotificationPayload {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  timestamp: Date
  data?: Record<string, unknown>
}

export interface SystemStatusPayload {
  status: 'online' | 'degraded' | 'offline'
  services: {
    database: boolean
    tradier: boolean
    twelvedata: boolean
    alpaca: boolean
  }
  timestamp: Date
}

// Broadcaster class
class RealtimeBroadcaster {
  private pusher = getPusherServer()

  // Signal events
  async signalReceived(signal: Signal): Promise<void> {
    const payload: SignalReceivedPayload = {
      id: signal.id,
      ticker: signal.ticker,
      action: signal.action,
      quality: signal.quality,
      entryPrice: signal.entryPrice,
      timeframeMinutes: signal.timeframeMinutes,
      timestamp: signal.createdAt,
    }
    await this.broadcast(CHANNELS.SIGNALS, EVENTS.SIGNAL_RECEIVED, payload)
  }

  async signalEnriched(signalId: string, data: Omit<SignalEnrichedPayload, 'signalId'>): Promise<void> {
    const payload: SignalEnrichedPayload = { signalId, ...data }
    await this.broadcast(CHANNELS.SIGNALS, EVENTS.SIGNAL_ENRICHED, payload)
  }

  async signalDecision(decision: Decision & { signal: Signal }): Promise<void> {
    const payload: SignalDecisionPayload = {
      signalId: decision.signalId,
      ticker: decision.signal.ticker,
      decision: decision.decision,
      confidence: decision.confidence,
      reasoning: decision.reasoning as string[],
      instrumentType: decision.instrumentType || 'STOCK',
    }
    await this.broadcast(CHANNELS.SIGNALS, EVENTS.SIGNAL_DECISION, payload)
  }

  // Trade events
  async tradeOpened(trade: Trade): Promise<void> {
    const payload: TradeOpenedPayload = {
      id: trade.id,
      ticker: trade.ticker,
      side: trade.side,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      entryValue: trade.entryValue,
      stopLoss: trade.stopLoss,
      target1: trade.target1,
      broker: trade.broker,
      instrumentType: trade.instrumentType,
    }
    await this.broadcast(CHANNELS.TRADES, EVENTS.TRADE_OPENED, payload)
  }

  async tradeUpdated(trade: Trade, currentPrice: number): Promise<void> {
    const pnl = trade.side === 'LONG'
      ? (currentPrice - trade.entryPrice) * trade.quantity
      : (trade.entryPrice - currentPrice) * trade.quantity
    const pnlPercent = (pnl / trade.entryValue) * 100
    const riskPerShare = Math.abs(trade.entryPrice - trade.stopLoss)
    const rMultiple = riskPerShare > 0 ? pnl / (riskPerShare * trade.quantity) : 0

    const payload: TradeUpdatedPayload = {
      id: trade.id,
      ticker: trade.ticker,
      currentPrice,
      pnl,
      pnlPercent,
      rMultiple,
    }
    await this.broadcast(CHANNELS.TRADES, EVENTS.TRADE_UPDATED, payload)
  }

  async tradeClosed(trade: Trade): Promise<void> {
    const payload: TradeClosedPayload = {
      id: trade.id,
      ticker: trade.ticker,
      side: trade.side,
      exitPrice: trade.exitPrice || 0,
      pnl: trade.pnl || 0,
      rMultiple: trade.rMultiple || 0,
      exitReason: trade.exitReason || 'UNKNOWN',
      holdingPeriod: trade.holdingPeriod || 0,
    }
    await this.broadcast(CHANNELS.TRADES, EVENTS.TRADE_CLOSED, payload)
  }

  // Position P&L updates
  async positionPnLUpdate(positions: PositionPnLPayload[]): Promise<void> {
    for (const position of positions) {
      await this.broadcast(CHANNELS.POSITIONS, EVENTS.POSITION_PNL_UPDATE, position)
    }
  }

  // Notifications
  async notify(notification: Omit<NotificationPayload, 'id' | 'timestamp'>): Promise<void> {
    const payload: NotificationPayload = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...notification,
    }
    
    const eventMap = {
      info: EVENTS.NOTIFICATION_INFO,
      warning: EVENTS.NOTIFICATION_WARNING,
      error: EVENTS.NOTIFICATION_ERROR,
      success: EVENTS.NOTIFICATION_SUCCESS,
    }
    
    await this.broadcast(CHANNELS.NOTIFICATIONS, eventMap[notification.type], payload)
  }

  // System status
  async systemStatus(status: Omit<SystemStatusPayload, 'timestamp'>): Promise<void> {
    const payload: SystemStatusPayload = {
      ...status,
      timestamp: new Date(),
    }
    await this.broadcast(CHANNELS.SYSTEM, EVENTS.SYSTEM_STATUS, payload)
  }

  // Generic broadcast method
  private async broadcast(channel: Channel, event: Event, data: unknown): Promise<void> {
    try {
      await this.pusher.trigger(channel, event, data)
    } catch (error) {
      console.error(`[Broadcaster] Failed to broadcast ${channel}:${event}`, error)
    }
  }
}

// Export singleton instance
export const broadcaster = new RealtimeBroadcaster()
