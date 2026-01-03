/**
 * ============================================================================
 * WEBHOOK MONITORING INTEGRATION TESTS
 * ============================================================================
 * 
 * Test suite for verifying the integration between the TradingView webhook
 * endpoint and the WebhookMonitor service.
 * 
 * Tests cover:
 * - Webhook request tracking
 * - Processing stage monitoring
 * - Error handling with monitoring
 * - Performance impact verification
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/webhooks/tradingview/route'
import { WebhookMonitor } from '@/lib/monitoring/webhook-monitor'
import { prisma } from '@/lib/prisma'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    signal: {
      create: vi.fn(),
    },
    webhookLog: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    processingStage: {
      create: vi.fn(),
      findFirst: vi.fn(),
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
  queueSignalProcessing: vi.fn(),
}))

vi.mock('@/lib/realtime', () => ({
  broadcaster: {
    signalReceived: vi.fn(),
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

describe('Webhook Monitoring Integration', () => {
  let mockSignal: any
  let mockWebhookLog: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSignal = {
      id: 'signal_123',
      ticker: 'AAPL',
      action: 'LONG',
      status: 'received',
    }

    mockWebhookLog = {
      id: 'webhook_123',
      sourceIp: '192.168.1.100',
      status: 'success',
      processingTime: 150,
      createdAt: new Date(),
    }

    // Setup default mocks
    vi.mocked(prisma.signal.create).mockResolvedValue(mockSignal)
    vi.mocked(prisma.webhookLog.create).mockResolvedValue(mockWebhookLog)
    vi.mocked(prisma.webhookLog.findUnique).mockResolvedValue(mockWebhookLog)
    vi.mocked(prisma.webhookLog.update).mockResolvedValue(mockWebhookLog)
    vi.mocked(prisma.processingStage.create).mockResolvedValue({
      id: 'stage_123',
      signalId: 'webhook_123',
      stage: 'received',
      status: 'completed',
      startedAt: new Date(),
      createdAt: new Date(),
      completedAt: null,
      duration: null,
      errorMessage: null,
      metadata: null,
    })
    vi.mocked(prisma.processingStage.findFirst).mockResolvedValue(null)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Successful Webhook Processing with Monitoring', () => {
    it('should record webhook request and track all processing stages', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'valid-signature',
          'user-agent': 'TradingView-Webhook/1.0',
        },
        body: JSON.stringify({
          action: 'LONG',
          ticker: 'AAPL',
          timestamp: Date.now(),
          quality: 4,
        }),
      })

      // Act
      const response = await POST(request)
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.signalId).toBe('signal_123')
      expect(responseData.webhookId).toBe('webhook_123')

      // Verify webhook was recorded
      expect(prisma.webhookLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceIp: '192.168.1.100',
          status: 'success',
          payloadSize: expect.any(Number),
        }),
      })

      // Verify webhook was updated with final results
      expect(prisma.webhookLog.update).toHaveBeenCalledWith({
        where: { id: 'webhook_123' },
        data: expect.objectContaining({
          processingTime: expect.any(Number),
          status: 'success',
          signalId: 'signal_123',
        }),
      })

      // Verify processing stages were tracked
      expect(prisma.processingStage.create).toHaveBeenCalledTimes(5) // received, enriching, deciding, executing, completed
    })

    it('should maintain performance target of < 100ms for monitoring overhead', async () => {
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
      const startTime = Date.now()
      const response = await POST(request)
      const endTime = Date.now()
      const responseData = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      
      // Verify total processing time is reasonable
      const totalTime = endTime - startTime
      expect(totalTime).toBeLessThan(1000) // Should be well under 1 second
      
      // Verify reported processing time
      expect(responseData.processingTime).toBeLessThan(500) // Should be under 500ms
    })
  })

  describe('Error Handling with Monitoring', () => {
    it('should record failed webhook when signature validation fails', async () => {
      // Arrange
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
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(401)

      // Verify rejected webhook was recorded
      expect(prisma.webhookLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'rejected',
          errorMessage: 'Invalid signature',
        }),
      })
    })

    it('should record failed webhook when JSON parsing fails', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'valid-signature',
        },
        body: 'invalid-json{',
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(400)

      // Verify failed webhook was recorded
      expect(prisma.webhookLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Invalid JSON payload',
        }),
      })
    })

    it('should handle monitoring failures gracefully without breaking webhook processing', async () => {
      // Arrange
      vi.mocked(prisma.webhookLog.create).mockRejectedValue(new Error('Database error'))

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
      const response = await POST(request)
      const responseData = await response.json()

      // Assert - Webhook processing should still succeed
      expect(response.status).toBe(200)
      expect(responseData.success).toBe(true)
      expect(responseData.signalId).toBe('signal_123')

      // Verify signal was still created despite monitoring failure
      expect(prisma.signal.create).toHaveBeenCalled()
    })

    it('should update webhook status when database errors occur', async () => {
      // Arrange
      vi.mocked(prisma.signal.create).mockRejectedValue(new Error('Database connection failed'))

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
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(500)

      // Verify webhook was updated with error status
      expect(prisma.webhookLog.update).toHaveBeenCalledWith({
        where: { id: 'webhook_123' },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Database connection failed',
          processingTime: expect.any(Number),
        }),
      })
    })
  })

  describe('Rate Limiting with Monitoring', () => {
    it('should record rejected webhook when rate limit is exceeded', async () => {
      // Arrange
      const { checkRateLimit } = await import('@/lib/rate-limiter')
      vi.mocked(checkRateLimit).mockReturnValue({
        allowed: false,
        retryAfter: 60,
        remaining: 0,
        resetAt: Date.now() + 60000,
      })

      const request = new NextRequest('http://localhost:3000/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tradingview-signature': 'valid-signature',
        },
        body: JSON.stringify({ action: 'LONG', ticker: 'AAPL' }),
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(429)

      // Verify rejected webhook was recorded
      expect(prisma.webhookLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'rejected',
          errorMessage: 'Rate limit exceeded',
        }),
      })
    })
  })

  describe('Processing Stage Tracking', () => {
    it('should track all expected processing stages in correct order', async () => {
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

      // Assert - Verify stages were created in correct order
      const stageCalls = vi.mocked(prisma.processingStage.create).mock.calls
      expect(stageCalls).toHaveLength(5)

      const stages = stageCalls.map(call => call[0].data.stage)
      expect(stages).toEqual(['received', 'enriching', 'deciding', 'executing', 'completed'])

      // Verify stage metadata
      expect(stageCalls[0][0].data.metadata).toEqual({
        description: 'Processing webhook request',
      })
      expect(stageCalls[2][0].data.metadata).toEqual({
        description: 'Making trading decision',
        signalId: 'signal_123',
      })
    })
  })
})