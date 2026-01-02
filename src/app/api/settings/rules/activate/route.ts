/**
 * Activate Trading Rules Version API
 * 
 * POST - Activate a specific rules version
 * 
 * Requirements: 9.1, 9.5
 */

import { NextRequest, NextResponse } from 'next/server'
import { activateRulesVersion } from '@/lib/config-manager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rulesId } = body

    if (!rulesId) {
      return NextResponse.json(
        { error: 'Rules ID is required' },
        { status: 400 }
      )
    }

    // TODO: Get actual user ID from auth session
    const userId = 'system'

    const result = await activateRulesVersion(rulesId, userId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Rules version activated successfully'
    })
  } catch (error) {
    console.error('[Settings API] Error activating rules:', error)
    return NextResponse.json(
      { error: 'Failed to activate rules version' },
      { status: 500 }
    )
  }
}
