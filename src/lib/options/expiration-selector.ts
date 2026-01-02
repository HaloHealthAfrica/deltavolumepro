import type { MarketCondition } from '../../types/options'

/**
 * Expiration Selection System for Options Trading
 * 
 * Implements intelligent expiration selection based on signal quality and market conditions.
 * Follows the requirements for DTE targeting:
 * - 5-star signals: 14 DTE (aggressive timing)
 * - 4-star signals: 30 DTE (moderate timing)
 * - Compression: 45 DTE (extended for breakout)
 * - Extreme reversal: 7-14 DTE (maximum leverage)
 */

export interface ExpirationSelection {
  expiration: string
  daysToExpiration: number
  targetDTE: number
  dteDeviation: number
  isWeekly: boolean
  reasoning: string
  thetaDecayRate: number
}

export interface OscillatorCondition {
  isExtremeReversal: boolean
  isZoneReversal: boolean
  isCompression: boolean
  oscillatorValue: number
}

export class TradierExpirationSelector {
  /**
   * Select optimal expiration based on signal quality and market conditions
   */
  async selectExpiration(
    availableExpirations: string[],
    signalQuality: number,
    oscillatorCondition: OscillatorCondition,
    ivRank: number
  ): Promise<ExpirationSelection> {
    // Calculate target DTE based on signal quality and conditions
    const targetDTE = this.calculateTargetDTE(signalQuality, oscillatorCondition)
    
    // Find closest available expiration
    const selectedExpiration = this.findClosestExpiration(availableExpirations, targetDTE)
    
    // Calculate actual DTE for selected expiration
    const actualDTE = this.calculateDaysToExpiration(selectedExpiration)
    const dteDeviation = Math.abs(actualDTE - targetDTE)
    
    // Determine if it's a weekly expiration
    const isWeekly = this.isWeeklyExpiration(selectedExpiration, availableExpirations)
    
    // Calculate theta decay rate (approximate)
    const thetaDecayRate = this.estimateThetaDecayRate(actualDTE, ivRank)
    
    // Generate reasoning
    const reasoning = this.generateExpirationReasoning(
      signalQuality,
      oscillatorCondition,
      targetDTE,
      actualDTE,
      dteDeviation,
      isWeekly
    )
    
    return {
      expiration: selectedExpiration,
      daysToExpiration: actualDTE,
      targetDTE,
      dteDeviation,
      isWeekly,
      reasoning,
      thetaDecayRate
    }
  }

  /**
   * Calculate target DTE based on signal quality and oscillator conditions
   */
  calculateTargetDTE(
    signalQuality: number,
    oscillatorCondition: OscillatorCondition
  ): number {
    // Extreme reversal takes priority - use shorter expirations for maximum leverage
    if (oscillatorCondition.isExtremeReversal) {
      return signalQuality >= 5 ? 7 : 14 // 7 DTE for 5-star, 14 DTE for others
    }
    
    // Compression requires extended time for breakout development
    if (oscillatorCondition.isCompression) {
      return 45 // Extended expiration for compression
    }
    
    // Standard signal quality-based targeting
    switch (signalQuality) {
      case 5:
        return 14 // Aggressive timing for high-confidence signals
      case 4:
        return 30 // Moderate timing with buffer
      case 3:
        return 30 // Conservative approach for lower quality
      case 2:
        return 45 // More time needed for lower confidence
      case 1:
        return 45 // Maximum time for lowest quality
      default:
        return 30 // Default moderate timing
    }
  }

  /**
   * Find the expiration closest to target DTE from available options
   */
  findClosestExpiration(availableExpirations: string[], targetDTE: number): string {
    if (availableExpirations.length === 0) {
      throw new Error('No available expirations provided')
    }

    let closestExpiration = availableExpirations[0]
    let smallestDeviation = Math.abs(this.calculateDaysToExpiration(availableExpirations[0]) - targetDTE)

    for (const expiration of availableExpirations) {
      const actualDTE = this.calculateDaysToExpiration(expiration)
      const deviation = Math.abs(actualDTE - targetDTE)
      
      if (deviation < smallestDeviation) {
        smallestDeviation = deviation
        closestExpiration = expiration
      }
    }

    return closestExpiration
  }

  /**
   * Calculate days to expiration from expiration date string
   */
  private calculateDaysToExpiration(expiration: string): number {
    const expirationDate = new Date(expiration)
    const currentDate = new Date()
    
    // Set time to market close (4 PM ET) for accurate DTE calculation
    expirationDate.setHours(16, 0, 0, 0)
    currentDate.setHours(16, 0, 0, 0)
    
    const timeDiff = expirationDate.getTime() - currentDate.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
    
    return Math.max(0, daysDiff) // Ensure non-negative
  }

  /**
   * Determine if expiration is a weekly (vs monthly) expiration
   */
  private isWeeklyExpiration(selectedExpiration: string, allExpirations: string[]): boolean {
    const expirationDate = new Date(selectedExpiration)
    const dayOfMonth = expirationDate.getDate()
    
    // Monthly expirations are typically the 3rd Friday of the month (15th-21st)
    // Weekly expirations are other Fridays
    const isThirdWeek = dayOfMonth >= 15 && dayOfMonth <= 21
    
    // Also check if there are multiple expirations in the same month
    const sameMonth = allExpirations.filter(exp => {
      const expDate = new Date(exp)
      return expDate.getMonth() === expirationDate.getMonth() && 
             expDate.getFullYear() === expirationDate.getFullYear()
    })
    
    return !isThirdWeek || sameMonth.length > 1
  }

