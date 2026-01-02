/**
 * Data Enrichment Engine
 * 
 * Fetches and aggregates real-time market data from multiple broker APIs.
 * Implements parallel fetching, price consistency validation, and data quality scoring.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { prisma } from '@/lib/prisma'
import { fetchTradierData, TradierData } from '@/lib/api-clients/tradier'
import { fetchTwelveData, TwelveDataResult } from '@/lib/api-clients/twelvedata'
import { fetchAlpacaData, AlpacaData } from '@/lib/api-clients/alpaca'

export interface AggregatedInsights {
  // Price data
  medianPrice: number
  priceDeviation: number
  priceDeviationPercent: number
  bidAskSpread: number
  spreadPercent: number
  
  // Volume analysis
  volumeConfirmation: number // 0-1 score
  volumeProfile: 'HIGH' | 'NORMAL' | 'LOW'
  
  // Technical confirmation
  technicalConfirmation: number // 0-1 score
  rsiSignal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL'
  trendStrength: number // 0-100 from ADX
  
  // Options data
  optionsActivity: number // 0-1 score
  ivRank: number | null
  atmDelta: number | null
  
  // Market context
  vwap: number | null
  dayRange: { high: number; low: number } | null
  prevClose: number | null
}

export interface EnrichmentResult {
  signalId: string
  tradierData: TradierData
  twelveData: TwelveDataResult
  alpacaData: AlpacaData
  aggregatedData: AggregatedInsights
  dataQuality: number
  enrichedAt: number
  warnings: string[]
}

const PRICE_DEVIATION_THRESHOLD = 0.005 // 0.5%
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      console.warn(`[Enrichment] Retry ${i + 1}/${retries} failed:`, lastError.message)
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, i)))
      }
    }
  }
  
  throw lastError
}

/**
 * Extracts price from each data source
 */
function extractPrices(
  tradier: TradierData,
  twelve: TwelveDataResult,
  alpaca: AlpacaData
): number[] {
  const prices: number[] = []
  
  if (tradier.quote?.last) prices.push(tradier.quote.last)
  if (twelve.quote?.close) prices.push(twelve.quote.close)
  if (alpaca.snapshot?.latestTrade?.price) prices.push(alpaca.snapshot.latestTrade.price)
  
  return prices
}

/**
 * Calculates median of an array of numbers
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Calculates price deviation across sources
 */
function calculatePriceDeviation(prices: number[]): { deviation: number; percent: number } {
  if (prices.length < 2) return { deviation: 0, percent: 0 }
  
  const median = calculateMedian(prices)
  const maxDeviation = Math.max(...prices.map(p => Math.abs(p - median)))
  const deviationPercent = median > 0 ? maxDeviation / median : 0
  
  return {
    deviation: maxDeviation,
    percent: deviationPercent
  }
}

/**
 * Calculates data quality score (0-1)
 */
function calculateDataQuality(
  tradier: TradierData,
  twelve: TwelveDataResult,
  alpaca: AlpacaData
): number {
  let score = 0
  let maxScore = 0
  
  // Tradier data quality
  maxScore += 3
  if (tradier.quote) score += 1
  if (tradier.options_chain?.options.calls.length || tradier.options_chain?.options.puts.length) score += 1
  if (tradier.options_chain?.iv_rank !== undefined) score += 1
  
  // TwelveData quality
  maxScore += 4
  if (twelve.quote) score += 1
  if (twelve.technical.rsi !== null) score += 1
  if (twelve.technical.adx !== null) score += 1
  if (twelve.volume) score += 1
  
  // Alpaca data quality
  maxScore += 3
  if (alpaca.snapshot?.latestTrade) score += 1
  if (alpaca.snapshot?.latestQuote) score += 1
  if (alpaca.bars.length > 0) score += 1
  
  return maxScore > 0 ? score / maxScore : 0
}

/**
 * Calculates volume confirmation score
 */
function calculateVolumeConfirmation(
  twelve: TwelveDataResult,
  alpaca: AlpacaData
): number {
  let score = 0
  let factors = 0
  
  // TwelveData volume analysis
  if (twelve.volume) {
    factors++
    if (twelve.volume.volumeProfile === 'HIGH') score += 1
    else if (twelve.volume.volumeProfile === 'NORMAL') score += 0.5
  }
  
  // Alpaca volume from daily bar
  if (alpaca.snapshot?.dailyBar && alpaca.snapshot?.prevDailyBar) {
    factors++
    const volumeRatio = alpaca.snapshot.dailyBar.volume / alpaca.snapshot.prevDailyBar.volume
    if (volumeRatio > 1.5) score += 1
    else if (volumeRatio > 1) score += 0.5
  }
  
  return factors > 0 ? score / factors : 0.5
}

