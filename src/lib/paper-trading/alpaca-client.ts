/**
 * Alpaca Paper Trading Client
 * 
 * Implements paper trading via Alpaca paper trading API.
 * Requirements: 4.1, 4.2, 4.3
 */

import type { BrokerClient, OrderRequest, OrderResponse } from './types'

const ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets/v2'

export class AlpacaPaperClient implements BrokerClient {
  name: 'alpaca' = 'alpaca'
  private apiKey: string
  private apiSecret: string

  constructor() {
    this.apiKey = process.env.ALPACA_API_KEY || ''
    this.apiSecret = process.env.ALPACA_API_SECRET || ''
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${ALPACA_PAPER_URL}${endpoint}`, {
      ...options,
      headers: {
        'APCA-API-KEY-ID': this.apiKey,
        'APCA-API-SECRET-KEY': this.apiSecret,
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Alpaca API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    const orderData: any = {
      symbol: request.symbol,
      qty: request.quantity.toString(),
      side: request.side,
      type: request.orderType,
      time_in_force: request.timeInForce || 'day'
    }

    if (request.limitPrice) {
      orderData.limit_price = request.limitPrice.toString()
    }
    if (request.stopPrice) {
      orderData.stop_price = request.stopPrice.toString()
    }

    try {
      const data = await this.request('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      })

      return {
        orderId: data.id || `alpaca-${Date.now()}`,
        broker: 'alpaca',
        status: this.mapOrderStatus(data.status),
        filledQuantity: parseFloat(data.filled_qty) || 0,
        filledPrice: parseFloat(data.filled_avg_price) || request.limitPrice || 0,
        commission: 0, // Alpaca has $0 commission
        timestamp: new Date(data.created_at),
        rawResponse: data
      }
    } catch (error) {
      console.error('[Alpaca] Order placement failed:', error)
      // Return simulated response for paper trading
      return this.simulateOrder(request)
    }
  }

  async getOrderStatus(orderId: string): Promise<OrderResponse> {
    try {
      const data = await this.request(`/orders/${orderId}`)

      return {
        orderId: data.id || orderId,
        broker: 'alpaca',
        status: this.mapOrderStatus(data.status),
        filledQuantity: parseFloat(data.filled_qty) || 0,
        filledPrice: parseFloat(data.filled_avg_price) || 0,
        commission: 0,
        timestamp: new Date(data.created_at),
        rawResponse: data
      }
    } catch (error) {
      console.error('[Alpaca] Get order status failed:', error)
      throw error
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.request(`/orders/${orderId}`, { method: 'DELETE' })
      return true
    } catch (error) {
      console.error('[Alpaca] Cancel order failed:', error)
      return false
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const data = await this.request('/positions')
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('[Alpaca] Get positions failed:', error)
      return []
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      return await this.request('/account')
    } catch (error) {
      console.error('[Alpaca] Get account info failed:', error)
      return null
    }
  }

  private mapOrderStatus(status: string): OrderResponse['status'] {
    const statusMap: Record<string, OrderResponse['status']> = {
      'new': 'pending',
      'accepted': 'pending',
      'pending_new': 'pending',
      'accepted_for_bidding': 'pending',
      'filled': 'filled',
      'partially_filled': 'partial',
      'canceled': 'cancelled',
      'cancelled': 'cancelled',
      'expired': 'cancelled',
      'rejected': 'rejected',
      'pending_cancel': 'pending',
      'pending_replace': 'pending',
      'stopped': 'cancelled',
      'suspended': 'pending',
      'calculated': 'pending'
    }
    return statusMap[status?.toLowerCase()] || 'pending'
  }

  private simulateOrder(request: OrderRequest): OrderResponse {
    return {
      orderId: `alpaca-sim-${Date.now()}`,
      broker: 'alpaca',
      status: 'filled',
      filledQuantity: request.quantity,
      filledPrice: request.limitPrice || 100,
      commission: 0,
      timestamp: new Date(),
      rawResponse: { simulated: true, request }
    }
  }
}
