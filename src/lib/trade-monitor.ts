/**
 * Trade Monitoring and Exit Management
 * 
 * Monitors open positions and manages exit conditions including
 * stop losses, targets, and trailing stops.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { prisma } from '@/lib/prisma'
import type { Trade, Signal } from '@prisma/client'

export type ExitReason = 'STOP_LOSS' | 'TARGET_1' | 'TARGET_2' | 'TRAILING' | 'MANUAL' | 'EXPIRED'

export interface TradeWithSignal extends Trade {
  signal: Signal
}

export interface ExitConditionResult {
  shouldExit: boolean
  reason?: ExitReason
  exitPrice?: number
}

export interface PnLUpdate {
  tradeId: string
  currentPrice: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  rMultiple: number
}

// Monitor state
let monitorInterval: NodeJS.Timeout | null = null
let isMonitoring = false

// Trailing stop state (in-memory, would use Redis in production)
const trailingStopPrices: Map<string, number> = new Map()

/**
 * Gets current price for a ticker
 * In production, this would use real-time data feeds
 */
async function getCurrentPrice(ticker: string): Promise<number> {
  try {
    // Try TwelveData first
    const apiKey = process.env.TWELVEDATA_API_KEY
    if (apiKey) {
      const response = await fetch(
        `https://api.twelvedata.com/price?symbol=${ticker}&apikey=${apiKey}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.price) {
          return parseFloat(data.price)
        }
      }
    }

    // Fallback to Alpaca
    const alpacaKey = process.env.ALPACA_API_KEY
    const alpacaSecret = process.env.ALPACA_API_SECRET
    if (alpacaKey && alpacaSecret) {
      const response = await fetch(
        `https://data.alpaca.markets/v2/stocks/${ticker}/trades/latest`,
        {
          headers: {
            'APCA-API-KEY-ID': alpacaKey,
            'APCA-API-SECRET-KEY': alpacaSecret
          }
        }
      )
      if (response.ok) {
        const data = await response.json()
        if (data.trade?.p) {
          return data.trade.p
        }
      }
    }

    // Return 0 if unable to get price
    console.warn(`[Monitor] Unable to get current price for ${ticker}`)
    return 0
  } catch (error) {
    console.error(`[Monitor] Error fetching price for ${ticker}:`, error)
    return 0
  }
}

/**
 * Checks exit conditions for a trade
 * Requirements: 5.2, 5.3, 5.4
 */
export function checkExitConditions(
  trade: TradeWithSignal,
  currentPrice: number
): ExitConditionResult {
  if (currentPrice <= 0) {
    return { shouldExit: false }
  }

  const isLong = trade.side === 'LONG'
  const entryPrice = trade.entryPrice

  // Check stop loss (Requirement 5.2)
  if (isLong && currentPrice <= trade.stopLoss) {
    return {
      shouldExit: true,
      reason: 'STOP_LOSS',
      exitPrice: currentPrice
    }
  }
  if (!isLong && currentPrice >= trade.stopLoss) {
    return {
      shouldExit: true,
      reason: 'STOP_LOSS',
      exitPrice: currentPrice
    }
  }

  // Check target 1 (Requirement 5.3)
  if (isLong && currentPrice >= trade.target1) {
    return {
      shouldExit: true,
      reason: 'TARGET_1',
      exitPrice: currentPrice
    }
  }
  if (!isLong && currentPrice <= trade.target1) {
    return {
      shouldExit: true,
      reason: 'TARGET_1',
      exitPrice: currentPrice
    }
  }

  // Check target 2 if set
  if (trade.target2) {
    if (isLong && currentPrice >= trade.target2) {
      return {
        shouldExit: true,
        reason: 'TARGET_2',
        exitPrice: currentPrice
      }
    }
    if (!isLong && currentPrice <= trade.target2) {
      return {
        shouldExit: true,
        reason: 'TARGET_2',
        exitPrice: currentPrice
      }
    }
  }

  // Check trailing stop (Requirement 5.4)
  if (trade.trailing) {
    const trailingResult = checkTrailingStop(trade, currentPrice)
    if (trailingResult.shouldExit) {
      return trailingResult
    }
  }

  return { shouldExit: false }
}

