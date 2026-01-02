/**
 * Trading Rules API Routes
 * 
 * GET - Get active trading rules
 * PUT - Update trading rules
 * POST - Create new rules version
 * 
 * Requirements: 9.1, 9.2, 9.5
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  getActiveTradingRules, 
  updateTradingRules, 
  createNewRulesVersion,
  TradingRulesUpdateSchema 
} from '@/lib/config-manager'

export async function GET() {
  try {
    const rules = await getActiveTradingRules()
    
    if (!rules) {
      return NextResponse.json(
        { error: 'No active trading rules found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[Settings API] Error fetching rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trading rules' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { rulesId, updates } = body

    if (!rulesId) {
      return NextResponse.json(
        { error: 'Rules ID is required' },
        { status: 400 }
      )
    }

    // Validate updates
    const validation = TradingRulesUpdateSchema.safeParse(updates)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid update data', details: validation.error.issues },
        { status: 400 }
      )
    }

    // TODO: Get actual user ID from auth session
    const userId = 'system'

    const result = await updateTradingRules(rulesId, updates, userId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      rules: result.rules,
      message: 'Trading rules updated successfully'
    })
  } catch (error) {
    console.error('[Settings API] Error updating rules:', error)
    return NextResponse.json(
      { error: 'Failed to update trading rules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { baseRulesId, updates } = body

    if (!baseRulesId) {
      return NextResponse.json(
        { error: 'Base rules ID is required' },
        { status: 400 }
      )
    }

    // TODO: Get actual user ID from auth session
    const userId = 'system'

    const result = await createNewRulesVersion(baseRulesId, updates || {}, userId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      rules: result.rules,
      message: 'New rules version created successfully'
    })
  } catch (error) {
    console.error('[Settings API] Error creating rules version:', error)
    return NextResponse.json(
      { error: 'Failed to create new rules version' },
      { status: 500 }
    )
  }
}
