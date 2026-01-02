/**
 * System Health API
 * 
 * Provides system health status for the monitoring dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency?: number
  usagePercent?: number
  depth?: number
  message?: string
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    
    // Check database health
    let database: HealthStatus = { status: 'healthy' }
    const dbStart = Date.now()
    try {
      await prisma.$queryRaw`SELECT 1`
      database.latency = Date.now() - dbStart
      if (database.latency > 1000) {
        database.status = 'degraded'
        database.message = 'High latency'
      }
    } catch (error) {
      database.status = 'unhealthy'
      database.message = 'Connection failed'
    }

    // Check API health (self-check)
    let api: HealthStatus = { status: 'healthy', latency: 0 }

    // Check memory health
    const memoryUsage = process.memoryUsage()
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
    let memory: HealthStatus = {
      status: memoryPercent > 90 ? 'unhealthy' : memoryPercent > 75 ? 'degraded' : 'healthy',
      usagePercent: memoryPercent
    }

    // Check queue health
    const activeStages = await prisma.processingStage.count({
      where: { status: 'in_progress' }
    })
    let queue: HealthStatus = {
      status: activeStages > 100 ? 'degraded' : 'healthy',
      depth: activeStages
    }

    // Determine overall status
    const statuses = [database.status, api.status, memory.status, queue.status]
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy'
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded'
    }

    return NextResponse.json({
      status: overallStatus,
      database,
      api,
      memory,
      queue,
      lastCheck: now.toISOString(),
      uptime: process.uptime(),
    })
  } catch (error) {
    console.error('[Monitoring] Error checking health:', error)
    return NextResponse.json({
      status: 'unhealthy',
      database: { status: 'unhealthy', message: 'Check failed' },
      api: { status: 'unhealthy', message: 'Check failed' },
      memory: { status: 'unhealthy', message: 'Check failed' },
      queue: { status: 'unhealthy', message: 'Check failed' },
      lastCheck: new Date().toISOString(),
      error: 'Health check failed'
    }, { status: 500 })
  }
}
