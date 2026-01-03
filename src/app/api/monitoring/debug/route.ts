/**
 * Debug API for monitoring
 * 
 * Helps diagnose issues with webhook logging
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Count webhooks
    const webhookCount = await prisma.webhookLog.count()
    
    // Get latest 5 webhooks
    const latestWebhooks = await prisma.webhookLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        status: true,
        sourceIp: true,
        processingTime: true,
        signalId: true,
        errorMessage: true,
      }
    })
    
    // Count signals
    const signalCount = await prisma.signal.count()
    
    // Get latest 5 signals
    const latestSignals = await prisma.signal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        ticker: true,
        action: true,
        status: true,
      }
    })
    
    // Count processing stages
    const stageCount = await prisma.processingStage.count()

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      counts: {
        webhooks: webhookCount,
        signals: signalCount,
        processingStages: stageCount,
      },
      latestWebhooks,
      latestSignals,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Debug] Database error:', error)
    return NextResponse.json({
      status: 'error',
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