/**
 * Calculates technical confirmation score
 */
function calculateTechnicalConfirmation(twelve: TwelveDataResult): number {
  let score = 0
  let factors = 0
  
  // RSI confirmation
  if (twelve.technical.rsi !== null) {
    factors++
    const rsi = twelve.technical.rsi
    if (rsi >= 30 && rsi <= 70) score += 1 // Neutral zone is good
    else if (rsi > 70 || rsi < 30) score += 0.3 // Extreme zones
  }
  
  // ADX trend strength
  if (twelve.technical.adx !== null) {
    factors++
    const adx = twelve.technical.adx
    if (adx > 25) score += 1 // Strong trend
    else if (adx > 20) score += 0.5 // Moderate trend
  }
  
  // MACD confirmation
  if (twelve.technical.macd) {
    factors++
    if (twelve.technical.macd.histogram > 0) score += 0.5
    if (Math.abs(twelve.technical.macd.histogram) > Math.abs(twelve.technical.macd.signal) * 0.1) {
      score += 0.5 // Strong momentum
    }
  }
  
  return factors > 0 ? score / factors : 0.5
}

/**
 * Calculates options activity score
 */
function calculateOptionsActivity(tradier: TradierData): number {
  if (!tradier.options_chain?.options.calls.length && !tradier.options_chain?.options.puts.length) return 0.5
  
  let score = 0
  
  // IV rank contribution
  if (tradier.options_chain?.iv_rank !== undefined) {
    if (tradier.options_chain.iv_rank > 50) score += 0.3
    else score += 0.5 // Lower IV is generally better for buying
  }
  
  // Open interest and volume
  const allOptions = [
    ...(tradier.options_chain?.options.calls || []),
    ...(tradier.options_chain?.options.puts || [])
  ]
  const totalOI = allOptions.reduce((sum, opt) => sum + opt.open_interest, 0)
  const totalVolume = allOptions.reduce((sum, opt) => sum + opt.volume, 0)
  
  if (totalOI > 1000) score += 0.25
  if (totalVolume > 100) score += 0.25
  
  return Math.min(1, score)
}

/**
 * Determines RSI signal
 */
function getRSISignal(rsi: number | null): 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL' {
  if (rsi === null) return 'NEUTRAL'
  if (rsi > 70) return 'OVERBOUGHT'
  if (rsi < 30) return 'OVERSOLD'
  return 'NEUTRAL'
}

/**
 * Aggregates data from all sources
 */
