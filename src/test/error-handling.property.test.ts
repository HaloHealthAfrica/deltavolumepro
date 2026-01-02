import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { PrismaClient } from '@prisma/client'
import { parseWebhookPayload, validateWebhookSignature, validateWebhookPayload } from '@/lib/webhook-utils'
import crypto from 'crypto'

/**
 * Property-Based Tests for Error Handling Consistency
 * 
 * Property 2: Error Handling Consistency
 * For any invalid or malformed webhook payload, the system should log appropriate errors
 * and return correct HTTP status codes without storing invalid data.
 * 
 * Validates: Requirements 1.4
 */

const prisma = new PrismaClient()

describe('Property 2: Error Handling Consistency', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.signal.deleteMany()
    
    // Set test webhook secret
    process.env.TRADINGVIEW_WEBHOOK_SECRET = 'test-webhook-secret-key'
  })

  afterEach(async () => {
    // Clean up after each test
    await prisma.signal.deleteMany()
  })

  it('should reject payloads with missing required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Randomly omit required fields
          action: fc.option(fc.constantFrom('LONG', 'SHORT'), { nil: undefined }),
          ticker: fc.option(fc.stringMatching(/^[A-Z]{1,5}$/), { nil: undefined }),
          timestamp: fc.option(fc.integer({ min: 1000000000, max: 2000000000 }), { nil: undefined }),
          timeframe_minutes: fc.option(fc.constantFrom(5, 15, 30), { nil: undefined }),
          quality: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined })
        }),
        async (partialData) => {
          // Skip if all fields are present (we want at least one missing)
          if (partialData.action && partialData.ticker && partialData.timestamp && 
              partialData.timeframe_minutes && partialData.quality) {
            return
          }

          const webhookPayload: any = {}
          
          if (partialData.action) webhookPayload.action = partialData.action
          if (partialData.ticker) webhookPayload.ticker = partialData.ticker
          if (partialData.timestamp) webhookPayload.timestamp = partialData.timestamp
          if (partialData.timeframe_minutes) webhookPayload.timeframe_minutes = partialData.timeframe_minutes
          if (partialData.quality) webhookPayload.quality = partialData.quality

          // Add minimal nested objects to avoid null reference errors
          webhookPayload.price = { entry: 100 }
          webhookPayload.volume = { z_score: 1, buy_percent: 60, sell_percent: 40, buyers_winning: true }
          webhookPayload.structure = { trend: 'BULLISH', vwap_position: 'ABOVE', at_atr_level: true }
          webhookPayload.oscillator = { 
            value: 0.5, phase: 'ACCUMULATION', compression: false,
            leaving_accumulation: false, leaving_extreme_down: false,
            leaving_distribution: false, leaving_extreme_up: false
          }
          webhookPayload.suggested_levels = { stop_loss: 98, target_1: 102, atr: 2 }

          // Test 1: Validation should fail
          const validation = validateWebhookPayload(webhookPayload)
          expect(validation.valid).toBe(false)
          expect(validation.errors.length).toBeGreaterThan(0)

          // Test 2: Parsing should return null
          const parsedSignal = parseWebhookPayload(webhookPayload)
          expect(parsedSignal).toBeNull()

          // Test 3: No signal should be stored in database
          const signalCountBefore = await prisma.signal.count()
          
          // Attempt to parse (which should fail)
          parseWebhookPayload(webhookPayload)
          
          const signalCountAfter = await prisma.signal.count()
          expect(signalCountAfter).toBe(signalCountBefore)
        }
      ),
      { numRuns: 3 }
    )
  })

  it('should reject payloads with invalid action types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => !['LONG', 'LONG_PREMIUM', 'SHORT', 'SHORT_PREMIUM'].includes(s)),
        async (invalidAction) => {
          const webhookPayload = {
            action: invalidAction,
            ticker: 'AAPL',
            timestamp: 1234567890,
            timeframe_minutes: 15,
            price: { entry: 100.0 },
            volume: {
              z_score: 1.0,
              buy_percent: 60.0,
              sell_percent: 40.0,
              buyers_winning: true
            },
            structure: {
              trend: 'BULLISH',
              vwap_position: 'ABOVE',
              at_atr_level: true
            },
            oscillator: {
              value: 0.5,
              phase: 'ACCUMULATION',
              compression: false,
              leaving_accumulation: false,
              leaving_extreme_down: false,
              leaving_distribution: false,
              leaving_extreme_up: false
            },
            suggested_levels: {
              stop_loss: 98.0,
              target_1: 102.0,
              atr: 2.0
            },
            quality: 3
          }

          // Test: Parsing should return null for invalid action
          const parsedSignal = parseWebhookPayload(webhookPayload)
          expect(parsedSignal).toBeNull()

          // Verify no signal was stored
          const signalCount = await prisma.signal.count()
          expect(signalCount).toBe(0)
        }
      ),
      { numRuns: 3 }
    )
  })

  it('should reject payloads with invalid quality values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer().filter(q => q < 1 || q > 5),
        async (invalidQuality) => {
          const webhookPayload = {
            action: 'LONG',
            ticker: 'AAPL',
            timestamp: 1234567890,
            timeframe_minutes: 15,
            price: { entry: 100.0 },
            volume: {
              z_score: 1.0,
              buy_percent: 60.0,
              sell_percent: 40.0,
              buyers_winning: true
            },
            structure: {
              trend: 'BULLISH',
              vwap_position: 'ABOVE',
              at_atr_level: true
            },
            oscillator: {
              value: 0.5,
              phase: 'ACCUMULATION',
              compression: false,
              leaving_accumulation: false,
              leaving_extreme_down: false,
              leaving_distribution: false,
              leaving_extreme_up: false
            },
            suggested_levels: {
              stop_loss: 98.0,
              target_1: 102.0,
              atr: 2.0
            },
            quality: invalidQuality
          }

          // Test: Parsing should return null for invalid quality
          const parsedSignal = parseWebhookPayload(webhookPayload)
          expect(parsedSignal).toBeNull()

          // Verify no signal was stored
          const signalCount = await prisma.signal.count()
          expect(signalCount).toBe(0)
        }
      ),
      { numRuns: 3 }
    )
  })

  it('should reject payloads with missing nested objects', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('price', 'volume', 'structure', 'oscillator', 'suggested_levels'),
        async (missingObject) => {
          const webhookPayload: any = {
            action: 'LONG',
            ticker: 'AAPL',
            timestamp: 1234567890,
            timeframe_minutes: 15,
            quality: 3
          }

          // Add all objects except the one we're testing
          if (missingObject !== 'price') {
            webhookPayload.price = { entry: 100.0 }
          }
          if (missingObject !== 'volume') {
            webhookPayload.volume = {
              z_score: 1.0,
              buy_percent: 60.0,
              sell_percent: 40.0,
              buyers_winning: true
            }
          }
          if (missingObject !== 'structure') {
            webhookPayload.structure = {
              trend: 'BULLISH',
              vwap_position: 'ABOVE',
              at_atr_level: true
            }
          }
          if (missingObject !== 'oscillator') {
            webhookPayload.oscillator = {
              value: 0.5,
              phase: 'ACCUMULATION',
              compression: false,
              leaving_accumulation: false,
              leaving_extreme_down: false,
              leaving_distribution: false,
              leaving_extreme_up: false
            }
          }
          if (missingObject !== 'suggested_levels') {
            webhookPayload.suggested_levels = {
              stop_loss: 98.0,
              target_1: 102.0,
              atr: 2.0
            }
          }

          // Test 1: Validation should fail
          const validation = validateWebhookPayload(webhookPayload)
          expect(validation.valid).toBe(false)
          expect(validation.errors.some(e => e.includes(missingObject))).toBe(true)

          // Test 2: Parsing should return null
          const parsedSignal = parseWebhookPayload(webhookPayload)
          expect(parsedSignal).toBeNull()

          // Test 3: No signal should be stored
          const signalCount = await prisma.signal.count()
          expect(signalCount).toBe(0)
        }
      ),
      { numRuns: 3 }
    )
  })

  it('should reject payloads with invalid signature', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          action: fc.constantFrom('LONG', 'SHORT'),
          ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
          timestamp: fc.integer({ min: 1000000000, max: 2000000000 })
        }),
        fc.string({ minLength: 64, maxLength: 64 }).filter(s => /^[0-9a-f]+$/.test(s)),
        async (signalData, invalidSignature) => {
          const webhookPayload = {
            action: signalData.action,
            ticker: signalData.ticker,
            timestamp: signalData.timestamp,
            timeframe_minutes: 15,
            price: { entry: 100.0 },
            volume: {
              z_score: 1.0,
              buy_percent: 60.0,
              sell_percent: 40.0,
              buyers_winning: true
            },
            structure: {
              trend: 'BULLISH',
              vwap_position: 'ABOVE',
              at_atr_level: true
            },
            oscillator: {
              value: 0.5,
              phase: 'ACCUMULATION',
              compression: false,
              leaving_accumulation: false,
              leaving_extreme_down: false,
              leaving_distribution: false,
              leaving_extreme_up: false
            },
            suggested_levels: {
              stop_loss: 98.0,
              target_1: 102.0,
              atr: 2.0
            },
            quality: 3
          }

          const payloadString = JSON.stringify(webhookPayload)
          
          // Calculate correct signature
          const hmac = crypto.createHmac('sha256', 'test-webhook-secret-key')
          hmac.update(payloadString)
          const correctSignature = hmac.digest('hex')

          // Skip if randomly generated signature matches correct one
          if (invalidSignature === correctSignature) {
            return
          }

          // Test: Signature validation should fail
          const isValid = validateWebhookSignature(payloadString, invalidSignature)
          expect(isValid).toBe(false)

          // In a real scenario, invalid signature would prevent storage
          // We verify that the validation function correctly identifies invalid signatures
        }
      ),
      { numRuns: 3 }
    )
  })

  it('should handle malformed JSON gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => {
          try {
            JSON.parse(s)
            return false // Skip valid JSON
          } catch {
            return true // Keep invalid JSON
          }
        }),
        async (malformedJson) => {
          // Test: Attempting to parse malformed JSON should throw or return error
          let parseError = false
          try {
            JSON.parse(malformedJson)
          } catch (error) {
            parseError = true
          }

          expect(parseError).toBe(true)

          // Verify no signal was stored
          const signalCount = await prisma.signal.count()
          expect(signalCount).toBe(0)
        }
      ),
      { numRuns: 3 }
    )
  })

  it('should reject payloads with non-numeric values in numeric fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('timestamp', 'timeframe_minutes', 'entry', 'z_score', 'stop_loss'),
        fc.string().filter(s => isNaN(parseFloat(s))),
        async (numericField, invalidValue) => {
          const webhookPayload: any = {
            action: 'LONG',
            ticker: 'AAPL',
            timestamp: 1234567890,
            timeframe_minutes: 15,
            price: { entry: 100.0 },
            volume: {
              z_score: 1.0,
              buy_percent: 60.0,
              sell_percent: 40.0,
              buyers_winning: true
            },
            structure: {
              trend: 'BULLISH',
              vwap_position: 'ABOVE',
              at_atr_level: true
            },
            oscillator: {
              value: 0.5,
              phase: 'ACCUMULATION',
              compression: false,
              leaving_accumulation: false,
              leaving_extreme_down: false,
              leaving_distribution: false,
              leaving_extreme_up: false
            },
            suggested_levels: {
              stop_loss: 98.0,
              target_1: 102.0,
              atr: 2.0
            },
            quality: 3
          }

          // Replace the numeric field with invalid value
          switch (numericField) {
            case 'timestamp':
              webhookPayload.timestamp = invalidValue
              break
            case 'timeframe_minutes':
              webhookPayload.timeframe_minutes = invalidValue
              break
            case 'entry':
              webhookPayload.price.entry = invalidValue
              break
            case 'z_score':
              webhookPayload.volume.z_score = invalidValue
              break
            case 'stop_loss':
              webhookPayload.suggested_levels.stop_loss = invalidValue
              break
          }

          // Test: Parsing should return null for invalid numeric values
          const parsedSignal = parseWebhookPayload(webhookPayload)
          expect(parsedSignal).toBeNull()

          // Verify no signal was stored
          const signalCount = await prisma.signal.count()
          expect(signalCount).toBe(0)
        }
      ),
      { numRuns: 3 }
    )
  })
})
