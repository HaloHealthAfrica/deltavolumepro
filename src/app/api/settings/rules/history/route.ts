/**
 * Trading Rules History API
 * 
 * GET - Get all trading rules versions
 * 
 * Requirements: 9.5
 */

import { NextResponse } from 'next/server'
import { getTradingRulesHistory } from '@/lib/config-manager'

export async function GET() {
  try {
    const history = await getTradingRulesHistory()

    return NextResponse.json({ 
      history,
      count: history.length
    })
  } catch (error) {
    console.error('[Settings API] Error fetching rules history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rules history' },
      { status: 500 }
    )
  }
}
