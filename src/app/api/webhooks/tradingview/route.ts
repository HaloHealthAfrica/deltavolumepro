import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWebhookSignature, parseWebhookPayload } from '@/lib/webhook-utils'
import { queueSignalProcessing } from '@/lib/signal-queue'
import { broadcaster } from '@/lib/realtime'
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiter'
import { getClientIp } from '@/lib/security'
import { webhookLogger } from '@/lib/logger'
import { WebhookMonitor } from '@/lib/monitoring/webhook-monitor'
import type { CreateWebhookRequestInput, CreateProcessingStageInput } from '@/lib/monitoring'

/**
 * Singleton WebhookMonitor instance
 * 
 * Using a singleton pattern ensures:
 * - Consistent monitoring state across all webhook requests
 * - Reduced memory allocation overhead per request
 * - Better performance for high-throughput webhook processing
 * - Maintains <100ms response time requirement
 */
let webhookMonitorInstance: WebhookMonitor | null = null

function getWebhookMonitor(): WebhookMonitor {
  if (!webhookMonitorInstance) {
    webhookMonitorInstance = new WebhookMonitor()
  }
  return webhookMonitorInstance
}

/**
 * TradingView Webhook Endpoint
 * 
 * Receives trading signals from TradingView with HMAC signature validation.
 * Stores signals in database and queues them for background processing.
 * Integrates with WebhookMonitor service for comprehensive monitoring.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.4, 12.1
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const clientIp = getClientIp(request.headers)
  
  // Get singleton monitoring service instance
  const monitor = getWebhookMonitor()
  let webhookId: string | undefined
  let signalId: string | undefined
  
  try {
    // Rate limiting check (Requirement 10.4)
    const rateLimitKey = getRateLimitKey(clientIp, 'webhook')
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.webhook)
    
    if (!rateLimitResult.allowed) {
      webhookLogger.warn('Rate limit exceeded', { 
        ip: clientIp, 
        retryAfter: rateLimitResult.retryAfter 
      })
      
      // Record rejected webhook for monitoring
      try {
        await recordWebhookRequest(monitor, request, clientIp, null, 'rejected', 'Rate limit exceeded')
      } catch (monitoringError) {
        webhookLogger.warn('Failed to record rate-limited webhook', { error: String(monitoringError) })
      }
      
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // Extract signature from headers
    const signature = request.headers.get('x-tradingview-signature')
    
    if (!signature) {
      webhookLogger.warn('Missing signature header', { ip: clientIp })
      
      // Record rejected webhook for monitoring
      try {
        await recordWebhookRequest(monitor, request, clientIp, null, 'rejected', 'Missing signature')
      } catch (monitoringError) {
        webhookLogger.warn('Failed to record rejected webhook', { error: String(monitoringError) })
      }
      
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401, headers: createRateLimitHeaders(rateLimitResult) }
      )
    }

    // Get raw body for signature validation
    const rawBody = await request.text()
    
    // Validate webhook signature (Requirement 1.2)
    const isValid = validateWebhookSignature(rawBody, signature)
    
    if (!isValid) {
      webhookLogger.warn('Invalid signature', { ip: clientIp })
      
      // Record rejected webhook for monitoring
      try {
        await recordWebhookRequest(monitor, request, clientIp, rawBody, 'rejected', 'Invalid signature')
      } catch (monitoringError) {
        webhookLogger.warn('Failed to record rejected webhook', { error: String(monitoringError) })
      }
      
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401, headers: createRateLimitHeaders(rateLimitResult) }
      )
    }

    // Parse JSON payload
    let webhookData
    try {
      webhookData = JSON.parse(rawBody)
    } catch (parseError) {
      webhookLogger.warn('Invalid JSON payload', { ip: clientIp, error: (parseError as Error).message })
      
      // Record failed webhook for monitoring
      try {
        await recordWebhookRequest(monitor, request, clientIp, rawBody, 'failed', 'Invalid JSON payload')
      } catch (monitoringError) {
        webhookLogger.warn('Failed to record failed webhook', { error: String(monitoringError) })
      }
      
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
      )
    }

    // Record webhook request immediately upon receipt (Monitoring Integration)
    // Note: recordWebhookRequest may return null if monitoring fails
    try {
      const webhook = await recordWebhookRequest(monitor, request, clientIp, webhookData, 'success')
      if (webhook) {
        webhookId = webhook.id
      }
    } catch (monitoringError) {
      // Don't fail webhook processing if monitoring fails
      webhookLogger.warn('Failed to record webhook request for monitoring', { error: String(monitoringError) })
    }

    // Track processing stage: received → enriching
    try {
      if (webhookId) {
        await trackProcessingStage(monitor, webhookId, 'received', 'Processing webhook request')
      }
    } catch (monitoringError) {
      webhookLogger.warn('Failed to track received stage', { error: String(monitoringError) })
    }

    // Parse and validate webhook payload (Requirement 1.3)
    const parsedSignal = parseWebhookPayload(webhookData)
    
    if (!parsedSignal) {
      webhookLogger.warn('Invalid webhook payload structure', { ip: clientIp })
      
      // Update webhook status for monitoring
      try {
        if (webhookId) {
          await updateWebhookStatus(monitor, webhookId, 'failed', 'Invalid payload structure')
        }
      } catch (monitoringError) {
        webhookLogger.warn('Failed to update webhook status', { error: String(monitoringError) })
      }
      
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
      )
    }

    // Track processing stage: enriching → decided
    try {
      if (webhookId) {
        await trackProcessingStage(monitor, webhookId, 'enriching', 'Enriching signal data')
      }
    } catch (monitoringError) {
      webhookLogger.warn('Failed to track enriching stage', { error: String(monitoringError) })
    }

    // Store signal in database (Requirement 1.1)
    const signal = await prisma.signal.create({
      data: {
        rawPayload: webhookData,
        action: parsedSignal.action,
        ticker: parsedSignal.ticker,
        timestamp: parsedSignal.timestamp,
        timeframeMinutes: parsedSignal.timeframeMinutes,
        entryPrice: parsedSignal.entryPrice,
        quality: parsedSignal.quality,
        zScore: parsedSignal.zScore,
        buyPercent: parsedSignal.buyPercent,
        sellPercent: parsedSignal.sellPercent,
        buyersWinning: parsedSignal.buyersWinning,
        trend: parsedSignal.trend,
        vwapPosition: parsedSignal.vwapPosition,
        atAtrLevel: parsedSignal.atAtrLevel,
        oscillatorValue: parsedSignal.oscillatorValue,
        oscillatorPhase: parsedSignal.oscillatorPhase,
        compression: parsedSignal.compression,
        leavingAccumulation: parsedSignal.leavingAccumulation,
        leavingExtremeDown: parsedSignal.leavingExtremeDown,
        leavingDistribution: parsedSignal.leavingDistribution,
        leavingExtremeUp: parsedSignal.leavingExtremeUp,
        stopLoss: parsedSignal.stopLoss,
        target1: parsedSignal.target1,
        atr: parsedSignal.atr,
        status: 'received'
      }
    })

    signalId = signal.id

    // Update webhook with signal ID for monitoring
    try {
      if (webhookId) {
        await updateWebhookWithSignal(monitor, webhookId, signalId)
      }
    } catch (monitoringError) {
      webhookLogger.warn('Failed to update webhook with signal ID', { error: String(monitoringError) })
    }

    // Track processing stage: decided → executed
    try {
      if (webhookId) {
        await trackProcessingStage(monitor, webhookId, 'deciding', 'Making trading decision', { signalId })
      }
    } catch (monitoringError) {
      webhookLogger.warn('Failed to track deciding stage', { error: String(monitoringError) })
    }

    // Broadcast signal received event in real-time
    await broadcaster.signalReceived(signal)

    // Queue signal for background processing (Requirement 1.5)
    await queueSignalProcessing(signal.id)

    // Track processing stage: executed → completed
    try {
      if (webhookId) {
        await trackProcessingStage(monitor, webhookId, 'executing', 'Queuing signal for processing')
      }
    } catch (monitoringError) {
      webhookLogger.warn('Failed to track executing stage', { error: String(monitoringError) })
    }

    const processingTime = Date.now() - startTime
    
    // Update webhook with final processing time and status
    try {
      if (webhookId) {
        await updateWebhookFinal(monitor, webhookId, processingTime, 'success')
        await trackProcessingStage(monitor, webhookId, 'completed', 'Webhook processing completed')
      }
    } catch (monitoringError) {
      webhookLogger.warn('Failed to update final webhook status', { error: String(monitoringError) })
    }
    
    webhookLogger.info('Signal received and queued', {
      signalId: signal.id,
      ticker: signal.ticker,
      action: signal.action,
      processingTimeMs: processingTime,
      webhookId
    })

    // Return success response within 100ms target (Requirement 1.5, 12.1)
    return NextResponse.json(
      {
        success: true,
        signalId: signal.id,
        processingTime,
        webhookId
      },
      { status: 200, headers: createRateLimitHeaders(rateLimitResult) }
    )

  } catch (error) {
    // Comprehensive error handling (Requirement 1.4)
    const processingTime = Date.now() - startTime
    
    // Update webhook with error information for monitoring
    try {
      if (webhookId) {
        await updateWebhookFinal(
          monitor, 
          webhookId, 
          processingTime, 
          'failed', 
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error.stack : undefined
        )
        await trackProcessingStage(monitor, webhookId, 'failed', 'Webhook processing failed', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    } catch (monitoringError) {
      webhookLogger.warn('Failed to update webhook error status', { error: String(monitoringError) })
    }
    
    webhookLogger.error('Error processing webhook', error as Error, {
      ip: clientIp,
      processingTimeMs: processingTime,
      webhookId,
      signalId
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An error occurred processing the webhook'
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/tradingview',
    timestamp: new Date().toISOString()
  })
}

// ========================================
// Monitoring Helper Functions
// ========================================

/**
 * Record webhook request for monitoring
 * Handles errors gracefully to not impact webhook processing
 */
