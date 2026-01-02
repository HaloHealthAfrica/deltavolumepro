/**
 * Multi-Strategy Options Execution System
 * 
 * Implements intelligent strategy selection and execution for calls, puts, and spreads
 * based on market conditions, IV rank, and signal characteristics.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import type { 
  OptionsStrategy,
  MarketCondition,
  StrikeSelection,
  SpreadSelection
} from '../../types/options'
import type { OscillatorCondition } from './expiration-selector'

export interface TradingSignal {
  action: 'LONG' | 'SHORT'
  ticker: string
  direction: 'BULLISH' | 'BEARISH'
  quality: number
  oscillator: OscillatorCondition
}

export interface StrategySelection {
  strategy: OptionsStrategy
  reasoning: string
  confidence: number
  riskProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  expectedReturn: number | null
  maxRisk: number
  breakevens: number[]
}

export interface OrderExecutionPlan {
  orderType: 'MARKET' | 'LIMIT' | 'SPREAD'
  legs: OrderLeg[]
  netPrice: number | null
  timeInForce: 'DAY' | 'GTC' | 'IOC'
  reasoning: string
}

export interface OrderLeg {
  optionSymbol: string
  side: 'BUY_TO_OPEN' | 'SELL_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_CLOSE'
  quantity: number
  price: number | null // null for market orders
}

export class OptionsStrategySelector {
  
  /**
   * Select optimal options strategy based on market conditions and signal
   */
  async selectStrategy(
    signal: TradingSignal,
    ivRank: number,
    marketCondition: MarketCondition
  ): Promise<StrategySelection> {
    // Determine strategy type based on IV rank and signal characteristics
    const strategyType = this.determineStrategyType(signal, ivRank, marketCondition)
    
    // Create strategy object
    const strategy: OptionsStrategy = {
      type: strategyType,
      direction: signal.direction,
      volatilityBias: this.getVolatilityBias(ivRank),
      riskProfile: this.getRiskProfile(signal.quality, marketCondition),
      maxRisk: 0, // Will be calculated based on position size
      maxProfit: this.getMaxProfit(strategyType),
      breakevens: [], // Will be calculated based on strikes
      reasoning: ''
    }
    
    // Generate reasoning
    const reasoning = this.generateStrategyReasoning(signal, ivRank, marketCondition, strategy)
    strategy.reasoning = reasoning
    
    // Calculate confidence based on signal quality and market alignment
    const confidence = this.calculateStrategyConfidence(signal, ivRank, marketCondition, strategy)
    
    // Estimate expected return (simplified)
    const expectedReturn = this.estimateExpectedReturn(strategy, signal.quality, ivRank)
    
    return {
      strategy,
      reasoning,
      confidence,
      riskProfile: strategy.riskProfile,
      expectedReturn,
      maxRisk: strategy.maxRisk,
      breakevens: strategy.breakevens
    }
  }

  /**
   * Determine strategy type based on IV rank and signal characteristics
   */
  private determineStrategyType(
    signal: TradingSignal,
    ivRank: number,
    marketCondition: MarketCondition
  ): OptionsStrategy['type'] {
    // Low IV + Reversal = Long options for volatility expansion
    if (ivRank < 30 && (signal.oscillator.isExtremeReversal || signal.oscillator.isZoneReversal)) {
      return signal.direction === 'BULLISH' ? 'LONG_CALL' : 'LONG_PUT'
    }
    
    // High IV = Credit spreads to collect premium
    if (ivRank > 70) {
      if (signal.direction === 'BULLISH') {
        return 'BULL_PUT_SPREAD' // Sell put spread in high IV
      } else {
        return 'BEAR_CALL_SPREAD' // Sell call spread in high IV
      }
    }
    
    // Medium IV - choose based on signal strength and direction
    if (signal.quality >= 4) {
      // High quality signals - use directional spreads
      if (signal.direction === 'BULLISH') {
        return ivRank > 50 ? 'BULL_PUT_SPREAD' : 'BULL_CALL_SPREAD'
      } else {
        return ivRank > 50 ? 'BEAR_CALL_SPREAD' : 'BEAR_PUT_SPREAD'
      }
    } else {
      // Lower quality signals - use long options for simplicity
      return signal.direction === 'BULLISH' ? 'LONG_CALL' : 'LONG_PUT'
    }
  }

  /**
   * Determine volatility bias based on IV rank
   */
  private getVolatilityBias(ivRank: number): OptionsStrategy['volatilityBias'] {
    if (ivRank < 30) return 'LONG_VOL'
    if (ivRank > 70) return 'SHORT_VOL'
    return 'NEUTRAL_VOL'
  }

  /**
   * Determine risk profile based on signal quality and market conditions
   */
  private getRiskProfile(
    signalQuality: number,
    marketCondition: MarketCondition
  ): OptionsStrategy['riskProfile'] {
    if (signalQuality >= 5 && marketCondition.signalQuality >= 4) {
      return 'AGGRESSIVE'
    } else if (signalQuality >= 4) {
      return 'MODERATE'
    } else {
      return 'CONSERVATIVE'
    }
  }

  /**
   * Get maximum profit for strategy type
   */
  private getMaxProfit(strategyType: OptionsStrategy['type']): number | null {
    // Long options have unlimited profit potential
    if (strategyType === 'LONG_CALL' || strategyType === 'LONG_PUT') {
      return null
    }
    
    // Spreads have limited profit (will be calculated based on strikes)
    return 0 // Placeholder - will be calculated with actual strikes
  }

  /**
   * Generate human-readable reasoning for strategy selection
   */
  private generateStrategyReasoning(
    signal: TradingSignal,
    ivRank: number,
    marketCondition: MarketCondition,
    strategy: OptionsStrategy
  ): string {
    const reasons: string[] = []
    
    // IV rank reasoning
    if (ivRank < 30) {
      reasons.push(`Low IV rank (${ivRank}) favors long volatility strategies`)
    } else if (ivRank > 70) {
      reasons.push(`High IV rank (${ivRank}) favors short volatility strategies`)
    } else {
      reasons.push(`Medium IV rank (${ivRank}) allows flexible strategy selection`)
    }
    
    // Signal direction reasoning
    reasons.push(`${signal.direction.toLowerCase()} signal supports ${strategy.type.toLowerCase().replace(/_/g, ' ')}`)
    
    // Oscillator reasoning
    if (signal.oscillator.isExtremeReversal) {
      reasons.push('Extreme reversal condition increases volatility expansion probability')
    } else if (signal.oscillator.isCompression) {
      reasons.push('Compression phase suggests range-bound movement')
    }
    
    // Quality reasoning
    if (signal.quality >= 5) {
      reasons.push('High signal quality (5-star) supports aggressive positioning')
    } else if (signal.quality >= 4) {
      reasons.push('Good signal quality (4-star) supports moderate positioning')
    } else {
      reasons.push('Lower signal quality suggests conservative approach')
    }
    
    return reasons.join('. ')
  }

  /**
   * Calculate confidence in strategy selection
   */
  private calculateStrategyConfidence(
    signal: TradingSignal,
    ivRank: number,
    marketCondition: MarketCondition,
    strategy: OptionsStrategy
  ): number {
    let confidence = 0.5 // Base 50%
    
    // Signal quality boost
    confidence += (signal.quality - 3) * 0.1 // +/- 20% based on quality
    
    // IV rank alignment
    if (strategy.volatilityBias === 'LONG_VOL' && ivRank < 30) {
      confidence += 0.15 // Good alignment
    } else if (strategy.volatilityBias === 'SHORT_VOL' && ivRank > 70) {
      confidence += 0.15 // Good alignment
    }
    
    // Oscillator alignment
    if (signal.oscillator.isExtremeReversal && strategy.volatilityBias === 'LONG_VOL') {
      confidence += 0.1 // Reversal + long vol is good
    }
    
    // Market condition alignment
    if (marketCondition.signalQuality >= 4) {
      confidence += 0.05
    }
    
    return Math.max(0.1, Math.min(0.95, confidence))
  }

  /**
   * Estimate expected return based on strategy and conditions
   */
  private estimateExpectedReturn(
    strategy: OptionsStrategy,
    signalQuality: number,
    ivRank: number
  ): number | null {
    // This is a simplified estimation - in practice would use more sophisticated models
    const baseReturn = signalQuality * 0.1 // 10% per quality star
    
    // Adjust for strategy type
    let strategyMultiplier = 1.0
    if (strategy.type.includes('SPREAD')) {
      strategyMultiplier = 0.6 // Spreads have limited upside
    }
    
    // Adjust for volatility environment
    let volMultiplier = 1.0
    if (strategy.volatilityBias === 'LONG_VOL' && ivRank < 30) {
      volMultiplier = 1.3 // Good vol expansion potential
    } else if (strategy.volatilityBias === 'SHORT_VOL' && ivRank > 70) {
      volMultiplier = 1.2 // Good vol contraction potential
    }
    
    return baseReturn * strategyMultiplier * volMultiplier
  }

  /**
   * Validate strategy selection meets criteria
   */
  validateStrategy(
    strategy: OptionsStrategy,
    marketConditions: MarketCondition
  ): boolean {
    // Check if strategy aligns with market conditions
    if (strategy.volatilityBias === 'LONG_VOL' && marketConditions.ivRank > 80) {
      return false // Don't buy vol when it's extremely high
    }
    
    if (strategy.volatilityBias === 'SHORT_VOL' && marketConditions.ivRank < 20) {
      return false // Don't sell vol when it's extremely low
    }
    
    // Check risk profile alignment
    if (strategy.riskProfile === 'AGGRESSIVE' && marketConditions.signalQuality < 4) {
      return false // Don't be aggressive with low quality signals
    }
    
    return true
  }
}

