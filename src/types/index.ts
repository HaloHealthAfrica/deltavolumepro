// ============================================================================
// RE-EXPORT ALL TYPES FROM SPECIALIZED MODULES
// ============================================================================

// Export all trading-related types
export * from './trading';

// Export all API response types
export * from './api';

// Export monitoring types (excluding PerformanceMetrics to avoid conflict with trading.ts)
export type {
  WebhookRequest,
  ProcessingStage,
  SystemMetrics,
  SystemAlert,
  WebhookEvent,
  SystemHealth,
  MonitoringFilters,
  RealTimeMetrics,
  PipelineStatus,
  WebhookStatus,
  ProcessingStageType,
  ProcessingStageStatus,
  AlertSeverity,
  AlertCategory,
  WebhookEventType,
  SystemHealthStatus,
  TimeRange,
  TrendDirection,
  WebhookEventData,
  DatabaseHealth,
  ApiHealth,
  MemoryHealth,
  QueueHealth,
  ErrorSummary,
  MonitoringPaginatedResponse,
  DashboardWidget,
  DashboardWidgetType,
  DashboardLayout,
  CreateWebhookRequestInput,
  UpdateWebhookRequestInput,
  CreateProcessingStageInput,
  UpdateProcessingStageInput,
  CreateSystemAlertInput,
  UpdateSystemAlertInput,
  WebhookRequestWithRelations,
  TimeSeriesDataPoint,
  ChartData,
} from './monitoring';
// Re-export monitoring PerformanceMetrics with alias
export type { PerformanceMetrics as MonitoringPerformanceMetrics } from './monitoring';
// Re-export monitoring constants
export {
  DEFAULT_PAGINATION,
  TIME_RANGES,
  ALERT_SEVERITY_PRIORITY,
  PROCESSING_STAGE_ORDER,
  REFRESH_INTERVALS,
  isValidWebhookStatus,
  isValidProcessingStageType,
  isValidAlertSeverity,
  isValidSystemHealthStatus,
} from './monitoring';

// Export all options trading types (excluding StrikeSelection to avoid conflict with trading.ts)
export type {
  Greeks,
  OptionContract,
  OptionsChain,
  OptionsStrikeSelection,
  OptionsSpreadSelection,
  StrikeSelection as OptionsStrikeSelectionAlias,
  SpreadSelection as OptionsSpreadSelectionAlias,
  MarketCondition,
  OscillatorCondition,
  ExpirationSelection,
  PositionSize,
  RiskMetrics,
  OptionsStrategyType,
  OptionsStrategy,
  OrderLeg,
  ExecutionResult,
  OptionsPosition,
  PositionUpdate,
  PnLCalculation,
  ExitType,
  ExitCondition,
  ExitDecision,
  ProfitTargetResult,
  TimeExitResult,
  StrikeSelectionRecord,
  OptionsPerformanceMetrics,
  TradierAPIError,
  TradierRateLimit,
  TradingSignal,
  OptionsPositionEntity,
  StrikeSelectionRecordEntity,
  CreateOptionsPositionInput,
  UpdateOptionsPositionInput,
  CreateStrikeSelectionRecordInput,
  UpdateStrikeSelectionRecordInput,
  OptionsConfiguration
} from './options';

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS (to be deprecated)
// ============================================================================

// These are kept for backward compatibility but should be migrated to the new types
export type { TradingViewWebhook } from './trading';
export type { DecisionFactors, DecisionReasoning } from './trading';
export type { BrokerType, ExitReason } from './trading';
export type { FeatureImportance } from './trading';
export type { BacktestResults } from './trading';
export type { DashboardMetrics, SignalFeedItem, PositionSummary } from './trading';
export type { WebSocketMessage, NotificationMessage } from './trading';