async function recordWebhookRequest(
  monitor: WebhookMonitor,
  request: NextRequest,
  clientIp: string,
  payload: any,
  status: 'success' | 'failed' | 'rejected',
  errorMessage?: string
): Promise<{ id: string } | null> {
  try {
    const headers = Object.fromEntries(request.headers.entries())
    const payloadStr = payload ? JSON.stringify(payload) : ''
    
    const webhookRequest: CreateWebhookRequestInput = {
      sourceIp: clientIp,
      userAgent: headers['user-agent'] || undefined,
      headers,
      payload: payload || {},
      payloadSize: payloadStr.length,
      signature: headers['x-tradingview-signature'] || undefined,
      processingTime: 0, // Will be updated later
      status,
      errorMessage: errorMessage || undefined,
    }

    const result = await monitor.recordWebhookRequest(webhookRequest)
    console.log('[Webhook] Successfully recorded webhook:', result.id)
    return result
  } catch (error) {
    // Log the error for debugging but don't throw
    console.error('[Webhook] Failed to record webhook request:', error)
    return null
  }
}

/**
 * Track processing stage for monitoring
 * Handles errors gracefully to not impact webhook processing
 */
async function trackProcessingStage(
  monitor: WebhookMonitor,
  webhookId: string,
  stage: 'received' | 'enriching' | 'deciding' | 'executing' | 'completed' | 'failed',
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // For webhook monitoring, we'll use the webhookId as a pseudo-signalId
    // In a real implementation, you might want to create actual processing stages
    // linked to the signal once it's created
    const stageInput: CreateProcessingStageInput = {
      signalId: webhookId, // Using webhookId as signalId for tracking
      stage: stage as any,
      startedAt: new Date(),
      status: stage === 'failed' ? 'failed' : (stage === 'completed' ? 'completed' : 'in_progress'),
      metadata: {
        description,
        ...metadata
      }
    }

    await monitor.startProcessingStage(stageInput)
  } catch (error) {
    // Don't throw - monitoring failures shouldn't break webhook processing
  }
}