  /**
   * Estimate theta decay rate based on DTE and IV rank
   */
  private estimateThetaDecayRate(daysToExpiration: number, ivRank: number): number {
    // Theta decay accelerates as expiration approaches
    // Higher IV generally means higher theta
    
    const baseDecayRate = 1 / daysToExpiration // Base rate inversely related to DTE
    const ivMultiplier = 1 + (ivRank / 100) * 0.5 // IV adds 0-50% to decay rate
    
    // Acceleration factor for options < 30 DTE
    const accelerationFactor = daysToExpiration <= 30 ? 
      Math.pow(30 / daysToExpiration, 0.5) : 1
    
    return baseDecayRate * ivMultiplier * accelerationFactor
  }

  /**
   * Generate human-readable reasoning for expiration selection
   */
  private generateExpirationReasoning(
    signalQuality: number,
    oscillatorCondition: OscillatorCondition,
    targetDTE: number,
    actualDTE: number,
    dteDeviation: number,
    isWeekly: boolean
  ): string {
    const reasons: string[] = []
    
    // Primary selection logic
    if (oscillatorCondition.isExtremeReversal) {
      reasons.push(`Extreme reversal detected - using ${targetDTE} DTE for maximum leverage`)
    } else if (oscillatorCondition.isCompression) {
      reasons.push(`Compression phase - extending to ${targetDTE} DTE for breakout development`)
    } else {
      const qualityDescription = signalQuality >= 5 ? 'high-confidence' : 
                               signalQuality >= 4 ? 'moderate-confidence' : 'lower-confidence'
      reasons.push(`${signalQuality}-star ${qualityDescription} signal targeting ${targetDTE} DTE`)
    }
    
    // Deviation from target
    if (dteDeviation === 0) {
      reasons.push(`Perfect match: selected ${actualDTE} DTE exactly matches target`)
    } else if (dteDeviation <= 3) {
      reasons.push(`Close match: ${actualDTE} DTE within ${dteDeviation} days of target`)
    } else {
      reasons.push(`Best available: ${actualDTE} DTE deviates ${dteDeviation} days from target`)
    }
    
    // Weekly vs monthly
    if (isWeekly) {
      reasons.push('Weekly expiration selected for tighter timing')
    } else {
      reasons.push('Monthly expiration selected for standard timing')
    }
    
    return reasons.join('. ')
  }
}

/**
 * Utility functions for expiration selection validation and analysis
 */
export class ExpirationSelectionUtils {
  /**
   * Validate expiration selection meets quality standards
   */
  static validateSelection(selection: ExpirationSelection): boolean {
    // Check if DTE deviation is reasonable (within 7 days for most cases)
    if (selection.dteDeviation > 7) {
      return false
    }
    
    // Ensure DTE is positive
    if (selection.daysToExpiration <= 0) {
      return false
    }
    
    // Check if theta decay rate is reasonable
    if (selection.thetaDecayRate < 0 || selection.thetaDecayRate > 1) {
      return false
    }
    
    return true
  }

  /**
   * Calculate selection quality score (0-100)
   */
  static calculateSelectionScore(selection: ExpirationSelection): number {
    let score = 100
    
    // Penalize DTE deviation
    score -= Math.min(selection.dteDeviation * 5, 30) // Max 30 point penalty
    
    // Bonus for exact matches
    if (selection.dteDeviation === 0) {
      score += 10
    }
    
    // Penalize very short DTE (< 3 days) unless it's intentional
    if (selection.daysToExpiration < 3 && selection.targetDTE >= 7) {
      score -= 20
    }
    
    // Penalize very long DTE (> 60 days) unless it's compression
    if (selection.daysToExpiration > 60 && selection.targetDTE < 45) {
      score -= 15
    }
    
    return Math.max(0, Math.min(100, score))
  }

  /**
   * Analyze expiration selection effectiveness
   */
  static analyzeSelection(
    selection: ExpirationSelection,
    marketCondition: MarketCondition
  ): {
    effectiveness: 'HIGH' | 'MEDIUM' | 'LOW'
    risks: string[]
    opportunities: string[]
  } {
    const risks: string[] = []
    const opportunities: string[] = []
    
    // Analyze DTE risks
    if (selection.daysToExpiration <= 7) {
      risks.push('High gamma risk and rapid theta decay')
      opportunities.push('Maximum leverage for quick moves')
    } else if (selection.daysToExpiration >= 45) {
      risks.push('Higher premium cost and slower response to moves')
      opportunities.push('More time for thesis to develop')
    }
    
    // Analyze theta decay
    if (selection.thetaDecayRate > 0.1) {
      risks.push('Significant daily time decay')
    } else {
      opportunities.push('Manageable time decay rate')
    }
    
    // Weekly vs monthly considerations
    if (selection.isWeekly) {
      risks.push('Weekly expiration - higher gamma risk')
      opportunities.push('Tighter timing for precise entries')
    }
    
    // Determine overall effectiveness
    const riskCount = risks.length
    const opportunityCount = opportunities.length
    const deviationPenalty = selection.dteDeviation > 5 ? 1 : 0
    
    let effectiveness: 'HIGH' | 'MEDIUM' | 'LOW'
    if (opportunityCount > riskCount && deviationPenalty === 0) {
      effectiveness = 'HIGH'
    } else if (opportunityCount >= riskCount || deviationPenalty === 0) {
      effectiveness = 'MEDIUM'
    } else {
      effectiveness = 'LOW'
    }
    
    return { effectiveness, risks, opportunities }
  }
}