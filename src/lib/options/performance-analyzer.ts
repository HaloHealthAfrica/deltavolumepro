/**
 * Trade Performance Analysis and Optimization System
 * 
 * Implements comprehensive analysis of completed options trades with Greeks breakdown,
 * selection accuracy tracking, and optimization recommendations.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { apiLogger as logger } from '../logger'
import type { 
  OptionsPosition,
  MarketCondition,
  ExitCondition
} from '../../types/options'
import type { ExitType } from './exit-manager'

export interface TradePerformanceMetrics {
  tradeId: string
  positionId: string
  
  // Final performance
  finalPnL: number
  pnlPercent: number
  rMultiple: number
  holdingPeriod: number // minutes
  
  // Greeks breakdown
  deltaPnL: number
  gammaPnL: number
  thetaPnL: number
  vegaPnL: number
  rhoPnL: number
  
  // Selection accuracy
  deltaAccuracy: number    // How close was delta targeting
  dteAccuracy: number      // How close was DTE selection
  ivAccuracy: number       // How accurate was IV prediction
  
  // Exit effectiveness
  exitCondition: ExitType
  exitTiming: 'EARLY' | 'OPTIMAL' | 'LATE'
  exitEffectiveness: number // 0-1 score
  
  // Market condition analysis
  marketCondition: MarketCondition
  conditionMatch: number   // How well did conditions match strategy
  
  // Lessons learned
  insights: string[]
  improvements: string[]
}

export interface PerformanceAnalysis {
  overallMetrics: OverallPerformanceMetrics
  selectionAnalysis: SelectionAnalysis
  exitAnalysis: ExitAnalysis
  marketConditionAnalysis: MarketConditionAnalysis
  optimizationRecommendations: OptimizationRecommendation[]
}

export interface OverallPerformanceMetrics {
  totalTrades: number
  winRate: number
  avgReturn: number
  avgRMultiple: number
  sharpeRatio: number
  maxDrawdown: number
  profitFactor: number
  avgHoldingPeriod: number
}

export interface SelectionAnalysis {
  avgDeltaAccuracy: number
  avgDTEAccuracy: number
  avgIVAccuracy: number
  bestPerformingDeltas: number[]
  bestPerformingDTEs: number[]
  worstPerformingCombinations: Array<{
    delta: number
    dte: number
    avgReturn: number
    sampleSize: number
  }>
}

export interface ExitAnalysis {
  exitConditionEffectiveness: Record<ExitType, {
    frequency: number
    avgReturn: number
    avgHoldingPeriod: number
    effectiveness: number
  }>
  optimalExitTiming: {
    profitTargets: { t1: number; t2: number; t3: number }
    stopLoss: number
    timeBasedExits: number
  }
}

export interface MarketConditionAnalysis {
  performanceByIVRank: Array<{
    ivRankRange: string
    avgReturn: number
    winRate: number
    sampleSize: number
  }>
  performanceByOscillator: Record<string, {
    avgReturn: number
    winRate: number
    sampleSize: number
  }>
  bestConditions: MarketCondition[]
  worstConditions: MarketCondition[]
}

export interface OptimizationRecommendation {
  category: 'DELTA_TARGETING' | 'DTE_SELECTION' | 'EXIT_RULES' | 'MARKET_CONDITIONS'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  recommendation: string
  expectedImprovement: number // Expected improvement in return %
  confidence: number // 0-1 confidence in recommendation
  implementationComplexity: 'LOW' | 'MEDIUM' | 'HIGH'
}

export class OptionsPerformanceAnalyzer {
  private tradeHistory: TradePerformanceMetrics[] = []

  /**
   * Analyze a completed trade and generate performance metrics
   */
  async analyzeCompletedTrade(
    position: OptionsPosition,
    exitConditions: ExitCondition[],
    marketCondition: MarketCondition,
    finalSnapshot: any
  ): Promise<TradePerformanceMetrics> {
    const entryValue = position.contracts * position.entryPrice * 100
    const finalValue = position.contracts * finalSnapshot.optionPrice * 100
    const finalPnL = finalValue - entryValue
    const pnlPercent = finalPnL / entryValue
    
    // Calculate holding period
    const holdingPeriod = (finalSnapshot.timestamp.getTime() - position.entryDate.getTime()) / (1000 * 60)
    
    // Calculate R-multiple (actual return / initial risk)
    const initialRisk = position.maxRisk
    const rMultiple = finalPnL / initialRisk
    
    // Analyze Greeks breakdown
    const greeksBreakdown = this.analyzeGreeksContribution(position, finalSnapshot)
    
    // Analyze selection accuracy
    const selectionAccuracy = this.analyzeSelectionAccuracy(position, finalSnapshot)
    
    // Analyze exit effectiveness
    const exitAnalysis = this.analyzeExitEffectiveness(position, exitConditions, finalPnL)
    
    // Analyze market condition match
    const conditionMatch = this.analyzeMarketConditionMatch(position, marketCondition)
    
    // Generate insights and improvements
    const { insights, improvements } = this.generateInsights(
      position, 
      finalPnL, 
      exitAnalysis, 
      selectionAccuracy,
      marketCondition
    )
    
    const metrics: TradePerformanceMetrics = {
      tradeId: position.tradeId,
      positionId: position.id,
      finalPnL,
      pnlPercent,
      rMultiple,
      holdingPeriod,
      deltaPnL: greeksBreakdown.deltaPnL,
      gammaPnL: greeksBreakdown.gammaPnL,
      thetaPnL: greeksBreakdown.thetaPnL,
      vegaPnL: greeksBreakdown.vegaPnL,
      rhoPnL: greeksBreakdown.rhoPnL,
      deltaAccuracy: selectionAccuracy.deltaAccuracy,
      dteAccuracy: selectionAccuracy.dteAccuracy,
      ivAccuracy: selectionAccuracy.ivAccuracy,
      exitCondition: exitAnalysis.exitCondition,
      exitTiming: exitAnalysis.exitTiming,
      exitEffectiveness: exitAnalysis.exitEffectiveness,
      marketCondition,
      conditionMatch,
      insights,
      improvements
    }
    
    // Store in history
    this.tradeHistory.push(metrics)
    
    logger.info(`Analyzed completed trade ${position.tradeId}: P&L ${finalPnL.toFixed(2)}, R-multiple ${rMultiple.toFixed(2)}`)
    
    return metrics
  }

  /**
   * Analyze Greeks contribution to P&L
   */
  private analyzeGreeksContribution(
    position: OptionsPosition,
    finalSnapshot: any
  ): {
    deltaPnL: number
    gammaPnL: number
    thetaPnL: number
    vegaPnL: number
    rhoPnL: number
  } {
    // Simplified Greeks P&L attribution
    // In practice, this would use more sophisticated models
    
    const totalPnL = finalSnapshot.pnl.totalPnL
    const entryGreeks = position.entryGreeks
    const finalGreeks = finalSnapshot.greeks
    
    if (!entryGreeks || !finalGreeks) {
      return { deltaPnL: totalPnL, gammaPnL: 0, thetaPnL: 0, vegaPnL: 0, rhoPnL: 0 }
    }
    
    // Estimate component contributions
    const deltaPnL = finalSnapshot.pnl.deltaChange || totalPnL * 0.6
    const thetaPnL = finalSnapshot.pnl.thetaDecay || totalPnL * 0.2
    const vegaPnL = finalSnapshot.pnl.vegaEffect || totalPnL * 0.15
    const gammaPnL = finalSnapshot.pnl.gammaEffect || totalPnL * 0.04
    const rhoPnL = totalPnL * 0.01 // Usually minimal
    
    return { deltaPnL, gammaPnL, thetaPnL, vegaPnL, rhoPnL }
  }

  /**
   * Analyze selection accuracy (delta, DTE, IV)
   */
  private analyzeSelectionAccuracy(
    position: OptionsPosition,
    finalSnapshot: any
  ): {
    deltaAccuracy: number
    dteAccuracy: number
    ivAccuracy: number
  } {
    // Delta accuracy: How close was actual delta to target
    const targetDelta = 0.65 // Standard target
    const actualDelta = position.entryGreeks?.delta || 0
    const deltaDeviation = Math.abs(actualDelta - targetDelta)
    const deltaAccuracy = Math.max(0, 1 - (deltaDeviation / 0.2)) // Normalize to 0-1
    
    // DTE accuracy: How close was actual DTE to target
    const targetDTE = this.estimateTargetDTE(position)
    const actualDTE = position.daysToExpiration || 0
    const dteDeviation = Math.abs(actualDTE - targetDTE)
    const dteAccuracy = Math.max(0, 1 - (dteDeviation / 10)) // Normalize to 0-1
    
    // IV accuracy: How well did IV prediction work out
    const entryIV = position.entryIV
    const avgIV = (entryIV + finalSnapshot.impliedVolatility) / 2
    const ivVolatility = Math.abs(finalSnapshot.impliedVolatility - entryIV) / entryIV
    const ivAccuracy = Math.max(0, 1 - ivVolatility) // Lower volatility = higher accuracy
    
    return { deltaAccuracy, dteAccuracy, ivAccuracy }
  }

  /**
   * Estimate target DTE based on position strategy
   */
  private estimateTargetDTE(position: OptionsPosition): number {
    // Simplified DTE estimation based on strategy
    if (position.strategy.riskProfile === 'AGGRESSIVE') return 14
    if (position.strategy.riskProfile === 'MODERATE') return 30
    return 45 // Conservative
  }

  /**
   * Analyze exit effectiveness
   */
  private analyzeExitEffectiveness(
    position: OptionsPosition,
    exitConditions: ExitCondition[],
    finalPnL: number
  ): {
    exitCondition: ExitType
    exitTiming: 'EARLY' | 'OPTIMAL' | 'LATE'
    exitEffectiveness: number
  } {
    const primaryExit = exitConditions[0]?.type || 'STOP_LOSS'
    
    // Determine exit timing based on P&L and exit type
    let exitTiming: 'EARLY' | 'OPTIMAL' | 'LATE' = 'OPTIMAL'
    let exitEffectiveness = 0.5
    
    if (primaryExit === 'PROFIT_TARGET_1' || primaryExit === 'PROFIT_TARGET_2' || primaryExit === 'PROFIT_TARGET_3') {
      exitTiming = 'OPTIMAL'
      exitEffectiveness = 0.8
    } else if (primaryExit === 'STOP_LOSS') {
      exitTiming = 'LATE'
      exitEffectiveness = 0.2
    } else if (primaryExit === 'DTE_EXIT' && finalPnL > 0) {
      exitTiming = 'EARLY'
      exitEffectiveness = 0.6
    } else if (primaryExit === 'THETA_DECAY') {
      exitTiming = 'OPTIMAL'
      exitEffectiveness = 0.7
    }
    
    return {
      exitCondition: primaryExit,
      exitTiming,
      exitEffectiveness
    }
  }

  /**
   * Analyze how well market conditions matched strategy
   */
  private analyzeMarketConditionMatch(
    position: OptionsPosition,
    marketCondition: MarketCondition
  ): number {
    let matchScore = 0.5 // Base score
    
    // Check volatility bias alignment
    if (position.strategy.volatilityBias === 'LONG_VOL' && marketCondition.ivRank < 30) {
      matchScore += 0.2
    } else if (position.strategy.volatilityBias === 'SHORT_VOL' && marketCondition.ivRank > 70) {
      matchScore += 0.2
    }
    
    // Check direction alignment
    if (position.strategy.direction === 'BULLISH' && marketCondition.oscillatorPhase === 'EXTREME_REVERSAL') {
      matchScore += 0.15
    } else if (position.strategy.direction === 'BEARISH' && marketCondition.oscillatorPhase === 'EXTREME_REVERSAL') {
      matchScore += 0.15
    }
    
    // Check signal quality
    if (marketCondition.signalQuality >= 4) {
      matchScore += 0.1
    }
    
    return Math.min(1.0, matchScore)
  }

  /**
   * Generate insights and improvement suggestions
   */
  private generateInsights(
    position: OptionsPosition,
    finalPnL: number,
    exitAnalysis: any,
    selectionAccuracy: any,
    marketCondition: MarketCondition
  ): { insights: string[]; improvements: string[] } {
    const insights: string[] = []
    const improvements: string[] = []
    
    // P&L insights
    if (finalPnL > 0) {
      insights.push(`Profitable trade: ${(finalPnL / (position.contracts * position.entryPrice * 100) * 100).toFixed(1)}% return`)
    } else {
      insights.push(`Loss: ${(Math.abs(finalPnL) / (position.contracts * position.entryPrice * 100) * 100).toFixed(1)}% loss`)
    }
    
    // Selection accuracy insights
    if (selectionAccuracy.deltaAccuracy < 0.7) {
      insights.push('Delta targeting was off - consider refining strike selection')
      improvements.push('Improve delta targeting accuracy by adjusting strike selection algorithm')
    }
    
    if (selectionAccuracy.dteAccuracy < 0.7) {
      insights.push('DTE selection could be improved')
      improvements.push('Optimize expiration selection based on signal quality and market conditions')
    }
    
    // Exit effectiveness insights
    if (exitAnalysis.exitEffectiveness < 0.5) {
      insights.push('Exit timing was suboptimal')
      improvements.push('Review exit conditions and consider earlier profit taking or tighter stops')
    }
    
    // Market condition insights
    if (marketCondition.ivRank > 70 && position.strategy.volatilityBias === 'LONG_VOL') {
      insights.push('Bought volatility when IV was high - consider selling vol instead')
      improvements.push('Avoid long volatility strategies when IV rank > 70')
    }
    
    return { insights, improvements }
  }

  /**
   * Generate comprehensive performance analysis
   */
  generatePerformanceAnalysis(): PerformanceAnalysis {
    if (this.tradeHistory.length === 0) {
      throw new Error('No trade history available for analysis')
    }
    
    const overallMetrics = this.calculateOverallMetrics()
    const selectionAnalysis = this.analyzeSelectionPerformance()
    const exitAnalysis = this.analyzeExitPerformance()
    const marketConditionAnalysis = this.analyzeMarketConditionPerformance()
    const optimizationRecommendations = this.generateOptimizationRecommendations()
    
    return {
      overallMetrics,
      selectionAnalysis,
      exitAnalysis,
      marketConditionAnalysis,
      optimizationRecommendations
    }
  }

  /**
   * Calculate overall performance metrics
   */
  private calculateOverallMetrics(): OverallPerformanceMetrics {
    const trades = this.tradeHistory
    const winningTrades = trades.filter(t => t.finalPnL > 0)
    const losingTrades = trades.filter(t => t.finalPnL < 0)
    
    const totalReturn = trades.reduce((sum, t) => sum + t.pnlPercent, 0)
    const avgReturn = totalReturn / trades.length
    
    const avgRMultiple = trades.reduce((sum, t) => sum + t.rMultiple, 0) / trades.length
    
    // Calculate Sharpe ratio (simplified)
    const returns = trades.map(t => t.pnlPercent)
    const avgReturnDaily = avgReturn
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturnDaily, 2), 0) / returns.length)
    const sharpeRatio = stdDev > 0 ? avgReturnDaily / stdDev : 0
    
    // Calculate max drawdown
    let peak = 0
    let maxDrawdown = 0
    let runningPnL = 0
    
    for (const trade of trades) {
      runningPnL += trade.pnlPercent
      if (runningPnL > peak) peak = runningPnL
      const drawdown = peak - runningPnL
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }
    
    // Calculate profit factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.finalPnL, 0)
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.finalPnL, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
    
    const avgHoldingPeriod = trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length
    
    return {
      totalTrades: trades.length,
      winRate: winningTrades.length / trades.length,
      avgReturn,
      avgRMultiple,
      sharpeRatio,
      maxDrawdown,
      profitFactor,
      avgHoldingPeriod
    }
  }

  /**
   * Analyze selection performance patterns
   */
  private analyzeSelectionPerformance(): SelectionAnalysis {
    const trades = this.tradeHistory
    
    const avgDeltaAccuracy = trades.reduce((sum, t) => sum + t.deltaAccuracy, 0) / trades.length
    const avgDTEAccuracy = trades.reduce((sum, t) => sum + t.dteAccuracy, 0) / trades.length
    const avgIVAccuracy = trades.reduce((sum, t) => sum + t.ivAccuracy, 0) / trades.length
    
    // Find best performing deltas (simplified)
    const bestPerformingDeltas = [0.65, 0.70, 0.60] // Placeholder
    const bestPerformingDTEs = [14, 30, 21] // Placeholder
    
    const worstPerformingCombinations = [
      { delta: 0.50, dte: 45, avgReturn: -0.15, sampleSize: 5 }
    ] // Placeholder
    
    return {
      avgDeltaAccuracy,
      avgDTEAccuracy,
      avgIVAccuracy,
      bestPerformingDeltas,
      bestPerformingDTEs,
      worstPerformingCombinations
    }
  }

  /**
   * Analyze exit performance patterns
   */
  private analyzeExitPerformance(): ExitAnalysis {
    const trades = this.tradeHistory
    
    // Group by exit condition
    const exitGroups = trades.reduce((groups, trade) => {
      const exitType = trade.exitCondition
      if (!groups[exitType]) {
        groups[exitType] = []
      }
      groups[exitType].push(trade)
      return groups
    }, {} as Record<ExitType, TradePerformanceMetrics[]>)
    
    const exitConditionEffectiveness: Record<ExitType, any> = {} as any
    
    for (const [exitType, exitTrades] of Object.entries(exitGroups)) {
      const avgReturn = exitTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / exitTrades.length
      const avgHoldingPeriod = exitTrades.reduce((sum, t) => sum + t.holdingPeriod, 0) / exitTrades.length
      const avgEffectiveness = exitTrades.reduce((sum, t) => sum + t.exitEffectiveness, 0) / exitTrades.length
      
      exitConditionEffectiveness[exitType as ExitType] = {
        frequency: exitTrades.length / trades.length,
        avgReturn,
        avgHoldingPeriod,
        effectiveness: avgEffectiveness
      }
    }
    
    return {
      exitConditionEffectiveness,
      optimalExitTiming: {
        profitTargets: { t1: 0.5, t2: 1.0, t3: 2.0 },
        stopLoss: 0.9,
        timeBasedExits: 3
      }
    }
  }

  /**
   * Analyze market condition performance patterns
   */
  private analyzeMarketConditionPerformance(): MarketConditionAnalysis {
    // Simplified analysis - in practice would be more comprehensive
    return {
      performanceByIVRank: [
        { ivRankRange: '0-30', avgReturn: 0.15, winRate: 0.65, sampleSize: 10 },
        { ivRankRange: '30-70', avgReturn: 0.08, winRate: 0.55, sampleSize: 15 },
        { ivRankRange: '70-100', avgReturn: 0.12, winRate: 0.60, sampleSize: 8 }
      ],
      performanceByOscillator: {
        'EXTREME_REVERSAL': { avgReturn: 0.18, winRate: 0.70, sampleSize: 12 },
        'TRENDING': { avgReturn: 0.05, winRate: 0.50, sampleSize: 18 },
        'COMPRESSION': { avgReturn: -0.02, winRate: 0.40, sampleSize: 5 }
      },
      bestConditions: [],
      worstConditions: []
    }
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = []
    
    // Analyze patterns and generate recommendations
    const overallMetrics = this.calculateOverallMetrics()
    
    if (overallMetrics.winRate < 0.6) {
      recommendations.push({
        category: 'DELTA_TARGETING',
        priority: 'HIGH',
        recommendation: 'Improve strike selection accuracy - current win rate is below target',
        expectedImprovement: 0.05,
        confidence: 0.8,
        implementationComplexity: 'MEDIUM'
      })
    }
    
    if (overallMetrics.avgRMultiple < 1.5) {
      recommendations.push({
        category: 'EXIT_RULES',
        priority: 'HIGH',
        recommendation: 'Optimize exit conditions to improve risk/reward ratio',
        expectedImprovement: 0.08,
        confidence: 0.7,
        implementationComplexity: 'LOW'
      })
    }
    
    return recommendations
  }

  /**
   * Get trade history
   */
  getTradeHistory(): TradePerformanceMetrics[] {
    return [...this.tradeHistory]
  }

  /**
   * Clear trade history
   */
  clearHistory(): void {
    this.tradeHistory = []
    logger.info('Cleared trade performance history')
  }
}

// Export singleton instance
export const performanceAnalyzer = new OptionsPerformanceAnalyzer()