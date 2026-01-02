/**
 * Trade Analysis Engine
 * 
 * Analyzes completed trades to calculate win/loss outcomes,
 * feature importance, and generate insights for optimization.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { prisma } from '@/lib/prisma'
import type { Trade, Signal, Decision } from '@prisma/client'

export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN'

export interface FeatureImportance {
  signalQuality: number
  volumePressure: number
  oscillatorPhase: number
  marketCondition: number
  structureAlignment: number
  timeOfDay: number
}

export interface TradingInsight {
  category: 'STRENGTH' | 'WEAKNESS' | 'OPPORTUNITY' | 'PATTERN'
  title: string
  description: string
  confidence: number
  actionable: boolean
  suggestedAction?: string
}

export interface ImprovementSuggestion {
  area: string
  currentValue: number
  suggestedValue: number
  expectedImpact: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface TradeAnalysisResult {
  tradeId: string
  outcome: TradeOutcome
  vsExpectation: number
  featureImportance: FeatureImportance
  insights: TradingInsight[]
  improvements: ImprovementSuggestion[]
}

interface TradeWithRelations extends Trade {
  signal: Signal
}

/**
 * Determines trade outcome
 * Requirement 6.1
 */
function determineOutcome(trade: Trade): TradeOutcome {
  if (!trade.pnl) return 'BREAKEVEN'
  
  const pnlPercent = trade.pnlPercent || 0
  
  if (pnlPercent > 0.5) return 'WIN'
  if (pnlPercent < -0.5) return 'LOSS'
  return 'BREAKEVEN'
}

/**
 * Calculates vs expectation metric
 * Requirement 6.2
 */
function calculateVsExpectation(trade: Trade, decision: Decision | null): number {
  if (!decision || !trade.pnl) return 0
  
  const expectedReturn = decision.expectedReturn || 0
  const actualReturn = trade.pnl
  
  if (expectedReturn === 0) return 0
  
  return (actualReturn - expectedReturn) / Math.abs(expectedReturn)
}

/**
 * Calculates feature importance based on trade outcome
 * Requirement 6.3
 */
function calculateFeatureImportance(
  trade: TradeWithRelations,
  decision: Decision | null,
  outcome: TradeOutcome
): FeatureImportance {
  const signal = trade.signal
  const isWin = outcome === 'WIN'
  
  // Base importance scores (0-1)
  // Higher scores for features that correlated with the outcome
  
  // Signal quality importance
  const qualityScore = signal.quality / 5
  const signalQuality = isWin 
    ? qualityScore * 1.2  // Quality mattered for win
    : qualityScore * 0.8  // Quality didn't prevent loss
  
  // Volume pressure importance
  const volumeScore = (signal.buyPercent - signal.sellPercent + 100) / 200
  const volumePressure = isWin
    ? volumeScore * 1.1
    : volumeScore * 0.9
  
  // Oscillator phase importance
  const oscillatorScore = (signal.oscillatorValue + 1) / 2
  const oscillatorPhase = isWin
    ? oscillatorScore * 1.15
    : oscillatorScore * 0.85
  
  // Market condition (from structure alignment)
  const trendScore = signal.trend === 'BULLISH' ? 0.8 : signal.trend === 'BEARISH' ? 0.2 : 0.5
  const marketCondition = isWin
    ? trendScore * 1.1
    : trendScore * 0.9
  
  // Structure alignment
  const vwapScore = signal.vwapPosition === 'ABOVE' ? 0.7 : 0.3
  const structureAlignment = isWin
    ? vwapScore * 1.1
    : vwapScore * 0.9
  
  // Time of day (based on entry time)
  const entryHour = new Date(trade.enteredAt).getHours()
  const timeScore = (entryHour >= 10 && entryHour <= 15) ? 0.8 : 0.5
  const timeOfDay = isWin
    ? timeScore * 1.1
    : timeScore * 0.9
  
  return {
    signalQuality: Math.min(1, Math.max(0, signalQuality)),
    volumePressure: Math.min(1, Math.max(0, volumePressure)),
    oscillatorPhase: Math.min(1, Math.max(0, oscillatorPhase)),
    marketCondition: Math.min(1, Math.max(0, marketCondition)),
    structureAlignment: Math.min(1, Math.max(0, structureAlignment)),
    timeOfDay: Math.min(1, Math.max(0, timeOfDay))
  }
}

/**
 * Generates insights from trade analysis
 * Requirement 6.4
 */
