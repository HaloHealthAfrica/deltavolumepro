import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWebhookSignature, parseWebhookPayload } from '@/lib/webhook-utils'
import { queueSignalProcessing } from '@/lib/signal-queue'
import { broadcaster } from '@/lib/realtime'
import { checkRateLimit, getRateLimitKey, createRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiter'
import { getClientIp } from '@/lib/security'
import { webhookLogger } from '@/lib/logger'

/**
 * TradingView Webhook Endpoint
 * 
 * Receives trading signals from TradingView with HMAC signature validation.
 * Stores signals in database and queues them for background processing.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.4, 12.1
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const clientIp = getClientIp(request.headers)
  
  try {
    // Rate limiting check (Requirement 10.4)
    const rateLimitKey = getRateLimitKey(clientIp, 'webhook')
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.webhook)
    
    if (!rateLimitResult.allowed) {
      webhookLogger.warn('Rate limit exceeded', { 
        ip: clientIp, 
        retryAfter: rateLimitResult.retryAfter 
      })
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
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
      )
    }

    // Parse and validate webhook payload (Requirement 1.3)
    const parsedSignal = parseWebhookPayload(webhookData)
    
    if (!parsedSignal) {
      webhookLogger.warn('Invalid webhook payload structure', { ip: clientIp })
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400, headers: createRateLimitHeaders(rateLimitResult) }
      )
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

    // Broadcast signal received event in real-time
    await broadcaster.signalReceived(signal)

    // Queue signal for background processing (Requirement 1.5)
    await queueSignalProcessing(signal.id)

    const processingTime = Date.now() - startTime
    
    webhookLogger.info('Signal received and queued', {
      signalId: signal.id,
      ticker: signal.ticker,
      action: signal.action,
      processingTimeMs: processingTime
    })

    // Return success response within 100ms target (Requirement 1.5, 12.1)
    return NextResponse.json(
      {
        success: true,
        signalId: signal.id,
        processingTime
      },
      { status: 200, headers: createRateLimitHeaders(rateLimitResult) }
    )

  } catch (error) {
    // Comprehensive error handling (Requirement 1.4)
    const processingTime = Date.now() - startTime
    
    webhookLogger.error('Error processing webhook', error as Error, {
      ip: clientIp,
      processingTimeMs: processingTime
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
