/**
 * Signal Processing Queue
 * 
 * Manages background processing of trading signals.
 * In a production environment, this would use a proper job queue like Bull, BullMQ, or AWS SQS.
 * For now, we'll use a simple in-memory queue with async processing.
 * 
 * Requirement 1.5: Queue signals for background processing
 * Task 5.2: Integrated metrics collection for monitoring dashboard
 */

import { prisma } from '@/lib/prisma'
import { MetricsCollector } from '@/lib/monitoring/metrics-collector'
import { WebhookMonitor } from '@/lib/monitoring/webhook-monitor'
import { getMonitoringBroadcaster } from '@/lib/monitoring/monitoring-broadcaster'
import type { ProcessingStage, ProcessingStageType } from '@/types/monitoring'

interface QueuedSignal {
  signalId: string
  queuedAt: Date
  attempts: number
}

// In-memory queue (in production, use Redis/Bull/SQS)
const processingQueue: QueuedSignal[] = []
let isProcessing = false

// Monitoring instances (lazy initialized)
let metricsCollector: MetricsCollector | null = null
let webhookMonitor: WebhookMonitor | null = null

/**
 * Get or create the MetricsCollector instance
 */
function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector()
  }
  return metricsCollector
}

/**
 * Get or create the WebhookMonitor instance
 */
function getWebhookMonitor(): WebhookMonitor {
  if (!webhookMonitor) {
    webhookMonitor = new WebhookMonitor()
  }
  return webhookMonitor
}

/**
 * Fire-and-forget wrapper for non-critical monitoring operations
 * Ensures monitoring failures don't break signal processing
 */
function fireAndForget(operation: () => Promise<unknown>, description: string): void {
  operation().catch(error => {
    console.warn(`[Queue] Non-critical monitoring operation failed (${description}):`, error)
  })
}

/**
 * Start a processing stage with monitoring
 * Returns the stage record for later completion
 */
async function startStage(
  signalId: string,
  stage: ProcessingStageType,
  metadata?: Record<string, unknown>
): Promise<ProcessingStage | null> {
  try {
    const monitor = getWebhookMonitor()
    const stageRecord = await monitor.startProcessingStage({
      signalId,
      stage,
      startedAt: new Date(),
      status: 'in_progress',
      metadata,
    })

    // Broadcast stage started event (fire-and-forget)
    const broadcaster = getMonitoringBroadcaster()
    fireAndForget(
      () => broadcaster.broadcastStageStarted(stageRecord),
      `broadcast stage started: ${stage}`
    )

    return stageRecord
  } catch (error) {
    console.warn(`[Queue] Failed to start monitoring stage ${stage} for signal ${signalId}:`, error)
    return null
  }
}

/**
 * Complete a processing stage with monitoring
 */
async function completeStage(
  stageRecord: ProcessingStage | null,
  status: 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  if (!stageRecord) {
    return
  }

  try {
    const monitor = getWebhookMonitor()
    const completedStage = await monitor.completeProcessingStage(
      stageRecord.id,
      status,
      metadata,
      errorMessage
    )

    // Broadcast stage completion event (fire-and-forget)
    const broadcaster = getMonitoringBroadcaster()
    if (status === 'completed') {
      fireAndForget(
        () => broadcaster.broadcastStageCompleted(completedStage),
        `broadcast stage completed: ${stageRecord.stage}`
      )
    } else {
      fireAndForget(
        () => broadcaster.broadcastStageFailed(completedStage),
        `broadcast stage failed: ${stageRecord.stage}`
      )
    }
  } catch (error) {
    console.warn(`[Queue] Failed to complete monitoring stage ${stageRecord.stage}:`, error)
  }
}

/**
 * Record metrics for decision outcomes
 */
function recordDecisionMetrics(decision: string, confidence: number): void {
  fireAndForget(async () => {
    // Metrics are collected periodically by MetricsCollector
    // This is a placeholder for any immediate decision tracking
    console.log(`[Queue] Decision recorded: ${decision} (confidence: ${(confidence * 100).toFixed(1)}%)`)
  }, 'record decision metrics')
}

/**
 * Record metrics for trade execution results
 */
function recordTradeMetrics(
  tradeId: string,
  successfulBrokers: string[],
  totalBrokers: number
): void {
  fireAndForget(async () => {
    // Metrics are collected periodically by MetricsCollector
    // This is a placeholder for any immediate trade tracking
    console.log(`[Queue] Trade ${tradeId} executed on ${successfulBrokers.length}/${totalBrokers} brokers`)
  }, 'record trade metrics')
}

/**
 * Queues a signal for background processing
 */
export async function queueSignalProcessing(signalId: string): Promise<void> {
  console.log(`[Queue] Queuing signal ${signalId} for processing`)
  
  processingQueue.push({
    signalId,
    queuedAt: new Date(),
    attempts: 0
  })

  // Start processing if not already running
  if (!isProcessing) {
    processQueue().catch(error => {
      console.error('[Queue] Error in queue processor:', error)
    })
  }
}

/**
 * Processes queued signals in the background
 */
async function processQueue(): Promise<void> {
  if (isProcessing) {
    return
  }

  isProcessing = true

  try {
    while (processingQueue.length > 0) {
      const queuedSignal = processingQueue.shift()
      
      if (!queuedSignal) {
        continue
      }

      try {
        await processSignal(queuedSignal.signalId)
      } catch (error) {
        console.error(`[Queue] Error processing signal ${queuedSignal.signalId}:`, error)
        
        // Retry logic (max 3 attempts)
        if (queuedSignal.attempts < 3) {
          queuedSignal.attempts++
          processingQueue.push(queuedSignal)
          console.log(`[Queue] Requeuing signal ${queuedSignal.signalId} (attempt ${queuedSignal.attempts})`)
        } else {
          console.error(`[Queue] Max retries reached for signal ${queuedSignal.signalId}`)
          
          // Mark signal as failed
          await prisma.signal.update({
            where: { id: queuedSignal.signalId },
            data: { status: 'rejected' }
          }).catch(err => {
            console.error(`[Queue] Error updating signal status:`, err)
          })
        }
      }
    }
  } finally {
    isProcessing = false
  }
}

