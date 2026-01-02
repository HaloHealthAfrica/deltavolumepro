import { describe, it, expect, beforeEach } from 'vitest'
import { PositionSizeCalculator, PositionSizingUtils } from '../lib/options/position-sizer'
import type { OscillatorCondition } from '../lib/options/expiration-selector'

/**
 * Unit Tests for Position Sizing System
 * 
 * Tests the core functionality of position sizing based on account risk,
 * signal quality, and market conditions.
 */

describe('PositionSizeCalculator', () => {
  let calculator: PositionSizeCalculator
  const accountSize = 100000 // $100,000 account

  beforeEach(() => {
    calculator = new PositionSizeCalculator()
  })

  describe('calculateContracts', () => {
    it('should calculate base 2% risk position', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }

      const result = await calculator.calculateContracts(
        accountSize,
        5.00, // $5 premium
        4,    // 4-star signal
        neutralCondition
      )

      // Base risk: $100,000 * 2% = $2,000
      // 4-star multiplier: 1.0x
      // Risk per contract: $5 * 100 = $500
      // Expected contracts: $2,000 / $500 = 4
      expect(result.contracts).toBe(4)
      expect(result.qualityMultiplier).toBe(1.0)
      expect(result.shouldSkipTrade).toBe(false)
    })

    it('should apply 1.5x multiplier for 5-star signals', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }

      const result = await calculator.calculateContracts(
        accountSize,
        5.00,
        5, // 5-star signal
        neutralCondition
      )

      // Base risk: $2,000 * 1.5 = $3,000
      // Expected contracts: $3,000 / $500 = 6
      expect(result.contracts).toBe(6)
      expect(result.qualityMultiplier).toBe(1.5)
    })

    it('should apply 1.5x reversal boost for extreme reversals', async () => {
      const extremeReversalCondition: OscillatorCondition = {
        isExtremeReversal: true,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.9
      }

      const result = await calculator.calculateContracts(
        accountSize,
        5.00,
        4, // 4-star signal
        extremeReversalCondition
      )

      // Base risk: $2,000 * 1.0 (quality) * 1.5 (reversal) = $3,000
      // Expected contracts: $3,000 / $500 = 6
      expect(result.contracts).toBe(6)
      expect(result.oscillatorMultiplier).toBe(1.5)
    })

    it('should apply 0.5x compression penalty', async () => {
      const compressionCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: true,
        oscillatorValue: 0.2
      }

      const result = await calculator.calculateContracts(
        accountSize,
        5.00,
        4, // 4-star signal
        compressionCondition
      )

      // Base risk: $2,000 * 1.0 (quality) * 0.5 (compression) = $1,000
      // Expected contracts: $1,000 / $500 = 2
      expect(result.contracts).toBe(2)
      expect(result.compressionMultiplier).toBe(0.5)
    })

    it('should cap position at 5% of account size', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }

      // Use very low premium to trigger cap
      const result = await calculator.calculateContracts(
        accountSize,
        0.50, // $0.50 premium - very cheap
        5,    // 5-star signal with 1.5x multiplier
        neutralCondition
      )

      // Max position: $100,000 * 5% = $5,000
      // Premium per contract: $0.50 * 100 = $50
      // Max contracts: $5,000 / $50 = 100
      expect(result.totalPremium).toBeLessThanOrEqual(5000)
      expect(result.reasoning).toContain('capped at 5%')
    })

    it('should skip trade when compression and skipOnCompression is true', async () => {
      const skipCalculator = new PositionSizeCalculator({ skipOnCompression: true })
      
      const compressionCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: true,
        oscillatorValue: 0.2
      }

      const result = await skipCalculator.calculateContracts(
        accountSize,
        5.00,
        4,
        compressionCondition
      )

      expect(result.contracts).toBe(0)
      expect(result.shouldSkipTrade).toBe(true)
      expect(result.reasoning).toContain('skipped')
    })

    it('should ensure at least 1 contract', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }

      // Use very high premium relative to account
      const result = await calculator.calculateContracts(
        10000, // Small $10,000 account
        50.00, // $50 premium - expensive
        1,     // 1-star signal with 0.5x multiplier
        neutralCondition
      )

      expect(result.contracts).toBeGreaterThanOrEqual(1)
    })

    it('should throw error for invalid account size', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }

      await expect(
        calculator.calculateContracts(0, 5.00, 4, neutralCondition)
      ).rejects.toThrow('Account size must be positive')
    })

    it('should throw error for invalid premium', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }

      await expect(
        calculator.calculateContracts(accountSize, 0, 4, neutralCondition)
      ).rejects.toThrow('Option premium must be positive')
    })

    it('should throw error for invalid signal quality', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }

      await expect(
        calculator.calculateContracts(accountSize, 5.00, 6, neutralCondition)
      ).rejects.toThrow('Signal quality must be between 1 and 5')
    })
  })

  describe('applyRiskLimits', () => {
    it('should cap contracts when exceeding max position', () => {
      const capped = calculator.applyRiskLimits(100, 1.00, accountSize)
      
      // Max position: $5,000
      // Premium per contract: $100
      // Max contracts: 50
      expect(capped).toBe(50)
    })

    it('should not modify contracts within limits', () => {
      const unchanged = calculator.applyRiskLimits(10, 5.00, accountSize)
      
      // Total value: 10 * $500 = $5,000 (exactly at limit)
      expect(unchanged).toBe(10)
    })
  })

  describe('calculateRiskMetrics', () => {
    it('should calculate comprehensive risk metrics', () => {
      const metrics = calculator.calculateRiskMetrics(
        5,      // contracts
        5.00,   // premium
        500,    // max loss per contract
        1000,   // max profit per contract
        105,    // breakeven
        0.65    // probability of profit
      )

      expect(metrics.maxLoss).toBe(2500) // 5 * $500
      expect(metrics.riskRewardRatio).toBe(2) // $5000 / $2500
      expect(metrics.breakeven).toBe(105)
      expect(metrics.probabilityOfProfit).toBe(0.65)
    })

    it('should handle unlimited profit strategies', () => {
      const metrics = calculator.calculateRiskMetrics(
        5,
        5.00,
        500,
        null, // unlimited profit
        105,
        0.5
      )

      expect(metrics.riskRewardRatio).toBe(0) // Can't calculate with unlimited profit
    })
  })
})

