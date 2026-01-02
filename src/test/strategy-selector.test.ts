import { describe, it, expect, beforeEach } from 'vitest'
import { OptionsStrategySelector, OptionsOrderExecutor, StrategyUtils } from '../lib/options/strategy-selector'
import type { TradingSignal, StrategySelection } from '../lib/options/strategy-selector'
import type { MarketCondition, StrikeSelection, SpreadSelection } from '../types/options'

/**
 * Unit Tests for Multi-Strategy Options Execution System
 * 
 * Tests strategy selection based on IV rank, signal direction, and market conditions,
 * as well as order execution planning.
 */

describe('OptionsStrategySelector', () => {
  let strategySelector: OptionsStrategySelector

  beforeEach(() => {
    strategySelector = new OptionsStrategySelector()
  })

  describe('selectStrategy', () => {
    it('should select long calls for low IV + bullish reversal', async () => {
      const bullishReversalSignal: TradingSignal = {
        action: 'LONG',
        ticker: 'SPY',
        direction: 'BULLISH',
        quality: 5,
        oscillator: {
          isExtremeReversal: true,
          isZoneReversal: false,
          isCompression: false,
          oscillatorValue: 0.9
        }
      }

      const lowIVMarketCondition: MarketCondition = {
        oscillatorPhase: 'EXTREME_REVERSAL',
        ivRank: 25, // Low IV
        volatilityRegime: 'LOW',
        signalQuality: 5
      }

      const selection = await strategySelector.selectStrategy(
        bullishReversalSignal,
        25,
        lowIVMarketCondition
      )

      expect(selection.strategy.type).toBe('LONG_CALL')
      expect(selection.strategy.volatilityBias).toBe('LONG_VOL')
      expect(selection.reasoning).toContain('Low IV rank')
      expect(selection.confidence).toBeGreaterThan(0.7)
    })

    it('should select long puts for low IV + bearish reversal', async () => {
      const bearishReversalSignal: TradingSignal = {
        action: 'SHORT',
        ticker: 'SPY',
        direction: 'BEARISH',
        quality: 5,
        oscillator: {
          isExtremeReversal: true,
          isZoneReversal: false,
          isCompression: false,
          oscillatorValue: 0.1
        }
      }

      const lowIVMarketCondition: MarketCondition = {
        oscillatorPhase: 'EXTREME_REVERSAL',
        ivRank: 20,
        volatilityRegime: 'LOW',
        signalQuality: 5
      }

      const selection = await strategySelector.selectStrategy(
        bearishReversalSignal,
        20,
        lowIVMarketCondition
      )

      expect(selection.strategy.type).toBe('LONG_PUT')
      expect(selection.strategy.volatilityBias).toBe('LONG_VOL')
    })

    it('should select bull put spread for high IV + bullish signal', async () => {
      const bullishSignal: TradingSignal = {
        action: 'LONG',
        ticker: 'SPY',
        direction: 'BULLISH',
        quality: 4,
        oscillator: {
          isExtremeReversal: false,
          isZoneReversal: false,
          isCompression: false,
          oscillatorValue: 0.6
        }
      }

      const highIVMarketCondition: MarketCondition = {
        oscillatorPhase: 'TRENDING',
        ivRank: 80, // High IV
        volatilityRegime: 'HIGH',
        signalQuality: 4
      }

      const selection = await strategySelector.selectStrategy(
        bullishSignal,
        80,
        highIVMarketCondition
      )

      expect(selection.strategy.type).toBe('BULL_PUT_SPREAD')
      expect(selection.strategy.volatilityBias).toBe('SHORT_VOL')
      expect(selection.reasoning).toContain('High IV rank')
    })

    it('should select bear call spread for high IV + bearish signal', async () => {
      const bearishSignal: TradingSignal = {
        action: 'SHORT',
        ticker: 'SPY',
        direction: 'BEARISH',
        quality: 4,
        oscillator: {
          isExtremeReversal: false,
          isZoneReversal: false,
          isCompression: false,
          oscillatorValue: 0.3
        }
      }

      const highIVMarketCondition: MarketCondition = {
        oscillatorPhase: 'TRENDING',
        ivRank: 75,
        volatilityRegime: 'HIGH',
        signalQuality: 4
      }

      const selection = await strategySelector.selectStrategy(
        bearishSignal,
        75,
        highIVMarketCondition
      )

      expect(selection.strategy.type).toBe('BEAR_CALL_SPREAD')
      expect(selection.strategy.volatilityBias).toBe('SHORT_VOL')
    })

    it('should select bull call spread for medium IV + high quality bullish signal', async () => {
      const bullishSignal: TradingSignal = {
        action: 'LONG',
        ticker: 'SPY',
        direction: 'BULLISH',
        quality: 5,
        oscillator: {
          isExtremeReversal: false,
          isZoneReversal: true,
          isCompression: false,
          oscillatorValue: 0.7
        }
      }

      const mediumIVMarketCondition: MarketCondition = {
        oscillatorPhase: 'ZONE_REVERSAL',
        ivRank: 45, // Medium IV
        volatilityRegime: 'NORMAL',
        signalQuality: 5
      }

      const selection = await strategySelector.selectStrategy(
        bullishSignal,
        45,
        mediumIVMarketCondition
      )

      expect(selection.strategy.type).toBe('BULL_CALL_SPREAD')
      expect(selection.strategy.riskProfile).toBe('AGGRESSIVE')
    })

    it('should use conservative approach for low quality signals', async () => {
      const lowQualitySignal: TradingSignal = {
        action: 'LONG',
        ticker: 'SPY',
        direction: 'BULLISH',
        quality: 2,
        oscillator: {
          isExtremeReversal: false,
          isZoneReversal: false,
          isCompression: false,
          oscillatorValue: 0.5
        }
      }

      const normalMarketCondition: MarketCondition = {
        oscillatorPhase: 'TRENDING',
        ivRank: 50,
        volatilityRegime: 'NORMAL',
        signalQuality: 2
      }

      const selection = await strategySelector.selectStrategy(
        lowQualitySignal,
        50,
        normalMarketCondition
      )

      expect(selection.strategy.type).toBe('LONG_CALL')
      expect(selection.strategy.riskProfile).toBe('CONSERVATIVE')
      expect(selection.confidence).toBeLessThan(0.6)
    })
  })

  describe('validateStrategy', () => {
    it('should reject long vol strategies in extremely high IV', () => {
      const longVolStrategy = {
        type: 'LONG_CALL' as const,
        direction: 'BULLISH' as const,
        volatilityBias: 'LONG_VOL' as const,
        riskProfile: 'MODERATE' as const,
        maxRisk: 1000,
        maxProfit: null,
        breakevens: [105],
        reasoning: 'Test strategy'
      }

      const extremeHighIVCondition: MarketCondition = {
        oscillatorPhase: 'TRENDING',
        ivRank: 85, // Extremely high IV
        volatilityRegime: 'HIGH',
        signalQuality: 4
      }

      const isValid = strategySelector.validateStrategy(longVolStrategy, extremeHighIVCondition)
      expect(isValid).toBe(false)
    })

    it('should reject short vol strategies in extremely low IV', () => {
      const shortVolStrategy = {
        type: 'BULL_PUT_SPREAD' as const,
        direction: 'BULLISH' as const,
        volatilityBias: 'SHORT_VOL' as const,
        riskProfile: 'MODERATE' as const,
        maxRisk: 500,
        maxProfit: 1000,
        breakevens: [95],
        reasoning: 'Test strategy'
      }

      const extremeLowIVCondition: MarketCondition = {
        oscillatorPhase: 'TRENDING',
        ivRank: 15, // Extremely low IV
        volatilityRegime: 'LOW',
        signalQuality: 4
      }

      const isValid = strategySelector.validateStrategy(shortVolStrategy, extremeLowIVCondition)
      expect(isValid).toBe(false)
    })

    it('should reject aggressive strategies with low quality signals', () => {
      const aggressiveStrategy = {
        type: 'LONG_CALL' as const,
        direction: 'BULLISH' as const,
        volatilityBias: 'LONG_VOL' as const,
        riskProfile: 'AGGRESSIVE' as const,
        maxRisk: 2000,
        maxProfit: null,
        breakevens: [110],
        reasoning: 'Test strategy'
      }

      const lowQualityCondition: MarketCondition = {
        oscillatorPhase: 'TRENDING',
        ivRank: 50,
        volatilityRegime: 'NORMAL',
        signalQuality: 2 // Low quality
      }

      const isValid = strategySelector.validateStrategy(aggressiveStrategy, lowQualityCondition)
      expect(isValid).toBe(false)
    })

    it('should accept well-aligned strategies', () => {
      const goodStrategy = {
        type: 'LONG_CALL' as const,
        direction: 'BULLISH' as const,
        volatilityBias: 'LONG_VOL' as const,
        riskProfile: 'MODERATE' as const,
        maxRisk: 1000,
        maxProfit: null,
        breakevens: [105],
        reasoning: 'Test strategy'
      }

      const goodCondition: MarketCondition = {
        oscillatorPhase: 'EXTREME_REVERSAL',
        ivRank: 30, // Good for long vol
        volatilityRegime: 'NORMAL',
        signalQuality: 4
      }

      const isValid = strategySelector.validateStrategy(goodStrategy, goodCondition)
      expect(isValid).toBe(true)
    })
  })
})

