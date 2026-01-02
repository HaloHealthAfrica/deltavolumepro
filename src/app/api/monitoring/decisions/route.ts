/**
 * Decision Analysis API
 * 
 * Provides decision engine data for the monitoring dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const outcome = searchParams.get('outcome')
    const timeRange = searchParams.get('timeRange') || '24h'

    // Calculate time filter
    const now = new Date()
    let dateFrom: Date
    switch (timeRange) {
      case '1h': dateFrom = new Date(now.getTime() - 60 * 60 * 1000); break
      case '24h': dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000); break
      case '7d': dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      default: dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }

    // Build where clause
    const where: any = {
      createdAt: { gte: dateFrom }
    }
    if (outcome && outcome !== 'all') {
      where.decision = outcome === 'approved' ? 'APPROVE' : 'REJECT'
    }

    // Fetch decisions with pagination
    const [decisions, total, stats] = await Promise.all([
      prisma.decision.findMany({
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
            }
          }
        }
      }),
      prisma.decision.count({ where }),
      prisma.decision.aggregate({
        where,
        _avg: { confidence: true },
        _count: { id: true }
      })
    ])

    // Get outcome breakdown
    const [approved, rejected] = await Promise.all([
      prisma.decision.count({ where: { ...where, decision: 'APPROVE' } }),
      prisma.decision.count({ where: { ...where, decision: 'REJECT' } })
    ])

    return NextResponse.json({
      data: decisions.map(d => ({
        id: d.id,
        signalId: d.signalId,
        ticker: d.signal?.ticker,
        action: d.signal?.action,
        outcome: d.decision === 'APPROVE' ? 'approved' : 'rejected',
        confidenceScore: d.confidence,
        threshold: 0.7, // Default threshold
        factors: (d as any).factors || [],
        rejectionReasons: (d as any).rejectionReasons || [],
        createdAt: d.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        total,
        approved,
        rejected,
        avgConfidence: stats._avg.confidence || 0,
        approvalRate: total > 0 ? (approved / total) * 100 : 0,
      }
    })
  } catch (error) {
    console.error('[Monitoring] Error fetching decisions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    )
  }
}
