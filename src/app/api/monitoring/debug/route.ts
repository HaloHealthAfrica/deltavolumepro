/**
 * Monitoring Debug API
 * 
 * Provides diagnostic information about the monitoring system state.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get counts
    const [
      totalWebhooks,
      webhooksLastHour,
      webhooksLastDay,
      totalSignals,
      signalsLastHour,
      signalsLastDay,
      recentWebhooks,
      recentSignals,
    ] = await Promise.all([
      prisma.webhookLog.count(),
      prisma.webhookLog.count({ where: { createdAt: { gte: oneHourAgo } } }),
      prisma.webhookLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.signal.count(),
      prisma.signal.count({ where: { createdAt: { gte: oneHourAgo } } }),
      prisma.signal.count({ where: { createdAt: { gte: oneDayAgo } } }),
      prisma.webhookLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          sourceIp: true,
          processingTime: true,
          signalId: true,
          errorMessage: true,
          createdAt: true,
        }
      }),
      prisma.signal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          ticker: true,
          action: true,
          status: true,
          createdAt: true,
        }
      }),
    ])

    // Test write capability
    let writeTest = { success: false, error: null as string | null }
    try {
      const testWebhook = await prisma.webhookLog.create({
        data: {
          sourceIp: '127.0.0.1',
          headers: { test: true },
          payload: { test: 'debug-endpoint-test' },
          payloadSize: 30,
          processingTime: 0,
          status: 'success',
        }
      })
      // Delete the test record
      await prisma.webhookLog.delete({ where: { id: testWebhook.id } })
      writeTest.success = true
    } catch (e) {
      writeTest.error = e instanceof Error ? e.message : String(e)
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      webhooks: {
        total: totalWebhooks,
        lastHour: webhooksLastHour,
        lastDay: webhooksLastDay,
        recent: recentWebhooks,
      },
      signals: {
        total: totalSignals,
        lastHour: signalsLastHour,
        lastDay: signalsLastDay,
        recent: recentSignals,
      },
      writeTest,
      diagnosis: {
        webhooksBeingSaved: totalWebhooks > 0,
        signalsBeingCreated: totalSignals > 0,
        databaseWritable: writeTest.success,
        recentActivity: webhooksLastHour > 0 || signalsLastHour > 0,
        possibleIssues: [
          !writeTest.success ? `Database write failed: ${writeTest.error}` : null,
          totalWebhooks === 0 && totalSignals > 0 ? 'Webhooks not being recorded to WebhookLog table - check WebhookMonitor.recordWebhookRequest' : null,
          totalSignals === 0 && totalWebhooks > 0 ? 'Signals not being created from webhooks' : null,
          totalWebhooks === 0 && totalSignals === 0 ? 'No data - either no webhooks received or database issue' : null,
        ].filter(Boolean),
      }
    })
  } catch (error) {
    console.error('[Debug] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch debug info',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
