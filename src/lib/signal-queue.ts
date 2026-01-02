/**
 * Signal Processing Queue
 * 
 * Manages background processing of trading signals.
 * In a production environment, this would use a proper job queue like Bull, BullMQ, or AWS SQS.
 * For now, we'll use a simple in-memory queue with async processing.
 * 
 * Requirement 1.5: Queue signals for background processing
 */

import { prisma } from '@/lib/prisma'

interface QueuedSignal {
  signalId: string
  queuedAt: Date
  attempts: number
}

// In-memory queue (in production, use Redis/Bull/SQS)
const processingQueue: QueuedSignal[] = []
let isProcessing = false

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
 */
async function processSignal(signalId: string): Promise<void> {
  console.log(`[Queue] Processing signal ${signalId}`)
  
  // Import modules dynamically to avoid circular dependencies
  const { processSignalEnrichment } = await import('@/lib/data-enrichment')
  const { makeDecision, storeDecision, getActiveTradingRules } = await import('@/lib/decision-engine')
  
  try {
    // Step 1: Data enrichment (Task 5)
    const enrichmentResult = await processSignalEnrichment(signalId)
    console.log(`[Queue] Signal ${signalId} enriched with quality ${(enrichmentResult.dataQuality * 100).toFixed(1)}%`)
    
    // Step 2: Decision engine (Task 6)
    const signal = await prisma.signal.findUnique({ where: { id: signalId } })
    const enrichedData = await prisma.enrichedData.findUnique({ where: { signalId } })
    const tradingRules = await getActiveTradingRules()
    
    if (!signal) {
      throw new Error(`Signal ${signalId} not found after enrichment`)
    }
    
    const decision = await makeDecision(signal, enrichedData, tradingRules)
    await storeDecision(signalId, decision)
    
    console.log(`[Queue] Signal ${signalId} decision: ${decision.decision} (confidence: ${(decision.confidence * 100).toFixed(1)}%)`)
    
    // Step 3: Trade execution (Task 8)
    if (decision.decision === 'TRADE') {
      const { executeTrade } = await import('@/lib/paper-trading')
      
      console.log(`[Queue] Signal ${signalId} approved for trading - executing on all brokers`)
      
      const { tradeId, results } = await executeTrade(signal, decision)
      
      const successfulBrokers = Object.entries(results)
        .filter(([_, r]) => r.status === 'filled')
        .map(([b]) => b)
      
      console.log(`[Queue] Trade ${tradeId} executed on ${successfulBrokers.length}/3 brokers: ${successfulBrokers.join(', ')}`)
    }
    
  } catch (error) {
    console.error(`[Queue] Error processing signal ${signalId}:`, error)
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
