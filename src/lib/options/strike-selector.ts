/**
 * Intelligent Strike Selection Engine with Delta Targeting
 * 
 * Implements sophisticated strike selection logic using delta targeting methodology
 * with market condition adjustments for optimal options trading.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { apiLogger as logger } from '../logger'
import type { 
  OptionsChain,
  OptionContract,
  StrikeSelection,
  SpreadSelection,
  MarketCondition,
  OscillatorCondition
} from '../../types/options'

export interface StrikeSelectionEngine {
  selectStrike(
    optionsChain: OptionsChain,
    targetDelta: number,
    optionType: 'call' | 'put',
    expiration: string,
    marketCondition: MarketCondition
  ): Promise<StrikeSelection>
  
  selectSpreadStrikes(
    optionsChain: OptionsChain,
    longDelta: number,
    shortDelta: number,
    optionType: 'call' | 'put',
    expiration: string,
    marketCondition: MarketCondition
  ): Promise<SpreadSelection>
  
  adjustStrikeForConditions(
    baseStrike: number,
    underlyingPrice: number,
    oscillatorSignal: OscillatorCondition,
    ivRank: number
  ): number
}

export class TradierStrikeSelector implements StrikeSelectionEngine {
  
  /**
   * Select optimal strike using delta targeting methodology
   * Targets 0.65 delta for long options with market condition adjustments
   */
  async selectStrike(
    optionsChain: OptionsChain,
    targetDelta: number,
    optionType: 'call' | 'put',
    expiration: string,
    marketCondition: MarketCondition
  ): Promise<StrikeSelection> {
    try {
      logger.info(`[StrikeSelector] Selecting ${optionType} strike for ${optionsChain.symbol}, target delta: ${targetDelta}`)
      
      // Filter options by type and expiration
      const availableOptions = this.filterOptionsByTypeAndExpiration(
        optionsChain,
        optionType,
        expiration
      )
      
      if (availableOptions.length === 0) {
        throw new Error(`No ${optionType} options available for expiration ${expiration}`)
      }
      
      // Find strike closest to target delta
      let bestOption = this.findClosestDeltaStrike(availableOptions, targetDelta)
      
      // Apply market condition adjustments
      const adjustedStrike = this.adjustStrikeForConditions(
        bestOption.strike,
        optionsChain.underlyingPrice,
        this.extractOscillatorCondition(marketCondition),
        marketCondition.ivRank
      )
      
      // If adjustment changed the strike, find the new best option
      if (adjustedStrike !== bestOption.strike) {
        const adjustedOption = this.findClosestStrike(availableOptions, adjustedStrike)
        if (adjustedOption) {
          bestOption = adjustedOption
        }
      }
      
      // Calculate selection metrics
      const deltaDeviation = Math.abs(bestOption.greeks.delta - targetDelta)
      const premium = (bestOption.bid + bestOption.ask) / 2
      
      // Generate reasoning
      const reasoning = this.generateSelectionReasoning(
        bestOption,
        targetDelta,
        deltaDeviation,
        marketCondition,
        adjustedStrike !== bestOption.strike
      )
      
      const selection: StrikeSelection = {
        strike: bestOption.strike,
        optionSymbol: bestOption.symbol,
        actualDelta: bestOption.greeks.delta,
        targetDelta,
        deltaDeviation,
        premium,
        bid: bestOption.bid,
        ask: bestOption.ask,
        greeks: {
          delta: bestOption.greeks.delta,
          gamma: bestOption.greeks.gamma,
          theta: bestOption.greeks.theta,
          vega: bestOption.greeks.vega,
          rho: bestOption.greeks.rho,
          impliedVolatility: bestOption.greeks.impliedVolatility
        },
        reasoning
      }
      
      logger.info(`[StrikeSelector] Selected strike ${bestOption.strike} with delta ${bestOption.greeks.delta} (target: ${targetDelta}, deviation: ${deltaDeviation.toFixed(4)})`)
      
      return selection
      
    } catch (error) {
      logger.error(`[StrikeSelector] Error selecting strike:`, error as Error)
      throw error
    }
  }
  
  /**
   * Select both legs for spread strategies
   * Uses 0.65 delta for long leg and 0.30 delta for short leg
   */
  async selectSpreadStrikes(
    optionsChain: OptionsChain,
    longDelta: number,
    shortDelta: number,
    optionType: 'call' | 'put',
    expiration: string,
    marketCondition: MarketCondition
  ): Promise<SpreadSelection> {
    try {
      logger.info(`[StrikeSelector] Selecting spread strikes for ${optionsChain.symbol}, long delta: ${longDelta}, short delta: ${shortDelta}`)
      
      // Select long leg (higher delta, closer to ITM)
      const longLeg = await this.selectStrike(
        optionsChain,
        longDelta,
        optionType,
        expiration,
        marketCondition
      )
      
      // Select short leg (lower delta, further OTM)
      const shortLeg = await this.selectStrike(
        optionsChain,
        shortDelta,
        optionType,
        expiration,
        marketCondition
      )
      
      // Validate spread structure
      this.validateSpreadStructure(longLeg, shortLeg, optionType)
      
      // Calculate spread metrics
      const netPremium = longLeg.premium - shortLeg.premium
      const spreadWidth = Math.abs(longLeg.strike - shortLeg.strike)
      const maxRisk = optionType === 'call' 
        ? Math.max(0, netPremium) // Debit spread: premium paid
        : Math.max(0, spreadWidth - netPremium) // Credit spread: width minus credit
      const maxProfit = optionType === 'call'
        ? Math.max(0, spreadWidth - netPremium) // Debit spread: width minus debit
        : Math.max(0, netPremium) // Credit spread: premium received
      
      // Calculate breakeven
      const breakeven = optionType === 'call'
        ? longLeg.strike + netPremium // Call spread breakeven
        : longLeg.strike - netPremium // Put spread breakeven
      
      const spreadSelection: SpreadSelection = {
        longLeg,
        shortLeg,
        netPremium,
        maxRisk,
        maxProfit,
        breakeven,
        spreadWidth
      }
      
      logger.info(`[StrikeSelector] Selected spread: ${longLeg.strike}/${shortLeg.strike}, net premium: ${netPremium.toFixed(2)}, max risk: ${maxRisk.toFixed(2)}`)
      
      return spreadSelection
      
    } catch (error) {
      logger.error(`[StrikeSelector] Error selecting spread strikes:`, error as Error)
      throw error
    }
  }
  
  /**
   * Adjust strike selection based on market conditions
   * Extreme reversals -> more aggressive (closer to ATM)
   * Compression -> more conservative (further OTM)
   */
  adjustStrikeForConditions(
    baseStrike: number,
    underlyingPrice: number,
    oscillatorSignal: OscillatorCondition,
    ivRank: number
  ): number {
    let adjustedStrike = baseStrike
    
    // Extreme reversal adjustment - more aggressive strikes
    if (oscillatorSignal.isExtremeReversal) {
      const distanceFromATM = Math.abs(baseStrike - underlyingPrice)
      const aggressiveAdjustment = distanceFromATM * 0.3 // Move 30% closer to ATM
      
      if (baseStrike > underlyingPrice) {
        // OTM call or ITM put - move closer to ATM
        adjustedStrike = baseStrike - aggressiveAdjustment
      } else {
        // ITM call or OTM put - move closer to ATM
        adjustedStrike = baseStrike + aggressiveAdjustment
      }
      
      logger.info(`[StrikeSelector] Extreme reversal detected, adjusting strike from ${baseStrike} to ${adjustedStrike} (more aggressive)`)
    }
    
    // Compression adjustment - more conservative strikes
    else if (oscillatorSignal.isCompression) {
      const distanceFromATM = Math.abs(baseStrike - underlyingPrice)
      const conservativeAdjustment = distanceFromATM * 0.2 // Move 20% further from ATM
      
      if (baseStrike > underlyingPrice) {
        // OTM call or ITM put - move further from ATM
        adjustedStrike = baseStrike + conservativeAdjustment
      } else {
        // ITM call or OTM put - move further from ATM
        adjustedStrike = baseStrike - conservativeAdjustment
      }
      
      logger.info(`[StrikeSelector] Compression detected, adjusting strike from ${baseStrike} to ${adjustedStrike} (more conservative)`)
    }
    
    // High IV adjustment - slightly more conservative
    if (ivRank > 70) {
      const ivAdjustment = Math.abs(adjustedStrike - underlyingPrice) * 0.1
      
      if (adjustedStrike > underlyingPrice) {
        adjustedStrike = adjustedStrike + ivAdjustment
      } else {
        adjustedStrike = adjustedStrike - ivAdjustment
      }
      
      logger.info(`[StrikeSelector] High IV rank (${ivRank}), making strike slightly more conservative: ${adjustedStrike}`)
    }
    
    return Math.round(adjustedStrike * 2) / 2 // Round to nearest $0.50
  }
  
  /**
   * Filter options by type and expiration
   */
  private filterOptionsByTypeAndExpiration(
    optionsChain: OptionsChain,
    optionType: 'call' | 'put',
    expiration: string
  ): OptionContract[] {
    const options = optionType === 'call' ? optionsChain.options.calls : optionsChain.options.puts
    
    return options.filter(option => 
      option.expiration === expiration &&
      option.greeks &&
      typeof option.greeks.delta === 'number' &&
      !isNaN(option.greeks.delta) &&
      option.bid > 0 &&
      option.ask > 0
    )
  }
  
  /**
   * Find option with delta closest to target
   */
  private findClosestDeltaStrike(
    options: OptionContract[],
    targetDelta: number
  ): OptionContract {
    if (options.length === 0) {
      throw new Error('No options available for delta targeting')
    }
    
    let bestOption = options[0]
    let smallestDeviation = Math.abs(bestOption.greeks.delta - targetDelta)
    
    for (const option of options) {
      const deviation = Math.abs(option.greeks.delta - targetDelta)
      
      if (deviation < smallestDeviation) {
        smallestDeviation = deviation
        bestOption = option
      }
    }
    
    return bestOption
  }
  
  /**
   * Find option with strike closest to target strike
   */
  private findClosestStrike(
    options: OptionContract[],
    targetStrike: number
  ): OptionContract | null {
    if (options.length === 0) {
      return null
    }
    
    let bestOption = options[0]
    let smallestDifference = Math.abs(bestOption.strike - targetStrike)
    
    for (const option of options) {
      const difference = Math.abs(option.strike - targetStrike)
      
      if (difference < smallestDifference) {
        smallestDifference = difference
        bestOption = option
      }
    }
    
    return bestOption
  }
  
  /**
   * Extract oscillator condition from market condition
   */
  private extractOscillatorCondition(marketCondition: MarketCondition): OscillatorCondition {
    return {
      isExtremeReversal: marketCondition.oscillatorPhase === 'EXTREME_REVERSAL',
      isZoneReversal: marketCondition.oscillatorPhase === 'ZONE_REVERSAL',
      isCompression: marketCondition.oscillatorPhase === 'COMPRESSION',
      oscillatorValue: 0 // This would come from the actual signal data
    }
  }
  
  /**
   * Validate spread structure to ensure proper setup
   */
  private validateSpreadStructure(
    longLeg: StrikeSelection,
    shortLeg: StrikeSelection,
    optionType: 'call' | 'put'
  ): void {
    // For call spreads: long strike should be lower than short strike
    // For put spreads: long strike should be higher than short strike
    if (optionType === 'call' && longLeg.strike >= shortLeg.strike) {
      throw new Error(`Invalid call spread structure: long strike (${longLeg.strike}) must be lower than short strike (${shortLeg.strike})`)
    }
    
    if (optionType === 'put' && longLeg.strike <= shortLeg.strike) {
      throw new Error(`Invalid put spread structure: long strike (${longLeg.strike}) must be higher than short strike (${shortLeg.strike})`)
    }
    
    // Validate delta relationship
    if (Math.abs(longLeg.actualDelta) <= Math.abs(shortLeg.actualDelta)) {
      throw new Error(`Invalid spread delta structure: long leg delta (${longLeg.actualDelta}) should have higher absolute value than short leg delta (${shortLeg.actualDelta})`)
    }
  }
  
  /**
   * Generate human-readable reasoning for strike selection
   */
  private generateSelectionReasoning(
    selectedOption: OptionContract,
    targetDelta: number,
    deltaDeviation: number,
    marketCondition: MarketCondition,
    wasAdjusted: boolean
  ): string {
    const reasons: string[] = []
    
    // Base selection reason
    reasons.push(`Selected strike ${selectedOption.strike} with delta ${selectedOption.greeks.delta.toFixed(3)} (target: ${targetDelta.toFixed(3)})`)
    
    // Delta accuracy
    if (deltaDeviation < 0.05) {
      reasons.push('Excellent delta accuracy (within 0.05)')
    } else if (deltaDeviation < 0.1) {
      reasons.push('Good delta accuracy (within 0.10)')
    } else {
      reasons.push(`Delta deviation: ${deltaDeviation.toFixed(3)} - closest available option`)
    }
    
    // Market condition adjustments
    if (wasAdjusted) {
      if (marketCondition.oscillatorPhase === 'EXTREME_REVERSAL') {
        reasons.push('Strike adjusted more aggressively due to extreme reversal signal')
      } else if (marketCondition.oscillatorPhase === 'COMPRESSION') {
        reasons.push('Strike adjusted more conservatively due to compression conditions')
      }
    }
    
    // IV rank consideration
    if (marketCondition.ivRank > 70) {
      reasons.push(`High IV rank (${marketCondition.ivRank}) - slightly more conservative selection`)
    } else if (marketCondition.ivRank < 30) {
      reasons.push(`Low IV rank (${marketCondition.ivRank}) - favorable for long options`)
    }
    
    // Signal quality
    if (marketCondition.signalQuality === 5) {
      reasons.push('5-star signal quality - high conviction selection')
    } else if (marketCondition.signalQuality >= 4) {
      reasons.push(`${marketCondition.signalQuality}-star signal quality - good conviction`)
    }
    
    // Liquidity assessment
    if (selectedOption.volume > 100 && selectedOption.openInterest > 500) {
      reasons.push('Good liquidity (high volume and open interest)')
    } else if (selectedOption.volume < 10 || selectedOption.openInterest < 50) {
      reasons.push('Lower liquidity - monitor bid/ask spreads closely')
    }
    
    return reasons.join('. ')
  }
}

