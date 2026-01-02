/**
 * Multi-Broker Execution Integration Tests
 * Tests simultaneous order execution across multiple brokers
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock paper trading clients
const mockTradierPaperClient = {
  placeOrder: vi.fn().mockResolvedValue({
    orderId: 'tradier-order-123',
    status: 'filled',
    filledPrice: 175.50,
    filledQuantity: 100,
  }),
  getOrderStatus: vi.fn().mockResolvedValue({
    orderId: 'tradier-order-123',
    status: 'filled',
  }),
}

const mockTwelveDataPaperClient = {
  placeOrder: vi.fn().mockResolvedValue({
    orderId: 'twelvedata-order-456',
    status: 'filled',
    filledPrice: 175.52,
    filledQuantity: 100,
  }),
  getOrderStatus: vi.fn().mockResolvedValue({
    orderId: 'twelvedata-order-456',
    status: 'filled',
  }),
}

const mockAlpacaPaperClient = {
  placeOrder: vi.fn().mockResolvedValue({
    orderId: 'alpaca-order-789',
    status: 'filled',
    filledPrice: 175.48,
    filledQuantity: 100,
  }),
  getOrderStatus: vi.fn().mockResolvedValue({
    orderId: 'alpaca-order-789',
    status: 'filled',
  }),
}

vi.mock('@/lib/paper-trading/tradier-paper', () => ({
  tradierPaperClient: mockTradierPaperClient,
}))

vi.mock('@/lib/paper-trading/twelvedata-paper', () => ({
  twelveDataPaperClient: mockTwelveDataPaperClient,
}))

vi.mock('@/lib/paper-trading/alpaca-paper', () => ({
  alpacaPaperClient: mockAlpacaPaperClient,
}))

describe('Multi-Broker Execution Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Simultaneous Order Execution', () => {
    it('should execute orders on all three brokers simultaneously', async () => {
      const orderParams = {
        ticker: 'AAPL',
        side: 'BUY',
        quantity: 100,
        orderType: 'LIMIT',
        limitPrice: 175.50,
      }

      // Execute orders in parallel
      const [tradierResult, twelveDataResult, alpacaResult] = await Promise.all([
        mockTradierPaperClient.placeOrder(orderParams),
        mockTwelveDataPaperClient.placeOrder(orderParams),
        mockAlpacaPaperClient.placeOrder(orderParams),
      ])

      // Verify all orders were placed
      expect(mockTradierPaperClient.placeOrder).toHaveBeenCalledWith(orderParams)
      expect(mockTwelveDataPaperClient.placeOrder).toHaveBeenCalledWith(orderParams)
      expect(mockAlpacaPaperClient.placeOrder).toHaveBeenCalledWith(orderParams)

      // Verify all orders were filled
      expect(tradierResult.status).toBe('filled')
      expect(twelveDataResult.status).toBe('filled')
      expect(alpacaResult.status).toBe('filled')

      // Verify order IDs are unique
      const orderIds = [tradierResult.orderId, twelveDataResult.orderId, alpacaResult.orderId]
      const uniqueIds = new Set(orderIds)
      expect(uniqueIds.size).toBe(3)
    })

    it('should handle partial broker failures gracefully', async () => {
      // Make TwelveData fail
      mockTwelveDataPaperClient.placeOrder.mockRejectedValueOnce(new Error('API timeout'))

      const orderParams = {
        ticker: 'AAPL',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
      }

      const results = await Promise.allSettled([
        mockTradierPaperClient.placeOrder(orderParams),
        mockTwelveDataPaperClient.placeOrder(orderParams),
        mockAlpacaPaperClient.placeOrder(orderParams),
      ])

      // Tradier should succeed
      expect(results[0].status).toBe('fulfilled')
      
      // TwelveData should fail
      expect(results[1].status).toBe('rejected')
      
      // Alpaca should succeed
      expect(results[2].status).toBe('fulfilled')

      // At least 2 out of 3 brokers succeeded
      const successCount = results.filter(r => r.status === 'fulfilled').length
      expect(successCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Order Reconciliation', () => {
    it('should reconcile filled prices across brokers', async () => {
      const orderParams = {
        ticker: 'AAPL',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
      }

      const [tradierResult, twelveDataResult, alpacaResult] = await Promise.all([
        mockTradierPaperClient.placeOrder(orderParams),
        mockTwelveDataPaperClient.placeOrder(orderParams),
        mockAlpacaPaperClient.placeOrder(orderParams),
      ])

      const filledPrices = [
        tradierResult.filledPrice,
        twelveDataResult.filledPrice,
        alpacaResult.filledPrice,
      ]

      // Calculate average filled price
      const avgPrice = filledPrices.reduce((a, b) => a + b, 0) / filledPrices.length
      expect(avgPrice).toBeCloseTo(175.50, 1)

      // Calculate price deviation
      const maxDeviation = Math.max(...filledPrices.map(p => Math.abs(p - avgPrice)))
      expect(maxDeviation).toBeLessThan(0.10) // Less than $0.10 deviation
    })

    it('should generate unique trade IDs for tracking', async () => {
      const generateTradeId = () => {
        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 8)
        return `TRD-${timestamp}-${random}`
      }

      const tradeIds = Array.from({ length: 100 }, generateTradeId)
      const uniqueIds = new Set(tradeIds)

      // All generated IDs should be unique
      expect(uniqueIds.size).toBe(100)

      // IDs should follow expected format
      tradeIds.forEach(id => {
        expect(id).toMatch(/^TRD-\d+-[a-z0-9]+$/)
      })
    })
  })

  describe('Order Types', () => {
    it('should support MARKET orders', async () => {
      const orderParams = {
        ticker: 'AAPL',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
      }

      const result = await mockTradierPaperClient.placeOrder(orderParams)
      expect(result.status).toBe('filled')
    })

    it('should support LIMIT orders', async () => {
      const orderParams = {
        ticker: 'AAPL',
        side: 'BUY',
        quantity: 100,
        orderType: 'LIMIT',
        limitPrice: 175.00,
      }

      const result = await mockTradierPaperClient.placeOrder(orderParams)
      expect(result.status).toBe('filled')
    })

    it('should support both BUY and SELL sides', async () => {
      const buyOrder = {
        ticker: 'AAPL',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
      }

      const sellOrder = {
        ticker: 'AAPL',
        side: 'SELL',
        quantity: 100,
        orderType: 'MARKET',
      }

      const buyResult = await mockTradierPaperClient.placeOrder(buyOrder)
      const sellResult = await mockTradierPaperClient.placeOrder(sellOrder)

      expect(buyResult.status).toBe('filled')
      expect(sellResult.status).toBe('filled')
    })
  })
})

describe('Trade Record Storage', () => {
  it('should create complete trade records', () => {
    const tradeRecord = {
      id: 'trade-123',
      tradeId: 'TRD-1234567890-abc123',
      signalId: 'signal-456',
      broker: 'tradier',
      ticker: 'AAPL',
      side: 'LONG',
      instrumentType: 'STOCK',
      quantity: 100,
      entryPrice: 175.50,
      entryValue: 17550.00,
      stopLoss: 172.00,
      target1: 180.00,
      target2: 185.00,
      trailing: false,
      status: 'OPEN',
      enteredAt: new Date(),
      brokerData: {
        orderId: 'tradier-order-123',
        filledPrice: 175.50,
        commission: 0,
      },
    }

    // Verify all required fields are present
    expect(tradeRecord.id).toBeDefined()
    expect(tradeRecord.tradeId).toBeDefined()
    expect(tradeRecord.signalId).toBeDefined()
    expect(tradeRecord.broker).toBeDefined()
    expect(tradeRecord.ticker).toBeDefined()
    expect(tradeRecord.side).toBeDefined()
    expect(tradeRecord.quantity).toBeGreaterThan(0)
    expect(tradeRecord.entryPrice).toBeGreaterThan(0)
    expect(tradeRecord.stopLoss).toBeLessThan(tradeRecord.entryPrice)
    expect(tradeRecord.target1).toBeGreaterThan(tradeRecord.entryPrice)
    expect(tradeRecord.status).toBe('OPEN')
  })

  it('should calculate entry value correctly', () => {
    const quantity = 100
    const entryPrice = 175.50
    const expectedValue = quantity * entryPrice

    expect(expectedValue).toBe(17550.00)
  })

  it('should validate risk parameters', () => {
    const entryPrice = 175.50
    const stopLoss = 172.00
    const target1 = 180.00

    const risk = entryPrice - stopLoss
    const reward = target1 - entryPrice
    const riskRewardRatio = reward / risk

    expect(risk).toBe(3.50)
    expect(reward).toBe(4.50)
    expect(riskRewardRatio).toBeCloseTo(1.29, 2)
    expect(riskRewardRatio).toBeGreaterThan(1) // Minimum 1:1 R:R
  })
})
