/**
 * Intelligent Decision Engine
 * 
 * Evaluates signals using weighted factor analysis and configurable trading rules.
 * Implements decision factors, filters, instrument selection, and position sizing.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { prisma } from '@/lib/prisma'
import type { Signal, TradingRules, EnrichedData } from '@prisma/client'
import type { AggregatedInsights } from '@/lib/data-enrichment'

// Decision types
export type DecisionOutcome = 'TRADE' | 'REJECT' | 'WAIT'
export type InstrumentType = 'STOCK' | 'CALL' | 'PUT' | 'CALL_SPREAD' | 'PUT_SPREAD'

export interface DecisionFactors {
  signalQuality: number      // 1-5 from webhook
  volumePressure: number     // 0-100 calculated from buy/sell percent
  oscillatorPhase: number    // -150 to +150 from webhook
  structureAlignment: number // 0-1 calculated
  priceConfirmation: number  // 0-1 from API consistency
  volumeConfirmation: number // 0-1 from API data
  technicalConfirmation: number // 0-1 from indicators
  optionsActivity: number    // 0-1 from options flow
  spreadQuality: number      // 0-1 from bid/ask spreads
  marketRegime: string       // BULL/BEAR/NEUTRAL/VOLATILE
  accountRisk: number        // Current exposure percentage
  timeOfDay: number          // 0-1 trading session factor
}

export interface DecisionReasoning {
  summary: string
  factors: {
    name: string
    value: number
    weight: number
    contribution: number
    assessment: string
  }[]
  filters: {
    name: string
    passed: boolean
    reason: string
  }[]
  finalScore: number
  threshold: number
}

export interface StrikeSelection {
  callStrike?: number
  putStrike?: number
  spreadWidth?: number
}

export interface Decision {
  decision: DecisionOutcome
  confidence: number
  reasoning: DecisionReasoning
  instrumentType?: InstrumentType
  strikes?: StrikeSelection
  expiration?: Date
  quantity?: number
  positionSize?: number
  riskAmount?: number
  expectedReturn?: number
  riskRewardRatio?: number
  winProbability?: number
  modelVersion: string
  weights: Record<string, number>
}

// Default trading rules
const DEFAULT_RULES: Partial<TradingRules> = {
  qualityWeight: 0.25,
  volumeWeight: 0.20,
  oscillatorWeight: 0.20,
  structureWeight: 0.20,
  marketWeight: 0.15,
  minQuality: 4,
  minConfidence: 0.65,
  minVolumePressure: 60.0,
  maxRiskPercent: 2.0,
  compressionMultiplier: 0.5
}

/**
 * Calculates volume pressure from buy/sell percentages
 */
function calculateVolumePressure(buyPercent: number, sellPercent: number, buyersWinning: boolean): number {
  const netPressure = buyPercent - sellPercent
  const base = 50 + (netPressure / 2)
  return buyersWinning ? Math.min(100, base + 10) : Math.max(0, base - 10)
}

/**
 * Calculates structure alignment score
 */
function calculateStructureAlignment(
  signal: Signal,
  aggregated: AggregatedInsights | null
): number {
  let score = 0
  let factors = 0

  // Trend alignment with action
  factors++
  const isLong = signal.action.includes('LONG')
  if ((isLong && signal.trend === 'BULLISH') || (!isLong && signal.trend === 'BEARISH')) {
    score += 1
  } else if (signal.trend === 'NEUTRAL') {
    score += 0.5
  }

  // VWAP position alignment
  factors++
  if ((isLong && signal.vwapPosition === 'ABOVE') || (!isLong && signal.vwapPosition === 'BELOW')) {
    score += 1
  } else {
    score += 0.3
  }

  // ATR level
  factors++
  if (signal.atAtrLevel) {
    score += 1
  } else {
    score += 0.5
  }

  return factors > 0 ? score / factors : 0.5
}

/**
 * Calculates price confirmation from enriched data
 */
function calculatePriceConfirmation(aggregated: AggregatedInsights | null): number {
  if (!aggregated) return 0.5

  // Lower price deviation = higher confirmation
  const deviationPenalty = Math.min(1, aggregated.priceDeviationPercent * 10)
  return Math.max(0, 1 - deviationPenalty)
}

/**
 * Calculates spread quality score
 */
function calculateSpreadQuality(aggregated: AggregatedInsights | null): number {
  if (!aggregated) return 0.5

  // Lower spread = higher quality
  const spreadPenalty = Math.min(1, aggregated.spreadPercent * 20)
  return Math.max(0, 1 - spreadPenalty)
}

/**
 * Determines market regime from technical indicators
 */
