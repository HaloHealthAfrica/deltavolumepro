/**
 * Comprehensive Exit Management with 8 Exit Conditions
 * 
 * Implements automated exit management with multiple exit conditions including
 * stop loss, profit targets, time-based exits, and volatility-based exits.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import { apiLogger as logger } from '../logger'
import type { 
  OptionsPosition,
  ExitCondition,
  ExitDecision,
  MarketCondition
} from '../../types/options'
import type { PositionSnapshot } from './position-monitor'

export interface ExitRules {
  stopLossPercent: number          // Default: 90% (exit at 90% loss)
  profitTarget1Percent: number     // Default: 50%
  profitTarget2Percent: number     // Default: 100%
  profitTarget3Percent: number     // Default: 200%
  dteExitThreshold: number         // Default: 3 days
  thetaDecayThreshold: number      // Default: 10% per day
  ivCrushThreshold: number         // Default: 30% drop
  eodExitMinutes: number           // Default: 30 minutes before close
  partialExitT1Percent: number    // Default: 50% at T1
  partialExitT2Percent: number    // Default: 60% of remaining at T2
}

export interface ExitExecutionPlan {
  shouldExit: boolean
  exitType: ExitType
  percentToClose: number
  contractsToClose: number
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE'
  reasoning: string
  triggeredConditions: ExitCondition[]
  estimatedFillPrice: number
  orderType: 'MARKET' | 'LIMIT'
}

export type ExitType = 
  | 'STOP_LOSS' 
  | 'PROFIT_TARGET_1' 
  | 'PROFIT_TARGET_2' 
  | 'PROFIT_TARGET_3'
  | 'DTE_EXIT' 
  | 'THETA_DECAY' 
  | 'IV_CRUSH' 
  | 'EOD_EXIT' 
  | 'OSCILLATOR_REVERSAL'

const DEFAULT_EXIT_RULES: ExitRules = {
  stopLossPercent: 0.90,        // 90% loss
  profitTarget1Percent: 0.50,   // 50% profit
  profitTarget2Percent: 1.00,   // 100% profit
  profitTarget3Percent: 2.00,   // 200% profit
  dteExitThreshold: 3,          // 3 days
  thetaDecayThreshold: 0.10,    // 10% per day
  ivCrushThreshold: 0.30,       // 30% drop
  eodExitMinutes: 30,           // 30 minutes
  partialExitT1Percent: 0.50,  // 50% at T1
  partialExitT2Percent: 0.60   // 60% of remaining at T2
}

export class OptionsExitManager {
  private exitRules: ExitRules
  private marketHours = {
    open: { hour: 9, minute: 30 },   // 9:30 AM ET
    close: { hour: 16, minute: 0 }   // 4:00 PM ET
  }

  constructor(exitRules: Partial<ExitRules> = {}) {
    this.exitRules = { ...DEFAULT_EXIT_RULES, ...exitRules }
  }

  /**
   * Evaluate all exit conditions for a position
   */
  async evaluateExitConditions(
    position: OptionsPosition,
    currentSnapshot: PositionSnapshot,
    marketCondition: MarketCondition
  ): Promise<ExitDecision> {
    const triggeredConditions: ExitCondition[] = []
    
    // Check all exit conditions
    const stopLossCondition = this.checkStopLoss(position, currentSnapshot)
    if (stopLossCondition.triggered) triggeredConditions.push(stopLossCondition)
    
    const profitTargetResults = this.checkProfitTargets(position, currentSnapshot)
    triggeredConditions.push(...profitTargetResults.triggeredConditions)
    
    const timeBasedResults = this.checkTimeBasedExits(position, currentSnapshot)
    triggeredConditions.push(...timeBasedResults.triggeredConditions)
    
    const volatilityCondition = this.checkVolatilityExits(position, currentSnapshot)
    if (volatilityCondition.triggered) triggeredConditions.push(volatilityCondition)
    
    const oscillatorCondition = this.checkOscillatorReversal(position, marketCondition)
    if (oscillatorCondition.triggered) triggeredConditions.push(oscillatorCondition)
    
    // Determine highest priority exit
    const exitDecision = this.determineExitAction(triggeredConditions, position, currentSnapshot)
    
    return exitDecision
  }

  /**
   * Check stop loss condition (90% premium loss)
   */
  checkStopLoss(position: OptionsPosition, snapshot: PositionSnapshot): ExitCondition {
    const entryValue = position.contracts * position.entryPrice * 100
    const lossThreshold = entryValue * this.exitRules.stopLossPercent
    const currentLoss = Math.abs(Math.min(0, snapshot.pnl.totalPnL))
    
    return {
      type: 'STOP_LOSS',
      triggered: currentLoss >= lossThreshold,
      value: currentLoss,
      threshold: lossThreshold,
      description: `Stop loss at ${(this.exitRules.stopLossPercent * 100).toFixed(0)}% premium loss`
    }
  }

  /**
   * Check profit target conditions with partial exits
   */
  checkProfitTargets(
    position: OptionsPosition,
    snapshot: PositionSnapshot
  ): { triggeredConditions: ExitCondition[] } {
    const entryValue = position.contracts * position.entryPrice * 100
    const currentProfit = Math.max(0, snapshot.pnl.totalPnL)
    const profitPercent = currentProfit / entryValue
    
    const conditions: ExitCondition[] = []
    
    // Target 1: 50% profit
    if (profitPercent >= this.exitRules.profitTarget1Percent && !position.target1Hit) {
      conditions.push({
        type: 'PROFIT_TARGET_1',
        triggered: true,
        value: profitPercent,
        threshold: this.exitRules.profitTarget1Percent,
        description: `Profit Target 1: ${(this.exitRules.profitTarget1Percent * 100).toFixed(0)}% profit reached`
      })
    }
    
    // Target 2: 100% profit (on remaining contracts after T1)
    if (profitPercent >= this.exitRules.profitTarget2Percent && 
        position.target1Hit && !position.target2Hit) {
      conditions.push({
        type: 'PROFIT_TARGET_2',
        triggered: true,
        value: profitPercent,
        threshold: this.exitRules.profitTarget2Percent,
        description: `Profit Target 2: ${(this.exitRules.profitTarget2Percent * 100).toFixed(0)}% profit reached`
      })
    }
    
    // Target 3: 200% profit (close all remaining)
    if (profitPercent >= this.exitRules.profitTarget3Percent && 
        position.target2Hit && !position.target3Hit) {
      conditions.push({
        type: 'PROFIT_TARGET_3',
        triggered: true,
        value: profitPercent,
        threshold: this.exitRules.profitTarget3Percent,
        description: `Profit Target 3: ${(this.exitRules.profitTarget3Percent * 100).toFixed(0)}% profit reached`
      })
    }
    
    return { triggeredConditions: conditions }
  }

  /**
   * Check time-based exit conditions
   */
  checkTimeBasedExits(
    position: OptionsPosition,
    snapshot: PositionSnapshot
  ): { triggeredConditions: ExitCondition[] } {
    const conditions: ExitCondition[] = []
    
    // DTE Exit: Close when ≤3 days to expiration
    if (snapshot.daysToExpiration <= this.exitRules.dteExitThreshold) {
      conditions.push({
        type: 'DTE_EXIT',
        triggered: true,
        value: snapshot.daysToExpiration,
        threshold: this.exitRules.dteExitThreshold,
        description: `DTE exit: ${snapshot.daysToExpiration} days to expiration (≤${this.exitRules.dteExitThreshold})`
      })
    }
    
    // Theta Decay Exit: Close if theta decay >10%/day while losing
    const entryValue = position.contracts * position.entryPrice * 100
    const dailyThetaDecay = Math.abs(snapshot.pnl.thetaDecay)
    const thetaDecayPercent = dailyThetaDecay / entryValue
    
    if (thetaDecayPercent > this.exitRules.thetaDecayThreshold && snapshot.pnl.totalPnL < 0) {
      conditions.push({
        type: 'THETA_DECAY',
        triggered: true,
        value: thetaDecayPercent,
        threshold: this.exitRules.thetaDecayThreshold,
        description: `Excessive theta decay: ${(thetaDecayPercent * 100).toFixed(1)}%/day while losing`
      })
    }
    
    // EOD Exit: Close 30 minutes before market close
    const eodCondition = this.checkEODExit()
    if (eodCondition.triggered) {
      conditions.push(eodCondition)
    }
    
    return { triggeredConditions: conditions }
  }

  /**
   * Check end-of-day exit condition
   */
  private checkEODExit(): ExitCondition {
    const now = new Date()
    const marketClose = new Date(now)
    marketClose.setHours(this.marketHours.close.hour, this.marketHours.close.minute, 0, 0)
    
    const minutesToClose = (marketClose.getTime() - now.getTime()) / (1000 * 60)
    const shouldExit = minutesToClose <= this.exitRules.eodExitMinutes && minutesToClose > 0
    
    return {
      type: 'EOD_EXIT',
      triggered: shouldExit,
      value: minutesToClose,
      threshold: this.exitRules.eodExitMinutes,
      description: `EOD exit: ${Math.round(minutesToClose)} minutes to market close`
    }
  }

  /**
   * Check volatility-based exits (IV crush)
   */
  checkVolatilityExits(
    position: OptionsPosition,
    snapshot: PositionSnapshot
  ): ExitCondition {
    const ivChange = (position.entryIV - snapshot.impliedVolatility) / position.entryIV
    const ivCrushTriggered = ivChange > this.exitRules.ivCrushThreshold
    
    return {
      type: 'IV_CRUSH',
      triggered: ivCrushTriggered,
      value: ivChange,
      threshold: this.exitRules.ivCrushThreshold,
      description: `IV crush: ${(ivChange * 100).toFixed(1)}% drop in implied volatility`
    }
  }

  /**
   * Check oscillator reversal exit condition
   */
  checkOscillatorReversal(
    position: OptionsPosition,
    marketCondition: MarketCondition
  ): ExitCondition {
    // Simplified oscillator reversal detection
    // In practice, this would use more sophisticated signal analysis
    const isReversal = marketCondition.oscillatorPhase === 'EXTREME_REVERSAL' ||
                      marketCondition.oscillatorPhase === 'ZONE_REVERSAL'
    
    // Check if reversal is opposite to position direction
    const isOppositeReversal = 
      (position.strategy.direction === 'BULLISH' && marketCondition.oscillatorPhase === 'EXTREME_REVERSAL') ||
      (position.strategy.direction === 'BEARISH' && marketCondition.oscillatorPhase === 'EXTREME_REVERSAL')
    
    return {
      type: 'OSCILLATOR_REVERSAL',
      triggered: isOppositeReversal,
      value: marketCondition.signalQuality,
      threshold: 4, // Require quality 4+ for reversal exit
      description: `Oscillator reversal detected: ${marketCondition.oscillatorPhase}`
    }
  }

  /**
   * Determine exit action based on triggered conditions
   */
  private determineExitAction(
    triggeredConditions: ExitCondition[],
    position: OptionsPosition,
    snapshot: PositionSnapshot
  ): ExitDecision {
    if (triggeredConditions.length === 0) {
      return {
        shouldExit: false,
        exitType: 'STOP_LOSS', // Default
        percentToClose: 0,
        reasoning: 'No exit conditions triggered',
        urgency: 'LOW',
        triggeredConditions: []
      }
    }
    
    // Priority order: Stop Loss > DTE > EOD > Theta > IV Crush > Profit Targets > Oscillator
    const priorityOrder: ExitType[] = [
      'STOP_LOSS',
      'DTE_EXIT', 
      'EOD_EXIT',
      'THETA_DECAY',
      'IV_CRUSH',
      'PROFIT_TARGET_3',
      'PROFIT_TARGET_2', 
      'PROFIT_TARGET_1',
      'OSCILLATOR_REVERSAL'
    ]
    
    // Find highest priority condition
    let highestPriorityCondition: ExitCondition | null = null
    for (const exitType of priorityOrder) {
      const condition = triggeredConditions.find(c => c.type === exitType)
      if (condition) {
        highestPriorityCondition = condition
        break
      }
    }
    
    if (!highestPriorityCondition) {
      return {
        shouldExit: false,
        exitType: 'STOP_LOSS',
        percentToClose: 0,
        reasoning: 'No valid exit conditions found',
        urgency: 'LOW',
        triggeredConditions
      }
    }
    
    // Determine exit percentage and urgency
    const { percentToClose, urgency } = this.calculateExitPercentage(
      highestPriorityCondition.type,
      position
    )
    
    const reasoning = this.generateExitReasoning(highestPriorityCondition, triggeredConditions)
    
    return {
      shouldExit: true,
      exitType: highestPriorityCondition.type,
      percentToClose,
      reasoning,
      urgency,
      triggeredConditions
    }
  }

  /**
   * Calculate what percentage of position to close
   */
  private calculateExitPercentage(
    exitType: ExitType,
    position: OptionsPosition
  ): { percentToClose: number; urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE' } {
    switch (exitType) {
      case 'STOP_LOSS':
      case 'DTE_EXIT':
      case 'EOD_EXIT':
        return { percentToClose: 1.0, urgency: 'IMMEDIATE' } // Close 100%
      
      case 'THETA_DECAY':
      case 'IV_CRUSH':
        return { percentToClose: 1.0, urgency: 'HIGH' } // Close 100%
      
      case 'PROFIT_TARGET_1':
        return { percentToClose: this.exitRules.partialExitT1Percent, urgency: 'MEDIUM' } // Close 50%
      
      case 'PROFIT_TARGET_2':
        // Close 60% of remaining contracts (if 50% already closed, 60% of 50% = 30% of original)
        const remainingAfterT1 = position.target1Hit ? 0.5 : 1.0
        const t2ExitPercent = this.exitRules.partialExitT2Percent * remainingAfterT1
        return { percentToClose: t2ExitPercent, urgency: 'MEDIUM' }
      
      case 'PROFIT_TARGET_3':
        return { percentToClose: 1.0, urgency: 'MEDIUM' } // Close all remaining
      
      case 'OSCILLATOR_REVERSAL':
        return { percentToClose: 0.5, urgency: 'LOW' } // Close 50%
      
      default:
        return { percentToClose: 1.0, urgency: 'MEDIUM' }
    }
  }

  /**
   * Generate human-readable exit reasoning
   */
  private generateExitReasoning(
    primaryCondition: ExitCondition,
    allConditions: ExitCondition[]
  ): string {
    const reasons: string[] = [primaryCondition.description]
    
    // Add secondary conditions if multiple triggered
    if (allConditions.length > 1) {
      const secondaryConditions = allConditions
        .filter(c => c.type !== primaryCondition.type)
        .slice(0, 2) // Limit to 2 additional conditions
      
      if (secondaryConditions.length > 0) {
        reasons.push(`Additional conditions: ${secondaryConditions.map(c => c.type).join(', ')}`)
      }
    }
    
    return reasons.join('. ')
  }

  /**
   * Create execution plan for exit
   */
  async createExitExecutionPlan(
    exitDecision: ExitDecision,
    position: OptionsPosition,
    currentSnapshot: PositionSnapshot
  ): Promise<ExitExecutionPlan> {
    const contractsToClose = Math.ceil(position.contracts * exitDecision.percentToClose)
    const estimatedFillPrice = this.estimateFillPrice(currentSnapshot, exitDecision.urgency)
    const orderType = exitDecision.urgency === 'IMMEDIATE' ? 'MARKET' : 'LIMIT'
    
    return {
      shouldExit: exitDecision.shouldExit,
      exitType: exitDecision.exitType,
      percentToClose: exitDecision.percentToClose,
      contractsToClose,
      urgency: exitDecision.urgency,
      reasoning: exitDecision.reasoning,
      triggeredConditions: exitDecision.triggeredConditions,
      estimatedFillPrice,
      orderType
    }
  }

  /**
   * Estimate fill price based on current market and urgency
   */
  private estimateFillPrice(snapshot: PositionSnapshot, urgency: string): number {
    // For market orders (urgent exits), assume we get bid price
    if (urgency === 'IMMEDIATE') {
      return snapshot.optionPrice * 0.98 // Assume 2% slippage for market order
    }
    
    // For limit orders, use mid-price
    return snapshot.optionPrice
  }

  /**
   * Update exit rules configuration
   */
  updateExitRules(newRules: Partial<ExitRules>): void {
    this.exitRules = { ...this.exitRules, ...newRules }
    // Logger expects a generic Record<string, unknown>; pass a fresh object for structured logging.
    logger.info('Updated exit rules configuration', { ...this.exitRules })
  }

  /**
   * Get current exit rules
   */
  getExitRules(): ExitRules {
    return { ...this.exitRules }
  }
}