/**
 * Order Execution Engine for Options Strategies
 */
export class OptionsOrderExecutor {
  
  /**
   * Create execution plan for selected strategy
   */
  async createExecutionPlan(
    strategy: OptionsStrategy,
    strikes: StrikeSelection | SpreadSelection,
    contracts: number
  ): Promise<OrderExecutionPlan> {
    const isSpread = 'longLeg' in strikes
    
    if (isSpread) {
      return this.createSpreadExecutionPlan(strategy, strikes as SpreadSelection, contracts)
    } else {
      return this.createSingleLegExecutionPlan(strategy, strikes as StrikeSelection, contracts)
    }
  }

  /**
   * Create execution plan for single-leg strategies
   */
  private async createSingleLegExecutionPlan(
    strategy: OptionsStrategy,
    strike: StrikeSelection,
    contracts: number
  ): Promise<OrderExecutionPlan> {
    const spreadPercent = (strike.ask - strike.bid) / ((strike.ask + strike.bid) / 2)
    const orderType = spreadPercent > 0.05 ? 'LIMIT' : 'MARKET'
    
    const leg: OrderLeg = {
      optionSymbol: strike.optionSymbol,
      side: 'BUY_TO_OPEN',
      quantity: contracts,
      price: orderType === 'LIMIT' ? (strike.bid + strike.ask) / 2 : null
    }
    
    const reasoning = `Single leg ${strategy.type} order. ${
      orderType === 'LIMIT' 
        ? `Using limit order due to wide spread (${(spreadPercent * 100).toFixed(1)}%)`
        : 'Using market order for tight spread'
    }`
    
    return {
      orderType,
      legs: [leg],
      netPrice: leg.price,
      timeInForce: orderType === 'LIMIT' ? 'GTC' : 'DAY',
      reasoning
    }
  }

