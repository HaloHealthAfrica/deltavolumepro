/**
 * Learning Engine
 * 
 * Optimizes trading rules based on trade performance analysis.
 * Implements rule optimization, backtesting, and version management.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { prisma } from '@/lib/prisma'
import type { TradingRules, TradeAnalysis, Signal } from '@prisma/client'
import { getAnalysisStatistics, type FeatureImportance } from './trade-analysis'

export interface OptimizationResult {
  currentRules: Partial<TradingRules>
  proposedRules: Partial<TradingRules>
  changes: RuleChange[]
  expectedImprovement: number
  backtestResults?: BacktestResults
}

export interface RuleChange {
  parameter: string
  oldValue: number
  newValue: number
  reason: string
}

export interface BacktestResults {
  totalSignals: number
  tradesExecuted: number
  wins: number
  losses: number
  winRate: number
  avgReturn: number
  sharpeRatio: number
  maxDrawdown: number
}

const MIN_TRADES_FOR_OPTIMIZATION = 50
const OPTIMIZATION_INTERVAL_DAYS = 7

/**
 * Checks if optimization should run
 * Requirement 7.1
 */
export async function shouldRunOptimization(): Promise<{
  shouldRun: boolean
  reason: string
}> {
  // Check trade count
  const tradeCount = await prisma.trade.count({
    where: { status: 'CLOSED' }
  })
  
  if (tradeCount >= MIN_TRADES_FOR_OPTIMIZATION) {
    // Check if we've optimized recently
    const lastOptimization = await prisma.tradingRules.findFirst({
      orderBy: { createdAt: 'desc' }
    })
    
    if (!lastOptimization) {
      return { shouldRun: true, reason: `${tradeCount} trades completed, no previous optimization` }
    }
    
    const daysSinceLastOptimization = Math.floor(
      (Date.now() - new Date(lastOptimization.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSinceLastOptimization >= OPTIMIZATION_INTERVAL_DAYS) {
      return { shouldRun: true, reason: `${daysSinceLastOptimization} days since last optimization` }
    }
    
    // Check if we have enough new trades since last optimization
    const newTradeCount = await prisma.trade.count({
      where: {
        status: 'CLOSED',
        exitedAt: { gt: lastOptimization.createdAt }
      }
    })
    
    if (newTradeCount >= 20) {
      return { shouldRun: true, reason: `${newTradeCount} new trades since last optimization` }
    }
  }
  
  return {
    shouldRun: false,
    reason: `Only ${tradeCount} trades (need ${MIN_TRADES_FOR_OPTIMIZATION})`
  }
}

/**
 * Collects and analyzes trade data for optimization
 * Requirement 7.2
 */
async function collectAnalysisData(): Promise<{
  analyses: TradeAnalysis[]
  winningAnalyses: TradeAnalysis[]
  losingAnalyses: TradeAnalysis[]
  avgFeatureImportance: FeatureImportance
}> {
  const analyses = await prisma.tradeAnalysis.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200 // Last 200 trades
  })
  
  const winningAnalyses = analyses.filter(a => a.outcome === 'WIN')
  const losingAnalyses = analyses.filter(a => a.outcome === 'LOSS')
  
  const stats = await getAnalysisStatistics()
  
  return {
    analyses,
    winningAnalyses,
    losingAnalyses,
    avgFeatureImportance: stats.avgFeatureImportance
  }
}

/**
 * Calculates optimal weights based on feature importance
 * Requirement 7.3
 */