function generateInsights(
  trade: TradeWithRelations,
  outcome: TradeOutcome,
  featureImportance: FeatureImportance
): TradingInsight[] {
  const insights: TradingInsight[] = []
  const signal = trade.signal
  
  // Quality-based insights
  if (outcome === 'WIN' && signal.quality >= 4) {
    insights.push({
      category: 'STRENGTH',
      title: 'High Quality Signal Success',
      description: `Quality ${signal.quality} signal resulted in profitable trade`,
      confidence: 0.8,
      actionable: true,
      suggestedAction: 'Continue prioritizing high quality signals'
    })
  }
  
  if (outcome === 'LOSS' && signal.quality >= 4) {
    insights.push({
      category: 'PATTERN',
      title: 'High Quality Signal Loss',
      description: `Quality ${signal.quality} signal resulted in loss - review market conditions`,
      confidence: 0.7,
      actionable: true,
      suggestedAction: 'Add additional filters for market regime'
    })
  }
  
  // Volume-based insights
  if (outcome === 'WIN' && signal.buyPercent > 70) {
    insights.push({
      category: 'STRENGTH',
      title: 'Strong Volume Confirmation',
      description: `${signal.buyPercent.toFixed(0)}% buy pressure confirmed the move`,
      confidence: 0.75,
      actionable: false
    })
  }
  
  if (outcome === 'LOSS' && signal.buyPercent < 55) {
    insights.push({
      category: 'WEAKNESS',
      title: 'Weak Volume Support',
      description: `Only ${signal.buyPercent.toFixed(0)}% buy pressure - insufficient conviction`,
      confidence: 0.7,
      actionable: true,
      suggestedAction: 'Increase minimum volume pressure threshold'
    })
  }
  
  // Oscillator insights
  if (signal.compression && outcome === 'LOSS') {
    insights.push({
      category: 'PATTERN',
      title: 'Compression Phase Loss',
      description: 'Trade during compression phase resulted in loss',
      confidence: 0.65,
      actionable: true,
      suggestedAction: 'Reduce position size further during compression'
    })
  }
  
  // R-multiple insights
  const rMultiple = trade.rMultiple || 0
  if (rMultiple >= 2) {
    insights.push({
      category: 'STRENGTH',
      title: 'Excellent Risk/Reward',
      description: `Achieved ${rMultiple.toFixed(1)}R return`,
      confidence: 0.9,
      actionable: false
    })
  }
  
  if (rMultiple <= -1) {
    insights.push({
      category: 'WEAKNESS',
      title: 'Full Stop Loss Hit',
      description: 'Position hit full stop loss',
      confidence: 0.85,
      actionable: true,
      suggestedAction: 'Review stop loss placement strategy'
    })
  }
  
  // Holding period insights
  const holdingPeriod = trade.holdingPeriod || 0
  if (outcome === 'WIN' && holdingPeriod < 30) {
    insights.push({
      category: 'OPPORTUNITY',
      title: 'Quick Win',
      description: `Profitable exit in ${holdingPeriod} minutes`,
      confidence: 0.7,
      actionable: true,
      suggestedAction: 'Consider scaling out partial position early'
    })
  }
  
  return insights
}

/**
 * Generates improvement suggestions
 * Requirement 6.5
 */
function generateImprovements(
  trade: TradeWithRelations,
  outcome: TradeOutcome,
  featureImportance: FeatureImportance
): ImprovementSuggestion[] {
  const improvements: ImprovementSuggestion[] = []
  const signal = trade.signal
  
  if (outcome === 'LOSS') {
    // Quality threshold suggestion
    if (signal.quality < 4) {
      improvements.push({
        area: 'Minimum Quality',
        currentValue: 3,
        suggestedValue: 4,
        expectedImpact: 'Filter out lower quality signals',
        priority: 'HIGH'
      })
    }
    
    // Volume pressure suggestion
    if (signal.buyPercent < 60) {
      improvements.push({
        area: 'Volume Pressure Threshold',
        currentValue: 50,
        suggestedValue: 65,
        expectedImpact: 'Require stronger volume confirmation',
        priority: 'MEDIUM'
      })
    }
    
    // Compression multiplier suggestion
    if (signal.compression) {
      improvements.push({
        area: 'Compression Multiplier',
        currentValue: 0.5,
        suggestedValue: 0.3,
        expectedImpact: 'Further reduce size during compression',
        priority: 'MEDIUM'
      })
    }
  }
  
  if (outcome === 'WIN') {
    // Position size suggestion for winners
    if (signal.quality === 5 && featureImportance.signalQuality > 0.8) {
      improvements.push({
        area: 'Quality 5 Position Size',
        currentValue: 150,
        suggestedValue: 175,
        expectedImpact: 'Increase allocation to highest quality signals',
        priority: 'LOW'
      })
    }
  }
  
  return improvements
}

