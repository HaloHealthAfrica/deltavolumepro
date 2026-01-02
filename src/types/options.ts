/**
 * Options Trading Types for Tradier Strike Selection System
 * 
 * Comprehensive type definitions for automated options trading
 * with delta targeting, Greeks tracking, and exit management.
 */

// ============================================================================
// CORE OPTIONS TYPES
// ============================================================================

export interface Greeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  impliedVolatility: number
}

export interface OptionContract {
  symbol: string
  strike: number
  expiration: string
  optionType: 'call' | 'put'
  bid: number
  ask: number
  last: number
  volume: number
  openInterest: number
  greeks: Greeks
  intrinsicValue: number
  timeValue: number
  daysToExpiration: number
}

export interface OptionsChain {
  symbol: string
  underlyingPrice: number
  options: {
    calls: OptionContract[]
    puts: OptionContract[]
  }
  expirations: string[]
  ivRank: number
  ivPercentile: number
  fetchedAt: Date
}

// ============================================================================
// STRIKE SELECTION TYPES
// ============================================================================

export interface OptionsStrikeSelection {
  strike: number
  optionSymbol: string
  actualDelta: number
  targetDelta: number
  deltaDeviation: number
  premium: number
  bid: number
  ask: number
  greeks: Greeks
  reasoning: string
}

export interface OptionsSpreadSelection {
  longLeg: OptionsStrikeSelection
  shortLeg: OptionsStrikeSelection
  netPremium: number
  maxRisk: number
  maxProfit: number
  breakeven: number
  spreadWidth: number
}

// Alias for compatibility with strike selector
export type StrikeSelection = OptionsStrikeSelection
export type SpreadSelection = OptionsSpreadSelection

export interface MarketCondition {
  oscillatorPhase: 'EXTREME_REVERSAL' | 'ZONE_REVERSAL' | 'TRENDING' | 'COMPRESSION'
  ivRank: number
  volatilityRegime: 'HIGH' | 'NORMAL' | 'LOW'
  signalQuality: 1 | 2 | 3 | 4 | 5
}

export interface OscillatorCondition {
  isExtremeReversal: boolean
  isZoneReversal: boolean
  isCompression: boolean
  oscillatorValue: number
}

// ============================================================================
// EXPIRATION SELECTION TYPES
// ============================================================================

export interface ExpirationSelection {
  expiration: string
  daysToExpiration: number
  targetDTE: number
  dteDeviation: number
  isWeekly: boolean
  reasoning: string
  thetaDecayRate: number
}

// ============================================================================
// POSITION SIZING TYPES
// ============================================================================

export interface PositionSize {
  contracts: number
  totalPremium: number
  riskAmount: number
  riskPercent: number
  qualityMultiplier: number
  oscillatorMultiplier: number
  compressionMultiplier: number
  reasoning: string
}

export interface RiskMetrics {
  maxLoss: number
  maxLossPercent: number
  breakeven: number
  riskRewardRatio: number
  probabilityOfProfit: number
}

// ============================================================================
// OPTIONS STRATEGY TYPES
// ============================================================================

export type OptionsStrategyType = 
  | 'LONG_CALL' 
  | 'LONG_PUT' 
  | 'BULL_CALL_SPREAD' 
  | 'BEAR_PUT_SPREAD' 
  | 'BULL_PUT_SPREAD' 
  | 'BEAR_CALL_SPREAD' 
  | 'IRON_CONDOR' 
  | 'STRADDLE'

export interface OptionsStrategy {
  type: OptionsStrategyType
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  volatilityBias: 'LONG_VOL' | 'SHORT_VOL' | 'NEUTRAL_VOL'
  riskProfile: 'AGGRESSIVE' | 'MODERATE' | 'CONSERVATIVE'
  maxRisk: number
  maxProfit: number | null // null for unlimited profit strategies
  breakevens: number[]
  reasoning: string
}

// ============================================================================
// ORDER EXECUTION TYPES
// ============================================================================

export interface OrderLeg {
  optionSymbol: string
  quantity: number
  side: 'buy' | 'sell'
  price: number
}

export interface ExecutionResult {
  success: boolean
  orderId?: string
  fillPrice?: number
  fillQuantity?: number
  executionTime?: Date
  error?: string
  tradierOrderId?: string
}