/**
 * Utility functions for exit management
 */
export class ExitManagementUtils {
  
  /**
   * Validate exit rules configuration
   */
  static validateExitRules(rules: ExitRules): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (rules.stopLossPercent <= 0 || rules.stopLossPercent > 1) {
      errors.push('Stop loss percent must be between 0 and 100%')
    }
    
    if (rules.profitTarget1Percent <= 0) {
      errors.push('Profit target 1 must be positive')
    }
    
    if (rules.profitTarget2Percent <= rules.profitTarget1Percent) {
      errors.push('Profit target 2 must be higher than target 1')
    }
    
    if (rules.profitTarget3Percent <= rules.profitTarget2Percent) {
      errors.push('Profit target 3 must be higher than target 2')
    }
    
    if (rules.dteExitThreshold < 0 || rules.dteExitThreshold > 30) {
      errors.push('DTE exit threshold must be between 0 and 30 days')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Calculate expected exit timing based on current conditions
   */
  static estimateExitTiming(
    position: OptionsPosition,
    snapshot: PositionSnapshot,
    rules: ExitRules
  ): {
    likelyExitType: ExitType
    estimatedDays: number
    confidence: number
  } {
    // Simplified exit timing estimation
    const daysToExpiration = snapshot.daysToExpiration
    const currentProfitPercent = snapshot.pnl.totalPnL / (position.contracts * position.entryPrice * 100)
    
    // If already profitable and approaching targets
    if (currentProfitPercent > rules.profitTarget1Percent * 0.8) {
      return {
        likelyExitType: 'PROFIT_TARGET_1',
        estimatedDays: Math.min(2, daysToExpiration),
        confidence: 0.7
      }
    }
    
    // If approaching DTE threshold
    if (daysToExpiration <= rules.dteExitThreshold + 2) {
      return {
        likelyExitType: 'DTE_EXIT',
        estimatedDays: Math.max(0, daysToExpiration - rules.dteExitThreshold),
        confidence: 0.9
      }
    }
    
    // Default to theta decay concern
    return {
      likelyExitType: 'THETA_DECAY',
      estimatedDays: Math.floor(daysToExpiration / 2),
      confidence: 0.5
    }
  }
}

// Export singleton instance
export const exitManager = new OptionsExitManager()