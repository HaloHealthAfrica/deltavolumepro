/**
 * Health Check API
 * System health monitoring endpoint
 * 
 * Requirements: 11.5, 12.4
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cacheStats } from '@/lib/cache'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string }
    cache: { status: 'ok'; size: number }
    memory: { status: 'ok' | 'warning'; usedMB: number; totalMB: number }
  }
  services: {
    tradier: boolean
    twelvedata: boolean
    alpaca: boolean
    pusher: boolean
  }
}

const startTime = Date.now()

export async function GET() {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: { status: 'ok' },
      cache: { status: 'ok', size: 0 },
      memory: { status: 'ok', usedMB: 0, totalMB: 0 },
    },
    services: {
      tradier: !!process.env.TRADIER_API_KEY,
      twelvedata: !!process.env.TWELVEDATA_API_KEY,
      alpaca: !!process.env.ALPACA_API_KEY,
      pusher: !!process.env.PUSHER_APP_ID,
    },
  }

  // Check database connection
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    health.checks.database = {
      status: 'ok',
      latencyMs: Date.now() - dbStart,
    }
  } catch (error) {
    health.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    health.status = 'degraded'
  }

  // Check cache
  const cache = cacheStats()
  health.checks.cache = {
    status: 'ok',
    size: cache.size,
  }

  // Check memory usage
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage()
    const usedMB = Math.round(memory.heapUsed / 1024 / 1024)
    const totalMB = Math.round(memory.heapTotal / 1024 / 1024)
    
    health.checks.memory = {
      status: usedMB > totalMB * 0.9 ? 'warning' : 'ok',
      usedMB,
      totalMB,
    }

    if (health.checks.memory.status === 'warning') {
      health.status = 'degraded'
    }
  }

  // Determine overall status
  if (health.checks.database.status === 'error') {
    health.status = 'unhealthy'
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}