/**
 * Update webhook status for monitoring
 * Handles errors gracefully to not impact webhook processing
 */
async function updateWebhookStatus(
  monitor: WebhookMonitor,
  webhookId: string,
  status: 'success' | 'failed' | 'rejected',
  errorMessage?: string
): Promise<void> {
  try {
    await monitor.updateWebhookRequest(webhookId, {
      status,
      errorMessage: errorMessage || undefined,
    })
  } catch (error) {
    // Don't throw - monitoring failures shouldn't break webhook processing
  }
}

/**
 * Update webhook with signal ID for monitoring
 * Handles errors gracefully to not impact webhook processing
 */
async function updateWebhookWithSignal(
  monitor: WebhookMonitor,
  webhookId: string,
  signalId: string
): Promise<void> {
  try {
    await monitor.updateWebhookRequest(webhookId, {
      signalId,
    })
  } catch (error) {
    // Don't throw - monitoring failures shouldn't break webhook processing
  }
}

/**
 * Update webhook with final processing results for monitoring
 * Handles errors gracefully to not impact webhook processing
 */
async function updateWebhookFinal(
  monitor: WebhookMonitor,
  webhookId: string,
  processingTime: number,
  status: 'success' | 'failed' | 'rejected',
  errorMessage?: string,
  errorStack?: string
): Promise<void> {
  try {
    await monitor.updateWebhookRequest(webhookId, {
      processingTime,
      status,
      errorMessage: errorMessage || undefined,
      errorStack: errorStack || undefined,
    })
  } catch (error) {
    // Don't throw - monitoring failures shouldn't break webhook processing
  }
}
