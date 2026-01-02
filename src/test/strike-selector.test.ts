import { describe, it, expect, beforeEach } from 'vitest'
import { TradierStrikeSelector, StrikeSelectionUtils } from '../lib/options/strike-selector'
import type { OptionsChain, MarketCondition } from '../types/options'

describe('Strike Selector', () => {
  let strikeSelector: TradierStrikeSelector
  let mockOptionsChain: OptionsChain

  beforeEach(() => {
    strikeSelector = new TradierStrikeSelector()
    
    // Create mock options chain
    mockOptionsChain = {
      symbol: 'SPY',
      underlyingPrice: 500,
      options: {
        calls: [
          {
            symbol: 'SPY250117C00495000',
            strike: 495,
            expiration: '2025-01-17',
            optionType: 'call',
            last: 8.50,
            bid: 8.40,
            ask: 8.60,
            volume: 1000,
            openInterest: 5000,
            greeks: {
              delta: 0.65,
              gamma: 0.05,
              theta: -0.08,
              vega: 0.12,
              rho: 0.03,
              impliedVolatility: 0.25
            },
            intrinsicValue: 5.0,
            timeValue: 3.5,
            daysToExpiration: 14
          },
          {
            symbol: 'SPY250117C00500000',
            strike: 500,
            expiration: '2025-01-17',
            optionType: 'call',
            last: 5.25,
            bid: 5.15,
            ask: 5.35,
            volume: 2000,
            openInterest: 8000,
            greeks: {
              delta: 0.50,
              gamma: 0.06,
              theta: -0.09,
              vega: 0.15,
              rho: 0.02,
              impliedVolatility: 0.26
            },
            intrinsicValue: 0.0,
            timeValue: 5.25,
            daysToExpiration: 14
          },
          {
            symbol: 'SPY250117C00505000',
            strike: 505,
            expiration: '2025-01-17',
            optionType: 'call',
            last: 2.80,
            bid: 2.75,
            ask: 2.85,
            volume: 1500,
            openInterest: 6000,
            greeks: {
              delta: 0.30,
              gamma: 0.04,
              theta: -0.06,
              vega: 0.10,
              rho: 0.01,
              impliedVolatility: 0.27
            },
            intrinsicValue: 0.0,
            timeValue: 2.80,
            daysToExpiration: 14
          }
        ],
        puts: [
          {
            symbol: 'SPY250117P00495000',
            strike: 495,
            expiration: '2025-01-17',
            optionType: 'put',
            last: 2.30,
            bid: 2.25,
            ask: 2.35,
            volume: 800,
            openInterest: 4000,
            greeks: {
              delta: -0.35,
              gamma: 0.05,
              theta: -0.08,
              vega: 0.12,
              rho: -0.02,
              impliedVolatility: 0.25
            },
            intrinsicValue: 0.0,
            timeValue: 2.30,
            daysToExpiration: 14
          },
          {
            symbol: 'SPY250117P00500000',
            strike: 500,
            expiration: '2025-01-17',
            optionType: 'put',
            last: 4.75,
            bid: 4.65,
            ask: 4.85,
            volume: 1200,
            openInterest: 7000,
            greeks: {
              delta: -0.50,
              gamma: 0.06,
              theta: -0.09,
              vega: 0.15,
              rho: -0.03,
              impliedVolatility: 0.26
            },
            intrinsicValue: 0.0,
            timeValue: 4.75,
            daysToExpiration: 14
          },
          {
            symbol: 'SPY250117P00505000',
            strike: 505,
            expiration: '2025-01-17',
            optionType: 'put',
            last: 8.20,
            bid: 8.10,
            ask: 8.30,
            volume: 900,
            openInterest: 5500,
            greeks: {
              delta: -0.65,
              gamma: 0.04,
              theta: -0.06,
              vega: 0.10,
              rho: -0.04,
              impliedVolatility: 0.27
            },
            intrinsicValue: 5.0,
            timeValue: 3.20,
            daysToExpiration: 14
          }
        ]
      },
      expirations: ['2025-01-17', '2025-01-24', '2025-01-31'],
      ivRank: 45,
      ivPercentile: 48,
      fetchedAt: new Date()
    }
  })

  it('should select call strike closest to target delta', async () => {
    const marketCondition: MarketCondition = {
      oscillatorPhase: 'TRENDING',
      ivRank: 45,
      volatilityRegime: 'NORMAL',
      signalQuality: 4
    }

    const selection = await strikeSelector.selectStrike(
      mockOptionsChain,
      0.65,
      'call',
      '2025-01-17',
      marketCondition
    )

    expect(selection.strike).toBe(495)
    expect(selection.actualDelta).toBe(0.65)
    expect(selection.targetDelta).toBe(0.65)
    expect(selection.deltaDeviation).toBe(0)
    expect(selection.optionSymbol).toBe('SPY250117C00495000')
    expect(selection.premium).toBe(8.5) // (8.40 + 8.60) / 2
  })

  it('should select put strike closest to target delta', async () => {
    const marketCondition: MarketCondition = {
      oscillatorPhase: 'TRENDING',
      ivRank: 45,
      volatilityRegime: 'NORMAL',
      signalQuality: 4
    }

    const selection = await strikeSelector.selectStrike(
      mockOptionsChain,
      -0.65,
      'put',
      '2025-01-17',
      marketCondition
    )

    expect(selection.strike).toBe(505)
    expect(selection.actualDelta).toBe(-0.65)
    expect(selection.targetDelta).toBe(-0.65)
    expect(selection.deltaDeviation).toBe(0)
    expect(selection.optionSymbol).toBe('SPY250117P00505000')
  })

  it('should select spread strikes with correct delta targeting', async () => {
    const marketCondition: MarketCondition = {
      oscillatorPhase: 'TRENDING',
      ivRank: 45,
      volatilityRegime: 'NORMAL',
      signalQuality: 4
    }

    const spreadSelection = await strikeSelector.selectSpreadStrikes(
      mockOptionsChain,
      0.65,
      0.30,
      'call',
      '2025-01-17',
      marketCondition
    )

    expect(spreadSelection.longLeg.strike).toBe(495)
    expect(spreadSelection.longLeg.actualDelta).toBe(0.65)
    expect(spreadSelection.shortLeg.strike).toBe(505)
    expect(spreadSelection.shortLeg.actualDelta).toBe(0.30)
    expect(spreadSelection.spreadWidth).toBe(10)
    expect(spreadSelection.netPremium).toBeCloseTo(5.7, 1) // 8.5 - 2.8
  })

  it('should adjust strikes for extreme reversal conditions', () => {
    const baseStrike = 500
    const underlyingPrice = 500
    const oscillatorSignal = {
      isExtremeReversal: true,
      isZoneReversal: false,
      isCompression: false,
      oscillatorValue: 0.8
    }

    const adjustedStrike = strikeSelector.adjustStrikeForConditions(
      baseStrike,
      underlyingPrice,
      oscillatorSignal,
      45
    )

    // For extreme reversal, should move closer to ATM (no change in this case since already ATM)
    expect(adjustedStrike).toBe(500)
  })

  it('should adjust strikes for compression conditions', () => {
    const baseStrike = 495 // ITM call
    const underlyingPrice = 500
    const oscillatorSignal = {
      isExtremeReversal: false,
      isZoneReversal: false,
      isCompression: true,
      oscillatorValue: 0.2
    }

    const adjustedStrike = strikeSelector.adjustStrikeForConditions(
      baseStrike,
      underlyingPrice,
      oscillatorSignal,
      45
    )

    // For compression, should move further from ATM (lower strike for ITM call)
    expect(adjustedStrike).toBeLessThan(495)
  })

  it('should validate selection quality', () => {
    const goodSelection = {
      strike: 495,
      optionSymbol: 'SPY250117C00495000',
      actualDelta: 0.65,
      targetDelta: 0.65,
      deltaDeviation: 0.0,
      premium: 8.5,
      bid: 8.40,
      ask: 8.60,
      greeks: {
        delta: 0.65,
        gamma: 0.05,
        theta: -0.08,
        vega: 0.12,
        rho: 0.03,
        impliedVolatility: 0.25
      },
      reasoning: 'Test selection'
    }

    const isValid = StrikeSelectionUtils.validateSelection(goodSelection)
    expect(isValid).toBe(true)

    const score = StrikeSelectionUtils.calculateSelectionScore(goodSelection)
    expect(score).toBeGreaterThan(85) // Should be high quality
  })

  it('should reject poor quality selections', () => {
    const poorSelection = {
      strike: 495,
      optionSymbol: 'SPY250117C00495000',
      actualDelta: 0.45,
      targetDelta: 0.65,
      deltaDeviation: 0.20, // Large deviation
      premium: 8.5,
      bid: 7.0,
      ask: 10.0, // Wide spread
      greeks: {
        delta: 0.45,
        gamma: 0.05,
        theta: -0.08,
        vega: 0.12,
        rho: 0.03,
        impliedVolatility: 0.25
      },
      reasoning: 'Test selection'
    }

    const isValid = StrikeSelectionUtils.validateSelection(poorSelection)
    expect(isValid).toBe(false)

    const score = StrikeSelectionUtils.calculateSelectionScore(poorSelection)
    expect(score).toBeLessThan(70) // Should be lower quality
  })

  it('should handle missing options gracefully', async () => {
    const emptyChain: OptionsChain = {
      ...mockOptionsChain,
      options: { calls: [], puts: [] }
    }

    const marketCondition: MarketCondition = {
      oscillatorPhase: 'TRENDING',
      ivRank: 45,
      volatilityRegime: 'NORMAL',
      signalQuality: 4
    }

    await expect(
      strikeSelector.selectStrike(emptyChain, 0.65, 'call', '2025-01-17', marketCondition)
    ).rejects.toThrow('No call options available')
  })
})