// ============================================================================
// POSITION MONITORING TYPES
// ============================================================================

export interface OptionsPosition {
  id: string
  tradeId: string
  symbol: string
  optionSymbol: string
  strategy: OptionsStrategy
  
  // Entry data
  entryDate: Date
  entryPrice: number
  contracts: number
  entryGreeks: Greeks
  entryIV: number
  
  // Current data
  currentPrice: number
  currentGreeks: Greeks
  currentIV: number
  currentPnL: number
  pnlPercent: number
  
  // Position details
  strike: number
  expiration: Date
  daysToExpiration: number
  optionType: 'call' | 'put'
  
  // Risk metrics
  maxRisk: number
  maxProfit: number | null
  breakeven: number
  
  // Exit tracking
  target1Hit: boolean
  target2Hit: boolean
  target3Hit: boolean
  exitConditions: ExitCondition[]
  
  // Metadata
  tradierOrderId: string
  status: 'OPEN' | 'CLOSED' | 'EXPIRED'
  lastUpdated: Date
}

export interface PositionUpdate {
  tradeId: string
  currentPrice: number
  currentGreeks: Greeks
  currentPnL: number
  pnlPercent: number
  daysToExpiration: number
  thetaDecay: number
  ivChange: number
  lastUpdated: Date
}

export interface PnLCalculation {
  totalPnL: number
  intrinsicValue: number
  timeValue: number
  volatilityPnL: number
  thetaDecay: number
  deltaChange: number
  gammaEffect: number
  vegaEffect: number
}

// ============================================================================
// EXIT MANAGEMENT TYPES
// ============================================================================

export type ExitType = 
  | 'STOP_LOSS' 
  | 'PROFIT_TARGET_1' 
  | 'PROFIT_TARGET_2' 
  | 'PROFIT_TARGET_3' 
  | 'DTE_EXIT' 
  | 'THETA_DECAY' 
  | 'IV_CRUSH' 
  | 'EOD_EXIT' 
  | 'OSCILLATOR_REVERSAL'

export interface ExitCondition {
  type: ExitType
  triggered: boolean
  value: number
  threshold: number
  description: string
}

export interface ExitDecision {
  shouldExit: boolean
  exitType: ExitType
  percentToClose: number
  reasoning: string
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE'
  triggeredConditions: ExitCondition[]
}

export interface ProfitTargetResult {
  target1Hit: boolean
  target2Hit: boolean
  target3Hit: boolean
  currentProfitPercent: number
  nextTarget: number
}

export interface TimeExitResult {
  dteExit: boolean
  thetaExit: boolean
  eodExit: boolean
  daysRemaining: number
  thetaDecayPercent: number
  minutesToClose: number
}

// ============================================================================
// PERFORMANCE ANALYSIS TYPES
// ============================================================================

export interface StrikeSelectionRecord {
  id: string
  tradeId: string
  
  // Selection criteria
  targetDelta: number
  actualDelta: number
  deltaDeviation: number
  
  // Market conditions at selection
  underlyingPrice: number
  ivRank: number
  oscillatorValue: number
  signalQuality: number
  
  // Selection results
  selectedStrike: number
  premium: number
  daysToExpiration: number
  
  // Performance tracking
  finalPnL: number
  holdingPeriod: number
  maxDrawdown: number
  
  // Analysis
  selectionAccuracy: number
  performanceScore: number
  lessons: string[]
}

export interface OptionsPerformanceMetrics {
  totalTrades: number
  winRate: number
  avgReturn: number
  avgHoldingPeriod: number
  
  // Strike selection accuracy
  avgDeltaDeviation: number
  strikeSelectionAccuracy: number
  
  // Greeks performance
  deltaEffectiveness: number
  thetaImpact: number
  vegaImpact: number
  gammaRisk: number
  
  // Exit condition effectiveness
  exitConditionStats: Record<ExitType, {
    frequency: number
    avgReturn: number
    effectiveness: number
  }>
  
  // Strategy performance
  strategyStats: Record<OptionsStrategyType, {
    trades: number
    winRate: number
    avgReturn: number
  }>
}

// ============================================================================
// TRADIER API SPECIFIC TYPES
// ============================================================================

export interface TradierAPIError extends Error {
  statusCode?: number
  retryable: boolean
}

export interface TradierRateLimit {
  requestsPerMinute: number
  requestsPerSecond: number
  retryAttempts: number
  baseDelay: number
}

