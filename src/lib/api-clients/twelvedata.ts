/**
 * TwelveData API Client
 * 
 * Fetches technical indicators and volume analysis from TwelveData API.
 * Requirements: 2.2, 2.4
 */

export interface TwelveDataQuote {
  symbol: string
  name: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  previous_close: number
  change: number
  percent_change: number
  timestamp: number
}

export interface TechnicalIndicator {
  rsi: number | null
  adx: number | null
  macd: {
    macd: number
    signal: number
    histogram: number
  } | null
  bbands: {
    upper: number
    middle: number
    lower: number
  } | null
  atr: number | null
}

export interface VolumeAnalysis {
  currentVolume: number
  avgVolume: number
  volumeRatio: number
  volumeProfile: 'HIGH' | 'NORMAL' | 'LOW'
}

export interface TwelveDataResult {
  quote: TwelveDataQuote | null
  technical: TechnicalIndicator
  volume: VolumeAnalysis | null
  fetchedAt: number
  error?: string
}

const TWELVEDATA_BASE_URL = 'https://api.twelvedata.com'

/**
 * Fetches real-time quote from TwelveData
 */
async function fetchQuote(ticker: string, apiKey: string): Promise<TwelveDataQuote | null> {
  try {
    const response = await fetch(
      `${TWELVEDATA_BASE_URL}/quote?symbol=${ticker}&apikey=${apiKey}`
    )

    if (!response.ok) {
      console.error(`[TwelveData] Quote fetch failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    if (data.status === 'error') {
      console.error('[TwelveData] API error:', data.message)
      return null
    }

    return {
      symbol: data.symbol,
      name: data.name,
      open: parseFloat(data.open),
      high: parseFloat(data.high),
      low: parseFloat(data.low),
      close: parseFloat(data.close),
      volume: parseInt(data.volume),
      previous_close: parseFloat(data.previous_close),
      change: parseFloat(data.change),
      percent_change: parseFloat(data.percent_change),
      timestamp: data.timestamp
    }
  } catch (error) {
    console.error('[TwelveData] Error fetching quote:', error)
    return null
  }
}

/**
 * Fetches RSI indicator
 */
async function fetchRSI(ticker: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${TWELVEDATA_BASE_URL}/rsi?symbol=${ticker}&interval=1day&apikey=${apiKey}`
    )

    if (!response.ok) return null

    const data = await response.json()
    if (data.status === 'error' || !data.values?.[0]) return null

    return parseFloat(data.values[0].rsi)
  } catch (error) {
    console.error('[TwelveData] Error fetching RSI:', error)
    return null
  }
}

/**
 * Fetches ADX indicator
 */
async function fetchADX(ticker: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${TWELVEDATA_BASE_URL}/adx?symbol=${ticker}&interval=1day&apikey=${apiKey}`
    )

    if (!response.ok) return null

    const data = await response.json()
    if (data.status === 'error' || !data.values?.[0]) return null

    return parseFloat(data.values[0].adx)
  } catch (error) {
    console.error('[TwelveData] Error fetching ADX:', error)
    return null
  }
}

/**
 * Fetches MACD indicator
 */
async function fetchMACD(ticker: string, apiKey: string): Promise<TechnicalIndicator['macd']> {
  try {
    const response = await fetch(
      `${TWELVEDATA_BASE_URL}/macd?symbol=${ticker}&interval=1day&apikey=${apiKey}`
    )

    if (!response.ok) return null

    const data = await response.json()
    if (data.status === 'error' || !data.values?.[0]) return null

    return {
      macd: parseFloat(data.values[0].macd),
      signal: parseFloat(data.values[0].macd_signal),
      histogram: parseFloat(data.values[0].macd_hist)
    }
  } catch (error) {
    console.error('[TwelveData] Error fetching MACD:', error)
    return null
  }
}

/**
 * Fetches Bollinger Bands
 */
async function fetchBBands(ticker: string, apiKey: string): Promise<TechnicalIndicator['bbands']> {
  try {
    const response = await fetch(
      `${TWELVEDATA_BASE_URL}/bbands?symbol=${ticker}&interval=1day&apikey=${apiKey}`
    )

    if (!response.ok) return null

    const data = await response.json()
    if (data.status === 'error' || !data.values?.[0]) return null

    return {
      upper: parseFloat(data.values[0].upper_band),
      middle: parseFloat(data.values[0].middle_band),
      lower: parseFloat(data.values[0].lower_band)
    }
  } catch (error) {
    console.error('[TwelveData] Error fetching BBands:', error)
    return null
  }
}

/**
 * Fetches ATR indicator
 */
async function fetchATR(ticker: string, apiKey: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${TWELVEDATA_BASE_URL}/atr?symbol=${ticker}&interval=1day&apikey=${apiKey}`
    )

    if (!response.ok) return null

    const data = await response.json()
    if (data.status === 'error' || !data.values?.[0]) return null

    return parseFloat(data.values[0].atr)
  } catch (error) {
    console.error('[TwelveData] Error fetching ATR:', error)
    return null
  }
}

/**
 * Analyzes volume data
 */
function analyzeVolume(quote: TwelveDataQuote | null): VolumeAnalysis | null {
  if (!quote) return null

  // Simplified volume analysis (would need historical data for accurate avg)
  const avgVolume = quote.volume * 0.8 // Placeholder
  const volumeRatio = quote.volume / avgVolume

  let volumeProfile: 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL'
  if (volumeRatio > 1.5) volumeProfile = 'HIGH'
  else if (volumeRatio < 0.5) volumeProfile = 'LOW'

  return {
    currentVolume: quote.volume,
    avgVolume,
    volumeRatio,
    volumeProfile
  }
}

/**
 * Main function to fetch all TwelveData for a ticker
 */
export async function fetchTwelveData(ticker: string): Promise<TwelveDataResult> {
  const apiKey = process.env.TWELVEDATA_API_KEY

  if (!apiKey) {
    console.error('[TwelveData] API key not configured')
    return {
      quote: null,
      technical: { rsi: null, adx: null, macd: null, bbands: null, atr: null },
      volume: null,
      fetchedAt: Date.now(),
      error: 'API key not configured'
    }
  }

  try {
    // Fetch all data in parallel
    const [quote, rsi, adx, macd, bbands, atr] = await Promise.all([
      fetchQuote(ticker, apiKey),
      fetchRSI(ticker, apiKey),
      fetchADX(ticker, apiKey),
      fetchMACD(ticker, apiKey),
      fetchBBands(ticker, apiKey),
      fetchATR(ticker, apiKey)
    ])

    return {
      quote,
      technical: { rsi, adx, macd, bbands, atr },
      volume: analyzeVolume(quote),
      fetchedAt: Date.now()
    }
  } catch (error) {
    console.error('[TwelveData] Error fetching data:', error)
    return {
      quote: null,
      technical: { rsi: null, adx: null, macd: null, bbands: null, atr: null },
      volume: null,
      fetchedAt: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
