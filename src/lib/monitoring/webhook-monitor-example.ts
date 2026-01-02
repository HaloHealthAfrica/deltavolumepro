/**
 * ============================================================================
 * WEBHOOK MONITOR USAGE EXAMPLE
 * ============================================================================
 * 
 * Example demonstrating how to integrate the WebhookMonitor service
 * with the existing webhook processing pipeline.
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

import { WebhookMonitor } from './webhook-monitor'
import { createLogger } from '@/lib/logger'
import type { CreateWebhookRequestInput, CreateProcessingStageInput } from '@/lib/monitoring'

const logger = createLogger('WebhookMonitorExample')

/**
 * Example: Integrating WebhookMonitor with webhook processing
 */
export async function integrateWebhookMonitoring() {
  const monitor = new WebhookMonitor()

  // Example 1: Record incoming webhook request
  try {
    const webhookRequest: CreateWebhookRequestInput = {
      sourceIp: '192.168.1.100',
      userAgent: 'TradingView-Webhook/1.0',
      headers: {
        'content-type': 'application/json',
        'x-tradingview-signature': 'sha256=abc123...',
      },
      payload: {
        action: 'LONG',
        ticker: 'AAPL',
        timestamp: Date.now(),
        quality: 4,
        price: { entry: 150.25 },
        volume: { z_score: 2.5, buy_percent: 65 },
      },
      payloadSize: 1024,
      signature: 'sha256=abc123...',
      processingTime: 150,
      status: 'success',
    }

    const recorded = await monitor.recordWebhookRequest(webhookRequest)
    logger.info('Webhook recorded', { webhookId: recorded.id })

    // Example 2: Track processing stages
    if (recorded.signalId) {
      // Stage 1: Signal received
      const receivedStage: CreateProcessingStageInput = {
        signalId: recorded.signalId,
        stage: 'received',
        startedAt: new Date(),
        status: 'completed',
        duration: 50,
        metadata: { validation: 'passed' },
      }
      await monitor.startProcessingStage(receivedStage)

      // Stage 2: Data enrichment
      const enrichingStage: CreateProcessingStageInput = {
        signalId: recorded.signalId,
        stage: 'enriching',
        startedAt: new Date(),
        status: 'in_progress',
      }
      const enrichingRecord = await monitor.startProcessingStage(enrichingStage)

      // Complete enrichment stage
      await monitor.completeProcessingStage(
        enrichingRecord.id,
        'completed',
        { 
          tradierData: { price: 150.30, volume: 1000000 },
          dataQuality: 0.95 
        }
      )

      // Stage 3: Decision making
      const decidingStage: CreateProcessingStageInput = {
        signalId: recorded.signalId,
        stage: 'deciding',
        startedAt: new Date(),
        status: 'in_progress',
      }
      const decidingRecord = await monitor.startProcessingStage(decidingStage)

      // Complete decision stage
      await monitor.completeProcessingStage(
        decidingRecord.id,
        'completed',
        { 
          decision: 'TRADE',
          confidence: 0.85,
          reasoning: 'High quality signal with strong volume confirmation'
        }
      )
    }

    // Example 3: Get performance metrics
    const metrics = await monitor.getPerformanceMetrics('last_24_hours')
    logger.info('Performance metrics', {
      totalWebhooks: metrics.totalWebhooks,
      successRate: metrics.successRate,
      avgProcessingTime: metrics.avgProcessingTime,
    })

    // Example 4: Get real-time metrics
    const realTimeMetrics = await monitor.getRealTimeMetrics()
    logger.info('Real-time metrics', {
      webhooksLastMinute: realTimeMetrics.webhooksLastMinute,
      activeStages: realTimeMetrics.activeStages,
      currentErrorRate: realTimeMetrics.currentErrorRate,
    })

    // Example 5: Get system health
    const health = await monitor.getSystemHealth()
    logger.info('System health', {
      status: health.status,
      uptime: health.uptime,
      dbStatus: health.database.status,
    })

    return {
      webhook: recorded,
      metrics,
      realTimeMetrics,
      health,
    }
  } catch (error) {
    logger.error('Webhook monitoring integration failed', error as Error)
    throw error
  }
}

/**
 * Example: Webhook processing pipeline with monitoring
 */