  /**
   * Create execution plan for spread strategies
   */
  private async createSpreadExecutionPlan(
    strategy: OptionsStrategy,
    spread: SpreadSelection,
    contracts: number
  ): Promise<OrderExecutionPlan> {
    const longLeg: OrderLeg = {
      optionSymbol: spread.longLeg.optionSymbol,
      side: 'BUY_TO_OPEN',
      quantity: contracts,
      price: null // Will use spread order
    }
    
    const shortLeg: OrderLeg = {
      optionSymbol: spread.shortLeg.optionSymbol,
      side: 'SELL_TO_OPEN',
      quantity: contracts,
      price: null // Will use spread order
    }
    
    const reasoning = `Spread order for ${strategy.type}. Net debit: $${spread.netPremium.toFixed(2)} per contract`
    
    return {
      orderType: 'SPREAD',
      legs: [longLeg, shortLeg],
      netPrice: spread.netPremium,
      timeInForce: 'GTC',
      reasoning
    }
  }

  /**
   * Determine optimal order type based on bid/ask spreads
   */
  determineOrderType(
    bid: number,
    ask: number,
    strategy: OptionsStrategy
  ): 'MARKET' | 'LIMIT' {
    const spreadPercent = (ask - bid) / ((ask + bid) / 2)
    
    // Use market orders for tight spreads (< 5%)
    if (spreadPercent < 0.05) {
      return 'MARKET'
    }
    
    // Use limit orders for wide spreads or aggressive strategies
    return 'LIMIT'
  }
}

