import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { OptionsPositionMonitor, MonitoringUtils } from '../lib/options/position-monitor'
import type { OptionsPosition, Greeks } from '../types/options'

// Define the interface for the mock Tradier client
interface MockTradierClient {
  getOptionQuote: ReturnType<typeof vi.fn>
  getQuote: ReturnType<typeof vi.fn>
}

/**
 * Unit Tests for Real-Time Options Position Monitoring System
 * 
 * Tests the core functionality of position monitoring including Greeks updates,
 * P&L calculation, and risk metric tracking.
 */

describe('OptionsPositionMonitor', () => {
  let monitor: OptionsPositionMonitor
  let mockTradierClient: MockTradierClient
  let mockPosition: OptionsPosition

  beforeEach(() => {
    // Mock Tradier client
    mockTradierClient = {
      getOptionQuote: vi.fn(),
      getQuote: vi.fn(),
    }

    monitor = new OptionsPositionMonitor(mockTradierClient as any, {
      updateIntervalSeconds: 1, // Fast for testing
      significantGreeksChange: 0.05
    })

    // Mock position
    mockPosition = {
      id: 'test-position-1',
      tradeId: 'test-trade-1',
      symbol: 'SPY',
      optionSymbol: 'SPY240216C00500000',
      strategy: {
        type: 'LONG_CALL',
        direction: 'BULLISH',
        volatilityBias: 'LONG_VOL',
        riskProfile: 'MODERATE',
        maxRisk: 1000,
        maxProfit: null,
        breakevens: [505],
        reasoning: 'Test position'
      },
      entryDate: new Date('2024-02-01'),
      entryPrice: 5.00,
      contracts: 2,
      entryGreeks: {
        delta: 0.65,
        gamma: 0.05,
        theta: -0.10,
        vega: 0.20,
        rho: 0.05,
        impliedVolatility: 0.25
      },
      entryIV: 0.25,
      currentPrice: 5.50,
      currentGreeks: {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
        impliedVolatility: 0
      },
      currentIV: 0,
      currentPnL: 0,
      pnlPercent: 0,
      strike: 500,
      expiration: new Date('2024-02-16'),
      daysToExpiration: 15,
      optionType: 'call',
      maxRisk: 1000,
      maxProfit: null,
      breakeven: 505,
      target1Hit: false,
      target2Hit: false,
      target3Hit: false,
      exitConditions: [],
      tradierOrderId: 'ORDER123',
      status: 'OPEN',
      lastUpdated: new Date()
    }

    // Setup mock responses
    mockTradierClient.getOptionQuote.mockResolvedValue({
      symbol: 'SPY240216C00500000',
      last: 5.50,
      bid: 5.40,
      ask: 5.60,
      greeks: {
        delta: 0.68,
        gamma: 0.06,
        theta: -0.12,
        vega: 0.22,
        rho: 0.06,
        mid_iv: 0.27
      }
    })

    mockTradierClient.getQuote.mockResolvedValue({
      symbol: 'SPY',
      last: 502.50,
      close: 502.50
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('startMonitoring', () => {
    it('should start monitoring a position', async () => {
      await monitor.startMonitoring(mockPosition)
      
      const activePositions = monitor.getActivePositions()
      expect(activePositions).toHaveLength(1)
      expect(activePositions[0].id).toBe(mockPosition.id)
    })

    it('should perform initial position update', async () => {
      await monitor.startMonitoring(mockPosition)
      
      expect(mockTradierClient.getOptionQuote).toHaveBeenCalledWith(mockPosition.optionSymbol)
      expect(mockTradierClient.getQuote).toHaveBeenCalledWith(mockPosition.symbol)
      
      const snapshot = monitor.getCurrentSnapshot(mockPosition.id)
      expect(snapshot).toBeDefined()
      expect(snapshot?.optionPrice).toBe(5.50)
      expect(snapshot?.greeks.delta).toBe(0.68)
    })
  })

  describe('stopMonitoring', () => {
    it('should stop monitoring a position', async () => {
      await monitor.startMonitoring(mockPosition)
      expect(monitor.getActivePositions()).toHaveLength(1)
      
      await monitor.stopMonitoring(mockPosition.id)
      expect(monitor.getActivePositions()).toHaveLength(0)
      
      const snapshot = monitor.getCurrentSnapshot(mockPosition.id)
      expect(snapshot).toBeNull()
    })
  })

  describe('updatePosition', () => {
    beforeEach(async () => {
      await monitor.startMonitoring(mockPosition)
    })

    it('should update position with current market data', async () => {
      const update = await monitor.updatePosition(mockPosition.id)
      
      expect(update.tradeId).toBe(mockPosition.tradeId)
      expect(update.currentPrice).toBe(5.50)
      expect(update.currentGreeks.delta).toBe(0.68)
      expect(update.daysToExpiration).toBeGreaterThan(0)
      expect(update.lastUpdated).toBeInstanceOf(Date)
    })

    it('should calculate P&L correctly', async () => {
      const update = await monitor.updatePosition(mockPosition.id)
      
      // Entry: 2 contracts * $5.00 * 100 = $1,000
      // Current: 2 contracts * $5.50 * 100 = $1,100
      // P&L: $100
      expect(update.currentPnL).toBe(100)
      expect(update.pnlPercent).toBe(0.1) // 10%
    })

    it('should update position object in memory', async () => {
      await monitor.updatePosition(mockPosition.id)
      
      const activePositions = monitor.getActivePositions()
      const updatedPosition = activePositions[0]
      
      expect(updatedPosition.currentPrice).toBe(5.50)
      expect(updatedPosition.currentGreeks?.delta).toBe(0.68)
      expect(updatedPosition.currentIV).toBe(0.27)
      expect(updatedPosition.currentPnL).toBe(100)
    })
  })

  describe('calculateCurrentPnL', () => {
    it('should calculate P&L components correctly', async () => {
      await monitor.startMonitoring(mockPosition)
      
      const currentQuote = {
        last: 6.00,
        bid: 5.90,
        ask: 6.10
      }
      
      const pnl = await monitor.calculateCurrentPnL(mockPosition, currentQuote, 505)
      
      // Total P&L: (6.00 - 5.00) * 2 * 100 = $200
      expect(pnl.totalPnL).toBe(200)
      
      // Intrinsic value for call: max(0, 505 - 500) = $5 per share
      expect(pnl.intrinsicValue).toBe(1000) // 2 contracts * $5 * 100
      
      // Time value: $6.00 - $5.00 = $1.00 per share
      expect(pnl.timeValue).toBe(200) // 2 contracts * $1 * 100
    })

    it('should handle put options correctly', async () => {
      const putPosition = {
        ...mockPosition,
        optionType: 'put' as const,
        strike: 495
      }
      
      await monitor.startMonitoring(putPosition)
      
      const currentQuote = {
        last: 3.00,
        bid: 2.90,
        ask: 3.10
      }
      
      const pnl = await monitor.calculateCurrentPnL(putPosition, currentQuote, 490)
      
      // Intrinsic value for put: max(0, 495 - 490) = $5 per share
      expect(pnl.intrinsicValue).toBe(1000) // 2 contracts * $5 * 100
    })
  })

  describe('getGreeksUpdate', () => {
    it('should fetch and return current Greeks', async () => {
      const greeks = await monitor.getGreeksUpdate(mockPosition.optionSymbol)
      
      expect(greeks.delta).toBe(0.68)
      expect(greeks.gamma).toBe(0.06)
      expect(greeks.theta).toBe(-0.12)
      expect(greeks.vega).toBe(0.22)
      expect(greeks.impliedVolatility).toBe(0.27)
    })

    it('should handle missing Greeks gracefully', async () => {
      mockTradierClient.getOptionQuote.mockResolvedValue({
        symbol: 'SPY240216C00500000',
        last: 5.50,
        bid: 5.40,
        ask: 5.60,
        greeks: null // No Greeks data
      })
      
      const greeks = await monitor.getGreeksUpdate(mockPosition.optionSymbol)
      
      expect(greeks.delta).toBe(0)
      expect(greeks.gamma).toBe(0)
      expect(greeks.theta).toBe(0)
      expect(greeks.vega).toBe(0)
      expect(greeks.impliedVolatility).toBe(0)
    })
  })

  describe('alert system', () => {
    it('should emit alerts for significant Greeks changes', async () => {
      const alerts: any[] = []
      monitor.onAlert((alert) => alerts.push(alert))
      
      await monitor.startMonitoring(mockPosition)
      
      // Simulate significant delta change
      mockTradierClient.getOptionQuote.mockResolvedValue({
        symbol: 'SPY240216C00500000',
        last: 6.00,
        bid: 5.90,
        ask: 6.10,
        greeks: {
          delta: 0.75, // Significant change from 0.68
          gamma: 0.06,
          theta: -0.12,
          vega: 0.22,
          rho: 0.06,
          mid_iv: 0.27
        }
      })
      
      await monitor.updatePosition(mockPosition.id)
      
      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe('GREEKS_CHANGE')
      expect(alerts[0].severity).toBe('MEDIUM')
    })

    it('should emit DTE warning alerts', async () => {
      const alerts: any[] = []
      monitor.onAlert((alert) => alerts.push(alert))
      
      // Position with 2 days to expiration
      const shortDTEPosition = {
        ...mockPosition,
        expiration: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 days from now
      }
      
      await monitor.startMonitoring(shortDTEPosition)
      
      expect(alerts).toHaveLength(1)
      expect(alerts[0].alertType).toBe('DTE_WARNING')
      expect(alerts[0].severity).toBe('HIGH')
    })
  })

  describe('monitoring statistics', () => {
    it('should provide accurate monitoring statistics', async () => {
      await monitor.startMonitoring(mockPosition)
      
      const stats = monitor.getMonitoringStats()
      
      expect(stats.activePositions).toBe(1)
      expect(stats.averageUpdateInterval).toBe(1)
      expect(stats.totalDeltaExposure).toBeGreaterThan(0)
    })
  })
})

describe('MonitoringUtils', () => {
  describe('validateConfig', () => {
    it('should validate good configurations', () => {
      const goodConfig = {
        updateIntervalSeconds: 30,
        significantGreeksChange: 0.05,
        maxConcurrentUpdates: 10,
        retryAttempts: 3,
        timeoutMs: 5000
      }
      
      const result = MonitoringUtils.validateConfig(goodConfig)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject configurations with too short update intervals', () => {
      const badConfig = {
        updateIntervalSeconds: 2, // Too short
        significantGreeksChange: 0.05,
        maxConcurrentUpdates: 10,
        retryAttempts: 3,
        timeoutMs: 5000
      }
      
      const result = MonitoringUtils.validateConfig(badConfig)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Update interval must be at least 5 seconds')
    })

    it('should reject configurations with invalid Greeks change thresholds', () => {
      const badConfig = {
        updateIntervalSeconds: 30,
        significantGreeksChange: 0.6, // Too high
        maxConcurrentUpdates: 10,
        retryAttempts: 3,
        timeoutMs: 5000
      }
      
      const result = MonitoringUtils.validateConfig(badConfig)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Significant Greeks change must be between 1% and 50%')
    })
  })

  describe('calculatePortfolioRisk', () => {
    it('should calculate portfolio-level risk metrics', () => {
      const snapshots = [
        {
          positionId: 'pos1',
          timestamp: new Date(),
          underlyingPrice: 500,
          optionPrice: 5.50,
          greeks: { delta: 0.65, gamma: 0.05, theta: -0.10, vega: 0.20, rho: 0.05, impliedVolatility: 0.25 },
          impliedVolatility: 0.25,
          daysToExpiration: 15,
          pnl: { totalPnL: 100, intrinsicValue: 0, timeValue: 550, volatilityPnL: 0, thetaDecay: -20, deltaChange: 100, gammaEffect: 0, vegaEffect: 0 },
          riskMetrics: { deltaExposure: 65000, gammaRisk: 5000, thetaDecay: 20, vegaRisk: 40, portfolioDelta: 130, portfolioGamma: 10 }
        },
        {
          positionId: 'pos2',
          timestamp: new Date(),
          underlyingPrice: 500,
          optionPrice: 3.00,
          greeks: { delta: -0.35, gamma: 0.04, theta: -0.08, vega: 0.15, rho: -0.03, impliedVolatility: 0.23 },
          impliedVolatility: 0.23,
          daysToExpiration: 15,
          pnl: { totalPnL: -50, intrinsicValue: 0, timeValue: 300, volatilityPnL: 0, thetaDecay: -16, deltaChange: -50, gammaEffect: 0, vegaEffect: 0 },
          riskMetrics: { deltaExposure: -35000, gammaRisk: 4000, thetaDecay: 16, vegaRisk: 30, portfolioDelta: -70, portfolioGamma: 8 }
        }
      ]
      
      const portfolioRisk = MonitoringUtils.calculatePortfolioRisk(snapshots)
      
      expect(portfolioRisk.netDelta).toBe(60) // 130 + (-70)
      expect(portfolioRisk.netGamma).toBe(18) // 10 + 8
      expect(portfolioRisk.netTheta).toBe(-36) // -20 + (-16)
      expect(portfolioRisk.netVega).toBe(70) // 40 + 30
      expect(portfolioRisk.totalNotional).toBe(100000) // |65000| + |-35000|
    })
  })
})