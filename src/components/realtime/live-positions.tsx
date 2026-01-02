/**
 * Live Positions Component
 * Real-time P&L updates for open positions
 */

'use client'

import { useState, useEffect } from 'react'
import { usePositionPnL, useTradeEvents } from '@/hooks/use-realtime'
import type { PositionPnLPayload, TradeOpenedPayload, TradeClosedPayload } from '@/lib/realtime/broadcaster'

interface Position {
  id: string
  ticker: string
  side: string
  quantity: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  rMultiple: number
}

interface LivePositionsProps {
  initialPositions?: Position[]
}

export function LivePositions({ initialPositions = [] }: LivePositionsProps) {
  const [positions, setPositions] = useState<Map<string, Position>>(
    new Map(initialPositions.map(p => [p.id, p]))
  )

  // Subscribe to position P&L updates
  usePositionPnL({
    onPnLUpdate: (update) => {
      setPositions(prev => {
        const existing = prev.get(update.id)
        if (!existing) return prev
        
        const next = new Map(prev)
        next.set(update.id, {
          ...existing,
          currentPrice: update.currentPrice,
          pnl: update.pnl,
          pnlPercent: update.pnlPercent,
          rMultiple: update.rMultiple,
        })
        return next
      })
    },
  })

  // Subscribe to trade events
  useTradeEvents({
    onTradeOpened: (trade) => {
      setPositions(prev => {
        const next = new Map(prev)
        next.set(trade.id, {
          id: trade.id,
          ticker: trade.ticker,
          side: trade.side,
          quantity: trade.quantity,
          entryPrice: trade.entryPrice,
          currentPrice: trade.entryPrice,
          pnl: 0,
          pnlPercent: 0,
          rMultiple: 0,
        })
        return next
      })
    },
    onTradeClosed: (trade) => {
      setPositions(prev => {
        const next = new Map(prev)
        next.delete(trade.id)
        return next
      })
    },
  })

  const positionList = Array.from(positions.values())

  if (positionList.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        <div className="mb-2 text-2xl">📊</div>
        <p>No open positions</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {positionList.map((position) => (
        <div
          key={position.id}
          className="rounded-lg border bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold ${
                position.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {position.side === 'LONG' ? '↑' : '↓'}
              </div>
              <div>
                <div className="font-bold">{position.ticker}</div>
                <div className="text-sm text-gray-500">
                  {position.quantity} @ ${position.entryPrice.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className={`text-lg font-bold ${
                position.pnl >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
              </div>
              <div className={`text-sm ${
                position.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="text-gray-500">
              Current: ${position.currentPrice.toFixed(2)}
            </div>
            <div className={`font-medium ${
              position.rMultiple >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {position.rMultiple.toFixed(2)}R
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
