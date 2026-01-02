import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Simple test webhook without signature validation
    const body = await request.json()
    
    // Create a test signal
    const signal = await prisma.signal.create({
      data: {
        rawPayload: body,
        action: body.action || 'BUY',
        ticker: body.ticker || 'TEST',
        timestamp: BigInt(Date.now()),
        timeframeMinutes: body.timeframe || 15,
        entryPrice: body.price || 100,
        quality: body.quality || 4,
        zScore: 1.5,
        buyPercent: 65,
        sellPercent: 35,
        buyersWinning: true,
        trend: 'BULLISH',
        vwapPosition: 'ABOVE',
        atAtrLevel: true,
        oscillatorValue: 50,
        oscillatorPhase: 'ACCUMULATION',
        compression: true,
        leavingAccumulation: true,
        stopLoss: (body.price || 100) * 0.98,
        target1: (body.price || 100) * 1.03,
        atr: (body.price || 100) * 0.015,
        status: 'received'
      }
    })

    return NextResponse.json({
      success: true,
      signalId: signal.id,
      message: 'Test webhook received'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process test webhook' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/test-webhook',
    message: 'Send POST with JSON body to test'
  })
}