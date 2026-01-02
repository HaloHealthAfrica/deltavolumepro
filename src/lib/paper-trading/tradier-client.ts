/**
 * Tradier Paper Trading Client
 * 
 * Implements paper trading via Tradier sandbox API.
 * Requirements: 4.1, 4.2, 4.3
 */

import type { BrokerClient, OrderRequest, OrderResponse } from './types'

const TRADIER_SANDBOX_URL = 'https://sandbox.tradier.com/v1'

export class TradierPaperClient implements BrokerClient {
  name: 'tradier' = 'tradier'
  private apiKey: string
  private accountId: string

  constructor() {
    this.apiKey = process.env.TRADIER_API_KEY || ''
    this.accountId = process.env.TRADIER_ACCOUNT_ID || ''
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${TRADIER_SANDBOX_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Tradier API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async placeOrder(request: OrderRequest): Promise<OrderResponse> {
    const params = new URLSearchParams()
    params.append('class', request.instrumentType === 'option' ? 'option' : 'equity')
    params.append('symbol', request.symbol)
    params.append('side', request.side)
    params.append('quantity', request.quantity.toString())
    params.append('type', request.orderType)
    params.append('duration', request.timeInForce || 'day')

    if (request.limitPrice) {
      params.append('price', request.limitPrice.toString())
    }
    if (request.stopPrice) {
      params.append('stop', request.stopPrice.toString())
    }

    // Option-specific parameters
    if (request.instrumentType === 'option' && request.optionDetails) {
      const optionSymbol = this.buildOptionSymbol(
        request.symbol,
        request.optionDetails.expiration,
        request.optionDetails.optionType,
        request.optionDetails.strike
      )
      params.set('symbol', optionSymbol)
      params.append('option_symbol', optionSymbol)
    }

    try {
      const data = await this.request(
        `/accounts/${this.accountId}/orders`,
        {
          method: 'POST',
          body: params.toString()
        }
      )

      const order = data.order
      return {
        orderId: order.id?.toString() || `tradier-${Date.now()}`,
        broker: 'tradier',
        status: this.mapOrderStatus(order.status),
        filledQuantity: order.exec_quantity || 0,
        filledPrice: order.avg_fill_price || request.limitPrice || 0,
        commission: 0, // Tradier has $0 commission
        timestamp: new Date(),
        rawResponse: data
      }
    } catch (error) {
      console.error('[Tradier] Order placement failed:', error)
      // Return simulated response for paper trading
      return this.simulateOrder(request)
    }
  }

  async getOrderStatus(orderId: string): Promise<OrderResponse> {
    try {
      const data = await this.request(`/accounts/${this.accountId}/orders/${orderId}`)
      const order = data.order

      return {
        orderId: order.id?.toString() || orderId,
        broker: 'tradier',
        status: this.mapOrderStatus(order.status),
        filledQuantity: order.exec_quantity || 0,
        filledPrice: order.avg_fill_price || 0,
        commission: 0,
        timestamp: new Date(order.create_date),
        rawResponse: data
      }
    } catch (error) {
      console.error('[Tradier] Get order status failed:', error)
      throw error
    }
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.request(
        `/accounts/${this.accountId}/orders/${orderId}`,
        { method: 'DELETE' }
      )
      return true
    } catch (error) {
      console.error('[Tradier] Cancel order failed:', error)
      return false
    }
  }

  async getPositions(): Promise<any[]> {
    try {
      const data = await this.request(`/accounts/${this.accountId}/positions`)
      const positions = data.positions?.position || []
      return Array.isArray(positions) ? positions : [positions]
    } catch (error) {
      console.error('[Tradier] Get positions failed:', error)
      return []
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      const data = await this.request(`/accounts/${this.accountId}/balances`)
      return data.balances
    } catch (error) {
      console.error('[Tradier] Get account info failed:', error)
      return null
    }
  }

  private buildOptionSymbol(
    underlying: string,
    expiration: string,
    optionType: 'call' | 'put',
    strike: number
  ): string {
    // OCC option symbol format: AAPL210115C00150000
    const exp = expiration.replace(/-/g, '').slice(2) // YYMMDD
    const type = optionType === 'call' ? 'C' : 'P'
    const strikeStr = (strike * 1000).toString().padStart(8, '0')
    return `${underlying.padEnd(6)}${exp}${type}${strikeStr}`
  }

  private mapOrderStatus(status: string): OrderResponse['status'] {
    const statusMap: Record<string, OrderResponse['status']> = {
      'pending': 'pending',
      'open': 'pending',
      'filled': 'filled',
      'partially_filled': 'partial',
      'cancelled': 'cancelled',
      'rejected': 'rejected',
      'expired': 'cancelled'
    }
    return statusMap[status?.toLowerCase()] || 'pending'
  }

  private simulateOrder(request: OrderRequest): OrderResponse {
    // Simulate order for paper trading when API is unavailable
    return {
      orderId: `tradier-sim-${Date.now()}`,
      broker: 'tradier',
      status: 'filled',
      filledQuantity: request.quantity,
      filledPrice: request.limitPrice || 100,
      commission: 0,
      timestamp: new Date(),
      rawResponse: { simulated: true, request }
    }
  }
}
