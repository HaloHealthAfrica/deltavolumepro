import crypto from 'crypto'

/**
 * Webhook Utilities
 * 
 * Provides signature validation and payload parsing for TradingView webhooks.
 * Requirements: 1.2, 1.3, 1.4
 */

export interface TradingViewWebhook {
  action: 'LONG' | 'LONG_PREMIUM' | 'SHORT' | 'SHORT_PREMIUM'
  ticker: string
  timestamp: number
  timeframe_minutes: number
  price: { entry: number }
  volume: {
    z_score: number
    buy_percent: number
    sell_percent: number
    buyers_winning: boolean
  }
  structure: {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    vwap_position: 'ABOVE' | 'BELOW'
    at_atr_level: boolean
  }
  oscillator: {
    value: number
    phase: string
    compression: boolean
    leaving_accumulation: boolean
    leaving_extreme_down: boolean
    leaving_distribution: boolean
    leaving_extreme_up: boolean
  }
  suggested_levels: {
    stop_loss: number
    target_1: number
    atr: number
  }
  quality: 1 | 2 | 3 | 4 | 5
}

export interface ParsedSignal {
  action: string
  ticker: string
  timestamp: number
  timeframeMinutes: number
  entryPrice: number
  quality: number
  zScore: number
  buyPercent: number
  sellPercent: number
  buyersWinning: boolean
  trend: string
  vwapPosition: string
  atAtrLevel: boolean
  oscillatorValue: number
  oscillatorPhase: string
  compression: boolean
  leavingAccumulation: boolean
  leavingExtremeDown: boolean
  leavingDistribution: boolean
  leavingExtremeUp: boolean
  stopLoss: number
  target1: number
  atr: number
}

/**
 * Validates webhook signature using HMAC-SHA256
 * Requirement 1.2: Validate webhook signatures
 */
export function validateWebhookSignature(
  payload: string,
  signature: string
): boolean {
  try {
    const secret = process.env.TRADINGVIEW_WEBHOOK_SECRET
    
    if (!secret) {
      console.error('[Webhook] TRADINGVIEW_WEBHOOK_SECRET not configured')
      return false
    }

    // Create HMAC signature
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('[Webhook] Error validating signature:', error)
    return false
  }
}

/**
 * Parses and validates TradingView webhook payload
 * Requirement 1.3: Parse webhook JSON and validate required fields
 */
export function parseWebhookPayload(
  data: any
): ParsedSignal | null {
  try {
    // Validate required top-level fields
    if (!data.action || !data.ticker || !data.timestamp) {
      console.error('[Webhook] Missing required top-level fields')
      return null
    }

    // Validate action type
    const validActions = ['LONG', 'LONG_PREMIUM', 'SHORT', 'SHORT_PREMIUM']
    if (!validActions.includes(data.action)) {
      console.error('[Webhook] Invalid action type:', data.action)
      return null
    }

    // Validate nested objects exist
    if (!data.price || !data.volume || !data.structure || !data.oscillator || !data.suggested_levels) {
      console.error('[Webhook] Missing required nested objects')
      return null
    }

    // Validate quality is in range 1-5
    if (!data.quality || data.quality < 1 || data.quality > 5) {
      console.error('[Webhook] Invalid quality value:', data.quality)
      return null
    }

    // Parse and return structured signal
    const parsedSignal: ParsedSignal = {
      action: data.action,
      ticker: data.ticker.toUpperCase(),
      timestamp: parseInt(data.timestamp),
      timeframeMinutes: parseInt(data.timeframe_minutes),
      entryPrice: parseFloat(data.price.entry),
      quality: parseInt(data.quality),
      
      // Volume data
      zScore: parseFloat(data.volume.z_score),
      buyPercent: parseFloat(data.volume.buy_percent),
      sellPercent: parseFloat(data.volume.sell_percent),
      buyersWinning: Boolean(data.volume.buyers_winning),
      
      // Structure data
      trend: data.structure.trend,
      vwapPosition: data.structure.vwap_position,
      atAtrLevel: Boolean(data.structure.at_atr_level),
      
      // Oscillator data
      oscillatorValue: parseFloat(data.oscillator.value),
      oscillatorPhase: data.oscillator.phase,
      compression: Boolean(data.oscillator.compression),
      leavingAccumulation: Boolean(data.oscillator.leaving_accumulation),
      leavingExtremeDown: Boolean(data.oscillator.leaving_extreme_down),
      leavingDistribution: Boolean(data.oscillator.leaving_distribution),
      leavingExtremeUp: Boolean(data.oscillator.leaving_extreme_up),
      
      // Suggested levels
      stopLoss: parseFloat(data.suggested_levels.stop_loss),
      target1: parseFloat(data.suggested_levels.target_1),
      atr: parseFloat(data.suggested_levels.atr)
    }

    // Validate parsed numbers are not NaN
    const numericFields = [
      'timestamp', 'timeframeMinutes', 'entryPrice', 'quality',
      'zScore', 'buyPercent', 'sellPercent', 'oscillatorValue',
      'stopLoss', 'target1', 'atr'
    ]

    for (const field of numericFields) {
      if (isNaN(parsedSignal[field as keyof ParsedSignal] as number)) {
        console.error(`[Webhook] Invalid numeric value for field: ${field}`)
        return null
      }
    }

    return parsedSignal
  } catch (error) {
    console.error('[Webhook] Error parsing payload:', error)
    return null
  }
}

/**
 * Validates that all required fields are present in the webhook payload
 * Requirement 1.4: Comprehensive error handling
 */
export function validateWebhookPayload(data: any): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check required fields
  if (!data.action) errors.push('Missing field: action')
  if (!data.ticker) errors.push('Missing field: ticker')
  if (!data.timestamp) errors.push('Missing field: timestamp')
  if (!data.timeframe_minutes) errors.push('Missing field: timeframe_minutes')
  if (!data.quality) errors.push('Missing field: quality')

  // Check nested objects
  if (!data.price) {
    errors.push('Missing object: price')
  } else if (!data.price.entry) {
    errors.push('Missing field: price.entry')
  }

  if (!data.volume) {
    errors.push('Missing object: volume')
  } else {
    if (data.volume.z_score === undefined) errors.push('Missing field: volume.z_score')
    if (data.volume.buy_percent === undefined) errors.push('Missing field: volume.buy_percent')
    if (data.volume.sell_percent === undefined) errors.push('Missing field: volume.sell_percent')
    if (data.volume.buyers_winning === undefined) errors.push('Missing field: volume.buyers_winning')
  }

  if (!data.structure) {
    errors.push('Missing object: structure')
  } else {
    if (!data.structure.trend) errors.push('Missing field: structure.trend')
    if (!data.structure.vwap_position) errors.push('Missing field: structure.vwap_position')
    if (data.structure.at_atr_level === undefined) errors.push('Missing field: structure.at_atr_level')
  }

  if (!data.oscillator) {
    errors.push('Missing object: oscillator')
  } else {
    if (data.oscillator.value === undefined) errors.push('Missing field: oscillator.value')
    if (!data.oscillator.phase) errors.push('Missing field: oscillator.phase')
    if (data.oscillator.compression === undefined) errors.push('Missing field: oscillator.compression')
  }

  if (!data.suggested_levels) {
    errors.push('Missing object: suggested_levels')
  } else {
    if (data.suggested_levels.stop_loss === undefined) errors.push('Missing field: suggested_levels.stop_loss')
    if (data.suggested_levels.target_1 === undefined) errors.push('Missing field: suggested_levels.target_1')
    if (data.suggested_levels.atr === undefined) errors.push('Missing field: suggested_levels.atr')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