/**
 * Checks and updates trailing stop
 * Requirement 5.4
 */
function checkTrailingStop(
  trade: TradeWithSignal,
  currentPrice: number
): ExitConditionResult {
  const tradeKey = trade.tradeId
  const isLong = trade.side === 'LONG'
  const atr = trade.signal.atr

  // Get or initialize trailing stop price
  let trailingStopPrice = trailingStopPrices.get(tradeKey)

  if (!trailingStopPrice) {
    // Initialize trailing stop at entry stop loss
    trailingStopPrice = trade.stopLoss
    trailingStopPrices.set(tradeKey, trailingStopPrice)
  }

  // Update trailing stop if price moved favorably
  if (isLong) {
    const newTrailingStop = currentPrice - (atr * 1.5) // Trail by 1.5 ATR
    if (newTrailingStop > trailingStopPrice) {
      trailingStopPrice = newTrailingStop
      trailingStopPrices.set(tradeKey, trailingStopPrice)
      console.log(`[Monitor] Updated trailing stop for ${tradeKey} to ${trailingStopPrice.toFixed(2)}`)
    }

    // Check if trailing stop hit
    if (currentPrice <= trailingStopPrice) {
      return {
        shouldExit: true,
        reason: 'TRAILING',
        exitPrice: currentPrice
      }
    }
  } else {
    const newTrailingStop = currentPrice + (atr * 1.5)
    if (newTrailingStop < trailingStopPrice) {
      trailingStopPrice = newTrailingStop
      trailingStopPrices.set(tradeKey, trailingStopPrice)
      console.log(`[Monitor] Updated trailing stop for ${tradeKey} to ${trailingStopPrice.toFixed(2)}`)
    }

    if (currentPrice >= trailingStopPrice) {
      return {
        shouldExit: true,
        reason: 'TRAILING',
        exitPrice: currentPrice
      }
    }
  }

  return { shouldExit: false }
}

/**
 * Calculates P&L metrics for a trade
 * Requirement 5.5
 */
export function calculatePnL(
  trade: Trade,
  currentPrice: number
): PnLUpdate {
  const isLong = trade.side === 'LONG'
  const entryPrice = trade.entryPrice
  const quantity = trade.quantity

  // Calculate unrealized P&L
  const priceDiff = isLong ? currentPrice - entryPrice : entryPrice - currentPrice
  const unrealizedPnL = priceDiff * quantity
  const unrealizedPnLPercent = (priceDiff / entryPrice) * 100

  // Calculate R-multiple (risk-adjusted return)
  const riskPerShare = Math.abs(entryPrice - trade.stopLoss)
  const rMultiple = riskPerShare > 0 ? priceDiff / riskPerShare : 0

  return {
    tradeId: trade.tradeId,
    currentPrice,
    unrealizedPnL,
    unrealizedPnLPercent,
    rMultiple
  }
}

/**
 * Closes a trade with exit details
 */
async function closeTrade(
  trade: TradeWithSignal,
  exitPrice: number,
  exitReason: ExitReason
): Promise<void> {
  const isLong = trade.side === 'LONG'
  const priceDiff = isLong ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice
  const pnl = priceDiff * trade.quantity
  const pnlPercent = (priceDiff / trade.entryPrice) * 100

  // Calculate R-multiple
  const riskPerShare = Math.abs(trade.entryPrice - trade.stopLoss)
  const rMultiple = riskPerShare > 0 ? priceDiff / riskPerShare : 0

  // Calculate holding period in minutes
  const holdingPeriod = Math.floor(
    (Date.now() - new Date(trade.enteredAt).getTime()) / (1000 * 60)
  )

  // Update trade in database
  await prisma.trade.update({
    where: { id: trade.id },
    data: {
      status: 'CLOSED',
      exitedAt: new Date(),
      exitPrice,
      exitValue: exitPrice * trade.quantity,
      exitReason,
      pnl,
      pnlPercent,
      rMultiple,
      holdingPeriod
    }
  })

  // Clean up trailing stop state
  trailingStopPrices.delete(trade.tradeId)

  console.log(`[Monitor] Closed trade ${trade.tradeId}: ${exitReason}, P&L: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%), R: ${rMultiple.toFixed(2)}`)
}

