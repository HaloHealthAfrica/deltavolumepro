/**
 * Alpaca API Client
 * 
 * Fetches market data and snapshots from Alpaca API.
 * Requirements: 2.3, 2.4
 */

export interface AlpacaQuote {
  symbol: string
  bidPrice: number
  bidSize: number
  askPrice: number
  askSize: number
  timestamp: string
}

export interface AlpacaTrade {
  symbol: string
  price: number
  size: number
  timestamp: string
  conditions: string[]
}

export interface AlpacaBar {
  symbol: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: string
  vwap: number
  tradeCount: number
}

export interface AlpacaSnapshot {
  latestTrade: AlpacaTrade | null
  latestQuote: AlpacaQuote | null
  minuteBar: AlpacaBar | null
  dailyBar: AlpacaBar | null
  prevDailyBar: AlpacaBar | null
}

export interface AlpacaData {
  snapshot: AlpacaSnapshot | null
  bars: AlpacaBar[]
  fetchedAt: number
  error?: string
}

const ALPACA_DATA_URL = 'https://data.alpaca.markets/v2'

/**
 * Fetches snapshot data from Alpaca
 */
async function fetchSnapshot(
  ticker: string, 
  apiKey: string, 
  apiSecret: string
): Promise<AlpacaSnapshot | null> {
  try {
    const response = await fetch(
      `${ALPACA_DATA_URL}/stocks/${ticker}/snapshot`,
      {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret
        }
      }
    )

    if (!response.ok) {
      console.error(`[Alpaca] Snapshot fetch failed: ${response.status}`)
      return null
    }

    const data = await response.json()
    
    return {
      latestTrade: data.latestTrade ? {
        symbol: ticker,
        price: data.latestTrade.p,
        size: data.latestTrade.s,
        timestamp: data.latestTrade.t,
        conditions: data.latestTrade.c || []
      } : null,
      latestQuote: data.latestQuote ? {
        symbol: ticker,
        bidPrice: data.latestQuote.bp,
        bidSize: data.latestQuote.bs,
        askPrice: data.latestQuote.ap,
        askSize: data.latestQuote.as,
        timestamp: data.latestQuote.t
      } : null,
      minuteBar: data.minuteBar ? {
        symbol: ticker,
        open: data.minuteBar.o,
        high: data.minuteBar.h,
        low: data.minuteBar.l,
        close: data.minuteBar.c,
        volume: data.minuteBar.v,
        timestamp: data.minuteBar.t,
        vwap: data.minuteBar.vw,
        tradeCount: data.minuteBar.n
      } : null,
      dailyBar: data.dailyBar ? {
        symbol: ticker,
        open: data.dailyBar.o,
        high: data.dailyBar.h,
        low: data.dailyBar.l,
        close: data.dailyBar.c,
        volume: data.dailyBar.v,
        timestamp: data.dailyBar.t,
        vwap: data.dailyBar.vw,
        tradeCount: data.dailyBar.n
      } : null,
      prevDailyBar: data.prevDailyBar ? {
        symbol: ticker,
        open: data.prevDailyBar.o,
        high: data.prevDailyBar.h,
        low: data.prevDailyBar.l,
        close: data.prevDailyBar.c,
        volume: data.prevDailyBar.v,
        timestamp: data.prevDailyBar.t,
        vwap: data.prevDailyBar.vw,
        tradeCount: data.prevDailyBar.n
      } : null
    }
  } catch (error) {
    console.error('[Alpaca] Error fetching snapshot:', error)
    return null
  }
}

/**
 * Fetches historical bars from Alpaca
 */
async function fetchBars(
  ticker: string,
  apiKey: string,
  apiSecret: string,
  timeframe: string = '1Min',
  limit: number = 100
): Promise<AlpacaBar[]> {
  try {
    const response = await fetch(
      `${ALPACA_DATA_URL}/stocks/${ticker}/bars?timeframe=${timeframe}&limit=${limit}`,
      {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret
        }
      }
    )

    if (!response.ok) {
      console.error(`[Alpaca] Bars fetch failed: ${response.status}`)
      return []
    }

    const data = await response.json()
    const bars = data.bars || []

    return bars.map((bar: any) => ({
      symbol: ticker,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      timestamp: bar.t,
      vwap: bar.vw,
      tradeCount: bar.n
    }))
  } catch (error) {
    console.error('[Alpaca] Error fetching bars:', error)
    return []
  }
}

/**
 * Main function to fetch all Alpaca data for a ticker
 */
export async function fetchAlpacaData(ticker: string): Promise<AlpacaData> {
  const apiKey = process.env.ALPACA_API_KEY
  const apiSecret = process.env.ALPACA_API_SECRET

  if (!apiKey || !apiSecret) {
    console.error('[Alpaca] API credentials not configured')
    return {
      snapshot: null,
      bars: [],
      fetchedAt: Date.now(),
      error: 'API credentials not configured'
    }
  }

  try {
    // Fetch snapshot and bars in parallel
    const [snapshot, bars] = await Promise.all([
      fetchSnapshot(ticker, apiKey, apiSecret),
      fetchBars(ticker, apiKey, apiSecret)
    ])

    return {
      snapshot,
      bars,
      fetchedAt: Date.now()
    }
  } catch (error) {
    console.error('[Alpaca] Error fetching data:', error)
    return {
      snapshot: null,
      bars: [],
      fetchedAt: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
