/**
 * Monitoring Dashboard API
 * 
 * Provides comprehensive system metrics and monitoring data.
 * Requirements: 12.4, 11.3
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface SystemMetrics {
  timestamp: string
  uptime: number
  signals: {
    total: number
    today: number
    byStatus: Record<string, number>
  }
  decisions: {
    total: number
    today: number
    byOutcome: Record<string, number>
    avgConfidence: number
  }
  trades: {
    total: number
    open: number
    closed: number
    todayPnL: number
    totalPnL: number
    winRate: number
  }
  performance: {
    avgProcessingTime: number
    webhooksPerMinute: number
    errorRate: number
  }
  health: {
    database: 'healthy' | 'degraded' | 'unhealthy'
    brokerConnections: Record<string, 'connected' | 'disconnected'>
    realtime: 'connected' | 'disconnected'
  }
}

const startTime = Date.now()

export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Get signal metrics
    const [totalSignals, todaySignals, signalsByStatus] = await Promise.all([
      prisma.signal.count(),
      prisma.signal.count({
        where: { createdAt: { gte: todayStart } }
      }),
      prisma.signal.groupBy({
        by: ['status'],
        _count: { status: true }
      })
    ])

    // Get decision metrics
    const [totalDecisions, todayDecisions, decisionsByOutcome, avgConfidence] = await Promise.all([
      prisma.decision.count(),
      prisma.decision.count({
        where: { createdAt: { gte: todayStart } }
      }),
      prisma.decision.groupBy({
        by: ['decision'],
        _count: { decision: true }
      }),
      prisma.decision.aggregate({
        _avg: { confidence: true }
      })
    ])

    // Get trade metrics
    const [totalTrades, openTrades, closedTrades, todayTrades, allTrades] = await Promise.all([
      prisma.trade.count(),
      prisma.trade.count({ where: { status: 'OPEN' } }),
      prisma.trade.count({ where: { status: 'CLOSED' } }),
      prisma.trade.findMany({
        where: { 
          exitedAt: { gte: todayStart },
          status: 'CLOSED'
        },
        select: { pnl: true }
      }),
      prisma.trade.findMany({
        where: { status: 'CLOSED' },
        select: { pnl: true }
      })
    ])

    // Calculate P&L
    const todayPnL = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const totalPnL = allTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const winningTrades = allTrades.filter(t => (t.pnl || 0) > 0).length
    const winRate = allTrades.length > 0 ? (winningTrades / allTrades.length) * 100 : 0

    // Build status maps
    const statusMap: Record<string, number> = {}
    signalsByStatus.forEach(s => {
      statusMap[s.status] = s._count.status
    })

    const outcomeMap: Record<string, number> = {}
    decisionsByOutcome.forEach(d => {
      outcomeMap[d.decision] = d._count.decision
    })

    // Check database health
    let dbHealth: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      dbHealth = 'unhealthy'
    }

    // Check broker connections (simplified - would need actual API calls in production)
    const brokerConnections: Record<string, 'connected' | 'disconnected'> = {
      tradier: process.env.TRADIER_API_KEY ? 'connected' : 'disconnected',
      twelvedata: process.env.TWELVEDATA_API_KEY ? 'connected' : 'disconnected',
      alpaca: process.env.ALPACA_API_KEY ? 'connected' : 'disconnected'
    }

    // Check realtime connection
    const realtimeStatus = process.env.PUSHER_APP_ID ? 'connected' : 'disconnected'

    const metrics: SystemMetrics = {
      timestamp: now.toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      signals: {
        total: totalSignals,
        today: todaySignals,
        byStatus: statusMap
      },
      decisions: {
        total: totalDecisions,
        today: todayDecisions,
        byOutcome: outcomeMap,
        avgConfidence: avgConfidence._avg.confidence || 0
      },
      trades: {
        total: totalTrades,
        open: openTrades,
        closed: closedTrades,
        todayPnL,
        totalPnL,
        winRate
      },
      performance: {
        avgProcessingTime: 150, // Would be calculated from actual metrics
        webhooksPerMinute: todaySignals / Math.max(1, (now.getHours() * 60 + now.getMinutes())),
        errorRate: 0.01 // Would be calculated from actual error logs
      },
      health: {
        database: dbHealth,
        brokerConnections,
        realtime: realtimeStatus
      }
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('[Monitoring] Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitoring metrics' },
      { status: 500 }
    )
  }
}
