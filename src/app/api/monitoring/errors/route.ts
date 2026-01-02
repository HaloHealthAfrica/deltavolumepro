/**
 * Error Monitoring API
 * 
 * Provides grouped error data for the monitoring dashboard.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    // Get failed webhooks with error messages
    const [failedWebhooks, failedLast24h, failedPrev24h] = await Promise.all([
      prisma.webhookLog.findMany({
        where: {
          status: { in: ['failed', 'rejected'] },
          errorMessage: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true,
          errorMessage: true,
          errorStack: true,
          createdAt: true,
          status: true,
        }
      }),
      prisma.webhookLog.count({
        where: {
          status: { in: ['failed', 'rejected'] },
          createdAt: { gte: last24h },
        }
      }),
      prisma.webhookLog.count({
        where: {
          status: { in: ['failed', 'rejected'] },
          createdAt: { gte: last48h, lt: last24h },
        }
      }),
    ])

    // Group errors by message
    const errorGroups = new Map<string, {
      id: string
      message: string
      category: string
      count: number
      firstSeen: Date
      lastSeen: Date
      samples: Array<{
        id: string
        timestamp: Date
        stack?: string
      }>
    }>()

    for (const webhook of failedWebhooks) {
      const message = webhook.errorMessage || 'Unknown error'
      const category = categorizeError(message)
      
      if (errorGroups.has(message)) {
        const group = errorGroups.get(message)!
        group.count++
        if (webhook.createdAt < group.firstSeen) {
          group.firstSeen = webhook.createdAt
        }
        if (webhook.createdAt > group.lastSeen) {
          group.lastSeen = webhook.createdAt
        }
        if (group.samples.length < 5) {
          group.samples.push({
            id: webhook.id,
            timestamp: webhook.createdAt,
            stack: webhook.errorStack || undefined,
          })
        }
      } else {
        errorGroups.set(message, {
          id: `error-${errorGroups.size + 1}`,
          message,
          category,
          count: 1,
          firstSeen: webhook.createdAt,
          lastSeen: webhook.createdAt,
          samples: [{
            id: webhook.id,
            timestamp: webhook.createdAt,
            stack: webhook.errorStack || undefined,
          }],
        })
      }
    }

    // Calculate category counts
    const byCategory: Record<string, number> = {}
    for (const group of errorGroups.values()) {
      byCategory[group.category] = (byCategory[group.category] || 0) + group.count
    }

    // Determine trend
    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (failedLast24h > failedPrev24h * 1.2) {
      trend = 'up'
    } else if (failedLast24h < failedPrev24h * 0.8) {
      trend = 'down'
    }

    // Sort groups by count
    const sortedGroups = Array.from(errorGroups.values())
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      groups: sortedGroups,
      stats: {
        total: failedWebhooks.length,
        last24h: failedLast24h,
        byCategory,
        trend,
      }
    })
  } catch (error) {
    console.error('[Monitoring] Error fetching errors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch errors' },
      { status: 500 }
    )
  }
}

function categorizeError(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return 'Validation'
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'Timeout'
  }
  if (lowerMessage.includes('connection') || lowerMessage.includes('network')) {
    return 'Network'
  }
  if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
    return 'Authentication'
  }
  if (lowerMessage.includes('database') || lowerMessage.includes('prisma') || lowerMessage.includes('sql')) {
    return 'Database'
  }
  if (lowerMessage.includes('broker') || lowerMessage.includes('trade') || lowerMessage.includes('order')) {
    return 'Trading'
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('throttle')) {
    return 'Rate Limit'
  }
  
  return 'Other'
}
