/**
 * Paper Trading Types
 * 
 * Common types for multi-broker paper trading system.
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

export type BrokerType = 'tradier' | 'twelvedata' | 'alpaca'
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit'
export type OrderStatus = 'pending' | 'filled' | 'partial' | 'cancelled' | 'rejected'

export interface OrderRequest {
  symbol: string
  side: OrderSide
  quantity: number
  orderType: OrderType
  limitPrice?: number
  stopPrice?: number
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok'
  instrumentType: 'stock' | 'option'
  optionDetails?: {
    strike: number
    expiration: string
    optionType: 'call' | 'put'
  }
}

export interface OrderResponse {
  orderId: string
  broker: BrokerType
  status: OrderStatus
  filledQuantity: number
  filledPrice: number
  commission: number
  timestamp: Date
  rawResponse: any
}

export interface TradeRecord {
  tradeId: string
  signalId: string
  broker: BrokerType
  orderId: string
  symbol: string
  instrumentType: string
  side: 'LONG' | 'SHORT'
  quantity: number
  entryPrice: number
  entryValue: number
  stopLoss: number
  target1: number
  target2?: number
  trailing: boolean
  status: 'OPEN' | 'CLOSED' | 'CANCELLED'
  brokerData: any
}

export interface BrokerClient {
  name: BrokerType
  placeOrder(request: OrderRequest): Promise<OrderResponse>
  getOrderStatus(orderId: string): Promise<OrderResponse>
  cancelOrder(orderId: string): Promise<boolean>
  getPositions(): Promise<any[]>
  getAccountInfo(): Promise<any>
}