function determineMarketRegime(aggregated: AggregatedInsights | null): string {
  if (!aggregated) return 'NEUTRAL'

  const { trendStrength, rsiSignal } = aggregated

  if (trendStrength > 40) {
    if (rsiSignal === 'OVERBOUGHT') return 'BULL'
    if (rsiSignal === 'OVERSOLD') return 'BEAR'
    return trendStrength > 50 ? 'BULL' : 'BEAR'
  }

  if (trendStrength < 20) return 'NEUTRAL'
  
  return 'VOLATILE'
}

/**
 * Calculates time of day factor (0-1)
 * Higher during optimal trading hours
 */
function calculateTimeOfDayFactor(): number {
  const now = new Date()
  const hour = now.getUTCHours() - 5 // Convert to EST
  const minute = now.getUTCMinutes()
  const timeDecimal = hour + minute / 60

  // Market hours: 9:30 AM - 4:00 PM EST
  if (timeDecimal < 9.5 || timeDecimal > 16) return 0

  // First 30 minutes (9:30-10:00): reduced factor
  if (timeDecimal < 10) return 0.6

  // Last 30 minutes (3:30-4:00): reduced factor
  if (timeDecimal > 15.5) return 0.7

  // Power hour (2:00-3:00): increased factor
  if (timeDecimal >= 14 && timeDecimal <= 15) return 1.0

  // Normal hours
  return 0.85
}

/**
 * Calculates all decision factors
 */
export function calculateFactors(
  signal: Signal,
  enrichedData: EnrichedData | null
): DecisionFactors {
  const aggregated = enrichedData?.aggregatedData as AggregatedInsights | null

  return {
    signalQuality: signal.quality,
    volumePressure: calculateVolumePressure(signal.buyPercent, signal.sellPercent, signal.buyersWinning),
    oscillatorPhase: signal.oscillatorValue * 150, // Scale to -150 to +150
    structureAlignment: calculateStructureAlignment(signal, aggregated),
    priceConfirmation: calculatePriceConfirmation(aggregated),
    volumeConfirmation: aggregated?.volumeConfirmation || 0.5,
    technicalConfirmation: aggregated?.technicalConfirmation || 0.5,
    optionsActivity: aggregated?.optionsActivity || 0.5,
    spreadQuality: calculateSpreadQuality(aggregated),
    marketRegime: determineMarketRegime(aggregated),
    accountRisk: 0, // TODO: Calculate from open positions
    timeOfDay: calculateTimeOfDayFactor()
  }
}

/**
 * Applies weights to factors and calculates final score
 */
export function applyWeights(
  factors: DecisionFactors,
  rules: Partial<TradingRules>
): { score: number; contributions: Record<string, number> } {
  const weights = {
    quality: rules.qualityWeight || DEFAULT_RULES.qualityWeight!,
    volume: rules.volumeWeight || DEFAULT_RULES.volumeWeight!,
    oscillator: rules.oscillatorWeight || DEFAULT_RULES.oscillatorWeight!,
    structure: rules.structureWeight || DEFAULT_RULES.structureWeight!,
    market: rules.marketWeight || DEFAULT_RULES.marketWeight!
  }

  // Normalize quality to 0-1 scale
  const normalizedQuality = (factors.signalQuality - 1) / 4

  // Normalize volume pressure to 0-1 scale
  const normalizedVolume = factors.volumePressure / 100

  // Normalize oscillator to 0-1 scale (centered at 0.5)
  const normalizedOscillator = (factors.oscillatorPhase + 150) / 300

  // Calculate weighted contributions
  const contributions = {
    quality: normalizedQuality * weights.quality,
    volume: normalizedVolume * weights.volume,
    oscillator: normalizedOscillator * weights.oscillator,
    structure: factors.structureAlignment * weights.structure,
    market: factors.technicalConfirmation * weights.market
  }

  // Apply modifiers
  const priceModifier = factors.priceConfirmation
  const spreadModifier = factors.spreadQuality
  const timeModifier = factors.timeOfDay

  const baseScore = Object.values(contributions).reduce((a, b) => a + b, 0)
  const modifiedScore = baseScore * priceModifier * spreadModifier * timeModifier

  return { score: Math.min(1, modifiedScore), contributions }
}

/**
 * Checks all filters and returns results
 */