/**
 * Processes a single signal through the full pipeline
 * Includes comprehensive monitoring at each stage
 */
async function processSignal(signalId: string): Promise<void> {
  console.log(`[Queue] Processing signal ${signalId}`)
  
  // Import modules dynamically to avoid circular dependencies
  const { processSignalEnrichment } = await import('@/lib/data-enrichment')
  const { makeDecision, storeDecision, getActiveTradingRules } = await import('@/lib/decision-engine')
  
  // Stage tracking variables
  let receivedStage: ProcessingStage | null = null
  let enrichingStage: ProcessingStage | null = null
  let decidingStage: ProcessingStage | null = null
  let executingStage: ProcessingStage | null = null
  
  try {
    // ========================================
    // Stage: RECEIVED - Signal processing starts
    // ========================================
    receivedStage = await startStage(signalId, 'received', {
      queuedAt: new Date().toISOString(),
    })
    await completeStage(receivedStage, 'completed')
    
    // ========================================
    // Stage: ENRICHING - Data enrichment
    // ========================================
    enrichingStage = await startStage(signalId, 'enriching')
    
    const enrichmentResult = await processSignalEnrichment(signalId)
    console.log(`[Queue] Signal ${signalId} enriched with quality ${(enrichmentResult.dataQuality * 100).toFixed(1)}%`)
    
    await completeStage(enrichingStage, 'completed', {
      dataQuality: enrichmentResult.dataQuality,
      enrichedAt: new Date().toISOString(),
    })
    
    // ========================================
    // Stage: DECIDING - Decision engine
    // ========================================
    decidingStage = await startStage(signalId, 'deciding')
    
    const signal = await prisma.signal.findUnique({ where: { id: signalId } })
    const enrichedData = await prisma.enrichedData.findUnique({ where: { signalId } })
    const tradingRules = await getActiveTradingRules()
    
    if (!signal) {
      throw new Error(`Signal ${signalId} not found after enrichment`)
    }
    
    const decision = await makeDecision(signal, enrichedData, tradingRules)
    await storeDecision(signalId, decision)
    
    console.log(`[Queue] Signal ${signalId} decision: ${decision.decision} (confidence: ${(decision.confidence * 100).toFixed(1)}%)`)
    
    // Record decision metrics
    recordDecisionMetrics(decision.decision, decision.confidence)
    
    await completeStage(decidingStage, 'completed', {
      decision: decision.decision,
      confidence: decision.confidence,
      decidedAt: new Date().toISOString(),
    })
    
    // ========================================
    // Stage: EXECUTING - Trade execution (if approved)
    // ========================================
    if (decision.decision === 'TRADE') {
      executingStage = await startStage(signalId, 'executing', {
        ticker: signal.ticker,
        action: signal.action,
      })
      
      const { executeTrade } = await import('@/lib/paper-trading')
      
      console.log(`[Queue] Signal ${signalId} approved for trading - executing on all brokers`)
      
      const { tradeId, results } = await executeTrade(signal, decision)
      
      const successfulBrokers = Object.entries(results)
        .filter(([_, r]) => r.status === 'filled')
        .map(([b]) => b)
      
      console.log(`[Queue] Trade ${tradeId} executed on ${successfulBrokers.length}/3 brokers: ${successfulBrokers.join(', ')}`)
      
      // Record trade execution metrics
      recordTradeMetrics(tradeId, successfulBrokers, 3)
      
      await completeStage(executingStage, 'completed', {
        tradeId,
        successfulBrokers,
        totalBrokers: 3,
        executedAt: new Date().toISOString(),
      })
    }
    
    // ========================================
    // Stage: COMPLETED - Processing finished
    // ========================================
    const completedStage = await startStage(signalId, 'completed', {
      completedAt: new Date().toISOString(),
      decision: decision.decision,
      tradeExecuted: decision.decision === 'TRADE',
    })
    await completeStage(completedStage, 'completed')
    
  } catch (error) {
    console.error(`[Queue] Error processing signal ${signalId}:`, error)
    
    // Mark any in-progress stages as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Complete any pending stages as failed
    if (enrichingStage && !enrichingStage.completedAt) {
      await completeStage(enrichingStage, 'failed', undefined, errorMessage)
    }
    if (decidingStage && !decidingStage.completedAt) {
      await completeStage(decidingStage, 'failed', undefined, errorMessage)
    }
    if (executingStage && !executingStage.completedAt) {
      await completeStage(executingStage, 'failed', undefined, errorMessage)
    }
    
    // Record failed stage
    const failedStage = await startStage(signalId, 'failed', {
      error: errorMessage,
      failedAt: new Date().toISOString(),
    })
    await completeStage(failedStage, 'failed', undefined, errorMessage)
    
    throw error
  }

  console.log(`[Queue] Signal ${signalId} processed successfully`)
}

/**
 * Gets the current queue status
 */
export function getQueueStatus(): {
  queueLength: number
  isProcessing: boolean
  signals: QueuedSignal[]
} {
  return {
    queueLength: processingQueue.length,
    isProcessing,
    signals: [...processingQueue]
  }
}

/**
 * Clears the processing queue (for testing)
 */
export function clearQueue(): void {
  processingQueue.length = 0
  isProcessing = false
}
