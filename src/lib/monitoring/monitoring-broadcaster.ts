/**
 * ============================================================================
 * MONITORING BROADCASTER SERVICE
 * ============================================================================
 * 
 * Real-time event broadcasting service for the monitoring system.
 * Uses Pusher to broadcast monitoring events to connected clients for
 * live dashboard updates and real-time monitoring capabilities.
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

import { getPusherServer, CHANNELS, EVENTS } from '@/lib/realtime/pusher-server'
import { createLogger } from '@/lib/logger'
import type {
  WebhookRequest,
  ProcessingStage,
  SystemAlert,
  SystemMetrics,
  SystemHealth,
  ProcessingStageType,
  ProcessingStageStatus,
  AlertSeverity,
} from '@/types/monitoring'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Webhook event payload for broadcasting
 */
export interface WebhookEventPayload {
  webhookId: string
  sourceIp: string
  status: string
  processingTime?: number
  payloadSize?: number
  signalId?: string | null
  ticker?: string
  errorMessage?: string
  timestamp: Date
}

/**
 * Stage event payload for broadcasting
 */
export interface StageEventPayload {
  stageId: string
  signalId: string
  stage: ProcessingStageType
  status: ProcessingStageStatus
  duration?: number | null
  errorMessage?: string | null
  metadata?: Record<string, unknown> | null
  timestamp: Date
}

/**
 * Alert event payload for broadcasting
 */
export interface AlertEventPayload {
  alertId: string
  type: string
  severity: AlertSeverity
  message: string
  category: string
  acknowledged: boolean
  resolved: boolean
  acknowledgedBy?: string | null
  timestamp: Date
}

/**
 * Metrics update payload for broadcasting
 */
export interface MetricsUpdatePayload {
  webhookVolume: number
  successRate: number
  avgProcessingTime: number
  errorRate: number
  queueDepth: number
  activeStages: number
  memoryUsage?: number
  cpuUsage?: number
  timestamp: Date
}

/**
 * Health update payload for broadcasting
 */
export interface HealthUpdatePayload {
  status: string
  database: {
    status: string
    latency?: number
  }
  api: {
    status: string
    latency?: number
  }
  memory: {
    status: string
    usagePercent?: number
  }
  queue: {
    status: string
    depth?: number
  }
  lastCheck: Date
  timestamp: Date
}

/**
 * Broadcast result interface
 */
export interface BroadcastResult {
  success: boolean
  channel: string
  event: string
  error?: string
}

// ============================================================================
// MONITORING BROADCASTER CLASS
// ============================================================================

/**
 * MonitoringBroadcaster class
 * 
 * Provides methods for broadcasting real-time monitoring events via Pusher.
 * Implements comprehensive error handling and logging for production use.
 */
export class MonitoringBroadcaster {
  private readonly logger = createLogger('MonitoringBroadcaster')
  private readonly pusher = getPusherServer()

  // ========================================
  // WEBHOOK EVENTS
  // ========================================

  /**
   * Broadcast webhook received event
   * 
   * @param webhook - The webhook request that was received
   * @param ticker - Optional ticker symbol from the webhook payload
   * @returns Promise resolving to broadcast result
   */
  async broadcastWebhookReceived(
    webhook: WebhookRequest,
    ticker?: string
  ): Promise<BroadcastResult> {
    const payload: WebhookEventPayload = {
      webhookId: webhook.id,
      sourceIp: webhook.sourceIp,
      status: webhook.status,
      payloadSize: webhook.payloadSize,
      signalId: webhook.signalId,
      ticker,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_WEBHOOKS,
      EVENTS.WEBHOOK_RECEIVED,
      payload,
      'webhook received'
    )
  }

  /**
   * Broadcast webhook processed event
   * 
   * @param webhook - The webhook request that was processed
   * @param ticker - Optional ticker symbol from the webhook payload
   * @returns Promise resolving to broadcast result
   */
  async broadcastWebhookProcessed(
    webhook: WebhookRequest,
    ticker?: string
  ): Promise<BroadcastResult> {
    const payload: WebhookEventPayload = {
      webhookId: webhook.id,
      sourceIp: webhook.sourceIp,
      status: webhook.status,
      processingTime: webhook.processingTime,
      payloadSize: webhook.payloadSize,
      signalId: webhook.signalId,
      ticker,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_WEBHOOKS,
      EVENTS.WEBHOOK_PROCESSED,
      payload,
      'webhook processed'
    )
  }

