/**
 * Webhook Logs API
 * 
 * Provides paginated webhook logs for the monitoring dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const status = searchParams.get('status')
    const timeRange = searchParams.get('timeRange') || '1h'

    // Calculate time filter
    const now = new Date()
    let dateFrom: Date
    switch (timeRange) {
      case '15m': dateFrom = new Date(now.getTime() - 15 * 60 * 1000); break
      case '1h': dateFrom = new Date(now.getTime() - 60 * 60 * 1000); break
      case '24h': dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000); break
      case '7d': dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      default: dateFrom = new Date(now.getTime() - 60 * 60 * 1000)
    }

    // Build where clause
    const where: any = {
      createdAt: { gte: dateFrom }
    }
    if (status && status !== 'all') {
      where.status = status
    }

    // Fetch webhooks with pagination
    const [webhooks, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          signal: {
            select: {
              id: true,
              ticker: true,
              action: true,
              status: true,
            }
          }
        }
      }),
      prisma.webhookLog.count({ where })
    ])

    return NextResponse.json({
      data: webhooks.map(w => ({
        id: w.id,
        sourceIp: w.sourceIp,
        status: w.status,
        processingTime: w.processingTime,
        payloadSize: w.payloadSize,
        signalId: w.signalId,
        ticker: w.signal?.ticker,
        errorMessage: w.errorMessage,
        createdAt: w.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('[Monitoring] Error fetching webhooks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhook logs' },
      { status: 500 }
    )
  }
}