/**
 * Monitors all open trades
 * Requirement 5.1
 */
async function monitorTrades(): Promise<PnLUpdate[]> {
  const openTrades = await prisma.trade.findMany({
    where: { status: 'OPEN' },
    include: { signal: true }
  }) as TradeWithSignal[]

  if (openTrades.length === 0) {
    return []
  }

  console.log(`[Monitor] Checking ${openTrades.length} open trades`)

  const pnlUpdates: PnLUpdate[] = []

  // Group trades by ticker to minimize API calls
  const tradesByTicker = new Map<string, TradeWithSignal[]>()
  for (const trade of openTrades) {
    const existing = tradesByTicker.get(trade.ticker) || []
    existing.push(trade)
    tradesByTicker.set(trade.ticker, existing)
  }

  // Process each ticker
  for (const [ticker, trades] of tradesByTicker) {
    const currentPrice = await getCurrentPrice(ticker)

    if (currentPrice <= 0) {
      console.warn(`[Monitor] Skipping ${ticker} - unable to get price`)
      continue
    }

    for (const trade of trades) {
      // Check exit conditions
      const exitResult = checkExitConditions(trade, currentPrice)

      if (exitResult.shouldExit && exitResult.reason && exitResult.exitPrice) {
        await closeTrade(trade, exitResult.exitPrice, exitResult.reason)
      } else {
        // Calculate and store P&L update
        const pnlUpdate = calculatePnL(trade, currentPrice)
        pnlUpdates.push(pnlUpdate)
      }
    }
  }

  return pnlUpdates
}

/**
 * Starts the trade monitor
 * Requirement 5.1: Check every 30 seconds
 */
export function startTradeMonitor(): void {
  if (isMonitoring) {
    console.log('[Monitor] Already running')
    return
  }

  console.log('[Monitor] Starting trade monitor (30s interval)')
  isMonitoring = true

  // Run immediately
  monitorTrades().catch(error => {
    console.error('[Monitor] Error in initial check:', error)
  })

  // Then run every 30 seconds
  monitorInterval = setInterval(async () => {
    try {
      const pnlUpdates = await monitorTrades()
      
      // TODO: Emit P&L updates via WebSocket (Requirement 5.6)
      if (pnlUpdates.length > 0) {
        console.log(`[Monitor] P&L updates for ${pnlUpdates.length} trades`)
      }
    } catch (error) {
      console.error('[Monitor] Error in monitoring cycle:', error)
    }
  }, 30000) // 30 seconds
}

/**
 * Stops the trade monitor
 */
export function stopTradeMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval)
    monitorInterval = null
  }
  isMonitoring = false
  console.log('[Monitor] Trade monitor stopped')
}

/**
 * Gets monitor status
 */
export function getMonitorStatus(): { isRunning: boolean; openTrades: number } {
  return {
    isRunning: isMonitoring,
    openTrades: 0 // Would be populated from actual count
  }
}

/**
 * Manually closes a trade
 */
export async function manualCloseTrade(
  tradeId: string,
  exitPrice?: number
): Promise<void> {
  const trade = await prisma.trade.findFirst({
    where: { tradeId, status: 'OPEN' },
    include: { signal: true }
  }) as TradeWithSignal | null

  if (!trade) {
    throw new Error(`Trade ${tradeId} not found or already closed`)
  }

  const price = exitPrice || await getCurrentPrice(trade.ticker)
  
  if (price <= 0) {
    throw new Error(`Unable to get exit price for ${trade.ticker}`)
  }

  await closeTrade(trade, price, 'MANUAL')
}

/**
 * Enables trailing stop for a trade
 */
export async function enableTrailingStop(tradeId: string): Promise<void> {
  await prisma.trade.updateMany({
    where: { tradeId },
    data: { trailing: true }
  })
  console.log(`[Monitor] Enabled trailing stop for ${tradeId}`)
}