describe('OptionsOrderExecutor', () => {
  let orderExecutor: OptionsOrderExecutor

  beforeEach(() => {
    orderExecutor = new OptionsOrderExecutor()
  })

  describe('createExecutionPlan', () => {
    it('should create single leg execution plan for long calls', async () => {
      const strategy = {
        type: 'LONG_CALL' as const,
        direction: 'BULLISH' as const,
        volatilityBias: 'LONG_VOL' as const,
        riskProfile: 'MODERATE' as const,
        maxRisk: 1000,
        maxProfit: null,
        breakevens: [105],
        reasoning: 'Test strategy'
      }

      const strike: StrikeSelection = {
        strike: 100,
        optionSymbol: 'SPY240216C00100000',
        actualDelta: 0.65,
        targetDelta: 0.65,
        deltaDeviation: 0.0,
        premium: 5.00,
        bid: 4.90,
        ask: 5.10,
        greeks: {
          delta: 0.65,
          gamma: 0.05,
          theta: -0.10,
          vega: 0.20,
          rho: 0.05,
          impliedVolatility: 0.25
        },
        reasoning: 'Test strike'
      }

      const plan = await orderExecutor.createExecutionPlan(strategy, strike, 5)

      expect(plan.legs).toHaveLength(1)
      expect(plan.legs[0].side).toBe('BUY_TO_OPEN')
      expect(plan.legs[0].quantity).toBe(5)
      expect(plan.orderType).toBe('MARKET') // Tight spread
    })

    it('should use limit orders for wide spreads', async () => {
      const strategy = {
        type: 'LONG_CALL' as const,
        direction: 'BULLISH' as const,
        volatilityBias: 'LONG_VOL' as const,
        riskProfile: 'MODERATE' as const,
        maxRisk: 1000,
        maxProfit: null,
        breakevens: [105],
        reasoning: 'Test strategy'
      }

      const wideSpreadStrike: StrikeSelection = {
        strike: 100,
        optionSymbol: 'SPY240216C00100000',
        actualDelta: 0.65,
        targetDelta: 0.65,
        deltaDeviation: 0.0,
        premium: 5.00,
        bid: 4.50, // Wide spread
        ask: 5.50,
        greeks: {
          delta: 0.65,
          gamma: 0.05,
          theta: -0.10,
          vega: 0.20,
          rho: 0.05,
          impliedVolatility: 0.25
        },
        reasoning: 'Test strike'
      }

      const plan = await orderExecutor.createExecutionPlan(strategy, wideSpreadStrike, 3)

      expect(plan.orderType).toBe('LIMIT')
      expect(plan.legs[0].price).toBe(5.00) // Mid-price
      expect(plan.timeInForce).toBe('GTC')
    })

    it('should create spread execution plan for bull call spreads', async () => {
      const strategy = {
        type: 'BULL_CALL_SPREAD' as const,
        direction: 'BULLISH' as const,
        volatilityBias: 'NEUTRAL_VOL' as const,
        riskProfile: 'MODERATE' as const,
        maxRisk: 500,
        maxProfit: 1000,
        breakevens: [102.5],
        reasoning: 'Test strategy'
      }

      const spread: SpreadSelection = {
        longLeg: {
          strike: 100,
          optionSymbol: 'SPY240216C00100000',
          actualDelta: 0.65,
          targetDelta: 0.65,
          deltaDeviation: 0.0,
          premium: 5.00,
          bid: 4.90,
          ask: 5.10,
          greeks: {
            delta: 0.65,
            gamma: 0.05,
            theta: -0.10,
            vega: 0.20,
            rho: 0.05,
            impliedVolatility: 0.25
          },
          reasoning: 'Long leg'
        },
        shortLeg: {
          strike: 105,
          optionSymbol: 'SPY240216C00105000',
          actualDelta: 0.35,
          targetDelta: 0.30,
          deltaDeviation: 0.05,
          premium: 2.50,
          bid: 2.40,
          ask: 2.60,
          greeks: {
            delta: 0.35,
            gamma: 0.04,
            theta: -0.08,
            vega: 0.15,
            rho: 0.03,
            impliedVolatility: 0.23
          },
          reasoning: 'Short leg'
        },
        netPremium: 2.50,
        maxRisk: 250,
        maxProfit: 250,
        breakeven: 102.5,
        spreadWidth: 5
      }

      const plan = await orderExecutor.createExecutionPlan(strategy, spread, 2)

      expect(plan.orderType).toBe('SPREAD')
      expect(plan.legs).toHaveLength(2)
      expect(plan.legs[0].side).toBe('BUY_TO_OPEN')
      expect(plan.legs[1].side).toBe('SELL_TO_OPEN')
      expect(plan.netPrice).toBe(2.50)
    })
  })

  describe('determineOrderType', () => {
    it('should use market orders for tight spreads', () => {
      const orderType = orderExecutor.determineOrderType(4.95, 5.05, {
        type: 'LONG_CALL',
        direction: 'BULLISH',
        volatilityBias: 'LONG_VOL',
        riskProfile: 'MODERATE',
        maxRisk: 1000,
        maxProfit: null,
        breakevens: [105],
        reasoning: 'Test'
      })

      expect(orderType).toBe('MARKET')
    })

    it('should use limit orders for wide spreads', () => {
      const orderType = orderExecutor.determineOrderType(4.50, 5.50, {
        type: 'LONG_CALL',
        direction: 'BULLISH',
        volatilityBias: 'LONG_VOL',
        riskProfile: 'MODERATE',
        maxRisk: 1000,
        maxProfit: null,
        breakevens: [105],
        reasoning: 'Test'
      })

      expect(orderType).toBe('LIMIT')
    })
  })
})