describe('PositionSizingUtils', () => {
  describe('validatePositionSize', () => {
    it('should validate good position sizes', () => {
      const goodPosition = {
        contracts: 5,
        totalPremium: 2500,
        riskAmount: 2500,
        riskPercent: 0.025, // 2.5%
        qualityMultiplier: 1.0,
        oscillatorMultiplier: 1.0,
        compressionMultiplier: 1.0,
        reasoning: 'Good position',
        shouldSkipTrade: false
      }

      const result = PositionSizingUtils.validatePositionSize(goodPosition, 100000)
      expect(result.isValid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should reject positions exceeding max risk', () => {
      const riskyPosition = {
        contracts: 20,
        totalPremium: 10000,
        riskAmount: 10000,
        riskPercent: 0.10, // 10% - too high
        qualityMultiplier: 1.0,
        oscillatorMultiplier: 1.0,
        compressionMultiplier: 1.0,
        reasoning: 'Risky position',
        shouldSkipTrade: false
      }

      const result = PositionSizingUtils.validatePositionSize(riskyPosition, 100000)
      expect(result.isValid).toBe(false)
      expect(result.violations).toContain(expect.stringContaining('exceeds max'))
    })
  })

  describe('calculateOptimalSize', () => {
    it('should calculate optimal contracts for target risk', () => {
      const optimal = PositionSizingUtils.calculateOptimalSize(
        100000, // account
        0.02,   // 2% target risk
        5.00,   // premium
        500     // max loss per contract
      )

      // Target risk: $2,000
      // Max loss per contract: $500
      // Optimal: 4 contracts
      expect(optimal).toBe(4)
    })

    it('should ensure at least 1 contract', () => {
      const optimal = PositionSizingUtils.calculateOptimalSize(
        10000,  // small account
        0.01,   // 1% target risk
        50.00,  // expensive premium
        5000    // high max loss
      )

      expect(optimal).toBe(1)
    })
  })

  describe('analyzePositionSize', () => {
    it('should identify low risk positions', () => {
      const lowRiskPosition = {
        contracts: 1,
        totalPremium: 500,
        riskAmount: 500,
        riskPercent: 0.005, // 0.5%
        qualityMultiplier: 1.0,
        oscillatorMultiplier: 1.0,
        compressionMultiplier: 1.0,
        reasoning: 'Low risk',
        shouldSkipTrade: false
      }

      const analysis = PositionSizingUtils.analyzePositionSize(lowRiskPosition, 100000)
      expect(analysis.riskLevel).toBe('LOW')
      expect(analysis.recommendation).toContain('Conservative')
    })

    it('should identify moderate risk positions', () => {
      const moderatePosition = {
        contracts: 4,
        totalPremium: 2000,
        riskAmount: 2000,
        riskPercent: 0.02, // 2%
        qualityMultiplier: 1.0,
        oscillatorMultiplier: 1.0,
        compressionMultiplier: 1.0,
        reasoning: 'Moderate risk',
        shouldSkipTrade: false
      }

      const analysis = PositionSizingUtils.analyzePositionSize(moderatePosition, 100000)
      expect(analysis.riskLevel).toBe('MODERATE')
      expect(analysis.recommendation).toContain('Standard')
    })

    it('should identify aggressive positions', () => {
      const aggressivePosition = {
        contracts: 10,
        totalPremium: 5000,
        riskAmount: 5000,
        riskPercent: 0.05, // 5%
        qualityMultiplier: 1.5,
        oscillatorMultiplier: 1.5,
        compressionMultiplier: 1.0,
        reasoning: 'Aggressive',
        shouldSkipTrade: false
      }

      const analysis = PositionSizingUtils.analyzePositionSize(aggressivePosition, 100000)
      expect(analysis.riskLevel).toBe('AGGRESSIVE')
      expect(analysis.recommendation).toContain('monitor closely')
    })
  })
})