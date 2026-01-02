/**
 * Position Sizing with Risk-Based Contract Calculation
 * 
 * Implements intelligent position sizing based on account risk, signal quality,
 * and market conditions with appropriate multipliers and limits.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type { OscillatorCondition } from './expiration-selector'

export interface PositionSize {
  contracts: number
  totalPremium: number
  riskAmount: number
  riskPercent: number
  qualityMultiplier: number
  oscillatorMultiplier: number
  compressionMultiplier: number
  reasoning: string
  shouldSkipTrade: boolean
}

export interface RiskMetrics {
  maxLoss: number
  maxLossPercent: number
  breakeven: number
  riskRewardRatio: number
  probabilityOfProfit: number
}

export interface PositionSizeConfig {
  baseRiskPercent: number      // Default: 2%
  maxPositionPercent: number   // Default: 5%
  qualityMultipliers: Record<number, number>
  reversalBoost: number        // Default: 1.5x
  compressionPenalty: number   // Default: 0.5x
  skipOnCompression: boolean   // Default: false
}

const DEFAULT_CONFIG: PositionSizeConfig = {
  baseRiskPercent: 0.02,       // 2% base risk
  maxPositionPercent: 0.05,    // 5% max position
  qualityMultipliers: {
    1: 0.5,   // 50% of base for 1-star
    2: 0.75,  // 75% of base for 2-star
    3: 1.0,   // 100% of base for 3-star
    4: 1.0,   // 100% of base for 4-star
    5: 1.5    // 150% of base for 5-star
  },
  reversalBoost: 1.5,          // 1.5x for extreme reversals
  compressionPenalty: 0.5,     // 0.5x for compression
  skipOnCompression: false     // Don't skip by default
}

export class PositionSizeCalculator {
  private config: PositionSizeConfig

  constructor(config: Partial<PositionSizeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Calculate number of contracts based on account risk and signal parameters
   */
  async calculateContracts(
    accountSize: number,
    optionPremium: number,
    signalQuality: number,
    oscillatorCondition: OscillatorCondition,
    maxLossPerContract?: number
  ): Promise<PositionSize> {
    // Validate inputs
    if (accountSize <= 0) {
      throw new Error('Account size must be positive')
    }
    if (optionPremium <= 0) {
      throw new Error('Option premium must be positive')
    }
    if (signalQuality < 1 || signalQuality > 5) {
      throw new Error('Signal quality must be between 1 and 5')
    }

    // Check if we should skip trade due to compression
    if (oscillatorCondition.isCompression && this.config.skipOnCompression) {
      return {
        contracts: 0,
        totalPremium: 0,
        riskAmount: 0,
        riskPercent: 0,
        qualityMultiplier: 0,
        oscillatorMultiplier: 0,
        compressionMultiplier: 0,
        reasoning: 'Trade skipped due to compression conditions',
        shouldSkipTrade: true
      }
    }

    // Calculate base risk amount (2% of account)
    const baseRiskAmount = accountSize * this.config.baseRiskPercent

    // Apply quality multiplier
    const qualityMultiplier = this.config.qualityMultipliers[signalQuality] || 1.0

    // Apply oscillator multiplier (reversal boost)
    let oscillatorMultiplier = 1.0
    if (oscillatorCondition.isExtremeReversal) {
      oscillatorMultiplier = this.config.reversalBoost
    } else if (oscillatorCondition.isZoneReversal) {
      oscillatorMultiplier = 1.25 // Moderate boost for zone reversals
    }

    // Apply compression penalty
    let compressionMultiplier = 1.0
    if (oscillatorCondition.isCompression) {
      compressionMultiplier = this.config.compressionPenalty
    }

    // Calculate adjusted risk amount
    const adjustedRiskAmount = baseRiskAmount * qualityMultiplier * oscillatorMultiplier * compressionMultiplier

    // Calculate max position value (5% cap)
    const maxPositionValue = accountSize * this.config.maxPositionPercent

    // Use max loss per contract if provided, otherwise use premium as max loss
    const riskPerContract = maxLossPerContract || (optionPremium * 100) // Options are 100 shares

    // Calculate contracts based on risk
    let contracts = Math.floor(adjustedRiskAmount / riskPerContract)

    // Ensure at least 1 contract if we're not skipping
    contracts = Math.max(1, contracts)

    // Apply position size cap
    const totalPremium = contracts * optionPremium * 100
    if (totalPremium > maxPositionValue) {
      contracts = Math.floor(maxPositionValue / (optionPremium * 100))
      contracts = Math.max(1, contracts)
    }

    // Calculate final values
    const finalTotalPremium = contracts * optionPremium * 100
    const finalRiskAmount = contracts * riskPerContract
    const finalRiskPercent = finalRiskAmount / accountSize

    // Generate reasoning
    const reasoning = this.generateReasoning(
      signalQuality,
      oscillatorCondition,
      qualityMultiplier,
      oscillatorMultiplier,
      compressionMultiplier,
      contracts,
      finalRiskPercent,
      totalPremium > maxPositionValue
    )

    return {
      contracts,
      totalPremium: finalTotalPremium,
      riskAmount: finalRiskAmount,
      riskPercent: finalRiskPercent,
      qualityMultiplier,
      oscillatorMultiplier,
      compressionMultiplier,
      reasoning,
      shouldSkipTrade: false
    }
  }

  /**
   * Apply risk limits to calculated contracts
   */
  applyRiskLimits(
    calculatedContracts: number,
    optionPremium: number,
    accountSize: number
  ): number {
    const maxPositionValue = accountSize * this.config.maxPositionPercent
    const totalValue = calculatedContracts * optionPremium * 100

    if (totalValue > maxPositionValue) {
      return Math.max(1, Math.floor(maxPositionValue / (optionPremium * 100)))
    }

    return calculatedContracts
  }

  /**
   * Calculate comprehensive risk metrics for a position
   */
  calculateRiskMetrics(
    contracts: number,
    premium: number,
    maxLoss: number,
    maxProfit: number | null,
    breakeven: number,
    probabilityOfProfit?: number
  ): RiskMetrics {
    const totalPremium = contracts * premium * 100
    const totalMaxLoss = contracts * maxLoss

    // Calculate risk/reward ratio
    let riskRewardRatio = 0
    if (maxProfit !== null && totalMaxLoss > 0) {
      const totalMaxProfit = contracts * maxProfit
      riskRewardRatio = totalMaxProfit / totalMaxLoss
    }

    return {
      maxLoss: totalMaxLoss,
      maxLossPercent: totalMaxLoss / totalPremium,
      breakeven,
      riskRewardRatio,
      probabilityOfProfit: probabilityOfProfit || 0.5 // Default 50% if not provided
    }
  }

  /**
   * Generate human-readable reasoning for position size
   */
  private generateReasoning(
    signalQuality: number,
    oscillatorCondition: OscillatorCondition,
    qualityMultiplier: number,
    oscillatorMultiplier: number,
    compressionMultiplier: number,
    contracts: number,
    riskPercent: number,
    wasCapped: boolean
  ): string {
    const reasons: string[] = []

    // Base calculation
    reasons.push(`Base 2% risk with ${signalQuality}-star signal (${qualityMultiplier}x quality multiplier)`)

    // Oscillator adjustments
    if (oscillatorCondition.isExtremeReversal) {
      reasons.push(`Extreme reversal boost applied (${oscillatorMultiplier}x)`)
    } else if (oscillatorCondition.isZoneReversal) {
      reasons.push(`Zone reversal boost applied (${oscillatorMultiplier}x)`)
    }

    // Compression penalty
    if (oscillatorCondition.isCompression) {
      reasons.push(`Compression penalty applied (${compressionMultiplier}x reduction)`)
    }

    // Position cap
    if (wasCapped) {
      reasons.push('Position capped at 5% maximum account exposure')
    }

    // Final result
    reasons.push(`Final: ${contracts} contract(s) at ${(riskPercent * 100).toFixed(2)}% account risk`)

    return reasons.join('. ')
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PositionSizeConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Get current configuration
   */
  getConfig(): PositionSizeConfig {
    return { ...this.config }
  }
}

