/**
 * Real-Time Options Position Monitoring System
 * 
 * Implements continuous monitoring of options positions with real-time Greeks updates,
 * P&L calculation, and risk metric tracking.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { apiLogger as logger } from '../logger'
import { tradierClient } from '../api-clients/tradier'
import type { 
  OptionsPosition,
  Greeks,
  PositionUpdate,
  PnLCalculation
} from '../../types/options'

// Define the interface for the Tradier client methods we need
interface TradierClientInterface {
  getOptionQuote?: (symbol: string) => Promise<any>
  getQuote?: (symbol: string) => Promise<any>
  fetchOptionQuote?: (symbol: string) => Promise<any>
  fetchQuote?: (symbol: string) => Promise<any>
}

export interface MonitoringConfig {
  updateIntervalSeconds: number    // Default: 30 seconds
  significantGreeksChange: number  // Default: 0.05 (5% change)
  maxConcurrentUpdates: number     // Default: 10
  retryAttempts: number           // Default: 3
  timeoutMs: number               // Default: 5000ms
}

export interface PositionSnapshot {
  positionId: string
  timestamp: Date
  underlyingPrice: number
  optionPrice: number
  greeks: Greeks
  impliedVolatility: number
  daysToExpiration: number
  pnl: PnLCalculation
  riskMetrics: RiskMetrics
}

export interface RiskMetrics {
  deltaExposure: number
  gammaRisk: number
  thetaDecay: number
  vegaRisk: number
  portfolioDelta: number
  portfolioGamma: number
}

export interface MonitoringAlert {
  positionId: string
  alertType: 'GREEKS_CHANGE' | 'RISK_THRESHOLD' | 'DTE_WARNING' | 'THETA_DECAY' | 'API_ERROR'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  timestamp: Date
  data?: any
}

const DEFAULT_CONFIG: MonitoringConfig = {
  updateIntervalSeconds: 30,
  significantGreeksChange: 0.05,
  maxConcurrentUpdates: 10,
  retryAttempts: 3,
  timeoutMs: 5000
}

export class OptionsPositionMonitor {
  private config: MonitoringConfig
  private tradierClient: TradierClientInterface
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map()
  private activePositions: Map<string, OptionsPosition> = new Map()
  private lastSnapshots: Map<string, PositionSnapshot> = new Map()
  private alertCallbacks: ((alert: MonitoringAlert) => void)[] = []
  private isRunning: boolean = false

  constructor(
    tradierClientInstance: TradierClientInterface,
    config: Partial<MonitoringConfig> = {}
  ) {
    this.tradierClient = tradierClientInstance
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start monitoring a specific position
   */
  async startMonitoring(position: OptionsPosition): Promise<void> {
    logger.info(`Starting monitoring for position ${position.id}`)
    
    // Store position
    this.activePositions.set(position.id, position)
    
    // Create monitoring interval
    const interval = setInterval(async () => {
      try {
        await this.updatePosition(position.id)
      } catch (error) {
        logger.error(`Error updating position ${position.id}:`, error instanceof Error ? error : undefined)
        this.emitAlert({
          positionId: position.id,
          alertType: 'API_ERROR',
          severity: 'HIGH',
          message: `Failed to update position: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          data: { error }
        })
      }
    }, this.config.updateIntervalSeconds * 1000)
    
    this.monitoringIntervals.set(position.id, interval)
    
    // Perform initial update
    await this.updatePosition(position.id)
  }

  /**
   * Stop monitoring a specific position
   */
  async stopMonitoring(positionId: string): Promise<void> {
    logger.info(`Stopping monitoring for position ${positionId}`)
    
    const interval = this.monitoringIntervals.get(positionId)
    if (interval) {
      clearInterval(interval)
      this.monitoringIntervals.delete(positionId)
    }
    
    this.activePositions.delete(positionId)
    this.lastSnapshots.delete(positionId)
  }

  /**
   * Update position data with current market information
   */
  async updatePosition(positionId: string): Promise<PositionUpdate> {
    const position = this.activePositions.get(positionId)
    if (!position) {
      throw new Error(`Position ${positionId} not found in active monitoring`)
    }

    // Get current option quote - support both method names
    const getOptionQuote = this.tradierClient.getOptionQuote || this.tradierClient.fetchOptionQuote
    const getQuote = this.tradierClient.getQuote || this.tradierClient.fetchQuote
    
    if (!getOptionQuote || !getQuote) {
      throw new Error('Tradier client does not have required methods')
    }
    
    const optionQuote = await getOptionQuote.call(this.tradierClient, position.optionSymbol)
    
    // Get underlying price
    const underlyingQuote = await getQuote.call(this.tradierClient, position.symbol)
    const underlyingPrice = underlyingQuote.last || underlyingQuote.close

    // Calculate current Greeks
    const currentGreeks = await this.getGreeksUpdate(position.optionSymbol)
    
    // Calculate days to expiration
    const daysToExpiration = this.calculateDaysToExpiration(position.expiration)
    
    // Calculate current P&L
    const currentPnL = await this.calculateCurrentPnL(position, optionQuote, underlyingPrice)
    
    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(position, currentGreeks, underlyingPrice)
    
    // Create position update
    const update: PositionUpdate = {
      tradeId: position.tradeId,
      currentPrice: optionQuote.last || (optionQuote.bid + optionQuote.ask) / 2,
      currentGreeks,
      currentPnL: currentPnL.totalPnL,
      pnlPercent: currentPnL.totalPnL / (position.contracts * position.entryPrice * 100),
      daysToExpiration,
      thetaDecay: currentPnL.thetaDecay,
      ivChange: currentGreeks.impliedVolatility - position.entryIV,
      lastUpdated: new Date()
    }
    
    // Create snapshot
    const snapshot: PositionSnapshot = {
      positionId,
      timestamp: new Date(),
      underlyingPrice,
      optionPrice: update.currentPrice,
      greeks: currentGreeks,
      impliedVolatility: currentGreeks.impliedVolatility,
      daysToExpiration,
      pnl: currentPnL,
      riskMetrics
    }
    
    // Check for significant changes
    await this.checkForSignificantChanges(position, snapshot)
    
    // Store snapshot
    this.lastSnapshots.set(positionId, snapshot)
    
    // Update position in memory
    position.currentPrice = update.currentPrice
    position.currentGreeks = currentGreeks
    position.currentIV = currentGreeks.impliedVolatility
    position.currentPnL = update.currentPnL
    position.pnlPercent = update.pnlPercent
    position.daysToExpiration = daysToExpiration
    position.lastUpdated = update.lastUpdated
    
    logger.debug(`Updated position ${positionId}: P&L ${update.currentPnL.toFixed(2)}, Delta ${currentGreeks.delta.toFixed(3)}`)
    
    return update
  }

  /**
   * Calculate current P&L with Greeks breakdown
   */
  async calculateCurrentPnL(
    position: OptionsPosition,
    currentQuote: any,
    underlyingPrice: number
  ): Promise<PnLCalculation> {
    const currentPrice = currentQuote.last || (currentQuote.bid + currentQuote.ask) / 2
    const entryPrice = position.entryPrice
    
    // Total P&L
    const totalPnL = (currentPrice - entryPrice) * position.contracts * 100
    
    // Intrinsic value calculation
    let intrinsicValue = 0
    if (position.optionType === 'call') {
      intrinsicValue = Math.max(0, underlyingPrice - position.strike)
    } else {
      intrinsicValue = Math.max(0, position.strike - underlyingPrice)
    }
    
    // Time value = current price - intrinsic value
    const timeValue = Math.max(0, currentPrice - intrinsicValue)
    
    // Estimate component contributions (simplified)
    const underlyingMove = underlyingPrice - (position.entryGreeks?.delta ? 
      underlyingPrice - (totalPnL / (position.entryGreeks.delta * position.contracts * 100)) : 0)
    
    const deltaChange = position.entryGreeks?.delta ? 
      underlyingMove * position.entryGreeks.delta * position.contracts * 100 : 0
    
    // Time decay (theta impact)
    const daysElapsed = Math.max(0, 
      (Date.now() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24))
    const thetaDecay = position.entryGreeks?.theta ? 
      position.entryGreeks.theta * daysElapsed * position.contracts * 100 : 0
    
    // Gamma effect (second-order delta changes)
    const gammaEffect = position.entryGreeks?.gamma ? 
      0.5 * position.entryGreeks.gamma * Math.pow(underlyingMove, 2) * position.contracts * 100 : 0
    
    // Vega effect (IV changes)
    const ivChange = position.currentIV ? position.currentIV - position.entryIV : 0
    const vegaEffect = position.entryGreeks?.vega ? 
      position.entryGreeks.vega * ivChange * position.contracts * 100 : 0
    
    return {
      totalPnL,
      intrinsicValue: intrinsicValue * position.contracts * 100,
      timeValue: timeValue * position.contracts * 100,
      volatilityPnL: vegaEffect,
      thetaDecay,
      deltaChange,
      gammaEffect,
      vegaEffect
    }
  }

  /**
   * Get updated Greeks for an option
   */
  async getGreeksUpdate(optionSymbol: string): Promise<Greeks> {
    try {
      const getOptionQuote = this.tradierClient.getOptionQuote || this.tradierClient.fetchOptionQuote
      if (!getOptionQuote) {
        throw new Error('Tradier client does not have getOptionQuote method')
      }
      
      const optionQuote = await getOptionQuote.call(this.tradierClient, optionSymbol)
      
      return {
        delta: optionQuote.greeks?.delta || 0,
        gamma: optionQuote.greeks?.gamma || 0,
        theta: optionQuote.greeks?.theta || 0,
        vega: optionQuote.greeks?.vega || 0,
        rho: optionQuote.greeks?.rho || 0,
        impliedVolatility: optionQuote.greeks?.mid_iv || 0
      }
    } catch (error) {
      logger.error(`Failed to get Greeks update for ${optionSymbol}:`, error instanceof Error ? error : undefined)
      throw error
    }
  }

  /**
   * Calculate risk metrics for position
   */
  private calculateRiskMetrics(
    position: OptionsPosition,
    currentGreeks: Greeks,
    underlyingPrice: number
  ): RiskMetrics {
    const notionalValue = position.contracts * 100 * underlyingPrice
    
    return {
      deltaExposure: currentGreeks.delta * notionalValue,
      gammaRisk: currentGreeks.gamma * notionalValue,
      thetaDecay: Math.abs(currentGreeks.theta * position.contracts * 100),
      vegaRisk: Math.abs(currentGreeks.vega * position.contracts * 100),
      portfolioDelta: currentGreeks.delta * position.contracts * 100,
      portfolioGamma: currentGreeks.gamma * position.contracts * 100
    }
  }

  /**
   * Calculate days to expiration
   */
  private calculateDaysToExpiration(expiration: Date): number {
    const now = new Date()
    const expirationDate = new Date(expiration)
    
    // Set to market close time (4 PM ET)
    expirationDate.setHours(16, 0, 0, 0)
    
    const timeDiff = expirationDate.getTime() - now.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
    
    return Math.max(0, daysDiff)
  }

  /**
   * Check for significant changes and emit alerts
   */
  private async checkForSignificantChanges(
    position: OptionsPosition,
    currentSnapshot: PositionSnapshot
  ): Promise<void> {
    const lastSnapshot = this.lastSnapshots.get(position.id)
    if (!lastSnapshot) return // First snapshot
    
    // Check for significant Greeks changes
    const deltaChange = Math.abs(currentSnapshot.greeks.delta - lastSnapshot.greeks.delta)
    if (deltaChange > this.config.significantGreeksChange) {
      this.emitAlert({
        positionId: position.id,
        alertType: 'GREEKS_CHANGE',
        severity: 'MEDIUM',
        message: `Significant delta change: ${deltaChange.toFixed(3)} (${(deltaChange * 100).toFixed(1)}%)`,
        timestamp: new Date(),
        data: { 
          oldDelta: lastSnapshot.greeks.delta,
          newDelta: currentSnapshot.greeks.delta,
          change: deltaChange
        }
      })
    }
    
    // Check for DTE warnings
    if (currentSnapshot.daysToExpiration <= 3 && lastSnapshot.daysToExpiration > 3) {
      this.emitAlert({
        positionId: position.id,
        alertType: 'DTE_WARNING',
        severity: 'HIGH',
        message: `Position approaching expiration: ${currentSnapshot.daysToExpiration} days remaining`,
        timestamp: new Date(),
        data: { daysToExpiration: currentSnapshot.daysToExpiration }
      })
    }
    
    // Check for excessive theta decay
    const dailyThetaDecay = Math.abs(currentSnapshot.pnl.thetaDecay)
    const positionValue = position.contracts * position.entryPrice * 100
    const thetaDecayPercent = dailyThetaDecay / positionValue
    
    if (thetaDecayPercent > 0.1 && currentSnapshot.pnl.totalPnL < 0) {
      this.emitAlert({
        positionId: position.id,
        alertType: 'THETA_DECAY',
        severity: 'HIGH',
        message: `Excessive theta decay while losing: ${(thetaDecayPercent * 100).toFixed(1)}% per day`,
        timestamp: new Date(),
        data: { 
          thetaDecayPercent,
          dailyThetaDecay,
          totalPnL: currentSnapshot.pnl.totalPnL
        }
      })
    }
  }

  /**
   * Start monitoring all positions
   */
  async startAllMonitoring(): Promise<void> {
    if (this.isRunning) return
    
    this.isRunning = true
    logger.info('Started options position monitoring system')
  }

  /**
   * Stop monitoring all positions
   */
  async stopAllMonitoring(): Promise<void> {
    if (!this.isRunning) return
    
    // Stop all individual position monitoring
    for (const positionId of this.activePositions.keys()) {
      await this.stopMonitoring(positionId)
    }
    
    this.isRunning = false
    logger.info('Stopped options position monitoring system')
  }

  /**
   * Get current snapshot for a position
   */
  getCurrentSnapshot(positionId: string): PositionSnapshot | null {
    return this.lastSnapshots.get(positionId) || null
  }

  /**
   * Get all active positions
   */
  getActivePositions(): OptionsPosition[] {
    return Array.from(this.activePositions.values())
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: MonitoringAlert) => void): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * Emit alert to all callbacks
   */
  private emitAlert(alert: MonitoringAlert): void {
    logger.warn(`Position alert: ${alert.message}`, alert as unknown as Record<string, unknown>)
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert)
      } catch (error) {
        logger.error('Error in alert callback:', error instanceof Error ? error : undefined)
      }
    })
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig }
    logger.info('Updated monitoring configuration', this.config as unknown as Record<string, unknown>)
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    activePositions: number
    totalDeltaExposure: number
    totalGammaRisk: number
    totalThetaDecay: number
    averageUpdateInterval: number
  } {
    const snapshots = Array.from(this.lastSnapshots.values())
    
    return {
      activePositions: this.activePositions.size,
      totalDeltaExposure: snapshots.reduce((sum, s) => sum + s.riskMetrics.deltaExposure, 0),
      totalGammaRisk: snapshots.reduce((sum, s) => sum + s.riskMetrics.gammaRisk, 0),
      totalThetaDecay: snapshots.reduce((sum, s) => sum + s.riskMetrics.thetaDecay, 0),
      averageUpdateInterval: this.config.updateIntervalSeconds
    }
  }
}

/**
 * Utility functions for position monitoring
 */
export class MonitoringUtils {
  
  /**
   * Validate monitoring configuration
   */
  static validateConfig(config: MonitoringConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (config.updateIntervalSeconds < 5) {
      errors.push('Update interval must be at least 5 seconds')
    }
    
    if (config.significantGreeksChange < 0.01 || config.significantGreeksChange > 0.5) {
      errors.push('Significant Greeks change must be between 1% and 50%')
    }
    
    if (config.maxConcurrentUpdates < 1) {
      errors.push('Max concurrent updates must be at least 1')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Calculate portfolio-level risk metrics
   */
  static calculatePortfolioRisk(snapshots: PositionSnapshot[]): {
    netDelta: number
    netGamma: number
    netTheta: number
    netVega: number
    totalNotional: number
  } {
    return snapshots.reduce((acc, snapshot) => ({
      netDelta: acc.netDelta + snapshot.riskMetrics.portfolioDelta,
      netGamma: acc.netGamma + snapshot.riskMetrics.portfolioGamma,
      netTheta: acc.netTheta + snapshot.pnl.thetaDecay,
      netVega: acc.netVega + snapshot.riskMetrics.vegaRisk,
      totalNotional: acc.totalNotional + Math.abs(snapshot.riskMetrics.deltaExposure)
    }), {
      netDelta: 0,
      netGamma: 0,
      netTheta: 0,
      netVega: 0,
      totalNotional: 0
    })
  }
}

// Export singleton instance
export const positionMonitor = new OptionsPositionMonitor(
  // Will be injected with actual Tradier client
  tradierClient as unknown as TradierClientInterface
)