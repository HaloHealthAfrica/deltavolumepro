/**
 * ============================================================================
 * WEBHOOK MONITOR SERVICE TESTS
 * ============================================================================
 * 
 * Comprehensive test suite for the WebhookMonitor service implementation.
 * Tests all major functionality including CRUD operations, performance metrics,
 * health monitoring, and error handling.
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebhookMonitor } from '@/lib/monitoring/webhook-monitor'
import { prisma } from '@/lib/prisma'
import type {
  CreateWebhookRequestInput,
  CreateProcessingStageInput,
  ValidationError,
  NotFoundError,
  ConflictError,
  InvalidStateError,
} from '@/lib/monitoring'

// Mock the logger to avoid console output during tests
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('WebhookMonitor', () => {
  let monitor: WebhookMonitor
  let testSignalId: string

  beforeEach(async () => {
    monitor = new WebhookMonitor()
    
    // Create a test signal for processing stages
    const signal = await prisma.signal.create({
      data: {
        rawPayload: { test: true },
        action: 'LONG',
        ticker: 'TEST',
        timestamp: BigInt(Date.now()),
        timeframeMinutes: 15,
        entryPrice: 100.0,
        quality: 4,
        zScore: 2.5,
        buyPercent: 65.0,
        sellPercent: 35.0,
        buyersWinning: true,
        trend: 'BULLISH',
        vwapPosition: 'ABOVE',
        atAtrLevel: true,
        oscillatorValue: 0.75,
        oscillatorPhase: 'ACCUMULATION',
        compression: false,
        stopLoss: 95.0,
        target1: 105.0,
        atr: 2.5,
        status: 'received',
      },
    })
    testSignalId = signal.id
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.processingStage.deleteMany({
      where: { signalId: testSignalId },
    })
    await prisma.webhookLog.deleteMany({
      where: { signalId: testSignalId },
    })
    await prisma.signal.delete({
      where: { id: testSignalId },
    })
  })

  describe('Webhook Request Management', () => {
    describe('recordWebhookRequest', () => {
      it('should record a valid webhook request', async () => {
        const request: CreateWebhookRequestInput = {
          sourceIp: '192.168.1.100',
          userAgent: 'TradingView-Webhook/1.0',
          headers: { 'content-type': 'application/json' },
          payload: { action: 'LONG', ticker: 'AAPL' },
          payloadSize: 1024,
          signature: 'sha256=test',
          processingTime: 150,
          status: 'success',
          signalId: testSignalId,
        }

        const result = await monitor.recordWebhookRequest(request)

        expect(result).toMatchObject({
          sourceIp: '192.168.1.100',
          userAgent: 'TradingView-Webhook/1.0',
          payloadSize: 1024,
          processingTime: 150,
          status: 'success',
          signalId: testSignalId,
        })
        expect(result.id).toBeDefined()
        expect(result.createdAt).toBeInstanceOf(Date)
      })

      it('should validate required fields', async () => {
        const invalidRequest = {
          // Missing sourceIp
          headers: {},
          payload: {},
          payloadSize: 0,
          processingTime: 0,
          status: 'success',
        } as CreateWebhookRequestInput

        await expect(monitor.recordWebhookRequest(invalidRequest))
          .rejects.toThrow('Source IP is required')
      })

      it('should validate status values', async () => {
        const request: CreateWebhookRequestInput = {
          sourceIp: '192.168.1.100',
          headers: {},
          payload: {},
          payloadSize: 0,
          processingTime: 0,
          status: 'invalid' as any,
        }

        await expect(monitor.recordWebhookRequest(request))
          .rejects.toThrow('Status must be one of: success, failed, rejected')
      })
    })

    describe('updateWebhookRequest', () => {
      it('should update an existing webhook request', async () => {
        // First create a webhook
        const request: CreateWebhookRequestInput = {
          sourceIp: '192.168.1.100',
          headers: {},
          payload: {},
          payloadSize: 1024,
          processingTime: 100,
          status: 'success',
        }

        const created = await monitor.recordWebhookRequest(request)

        // Then update it
        const updated = await monitor.updateWebhookRequest(created.id, {
          processingTime: 200,
          status: 'failed',
          errorMessage: 'Test error',
        })

        expect(updated.processingTime).toBe(200)
        expect(updated.status).toBe('failed')
        expect(updated.errorMessage).toBe('Test error')
      })

      it('should throw NotFoundError for non-existent webhook', async () => {
        await expect(monitor.updateWebhookRequest('non-existent', {}))
          .rejects.toThrow('WebhookRequest with ID non-existent not found')
      })
    })

    describe('getWebhookRequest', () => {
      it('should retrieve webhook request by ID', async () => {
        const request: CreateWebhookRequestInput = {
          sourceIp: '192.168.1.100',
          headers: {},
          payload: { test: true },
          payloadSize: 1024,
          processingTime: 150,
          status: 'success',
          signalId: testSignalId,
        }

        const created = await monitor.recordWebhookRequest(request)
        const retrieved = await monitor.getWebhookRequest(created.id)

        expect(retrieved).toMatchObject({
          id: created.id,
          sourceIp: '192.168.1.100',
          payloadSize: 1024,
          status: 'success',
        })
      })

      it('should include relations when requested', async () => {
        const request: CreateWebhookRequestInput = {
          sourceIp: '192.168.1.100',
          headers: {},
          payload: {},
          payloadSize: 1024,
          processingTime: 150,
          status: 'success',
          signalId: testSignalId,
        }

        const created = await monitor.recordWebhookRequest(request)
        const retrieved = await monitor.getWebhookRequest(created.id, true)

        expect(retrieved?.signal).toBeDefined()
        expect(retrieved?.signal?.id).toBe(testSignalId)
        expect(retrieved?.stages).toBeDefined()
      })

      it('should return null for non-existent webhook', async () => {
        const result = await monitor.getWebhookRequest('non-existent')
        expect(result).toBeNull()
      })
    })

    describe('getWebhookRequests', () => {
      it('should return paginated webhook requests', async () => {
        // Create multiple webhooks
        for (let i = 0; i < 5; i++) {
          await monitor.recordWebhookRequest({
            sourceIp: `192.168.1.${100 + i}`,
            headers: {},
            payload: { index: i },
            payloadSize: 1024 + i,
            processingTime: 100 + i * 10,
            status: i % 2 === 0 ? 'success' : 'failed',
          })
        }

        const result = await monitor.getWebhookRequests({
          page: 1,
          limit: 3,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        })

        expect(result.data).toHaveLength(3)
        expect(result.pagination.total).toBeGreaterThanOrEqual(5)
        expect(result.pagination.page).toBe(1)
        expect(result.pagination.limit).toBe(3)
      })

      it('should filter by status', async () => {
        await monitor.recordWebhookRequest({
          sourceIp: '192.168.1.100',
          headers: {},
          payload: {},
          payloadSize: 1024,
          processingTime: 100,
          status: 'success',
        })

        await monitor.recordWebhookRequest({
          sourceIp: '192.168.1.101',
          headers: {},
          payload: {},
          payloadSize: 1024,
          processingTime: 100,
          status: 'failed',
        })

        const result = await monitor.getWebhookRequests({
          webhookStatus: ['success'],
        })

        expect(result.data.every(w => w.status === 'success')).toBe(true)
      })

      it('should filter by time range', async () => {
        const result = await monitor.getWebhookRequests({
          timeRange: 'last_hour',
        })

        expect(result.data).toBeDefined()
        expect(result.pagination).toBeDefined()
      })
    })
  })

  describe('Processing Stage Management', () => {
    describe('startProcessingStage', () => {
      it('should create a new processing stage', async () => {
        const stage: CreateProcessingStageInput = {
          signalId: testSignalId,
          stage: 'enriching',
          startedAt: new Date(),
          status: 'in_progress',
        }

        const result = await monitor.startProcessingStage(stage)

        expect(result).toMatchObject({
          signalId: testSignalId,
          stage: 'enriching',
          status: 'in_progress',
        })
        expect(result.id).toBeDefined()
      })

      it('should prevent duplicate stages for same signal', async () => {
        const stage: CreateProcessingStageInput = {
          signalId: testSignalId,
          stage: 'enriching',
          startedAt: new Date(),
          status: 'in_progress',
        }

        await monitor.startProcessingStage(stage)

        await expect(monitor.startProcessingStage(stage))
          .rejects.toThrow('Processing stage already exists for signal')
      })

      it('should validate stage type', async () => {
        const stage: CreateProcessingStageInput = {
          signalId: testSignalId,
          stage: 'invalid' as any,
          startedAt: new Date(),
          status: 'in_progress',
        }

        await expect(monitor.startProcessingStage(stage))
          .rejects.toThrow('Invalid stage type: invalid')
      })
    })

    describe('completeProcessingStage', () => {
      it('should complete an in-progress stage', async () => {
        const stage: CreateProcessingStageInput = {
          signalId: testSignalId,
          stage: 'enriching',
          startedAt: new Date(),
          status: 'in_progress',
        }

        const created = await monitor.startProcessingStage(stage)
        
        const completed = await monitor.completeProcessingStage(
          created.id,
          'completed',
          { result: 'success' },
        )

        expect(completed.status).toBe('completed')
        expect(completed.completedAt).toBeInstanceOf(Date)
        expect(completed.duration).toBeGreaterThan(0)
        expect(completed.metadata).toMatchObject({ result: 'success' })
      })

      it('should throw NotFoundError for non-existent stage', async () => {
        await expect(monitor.completeProcessingStage('non-existent', 'completed'))
          .rejects.toThrow('ProcessingStage with ID non-existent not found')
      })

      it('should throw InvalidStateError for already completed stage', async () => {
        const stage: CreateProcessingStageInput = {
          signalId: testSignalId,
          stage: 'enriching',
          startedAt: new Date(),
          status: 'completed',
          completedAt: new Date(),
          duration: 1000,
        }

        const created = await monitor.startProcessingStage(stage)

        await expect(monitor.completeProcessingStage(created.id, 'completed'))
          .rejects.toThrow('Processing stage is already completed')
      })
    })

    describe('getProcessingStages', () => {
      it('should return stages for a signal', async () => {
        // Create multiple stages
        const stages = ['received', 'enriching', 'deciding'] as const
        
        for (const stageType of stages) {
          await monitor.startProcessingStage({
            signalId: testSignalId,
            stage: stageType,
            startedAt: new Date(),
            status: 'completed',
            completedAt: new Date(),
            duration: 1000,
          })
        }

        const result = await monitor.getProcessingStages(testSignalId)

        expect(result).toHaveLength(3)
        expect(result.map(s => s.stage)).toEqual(['received', 'enriching', 'deciding'])
      })
    })

    describe('getPipelineStatus', () => {
      it('should return pipeline status for signal with stages', async () => {
        await monitor.startProcessingStage({
          signalId: testSignalId,
          stage: 'received',
          startedAt: new Date(),
          status: 'completed',
          completedAt: new Date(),
          duration: 100,
        })

        const inProgressStage = await monitor.startProcessingStage({
          signalId: testSignalId,
          stage: 'enriching',
          startedAt: new Date(),
          status: 'in_progress',
        })

        const status = await monitor.getPipelineStatus(testSignalId)

        expect(status).toMatchObject({
          signalId: testSignalId,
          currentStage: 'enriching',
          status: 'in_progress',
        })
        expect(status?.stages).toHaveLength(2)
        expect(status?.estimatedCompletion).toBeInstanceOf(Date)
      })

      it('should return null for signal without stages', async () => {
        const status = await monitor.getPipelineStatus('non-existent-signal')
        expect(status).toBeNull()
      })
    })

    describe('getActiveProcessingStages', () => {
      it('should return only in-progress stages', async () => {
        // Create completed stage
        await monitor.startProcessingStage({
          signalId: testSignalId,
          stage: 'received',
          startedAt: new Date(),
          status: 'completed',
          completedAt: new Date(),
          duration: 100,
        })

        // Create in-progress stage
        await monitor.startProcessingStage({
          signalId: testSignalId,
          stage: 'enriching',
          startedAt: new Date(),
          status: 'in_progress',
        })

        const activeStages = await monitor.getActiveProcessingStages()
        
        expect(activeStages.every(s => s.status === 'in_progress')).toBe(true)
        expect(activeStages.some(s => s.stage === 'enriching')).toBe(true)
      })
    })
  })

  describe('Performance Monitoring', () => {
    describe('getPerformanceMetrics', () => {
      it('should calculate metrics for time range', async () => {
        // Create test webhooks with different statuses
        await monitor.recordWebhookRequest({
          sourceIp: '192.168.1.100',
          headers: {},
          payload: {},
          payloadSize: 1024,
          processingTime: 100,
          status: 'success',
        })

        await monitor.recordWebhookRequest({
          sourceIp: '192.168.1.101',
          headers: {},
          payload: {},
          payloadSize: 2048,
          processingTime: 200,
          status: 'failed',
        })

        const metrics = await monitor.getPerformanceMetrics('last_hour')

        expect(metrics.period.start).toBeInstanceOf(Date)
        expect(metrics.period.end).toBeInstanceOf(Date)
        expect(metrics.totalWebhooks).toBeGreaterThanOrEqual(2)
        expect(metrics.successRate).toBeGreaterThanOrEqual(0)
        expect(metrics.avgProcessingTime).toBeGreaterThan(0)
      })

      it('should handle custom time range', async () => {
        const start = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
        const end = new Date()

        const metrics = await monitor.getPerformanceMetrics('custom', start, end)

        expect(metrics.period.start).toEqual(start)
        expect(metrics.period.end).toEqual(end)
      })

      it('should throw ValidationError for custom range without dates', async () => {
        await expect(monitor.getPerformanceMetrics('custom'))
          .rejects.toThrow('Custom start and end dates are required for custom time range')
      })
    })

    describe('getRealTimeMetrics', () => {
      it('should return current metrics snapshot', async () => {
        const metrics = await monitor.getRealTimeMetrics()

        expect(metrics.timestamp).toBeInstanceOf(Date)
        expect(typeof metrics.webhooksLastMinute).toBe('number')
        expect(typeof metrics.activeStages).toBe('number')
        expect(typeof metrics.queueDepth).toBe('number')
        expect(typeof metrics.recentAvgProcessingTime).toBe('number')
        expect(typeof metrics.currentErrorRate).toBe('number')
        expect(typeof metrics.systemLoad).toBe('number')
        expect(typeof metrics.unacknowledgedAlerts).toBe('number')
      })
    })

    describe('getProcessingStatistics', () => {
      it('should calculate processing statistics', async () => {
        // Create test data
        await monitor.recordWebhookRequest({
          sourceIp: '192.168.1.100',
          headers: {},
          payload: {},
          payloadSize: 1024,
          processingTime: 100,
          status: 'success',
        })

        await monitor.recordWebhookRequest({
          sourceIp: '192.168.1.101',
          headers: {},
          payload: {},
          payloadSize: 1024,
          processingTime: 200,
          status: 'failed',
        })

        const stats = await monitor.getProcessingStatistics()

        expect(stats.totalWebhooks).toBeGreaterThanOrEqual(2)
        expect(stats.successfulWebhooks).toBeGreaterThanOrEqual(1)
        expect(stats.failedWebhooks).toBeGreaterThanOrEqual(1)
        expect(stats.successRate).toBeGreaterThanOrEqual(0)
        expect(stats.avgProcessingTime).toBeGreaterThan(0)
      })
    })
  })

  describe('Health Monitoring', () => {
    describe('getSystemHealth', () => {
      it('should return system health status', async () => {
        const health = await monitor.getSystemHealth()

        expect(health.status).toMatch(/^(healthy|degraded|unhealthy|maintenance)$/)
        expect(typeof health.uptime).toBe('number')
        expect(typeof health.version).toBe('string')
        expect(health.lastCheck).toBeInstanceOf(Date)
        expect(health.database).toBeDefined()
        expect(health.memory).toBeDefined()
        expect(health.queue).toBeDefined()
      })
    })

    describe('performHealthCheck', () => {
      it('should perform comprehensive health check', async () => {
        const health = await monitor.performHealthCheck()

        expect(health).toBeDefined()
        expect(health.status).toMatch(/^(healthy|degraded|unhealthy|maintenance)$/)
        expect(health.database.status).toMatch(/^(connected|disconnected|degraded)$/)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock prisma to throw an error
      const originalCreate = prisma.webhookLog.create
      prisma.webhookLog.create = vi.fn().mockRejectedValue(new Error('Database connection failed'))

      const request: CreateWebhookRequestInput = {
        sourceIp: '192.168.1.100',
        headers: {},
        payload: {},
        payloadSize: 1024,
        processingTime: 100,
        status: 'success',
      }

      await expect(monitor.recordWebhookRequest(request))
        .rejects.toThrow('Failed to record webhook request')

      // Restore original method
      prisma.webhookLog.create = originalCreate
    })

    it('should validate input data properly', async () => {
      const invalidRequests = [
        { sourceIp: '', headers: {}, payload: {}, payloadSize: 0, processingTime: 0, status: 'success' },
        { sourceIp: '192.168.1.100', headers: null, payload: {}, payloadSize: 0, processingTime: 0, status: 'success' },
        { sourceIp: '192.168.1.100', headers: {}, payload: null, payloadSize: 0, processingTime: 0, status: 'success' },
        { sourceIp: '192.168.1.100', headers: {}, payload: {}, payloadSize: -1, processingTime: 0, status: 'success' },
        { sourceIp: '192.168.1.100', headers: {}, payload: {}, payloadSize: 0, processingTime: -1, status: 'success' },
        { sourceIp: '192.168.1.100', headers: {}, payload: {}, payloadSize: 0, processingTime: 0, status: 'invalid' },
      ]

      for (const request of invalidRequests) {
        await expect(monitor.recordWebhookRequest(request as any))
          .rejects.toThrow()
      }
    })
  })
})