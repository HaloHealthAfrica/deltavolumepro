/**
 * Options Trading Module - Main Entry Point
 * 
 * Provides a unified interface for options trading functionality
 * including strike selection, expiration selection, and position management.
 */

export { TradierStrikeSelector, strikeSelector, StrikeSelectionUtils } from './strike-selector'
export { TradierExpirationSelector, ExpirationSelectionUtils } from './expiration-selector'
export { PositionSizeCalculator, PositionSizingUtils, positionSizer } from './position-sizer'
export { OptionsStrategySelector, OptionsOrderExecutor, StrategyUtils, strategySelector, orderExecutor } from './strategy-selector'
export { OptionsPositionMonitor, MonitoringUtils, positionMonitor } from './position-monitor'
export { OptionsExitManager, ExitManagementUtils, exitManager } from './exit-manager'
export { OptionsPerformanceAnalyzer, performanceAnalyzer } from './performance-analyzer'

// Re-export types for convenience
export type {
  StrikeSelection,
  SpreadSelection,
  MarketCondition,
  OscillatorCondition,
  OptionsStrategy,
  OptionsPosition,
  Greeks
} from '../../types/options'

export type {
  ExpirationSelection
} from './expiration-selector'

export type {
  PositionSize,
  RiskMetrics as PositionSizingRiskMetrics,
  PositionSizeConfig
} from './position-sizer'

export type {
  TradingSignal,
  StrategySelection,
  OrderExecutionPlan,
  OrderLeg
} from './strategy-selector'

export type {
  MonitoringConfig,
  PositionSnapshot,
  RiskMetrics as MonitoringRiskMetrics,
  MonitoringAlert
} from './position-monitor'

export type {
  ExitRules,
  ExitExecutionPlan,
  ExitType
} from './exit-manager'

export type {
  OptionsChain,
  OptionContract,
  TradierOption,
  TradierGreeks
} from '../api-clients/tradier'