function aggregateData(
  tradier: TradierData,
  twelve: TwelveDataResult,
  alpaca: AlpacaData
): { aggregated: AggregatedInsights; warnings: string[] } {
  const warnings: string[] = []
  
  // Extract and validate prices
  const prices = extractPrices(tradier, twelve, alpaca)
  const medianPrice = calculateMedian(prices)
  const { deviation, percent: deviationPercent } = calculatePriceDeviation(prices)
  
  // Log warning if price deviation exceeds threshold (Requirement 2.6)
  if (deviationPercent > PRICE_DEVIATION_THRESHOLD) {
    const warning = `Price deviation ${(deviationPercent * 100).toFixed(2)}% exceeds ${PRICE_DEVIATION_THRESHOLD * 100}% threshold. Using median price.`
    console.warn(`[Enrichment] ${warning}`)
    warnings.push(warning)
  }
  
  // Calculate bid-ask spread
  let bidAskSpread = 0
  let spreadPercent = 0
  if (tradier.quote) {
    bidAskSpread = tradier.quote.ask - tradier.quote.bid
    spreadPercent = tradier.quote.bid > 0 ? bidAskSpread / tradier.quote.bid : 0
  } else if (alpaca.snapshot?.latestQuote) {
    bidAskSpread = alpaca.snapshot.latestQuote.askPrice - alpaca.snapshot.latestQuote.bidPrice
    spreadPercent = alpaca.snapshot.latestQuote.bidPrice > 0 
      ? bidAskSpread / alpaca.snapshot.latestQuote.bidPrice 
      : 0
  }
  
  // Volume profile
  const volumeProfile = twelve.volume?.volumeProfile || 'NORMAL'
  
  // Day range
  let dayRange: { high: number; low: number } | null = null
  if (tradier.quote) {
    dayRange = { high: tradier.quote.high, low: tradier.quote.low }
  } else if (alpaca.snapshot?.dailyBar) {
    dayRange = { high: alpaca.snapshot.dailyBar.high, low: alpaca.snapshot.dailyBar.low }
  }
  
  // Previous close
  const prevClose = twelve.quote?.previous_close || alpaca.snapshot?.prevDailyBar?.close || null
  
  // VWAP
  const vwap = alpaca.snapshot?.dailyBar?.vwap || null

  const aggregated: AggregatedInsights = {
    medianPrice,
    priceDeviation: deviation,
    priceDeviationPercent: deviationPercent,
    bidAskSpread,
    spreadPercent,
    volumeConfirmation: calculateVolumeConfirmation(twelve, alpaca),
    volumeProfile,
    technicalConfirmation: calculateTechnicalConfirmation(twelve),
    rsiSignal: getRSISignal(twelve.technical.rsi),
    trendStrength: twelve.technical.adx || 0,
    optionsActivity: calculateOptionsActivity(tradier),
    ivRank: tradier.options_chain?.iv_rank || null,
    atmDelta: null, // Will be calculated from options chain if needed
    vwap,
    dayRange,
    prevClose
  }
  
  return { aggregated, warnings }
}

/**
 * Main enrichment function - fetches data from all sources and aggregates
 */
export async function enrichSignal(signalId: string, ticker: string): Promise<EnrichmentResult> {
  console.log(`[Enrichment] Starting enrichment for signal ${signalId}, ticker ${ticker}`)
  
  // Fetch data from all sources in parallel (Requirement 2.4)
  const [tradierData, twelveData, alpacaData] = await Promise.all([
    withRetry(() => fetchTradierData(ticker)),
    withRetry(() => fetchTwelveData(ticker)),
    withRetry(() => fetchAlpacaData(ticker))
  ])
  
  // Aggregate data and calculate quality score
  const { aggregated, warnings } = aggregateData(tradierData, twelveData, alpacaData)
  const dataQuality = calculateDataQuality(tradierData, twelveData, alpacaData)
  const enrichedAt = Date.now()
  
  console.log(`[Enrichment] Completed for signal ${signalId}. Quality: ${(dataQuality * 100).toFixed(1)}%`)
  
  return {
    signalId,
    tradierData,
    twelveData,
    alpacaData,
    aggregatedData: aggregated,
    dataQuality,
    enrichedAt,
    warnings
  }
}

/**
 * Stores enrichment result in database
 */
export async function storeEnrichmentResult(result: EnrichmentResult): Promise<void> {
  await prisma.enrichedData.create({
    data: {
      signalId: result.signalId,
      tradierData: result.tradierData as any,
      twelveData: result.twelveData as any,
      alpacaData: result.alpacaData as any,
      aggregatedData: result.aggregatedData as any,
      dataQuality: result.dataQuality,
      enrichedAt: Math.floor(result.enrichedAt / 1000) // Convert to seconds
    }
  })
  
  // Update signal status
  await prisma.signal.update({
    where: { id: result.signalId },
    data: { status: 'enriched' }
  })
  
  console.log(`[Enrichment] Stored enrichment data for signal ${result.signalId}`)
}

/**
 * Full enrichment pipeline - fetch, aggregate, and store
 */
export async function processSignalEnrichment(signalId: string): Promise<EnrichmentResult> {
  // Get signal from database
  const signal = await prisma.signal.findUnique({
    where: { id: signalId }
  })
  
  if (!signal) {
    throw new Error(`Signal ${signalId} not found`)
  }
  
  // Update status to processing
  await prisma.signal.update({
    where: { id: signalId },
    data: { status: 'processing' }
  })
  
  try {
    // Enrich signal
    const result = await enrichSignal(signalId, signal.ticker)
    
    // Store result
    await storeEnrichmentResult(result)
    
    return result
  } catch (error) {
    // Update status to indicate failure
    await prisma.signal.update({
      where: { id: signalId },
      data: { status: 'received' } // Reset to received for retry
    })
    
    throw error
  }
}
