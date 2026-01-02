/**
 * Enhanced Tradier API Client for Strike Selection
 * 
 * Provides comprehensive options chain fetching with complete Greeks,
 * IV rank calculation, and intelligent retry logic for automated
 * options trading with delta targeting.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { apiLogger as logger } from '../logger'

export interface TradierQuote {
  symbol: string
  description: string
  last: number
  bid: number
  ask: number
  bidsize: number
  asksize: number
  volume: number
  open: number
  high: number
  low: number
  close: number
  change: number
  change_percentage: number
}

export interface TradierGreeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  phi: number
  mid_iv: number
}

export interface TradierOption {
  symbol: string
  description: string
  strike: number
  expiration_date: string
  option_type: 'call' | 'put'
  last: number
  bid: number
  ask: number
  volume: number
  open_interest: number
  greeks: TradierGreeks
  // Enhanced fields for strike selection
  intrinsic_value: number
  time_value: number
  days_to_expiration: number
}

// Compatibility alias for OptionContract
export type OptionContract = TradierOption

export interface OptionsChain {
  symbol: string
  underlying_price: number
  options: {
    calls: TradierOption[]
    puts: TradierOption[]
  }
  expirations: string[]
  iv_rank: number
  iv_percentile: number
  fetched_at: Date
}

export interface TradierData {
  quote: TradierQuote | null
  options_chain: OptionsChain | null
  error?: string
}

// Enhanced error types for better error handling
export class TradierAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'TradierAPIError'
  }
}

const TRADIER_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.tradier.com/v1'
  : 'https://sandbox.tradier.com/v1'

// Rate limiting configuration
const RATE_LIMIT = {
  requests_per_minute: 120,
  requests_per_second: 5,
  retry_attempts: 3,
  base_delay: 1000, // 1 second
}

class TradierClient {
  private apiKey: string
  private requestCount = 0
  private lastResetTime = Date.now()

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TRADIER_API_KEY || ''
    if (!this.apiKey) {
      throw new TradierAPIError('Tradier API key not configured')
    }
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(): void {
    const now = Date.now()
    const timeSinceReset = now - this.lastResetTime

    // Reset counter every minute
    if (timeSinceReset >= 60000) {
      this.requestCount = 0
      this.lastResetTime = now
    }

    if (this.requestCount >= RATE_LIMIT.requests_per_minute) {
      throw new TradierAPIError('Rate limit exceeded', 429, true)
    }

    this.requestCount++
  }

  /**
   * Enhanced fetch with exponential backoff retry
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    attempt = 1
  ): Promise<Response> {
    this.checkRateLimit()

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          ...options.headers,
        },
      })

      // Handle rate limiting
      if (response.status === 429) {
        if (attempt <= RATE_LIMIT.retry_attempts) {
          const delay = RATE_LIMIT.base_delay * Math.pow(2, attempt - 1)
          logger.warn(`[Tradier] Rate limited, retrying in ${delay}ms (attempt ${attempt})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.fetchWithRetry(url, options, attempt + 1)
        }
        throw new TradierAPIError('Rate limit exceeded after retries', 429, false)
      }

      // Handle other errors
      if (!response.ok) {
        const isRetryable = response.status >= 500 || response.status === 503
        if (isRetryable && attempt <= RATE_LIMIT.retry_attempts) {
          const delay = RATE_LIMIT.base_delay * Math.pow(2, attempt - 1)
          logger.warn(`[Tradier] API error ${response.status}, retrying in ${delay}ms (attempt ${attempt})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.fetchWithRetry(url, options, attempt + 1)
        }
        throw new TradierAPIError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status,
          isRetryable
        )
      }

      return response
    } catch (error) {
      if (error instanceof TradierAPIError) {
        throw error
      }

      // Network errors are retryable
      if (attempt <= RATE_LIMIT.retry_attempts) {
        const delay = RATE_LIMIT.base_delay * Math.pow(2, attempt - 1)
        logger.warn(`[Tradier] Network error, retrying in ${delay}ms (attempt ${attempt}): ${error}`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.fetchWithRetry(url, options, attempt + 1)
      }

      throw new TradierAPIError(
        `Network error after ${RATE_LIMIT.retry_attempts} attempts: ${error}`,
        undefined,
        false
      )
    }
  }

  /**
   * Fetch quote data with enhanced error handling
   */
  async fetchQuote(symbol: string): Promise<TradierQuote> {
    try {
      const response = await this.fetchWithRetry(
        `${TRADIER_BASE_URL}/markets/quotes?symbols=${symbol}`
      )

      const data = await response.json()
      const quote = data.quotes?.quote

      if (!quote) {
        throw new TradierAPIError(`No quote data found for symbol ${symbol}`)
      }

      logger.info(`[Tradier] Successfully fetched quote for ${symbol}`)
      return quote
    } catch (error) {
      logger.error(`[Tradier] Error fetching quote for ${symbol}:`, error as Error)
      throw error
    }
  }

  /**
   * Fetch available expiration dates
   */
  async fetchExpirations(symbol: string): Promise<string[]> {
    try {
      const response = await this.fetchWithRetry(
        `${TRADIER_BASE_URL}/markets/options/expirations?symbol=${symbol}`
      )

      const data = await response.json()
      const expirations = data.expirations?.date || []
      
      logger.info(`[Tradier] Found ${expirations.length} expirations for ${symbol}`)
      return Array.isArray(expirations) ? expirations : [expirations]
    } catch (error) {
      logger.error(`[Tradier] Error fetching expirations for ${symbol}:`, error as Error)
      throw error
    }
  }

  /**
   * Fetch complete options chain with Greeks for all expirations
   */
  async fetchOptionsChain(symbol: string, expiration?: string): Promise<TradierOption[]> {
    try {
      let url = `${TRADIER_BASE_URL}/markets/options/chains?symbol=${symbol}&greeks=true`
      if (expiration) {
        url += `&expiration=${expiration}`
      }

      const response = await this.fetchWithRetry(url)
      const data = await response.json()
      
      let options = data.options?.option || []
      if (!Array.isArray(options)) {
        options = options ? [options] : []
      }

      // Enhance options with calculated fields
      const enhancedOptions = options.map((option: any) => {
        const intrinsicValue = this.calculateIntrinsicValue(
          option.strike,
          option.option_type,
          data.underlying_price || 0
        )
        
        return {
          ...option,
          intrinsic_value: intrinsicValue,
          time_value: Math.max(0, (option.last || 0) - intrinsicValue),
          days_to_expiration: this.calculateDTE(option.expiration_date),
          greeks: option.greeks || {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
            phi: 0,
            mid_iv: 0
          }
        } as TradierOption
      })

      logger.info(`[Tradier] Successfully fetched ${enhancedOptions.length} options for ${symbol}`)
      return enhancedOptions
    } catch (error) {
      logger.error(`[Tradier] Error fetching options chain for ${symbol}:`, error as Error)
      throw error
    }
  }

  /**
   * Calculate intrinsic value for an option
   */
  private calculateIntrinsicValue(
    strike: number,
    optionType: 'call' | 'put',
    underlyingPrice: number
  ): number {
    if (optionType === 'call') {
      return Math.max(0, underlyingPrice - strike)
    } else {
      return Math.max(0, strike - underlyingPrice)
    }
  }

  /**
   * Calculate days to expiration
   */
  private calculateDTE(expirationDate: string): number {
    const expiry = new Date(expirationDate)
    const now = new Date()
    const diffTime = expiry.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Calculate IV rank from historical IV data
   * Note: This is a simplified calculation. In production, you'd want
   * to use historical IV data for accurate ranking.
   */
  private calculateIVRank(options: TradierOption[]): number {
    if (options.length === 0) return 0

    const ivValues = options
      .filter(opt => opt.greeks?.mid_iv > 0)
      .map(opt => opt.greeks.mid_iv)

    if (ivValues.length === 0) return 0

    const currentIV = ivValues.reduce((sum, iv) => sum + iv, 0) / ivValues.length
    
    // Simplified IV rank calculation (0-100 scale)
    // In production, this should use 252-day historical IV data
    const minIV = Math.min(...ivValues)
    const maxIV = Math.max(...ivValues)
    
    if (maxIV === minIV) return 50 // Default to middle if no range
    
    return Math.round(((currentIV - minIV) / (maxIV - minIV)) * 100)
  }

  /**
   * Calculate IV percentile (similar to rank but different calculation)
   */
  private calculateIVPercentile(options: TradierOption[]): number {
    // Simplified percentile calculation
    // In production, this should use historical data
    return this.calculateIVRank(options)
  }

  /**
   * Fetch comprehensive options chain data with complete market information
   */
  async fetchCompleteOptionsChain(symbol: string): Promise<OptionsChain> {
    try {
      // Fetch quote and expirations in parallel
      const [quote, expirations] = await Promise.all([
        this.fetchQuote(symbol),
        this.fetchExpirations(symbol)
      ])

      // Fetch options for all expirations
      const allOptions = await this.fetchOptionsChain(symbol)

      // Separate calls and puts
      const calls = allOptions.filter(opt => opt.option_type === 'call')
      const puts = allOptions.filter(opt => opt.option_type === 'put')

      // Calculate IV metrics
      const ivRank = this.calculateIVRank(allOptions)
      const ivPercentile = this.calculateIVPercentile(allOptions)

      const optionsChain: OptionsChain = {
        symbol,
        underlying_price: quote.last,
        options: { calls, puts },
        expirations,
        iv_rank: ivRank,
        iv_percentile: ivPercentile,
        fetched_at: new Date()
      }

      logger.info(`[Tradier] Complete options chain fetched for ${symbol}: ${calls.length} calls, ${puts.length} puts, IV rank: ${ivRank}`)
      return optionsChain
    } catch (error) {
      logger.error(`[Tradier] Error fetching complete options chain for ${symbol}:`, error as Error)
      throw error
    }
  }

  /**
   * Fetch individual option quote
   */
  async fetchOptionQuote(optionSymbol: string): Promise<TradierOption> {
    try {
      const response = await this.fetchWithRetry(
        `${TRADIER_BASE_URL}/markets/quotes?symbols=${optionSymbol}&greeks=true`
      )

      const data = await response.json()
      const quote = data.quotes?.quote

      if (!quote) {
        throw new TradierAPIError(`No option quote found for ${optionSymbol}`)
      }

      return quote as TradierOption
    } catch (error) {
      logger.error(`[Tradier] Error fetching option quote for ${optionSymbol}:`, error as Error)
      throw error
    }
  }
}

// Create singleton instance
const tradierClient = new TradierClient()

/**
 * Main function to fetch comprehensive Tradier data for strike selection
 */
export async function fetchTradierData(symbol: string): Promise<TradierData> {
  try {
    const [quote, optionsChain] = await Promise.all([
      tradierClient.fetchQuote(symbol),
      tradierClient.fetchCompleteOptionsChain(symbol)
    ])

    return {
      quote,
      options_chain: optionsChain
    }
  } catch (error) {
    logger.error(`[Tradier] Error fetching data for ${symbol}:`, error as Error)
    return {
      quote: null,
      options_chain: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Export client instance for direct use
 */
export { tradierClient }

/**
 * Export individual functions for specific use cases
 */
export const {
  fetchQuote,
  fetchExpirations,
  fetchOptionsChain,
  fetchCompleteOptionsChain,
  fetchOptionQuote
} = tradierClient