  /**
   * Broadcast webhook failed event
   * 
   * @param webhook - The webhook request that failed
   * @param errorMessage - The error message describing the failure
   * @param ticker - Optional ticker symbol from the webhook payload
   * @returns Promise resolving to broadcast result
   */
  async broadcastWebhookFailed(
    webhook: WebhookRequest,
    errorMessage?: string,
    ticker?: string
  ): Promise<BroadcastResult> {
    const payload: WebhookEventPayload = {
      webhookId: webhook.id,
      sourceIp: webhook.sourceIp,
      status: webhook.status,
      processingTime: webhook.processingTime,
      payloadSize: webhook.payloadSize,
      signalId: webhook.signalId,
      ticker,
      errorMessage: errorMessage || webhook.errorMessage || undefined,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_WEBHOOKS,
      EVENTS.WEBHOOK_FAILED,
      payload,
      'webhook failed'
    )
  }

  // ========================================
  // STAGE EVENTS
  // ========================================

  /**
   * Broadcast stage started event
   * 
   * @param stage - The processing stage that started
   * @returns Promise resolving to broadcast result
   */
  async broadcastStageStarted(stage: ProcessingStage): Promise<BroadcastResult> {
    const payload: StageEventPayload = {
      stageId: stage.id,
      signalId: stage.signalId,
      stage: stage.stage,
      status: stage.status,
      metadata: stage.metadata as Record<string, unknown> | null,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_STAGES,
      EVENTS.STAGE_STARTED,
      payload,
      'stage started'
    )
  }

  /**
   * Broadcast stage completed event
   * 
   * @param stage - The processing stage that completed
   * @returns Promise resolving to broadcast result
   */
  async broadcastStageCompleted(stage: ProcessingStage): Promise<BroadcastResult> {
    const payload: StageEventPayload = {
      stageId: stage.id,
      signalId: stage.signalId,
      stage: stage.stage,
      status: stage.status,
      duration: stage.duration,
      metadata: stage.metadata as Record<string, unknown> | null,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_STAGES,
      EVENTS.STAGE_COMPLETED,
      payload,
      'stage completed'
    )
  }

  /**
   * Broadcast stage failed event
   * 
   * @param stage - The processing stage that failed
   * @returns Promise resolving to broadcast result
   */
  async broadcastStageFailed(stage: ProcessingStage): Promise<BroadcastResult> {
    const payload: StageEventPayload = {
      stageId: stage.id,
      signalId: stage.signalId,
      stage: stage.stage,
      status: stage.status,
      duration: stage.duration,
      errorMessage: stage.errorMessage,
      metadata: stage.metadata as Record<string, unknown> | null,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_STAGES,
      EVENTS.STAGE_FAILED,
      payload,
      'stage failed'
    )
  }

  // ========================================
  // ALERT EVENTS
  // ========================================

  /**
   * Broadcast alert created event
   * 
   * @param alert - The system alert that was created
   * @returns Promise resolving to broadcast result
   */
  async broadcastAlertCreated(alert: SystemAlert): Promise<BroadcastResult> {
    const payload: AlertEventPayload = {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      category: alert.category,
      acknowledged: alert.acknowledged,
      resolved: alert.resolved,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_ALERTS,
      EVENTS.ALERT_CREATED,
      payload,
      'alert created'
    )
  }

  /**
   * Broadcast alert acknowledged event
   * 
   * @param alert - The system alert that was acknowledged
   * @returns Promise resolving to broadcast result
   */
  async broadcastAlertAcknowledged(alert: SystemAlert): Promise<BroadcastResult> {
    const payload: AlertEventPayload = {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      category: alert.category,
      acknowledged: alert.acknowledged,
      resolved: alert.resolved,
      acknowledgedBy: alert.acknowledgedBy,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_ALERTS,
      EVENTS.ALERT_ACKNOWLEDGED,
      payload,
      'alert acknowledged'
    )
  }

  /**
   * Broadcast alert resolved event
   * 
   * @param alert - The system alert that was resolved
   * @returns Promise resolving to broadcast result
   */
  async broadcastAlertResolved(alert: SystemAlert): Promise<BroadcastResult> {
    const payload: AlertEventPayload = {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      category: alert.category,
      acknowledged: alert.acknowledged,
      resolved: alert.resolved,
      acknowledgedBy: alert.acknowledgedBy,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_ALERTS,
      EVENTS.ALERT_RESOLVED,
      payload,
      'alert resolved'
    )
  }

  // ========================================
  // METRICS EVENTS
  // ========================================

  /**
   * Broadcast metrics update event
   * 
   * @param metrics - The system metrics to broadcast
   * @returns Promise resolving to broadcast result
   */
  async broadcastMetricsUpdate(metrics: SystemMetrics): Promise<BroadcastResult> {
    const payload: MetricsUpdatePayload = {
      webhookVolume: metrics.webhookVolume,
      successRate: metrics.successRate,
      avgProcessingTime: metrics.avgProcessingTime,
      errorRate: metrics.errorRate,
      queueDepth: metrics.queueDepth,
      activeStages: metrics.activeStages,
      memoryUsage: metrics.memoryUsage,
      cpuUsage: metrics.cpuUsage,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_METRICS,
      EVENTS.METRICS_UPDATED,
      payload,
      'metrics update'
    )
  }

