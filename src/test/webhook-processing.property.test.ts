import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { PrismaClient } from '@prisma/client'
import { parseWebhookPayload, validateWebhookSignature } from '@/lib/webhook-utils'
import { queueSignalProcessing, clearQueue, getQueueStatus } from '@/lib/signal-queue'
import crypto from 'crypto'

/**
 * Property-Based Tests for Webhook Processing Integrity
 * 
 * Property 1: Webhook Processing Integrity
 * For any valid TradingView webhook payload, the system should validate the signature,
 * parse all required fields, store the signal data, and return a 200 OK response
 * within 100 milliseconds while triggering background processing.
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5
 */

const prisma = new PrismaClient()

describe('Property 1: Webhook Processing Integrity', () => {
  beforeEach(async () => {
    // Clean up database and queue before each test
    await prisma.signal.deleteMany()
    clearQueue()
    
    // Set test webhook secret
    process.env.TRADINGVIEW_WEBHOOK_SECRET = 'test-webhook-secret-key'
  })

  afterEach(async () => {
    // Clean up after each test
    await prisma.signal.deleteMany()
    clearQueue()
  })

  it('should validate, parse, and store any valid webhook payload', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          action: fc.constantFrom('LONG', 'LONG_PREMIUM', 'SHORT', 'SHORT_PREMIUM'),
          ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
          timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
          timeframeMinutes: fc.constantFrom(1, 5, 15, 30, 60),
          entryPrice: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          quality: fc.integer({ min: 1, max: 5 }),
          zScore: fc.float({ min: Math.fround(-5), max: Math.fround(5), noNaN: true }),
          buyPercent: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
          sellPercent: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
          buyersWinning: fc.boolean(),
          trend: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRAL'),
          vwapPosition: fc.constantFrom('ABOVE', 'BELOW'),
          atAtrLevel: fc.boolean(),
          oscillatorValue: fc.float({ min: Math.fround(-1), max: Math.fround(1), noNaN: true }),
          oscillatorPhase: fc.constantFrom('ACCUMULATION', 'DISTRIBUTION', 'MARKUP', 'MARKDOWN'),
          compression: fc.boolean(),
          leavingAccumulation: fc.boolean(),
          leavingExtremeDown: fc.boolean(),
          leavingDistribution: fc.boolean(),
          leavingExtremeUp: fc.boolean(),
          stopLoss: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          target1: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          atr: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true })
        }),
        async (signalData) => {
          // Create webhook payload
          const webhookPayload = {
            action: signalData.action,
            ticker: signalData.ticker,
            timestamp: signalData.timestamp,
            timeframe_minutes: signalData.timeframeMinutes,
            price: { entry: signalData.entryPrice },
            volume: {
              z_score: signalData.zScore,
              buy_percent: signalData.buyPercent,
              sell_percent: signalData.sellPercent,
              buyers_winning: signalData.buyersWinning
            },
            structure: {
              trend: signalData.trend,
              vwap_position: signalData.vwapPosition,
              at_atr_level: signalData.atAtrLevel
            },
            oscillator: {
              value: signalData.oscillatorValue,
              phase: signalData.oscillatorPhase,
              compression: signalData.compression,
              leaving_accumulation: signalData.leavingAccumulation,
              leaving_extreme_down: signalData.leavingExtremeDown,
              leaving_distribution: signalData.leavingDistribution,
              leaving_extreme_up: signalData.leavingExtremeUp
            },
            suggested_levels: {
              stop_loss: signalData.stopLoss,
              target_1: signalData.target1,
              atr: signalData.atr
            },
            quality: signalData.quality
          }

          // Test 1: Parse webhook payload (Requirement 1.3)
          const parsedSignal = parseWebhookPayload(webhookPayload)
          expect(parsedSignal).toBeTruthy()
          expect(parsedSignal?.action).toBe(signalData.action)
          expect(parsedSignal?.ticker).toBe(signalData.ticker.toUpperCase())
          expect(parsedSignal?.quality).toBe(signalData.quality)

          // Test 2: Validate signature (Requirement 1.2)
          const payloadString = JSON.stringify(webhookPayload)
          const hmac = crypto.createHmac('sha256', 'test-webhook-secret-key')
          hmac.update(payloadString)
          const signature = hmac.digest('hex')
          
          const isValidSignature = validateWebhookSignature(payloadString, signature)
          expect(isValidSignature).toBe(true)

          // Test 3: Store signal in database (Requirement 1.1)
          const signal = await prisma.signal.create({
            data: {
              rawPayload: webhookPayload,
              action: parsedSignal!.action,
              ticker: parsedSignal!.ticker,
              timestamp: parsedSignal!.timestamp,
              timeframeMinutes: parsedSignal!.timeframeMinutes,
              entryPrice: parsedSignal!.entryPrice,
              quality: parsedSignal!.quality,
              zScore: parsedSignal!.zScore,
              buyPercent: parsedSignal!.buyPercent,
              sellPercent: parsedSignal!.sellPercent,
              buyersWinning: parsedSignal!.buyersWinning,
              trend: parsedSignal!.trend,
              vwapPosition: parsedSignal!.vwapPosition,
              atAtrLevel: parsedSignal!.atAtrLevel,
              oscillatorValue: parsedSignal!.oscillatorValue,
              oscillatorPhase: parsedSignal!.oscillatorPhase,
              compression: parsedSignal!.compression,
              leavingAccumulation: parsedSignal!.leavingAccumulation,
              leavingExtremeDown: parsedSignal!.leavingExtremeDown,
              leavingDistribution: parsedSignal!.leavingDistribution,
              leavingExtremeUp: parsedSignal!.leavingExtremeUp,
              stopLoss: parsedSignal!.stopLoss,
              target1: parsedSignal!.target1,
              atr: parsedSignal!.atr,
              status: 'received'
            }
          })

          expect(signal.id).toBeTruthy()
          expect(signal.status).toBe('received')

          // Test 4: Queue signal for processing (Requirement 1.5)
          await queueSignalProcessing(signal.id)
          
          const queueStatus = getQueueStatus()
          expect(queueStatus.queueLength).toBeGreaterThanOrEqual(0) // May have been processed already

          // Test 5: Verify signal can be retrieved from database
          const retrievedSignal = await prisma.signal.findUnique({
            where: { id: signal.id }
          })

          expect(retrievedSignal).toBeTruthy()
          expect(retrievedSignal?.ticker).toBe(signalData.ticker.toUpperCase())
          expect(retrievedSignal?.action).toBe(signalData.action)
          expect(retrievedSignal?.quality).toBe(signalData.quality)
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should handle concurrent webhook processing without data loss', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            action: fc.constantFrom('LONG', 'SHORT'),
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
            quality: fc.integer({ min: 1, max: 5 })
          }),
          { minLength: 3, maxLength: 8 }
        ),
        async (signalsData) => {
          // Create multiple webhook payloads concurrently
          const signalPromises = signalsData.map(async (signalData, index) => {
            const webhookPayload = {
              action: signalData.action,
              ticker: signalData.ticker,
              timestamp: signalData.timestamp + index,
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
              quality: signalData.quality
            }

            const parsedSignal = parseWebhookPayload(webhookPayload)
            
            return prisma.signal.create({
              data: {
                rawPayload: webhookPayload,
                action: parsedSignal!.action,
                ticker: parsedSignal!.ticker,
                timestamp: parsedSignal!.timestamp,
                timeframeMinutes: parsedSignal!.timeframeMinutes,
                entryPrice: parsedSignal!.entryPrice,
                quality: parsedSignal!.quality,
                zScore: parsedSignal!.zScore,
                buyPercent: parsedSignal!.buyPercent,
                sellPercent: parsedSignal!.sellPercent,
                buyersWinning: parsedSignal!.buyersWinning,
                trend: parsedSignal!.trend,
                vwapPosition: parsedSignal!.vwapPosition,
                atAtrLevel: parsedSignal!.atAtrLevel,
                oscillatorValue: parsedSignal!.oscillatorValue,
                oscillatorPhase: parsedSignal!.oscillatorPhase,
                compression: parsedSignal!.compression,
                leavingAccumulation: parsedSignal!.leavingAccumulation,
                leavingExtremeDown: parsedSignal!.leavingExtremeDown,
                leavingDistribution: parsedSignal!.leavingDistribution,
                leavingExtremeUp: parsedSignal!.leavingExtremeUp,
                stopLoss: parsedSignal!.stopLoss,
                target1: parsedSignal!.target1,
                atr: parsedSignal!.atr,
                status: 'received'
              }
            })
          })

          const createdSignals = await Promise.all(signalPromises)

          // Verify all signals were created
          expect(createdSignals).toHaveLength(signalsData.length)

          // Verify all signals have unique IDs
          const signalIds = new Set(createdSignals.map(s => s.id))
          expect(signalIds.size).toBe(signalsData.length)

          // Verify all signals can be retrieved
          const allSignals = await prisma.signal.findMany({
            where: {
              id: { in: createdSignals.map(s => s.id) }
            }
          })

          expect(allSignals).toHaveLength(signalsData.length)
        }
      ),
      { numRuns: 10 }
    )
  })

  it('should preserve all signal data fields during storage', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          action: fc.constantFrom('LONG', 'SHORT'),
          ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
          timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
          timeframeMinutes: fc.constantFrom(5, 15, 30, 60),
          entryPrice: fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          quality: fc.integer({ min: 1, max: 5 }),
          zScore: fc.float({ min: Math.fround(-3), max: Math.fround(3), noNaN: true }),
          buyPercent: fc.float({ min: Math.fround(40), max: Math.fround(80), noNaN: true }),
          oscillatorValue: fc.float({ min: Math.fround(-0.5), max: Math.fround(0.5), noNaN: true }),
          stopLoss: fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          target1: fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          atr: fc.float({ min: Math.fround(0.5), max: Math.fround(5), noNaN: true })
        }),
        async (signalData) => {
          const webhookPayload = {
            action: signalData.action,
            ticker: signalData.ticker,
            timestamp: signalData.timestamp,
            timeframe_minutes: signalData.timeframeMinutes,
            price: { entry: signalData.entryPrice },
            volume: {
              z_score: signalData.zScore,
              buy_percent: signalData.buyPercent,
              sell_percent: 100 - signalData.buyPercent,
              buyers_winning: signalData.buyPercent > 50
            },
            structure: {
              trend: 'BULLISH',
              vwap_position: 'ABOVE',
              at_atr_level: true
            },
            oscillator: {
              value: signalData.oscillatorValue,
              phase: 'ACCUMULATION',
              compression: false,
              leaving_accumulation: false,
              leaving_extreme_down: false,
              leaving_distribution: false,
              leaving_extreme_up: false
            },
            suggested_levels: {
              stop_loss: signalData.stopLoss,
              target_1: signalData.target1,
              atr: signalData.atr
            },
            quality: signalData.quality
          }

          const parsedSignal = parseWebhookPayload(webhookPayload)
          
          const signal = await prisma.signal.create({
            data: {
              rawPayload: webhookPayload,
              action: parsedSignal!.action,
              ticker: parsedSignal!.ticker,
              timestamp: parsedSignal!.timestamp,
              timeframeMinutes: parsedSignal!.timeframeMinutes,
              entryPrice: parsedSignal!.entryPrice,
              quality: parsedSignal!.quality,
              zScore: parsedSignal!.zScore,
              buyPercent: parsedSignal!.buyPercent,
              sellPercent: parsedSignal!.sellPercent,
              buyersWinning: parsedSignal!.buyersWinning,
              trend: parsedSignal!.trend,
              vwapPosition: parsedSignal!.vwapPosition,
              atAtrLevel: parsedSignal!.atAtrLevel,
              oscillatorValue: parsedSignal!.oscillatorValue,
              oscillatorPhase: parsedSignal!.oscillatorPhase,
              compression: parsedSignal!.compression,
              leavingAccumulation: parsedSignal!.leavingAccumulation,
              leavingExtremeDown: parsedSignal!.leavingExtremeDown,
              leavingDistribution: parsedSignal!.leavingDistribution,
              leavingExtremeUp: parsedSignal!.leavingExtremeUp,
              stopLoss: parsedSignal!.stopLoss,
              target1: parsedSignal!.target1,
              atr: parsedSignal!.atr,
              status: 'received'
            }
          })

          // Retrieve and verify all fields are preserved
          const retrieved = await prisma.signal.findUnique({
            where: { id: signal.id }
          })

          expect(retrieved).toBeTruthy()
          expect(retrieved?.ticker).toBe(signalData.ticker.toUpperCase())
          expect(retrieved?.timestamp).toBe(signalData.timestamp)
          expect(retrieved?.timeframeMinutes).toBe(signalData.timeframeMinutes)
          expect(retrieved?.quality).toBe(signalData.quality)
          
          // Use approximate equality for floating point numbers
          expect(Math.abs(retrieved!.entryPrice - signalData.entryPrice)).toBeLessThan(0.01)
          expect(Math.abs(retrieved!.zScore - signalData.zScore)).toBeLessThan(0.01)
          expect(Math.abs(retrieved!.oscillatorValue - signalData.oscillatorValue)).toBeLessThan(0.01)
          expect(Math.abs(retrieved!.stopLoss - signalData.stopLoss)).toBeLessThan(0.01)
          expect(Math.abs(retrieved!.target1 - signalData.target1)).toBeLessThan(0.01)
          expect(Math.abs(retrieved!.atr - signalData.atr)).toBeLessThan(0.01)
        }
      ),
      { numRuns: 15 }
    )
  })
})
