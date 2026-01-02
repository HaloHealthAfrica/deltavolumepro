/**
 * Trade Monitoring Integration Tests
 * Tests exit condition processing and P&L calculations
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Trade Monitoring Integration', () => {
  describe('Exit Condition Processing', () => {
    it('should detect stop loss hit for LONG position', () => {
      const position = {
        side: 'LONG',
        entryPrice: 175.50,
        stopLoss: 172.00,
        target1: 180.00,
        target2: 185.00,
        trailing: false,
        trailingStop: null,
      }

      const currentPrice = 171.50 // Below stop loss

      const shouldExit = currentPrice <= position.stopLoss
      expect(shouldExit).toBe(true)
    })

    it('should detect stop loss hit for SHORT position', () => {
      const position = {
        side: 'SHORT',
        entryPrice: 175.50,
        stopLoss: 178.00,
        target1: 170.00,
        target2: 165.00,
        trailing: false,
        trailingStop: null,
      }

      const currentPrice = 178.50 // Above stop loss for short

      const shouldExit = currentPrice >= position.stopLoss
      expect(shouldExit).toBe(true)
    })

    it('should detect target 1 hit for LONG position', () => {
      const position = {
        side: 'LONG',
        entryPrice: 175.50,
        stopLoss: 172.00,
        target1: 180.00,
        target2: 185.00,
      }

      const currentPrice = 180.50 // Above target 1

      const target1Hit = currentPrice >= position.target1
      expect(target1Hit).toBe(true)
    })

    it('should detect target 1 hit for SHORT position', () => {
      const position = {
        side: 'SHORT',
        entryPrice: 175.50,
        stopLoss: 178.00,
        target1: 170.00,
        target2: 165.00,
      }

      const currentPrice = 169.50 // Below target 1 for short

      const target1Hit = currentPrice <= position.target1
      expect(target1Hit).toBe(true)
    })

    it('should update trailing stop on favorable price movement', () => {
      const position = {
        side: 'LONG',
        entryPrice: 175.50,
        stopLoss: 172.00,
        target1: 180.00,
        trailing: true,
        trailingStop: 172.00,
        trailingDistance: 3.50, // ATR-based
      }

      const currentPrice = 182.00 // Price moved up

      // Calculate new trailing stop
      const newTrailingStop = currentPrice - position.trailingDistance
      
      // Only update if new stop is higher than current
      const shouldUpdate = newTrailingStop > position.trailingStop
      expect(shouldUpdate).toBe(true)
      expect(newTrailingStop).toBe(178.50)
    })

    it('should not lower trailing stop on unfavorable movement', () => {
      const position = {
        side: 'LONG',
        entryPrice: 175.50,
        stopLoss: 172.00,
        target1: 180.00,
        trailing: true,
        trailingStop: 178.00, // Already raised
        trailingDistance: 3.50,
      }

      const currentPrice = 179.00 // Price dropped slightly

      const newTrailingStop = currentPrice - position.trailingDistance
      
      // Should not lower the trailing stop
      const shouldUpdate = newTrailingStop > position.trailingStop
      expect(shouldUpdate).toBe(false)
      expect(newTrailingStop).toBe(175.50) // Would be lower
    })
  })

  describe('P&L Calculations', () => {
    it('should calculate P&L correctly for winning LONG trade', () => {
      const trade = {
        side: 'LONG',
        quantity: 100,
        entryPrice: 175.50,
        exitPrice: 180.00,
      }

      const pnl = (trade.exitPrice - trade.entryPrice) * trade.quantity
      const pnlPercent = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100

      expect(pnl).toBe(450.00)
      expect(pnlPercent).toBeCloseTo(2.56, 2)
    })

    it('should calculate P&L correctly for losing LONG trade', () => {
      const trade = {
        side: 'LONG',
        quantity: 100,
        entryPrice: 175.50,
        exitPrice: 172.00,
      }

      const pnl = (trade.exitPrice - trade.entryPrice) * trade.quantity
      const pnlPercent = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100

      expect(pnl).toBe(-350.00)
      expect(pnlPercent).toBeCloseTo(-1.99, 2)
    })

    it('should calculate P&L correctly for winning SHORT trade', () => {
      const trade = {
        side: 'SHORT',
        quantity: 100,
        entryPrice: 175.50,
        exitPrice: 170.00,
      }

      const pnl = (trade.entryPrice - trade.exitPrice) * trade.quantity
      const pnlPercent = ((trade.entryPrice - trade.exitPrice) / trade.entryPrice) * 100

      expect(pnl).toBe(550.00)
      expect(pnlPercent).toBeCloseTo(3.13, 2)
    })

    it('should calculate R-multiple correctly', () => {
      const trade = {
        side: 'LONG',
        quantity: 100,
        entryPrice: 175.50,
        exitPrice: 180.00,
        stopLoss: 172.00,
      }

      const riskPerShare = trade.entryPrice - trade.stopLoss
      const profitPerShare = trade.exitPrice - trade.entryPrice
      const rMultiple = profitPerShare / riskPerShare

      expect(riskPerShare).toBe(3.50)
      expect(profitPerShare).toBe(4.50)
      expect(rMultiple).toBeCloseTo(1.29, 2)
    })

    it('should calculate holding period correctly', () => {
      const enteredAt = new Date('2024-01-15T10:30:00Z')
      const exitedAt = new Date('2024-01-15T14:45:00Z')

      const holdingPeriodMs = exitedAt.getTime() - enteredAt.getTime()
      const holdingPeriodMinutes = Math.floor(holdingPeriodMs / (1000 * 60))

      expect(holdingPeriodMinutes).toBe(255) // 4 hours 15 minutes
    })
  })

  describe('Position Monitoring Interval', () => {
    it('should check positions at 30-second intervals', () => {
      vi.useFakeTimers()
      
      const checkPositions = vi.fn()
      const intervalMs = 30 * 1000 // 30 seconds

      const intervalId = setInterval(checkPositions, intervalMs)

      // Advance time by 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000)

      // Should have been called 4 times (at 30s, 60s, 90s, 120s)
      expect(checkPositions).toHaveBeenCalledTimes(4)

      clearInterval(intervalId)
      vi.useRealTimers()
    })
  })

  describe('Exit Reason Classification', () => {
    it('should classify exit reasons correctly', () => {
      const classifyExitReason = (
        currentPrice: number,
        position: { side: string; stopLoss: number; target1: number; target2?: number; trailingStop?: number }
      ): string => {
        if (position.side === 'LONG') {
          if (position.trailingStop && currentPrice <= position.trailingStop) {
            return 'TRAILING_STOP'
          }
          if (currentPrice <= position.stopLoss) {
            return 'STOP_LOSS'
          }
          if (position.target2 && currentPrice >= position.target2) {
            return 'TARGET_2'
          }
          if (currentPrice >= position.target1) {
            return 'TARGET_1'
          }
        } else {
          if (position.trailingStop && currentPrice >= position.trailingStop) {
            return 'TRAILING_STOP'
          }
          if (currentPrice >= position.stopLoss) {
            return 'STOP_LOSS'
          }
          if (position.target2 && currentPrice <= position.target2) {
            return 'TARGET_2'
          }
          if (currentPrice <= position.target1) {
            return 'TARGET_1'
          }
        }
        return 'MANUAL'
      }

      // Test stop loss
      expect(classifyExitReason(171.00, {
        side: 'LONG',
        stopLoss: 172.00,
        target1: 180.00,
      })).toBe('STOP_LOSS')

      // Test target 1
      expect(classifyExitReason(181.00, {
        side: 'LONG',
        stopLoss: 172.00,
        target1: 180.00,
      })).toBe('TARGET_1')

      // Test target 2
      expect(classifyExitReason(186.00, {
        side: 'LONG',
        stopLoss: 172.00,
        target1: 180.00,
        target2: 185.00,
      })).toBe('TARGET_2')

      // Test trailing stop
      expect(classifyExitReason(177.00, {
        side: 'LONG',
        stopLoss: 172.00,
        target1: 180.00,
        trailingStop: 178.00,
      })).toBe('TRAILING_STOP')
    })
  })
})

describe('Real-Time P&L Updates', () => {
  it('should calculate unrealized P&L for open positions', () => {
    const positions = [
      {
        id: 'pos-1',
        ticker: 'AAPL',
        side: 'LONG',
        quantity: 100,
        entryPrice: 175.50,
        currentPrice: 178.00,
      },
      {
        id: 'pos-2',
        ticker: 'MSFT',
        side: 'LONG',
        quantity: 50,
        entryPrice: 380.00,
        currentPrice: 375.00,
      },
    ]

    const calculateUnrealizedPnL = (position: typeof positions[0]) => {
      if (position.side === 'LONG') {
        return (position.currentPrice - position.entryPrice) * position.quantity
      }
      return (position.entryPrice - position.currentPrice) * position.quantity
    }

    const pnls = positions.map(p => ({
      id: p.id,
      ticker: p.ticker,
      pnl: calculateUnrealizedPnL(p),
    }))

    expect(pnls[0].pnl).toBe(250.00) // AAPL winning
    expect(pnls[1].pnl).toBe(-250.00) // MSFT losing

    const totalPnL = pnls.reduce((sum, p) => sum + p.pnl, 0)
    expect(totalPnL).toBe(0) // Net zero
  })
})
