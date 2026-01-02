/**
 * TwelveData Paper Trading Client
 * 
 * Simulated paper trading client for TwelveData.
 * TwelveData doesn't have native paper trading, so we simulate it locally.
 * Requirements: 4.1, 4.2, 4.3
 */

import type { BrokerClient, OrderRequest, OrderResponse } from './types'

// In-memory storage for simulated orders and positions
const simulatedOrders: Map<string, OrderResponse & { request: OrderRequest }> = new Map()
const simulatedPositions: Map<string, any> = new Map()

export class TwelveDataPaperClient implements BrokerClient {
  name: 'twelvedata' = 'twelvedata'
  private apiKey: string

  constructor() {
    this.apiKey = process.env.TWELVEDATA_API_KEY || ''
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    // Simulate order execution
    const orderId = `twelvedata-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Get current price from TwelveData API
    let filledPrice = request.limitPrice || 100
    try {
      const response = await fetch(
        `https://api.twelvedata.com/price?symbol=${request.symbol}&apikey=${this.apiKey}`
      )
      if (response.ok) {
        const data = await response.json()
        if (data.price) {
          filledPrice = parseFloat(data.price)
        }
      }
    } catch (error) {
      console.warn('[TwelveData] Could not fetch current price, using limit price')
    }

    const orderResponse: OrderResponse = {
      orderId,
      broker: 'twelvedata',
      status: 'filled', // Simulate immediate fill for paper trading
      filledQuantity: request.quantity,
      filledPrice,
      commission: 0,
      timestamp: new Date(),
      rawResponse: { simulated: true, request }
    }

    // Store order
    simulatedOrders.set(orderId, { ...orderResponse, request })

    // Update simulated position
    const positionKey = `${request.symbol}-${request.instrumentType}`
    const existingPosition = simulatedPositions.get(positionKey)
    
    if (existingPosition) {
      // Update existing position
      if (request.side === 'buy') {
        existingPosition.quantity += request.quantity
        existingPosition.avgPrice = (existingPosition.avgPrice * existingPosition.quantity + filledPrice * request.quantity) / (existingPosition.quantity + request.quantity)
      } else {
        existingPosition.quantity -= request.quantity
        if (existingPosition.quantity <= 0) {
          simulatedPositions.delete(positionKey)
        }
      }
    } else if (request.side === 'buy') {
      // Create new position
      simulatedPositions.set(positionKey, {
        symbol: request.symbol,
        quantity: request.quantity,
        avgPrice: filledPrice,
        instrumentType: request.instrumentType,
        openedAt: new Date()
      })
    }

    console.log(`[TwelveData] Simulated order ${orderId}: ${request.side} ${request.quantity} ${request.symbol} @ ${filledPrice}`)

    return orderResponse
  }

  async getOrderStatus(orderId: string): Promise<OrderResponse> {
    const order = simulatedOrders.get(orderId)
    
    if (!order) {
      throw new Error(`Order ${orderId} not found`)
    }

    return {
      orderId: order.orderId,
      broker: 'twelvedata',
      status: order.status,
      filledQuantity: order.filledQuantity,
      filledPrice: order.filledPrice,
      commission: order.commission,
      timestamp: order.timestamp,
      rawResponse: order.rawResponse
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = simulatedOrders.get(orderId)
    
    if (!order) {
      return false
    }

    // Can only cancel pending orders
    if (order.status === 'pending') {
      order.status = 'cancelled'
      return true
    }

    return false
  }

  async getPositions(): Promise<any[]> {
    return Array.from(simulatedPositions.values())
  }

  async getAccountInfo(): Promise<any> {
    // Return simulated account info
    const positions = Array.from(simulatedPositions.values())
    const totalValue = positions.reduce((sum, pos) => sum + pos.quantity * pos.avgPrice, 0)

    return {
      accountId: 'twelvedata-paper',
      cash: 100000 - totalValue, // Start with $100k
      portfolioValue: totalValue,
      totalValue: 100000,
      buyingPower: 100000 - totalValue,
      simulated: true
    }
  }

  // Helper to clear simulated data (for testing)
  static clearSimulatedData(): void {
    simulatedOrders.clear()
    simulatedPositions.clear()
  }
}