function calculateOptimalWeights(
  winningAnalyses: TradeAnalysis[],
  losingAnalyses: TradeAnalysis[]
): {
  qualityWeight: number
  volumeWeight: number
  oscillatorWeight: number
  structureWeight: number
  marketWeight: number
} {
  if (winningAnalyses.length === 0) {
    // Return default weights if no winning trades
    return {
      qualityWeight: 0.25,
      volumeWeight: 0.20,
      oscillatorWeight: 0.20,
      structureWeight: 0.20,
      marketWeight: 0.15
    }
  }
  
  // Calculate average feature importance for winners
  const winAvg = {
    quality: winningAnalyses.reduce((s, a) => s + a.signalQuality, 0) / winningAnalyses.length,
    volume: winningAnalyses.reduce((s, a) => s + a.volumePressure, 0) / winningAnalyses.length,
    oscillator: winningAnalyses.reduce((s, a) => s + a.oscillatorPhase, 0) / winningAnalyses.length,
    market: winningAnalyses.reduce((s, a) => s + a.marketCondition, 0) / winningAnalyses.length
  }
  
  // Calculate average feature importance for losers
  const loseAvg = losingAnalyses.length > 0 ? {
    quality: losingAnalyses.reduce((s, a) => s + a.signalQuality, 0) / losingAnalyses.length,
    volume: losingAnalyses.reduce((s, a) => s + a.volumePressure, 0) / losingAnalyses.length,
    oscillator: losingAnalyses.reduce((s, a) => s + a.oscillatorPhase, 0) / losingAnalyses.length,
    market: losingAnalyses.reduce((s, a) => s + a.marketCondition, 0) / losingAnalyses.length
  } : winAvg
  
  // Calculate differential importance (what distinguishes winners from losers)
  const diff = {
    quality: winAvg.quality - loseAvg.quality,
    volume: winAvg.volume - loseAvg.volume,
    oscillator: winAvg.oscillator - loseAvg.oscillator,
    market: winAvg.market - loseAvg.market
  }
  
  // Normalize to weights that sum to 1
  const total = Math.abs(diff.quality) + Math.abs(diff.volume) + Math.abs(diff.oscillator) + Math.abs(diff.market)
  
  if (total === 0) {
    return {
      qualityWeight: 0.25,
      volumeWeight: 0.20,
      oscillatorWeight: 0.20,
      structureWeight: 0.20,
      marketWeight: 0.15
    }
  }
  
  // Base weights + adjustment from differential
  const baseWeight = 0.15
  const adjustmentFactor = 0.10
  
  return {
    qualityWeight: Math.min(0.35, Math.max(0.10, baseWeight + (diff.quality / total) * adjustmentFactor)),
    volumeWeight: Math.min(0.30, Math.max(0.10, baseWeight + (diff.volume / total) * adjustmentFactor)),
    oscillatorWeight: Math.min(0.30, Math.max(0.10, baseWeight + (diff.oscillator / total) * adjustmentFactor)),
    structureWeight: 0.20, // Keep structure weight stable
    marketWeight: Math.min(0.25, Math.max(0.10, baseWeight + (diff.market / total) * adjustmentFactor))
  }
}

/**
 * Calculates optimal thresholds based on trade outcomes
 */
function calculateOptimalThresholds(
  winningAnalyses: TradeAnalysis[],
  losingAnalyses: TradeAnalysis[]
): {
  minQuality: number
  minConfidence: number
  minVolumePressure: number
} {
  // Get signals for winning and losing trades
  // For now, use heuristics based on analysis data
  
  const avgWinQuality = winningAnalyses.length > 0
    ? winningAnalyses.reduce((s, a) => s + a.signalQuality, 0) / winningAnalyses.length
    : 0.8
  
  const avgLoseQuality = losingAnalyses.length > 0
    ? losingAnalyses.reduce((s, a) => s + a.signalQuality, 0) / losingAnalyses.length
    : 0.6
  
  // Set thresholds slightly above losing average
  return {
    minQuality: avgLoseQuality > 0.6 ? 4 : 3,
    minConfidence: Math.min(0.75, Math.max(0.55, (avgWinQuality + avgLoseQuality) / 2 + 0.1)),
    minVolumePressure: 60
  }
}

/**
 * Runs backtest on proposed rules
 * Requirement 7.4
 */
export async function backtestRules(
  rules: Partial<TradingRules>
): Promise<BacktestResults> {
  // Get historical signals
  const signals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500
  })
  
  let tradesExecuted = 0
  let wins = 0
  let losses = 0
  let totalReturn = 0
  const returns: number[] = []
  
  for (const signal of signals) {
    // Simulate decision with proposed rules
    const wouldTrade = simulateDecision(signal, rules)
    
    if (wouldTrade) {
      tradesExecuted++
      
      // Get actual trade outcome if exists
      const trade = await prisma.trade.findFirst({
        where: { signalId: signal.id, status: 'CLOSED' }
      })
      
      if (trade) {
        const returnPct = trade.pnlPercent || 0
        returns.push(returnPct)
        totalReturn += returnPct
        
        if (returnPct > 0) wins++
        else if (returnPct < 0) losses++
      }
    }
  }
  
  const avgReturn = returns.length > 0 ? totalReturn / returns.length : 0
  const winRate = tradesExecuted > 0 ? wins / tradesExecuted : 0
  
  // Calculate Sharpe ratio (simplified)
  const stdDev = calculateStdDev(returns)
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0
  
  // Calculate max drawdown
  const maxDrawdown = calculateMaxDrawdown(returns)
  
  return {
    totalSignals: signals.length,
    tradesExecuted,
    wins,
    losses,
    winRate,
    avgReturn,
    sharpeRatio,
    maxDrawdown
  }
}

/**
 * Simulates decision for a signal with given rules
 */
function simulateDecision(signal: Signal, rules: Partial<TradingRules>): boolean {
  const minQuality = rules.minQuality || 4
  const minVolumePressure = rules.minVolumePressure || 60
  
  // Check quality filter
  if (signal.quality < minQuality) return false
  
  // Check volume pressure
  const volumePressure = signal.buyPercent - signal.sellPercent + 50
  if (volumePressure < minVolumePressure) return false
  
  return true
}

/**
 * Calculates standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Calculates maximum drawdown
 */
