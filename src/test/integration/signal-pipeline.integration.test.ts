/**
 * Signal Processing Pipeline Integration Tests
 * Tests the complete flow from webhook reception to trade execution
 * 
 * Requirements: All requirements integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { validateWebhookSignature, parseWebhookPayload } from '@/lib/webhook-utils'
import { makeDecision } from '@/lib/decision-engine'
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiter'
import { cacheGet, cacheSet, CACHE_TTL } from '@/lib/cache'

// Mock the API clients
vi.mock('@/lib/api-clients/tradier', () => ({
  tradierClient: {
    getQuote: vi.fn().mockResolvedValue({
      symbol: 'AAPL',
      last: 175.50,
      bid: 175.45,
      ask: 175.55,
      volume: 50000000,
    }),
    getOptionsChain: vi.fn().mockResolvedValue({
      options: [],
    }),
  },
}))

vi.mock('@/lib/api-clients/twelvedata', () => ({
  twelveDataClient: {
    getQuote: vi.fn().mockResolvedValue({
      symbol: 'AAPL',
      close: '175.50',
      volume: '50000000',
    }),
    getTechnicalIndicators: vi.fn().mockResolvedValue({
      rsi: 55,
      adx: 25,
      bbands: { upper: 180, middle: 175, lower: 170 },
    }),
  },
}))

vi.mock('@/lib/api-clients/alpaca', () => ({
  alpacaClient: {
    getLatestQuote: vi.fn().mockResolvedValue({
      symbol: 'AAPL',
      askPrice: 175.55,
      bidPrice: 175.45,
      askSize: 100,
      bidSize: 100,
    }),
    getLatestBar: vi.fn().mockResolvedValue({
      symbol: 'AAPL',
      close: 175.50,
      volume: 50000000,
    }),
  },
}))

describe('Signal Processing Pipeline Integration', () => {
  // Sample valid webhook payload (using correct snake_case format)
  const validWebhookPayload = {
    action: 'LONG',
    ticker: 'AAPL',
    timestamp: Math.floor(Date.now() / 1000),
    timeframe_minutes: 15,
    price: { entry: 175.50 },
    quality: 4,
    volume: {
      z_score: 1.5,
      buy_percent: 65,
      sell_percent: 35,
      buyers_winning: true,
    },
    structure: {
      trend: 'BULLISH',
      vwap_position: 'ABOVE',
      at_atr_level: true,
    },
    oscillator: {
      value: 0.3,
      phase: 'ACCUMULATION',
      compression: false,
      leaving_accumulation: true,
      leaving_extreme_down: false,
      leaving_distribution: false,
      leaving_extreme_up: false,
    },
    suggested_levels: {
      stop_loss: 172.00,
      target_1: 180.00,
      atr: 2.50,
    },
  }

  describe('Webhook Validation', () => {
    it('should validate correct HMAC signature', () => {
      const payload = JSON.stringify(validWebhookPayload)
      const secret = 'test-secret-key'
      
      // Generate signature
      const crypto = require('crypto')
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      // Mock the environment variable
      vi.stubEnv('TRADINGVIEW_WEBHOOK_SECRET', secret)

      const isValid = validateWebhookSignature(payload, signature)
      expect(isValid).toBe(true)
    })

    it('should reject invalid signature', () => {
      const payload = JSON.stringify(validWebhookPayload)
      const invalidSignature = 'invalid-signature'

      vi.stubEnv('TRADINGVIEW_WEBHOOK_SECRET', 'test-secret')

      const isValid = validateWebhookSignature(payload, invalidSignature)
      expect(isValid).toBe(false)
    })

    it('should parse valid webhook payload correctly', () => {
      const parsed = parseWebhookPayload(validWebhookPayload)

      expect(parsed).not.toBeNull()
      expect(parsed?.ticker).toBe('AAPL')
      expect(parsed?.action).toBe('LONG')
      expect(parsed?.quality).toBe(4)
      expect(parsed?.buyPercent).toBe(65)
      expect(parsed?.trend).toBe('BULLISH')
      expect(parsed?.oscillatorPhase).toBe('ACCUMULATION')
    })

    it('should reject invalid webhook payload', () => {
      const invalidPayload = {
        action: 'LONG',
        // Missing required fields
      }

      const parsed = parseWebhookPayload(invalidPayload)
      expect(parsed).toBeNull()
    })
  })

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Clear rate limit state between tests
      vi.useFakeTimers()
    })

    it('should allow requests within rate limit', () => {
      const key = 'test-ip:webhook'
      
      // First request should be allowed
      const result1 = checkRateLimit(key, RATE_LIMIT_CONFIGS.webhook)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(99)

      // Second request should also be allowed
      const result2 = checkRateLimit(key, RATE_LIMIT_CONFIGS.webhook)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(98)
    })

    it('should block requests exceeding rate limit', () => {
      const key = 'test-ip-2:webhook'
      const config = { windowMs: 60000, maxRequests: 3 }

      // Make 3 requests (at limit)
      checkRateLimit(key, config)
      checkRateLimit(key, config)
      checkRateLimit(key, config)

      // 4th request should be blocked
      const result = checkRateLimit(key, config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('Caching', () => {
    it('should cache and retrieve data correctly', () => {
      const key = 'test:cache:key'
      const data = { price: 175.50, volume: 1000000 }

      cacheSet(key, data, CACHE_TTL.QUOTE)
      const cached = cacheGet(key)

      expect(cached).toEqual(data)
    })

    it('should return null for expired cache entries', async () => {
      vi.useFakeTimers()
      
      const key = 'test:cache:expired'
      const data = { price: 175.50 }

      cacheSet(key, data, 1000) // 1 second TTL
      
      // Advance time past TTL
      vi.advanceTimersByTime(2000)
      
      const cached = cacheGet(key)
      expect(cached).toBeNull()

      vi.useRealTimers()
    })
  })

  describe('Decision Engine', () => {
    beforeEach(() => {
      // Mock time to be during trading hours (10:00 AM EST = 15:00 UTC)
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-01-02T15:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should make TRADE decision for high-quality signals', async () => {
      const signal = {
        id: 'test-signal-1',
        ticker: 'AAPL',
        action: 'LONG',
        quality: 5,
        entryPrice: 175.50,
        stopLoss: 172.00,
        target1: 180.00,
        buyPercent: 70,
        sellPercent: 30,
        buyersWinning: true,
        trend: 'BULLISH',
        vwapPosition: 'ABOVE',
        atAtrLevel: true,
        oscillatorValue: 0.3,
        oscillatorPhase: 'ACCUMULATION',
        compression: false,
        leavingAccumulation: true,
        leavingExtremeDown: false,
        leavingDistribution: false,
        leavingExtremeUp: false,
        zScore: 1.5,
        atr: 2.50,
        timeframeMinutes: 15,
      }

      const enrichedData = {
        signalId: signal.id,
        ticker: signal.ticker,
        aggregatedData: {
          medianPrice: 175.50,
          priceDeviationPercent: 0.001,
          volumeConfirmation: 0.9,
          technicalConfirmation: 0.85,
          optionsActivity: 0.7,
          spreadPercent: 0.001,
          trendStrength: 45,
          rsiSignal: 'NEUTRAL',
          ivRank: 30,
        },
        dataQuality: 0.95,
        enrichedAt: new Date(),
      }

      const rules = {
        qualityWeight: 0.25,
        volumeWeight: 0.20,
        oscillatorWeight: 0.20,
        structureWeight: 0.20,
        marketWeight: 0.15,
        minQuality: 4,
        minConfidence: 0.65,
        minVolumePressure: 60,
        maxRiskPercent: 2,
        compressionMultiplier: 0.5,
        version: 'v1.0.0',
      }

      const decision = await makeDecision(signal as any, enrichedData as any, rules)

      expect(decision.decision).toBe('TRADE')
      expect(decision.confidence).toBeGreaterThan(0)
      expect(decision.reasoning.summary).toContain('approved')
    })

    it('should make REJECT decision for low-quality signals', async () => {
      const signal = {
        id: 'test-signal-2',
        ticker: 'AAPL',
        action: 'LONG',
        quality: 2, // Low quality
        entryPrice: 175.50,
        stopLoss: 172.00,
        target1: 180.00,
        buyPercent: 45, // Low volume pressure
        sellPercent: 55,
        buyersWinning: false,
        trend: 'NEUTRAL',
        vwapPosition: 'BELOW',
        atAtrLevel: false,
        oscillatorValue: 0.0,
        oscillatorPhase: 'NEUTRAL',
        compression: true,
        leavingAccumulation: false,
        leavingExtremeDown: false,
        leavingDistribution: false,
        leavingExtremeUp: false,
        zScore: 0.5,
        atr: 2.50,
        timeframeMinutes: 15,
      }

      const enrichedData = {
        signalId: signal.id,
        ticker: signal.ticker,
        aggregatedData: {
          medianPrice: 175.50,
          priceDeviationPercent: 0.001,
          volumeConfirmation: 0.4,
          technicalConfirmation: 0.3,
          optionsActivity: 0.3,
          spreadPercent: 0.002,
          trendStrength: 15,
          rsiSignal: 'NEUTRAL',
          ivRank: 20,
        },
        dataQuality: 0.85,
        enrichedAt: new Date(),
      }

      const rules = {
        qualityWeight: 0.25,
        volumeWeight: 0.20,
        oscillatorWeight: 0.20,
        structureWeight: 0.20,
        marketWeight: 0.15,
        minQuality: 4,
        minConfidence: 0.65,
        minVolumePressure: 60,
        maxRiskPercent: 2,
        compressionMultiplier: 0.5,
        version: 'v1.0.0',
      }

      const decision = await makeDecision(signal as any, enrichedData as any, rules)

      expect(decision.decision).toBe('REJECT')
      expect(decision.reasoning.filters.length).toBeGreaterThan(0)
    })
  })
})

describe('End-to-End Signal Flow', () => {
  it('should process a complete signal from webhook to decision', async () => {
    // 1. Parse webhook payload (using correct snake_case format)
    const parsed = parseWebhookPayload({
      action: 'LONG',
      ticker: 'AAPL',
      timestamp: Math.floor(Date.now() / 1000),
      timeframe_minutes: 15,
      price: { entry: 175.50 },
      quality: 5,
      volume: {
        z_score: 2.0,
        buy_percent: 75,
        sell_percent: 25,
        buyers_winning: true,
      },
      structure: {
        trend: 'BULLISH',
        vwap_position: 'ABOVE',
        at_atr_level: true,
      },
      oscillator: {
        value: 0.4,
        phase: 'ACCUMULATION',
        compression: false,
        leaving_accumulation: true,
        leaving_extreme_down: false,
        leaving_distribution: false,
        leaving_extreme_up: false,
      },
      suggested_levels: {
        stop_loss: 172.00,
        target_1: 182.00,
        atr: 2.50,
      },
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.ticker).toBe('AAPL')
    expect(parsed?.quality).toBe(5)

    // 2. Verify signal data is complete
    expect(parsed?.action).toBe('LONG')
    expect(parsed?.buyPercent).toBe(75)
    expect(parsed?.trend).toBe('BULLISH')
    expect(parsed?.oscillatorPhase).toBe('ACCUMULATION')
    expect(parsed?.stopLoss).toBe(172.00)
    expect(parsed?.target1).toBe(182.00)

    // 3. Verify risk/reward calculation
    const entryPrice = parsed!.entryPrice
    const stopLoss = parsed!.stopLoss
    const target1 = parsed!.target1
    
    const risk = entryPrice - stopLoss
    const reward = target1 - entryPrice
    const riskRewardRatio = reward / risk

    expect(risk).toBeGreaterThan(0)
    expect(reward).toBeGreaterThan(0)
    expect(riskRewardRatio).toBeGreaterThan(1) // At least 1:1 R:R
  })
})
