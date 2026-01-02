/**
 * Real-time Metrics API
 * 
 * Provides current system metrics for the monitoring dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    // Get recent webhook stats
    const [
      webhooksLastMinute,
      webhooksLast5Min,
      successfulWebhooks,
      failedWebhooks,
      avgProcessingTime,
      activeStages
    ] = await Promise.all([
      prisma.webhookLog.count({
        where: { createdAt: { gte: oneMinuteAgo } }
      }),
      prisma.webhookLog.count({
        where: { createdAt: { gte: fiveMinutesAgo } }
      }),
      prisma.webhookLog.count({
        where: { 
          createdAt: { gte: fiveMinutesAgo },
          status: 'success'
        }
      }),
      prisma.webhookLog.count({
        where: { 
          createdAt: { gte: fiveMinutesAgo },
          status: { in: ['failed', 'rejected'] }
        }
      }),
      prisma.webhookLog.aggregate({
        where: { createdAt: { gte: fiveMinutesAgo } },
        _avg: { processingTime: true }
      }),
      prisma.processingStage.count({
        where: { status: 'in_progress' }
      })
    ])

    const totalRecent = successfulWebhooks + failedWebhooks
    const successRate = totalRecent > 0 ? (successfulWebhooks / totalRecent) * 100 : 100
    const errorRate = totalRecent > 0 ? (failedWebhooks / totalRecent) * 100 : 0

    // Get memory usage
    const memoryUsage = process.memoryUsage()
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
    const memoryPercent = (memoryUsedMB / memoryTotalMB) * 100

    return NextResponse.json({
      timestamp: now.toISOString(),
      webhookVolume: webhooksLastMinute,
      webhooksPerMinute: webhooksLast5Min / 5,
      successRate,
      errorRate,
      avgProcessingTime: avgProcessingTime._avg.processingTime || 0,
      queueDepth: activeStages,
      activeStages,
      memoryUsage: memoryPercent,
      memoryUsedMB,
      memoryTotalMB,
    })
  } catch (error) {
    console.error('[Monitoring] Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
