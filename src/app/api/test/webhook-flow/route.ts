/**
 * Webhook Flow Test API
 * 
 * Tests the complete webhook flow internally:
 * 1. Generates a signed webhook payload
 * 2. Sends it to the webhook endpoint
 * 3. Verifies it appears in the monitoring system
 * 
 * Usage: GET /api/test/webhook-flow
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    steps: {},
  }

  try {
    // Step 1: Get initial counts
    const initialWebhooks = await prisma.webhookLog.count()
    const initialSignals = await prisma.signal.count()
    results.steps.initial = {
      status: 'pass',
      webhooks: initialWebhooks,
      signals: initialSignals,
    }

    // Step 2: Generate test payload
    const payload = {
      action: 'LONG',
      ticker: 'FLOWTEST',
      timestamp: Date.now(),
      timeframe_minutes: 15,
      price: { entry: 100.50 },
      volume: {
        z_score: 2.1,
        buy_percent: 65,
        sell_percent: 35,
        buyers_winning: true,
      },
      structure: {
        trend: 'BULLISH',
        vwap_position: 'ABOVE',
        at_atr_level: false,
      },
      oscillator: {
        value: 35,
        phase: 'ACCUMULATION',
        compression: false,
        leaving_accumulation: true,
        leaving_extreme_down: false,
        leaving_distribution: false,
        leaving_extreme_up: false,
      },
      suggested_levels: {
        stop_loss: 98.50,
        target_1: 104.50,
        atr: 2.0,
      },
      quality: 4,
    }

    const payloadString = JSON.stringify(payload)
    results.steps.payload = {
      status: 'pass',
      ticker: payload.ticker,
      action: payload.action,
      size: payloadString.length,
    }

    // Step 3: Sign the payload
    const secret = process.env.TRADINGVIEW_WEBHOOK_SECRET
    if (!secret) {
      results.steps.signature = {
        status: 'fail',
        error: 'TRADINGVIEW_WEBHOOK_SECRET not configured',
      }
      results.overallStatus = 'failed'
      return NextResponse.json(results)
    }

    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payloadString)
    const signature = hmac.digest('hex')
    results.steps.signature = {
      status: 'pass',
      signaturePrefix: signature.substring(0, 16) + '...',
    }

    // Step 4: Send webhook to internal endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000'
    
    const webhookUrl = `${baseUrl}/api/webhooks/tradingview`
    const startTime = Date.now()

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tradingview-signature': signature,
      },
      body: payloadString,
    })

    const webhookResult = await response.json()
    const elapsed = Date.now() - startTime

    results.steps.webhook = {
      status: response.ok ? 'pass' : 'fail',
      httpStatus: response.status,
      processingTime: elapsed,
      signalId: webhookResult.signalId,
      webhookId: webhookResult.webhookId,
      error: webhookResult.error,
    }

    if (!response.ok) {
      results.overallStatus = 'failed'
      return NextResponse.json(results)
    }

    // Step 5: Wait briefly for database writes
    await new Promise(r => setTimeout(r, 500))

    // Step 6: Verify in database
    const finalWebhooks = await prisma.webhookLog.count()
    const finalSignals = await prisma.signal.count()

    const webhookDiff = finalWebhooks - initialWebhooks
    const signalDiff = finalSignals - initialSignals

    results.steps.verification = {
      status: webhookDiff > 0 && signalDiff > 0 ? 'pass' : 'partial',
      webhooksCreated: webhookDiff,
      signalsCreated: signalDiff,
      finalWebhooks,
      finalSignals,
    }

    // Step 7: Check if webhook appears in feed
    const recentWebhook = await prisma.webhookLog.findFirst({
      where: { signalId: webhookResult.signalId },
      select: {
        id: true,
        status: true,
        processingTime: true,
        createdAt: true,
      },
    })

    results.steps.feedCheck = {
      status: recentWebhook ? 'pass' : 'fail',
      webhookFound: !!recentWebhook,
      webhookDetails: recentWebhook,
    }

    // Overall status
    const allPassed = webhookDiff > 0 && signalDiff > 0 && recentWebhook
    results.overallStatus = allPassed ? 'success' : 'partial'
    results.summary = allPassed 
      ? 'Webhook flow working correctly! Webhooks will appear on /monitoring dashboard.'
      : webhookDiff === 0 
        ? 'Signal created but webhook not logged to WebhookLog table. Check WebhookMonitor errors.'
        : 'Partial success - check individual steps for details.'

  } catch (error) {
    results.error = error instanceof Error ? error.message : String(error)
    results.overallStatus = 'error'
  }

  return NextResponse.json(results)
}