  /**
   * Broadcast partial metrics update
   * 
   * @param partialMetrics - Partial metrics data to broadcast
   * @returns Promise resolving to broadcast result
   */
  async broadcastPartialMetricsUpdate(
    partialMetrics: Partial<MetricsUpdatePayload>
  ): Promise<BroadcastResult> {
    const payload: Partial<MetricsUpdatePayload> & { timestamp: Date } = {
      ...partialMetrics,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_METRICS,
      EVENTS.METRICS_UPDATED,
      payload,
      'partial metrics update'
    )
  }

  // ========================================
  // HEALTH EVENTS
  // ========================================

  /**
   * Broadcast health update event
   * 
   * @param health - The system health status to broadcast
   * @returns Promise resolving to broadcast result
   */
  async broadcastHealthUpdate(health: SystemHealth): Promise<BroadcastResult> {
    const payload: HealthUpdatePayload = {
      status: health.status,
      database: {
        status: health.database.status,
        latency: health.database.latency,
      },
      api: {
        status: health.api.status,
        latency: health.api.latency,
      },
      memory: {
        status: health.memory.status,
        usagePercent: health.memory.usagePercent,
      },
      queue: {
        status: health.queue.status,
        depth: health.queue.depth,
      },
      lastCheck: health.lastCheck,
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_HEALTH,
      EVENTS.HEALTH_CHANGED,
      payload,
      'health update'
    )
  }

  /**
   * Broadcast health status change
   * 
   * @param previousStatus - The previous health status
   * @param currentStatus - The current health status
   * @param health - The full system health object
   * @returns Promise resolving to broadcast result
   */
  async broadcastHealthStatusChange(
    previousStatus: string,
    currentStatus: string,
    health: SystemHealth
  ): Promise<BroadcastResult> {
    const payload = {
      previousStatus,
      currentStatus,
      health: {
        status: health.status,
        database: health.database,
        api: health.api,
        memory: health.memory,
        queue: health.queue,
        lastCheck: health.lastCheck,
      },
      timestamp: new Date(),
    }

    return this.broadcast(
      CHANNELS.MONITORING_HEALTH,
      EVENTS.HEALTH_CHANGED,
      payload,
      'health status change'
    )
  }

  // ========================================
  // BATCH BROADCASTING
  // ========================================

  /**
   * Broadcast multiple events in a batch
   * 
   * @param events - Array of events to broadcast
   * @returns Promise resolving to array of broadcast results
   */
  async broadcastBatch(
    events: Array<{
      channel: string
      event: string
      data: unknown
    }>
  ): Promise<BroadcastResult[]> {
    if (events.length === 0) {
      return []
    }

    this.logger.debug('Broadcasting batch events', { count: events.length })

    try {
      const batchEvents = events.map(e => ({
        channel: e.channel,
        name: e.event,
        data: e.data,
      }))

      await this.pusher.triggerBatch(batchEvents)

      this.logger.info('Batch events broadcast successfully', {
        count: events.length,
      })

      return events.map(e => ({
        success: true,
        channel: e.channel,
        event: e.event,
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      this.logger.error('Failed to broadcast batch events', error as Error, {
        count: events.length,
      })

      return events.map(e => ({
        success: false,
        channel: e.channel,
        event: e.event,
        error: errorMessage,
      }))
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Internal broadcast method with error handling and logging
   * 
   * @param channel - The Pusher channel to broadcast to
   * @param event - The event name
   * @param data - The event payload
   * @param description - Human-readable description for logging
   * @returns Promise resolving to broadcast result
   */
  private async broadcast(
    channel: string,
    event: string,
    data: unknown,
    description: string
  ): Promise<BroadcastResult> {
    this.logger.debug(`Broadcasting ${description}`, {
      channel,
      event,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
    })

    try {
      await this.pusher.trigger(channel, event, data)

      this.logger.info(`Successfully broadcast ${description}`, {
        channel,
        event,
      })

      return {
        success: true,
        channel,
        event,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      this.logger.error(`Failed to broadcast ${description}`, error as Error, {
        channel,
        event,
      })

      return {
        success: false,
        channel,
        event,
        error: errorMessage,
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let broadcasterInstance: MonitoringBroadcaster | null = null

/**
 * Get the singleton MonitoringBroadcaster instance
 * 
 * @returns The MonitoringBroadcaster singleton instance
 */
export function getMonitoringBroadcaster(): MonitoringBroadcaster {
  if (!broadcasterInstance) {
    broadcasterInstance = new MonitoringBroadcaster()
  }
  return broadcasterInstance
}

/**
 * Create a new MonitoringBroadcaster instance
 * Useful for testing or when a fresh instance is needed
 * 
 * @returns A new MonitoringBroadcaster instance
 */
export function createMonitoringBroadcaster(): MonitoringBroadcaster {
  return new MonitoringBroadcaster()
}