/**
 * Utility functions for position sizing validation and analysis
 */
export class PositionSizingUtils {
  /**
   * Validate position size meets risk management rules
   */
  static validatePositionSize(
    positionSize: PositionSize,
    accountSize: number,
    maxRiskPercent: number = 0.05
  ): { isValid: boolean; violations: string[] } {
    const violations: string[] = []

    // Check risk percent doesn't exceed max
    if (positionSize.riskPercent > maxRiskPercent) {
      violations.push(`Risk percent ${(positionSize.riskPercent * 100).toFixed(2)}% exceeds max ${(maxRiskPercent * 100).toFixed(2)}%`)
    }

    // Check contracts is positive
    if (positionSize.contracts <= 0 && !positionSize.shouldSkipTrade) {
      violations.push('Contract count must be positive')
    }

    // Check total premium doesn't exceed account
    if (positionSize.totalPremium > accountSize) {
      violations.push('Total premium exceeds account size')
    }

    return {
      isValid: violations.length === 0,
      violations
    }
  }

  /**
   * Calculate optimal position size for a given risk tolerance
   */
  static calculateOptimalSize(
    accountSize: number,
    targetRiskPercent: number,
    optionPremium: number,
    maxLossPerContract: number
  ): number {
    const targetRiskAmount = accountSize * targetRiskPercent
    const contracts = Math.floor(targetRiskAmount / maxLossPerContract)
    return Math.max(1, contracts)
  }

  /**
   * Analyze position size effectiveness
   */
  static analyzePositionSize(
    positionSize: PositionSize,
    accountSize: number
  ): {
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'AGGRESSIVE'
    recommendation: string
  } {
    const riskPercent = positionSize.riskPercent

    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'AGGRESSIVE'
    let recommendation: string

    if (riskPercent <= 0.01) {
      riskLevel = 'LOW'
      recommendation = 'Conservative position - consider increasing if high conviction'
    } else if (riskPercent <= 0.02) {
      riskLevel = 'MODERATE'
      recommendation = 'Standard risk level - appropriate for most trades'
    } else if (riskPercent <= 0.04) {
      riskLevel = 'HIGH'
      recommendation = 'Elevated risk - ensure high conviction and proper stop loss'
    } else {
      riskLevel = 'AGGRESSIVE'
      recommendation = 'Aggressive position - monitor closely and consider reducing'
    }

    return { riskLevel, recommendation }
  }
}

// Export singleton instance
export const positionSizer = new PositionSizeCalculator()