function calculateMaxDrawdown(returns: number[]): number {
  if (returns.length === 0) return 0
  
  let peak = 0
  let maxDrawdown = 0
  let cumulative = 0
  
  for (const ret of returns) {
    cumulative += ret
    if (cumulative > peak) peak = cumulative
    const drawdown = peak - cumulative
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  
  return maxDrawdown
}

/**
 * Optimizes trading rules based on analysis
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export async function optimizeRules(): Promise<OptimizationResult> {
  console.log('[Learning] Starting rule optimization')
  
  // Get current active rules
  const currentRules = await prisma.tradingRules.findFirst({
    where: { isActive: true }
  })
  
  // Collect analysis data
  const { winningAnalyses, losingAnalyses, avgFeatureImportance } = await collectAnalysisData()
  
  console.log(`[Learning] Analyzing ${winningAnalyses.length} wins, ${losingAnalyses.length} losses`)
  
  // Calculate optimal weights
  const optimalWeights = calculateOptimalWeights(winningAnalyses, losingAnalyses)
  
  // Calculate optimal thresholds
  const optimalThresholds = calculateOptimalThresholds(winningAnalyses, losingAnalyses)
  
  // Build proposed rules
  const proposedRules: Partial<TradingRules> = {
    ...optimalWeights,
    ...optimalThresholds,
    maxRiskPercent: currentRules?.maxRiskPercent || 2.0,
    compressionMultiplier: currentRules?.compressionMultiplier || 0.5
  }
  
  // Track changes
  const changes: RuleChange[] = []
  
  if (currentRules) {
    if (Math.abs(proposedRules.qualityWeight! - currentRules.qualityWeight) > 0.02) {
      changes.push({
        parameter: 'qualityWeight',
        oldValue: currentRules.qualityWeight,
        newValue: proposedRules.qualityWeight!,
        reason: 'Adjusted based on feature importance in winning trades'
      })
    }
    
    if (Math.abs(proposedRules.volumeWeight! - currentRules.volumeWeight) > 0.02) {
      changes.push({
        parameter: 'volumeWeight',
        oldValue: currentRules.volumeWeight,
        newValue: proposedRules.volumeWeight!,
        reason: 'Adjusted based on volume correlation with outcomes'
      })
    }
    
    if (proposedRules.minQuality !== currentRules.minQuality) {
      changes.push({
        parameter: 'minQuality',
        oldValue: currentRules.minQuality,
        newValue: proposedRules.minQuality!,
        reason: 'Adjusted to filter low-quality losing trades'
      })
    }
  }
  
  // Run backtest on proposed rules
  const backtestResults = await backtestRules(proposedRules)
  
  // Calculate expected improvement
  const currentWinRate = currentRules?.winRate || 0.5
  const expectedImprovement = backtestResults.winRate - currentWinRate
  
  console.log(`[Learning] Optimization complete. Expected improvement: ${(expectedImprovement * 100).toFixed(1)}%`)
  
  return {
    currentRules: currentRules || {},
    proposedRules,
    changes,
    expectedImprovement,
    backtestResults
  }
}

/**
 * Creates a new rule version
 * Requirement 7.6
 */
export async function createRuleVersion(
  rules: Partial<TradingRules>,
  backtestResults?: BacktestResults
): Promise<TradingRules> {
  // Generate version number
  const latestRule = await prisma.tradingRules.findFirst({
    orderBy: { createdAt: 'desc' }
  })
  
  const versionNum = latestRule
    ? parseInt(latestRule.version.replace('v', '').split('.')[0]) + 1
    : 1
  const version = `v${versionNum}.0.0`
  
  // Deactivate current active rules
  await prisma.tradingRules.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  })
  
  // Create new rule version
  const newRules = await prisma.tradingRules.create({
    data: {
      version,
      isActive: true,
      qualityWeight: rules.qualityWeight || 0.25,
      volumeWeight: rules.volumeWeight || 0.20,
      oscillatorWeight: rules.oscillatorWeight || 0.20,
      structureWeight: rules.structureWeight || 0.20,
      marketWeight: rules.marketWeight || 0.15,
      minQuality: rules.minQuality || 4,
      minConfidence: rules.minConfidence || 0.65,
      minVolumePressure: rules.minVolumePressure || 60,
      maxRiskPercent: rules.maxRiskPercent || 2.0,
      compressionMultiplier: rules.compressionMultiplier || 0.5,
      baseSizePerQuality: { 1: 0, 2: 0, 3: 50, 4: 100, 5: 150 },
      allowedTimeframes: [5, 15, 30, 60],
      tradingHours: { start: '09:30', end: '16:00' },
      learningData: { optimizedAt: new Date().toISOString() },
      backtestResults: backtestResults as any,
      winRate: backtestResults?.winRate,
      avgReturn: backtestResults?.avgReturn,
      sharpeRatio: backtestResults?.sharpeRatio
    }
  })
  
  console.log(`[Learning] Created new rule version ${version}`)
  
  return newRules
}

/**
 * Gets rule version history
 */
export async function getRuleHistory(): Promise<TradingRules[]> {
  return prisma.tradingRules.findMany({
    orderBy: { createdAt: 'desc' }
  })
}
