import { describe, it, expect, beforeEach } from 'vitest'
import { TradierExpirationSelector, ExpirationSelectionUtils } from '../lib/options/expiration-selector'
import type { OscillatorCondition } from '../lib/options/expiration-selector'

/**
 * Unit Tests for Expiration Selection System
 * 
 * Tests the core functionality of expiration selection based on signal quality
 * and market conditions, ensuring proper DTE targeting and reasoning.
 */

describe('TradierExpirationSelector', () => {
  let expirationSelector: TradierExpirationSelector
  let mockExpirations: string[]

  beforeEach(() => {
    expirationSelector = new TradierExpirationSelector()
    
    // Create mock expirations for testing (next 8 weeks)
    mockExpirations = []
    const today = new Date()
    for (let i = 1; i <= 56; i += 7) { // Weekly expirations
      const expDate = new Date(today)
      expDate.setDate(today.getDate() + i)
      mockExpirations.push(expDate.toISOString().split('T')[0])
    }
  })

  describe('calculateTargetDTE', () => {
    it('should target 14 DTE for 5-star signals', () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }
      
      const targetDTE = expirationSelector.calculateTargetDTE(5, neutralCondition)
      expect(targetDTE).toBe(14)
    })

    it('should target 30 DTE for 4-star signals', () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }
      
      const targetDTE = expirationSelector.calculateTargetDTE(4, neutralCondition)
      expect(targetDTE).toBe(30)
    })

    it('should target 45 DTE for compression conditions', () => {
      const compressionCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: true,
        oscillatorValue: 0.2
      }
      
      const targetDTE = expirationSelector.calculateTargetDTE(4, compressionCondition)
      expect(targetDTE).toBe(45)
    })

    it('should target 7 DTE for extreme reversal with 5-star signal', () => {
      const extremeReversalCondition: OscillatorCondition = {
        isExtremeReversal: true,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.9
      }
      
      const targetDTE = expirationSelector.calculateTargetDTE(5, extremeReversalCondition)
      expect(targetDTE).toBe(7)
    })

    it('should target 14 DTE for extreme reversal with 4-star signal', () => {
      const extremeReversalCondition: OscillatorCondition = {
        isExtremeReversal: true,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.9
      }
      
      const targetDTE = expirationSelector.calculateTargetDTE(4, extremeReversalCondition)
      expect(targetDTE).toBe(14)
    })
  })

  describe('findClosestExpiration', () => {
    it('should find the expiration closest to target DTE', () => {
      const targetDTE = 14
      const closestExpiration = expirationSelector.findClosestExpiration(mockExpirations, targetDTE)
      
      // Should select the expiration closest to 14 days
      expect(closestExpiration).toBe(mockExpirations[1]) // ~14 days out
    })

    it('should handle exact matches', () => {
      // Create expirations with exact 30-day match
      const exactDate = new Date()
      exactDate.setDate(exactDate.getDate() + 30)
      const exactExpiration = exactDate.toISOString().split('T')[0]
      
      const testExpirations = [...mockExpirations, exactExpiration].sort()
      const closestExpiration = expirationSelector.findClosestExpiration(testExpirations, 30)
      
      expect(closestExpiration).toBe(exactExpiration)
    })

    it('should throw error for empty expirations array', () => {
      expect(() => {
        expirationSelector.findClosestExpiration([], 14)
      }).toThrow('No available expirations provided')
    })
  })

  describe('selectExpiration', () => {
    it('should select appropriate expiration for 5-star signal', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }
      
      const selection = await expirationSelector.selectExpiration(
        mockExpirations,
        5,
        neutralCondition,
        50
      )
      
      expect(selection.targetDTE).toBe(14)
      expect(selection.daysToExpiration).toBeGreaterThan(0)
      expect(selection.dteDeviation).toBeGreaterThanOrEqual(0)
      expect(selection.reasoning).toContain('5-star')
      expect(selection.reasoning).toContain('high-confidence')
      expect(selection.thetaDecayRate).toBeGreaterThan(0)
    })

    it('should select extended expiration for compression', async () => {
      const compressionCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: true,
        oscillatorValue: 0.2
      }
      
      const selection = await expirationSelector.selectExpiration(
        mockExpirations,
        4,
        compressionCondition,
        30
      )
      
      expect(selection.targetDTE).toBe(45)
      expect(selection.reasoning).toContain('Compression phase')
      expect(selection.reasoning).toContain('breakout development')
    })

    it('should select short expiration for extreme reversal', async () => {
      const extremeReversalCondition: OscillatorCondition = {
        isExtremeReversal: true,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.9
      }
      
      const selection = await expirationSelector.selectExpiration(
        mockExpirations,
        5,
        extremeReversalCondition,
        20
      )
      
      expect(selection.targetDTE).toBe(7)
      expect(selection.reasoning).toContain('Extreme reversal')
      expect(selection.reasoning).toContain('maximum leverage')
    })

    it('should provide complete selection data', async () => {
      const neutralCondition: OscillatorCondition = {
        isExtremeReversal: false,
        isZoneReversal: false,
        isCompression: false,
        oscillatorValue: 0.5
      }
      
      const selection = await expirationSelector.selectExpiration(
        mockExpirations,
        4,
        neutralCondition,
        40
      )
      
      // Verify all required fields are present
      expect(selection.expiration).toBeDefined()
      expect(selection.daysToExpiration).toBeGreaterThan(0)
      expect(selection.targetDTE).toBe(30)
      expect(selection.dteDeviation).toBeGreaterThanOrEqual(0)
      expect(typeof selection.isWeekly).toBe('boolean')
      expect(selection.reasoning).toBeDefined()
      expect(selection.thetaDecayRate).toBeGreaterThan(0)
    })
  })
})