/**
 * Utility functions for strategy validation and analysis
 */
export class StrategyUtils {
  
  /**
   * Validate strategy selection meets quality standards
   */
  static validateStrategySelection(selection: StrategySelection): boolean {
    // Check confidence threshold
    if (selection.confidence < 0.3) {
      return false
    }
    
    // Check risk profile alignment
    if (selection.riskProfile === 'AGGRESSIVE' && selection.confidence < 0.7) {
      return false
    }
    
    return true
  }

  /**
   * Calculate strategy effectiveness score
   */
  static calculateEffectivenessScore(
    selection: StrategySelection,
    ivRank: number,
    signalQuality: number
  ): number {
    let score = selection.confidence * 100
    
    // Bonus for good IV alignment
    if (selection.strategy.volatilityBias === 'LONG_VOL' && ivRank < 30) {
      score += 10
    } else if (selection.strategy.volatilityBias === 'SHORT_VOL' && ivRank > 70) {
      score += 10
    }
    
    // Bonus for high signal quality
    if (signalQuality >= 5) {
      score += 5
    }
    
    return Math.min(100, score)
  }

  /**
   * Analyze strategy risk/reward profile
   */
  static analyzeRiskReward(
    strategy: OptionsStrategy,
    maxRisk: number,
    maxProfit: number | null
  ): {
    riskRewardRatio: number | null
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
    recommendation: string
  } {
    let riskRewardRatio: number | null = null
    if (maxProfit !== null && maxRisk > 0) {
      riskRewardRatio = maxProfit / maxRisk
    }
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
    if (strategy.type.includes('SPREAD')) {
      riskLevel = 'MEDIUM' // Spreads have defined risk
    } else if (strategy.type.includes('LONG')) {
      riskLevel = 'HIGH' // Long options can lose 100%
    } else {
      riskLevel = 'LOW'
    }
    
    let recommendation: string
    if (riskRewardRatio && riskRewardRatio > 2) {
      recommendation = 'Excellent risk/reward - consider increasing position size'
    } else if (riskRewardRatio && riskRewardRatio > 1) {
      recommendation = 'Good risk/reward - proceed with standard sizing'
    } else {
      recommendation = 'Limited upside - consider reducing position or alternative strategy'
    }
    
    return { riskRewardRatio, riskLevel, recommendation }
  }
}

// Export singleton instances
export const strategySelector = new OptionsStrategySelector()
export const orderExecutor = new OptionsOrderExecutor()