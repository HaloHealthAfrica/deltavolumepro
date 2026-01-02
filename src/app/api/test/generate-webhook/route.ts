/**
 * Test Webhook Generator API
 * 
 * Generates a properly signed test webhook payload that can be sent
 * to the TradingView webhook endpoint for testing purposes.
 * 
 * Only available in development or when explicitly enabled.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticker, action, quality } = body

    // Generate test webhook payload
    const payload = generateTestPayload(ticker, action, quality)
    const payloadString = JSON.stringify(payload)

    // Generate signature
    const secret = process.env.TRADINGVIEW_WEBHOOK_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: 'TRADINGVIEW_WEBHOOK_SECRET not configured' },
        { status: 500 }
      )
    }

    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payloadString)
    const signature = hmac.digest('hex')

    return NextResponse.json({
      payload,
      payloadString,
      signature,
    })
  } catch (error) {
    console.error('[Test] Error generating webhook:', error)
    return NextResponse.json(
      { error: 'Failed to generate test webhook' },
      { status: 500 }
    )
  }
}

function generateTestPayload(
  ticker: string = 'SPY',
  action: string = 'LONG',
  quality: number = 4
) {
  const now = Date.now()
  const basePrice = getBasePrice(ticker)
  const atr = basePrice * 0.015 // 1.5% ATR

  return {
    action,
    ticker: ticker.toUpperCase(),
    timestamp: now,
    timeframe_minutes: 15,
    price: {
      entry: basePrice,
    },
    volume: {
      z_score: 1.5 + Math.random() * 1.5,
      buy_percent: 55 + Math.random() * 20,
      sell_percent: 25 + Math.random() * 15,
      buyers_winning: action.includes('LONG'),
    },
    structure: {
      trend: action.includes('LONG') ? 'BULLISH' : 'BEARISH',
      vwap_position: action.includes('LONG') ? 'ABOVE' : 'BELOW',
      at_atr_level: Math.random() > 0.5,
    },
    oscillator: {
      value: action.includes('LONG') ? 30 + Math.random() * 20 : 70 - Math.random() * 20,
      phase: action.includes('LONG') ? 'ACCUMULATION' : 'DISTRIBUTION',
      compression: Math.random() > 0.7,
      leaving_accumulation: action.includes('LONG') && Math.random() > 0.5,
      leaving_extreme_down: action.includes('LONG') && Math.random() > 0.7,
      leaving_distribution: action.includes('SHORT') && Math.random() > 0.5,
      leaving_extreme_up: action.includes('SHORT') && Math.random() > 0.7,
    },
    suggested_levels: {
      stop_loss: action.includes('LONG') ? basePrice - atr : basePrice + atr,
      target_1: action.includes('LONG') ? basePrice + atr * 2 : basePrice - atr * 2,
      atr,
    },
    quality,
  }
}

function getBasePrice(ticker: string): number {
  const prices: Record<string, number> = {
    SPY: 585.50,
    QQQ: 505.25,
    AAPL: 195.80,
    MSFT: 425.30,
    NVDA: 140.50,
    TSLA: 255.75,
    AMD: 125.40,
    META: 585.20,
    GOOGL: 175.60,
    AMZN: 205.90,
  }
  return prices[ticker.toUpperCase()] || 100 + Math.random() * 400
}