describe('StrategyUtils', () => {
  describe('validateStrategySelection', () => {
    it('should validate high confidence selections', () => {
      const goodSelection: StrategySelection = {
        strategy: {
          type: 'LONG_CALL',
          direction: 'BULLISH',
          volatilityBias: 'LONG_VOL',
          riskProfile: 'MODERATE',
          maxRisk: 1000,
          maxProfit: null,
          breakevens: [105],
          reasoning: 'Good strategy'
        },
        reasoning: 'High confidence selection',
        confidence: 0.8,
        riskProfile: 'MODERATE',
        expectedReturn: 0.4,
        maxRisk: 1000,
        breakevens: [105]
      }

      expect(StrategyUtils.validateStrategySelection(goodSelection)).toBe(true)
    })

    it('should reject low confidence selections', () => {
      const badSelection: StrategySelection = {
        strategy: {
          type: 'LONG_CALL',
          direction: 'BULLISH',
          volatilityBias: 'LONG_VOL',
          riskProfile: 'MODERATE',
          maxRisk: 1000,
          maxProfit: null,
          breakevens: [105],
          reasoning: 'Low confidence strategy'
        },
        reasoning: 'Low confidence selection',
        confidence: 0.2, // Too low
        riskProfile: 'MODERATE',
        expectedReturn: 0.1,
        maxRisk: 1000,
        breakevens: [105]
      }

      expect(StrategyUtils.validateStrategySelection(badSelection)).toBe(false)
    })

    it('should reject aggressive strategies with insufficient confidence', () => {
      const aggressiveSelection: StrategySelection = {
        strategy: {
          type: 'LONG_CALL',
          direction: 'BULLISH',
          volatilityBias: 'LONG_VOL',
          riskProfile: 'AGGRESSIVE',
          maxRisk: 2000,
          maxProfit: null,
          breakevens: [110],
          reasoning: 'Aggressive strategy'
        },
        reasoning: 'Aggressive but low confidence',
        confidence: 0.6, // Not high enough for aggressive
        riskProfile: 'AGGRESSIVE',
        expectedReturn: 0.5,
        maxRisk: 2000,
        breakevens: [110]
      }

      expect(StrategyUtils.validateStrategySelection(aggressiveSelection)).toBe(false)
    })
  })

  describe('calculateEffectivenessScore', () => {
    it('should give high scores for well-aligned strategies', () => {
      const goodSelection: StrategySelection = {
        strategy: {
          type: 'LONG_CALL',
          direction: 'BULLISH',
          volatilityBias: 'LONG_VOL',
          riskProfile: 'AGGRESSIVE',
          maxRisk: 1000,
          maxProfit: null,
          breakevens: [105],
          reasoning: 'Good strategy'
        },
        reasoning: 'Well aligned',
        confidence: 0.8,
        riskProfile: 'AGGRESSIVE',
        expectedReturn: 0.5,
        maxRisk: 1000,
        breakevens: [105]
      }

      const score = StrategyUtils.calculateEffectivenessScore(goodSelection, 25, 5)
      expect(score).toBeGreaterThan(90) // High confidence + good IV alignment + 5-star signal
    })
  })

  describe('analyzeRiskReward', () => {
    it('should analyze spread strategies correctly', () => {
      const analysis = StrategyUtils.analyzeRiskReward(
        {
          type: 'BULL_CALL_SPREAD',
          direction: 'BULLISH',
          volatilityBias: 'NEUTRAL_VOL',
          riskProfile: 'MODERATE',
          maxRisk: 500,
          maxProfit: 1000,
          breakevens: [102.5],
          reasoning: 'Test spread'
        },
        500,  // max risk
        1000  // max profit
      )

      expect(analysis.riskRewardRatio).toBe(2)
      expect(analysis.riskLevel).toBe('MEDIUM')
      expect(analysis.recommendation).toContain('Excellent')
    })

    it('should analyze long option strategies correctly', () => {
      const analysis = StrategyUtils.analyzeRiskReward(
        {
          type: 'LONG_CALL',
          direction: 'BULLISH',
          volatilityBias: 'LONG_VOL',
          riskProfile: 'MODERATE',
          maxRisk: 1000,
          maxProfit: null, // Unlimited
          breakevens: [105],
          reasoning: 'Test long call'
        },
        1000,
        null
      )

      expect(analysis.riskRewardRatio).toBeNull()
      expect(analysis.riskLevel).toBe('HIGH')
    })
  })
})