export function checkFilters(
  signal: Signal,
  factors: DecisionFactors,
  rules: Partial<TradingRules>
): { passed: boolean; results: DecisionReasoning['filters'] } {
  const results: DecisionReasoning['filters'] = []
  const minQuality = rules.minQuality || DEFAULT_RULES.minQuality!
  const minVolumePressure = rules.minVolumePressure || DEFAULT_RULES.minVolumePressure!
  const maxRiskPercent = rules.maxRiskPercent || DEFAULT_RULES.maxRiskPercent!

  // Quality filter
  const qualityPassed = signal.quality >= minQuality
  results.push({
    name: 'Quality Threshold',
    passed: qualityPassed,
    reason: qualityPassed 
      ? `Quality ${signal.quality} meets minimum ${minQuality}`
      : `Quality ${signal.quality} below minimum ${minQuality}`
  })

  // Volume pressure filter
  const volumePassed = factors.volumePressure >= minVolumePressure
  results.push({
    name: 'Volume Pressure',
    passed: volumePassed,
    reason: volumePassed
      ? `Volume pressure ${factors.volumePressure.toFixed(1)}% meets minimum ${minVolumePressure}%`
      : `Volume pressure ${factors.volumePressure.toFixed(1)}% below minimum ${minVolumePressure}%`
  })

  // Risk limit filter
  const riskPassed = factors.accountRisk < maxRiskPercent
  results.push({
    name: 'Risk Limit',
    passed: riskPassed,
    reason: riskPassed
      ? `Account risk ${factors.accountRisk.toFixed(1)}% within limit ${maxRiskPercent}%`
      : `Account risk ${factors.accountRisk.toFixed(1)}% exceeds limit ${maxRiskPercent}%`
  })

  // Trading hours filter
  const hoursPassed = factors.timeOfDay > 0
  results.push({
    name: 'Trading Hours',
    passed: hoursPassed,
    reason: hoursPassed
      ? 'Within trading hours'
      : 'Outside trading hours'
  })

  const allPassed = results.every(r => r.passed)
  return { passed: allPassed, results }
}

/**
 * Determines instrument type based on signal and market conditions
 * Requirement 3.3
 */
export function determineInstrument(
  signal: Signal,
  factors: DecisionFactors,
  aggregated: AggregatedInsights | null
): InstrumentType {
  const isLong = signal.action.includes('LONG')
  const isPremium = signal.action.includes('PREMIUM')

  // Premium signals prefer options
  if (isPremium) {
    // High IV rank suggests spreads
    if (aggregated?.ivRank && aggregated.ivRank > 50) {
      return isLong ? 'CALL_SPREAD' : 'PUT_SPREAD'
    }
    return isLong ? 'CALL' : 'PUT'
  }

  // High quality signals with good volume can use stock
  if (signal.quality >= 4 && factors.volumePressure > 70) {
    return 'STOCK'
  }

  // Default to options for leverage
  return isLong ? 'CALL' : 'PUT'
}

/**
 * Calculates position size based on quality and confidence
 * Requirements 3.4, 3.6
 */
export function calculatePositionSize(
  signal: Signal,
  factors: DecisionFactors,
  confidence: number,
  rules: Partial<TradingRules>
): number {
  // Base size per quality level
  const baseSizes: Record<number, number> = {
    1: 0,
    2: 0,
    3: 50,
    4: 100,
    5: 150
  }

  let baseSize = baseSizes[signal.quality] || 0

  // Compression phase adjustment (Requirement 3.4)
  if (signal.compression) {
    const multiplier = rules.compressionMultiplier || DEFAULT_RULES.compressionMultiplier!
    baseSize *= multiplier
    console.log(`[Decision] Compression detected, reducing size by ${(1 - multiplier) * 100}%`)
  }

  // Oscillator phase adjustments (Requirement 3.6)
  if (signal.leavingAccumulation || signal.leavingExtremeDown) {
    baseSize *= 1.25 // Increase for bullish phase transitions
  } else if (signal.leavingDistribution || signal.leavingExtremeUp) {
    baseSize *= 1.25 // Increase for bearish phase transitions
  }

  // Confidence adjustment
  baseSize *= confidence

  // Volume pressure bonus
  if (factors.volumePressure > 80) {
    baseSize *= 1.1
  }

  return Math.round(baseSize)
}

/**
 * Main decision function
 * Requirement 3.1, 3.2, 3.5
 */
