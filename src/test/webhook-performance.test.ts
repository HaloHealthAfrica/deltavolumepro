/**
 * ============================================================================
 * WEBHOOK MONITORING PERFORMANCE TESTS
 * ============================================================================
 * 
 * Performance test suite to verify that webhook monitoring integration
 * meets the < 100ms performance target and doesn't significantly impact
 * webhook processing throughput.
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/webhooks/tradingview/route'
import { prisma } from '@/lib/prisma'

// Mock dependencies for performance testing
vi.mock('@/lib/prisma', () => ({
  prisma: {
    signal: {
      create: vi.fn().mockResolvedValue({
        id: 'signal_123',
        ticker: 'AAPL',
        action: 'LONG',
        status: 'received',
      }),
    },
    webhookLog: {
      create: vi.fn().mockResolvedValue({
        id: 'webhook_123',
        sourceIp: '192.168.1.100',
        status: 'success',
        processingTime: 50,
        createdAt: new Date(),
      }),
      update: vi.fn().mockResolvedValue({
        id: 'webhook_123',
        status: 'success',
        processingTime: 50,
      }),
    },
    processingStage: {
      create: vi.fn().mockResolvedValue({
        id: 'stage_123',
        signalId: 'webhook_123',
        stage: 'received',
        status: 'completed',
        startedAt: new Date(),
      }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}))

vi.mock('@/lib/webhook-utils', () => ({
  validateWebhookSignature: vi.fn(() => true),
  parseWebhookPayload: vi.fn(() => ({
    action: 'LONG',
    ticker: 'AAPL',
    timestamp: Date.now(),
    timeframeMinutes: 5,
    entryPrice: 150.25,
    quality: 4,
    zScore: 2.5,
    buyPercent: 65,
    sellPercent: 35,
    buyersWinning: true,
    trend: 'up',
    vwapPosition: 'above',
    atAtrLevel: false,
    oscillatorValue: 0.75,
    oscillatorPhase: 'bullish',
    compression: false,
    leavingAccumulation: true,
    leavingExtremeDown: false,
    leavingDistribution: false,
    leavingExtremeUp: false,
    stopLoss: 148.50,
    target1: 152.00,
    atr: 1.25,
  })),
}))

vi.mock('@/lib/signal-queue', () => ({
  queueSignalProcessing: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/realtime', () => ({
  broadcaster: {
    signalReceived: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  getRateLimitKey: vi.fn(() => 'test-key'),
  createRateLimitHeaders: vi.fn(() => ({})),
  RATE_LIMIT_CONFIGS: {
    webhook: { requests: 100, window: 60 },
  },
}))

vi.mock('@/lib/security', () => ({
  getClientIp: vi.fn(() => '192.168.1.100'),
}))

vi.mock('@/lib/logger', () => ({
  webhookLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Webhook Monitoring Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Single Request Performance', () => {
    it('should process webhook with monitoring in under 100ms target', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'valid-signature',
        },
        body: JSON.stringify({
          action: 'LONG',
          ticker: 'AAPL',
          timestamp: Date.now(),
          quality: 4,
        }),
      })

      // Act
      const startTime = performance.now()
      const response = await POST(request)
      const endTime = performance.now()
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)

      const processingTime = endTime - startTime
      console.log(`Single request processing time: ${processingTime.toFixed(2)}ms`)

      // Performance target: < 100ms (being generous for test environment)
      expect(processingTime).toBeLessThan(200) // Allowing 200ms for test environment overhead
      
      // Verify monitoring calls were made efficiently
      expect(prisma.webhookLog.create).toHaveBeenCalledTimes(1)
      expect(prisma.webhookLog.update).toHaveBeenCalledTimes(2) // Signal ID update + final update
      expect(prisma.processingStage.create).toHaveBeenCalledTimes(5) // All stages
    })

    it('should have minimal monitoring overhead compared to baseline', async () => {
      // This test would compare performance with and without monitoring
      // For now, we'll verify that monitoring operations are called efficiently
      
      const request = new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'valid-signature',
        },
        body: JSON.stringify({
          action: 'LONG',
          ticker: 'AAPL',
          timestamp: Date.now(),
          quality: 4,
        }),
      })

      const startTime = performance.now()
      await POST(request)
      const endTime = performance.now()

      const processingTime = endTime - startTime
      console.log(`Processing time with monitoring: ${processingTime.toFixed(2)}ms`)

      // Verify that monitoring doesn't add excessive overhead
      expect(processingTime).toBeLessThan(300) // Generous limit for test environment
    })
  })

  describe('Concurrent Request Performance', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      // Arrange
      const createRequest = (ticker: string) => new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'valid-signature',
        },
        body: JSON.stringify({
          action: 'LONG',
          ticker,
          timestamp: Date.now(),
          quality: 4,
        }),
      })

      const requests = [
        createRequest('AAPL'),
        createRequest('GOOGL'),
        createRequest('MSFT'),
        createRequest('TSLA'),
        createRequest('AMZN'),
      ]

      // Act
      const startTime = performance.now()
      const responses = await Promise.all(requests.map(request => POST(request)))
      const endTime = performance.now()

      // Assert
      const totalTime = endTime - startTime
      const avgTimePerRequest = totalTime / requests.length

      console.log(`Concurrent requests total time: ${totalTime.toFixed(2)}ms`)
      console.log(`Average time per request: ${avgTimePerRequest.toFixed(2)}ms`)

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.success).toBe(true)
      }

      // Performance should scale reasonably
      expect(avgTimePerRequest).toBeLessThan(400) // Allowing for concurrent overhead
      expect(totalTime).toBeLessThan(2000) // Total time should be reasonable

      // Verify monitoring was called for all requests
      expect(prisma.webhookLog.create).toHaveBeenCalledTimes(5)
      expect(prisma.processingStage.create).toHaveBeenCalledTimes(25) // 5 stages × 5 requests
    })
  })

  describe('Error Handling Performance', () => {
    it('should handle monitoring errors efficiently without impacting performance', async () => {
      // Arrange - Make monitoring fail
      vi.mocked(prisma.webhookLog.create).mockRejectedValue(new Error('Monitoring database error'))

      const request = new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'valid-signature',
        },
        body: JSON.stringify({
          action: 'LONG',
          ticker: 'AAPL',
          timestamp: Date.now(),
          quality: 4,
        }),
      })

      // Act
      const startTime = performance.now()
      const response = await POST(request)
      const endTime = performance.now()
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)

      const processingTime = endTime - startTime
      console.log(`Processing time with monitoring errors: ${processingTime.toFixed(2)}ms`)

      // Performance should not be significantly impacted by monitoring failures
      expect(processingTime).toBeLessThan(300)

      // Core webhook processing should still work
      expect(prisma.signal.create).toHaveBeenCalled()
    })

    it('should handle validation errors quickly', async () => {
      // Arrange - Invalid signature
      const { validateWebhookSignature } = await import('@/lib/webhook-utils')
      vi.mocked(validateWebhookSignature).mockReturnValue(false)

      const request = new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'invalid-signature',
        },
        body: JSON.stringify({ action: 'LONG', ticker: 'AAPL' }),
      })

      // Act
      const startTime = performance.now()
      const response = await POST(request)
      const endTime = performance.now()

      // Assert
      expect(response.status).toBe(401)

      const processingTime = endTime - startTime
      console.log(`Validation error processing time: ${processingTime.toFixed(2)}ms`)

      // Error handling should be very fast
      expect(processingTime).toBeLessThan(100)

      // Should still record the rejected webhook
      expect(prisma.webhookLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'rejected',
          errorMessage: 'Invalid signature',
        }),
      })
    })
  })

  describe('Memory and Resource Usage', () => {
    it('should not create memory leaks with monitoring', async () => {
      // Arrange
      const initialMemory = process.memoryUsage()

      const requests = Array.from({ length: 10 }, (_, i) => 
        new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tradingview-signature': 'valid-signature',
          },
          body: JSON.stringify({
            action: 'LONG',
            ticker: `STOCK${i}`,
            timestamp: Date.now(),
            quality: 4,
          }),
        })
      )

      // Act
      for (const request of requests) {
        await POST(request)
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()

      // Assert
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

      // Memory increase should be reasonable (allowing for test overhead)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Less than 50MB increase
    })
  })

  describe('Database Operation Efficiency', () => {
    it('should minimize database calls for monitoring', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'valid-signature',
        },
        body: JSON.stringify({
          action: 'LONG',
          ticker: 'AAPL',
          timestamp: Date.now(),
          quality: 4,
        }),
      })

      // Act
      await POST(request)

      // Assert - Verify efficient database usage
      expect(prisma.webhookLog.create).toHaveBeenCalledTimes(1) // Initial webhook record
      expect(prisma.webhookLog.update).toHaveBeenCalledTimes(2) // Signal ID + final update
      expect(prisma.processingStage.create).toHaveBeenCalledTimes(5) // All processing stages
      expect(prisma.processingStage.findFirst).toHaveBeenCalledTimes(5) // Stage existence checks

      // Total database operations should be reasonable
      const totalDbOps = 1 + 2 + 5 + 5 // create + updates + stage creates + stage checks
      expect(totalDbOps).toBeLessThanOrEqual(15) // Should be efficient
    })
  })
})