/**
 * Analyzes a completed trade
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export async function analyzeCompletedTrade(tradeId: string): Promise<TradeAnalysisResult> {
  // Get trade with signal
  const trade = await prisma.trade.findFirst({
    where: { tradeId },
    include: { signal: true }
  }) as TradeWithRelations | null
  
  if (!trade) {
    throw new Error(`Trade ${tradeId} not found`)
  }
  
  if (trade.status !== 'CLOSED') {
    throw new Error(`Trade ${tradeId} is not closed`)
  }
  
  // Get decision for this signal
  const decision = await prisma.decision.findUnique({
    where: { signalId: trade.signalId }
  })
  
  // Calculate analysis components
  const outcome = determineOutcome(trade)
  const vsExpectation = calculateVsExpectation(trade, decision)
  const featureImportance = calculateFeatureImportance(trade, decision, outcome)
  const insights = generateInsights(trade, outcome, featureImportance)
  const improvements = generateImprovements(trade, outcome, featureImportance)
  
  // Store analysis in database
  await prisma.tradeAnalysis.create({
    data: {
      tradeId: trade.id,
      outcome,
      vsExpectation,
      signalQuality: featureImportance.signalQuality,
      volumePressure: featureImportance.volumePressure,
      oscillatorPhase: featureImportance.oscillatorPhase,
      marketCondition: featureImportance.marketCondition,
      insights: insights as any,
      improvements: improvements as any
    }
  })
  
  console.log(`[Analysis] Analyzed trade ${tradeId}: ${outcome}`)
  
  return {
    tradeId,
    outcome,
    vsExpectation,
    featureImportance,
    insights,
    improvements
  }
}

/**
 * Analyzes all unanalyzed closed trades
 */
export async function analyzeAllClosedTrades(): Promise<TradeAnalysisResult[]> {
  // Get closed trades without analysis
  const closedTrades = await prisma.trade.findMany({
    where: {
      status: 'CLOSED',
      analysis: null
    },
    include: { signal: true }
  })
  
  const results: TradeAnalysisResult[] = []
  
  for (const trade of closedTrades) {
    try {
      const result = await analyzeCompletedTrade(trade.tradeId)
      results.push(result)
    } catch (error) {
      console.error(`[Analysis] Error analyzing trade ${trade.tradeId}:`, error)
    }
  }
  
  return results
}

/**
 * Gets aggregated analysis statistics
 */
export async function getAnalysisStatistics(): Promise<{
  totalTrades: number
  wins: number
  losses: number
  breakeven: number
  winRate: number
  avgRMultiple: number
  avgFeatureImportance: FeatureImportance
}> {
  const analyses = await prisma.tradeAnalysis.findMany()
  
  if (analyses.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      winRate: 0,
      avgRMultiple: 0,
      avgFeatureImportance: {
        signalQuality: 0,
        volumePressure: 0,
        oscillatorPhase: 0,
        marketCondition: 0,
        structureAlignment: 0,
        timeOfDay: 0
      }
    }
  }
  
  const wins = analyses.filter(a => a.outcome === 'WIN').length
  const losses = analyses.filter(a => a.outcome === 'LOSS').length
  const breakeven = analyses.filter(a => a.outcome === 'BREAKEVEN').length
  
  // Get trades for R-multiple calculation
  const trades = await prisma.trade.findMany({
    where: { status: 'CLOSED' }
  })
  
  const avgRMultiple = trades.length > 0
    ? trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / trades.length
    : 0
  
  // Calculate average feature importance
  const avgFeatureImportance: FeatureImportance = {
    signalQuality: analyses.reduce((sum, a) => sum + a.signalQuality, 0) / analyses.length,
    volumePressure: analyses.reduce((sum, a) => sum + a.volumePressure, 0) / analyses.length,
    oscillatorPhase: analyses.reduce((sum, a) => sum + a.oscillatorPhase, 0) / analyses.length,
    marketCondition: analyses.reduce((sum, a) => sum + a.marketCondition, 0) / analyses.length,
    structureAlignment: 0.5, // Not stored in DB, use default
    timeOfDay: 0.5 // Not stored in DB, use default
  }
  
  return {
    totalTrades: analyses.length,
    wins,
    losses,
    breakeven,
    winRate: wins / analyses.length,
    avgRMultiple,
    avgFeatureImportance
  }
}