describe('ExpirationSelectionUtils', () => {
  describe('validateSelection', () => {
    it('should validate good selections', () => {
      const goodSelection = {
        expiration: '2024-02-16',
        daysToExpiration: 14,
        targetDTE: 14,
        dteDeviation: 0,
        isWeekly: true,
        reasoning: 'Perfect match',
        thetaDecayRate: 0.05
      }
      
      expect(ExpirationSelectionUtils.validateSelection(goodSelection)).toBe(true)
    })

    it('should reject selections with excessive DTE deviation', () => {
      const badSelection = {
        expiration: '2024-02-16',
        daysToExpiration: 14,
        targetDTE: 30,
        dteDeviation: 16, // Too high
        isWeekly: true,
        reasoning: 'Bad match',
        thetaDecayRate: 0.05
      }
      
      expect(ExpirationSelectionUtils.validateSelection(badSelection)).toBe(false)
    })

    it('should reject selections with zero or negative DTE', () => {
      const expiredSelection = {
        expiration: '2024-01-01',
        daysToExpiration: 0,
        targetDTE: 14,
        dteDeviation: 14,
        isWeekly: true,
        reasoning: 'Expired',
        thetaDecayRate: 0.05
      }
      
      expect(ExpirationSelectionUtils.validateSelection(expiredSelection)).toBe(false)
    })

    it('should reject selections with invalid theta decay rate', () => {
      const invalidThetaSelection = {
        expiration: '2024-02-16',
        daysToExpiration: 14,
        targetDTE: 14,
        dteDeviation: 0,
        isWeekly: true,
        reasoning: 'Invalid theta',
        thetaDecayRate: -0.1 // Negative theta
      }
      
      expect(ExpirationSelectionUtils.validateSelection(invalidThetaSelection)).toBe(false)
    })
  })

  describe('calculateSelectionScore', () => {
    it('should give high scores for exact matches', () => {
      const perfectSelection = {
        expiration: '2024-02-16',
        daysToExpiration: 14,
        targetDTE: 14,
        dteDeviation: 0,
        isWeekly: true,
        reasoning: 'Perfect match',
        thetaDecayRate: 0.05
      }
      
      const score = ExpirationSelectionUtils.calculateSelectionScore(perfectSelection)
      expect(score).toBeGreaterThan(100) // Gets bonus for exact match
    })

    it('should penalize large deviations', () => {
      const deviatedSelection = {
        expiration: '2024-02-16',
        daysToExpiration: 20,
        targetDTE: 14,
        dteDeviation: 6,
        isWeekly: true,
        reasoning: 'Deviated match',
        thetaDecayRate: 0.05
      }
      
      const score = ExpirationSelectionUtils.calculateSelectionScore(deviatedSelection)
      expect(score).toBeLessThan(100)
      expect(score).toBeGreaterThan(50) // Should still be reasonable
    })

    it('should penalize very short DTE when not intended', () => {
      const shortDTESelection = {
        expiration: '2024-02-16',
        daysToExpiration: 2,
        targetDTE: 14, // Wanted 14 but got 2
        dteDeviation: 12,
        isWeekly: true,
        reasoning: 'Too short',
        thetaDecayRate: 0.2
      }
      
      const score = ExpirationSelectionUtils.calculateSelectionScore(shortDTESelection)
      expect(score).toBeLessThan(50) // Should be heavily penalized
    })
  })

  describe('analyzeSelection', () => {
    it('should identify high effectiveness for good selections', () => {
      const goodSelection = {
        expiration: '2024-02-16',
        daysToExpiration: 30,
        targetDTE: 30,
        dteDeviation: 0,
        isWeekly: false,
        reasoning: 'Good selection',
        thetaDecayRate: 0.03
      }
      
      const mockMarketCondition = {
        oscillatorPhase: 'TRENDING' as const,
        ivRank: 50,
        volatilityRegime: 'NORMAL' as const,
        signalQuality: 4 as const
      }
      
      const analysis = ExpirationSelectionUtils.analyzeSelection(goodSelection, mockMarketCondition)
      expect(analysis.effectiveness).toBe('HIGH')
      expect(analysis.opportunities.length).toBeGreaterThan(0)
    })

    it('should identify risks for short DTE selections', () => {
      const shortSelection = {
        expiration: '2024-02-16',
        daysToExpiration: 5,
        targetDTE: 7,
        dteDeviation: 2,
        isWeekly: true,
        reasoning: 'Short selection',
        thetaDecayRate: 0.15
      }
      
      const mockMarketCondition = {
        oscillatorPhase: 'EXTREME_REVERSAL' as const,
        ivRank: 30,
        volatilityRegime: 'LOW' as const,
        signalQuality: 5 as const
      }
      
      const analysis = ExpirationSelectionUtils.analyzeSelection(shortSelection, mockMarketCondition)
      expect(analysis.risks).toContain('High gamma risk and rapid theta decay')
      expect(analysis.risks).toContain('Significant daily time decay')
      expect(analysis.risks).toContain('Weekly expiration - higher gamma risk')
    })

    it('should identify opportunities for longer DTE selections', () => {
      const longSelection = {
        expiration: '2024-02-16',
        daysToExpiration: 45,
        targetDTE: 45,
        dteDeviation: 0,
        isWeekly: false,
        reasoning: 'Long selection',
        thetaDecayRate: 0.02
      }
      
      const mockMarketCondition = {
        oscillatorPhase: 'COMPRESSION' as const,
        ivRank: 70,
        volatilityRegime: 'HIGH' as const,
        signalQuality: 3 as const
      }
      
      const analysis = ExpirationSelectionUtils.analyzeSelection(longSelection, mockMarketCondition)
      expect(analysis.opportunities).toContain('More time for thesis to develop')
      expect(analysis.opportunities).toContain('Manageable time decay rate')
    })
  })
})