// ============================================================================
// SIGNAL INTEGRATION TYPES
// ============================================================================

export interface TradingSignal {
  id: string
  action: 'LONG' | 'LONG_PREMIUM' | 'SHORT' | 'SHORT_PREMIUM'
  ticker: string
  quality: 1 | 2 | 3 | 4 | 5
  price: { entry: number }
  oscillator: {
    value: number
    phase: string
    compression: boolean
    leaving_extreme_down: boolean
    leaving_extreme_up: boolean
    leaving_accumulation: boolean
    leaving_distribution: boolean
  }
  volume: {
    z_score: number
    buy_percent: number
    sell_percent: number
    buyers_winning: boolean
  }
  structure: {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    vwap_position: 'ABOVE' | 'BELOW'
    at_atr_level: boolean
  }
  suggested_levels: {
    stop_loss: number
    target_1: number
    atr: number
  }
}

// ============================================================================
// DATABASE SCHEMA TYPES
// ============================================================================

export interface OptionsPositionEntity {
  id: string
  trade_id: string
  symbol: string
  option_symbol: string
  strategy: Record<string, any>
  
  // Entry data
  entry_date: Date
  entry_price: number
  contracts: number
  entry_greeks: Record<string, any>
  entry_iv: number
  
  // Current data
  current_price?: number
  current_greeks?: Record<string, any>
  current_iv?: number
  current_pnl?: number
  pnl_percent?: number
  
  // Position details
  strike: number
  expiration: Date
  days_to_expiration?: number
  option_type: string
  
  // Risk metrics
  max_risk: number
  max_profit?: number
  breakeven: number
  
  // Exit tracking
  target1_hit: boolean
  target2_hit: boolean
  target3_hit: boolean
  exit_conditions: Record<string, any>
  
  // Metadata
  tradier_order_id?: string
  status: string
  last_updated: Date
  created_at: Date
  updated_at: Date
}

export interface StrikeSelectionRecordEntity {
  id: string
  trade_id: string
  
  // Selection criteria
  target_delta: number
  actual_delta: number
  delta_deviation: number
  
  // Market conditions
  underlying_price: number
  iv_rank: number
  oscillator_value: number
  signal_quality: number
  
  // Selection results
  selected_strike: number
  premium: number
  days_to_expiration: number
  
  // Performance tracking
  final_pnl?: number
  holding_period?: number
  max_drawdown?: number
  
  // Analysis
  selection_accuracy?: number
  performance_score?: number
  lessons: Record<string, any>
  
  created_at: Date
  updated_at: Date
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type CreateOptionsPositionInput = Omit<OptionsPositionEntity, 'id' | 'created_at' | 'updated_at'>
export type UpdateOptionsPositionInput = Partial<Omit<OptionsPositionEntity, 'id' | 'created_at'>> & { id: string }

export type CreateStrikeSelectionRecordInput = Omit<StrikeSelectionRecordEntity, 'id' | 'created_at' | 'updated_at'>
export type UpdateStrikeSelectionRecordInput = Partial<Omit<StrikeSelectionRecordEntity, 'id' | 'created_at'>> & { id: string }

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface OptionsConfiguration {
  deltaTargets: {
    longOptions: number // 0.65
    longLeg: number     // 0.65
    shortLeg: number    // 0.30
  }
  
  dteTargets: {
    fiveStarSignals: number  // 14
    fourStarSignals: number  // 30
    compression: number      // 45
    extremeReversal: number  // 7-14
  }
  
  positionSizing: {
    baseRiskPercent: number      // 2%
    maxPositionPercent: number   // 5%
    qualityMultipliers: Record<number, number>
    reversalMultiplier: number   // 1.5x
    compressionMultiplier: number // 0.5x
  }
  
  exitConditions: {
    stopLossPercent: number      // 90%
    profitTargets: number[]      // [50%, 100%, 200%]
    partialExitPercents: number[] // [50%, 60%, 100%]
    maxDTE: number              // 3
    maxThetaDecayPercent: number // 10%
    maxIVCrushPercent: number   // 30%
    eodExitMinutes: number      // 30
  }
  
  monitoring: {
    updateIntervalSeconds: number // 30
    maxConcurrentPositions: number
    enableRealTimeGreeks: boolean
  }
}