/**
 * Create singleton instance for use throughout the application
 */
export const strikeSelector = new TradierStrikeSelector()

/**
 * Utility functions for strike selection validation and analysis
 */
export class StrikeSelectionUtils {
  
  /**
   * Validate that a strike selection meets minimum quality standards
   */
  static validateSelection(selection: StrikeSelection, maxDeltaDeviation = 0.15): boolean {
    // Check delta deviation
    if (selection.deltaDeviation > maxDeltaDeviation) {
      logger.warn(`[StrikeSelector] Delta deviation ${selection.deltaDeviation.toFixed(3)} exceeds maximum ${maxDeltaDeviation}`)
      return false
    }
    
    // Check bid/ask spread
    const spread = selection.ask - selection.bid
    const midPrice = (selection.bid + selection.ask) / 2
    const spreadPercent = spread / midPrice
    
    if (spreadPercent > 0.1) { // 10% spread threshold
      logger.warn(`[StrikeSelector] Bid/ask spread too wide: ${spreadPercent.toFixed(3)} (${spread.toFixed(2)})`)
      return false
    }
    
    // Check Greeks validity
    if (Math.abs(selection.greeks.delta) > 1 || 
        selection.greeks.gamma < 0 || 
        selection.greeks.theta > 0 || 
        selection.greeks.vega < 0) {
      logger.warn(`[StrikeSelector] Invalid Greeks values detected`)
      return false
    }
    
    return true
  }
  
