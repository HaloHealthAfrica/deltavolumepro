/**
 * Test Connection API
 * 
 * Verifies the monitoring system is fully connected.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    tests: {},
  }

  // Test 1: Database connection
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    results.tests.database = {
      status: 'pass',
      latency: Date.now() - dbStart,
    }
  } catch (error) {
    results.tests.database = {
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // Test 2: WebhookLog table access
  try {
    const count = await prisma.webhookLog.count()
    results.tests.webhookLogTable = {
      status: 'pass',
      count,
    }
  } catch (error) {
    results.tests.webhookLogTable = {
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // Test 3: Signal table access
  try {
    const count = await prisma.signal.count()
    results.tests.signalTable = {
      status: 'pass',
      count,
    }
  } catch (error) {
    results.tests.signalTable = {
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // Test 4: Write capability
  try {
    const testRecord = await prisma.webhookLog.create({
      data: {
        sourceIp: '127.0.0.1',
        headers: { test: true },
        payload: { test: 'connection-test' },
        payloadSize: 25,
        processingTime: 0,
        status: 'success',
      }
    })
    await prisma.webhookLog.delete({ where: { id: testRecord.id } })
    results.tests.writeCapability = { status: 'pass' }
  } catch (error) {
    results.tests.writeCapability = {
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
    }
  }

  // Test 5: Pusher configuration
  results.tests.pusherConfig = {
    status: process.env.NEXT_PUBLIC_PUSHER_KEY ? 'configured' : 'not_configured',
    note: process.env.NEXT_PUBLIC_PUSHER_KEY 
      ? 'Real-time updates enabled' 
      : 'Real-time updates disabled - using polling only',
  }

  // Overall status
  const allPassed = Object.values(results.tests).every(
    (t: any) => t.status === 'pass' || t.status === 'configured' || t.status === 'not_configured'
  )
  results.overallStatus = allPassed ? 'connected' : 'issues_detected'

  return NextResponse.json(results)
}