export async function processWebhookWithMonitoring(
  payload: any,
  headers: Record<string, string>,
  sourceIp: string
) {
  const monitor = new WebhookMonitor()
  const startTime = Date.now()

  let webhookId: string | undefined
  let signalId: string | undefined

  try {
    // Step 1: Record incoming webhook
    const webhookRequest: CreateWebhookRequestInput = {
      sourceIp,
      userAgent: headers['user-agent'],
      headers,
      payload,
      payloadSize: JSON.stringify(payload).length,
      signature: headers['x-tradingview-signature'],
      processingTime: 0, // Will be updated later
      status: 'success', // Will be updated if processing fails
    }

    const webhook = await monitor.recordWebhookRequest(webhookRequest)
    webhookId = webhook.id

    // Step 2: Process webhook (your existing logic here)
    // ... webhook validation, signal creation, etc.
    
    // Simulate signal creation
    signalId = 'signal_' + Date.now()

    // Step 3: Track processing stages
    await trackProcessingStages(monitor, signalId)

    // Step 4: Update webhook with final results
    const processingTime = Date.now() - startTime
    await monitor.updateWebhookRequest(webhookId, {
      processingTime,
      status: 'success',
      signalId,
    })

    logger.info('Webhook processed successfully', {
      webhookId,
      signalId,
      processingTime,
    })

    return { success: true, webhookId, signalId }
  } catch (error) {
    // Update webhook with error information
    if (webhookId) {
      const processingTime = Date.now() - startTime
      await monitor.updateWebhookRequest(webhookId, {
        processingTime,
        status: 'failed',
        errorMessage: (error as Error).message,
        errorStack: (error as Error).stack,
      })
    }

    logger.error('Webhook processing failed', error as Error, {
      webhookId,
      signalId,
    })

    throw error
  }
}

/**
 * Helper function to track processing stages
 */
async function trackProcessingStages(monitor: WebhookMonitor, signalId: string) {
  const stages = [
    { stage: 'received', duration: 50 },
    { stage: 'enriching', duration: 200 },
    { stage: 'deciding', duration: 100 },
    { stage: 'executing', duration: 300 },
    { stage: 'completed', duration: 25 },
  ] as const

  for (const stageInfo of stages) {
    const startTime = new Date()
    
    // Start stage
    const stage: CreateProcessingStageInput = {
      signalId,
      stage: stageInfo.stage,
      startedAt: startTime,
      status: 'in_progress',
    }
    
    const stageRecord = await monitor.startProcessingStage(stage)

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 10))

    // Complete stage
    await monitor.completeProcessingStage(
      stageRecord.id,
      'completed',
      { 
        stage: stageInfo.stage,
        duration: stageInfo.duration,
        timestamp: new Date().toISOString(),
      }
    )
  }
}

/**
 * Example: Dashboard data fetching
 */
export async function fetchDashboardData() {
  const monitor = new WebhookMonitor()

  try {
    // Get recent webhook requests
    const recentWebhooks = await monitor.getWebhookRequests({
      timeRange: 'last_24_hours',
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

    // Get performance metrics for different time periods
    const [hourlyMetrics, dailyMetrics, weeklyMetrics] = await Promise.all([
      monitor.getPerformanceMetrics('last_hour'),
      monitor.getPerformanceMetrics('last_24_hours'),
      monitor.getPerformanceMetrics('last_7_days'),
    ])

    // Get processing statistics
    const stats = await monitor.getProcessingStatistics({
      timeRange: 'last_24_hours',
    })

    // Get active processing stages
    const activeStages = await monitor.getActiveProcessingStages()

    // Get real-time metrics
    const realTimeMetrics = await monitor.getRealTimeMetrics()

    // Get system health
    const systemHealth = await monitor.getSystemHealth()

    return {
      recentWebhooks: recentWebhooks.data,
      metrics: {
        hourly: hourlyMetrics,
        daily: dailyMetrics,
        weekly: weeklyMetrics,
      },
      statistics: stats,
      activeStages,
      realTimeMetrics,
      systemHealth,
    }
  } catch (error) {
    logger.error('Failed to fetch dashboard data', error as Error)
    throw error
  }
}

/**
 * Example: Health monitoring and alerting
 */
export async function monitorSystemHealth() {
  const monitor = new WebhookMonitor()

  try {
    // Perform comprehensive health check
    const health = await monitor.performHealthCheck()

    // Check for concerning metrics
    const realTimeMetrics = await monitor.getRealTimeMetrics()
    
    const alerts = []

    if (health.status === 'unhealthy') {
      alerts.push({
        severity: 'critical',
        message: 'System is unhealthy',
        details: health,
      })
    }

    if (realTimeMetrics.currentErrorRate > 10) {
      alerts.push({
        severity: 'warning',
        message: `High error rate: ${realTimeMetrics.currentErrorRate.toFixed(2)}%`,
        details: { errorRate: realTimeMetrics.currentErrorRate },
      })
    }

    if (realTimeMetrics.queueDepth > 50) {
      alerts.push({
        severity: 'warning',
        message: `High queue depth: ${realTimeMetrics.queueDepth}`,
        details: { queueDepth: realTimeMetrics.queueDepth },
      })
    }

    if (realTimeMetrics.recentAvgProcessingTime > 5000) {
      alerts.push({
        severity: 'warning',
        message: `Slow processing: ${realTimeMetrics.recentAvgProcessingTime}ms`,
        details: { avgProcessingTime: realTimeMetrics.recentAvgProcessingTime },
      })
    }

    logger.info('Health monitoring completed', {
      status: health.status,
      alertCount: alerts.length,
      alerts: alerts.map(a => ({ severity: a.severity, message: a.message })),
    })

    return {
      health,
      realTimeMetrics,
      alerts,
    }
  } catch (error) {
    logger.error('Health monitoring failed', error as Error)
    throw error
  }
}