export async function makeDecision(
  signal: Signal,
  enrichedData: EnrichedData | null,
  rules: Partial<TradingRules> | null
): Promise<Decision> {
  const effectiveRules = { ...DEFAULT_RULES, ...rules }
  const aggregated = enrichedData?.aggregatedData as AggregatedInsights | null

  // Calculate all factors
  const factors = calculateFactors(signal, enrichedData)

  // Apply weights and get score
  const { score, contributions } = applyWeights(factors, effectiveRules)

  // Check filters
  const { passed: filtersPassed, results: filterResults } = checkFilters(signal, factors, effectiveRules)

  // Determine confidence threshold
  const minConfidence = effectiveRules.minConfidence || DEFAULT_RULES.minConfidence!

  // Build factor assessments for reasoning
  const factorAssessments = [
    {
      name: 'Signal Quality',
      value: factors.signalQuality,
      weight: effectiveRules.qualityWeight!,
      contribution: contributions.quality,
      assessment: factors.signalQuality >= 4 ? 'Strong' : factors.signalQuality >= 3 ? 'Moderate' : 'Weak'
    },
    {
      name: 'Volume Pressure',
      value: factors.volumePressure,
      weight: effectiveRules.volumeWeight!,
      contribution: contributions.volume,
      assessment: factors.volumePressure >= 70 ? 'Strong buying' : factors.volumePressure >= 50 ? 'Neutral' : 'Selling pressure'
    },
    {
      name: 'Oscillator Phase',
      value: factors.oscillatorPhase,
      weight: effectiveRules.oscillatorWeight!,
      contribution: contributions.oscillator,
      assessment: factors.oscillatorPhase > 50 ? 'Bullish' : factors.oscillatorPhase < -50 ? 'Bearish' : 'Neutral'
    },
    {
      name: 'Structure Alignment',
      value: factors.structureAlignment,
      weight: effectiveRules.structureWeight!,
      contribution: contributions.structure,
      assessment: factors.structureAlignment > 0.7 ? 'Well aligned' : factors.structureAlignment > 0.4 ? 'Partial' : 'Misaligned'
    },
    {
      name: 'Technical Confirmation',
      value: factors.technicalConfirmation,
      weight: effectiveRules.marketWeight!,
      contribution: contributions.market,
      assessment: factors.technicalConfirmation > 0.7 ? 'Confirmed' : factors.technicalConfirmation > 0.4 ? 'Mixed' : 'Divergent'
    }
  ]

  // Determine decision outcome
  let decision: DecisionOutcome
  let summary: string

  if (!filtersPassed) {
    decision = 'REJECT'
    summary = `Signal rejected: Failed filter checks`
  } else if (score >= minConfidence) {
    decision = 'TRADE'
    summary = `Signal approved with ${(score * 100).toFixed(1)}% confidence`
  } else if (score >= minConfidence * 0.8) {
    decision = 'WAIT'
    summary = `Signal borderline (${(score * 100).toFixed(1)}%), waiting for better conditions`
  } else {
    decision = 'REJECT'
    summary = `Signal rejected: Confidence ${(score * 100).toFixed(1)}% below threshold ${(minConfidence * 100).toFixed(1)}%`
  }

  // Build reasoning
  const reasoning: DecisionReasoning = {
    summary,
    factors: factorAssessments,
    filters: filterResults,
    finalScore: score,
    threshold: minConfidence
  }

  // Build weights record
  const weights: Record<string, number> = {
    quality: effectiveRules.qualityWeight!,
    volume: effectiveRules.volumeWeight!,
    oscillator: effectiveRules.oscillatorWeight!,
    structure: effectiveRules.structureWeight!,
    market: effectiveRules.marketWeight!
  }

  // If trading, calculate additional parameters
  if (decision === 'TRADE') {
    const instrumentType = determineInstrument(signal, factors, aggregated)
    const positionSize = calculatePositionSize(signal, factors, score, effectiveRules)
    const riskAmount = positionSize * 0.02 // 2% risk per trade
    const expectedReturn = riskAmount * 2 // 2:1 R:R target

    return {
      decision,
      confidence: score,
      reasoning,
      instrumentType,
      positionSize,
      riskAmount,
      expectedReturn,
      riskRewardRatio: 2.0,
      winProbability: score,
      modelVersion: effectiveRules.version || 'v1.0.0',
      weights
    }
  }

  return {
    decision,
    confidence: score,
    reasoning,
    modelVersion: effectiveRules.version || 'v1.0.0',
    weights
  }
}

/**
 * Stores decision in database
 */
export async function storeDecision(
  signalId: string,
  decision: Decision
): Promise<void> {
  await prisma.decision.create({
    data: {
      signalId,
      decision: decision.decision,
      confidence: decision.confidence,
      reasoning: decision.reasoning as any,
      instrumentType: decision.instrumentType,
      quantity: decision.quantity,
      positionSize: decision.positionSize,
      riskAmount: decision.riskAmount,
      expectedReturn: decision.expectedReturn,
      riskRewardRatio: decision.riskRewardRatio,
      winProbability: decision.winProbability,
      modelVersion: decision.modelVersion,
      weights: decision.weights as any
    }
  })

  // Update signal status based on decision
  const newStatus = decision.decision === 'TRADE' ? 'traded' : 'rejected'
  await prisma.signal.update({
    where: { id: signalId },
    data: { status: newStatus }
  })

  console.log(`[Decision] Stored decision for signal ${signalId}: ${decision.decision}`)
}

/**
 * Gets active trading rules from database
 */
export async function getActiveTradingRules(): Promise<TradingRules | null> {
  return prisma.tradingRules.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' }
  })
}
