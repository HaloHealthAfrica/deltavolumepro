/**
 * Multi-Broker Paper Trading Executor
 * 
 * Coordinates simultaneous order execution across all three brokers.
 * Generates unique trade IDs and stores complete trade records.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { prisma } from '@/lib/prisma'
import { TradierPaperClient } from './tradier-client'
import { AlpacaPaperClient } from './alpaca-client'
import { TwelveDataPaperClient } from './twelvedata-client'
import type { BrokerClient, BrokerType, OrderRequest, OrderResponse } from './types'
import type { Decision } from '@/lib/decision-engine'
import type { Signal } from '@prisma/client'

// Initialize broker clients
const brokerClients: Record<BrokerType, BrokerClient> = {
  tradier: new TradierPaperClient(),
  twelvedata: new TwelveDataPaperClient(),
  alpaca: new AlpacaPaperClient()
}

/**
 * Generates a unique trade ID
 */
function generateTradeId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2, 9)
  return `DSP-${timestamp}-${random}`.toUpperCase()
}

/**
 * Builds order request from signal and decision
 */
function buildOrderRequest(
  signal: Signal,
  decision: Decision
): OrderRequest {
  const isLong = signal.action.includes('LONG')
  const isOption = decision.instrumentType !== 'STOCK'

  const request: OrderRequest = {
    symbol: signal.ticker,
    side: isLong ? 'buy' : 'sell',
    quantity: decision.quantity || Math.floor((decision.positionSize || 100) / signal.entryPrice),
    orderType: 'limit',
    limitPrice: signal.entryPrice,
    timeInForce: 'day',
    instrumentType: isOption ? 'option' : 'stock'
  }

  // Add option details if applicable
  if (isOption && decision.strikes) {
    const strike = isLong ? decision.strikes.callStrike : decision.strikes.putStrike
    request.optionDetails = {
      strike: strike || signal.entryPrice,
      expiration: decision.expiration?.toISOString().split('T')[0] || getNextFriday(),
      optionType: decision.instrumentType === 'CALL' || decision.instrumentType === 'CALL_SPREAD' ? 'call' : 'put'
    }
  }

  return request
}

/**
 * Gets the next Friday date for option expiration
 */
function getNextFriday(): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
  const nextFriday = new Date(today)
  nextFriday.setDate(today.getDate() + daysUntilFriday)
  return nextFriday.toISOString().split('T')[0]
}

/**
 * Executes trade on a single broker
 */
async function executeOnBroker(
  broker: BrokerType,
  request: OrderRequest
): Promise<{ broker: BrokerType; response: OrderResponse; error?: string }> {
  const client = brokerClients[broker]
  
  try {
    const response = await client.placeOrder(request)
    console.log(`[Executor] ${broker} order placed: ${response.orderId}`)
    return { broker, response }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Executor] ${broker} order failed:`, errorMessage)
    return {
      broker,
      response: {
        orderId: `${broker}-failed-${Date.now()}`,
        broker,
        status: 'rejected',
        filledQuantity: 0,
        filledPrice: 0,
        commission: 0,
        timestamp: new Date(),
        rawResponse: { error: errorMessage }
      },
      error: errorMessage
    }
  }
}

/**
 * Executes trade simultaneously across all brokers
 * Requirement 4.1, 4.2
 */
export async function executeTrade(
  signal: Signal,
  decision: Decision
): Promise<{ tradeId: string; results: Record<BrokerType, OrderResponse> }> {
  const tradeId = generateTradeId()
  const orderRequest = buildOrderRequest(signal, decision)

  console.log(`[Executor] Executing trade ${tradeId} for signal ${signal.id}`)
  console.log(`[Executor] Order: ${orderRequest.side} ${orderRequest.quantity} ${orderRequest.symbol} @ ${orderRequest.limitPrice}`)

  // Execute on all brokers simultaneously (Requirement 4.1)
  const brokers: BrokerType[] = ['tradier', 'twelvedata', 'alpaca']
  const executionPromises = brokers.map(broker => executeOnBroker(broker, orderRequest))
  const executionResults = await Promise.all(executionPromises)

  // Build results map
  const results: Record<BrokerType, OrderResponse> = {} as Record<BrokerType, OrderResponse>
  for (const result of executionResults) {
    results[result.broker] = result.response
  }

  // Store trade records in database (Requirement 4.3, 4.4)
  const isLong = signal.action.includes('LONG')
  
  for (const result of executionResults) {
    await prisma.trade.create({
      data: {
        signalId: signal.id,
        tradeId: `${tradeId}-${result.broker}`,
        broker: result.broker,
        enteredAt: new Date(),
        instrumentType: decision.instrumentType || 'STOCK',
        ticker: signal.ticker,
        strikes: decision.strikes as any,
        expiration: decision.expiration,
        side: isLong ? 'LONG' : 'SHORT',
        quantity: result.response.filledQuantity || orderRequest.quantity,
        entryPrice: result.response.filledPrice || orderRequest.limitPrice || signal.entryPrice,
        entryValue: (result.response.filledQuantity || orderRequest.quantity) * (result.response.filledPrice || signal.entryPrice),
        stopLoss: signal.stopLoss,
        target1: signal.target1,
        trailing: false,
        status: result.response.status === 'filled' ? 'OPEN' : 'CANCELLED',
        brokerData: result.response.rawResponse
      }
    })
  }

  console.log(`[Executor] Trade ${tradeId} executed on all brokers`)

  return { tradeId, results }
}

/**
 * Gets all open trades
 */
export async function getOpenTrades(): Promise<any[]> {
  return prisma.trade.findMany({
    where: { status: 'OPEN' },
    include: { signal: true }
  })
}

/**
 * Gets trade by ID
 */
export async function getTradeById(tradeId: string): Promise<any> {
  return prisma.trade.findFirst({
    where: { tradeId },
    include: { signal: true }
  })
}

/**
 * Updates trade status
 */
export async function updateTradeStatus(
  tradeId: string,
  status: 'OPEN' | 'CLOSED' | 'CANCELLED',
  exitDetails?: {
    exitPrice: number
    exitReason: string
    pnl: number
    pnlPercent: number
    rMultiple: number
    holdingPeriod: number
  }
): Promise<void> {
  const updateData: any = { status }

  if (exitDetails) {
    const trade = await prisma.trade.findFirst({ where: { tradeId } })
    updateData.exitedAt = new Date()
    updateData.exitPrice = exitDetails.exitPrice
    updateData.exitValue = exitDetails.exitPrice * (trade?.quantity || 0)
    updateData.exitReason = exitDetails.exitReason
    updateData.pnl = exitDetails.pnl
    updateData.pnlPercent = exitDetails.pnlPercent
    updateData.rMultiple = exitDetails.rMultiple
    updateData.holdingPeriod = exitDetails.holdingPeriod
  }

  await prisma.trade.updateMany({
    where: { tradeId: { contains: tradeId.split('-').slice(0, 3).join('-') } },
    data: updateData
  })
}

/**
 * Gets broker client for direct access
 */
export function getBrokerClient(broker: BrokerType): BrokerClient {
  return brokerClients[broker]
}
