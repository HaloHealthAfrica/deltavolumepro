import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { TradierStrikeSelector, StrikeSelectionUtils } from '../lib/options/strike-selector'
import type { OptionsChain, MarketCondition, OptionContract } from '../types/options'

/**
 * Property-Based Tests for Strike Selection Delta Targeting Accuracy
 * 
 * Property 2: Strike Selection Delta Targeting Accuracy
 * For any options chain and target delta (0.65 for long options, 0.65/0.30 for spreads), 
 * the strike selection engine should select the option with delta closest to the target, 
 * with deviation minimized and selection reasoning provided.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 * 
 * Property 3: Market Condition Strike Adjustment
 * For any strike selection with market condition inputs, extreme reversal signals should 
 * result in more aggressive strikes (closer to ATM), while compression signals should 
 * result in more conservative strikes (further OTM), with appropriate reasoning.
 * 
 * Validates: Requirements 2.4, 2.5
 */

describe.skip('Property 2: Strike Selection Delta Targeting Accuracy', () => {
  let strikeSelector: TradierStrikeSelector

  beforeEach(() => {
    strikeSelector = new TradierStrikeSelector()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Generate realistic options chain for property testing
  const generateOptionsChain = (
    symbol: string,
    underlyingPrice: number,
    expirations: string[],
    strikeCount: number
  ): OptionsChain => {
    const calls: OptionContract[] = []
    const puts: OptionContract[] = []
    
    const strikeSpacing = 5
    const startStrike = underlyingPrice - (strikeCount / 2) * strikeSpacing
    
    expirations.forEach(expiration => {
      for (let i = 0; i < strikeCount; i++) {
        const strike = startStrike + (i * strikeSpacing)
        const moneyness = underlyingPrice / strike
        const timeToExpiration = Math.max(1, Math.ceil((new Date(expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) / 365
        
        // Generate realistic deltas based on moneyness
        const callDelta = moneyness > 1.1 ? 0.7 + Math.random() * 0.25 : // Deep ITM
                         moneyness > 1.05 ? 0.5 + Math.random() * 0.2 :  // Slightly ITM
                         moneyness > 0.95 ? 0.3 + Math.random() * 0.4 :  // ATM
                         moneyness > 0.9 ? 0.1 + Math.random() * 0.3 :   // Slightly OTM
                         0.05 + Math.random() * 0.15                     // Deep OTM
        
        const putDelta = -(1 - callDelta)
        
        // Generate bid/ask with proper relationship
        const callBid = Math.max(0.05, Math.random() * 10)
        const callAsk = callBid + Math.max(0.01, Math.random() * 2)
        const putBid = Math.max(0.05, Math.random() * 10)
        const putAsk = putBid + Math.max(0.01, Math.random() * 2)
        
        calls.push({
          symbol: `${symbol}${expiration.replace(/-/g, '')}C${String(strike * 1000).padStart(8, '0')}`,
          strike,
          expiration,
          optionType: 'call',
          last: (callBid + callAsk) / 2,
          bid: callBid,
          ask: callAsk,
          volume: Math.floor(Math.random() * 1000),
          openInterest: Math.floor(Math.random() * 5000),
          greeks: {
            delta: callDelta,
            gamma: Math.random() * 0.1,
            theta: -(Math.random() * 0.2),
            vega: Math.random() * 0.5,
            rho: Math.random() * 0.1,
            impliedVolatility: Math.random() * 0.8 + 0.1
          },
          intrinsicValue: Math.max(0, underlyingPrice - strike),
          timeValue: Math.max(0.01, Math.random() * 5),
          daysToExpiration: Math.max(1, Math.ceil((new Date(expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        })
        
        puts.push({
          symbol: `${symbol}${expiration.replace(/-/g, '')}P${String(strike * 1000).padStart(8, '0')}`,
          strike,
          expiration,
          optionType: 'put',
          last: (putBid + putAsk) / 2,
          bid: putBid,
          ask: putAsk,
          volume: Math.floor(Math.random() * 1000),
          openInterest: Math.floor(Math.random() * 5000),
          greeks: {
            delta: putDelta,
            gamma: Math.random() * 0.1,
            theta: -(Math.random() * 0.2),
            vega: Math.random() * 0.5,
            rho: -(Math.random() * 0.1),
            impliedVolatility: Math.random() * 0.8 + 0.1
          },
          intrinsicValue: Math.max(0, strike - underlyingPrice),
          timeValue: Math.max(0.01, Math.random() * 5),
          daysToExpiration: Math.max(1, Math.ceil((new Date(expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        })
      }
    })
    
    return {
      symbol,
      underlyingPrice,
      options: { calls, puts },
      expirations,
      ivRank: Math.floor(Math.random() * 100),
      ivPercentile: Math.floor(Math.random() * 100),
      fetchedAt: new Date()
    }
  }

  it('should always select the option with delta closest to target', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          symbol: fc.stringMatching(/^[A-Z]{2,5}$/),
          underlyingPrice: fc.float({ min: Math.fround(50), max: Math.fround(500), noNaN: true }),
          targetDelta: fc.float({ min: Math.fround(0.1), max: Math.fround(0.9), noNaN: true }),
          optionType: fc.constantFrom('call', 'put'),
          expiration: fc.date({ min: new Date(), max: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) })
            .map(date => date.toISOString().split('T')[0]),
          strikeCount: fc.integer({ min: 10, max: 25 }),
          signalQuality: fc.integer({ min: 1, max: 5 })
        }),
        async ({ symbol, underlyingPrice, targetDelta, optionType, expiration, strikeCount, signalQuality }) => {
          // Adjust target delta for puts (should be negative)
          const adjustedTargetDelta = optionType === 'put' ? -targetDelta : targetDelta
          
          const optionsChain = generateOptionsChain(symbol, underlyingPrice, [expiration], strikeCount)
          
          const marketCondition: MarketCondition = {
            oscillatorPhase: 'TRENDING',
            ivRank: Math.floor(Math.random() * 100),
            volatilityRegime: 'NORMAL',
            signalQuality: signalQuality as 1 | 2 | 3 | 4 | 5
          }
          
          const selection = await strikeSelector.selectStrike(
            optionsChain,
            adjustedTargetDelta,
            optionType,
            expiration,
            marketCondition
          )
          
          // Property: Selected option should have delta closest to target
          const availableOptions = optionType === 'call' ? optionsChain.options.calls : optionsChain.options.puts
          const filteredOptions = availableOptions.filter(opt => opt.expiration === expiration)
          
          if (filteredOptions.length > 0) {
            // Find the option that should have been selected (closest delta)
            let closestOption = filteredOptions[0]
            let smallestDeviation = Math.abs(closestOption.greeks.delta - adjustedTargetDelta)
            
            for (const option of filteredOptions) {
              const deviation = Math.abs(option.greeks.delta - adjustedTargetDelta)
              if (deviation < smallestDeviation) {
                smallestDeviation = deviation
                closestOption = option
              }
            }
            
            // Property: Selection should match the closest delta option
            expect(selection.actualDelta).toBe(closestOption.greeks.delta)
            expect(selection.strike).toBe(closestOption.strike)
            expect(selection.deltaDeviation).toBeCloseTo(smallestDeviation, 4)
            
            // Property: Target delta should match input
            expect(selection.targetDelta).toBe(adjustedTargetDelta)
            
            // Property: Selection should have valid structure
            expect(selection.optionSymbol).toBe(closestOption.symbol)
            expect(selection.premium).toBeGreaterThan(0)
            expect(selection.bid).toBeGreaterThan(0)
            expect(selection.ask).toBeGreaterThan(0)
            expect(selection.ask).toBeGreaterThanOrEqual(selection.bid)
            expect(typeof selection.reasoning).toBe('string')
            expect(selection.reasoning.length).toBeGreaterThan(0)
            
            // Property: Greeks should be valid
            expect(Math.abs(selection.greeks.delta)).toBeLessThanOrEqual(1)
            expect(selection.greeks.gamma).toBeGreaterThanOrEqual(0)
            expect(selection.greeks.theta).toBeLessThanOrEqual(0)
            expect(selection.greeks.vega).toBeGreaterThanOrEqual(0)
            expect(selection.greeks.impliedVolatility).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should maintain delta targeting accuracy for spread selections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          symbol: fc.stringMatching(/^[A-Z]{2,5}$/),
          underlyingPrice: fc.float({ min: Math.fround(100), max: Math.fround(300), noNaN: true }),
          longDelta: fc.float({ min: Math.fround(0.5), max: Math.fround(0.8), noNaN: true }),
          shortDelta: fc.float({ min: Math.fround(0.2), max: Math.fround(0.4), noNaN: true }),
          optionType: fc.constantFrom('call', 'put'),
          expiration: fc.date({ min: new Date(), max: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) })
            .map(date => date.toISOString().split('T')[0]),
          signalQuality: fc.integer({ min: 3, max: 5 })
        }),
        async ({ symbol, underlyingPrice, longDelta, shortDelta, optionType, expiration, signalQuality }) => {
          // Ensure long delta is higher than short delta
          const adjustedLongDelta = Math.max(longDelta, shortDelta + 0.1)
          const adjustedShortDelta = Math.min(shortDelta, longDelta - 0.1)
          
          // Adjust for puts (negative deltas)
          const finalLongDelta = optionType === 'put' ? -adjustedLongDelta : adjustedLongDelta
          const finalShortDelta = optionType === 'put' ? -adjustedShortDelta : adjustedShortDelta
          
          const optionsChain = generateOptionsChain(symbol, underlyingPrice, [expiration], 20)
          
          const marketCondition: MarketCondition = {
            oscillatorPhase: 'TRENDING',
            ivRank: Math.floor(Math.random() * 100),
            volatilityRegime: 'NORMAL',
            signalQuality: signalQuality as 3 | 4 | 5
          }
          
          const spreadSelection = await strikeSelector.selectSpreadStrikes(
            optionsChain,
            finalLongDelta,
            finalShortDelta,
            optionType,
            expiration,
            marketCondition
          )
          
          // Property: Long leg should have higher absolute delta than short leg
          expect(Math.abs(spreadSelection.longLeg.actualDelta)).toBeGreaterThan(
            Math.abs(spreadSelection.shortLeg.actualDelta)
          )
          
          // Property: Delta targeting should be accurate for both legs
          expect(spreadSelection.longLeg.targetDelta).toBe(finalLongDelta)
          expect(spreadSelection.shortLeg.targetDelta).toBe(finalShortDelta)
          
          // Property: Spread structure should be valid
          if (optionType === 'call') {
            // Call spread: long strike < short strike
            expect(spreadSelection.longLeg.strike).toBeLessThan(spreadSelection.shortLeg.strike)
          } else {
            // Put spread: long strike > short strike
            expect(spreadSelection.longLeg.strike).toBeGreaterThan(spreadSelection.shortLeg.strike)
          }
          
          // Property: Spread metrics should be calculated correctly
          expect(spreadSelection.spreadWidth).toBe(
            Math.abs(spreadSelection.longLeg.strike - spreadSelection.shortLeg.strike)
          )
          expect(spreadSelection.netPremium).toBeCloseTo(
            spreadSelection.longLeg.premium - spreadSelection.shortLeg.premium,
            2
          )
          
          // Property: Risk and profit should be positive
          expect(spreadSelection.maxRisk).toBeGreaterThan(0)
          expect(spreadSelection.maxProfit).toBeGreaterThan(0)
          
          // Property: Both legs should have valid structure
          expect(spreadSelection.longLeg.optionSymbol).toBeDefined()
          expect(spreadSelection.shortLeg.optionSymbol).toBeDefined()
          expect(spreadSelection.longLeg.reasoning).toBeDefined()
          expect(spreadSelection.shortLeg.reasoning).toBeDefined()
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should validate selection quality consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          symbol: fc.stringMatching(/^[A-Z]{2,5}$/),
          underlyingPrice: fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }),
          targetDelta: fc.float({ min: Math.fround(0.3), max: Math.fround(0.7), noNaN: true }),
          optionType: fc.constantFrom('call', 'put'),
          expiration: fc.date({ min: new Date(), max: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) })
            .map(date => date.toISOString().split('T')[0])
        }),
        async ({ symbol, underlyingPrice, targetDelta, optionType, expiration }) => {
          const adjustedTargetDelta = optionType === 'put' ? -targetDelta : targetDelta
          
          const optionsChain = generateOptionsChain(symbol, underlyingPrice, [expiration], 15)
          
          const marketCondition: MarketCondition = {
            oscillatorPhase: 'TRENDING',
            ivRank: 50,
            volatilityRegime: 'NORMAL',
            signalQuality: 4
          }
          
          const selection = await strikeSelector.selectStrike(
            optionsChain,
            adjustedTargetDelta,
            optionType,
            expiration,
            marketCondition
          )
          
          // Property: Validation should be consistent
          const isValid = StrikeSelectionUtils.validateSelection(selection)
          const score = StrikeSelectionUtils.calculateSelectionScore(selection)
          
          // Property: Valid selections should have reasonable scores
          if (isValid) {
            expect(score).toBeGreaterThan(50)
          }
          
          // Property: Score should correlate with delta accuracy
          if (selection.deltaDeviation < 0.05) {
            expect(score).toBeGreaterThan(80)
          } else if (selection.deltaDeviation > 0.15) {
            expect(score).toBeLessThan(70)
          }
          
          // Property: Score should be between 0 and 100
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)
          
          // Property: Validation should reject selections with extreme deviations
          if (selection.deltaDeviation > 0.15) {
            expect(isValid).toBe(false)
          }
          
          // Property: Validation should reject selections with wide spreads
          const spreadPercent = (selection.ask - selection.bid) / ((selection.ask + selection.bid) / 2)
          if (spreadPercent > 0.1) {
            expect(isValid).toBe(false)
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})

describe.skip('Property 3: Market Condition Strike Adjustment', () => {
  let strikeSelector: TradierStrikeSelector

  beforeEach(() => {
    strikeSelector = new TradierStrikeSelector()
  })

  it('should adjust strikes more aggressively for extreme reversal conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseStrike: fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }),
          underlyingPrice: fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }),
          ivRank: fc.integer({ min: 0, max: 100 }),
          oscillatorValue: fc.float({ min: Math.fround(0.7), max: Math.fround(1.0), noNaN: true })
        }),
        async ({ baseStrike, underlyingPrice, ivRank, oscillatorValue }) => {
          const extremeReversalCondition = {
            isExtremeReversal: true,
            isZoneReversal: false,
            isCompression: false,
            oscillatorValue
          }
          
          const adjustedStrike = strikeSelector.adjustStrikeForConditions(
            baseStrike,
            underlyingPrice,
            extremeReversalCondition,
            ivRank
          )
          
          // Property: Extreme reversal should move strikes closer to ATM
          const originalDistance = Math.abs(baseStrike - underlyingPrice)
          const adjustedDistance = Math.abs(adjustedStrike - underlyingPrice)
          
          if (originalDistance > 1) { // Only test when there's meaningful distance
            expect(adjustedDistance).toBeLessThanOrEqual(originalDistance)
          }
          
          // Property: Adjustment should be reasonable (not more than 50% change)
          const changePercent = Math.abs(adjustedStrike - baseStrike) / Math.abs(baseStrike - underlyingPrice + 0.01)
          expect(changePercent).toBeLessThanOrEqual(0.5)
          
          // Property: Adjusted strike should be rounded to nearest $0.50
          expect(adjustedStrike % 0.5).toBeCloseTo(0, 2)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should adjust strikes more conservatively for compression conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseStrike: fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }),
          underlyingPrice: fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }),
          ivRank: fc.integer({ min: 0, max: 100 }),
          oscillatorValue: fc.float({ min: Math.fround(0.0), max: Math.fround(0.3), noNaN: true })
        }),
        async ({ baseStrike, underlyingPrice, ivRank, oscillatorValue }) => {
          const compressionCondition = {
            isExtremeReversal: false,
            isZoneReversal: false,
            isCompression: true,
            oscillatorValue
          }
          
          const adjustedStrike = strikeSelector.adjustStrikeForConditions(
            baseStrike,
            underlyingPrice,
            compressionCondition,
            ivRank
          )
          
          // Property: Compression should move strikes further from ATM
          const originalDistance = Math.abs(baseStrike - underlyingPrice)
          const adjustedDistance = Math.abs(adjustedStrike - underlyingPrice)
          
          if (originalDistance > 1) { // Only test when there's meaningful distance
            expect(adjustedDistance).toBeGreaterThanOrEqual(originalDistance)
          }
          
          // Property: Adjustment should be reasonable (not more than 30% change)
          const changePercent = Math.abs(adjustedStrike - baseStrike) / Math.abs(baseStrike - underlyingPrice + 0.01)
          expect(changePercent).toBeLessThanOrEqual(0.3)
          
          // Property: Adjusted strike should be rounded to nearest $0.50
          expect(adjustedStrike % 0.5).toBeCloseTo(0, 2)
        }
      ),
      { numRuns: 25 }
    )
  })

  it('should apply high IV adjustments consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseStrike: fc.float({ min: Math.fround(80), max: Math.fround(120), noNaN: true }),
          underlyingPrice: fc.float({ min: Math.fround(90), max: Math.fround(110), noNaN: true }),
          highIVRank: fc.integer({ min: 71, max: 100 })
        }),
        async ({ baseStrike, underlyingPrice, highIVRank }) => {
          const neutralCondition = {
            isExtremeReversal: false,
            isZoneReversal: false,
            isCompression: false,
            oscillatorValue: 0.5
          }
          
          const adjustedStrike = strikeSelector.adjustStrikeForConditions(
            baseStrike,
            underlyingPrice,
            neutralCondition,
            highIVRank
          )
          
          // Property: High IV should make strikes slightly more conservative
          const originalDistance = Math.abs(baseStrike - underlyingPrice)
          const adjustedDistance = Math.abs(adjustedStrike - underlyingPrice)
          
          if (originalDistance > 2) { // Only test when there's meaningful distance
            expect(adjustedDistance).toBeGreaterThanOrEqual(originalDistance * 0.95) // Allow small tolerance
          }
          
          // Property: High IV adjustment should be modest (max 15% change)
          const changePercent = Math.abs(adjustedStrike - baseStrike) / Math.abs(baseStrike - underlyingPrice + 0.01)
          expect(changePercent).toBeLessThanOrEqual(0.15)
          
          // Property: Adjusted strike should be rounded to nearest $0.50
          expect(adjustedStrike % 0.5).toBeCloseTo(0, 2)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('should handle edge cases without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseStrike: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          underlyingPrice: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          ivRank: fc.integer({ min: 0, max: 100 }),
          isExtremeReversal: fc.boolean(),
          isCompression: fc.boolean(),
          oscillatorValue: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true })
        }),
        async ({ baseStrike, underlyingPrice, ivRank, isExtremeReversal, isCompression, oscillatorValue }) => {
          const condition = {
            isExtremeReversal,
            isZoneReversal: false,
            isCompression: isExtremeReversal ? false : isCompression, // Avoid conflicting conditions
            oscillatorValue
          }
          
          // Property: Function should not throw errors for any valid inputs
          expect(() => {
            const adjustedStrike = strikeSelector.adjustStrikeForConditions(
              baseStrike,
              underlyingPrice,
              condition,
              ivRank
            )
            
            // Property: Result should be a valid number
            expect(typeof adjustedStrike).toBe('number')
            expect(isNaN(adjustedStrike)).toBe(false)
            expect(isFinite(adjustedStrike)).toBe(true)
            
            // Property: Result should be positive
            expect(adjustedStrike).toBeGreaterThan(0)
            
            // Property: Result should be rounded to nearest $0.50
            expect(adjustedStrike % 0.5).toBeCloseTo(0, 2)
            
          }).not.toThrow()
        }
      ),
      { numRuns: 30 }
    )
  })
})