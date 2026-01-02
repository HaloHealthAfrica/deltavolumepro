import { describe, it, expect, beforeEach } from 'vitest'
import { parseWebhookPayload, validateWebhookPayload, validateWebhookSignature } from '@/lib/webhook-utils'

describe('Webhook Utilities', () => {
  describe('parseWebhookPayload', () => {
    it('should parse valid webhook payload', () => {
      const validPayload = {
        action: 'LONG',
        ticker: 'SPY',
        timestamp: 1234567890,
        timeframe_minutes: 15,
        price: { entry: 450.25 },
        volume: {
          z_score: 1.5,
          buy_percent: 65.0,
          sell_percent: 35.0,
          buyers_winning: true
        },
        structure: {
          trend: 'BULLISH',
          vwap_position: 'ABOVE',
          at_atr_level: true
        },
        oscillator: {
          value: 0.3,
          phase: 'ACCUMULATION',
          compression: true,
          leaving_accumulation: true,
          leaving_extreme_down: false,
          leaving_distribution: false,
          leaving_extreme_up: false
        },
        suggested_levels: {
          stop_loss: 448.5,
          target_1: 452.0,
          atr: 1.75
        },
        quality: 4
      }

      const result = parseWebhookPayload(validPayload)

      expect(result).toBeTruthy()
      expect(result?.action).toBe('LONG')
      expect(result?.ticker).toBe('SPY')
      expect(result?.timestamp).toBe(1234567890)
      expect(result?.quality).toBe(4)
      expect(result?.entryPrice).toBe(450.25)
      expect(result?.zScore).toBe(1.5)
      expect(result?.buyersWinning).toBe(true)
      expect(result?.trend).toBe('BULLISH')
      expect(result?.oscillatorPhase).toBe('ACCUMULATION')
    })

    it('should return null for missing required fields', () => {
      const invalidPayload = {
        action: 'LONG',
        // Missing ticker
        timestamp: 1234567890
      }

      const result = parseWebhookPayload(invalidPayload)
      expect(result).toBeNull()
    })

    it('should return null for invalid action type', () => {
      const invalidPayload = {
        action: 'INVALID_ACTION',
        ticker: 'SPY',
        timestamp: 1234567890,
        timeframe_minutes: 15,
        price: { entry: 450.25 },
        volume: {
          z_score: 1.5,
          buy_percent: 65.0,
          sell_percent: 35.0,
          buyers_winning: true
        },
        structure: {
          trend: 'BULLISH',
          vwap_position: 'ABOVE',
          at_atr_level: true
        },
        oscillator: {
          value: 0.3,
          phase: 'ACCUMULATION',
          compression: true,
          leaving_accumulation: true,
          leaving_extreme_down: false,
          leaving_distribution: false,
          leaving_extreme_up: false
        },
        suggested_levels: {
          stop_loss: 448.5,
          target_1: 452.0,
          atr: 1.75
        },
        quality: 4
      }

      const result = parseWebhookPayload(invalidPayload)
      expect(result).toBeNull()
    })

    it('should return null for invalid quality value', () => {
      const invalidPayload = {
        action: 'LONG',
        ticker: 'SPY',
        timestamp: 1234567890,
        timeframe_minutes: 15,
        price: { entry: 450.25 },
        volume: {
          z_score: 1.5,
          buy_percent: 65.0,
          sell_percent: 35.0,
          buyers_winning: true
        },
        structure: {
          trend: 'BULLISH',
          vwap_position: 'ABOVE',
          at_atr_level: true
        },
        oscillator: {
          value: 0.3,
          phase: 'ACCUMULATION',
          compression: true,
          leaving_accumulation: true,
          leaving_extreme_down: false,
          leaving_distribution: false,
          leaving_extreme_up: false
        },
        suggested_levels: {
          stop_loss: 448.5,
          target_1: 452.0,
          atr: 1.75
        },
        quality: 6 // Invalid: should be 1-5
      }

      const result = parseWebhookPayload(invalidPayload)
      expect(result).toBeNull()
    })

    it('should normalize ticker to uppercase', () => {
      const payload = {
        action: 'LONG',
        ticker: 'spy', // lowercase
        timestamp: 1234567890,
        timeframe_minutes: 15,
        price: { entry: 450.25 },
        volume: {
          z_score: 1.5,
          buy_percent: 65.0,
          sell_percent: 35.0,
          buyers_winning: true
        },
        structure: {
          trend: 'BULLISH',
          vwap_position: 'ABOVE',
          at_atr_level: true
        },
        oscillator: {
          value: 0.3,
          phase: 'ACCUMULATION',
          compression: true,
          leaving_accumulation: true,
          leaving_extreme_down: false,
          leaving_distribution: false,
          leaving_extreme_up: false
        },
        suggested_levels: {
          stop_loss: 448.5,
          target_1: 452.0,
          atr: 1.75
        },
        quality: 4
      }

      const result = parseWebhookPayload(payload)
      expect(result?.ticker).toBe('SPY')
    })
  })

  describe('validateWebhookPayload', () => {
    it('should validate complete payload', () => {
      const validPayload = {
        action: 'LONG',
        ticker: 'SPY',
        timestamp: 1234567890,
        timeframe_minutes: 15,
        price: { entry: 450.25 },
        volume: {
          z_score: 1.5,
          buy_percent: 65.0,
          sell_percent: 35.0,
          buyers_winning: true
        },
        structure: {
          trend: 'BULLISH',
          vwap_position: 'ABOVE',
          at_atr_level: true
        },
        oscillator: {
          value: 0.3,
          phase: 'ACCUMULATION',
          compression: true,
          leaving_accumulation: true,
          leaving_extreme_down: false,
          leaving_distribution: false,
          leaving_extreme_up: false
        },
        suggested_levels: {
          stop_loss: 448.5,
          target_1: 452.0,
          atr: 1.75
        },
        quality: 4
      }

      const result = validateWebhookPayload(validPayload)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const invalidPayload = {
        action: 'LONG'
        // Missing many required fields
      }

      const result = validateWebhookPayload(invalidPayload)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors).toContain('Missing field: ticker')
      expect(result.errors).toContain('Missing field: timestamp')
    })

    it('should detect missing nested fields', () => {
      const invalidPayload = {
        action: 'LONG',
        ticker: 'SPY',
        timestamp: 1234567890,
        timeframe_minutes: 15,
        quality: 4,
        price: {}, // Missing entry
        volume: {
          // Missing fields
        },
        structure: {},
        oscillator: {},
        suggested_levels: {}
      }

      const result = validateWebhookPayload(invalidPayload)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing field: price.entry')
      expect(result.errors).toContain('Missing field: volume.z_score')
    })
  })

  describe('validateWebhookSignature', () => {
    it('should return false when secret is not configured', () => {
      const originalSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET
      delete process.env.TRADINGVIEW_WEBHOOK_SECRET

      const result = validateWebhookSignature('test payload', 'test signature')
      expect(result).toBe(false)

      // Restore
      if (originalSecret) {
        process.env.TRADINGVIEW_WEBHOOK_SECRET = originalSecret
      }
    })

    it('should validate correct signature', () => {
      // Set a test secret
      process.env.TRADINGVIEW_WEBHOOK_SECRET = 'test-secret-key'

      const payload = 'test payload'
      const crypto = require('crypto')
      const hmac = crypto.createHmac('sha256', 'test-secret-key')
      hmac.update(payload)
      const validSignature = hmac.digest('hex')

      const result = validateWebhookSignature(payload, validSignature)
      expect(result).toBe(true)
    })

    it('should reject invalid signature', () => {
      process.env.TRADINGVIEW_WEBHOOK_SECRET = 'test-secret-key'

      const payload = 'test payload'
      const invalidSignature = 'invalid-signature-value'

      const result = validateWebhookSignature(payload, invalidSignature)
      expect(result).toBe(false)
    })
  })
})
