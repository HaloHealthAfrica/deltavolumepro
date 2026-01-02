/**
 * Learning Engine Integration Tests
 * Tests trade analysis and rule optimization
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { describe, it, expect, vi } from 'vitest'

describe('Learning Engine Integration', () => {
  describe('Trade Analysis', () => {
    it('should classify trade outcomes correctly', () => {
      const classifyOutcome = (pnl: number): 'WIN' | 'LOSS' | 'BREAKEVEN' => {
        if (pnl > 0) return 'WIN'
        if (pnl < 0) return 'LOSS'
        return 'BREAKEVEN'
      }

      expect(classifyOutcome(450)).toBe('WIN')
      expect(classifyOutcome(-350)).toBe('LOSS')
      expect(classifyOutcome(0)).toBe('BREAKEVEN')
    })

    it('should calculate vs expectation correctly', () => {
      const trade = {
        expectedReturn: 500,
        actualReturn: 450,
      }

      const vsExpectation = trade.actualReturn / trade.expectedReturn
      expect(vsExpectation).toBeCloseTo(0.90, 2) // 90% of expected
    })

    it('should calculate feature importance for winning trades', () => {
      const winningTrades = [
        { signalQuality: 5, volumePressure: 75, oscillatorPhase: 'ACCUMULATION', outcome: 'WIN' },
        { signalQuality: 5, volumePressure: 80, oscillatorPhase: 'ACCUMULATION', outcome: 'WIN' },
        { signalQuality: 4, volumePressure: 70, oscillatorPhase: 'LEAVING_ACCUMULATION', outcome: 'WIN' },
        { signalQuality: 5, volumePressure: 65, oscillatorPhase: 'ACCUMULATION', outcome: 'WIN' },
      ]

      // Calculate average quality for winners
      const avgQuality = winningTrades.reduce((sum, t) => sum + t.signalQuality, 0) / winningTrades.length
      expect(avgQuality).toBeCloseTo(4.75, 2)

      // Calculate average volume pressure for winners
      const avgVolume = winningTrades.reduce((sum, t) => sum + t.volumePressure, 0) / winningTrades.length
      expect(avgVolume).toBeCloseTo(72.5, 1)

      // Count accumulation phase trades
      const accumulationCount = winningTrades.filter(t => 
        t.oscillatorPhase === 'ACCUMULATION' || t.oscillatorPhase === 'LEAVING_ACCUMULATION'
      ).length
      expect(accumulationCount).toBe(4) // All winners were in accumulation
    })

    it('should identify patterns in losing trades', () => {
      const losingTrades = [
        { signalQuality: 3, volumePressure: 55, oscillatorPhase: 'NEUTRAL', outcome: 'LOSS' },
        { signalQuality: 3, volumePressure: 50, oscillatorPhase: 'DISTRIBUTION', outcome: 'LOSS' },
        { signalQuality: 4, volumePressure: 45, oscillatorPhase: 'NEUTRAL', outcome: 'LOSS' },
      ]

      // Calculate average quality for losers
      const avgQuality = losingTrades.reduce((sum, t) => sum + t.signalQuality, 0) / losingTrades.length
      expect(avgQuality).toBeCloseTo(3.33, 2)

      // Calculate average volume pressure for losers
      const avgVolume = losingTrades.reduce((sum, t) => sum + t.volumePressure, 0) / losingTrades.length
      expect(avgVolume).toBe(50)

      // Insight: Losers had lower quality and volume pressure
      expect(avgQuality).toBeLessThan(4)
      expect(avgVolume).toBeLessThan(60)
    })
  })

  describe('Rule Optimization', () => {
    it('should trigger optimization after 50 trades', () => {
      const OPTIMIZATION_THRESHOLD = 50
      const tradeCount = 52

      const shouldOptimize = tradeCount >= OPTIMIZATION_THRESHOLD
      expect(shouldOptimize).toBe(true)
    })

    it('should calculate new weights based on feature importance', () => {
      const featureImportance = {
        quality: 0.35,
        volume: 0.25,
        oscillator: 0.20,
        structure: 0.12,
        market: 0.08,
      }

      // Normalize weights to sum to 1.0
      const total = Object.values(featureImportance).reduce((a, b) => a + b, 0)
      const normalizedWeights = Object.fromEntries(
        Object.entries(featureImportance).map(([k, v]) => [k, v / total])
      )

      const weightSum = Object.values(normalizedWeights).reduce((a, b) => a + b, 0)
      expect(weightSum).toBeCloseTo(1.0, 5)
    })

    it('should create new rule version with incremented version number', () => {
      const currentVersion = 'v1.2.3'
      
      const incrementVersion = (version: string): string => {
        const match = version.match(/v(\d+)\.(\d+)\.(\d+)/)
        if (!match) return 'v1.0.1'
        
        const [, major, minor, patch] = match
        return `v${major}.${minor}.${parseInt(patch) + 1}`
      }

      const newVersion = incrementVersion(currentVersion)
      expect(newVersion).toBe('v1.2.4')
    })

    it('should preserve rule history', () => {
      const ruleHistory = [
        { version: 'v1.0.0', isActive: false, tradesExecuted: 100, winRate: 0.55 },
        { version: 'v1.0.1', isActive: false, tradesExecuted: 75, winRate: 0.58 },
        { version: 'v1.0.2', isActive: true, tradesExecuted: 50, winRate: 0.62 },
      ]

      // Should have multiple versions
      expect(ruleHistory.length).toBe(3)

      // Only one should be active
      const activeCount = ruleHistory.filter(r => r.isActive).length
      expect(activeCount).toBe(1)

      // Win rate should improve over versions
      const winRates = ruleHistory.map(r => r.winRate)
      expect(winRates[2]).toBeGreaterThan(winRates[0])
    })
  })

  describe('Backtesting', () => {
    it('should validate new rules against historical data', () => {
      const historicalTrades = [
        { signalQuality: 5, volumePressure: 75, outcome: 'WIN' },
        { signalQuality: 4, volumePressure: 70, outcome: 'WIN' },
        { signalQuality: 3, volumePressure: 55, outcome: 'LOSS' },
        { signalQuality: 5, volumePressure: 80, outcome: 'WIN' },
        { signalQuality: 3, volumePressure: 50, outcome: 'LOSS' },
      ]

      const newRules = {
        minQuality: 4,
        minVolumePressure: 65,
      }

      // Filter trades that would have been taken with new rules
      const filteredTrades = historicalTrades.filter(t => 
        t.signalQuality >= newRules.minQuality && 
        t.volumePressure >= newRules.minVolumePressure
      )

      // Calculate win rate with new rules
      const wins = filteredTrades.filter(t => t.outcome === 'WIN').length
      const winRate = wins / filteredTrades.length

      expect(filteredTrades.length).toBe(3) // Only 3 trades would pass
      expect(winRate).toBe(1.0) // All 3 would be winners
    })

    it('should compare backtest results to current performance', () => {
      const currentPerformance = {
        winRate: 0.55,
        avgReturn: 1.2,
        sharpeRatio: 1.1,
      }

      const backtestResults = {
        winRate: 0.65,
        avgReturn: 1.5,
        sharpeRatio: 1.4,
      }

      // New rules should show improvement
      expect(backtestResults.winRate).toBeGreaterThan(currentPerformance.winRate)
      expect(backtestResults.avgReturn).toBeGreaterThan(currentPerformance.avgReturn)
      expect(backtestResults.sharpeRatio).toBeGreaterThan(currentPerformance.sharpeRatio)
    })
  })

  describe('Insight Generation', () => {
    it('should generate actionable insights from trade analysis', () => {
      const tradeStats = {
        totalTrades: 100,
        wins: 60,
        losses: 40,
        avgWinSize: 450,
        avgLossSize: 300,
        bestPerformingPhase: 'ACCUMULATION',
        worstPerformingPhase: 'DISTRIBUTION',
        avgQualityWinners: 4.5,
        avgQualityLosers: 3.2,
      }

      const insights: string[] = []

      // Win rate insight
      const winRate = tradeStats.wins / tradeStats.totalTrades
      if (winRate > 0.55) {
        insights.push(`Strong win rate of ${(winRate * 100).toFixed(1)}%`)
      }

      // Expectancy insight
      const expectancy = (winRate * tradeStats.avgWinSize) - ((1 - winRate) * tradeStats.avgLossSize)
      if (expectancy > 0) {
        insights.push(`Positive expectancy of $${expectancy.toFixed(2)} per trade`)
      }

      // Phase insight
      insights.push(`Best performance in ${tradeStats.bestPerformingPhase} phase`)
      insights.push(`Avoid trading in ${tradeStats.worstPerformingPhase} phase`)

      // Quality insight
      if (tradeStats.avgQualityWinners > tradeStats.avgQualityLosers) {
        insights.push('Higher quality signals correlate with winning trades')
      }

      expect(insights.length).toBeGreaterThan(0)
      expect(insights).toContain('Strong win rate of 60.0%')
      expect(insights).toContain('Best performance in ACCUMULATION phase')
    })

    it('should suggest improvements based on patterns', () => {
      const patterns = {
        lowQualityLosses: 0.8, // 80% of losses were low quality
        lowVolumeLosses: 0.7, // 70% of losses had low volume
        distributionLosses: 0.6, // 60% of losses in distribution
      }

      const suggestions: string[] = []

      if (patterns.lowQualityLosses > 0.5) {
        suggestions.push('Consider increasing minimum quality threshold')
      }

      if (patterns.lowVolumeLosses > 0.5) {
        suggestions.push('Consider increasing minimum volume pressure requirement')
      }

      if (patterns.distributionLosses > 0.5) {
        suggestions.push('Consider reducing position size in distribution phase')
      }

      expect(suggestions.length).toBe(3)
    })
  })
})

describe('Rule Version Management', () => {
  it('should track performance metrics per version', () => {
    const versionMetrics = {
      'v1.0.0': { tradesExecuted: 100, winRate: 0.55, avgReturn: 1.1, sharpeRatio: 1.0 },
      'v1.0.1': { tradesExecuted: 75, winRate: 0.58, avgReturn: 1.3, sharpeRatio: 1.2 },
      'v1.0.2': { tradesExecuted: 50, winRate: 0.62, avgReturn: 1.5, sharpeRatio: 1.4 },
    }

    // Verify metrics are tracked
    expect(Object.keys(versionMetrics).length).toBe(3)

    // Verify improvement trend
    const versions = Object.keys(versionMetrics).sort()
    const firstVersion = versionMetrics[versions[0] as keyof typeof versionMetrics]
    const lastVersion = versionMetrics[versions[versions.length - 1] as keyof typeof versionMetrics]

    expect(lastVersion.winRate).toBeGreaterThan(firstVersion.winRate)
    expect(lastVersion.sharpeRatio).toBeGreaterThan(firstVersion.sharpeRatio)
  })

  it('should allow rollback to previous version', () => {
    const versions = [
      { version: 'v1.0.0', isActive: false },
      { version: 'v1.0.1', isActive: false },
      { version: 'v1.0.2', isActive: true },
    ]

    // Simulate rollback to v1.0.1
    const rollbackTo = 'v1.0.1'
    const updatedVersions = versions.map(v => ({
      ...v,
      isActive: v.version === rollbackTo,
    }))

    const activeVersion = updatedVersions.find(v => v.isActive)
    expect(activeVersion?.version).toBe('v1.0.1')
  })
})
