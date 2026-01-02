/**
 * Error Monitoring API
 * 
 * Provides access to tracked errors and error statistics.
 * Requirements: 12.4
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRecentErrors, getErrorStats, resolveError, type ErrorSeverity } from '@/lib/error-monitoring'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity') as ErrorSeverity | null
    const limit = parseInt(searchParams.get('limit') || '50')
    const resolved = searchParams.get('resolved')
    
    const errors = getRecentErrors({
      severity: severity || undefined,
      limit,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined
    })
    
    const stats = getErrorStats()
    
    return NextResponse.json({
      errors,
      stats,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[ErrorMonitoring] Error fetching errors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch error data' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { errorId, action } = body
    
    if (!errorId) {
      return NextResponse.json(
        { error: 'errorId is required' },
        { status: 400 }
      )
    }
    
    if (action === 'resolve') {
      const success = resolveError(errorId)
      if (success) {
        return NextResponse.json({ success: true, message: 'Error resolved' })
      } else {
        return NextResponse.json(
          { error: 'Error not found' },
          { status: 404 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[ErrorMonitoring] Error updating error:', error)
    return NextResponse.json(
      { error: 'Failed to update error' },
      { status: 500 }
    )
  }
}