  /**
   * Calculate selection quality score (0-100)
   */
  static calculateSelectionScore(selection: StrikeSelection): number {
    let score = 100
    
    // Delta accuracy (40% of score)
    const deltaAccuracy = Math.max(0, 1 - (selection.deltaDeviation / 0.2)) // Penalize deviations > 0.2
    score *= (0.4 + 0.6 * deltaAccuracy)
    
    // Bid/ask spread (30% of score)
    const spread = selection.ask - selection.bid
    const midPrice = (selection.bid + selection.ask) / 2
    const spreadPercent = spread / midPrice
    const spreadScore = Math.max(0, 1 - (spreadPercent / 0.05)) // Penalize spreads > 5%
    score *= (0.7 + 0.3 * spreadScore)
    
    // Greeks quality (30% of score)
    const greeksScore = this.calculateGreeksQuality(selection.greeks)
    score *= (0.7 + 0.3 * greeksScore)
    
    return Math.round(score)
  }
  
  /**
   * Calculate Greeks quality score (0-1)
   */
  private static calculateGreeksQuality(greeks: any): number {
    let quality = 1.0
    
    // Penalize extreme values that might indicate stale or invalid data
    if (Math.abs(greeks.delta) > 0.95) quality *= 0.9
    if (greeks.gamma > 0.5) quality *= 0.9
    if (greeks.theta < -1.0) quality *= 0.9
    if (greeks.vega > 2.0) quality *= 0.9
    if (greeks.impliedVolatility > 3.0 || greeks.impliedVolatility < 0.05) quality *= 0.8
    
    return quality
  }
}