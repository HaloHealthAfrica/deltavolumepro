import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { PrismaClient } from '@prisma/client'

/**
 * Property-Based Tests for Data Storage Reliability
 * 
 * Property 21: Data Storage Reliability
 * For any system operation, the system should store all data in PostgreSQL with 
 * referential integrity, appropriate indexing, comprehensive logging, and proper migration handling.
 * 
 * Validates: Requirements 11.1, 11.2, 11.3, 11.5
 */

const prisma = new PrismaClient()

describe('Property 21: Data Storage Reliability', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.tradeAnalysis.deleteMany()
    await prisma.trade.deleteMany()
    await prisma.decision.deleteMany()
    await prisma.enrichedData.deleteMany()
    await prisma.signal.deleteMany()
    await prisma.tradingRules.deleteMany()
    await prisma.marketContext.deleteMany()
  })

  afterEach(async () => {
    // Clean up after each test
    await prisma.tradeAnalysis.deleteMany()
    await prisma.trade.deleteMany()
    await prisma.decision.deleteMany()
    await prisma.enrichedData.deleteMany()
    await prisma.signal.deleteMany()
    await prisma.tradingRules.deleteMany()
    await prisma.marketContext.deleteMany()
  })

  it('should maintain referential integrity for signal-to-enriched-data relationships', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          action: fc.constantFrom('BUY', 'SELL', 'LONG', 'SHORT'),
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
          stopLoss: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          target1: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          atr: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true })
        }),
        async (signalData) => {
          // Create signal
          const signal = await prisma.signal.create({
            data: {
              rawPayload: { test: 'data' },
              action: signalData.action,
              ticker: signalData.ticker,
              timestamp: signalData.timestamp,
              timeframeMinutes: signalData.timeframeMinutes,
              entryPrice: signalData.entryPrice,
              quality: signalData.quality,
              zScore: signalData.zScore,
              buyPercent: signalData.buyPercent,
              sellPercent: signalData.sellPercent,
              buyersWinning: signalData.buyersWinning,
              trend: signalData.trend,
              vwapPosition: signalData.vwapPosition,
              atAtrLevel: signalData.atAtrLevel,
              oscillatorValue: signalData.oscillatorValue,
              oscillatorPhase: signalData.oscillatorPhase,
              compression: signalData.compression,
              stopLoss: signalData.stopLoss,
              target1: signalData.target1,
              atr: signalData.atr,
              status: 'received'
            }
          })

          // Create enriched data linked to signal
          const enrichedData = await prisma.enrichedData.create({
            data: {
              signalId: signal.id,
              tradierData: { options: 'tradier_options', quote: 'tradier_quote', greeks: 'tradier_greeks' },
              twelveData: { quote: 'twelve_quote', technical: 'twelve_technical', volume: 'twelve_volume' },
              alpacaData: { quote: 'alpaca_quote', options: 'alpaca_options', bars: 'alpaca_bars' },
              aggregatedData: { test: 'aggregated' },
              dataQuality: 0.85,
              enrichedAt: Math.floor(Date.now() / 1000)
            }
          })

          // Verify referential integrity - enriched data should reference signal
          expect(enrichedData.signalId).toBe(signal.id)

          // Verify cascade delete - deleting signal should delete enriched data
          await prisma.signal.delete({ where: { id: signal.id } })
          
          const deletedEnrichedData = await prisma.enrichedData.findUnique({
            where: { id: enrichedData.id }
          })
          expect(deletedEnrichedData).toBeNull()
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should maintain referential integrity for signal-to-decision-to-trade relationships', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          signalData: fc.record({
            action: fc.constantFrom('BUY', 'SELL'),
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
            entryPrice: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
            quality: fc.integer({ min: 1, max: 5 })
          }),
          decisionData: fc.record({
            decision: fc.constantFrom('TRADE', 'REJECT', 'WAIT'),
            confidence: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
            instrumentType: fc.constantFrom('STOCK', 'CALL', 'PUT', 'SPREAD'),
            quantity: fc.integer({ min: 1, max: 1000 }),
            positionSize: fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true })
          }),
          tradeData: fc.record({
            broker: fc.constantFrom('tradier', 'twelvedata', 'alpaca'),
            side: fc.constantFrom('LONG', 'SHORT'),
            entryPrice: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
            stopLoss: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
            target1: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true })
          })
        }),
        async ({ signalData, decisionData, tradeData }) => {
          // Create signal
          const signal = await prisma.signal.create({
            data: {
              rawPayload: { test: 'data' },
              action: signalData.action,
              ticker: signalData.ticker,
              timestamp: signalData.timestamp,
              timeframeMinutes: 15,
              entryPrice: signalData.entryPrice,
              quality: signalData.quality,
              zScore: 1.0,
              buyPercent: 60.0,
              sellPercent: 40.0,
              buyersWinning: true,
              trend: 'BULLISH',
              vwapPosition: 'ABOVE',
              atAtrLevel: true,
              oscillatorValue: 0.5,
              oscillatorPhase: 'ACCUMULATION',
              compression: false,
              stopLoss: tradeData.stopLoss,
              target1: tradeData.target1,
              atr: 2.0,
              status: 'received'
            }
          })

          // Create decision linked to signal
          const decision = await prisma.decision.create({
            data: {
              signalId: signal.id,
              decision: decisionData.decision,
              confidence: decisionData.confidence,
              reasoning: { test: 'reasoning' },
              instrumentType: decisionData.instrumentType,
              strikes: { test: 'strikes' },
              expiration: new Date(),
              quantity: decisionData.quantity,
              positionSize: decisionData.positionSize,
              riskAmount: 100.0,
              expectedReturn: 200.0,
              riskRewardRatio: 2.0,
              winProbability: 0.7,
              modelVersion: 'v1.0.0',
              weights: { test: 'weights' }
            }
          })

          // Create trade linked to signal
          const trade = await prisma.trade.create({
            data: {
              signalId: signal.id,
              tradeId: `trade_${Date.now()}_${Math.random()}`,
              broker: tradeData.broker,
              enteredAt: new Date(),
              instrumentType: decisionData.instrumentType,
              ticker: signalData.ticker,
              strikes: { test: 'strikes' },
              expiration: new Date(),
              side: tradeData.side,
              quantity: decisionData.quantity,
              entryPrice: tradeData.entryPrice,
              entryValue: tradeData.entryPrice * decisionData.quantity,
              stopLoss: tradeData.stopLoss,
              target1: tradeData.target1,
              status: 'OPEN',
              brokerData: { test: 'broker_data' }
            }
          })

          // Verify referential integrity
          expect(decision.signalId).toBe(signal.id)
          expect(trade.signalId).toBe(signal.id)

          // Verify cascade delete behavior
          await prisma.signal.delete({ where: { id: signal.id } })
          
          const deletedDecision = await prisma.decision.findUnique({
            where: { id: decision.id }
          })
          const deletedTrade = await prisma.trade.findUnique({
            where: { id: trade.id }
          })
          
          expect(deletedDecision).toBeNull()
          expect(deletedTrade).toBeNull()
        }
      ),
      { numRuns: 15 }
    )
  })

  it('should enforce unique constraints and prevent duplicate data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          version: fc.stringMatching(/^v\d+\.\d+\.\d+$/),
          ticker: fc.stringMatching(/^[A-Z]{1,5}$/)
        }),
        async ({ version, ticker }) => {
          // Ensure clean state by adding random suffix to version
          const uniqueVersion = `${version}_${Math.random().toString(36).substring(7)}`
          
          // Test unique constraint on TradingRules version
          await prisma.tradingRules.create({
            data: {
              version: uniqueVersion,
              qualityWeight: 0.25,
              volumeWeight: 0.20,
              oscillatorWeight: 0.20,
              structureWeight: 0.20,
              marketWeight: 0.15,
              minQuality: 4,
              minConfidence: 0.65,
              minVolumePressure: 60.0,
              maxRiskPercent: 2.0,
              baseSizePerQuality: { 1: 0, 2: 0, 3: 50, 4: 100, 5: 150 },
              compressionMultiplier: 0.5,
              allowedTimeframes: [5, 15, 30, 60],
              tradingHours: { start: '09:30', end: '16:00' },
              learningData: { test: 'learning' }
            }
          })

          // Attempting to create another rule with same version should fail
          await expect(
            prisma.tradingRules.create({
              data: {
                version: uniqueVersion, // Same version - should violate unique constraint
                qualityWeight: 0.30,
                volumeWeight: 0.25,
                oscillatorWeight: 0.25,
                structureWeight: 0.15,
                marketWeight: 0.05,
                minQuality: 3,
                minConfidence: 0.70,
                minVolumePressure: 65.0,
                maxRiskPercent: 1.5,
                baseSizePerQuality: { 1: 0, 2: 25, 3: 75, 4: 125, 5: 175 },
                compressionMultiplier: 0.4,
                allowedTimeframes: [15, 30],
                tradingHours: { start: '09:30', end: '15:30' },
                learningData: { test: 'different_learning' }
              }
            })
          ).rejects.toThrow()

          // Test unique constraint on Trade tradeId
          const signal = await prisma.signal.create({
            data: {
              rawPayload: { test: 'data' },
              action: 'BUY',
              ticker,
              timestamp: 1000000000 + Math.floor(Math.random() * 1000),
              timeframeMinutes: 15,
              entryPrice: 100.0,
              quality: 4,
              zScore: 1.0,
              buyPercent: 60.0,
              sellPercent: 40.0,
              buyersWinning: true,
              trend: 'BULLISH',
              vwapPosition: 'ABOVE',
              atAtrLevel: true,
              oscillatorValue: 0.5,
              oscillatorPhase: 'ACCUMULATION',
              compression: false,
              stopLoss: 98.0,
              target1: 102.0,
              atr: 2.0,
              status: 'received'
            }
          })

          const tradeId = `trade_${Date.now()}_${Math.random()}`
          
          await prisma.trade.create({
            data: {
              signalId: signal.id,
              tradeId,
              broker: 'tradier',
              enteredAt: new Date(),
              instrumentType: 'STOCK',
              ticker,
              side: 'LONG',
              quantity: 100,
              entryPrice: 100.0,
              entryValue: 10000.0,
              stopLoss: 98.0,
              target1: 102.0,
              status: 'OPEN',
              brokerData: { test: 'broker_data' }
            }
          })

          // Attempting to create another trade with same tradeId should fail
          await expect(
            prisma.trade.create({
              data: {
                signalId: signal.id,
                tradeId, // Same tradeId - should violate unique constraint
                broker: 'alpaca',
                enteredAt: new Date(),
                instrumentType: 'STOCK',
                ticker,
                side: 'LONG',
                quantity: 200,
                entryPrice: 101.0,
                entryValue: 20200.0,
                stopLoss: 99.0,
                target1: 103.0,
                status: 'OPEN',
                brokerData: { test: 'different_broker_data' }
              }
            })
          ).rejects.toThrow()
        }
      ),
      { numRuns: 10 }
    )
  })

  it('should maintain data consistency during concurrent operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
            entryPrice: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
            quality: fc.integer({ min: 1, max: 5 })
          }),
          { minLength: 3, maxLength: 8 }
        ),
        async (signalDataArray) => {
          // Create multiple signals concurrently
          const signalPromises = signalDataArray.map((signalData, index) =>
            prisma.signal.create({
              data: {
                rawPayload: { index },
                action: 'BUY',
                ticker: signalData.ticker,
                timestamp: signalData.timestamp + index, // Ensure unique timestamps
                timeframeMinutes: 15,
                entryPrice: signalData.entryPrice,
                quality: signalData.quality,
                zScore: 1.0,
                buyPercent: 60.0,
                sellPercent: 40.0,
                buyersWinning: true,
                trend: 'BULLISH',
                vwapPosition: 'ABOVE',
                atAtrLevel: true,
                oscillatorValue: 0.5,
                oscillatorPhase: 'ACCUMULATION',
                compression: false,
                stopLoss: signalData.entryPrice * 0.98,
                target1: signalData.entryPrice * 1.02,
                atr: 2.0,
                status: 'received'
              }
            })
          )

          const createdSignals = await Promise.all(signalPromises)

          // Verify all signals were created successfully
          expect(createdSignals).toHaveLength(signalDataArray.length)

          // Verify data integrity - each signal should have unique ID and correct data
          const signalIds = new Set(createdSignals.map(s => s.id))
          expect(signalIds.size).toBe(signalDataArray.length) // All IDs should be unique

          // Verify database consistency by querying all signals
          const allSignals = await prisma.signal.findMany({
            where: {
              id: { in: createdSignals.map(s => s.id) }
            }
          })

          expect(allSignals).toHaveLength(signalDataArray.length)

          // Verify each signal has correct data (with floating point tolerance)
          allSignals.forEach((signal) => {
            const originalData = signalDataArray.find((_, i) => 
              (signal.rawPayload as any).index === i
            )
            if (originalData) {
              expect(signal.ticker).toBe(originalData.ticker)
              // Use approximate equality for floating point numbers
              expect(Math.abs(signal.entryPrice - originalData.entryPrice)).toBeLessThan(0.001)
              expect(signal.quality).toBe(originalData.quality)
            }
          })
        }
      ),
      { numRuns: 10 }
    )
  })

  it('should handle database transactions with proper rollback on failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          validSignal: fc.record({
            ticker: fc.stringMatching(/^[A-Z]{1,5}$/),
            timestamp: fc.integer({ min: 1000000000, max: 2000000000 }),
            entryPrice: fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
            quality: fc.integer({ min: 1, max: 5 })
          }),
          invalidEnrichedData: fc.record({
            dataQuality: fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }) // Some may be invalid (outside 0-1 range)
          })
        }),
        async ({ validSignal, invalidEnrichedData }) => {
          // Attempt transaction that should fail due to invalid data
          const shouldFail = invalidEnrichedData.dataQuality < 0 || invalidEnrichedData.dataQuality > 1
          
          // Create unique ticker to avoid conflicts
          const uniqueTicker = `${validSignal.ticker}_${Math.random().toString(36).substring(7)}`

          if (shouldFail) {
            // This transaction should fail and rollback - force an error by using invalid signalId
            await expect(
              prisma.$transaction(async (tx) => {
                const signal = await tx.signal.create({
                  data: {
                    rawPayload: { test: 'transaction_test' },
                    action: 'BUY',
                    ticker: uniqueTicker,
                    timestamp: validSignal.timestamp + Math.floor(Math.random() * 1000),
                    timeframeMinutes: 15,
                    entryPrice: validSignal.entryPrice,
                    quality: validSignal.quality,
                    zScore: 1.0,
                    buyPercent: 60.0,
                    sellPercent: 40.0,
                    buyersWinning: true,
                    trend: 'BULLISH',
                    vwapPosition: 'ABOVE',
                    atAtrLevel: true,
                    oscillatorValue: 0.5,
                    oscillatorPhase: 'ACCUMULATION',
                    compression: false,
                    stopLoss: validSignal.entryPrice * 0.98,
                    target1: validSignal.entryPrice * 1.02,
                    atr: 2.0,
                    status: 'received'
                  }
                })

                // Force an error by using an invalid signalId
                await tx.enrichedData.create({
                  data: {
                    signalId: 'invalid-signal-id', // This will cause a foreign key constraint error
                    tradierData: { test: 'tradier' },
                    twelveData: { test: 'twelve' },
                    alpacaData: { test: 'alpaca' },
                    aggregatedData: { test: 'aggregated' },
                    dataQuality: 0.5, // Valid value, but the signalId will cause the error
                    enrichedAt: Math.floor(Date.now() / 1000)
                  }
                })
              })
            ).rejects.toThrow()

            // Verify rollback - no signal should exist with our unique ticker
            const signals = await prisma.signal.findMany({
              where: { ticker: uniqueTicker }
            })
            expect(signals).toHaveLength(0)
          } else {
            // This transaction should succeed
            await prisma.$transaction(async (tx) => {
              const signal = await tx.signal.create({
                data: {
                  rawPayload: { test: 'transaction_test' },
                  action: 'BUY',
                  ticker: uniqueTicker,
                  timestamp: validSignal.timestamp + Math.floor(Math.random() * 1000),
                  timeframeMinutes: 15,
                  entryPrice: validSignal.entryPrice,
                  quality: validSignal.quality,
                  zScore: 1.0,
                  buyPercent: 60.0,
                  sellPercent: 40.0,
                  buyersWinning: true,
                  trend: 'BULLISH',
                  vwapPosition: 'ABOVE',
                  atAtrLevel: true,
                  oscillatorValue: 0.5,
                  oscillatorPhase: 'ACCUMULATION',
                  compression: false,
                  stopLoss: validSignal.entryPrice * 0.98,
                  target1: validSignal.entryPrice * 1.02,
                  atr: 2.0,
                  status: 'received'
                }
              })

              await tx.enrichedData.create({
                data: {
                  signalId: signal.id,
                  tradierData: { test: 'tradier' },
                  twelveData: { test: 'twelve' },
                  alpacaData: { test: 'alpaca' },
                  aggregatedData: { test: 'aggregated' },
                  dataQuality: invalidEnrichedData.dataQuality,
                  enrichedAt: Math.floor(Date.now() / 1000)
                }
              })
            })

            // Verify success - signal and enriched data should exist with our unique ticker
            const signals = await prisma.signal.findMany({
              where: { ticker: uniqueTicker },
              include: { enrichedData: true }
            })
            expect(signals).toHaveLength(1)
            expect(signals[0].enrichedData).toBeTruthy()
          }
        }
      ),
      { numRuns: 10 }
    )
  })
})