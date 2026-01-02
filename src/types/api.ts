// ============================================================================
// API RESPONSE TYPES FOR TRPC ENDPOINTS
// ============================================================================

import type {
  Signal,
  EnrichedData,
  Decision,
  Trade,
  TradeAnalysis,
  TradingRules,
  MarketContext,
  SignalWithRelations,
  TradeWithAnalysis,
  PaginatedResponse,
  PerformanceMetrics,
  TradeStatistics,
  BacktestResults,
  DashboardMetrics,
  SignalFeedItem,
  PositionSummary,
  NotificationMessage,
  ValidationError,
  ApiError,
  BrokerError,
  SignalFilters,
  TradeFilters,
  PaginationParams,
  DecisionFactors,
  DecisionReasoning,
  AggregatedMarketData,
  LearningInsights,
  OptimizationResult,
} from './trading';

// ============================================================================
// STANDARD API RESPONSE WRAPPER
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
  requestId?: string;
}

export interface ApiSuccessResponse<T> extends ApiResponse<T> {
  success: true;
  data: T;
  error?: never;
}

export interface ApiErrorResponse extends ApiResponse<never> {
  success: false;
  data?: never;
  error: ApiError;
}

// ============================================================================
// SIGNAL ENDPOINTS
// ============================================================================

export interface CreateSignalRequest {
  webhook: any; // TradingView webhook payload
}

export interface CreateSignalResponse extends ApiSuccessResponse<Signal> {}

export interface GetSignalRequest {
  id: string;
  includeRelations?: boolean;
}

export interface GetSignalResponse extends ApiSuccessResponse<SignalWithRelations> {}

export interface ListSignalsRequest {
  filters?: SignalFilters;
  pagination?: PaginationParams;
}

export interface ListSignalsResponse extends ApiSuccessResponse<PaginatedResponse<SignalWithRelations>> {}

export interface UpdateSignalRequest {
  id: string;
  data: Partial<Signal>;
}

export interface UpdateSignalResponse extends ApiSuccessResponse<Signal> {}

export interface DeleteSignalRequest {
  id: string;
}

export interface DeleteSignalResponse extends ApiSuccessResponse<{ deleted: boolean }> {}

export interface ProcessSignalRequest {
  signalId: string;
  forceReprocess?: boolean;
}

export interface ProcessSignalResponse extends ApiSuccessResponse<{
  signal: Signal;
  enrichedData?: EnrichedData;
  decision?: Decision;
  trade?: Trade;
}> {}

// ============================================================================
// ENRICHED DATA ENDPOINTS
// ============================================================================

export interface CreateEnrichedDataRequest {
  signalId: string;
  tradierData?: any;
  twelveData?: any;
  alpacaData?: any;
}

export interface CreateEnrichedDataResponse extends ApiSuccessResponse<EnrichedData> {}

export interface GetEnrichedDataRequest {
  signalId: string;
}

export interface GetEnrichedDataResponse extends ApiSuccessResponse<EnrichedData> {}

export interface UpdateEnrichedDataRequest {
  id: string;
  data: Partial<EnrichedData>;
}

export interface UpdateEnrichedDataResponse extends ApiSuccessResponse<EnrichedData> {}

// ============================================================================
// DECISION ENDPOINTS
// ============================================================================

export interface CreateDecisionRequest {
  signalId: string;
  factors: DecisionFactors;
  modelVersion: string;
}

export interface CreateDecisionResponse extends ApiSuccessResponse<Decision> {}

export interface GetDecisionRequest {
  signalId: string;
}

export interface GetDecisionResponse extends ApiSuccessResponse<Decision> {}

export interface UpdateDecisionRequest {
  id: string;
  data: Partial<Decision>;
}

export interface UpdateDecisionResponse extends ApiSuccessResponse<Decision> {}

export interface MakeDecisionRequest {
  signalId: string;
  overrideFilters?: boolean;
}

export interface MakeDecisionResponse extends ApiSuccessResponse<{
  decision: Decision;
  reasoning: DecisionReasoning;
  trade?: Trade;
}> {}

// ============================================================================
// TRADE ENDPOINTS
// ============================================================================

export interface CreateTradeRequest {
  signalId: string;
  decisionId: string;
  brokerOverride?: string;
}

export interface CreateTradeResponse extends ApiSuccessResponse<Trade> {}

export interface GetTradeRequest {
  id: string;
  includeAnalysis?: boolean;
}

export interface GetTradeResponse extends ApiSuccessResponse<TradeWithAnalysis> {}

export interface ListTradesRequest {
  filters?: TradeFilters;
  pagination?: PaginationParams;
}

export interface ListTradesResponse extends ApiSuccessResponse<PaginatedResponse<TradeWithAnalysis>> {}

export interface UpdateTradeRequest {
  id: string;
  data: Partial<Trade>;
}

export interface UpdateTradeResponse extends ApiSuccessResponse<Trade> {}

export interface CloseTradeRequest {
  id: string;
  reason: string;
  price?: number;
}

export interface CloseTradeResponse extends ApiSuccessResponse<Trade> {}

export interface GetActiveTradesRequest {
  ticker?: string;
}

export interface GetActiveTradesResponse extends ApiSuccessResponse<TradeWithAnalysis[]> {}

// ============================================================================
// TRADE ANALYSIS ENDPOINTS
// ============================================================================

export interface CreateTradeAnalysisRequest {
  tradeId: string;
  forceReanalysis?: boolean;
}

export interface CreateTradeAnalysisResponse extends ApiSuccessResponse<TradeAnalysis> {}

export interface GetTradeAnalysisRequest {
  tradeId: string;
}

export interface GetTradeAnalysisResponse extends ApiSuccessResponse<TradeAnalysis> {}

export interface UpdateTradeAnalysisRequest {
  id: string;
  data: Partial<TradeAnalysis>;
}

export interface UpdateTradeAnalysisResponse extends ApiSuccessResponse<TradeAnalysis> {}

// ============================================================================
// TRADING RULES ENDPOINTS
// ============================================================================

export interface CreateTradingRulesRequest {
  version: string;
  rules: Partial<TradingRules>;
}

export interface CreateTradingRulesResponse extends ApiSuccessResponse<TradingRules> {}

export interface GetTradingRulesRequest {
  version?: string; // If not provided, returns active rules
}

export interface GetTradingRulesResponse extends ApiSuccessResponse<TradingRules> {}

export interface ListTradingRulesRequest {
  includeInactive?: boolean;
}

export interface ListTradingRulesResponse extends ApiSuccessResponse<TradingRules[]> {}

export interface UpdateTradingRulesRequest {
  id: string;
  data: Partial<TradingRules>;
}

export interface UpdateTradingRulesResponse extends ApiSuccessResponse<TradingRules> {}

export interface ActivateTradingRulesRequest {
  version: string;
}

export interface ActivateTradingRulesResponse extends ApiSuccessResponse<TradingRules> {}

export interface OptimizeTradingRulesRequest {
  baseVersion: string;
  optimizationPeriod: {
    startDate: Date;
    endDate: Date;
  };
  targetMetric: 'sharpe' | 'return' | 'winRate' | 'profitFactor';
}

export interface OptimizeTradingRulesResponse extends ApiSuccessResponse<OptimizationResult> {}

// ============================================================================
// MARKET CONTEXT ENDPOINTS
// ============================================================================

export interface CreateMarketContextRequest {
  timestamp: Date;
  data: Partial<MarketContext>;
}

export interface CreateMarketContextResponse extends ApiSuccessResponse<MarketContext> {}

export interface GetMarketContextRequest {
  timestamp?: Date; // If not provided, returns latest
}

export interface GetMarketContextResponse extends ApiSuccessResponse<MarketContext> {}

export interface ListMarketContextRequest {
  dateFrom?: Date;
  dateTo?: Date;
  pagination?: PaginationParams;
}

export interface ListMarketContextResponse extends ApiSuccessResponse<PaginatedResponse<MarketContext>> {}

export interface UpdateMarketContextRequest {
  id: string;
  data: Partial<MarketContext>;
}

export interface UpdateMarketContextResponse extends ApiSuccessResponse<MarketContext> {}

// ============================================================================
// ANALYTICS AND REPORTING ENDPOINTS
// ============================================================================

export interface GetPerformanceMetricsRequest {
  dateFrom?: Date;
  dateTo?: Date;
  ticker?: string;
  instrumentType?: string;
}

export interface GetPerformanceMetricsResponse extends ApiSuccessResponse<PerformanceMetrics> {}

export interface GetTradeStatisticsRequest {
  dateFrom?: Date;
  dateTo?: Date;
  groupBy?: ('instrument' | 'ticker' | 'timeframe' | 'quality' | 'regime' | 'timeOfDay')[];
}

export interface GetTradeStatisticsResponse extends ApiSuccessResponse<TradeStatistics> {}

export interface GetDashboardMetricsRequest {
  // No parameters - returns current dashboard state
}

export interface GetDashboardMetricsResponse extends ApiSuccessResponse<DashboardMetrics> {}

export interface GetSignalFeedRequest {
  limit?: number;
  status?: string[];
}

export interface GetSignalFeedResponse extends ApiSuccessResponse<SignalFeedItem[]> {}

export interface GetPositionSummaryRequest {
  includeHistory?: boolean;
}

export interface GetPositionSummaryResponse extends ApiSuccessResponse<PositionSummary[]> {}

export interface RunBacktestRequest {
  startDate: Date;
  endDate: Date;
  rules: TradingRules;
  initialCapital?: number;
  riskPerTrade?: number;
}

export interface RunBacktestResponse extends ApiSuccessResponse<BacktestResults> {}

// ============================================================================
// LEARNING AND OPTIMIZATION ENDPOINTS
// ============================================================================

export interface GetLearningInsightsRequest {
  dateFrom?: Date;
  dateTo?: Date;
  minTrades?: number;
}

export interface GetLearningInsightsResponse extends ApiSuccessResponse<LearningInsights> {}

export interface ApplyLearningRequest {
  analysisIds: string[];
  createNewRuleVersion?: boolean;
}

export interface ApplyLearningResponse extends ApiSuccessResponse<{
  appliedCount: number;
  newRuleVersion?: TradingRules;
}> {}

export interface GenerateInsightsRequest {
  tradeIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface GenerateInsightsResponse extends ApiSuccessResponse<LearningInsights> {}

// ============================================================================
// EXTERNAL API INTEGRATION ENDPOINTS
// ============================================================================

export interface FetchMarketDataRequest {
  ticker: string;
  dataTypes: ('quote' | 'options' | 'technical' | 'volume')[];
  broker?: string;
}

export interface FetchMarketDataResponse extends ApiSuccessResponse<AggregatedMarketData> {}

export interface ValidateApiKeysRequest {
  broker?: string; // If not provided, validates all
}

export interface ValidateApiKeysResponse extends ApiSuccessResponse<{
  [broker: string]: {
    valid: boolean;
    error?: string;
    rateLimit?: {
      remaining: number;
      resetTime: Date;
    };
  };
}> {}

export interface GetApiStatusRequest {
  // No parameters
}

export interface GetApiStatusResponse extends ApiSuccessResponse<{
  [broker: string]: {
    status: 'online' | 'offline' | 'degraded';
    latency: number;
    lastCheck: Date;
    errorRate: number;
  };
}> {}

// ============================================================================
// NOTIFICATION ENDPOINTS
// ============================================================================

export interface GetNotificationsRequest {
  unreadOnly?: boolean;
  limit?: number;
  type?: string[];
}

export interface GetNotificationsResponse extends ApiSuccessResponse<NotificationMessage[]> {}

export interface MarkNotificationReadRequest {
  id: string;
}

export interface MarkNotificationReadResponse extends ApiSuccessResponse<{ success: boolean }> {}

export interface MarkAllNotificationsReadRequest {
  // No parameters
}

export interface MarkAllNotificationsReadResponse extends ApiSuccessResponse<{ count: number }> {}

export interface CreateNotificationRequest {
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  actionRequired?: boolean;
  relatedEntity?: {
    type: 'signal' | 'trade' | 'decision';
    id: string;
  };
}

export interface CreateNotificationResponse extends ApiSuccessResponse<NotificationMessage> {}

// ============================================================================
// WEBHOOK ENDPOINTS
// ============================================================================

export interface ProcessWebhookRequest {
  payload: any;
  source: 'tradingview' | 'broker' | 'market_data';
  signature?: string;
}

export interface ProcessWebhookResponse extends ApiSuccessResponse<{
  processed: boolean;
  signalId?: string;
  tradeId?: string;
  message: string;
}> {}

export interface ValidateWebhookRequest {
  payload: any;
  source: 'tradingview' | 'broker' | 'market_data';
}

export interface ValidateWebhookResponse extends ApiSuccessResponse<{
  valid: boolean;
  errors?: ValidationError[];
}> {}

// ============================================================================
// SYSTEM ENDPOINTS
// ============================================================================

export interface GetSystemHealthRequest {
  // No parameters
}

export interface GetSystemHealthResponse extends ApiSuccessResponse<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  database: {
    status: 'connected' | 'disconnected';
    latency: number;
  };
  externalApis: {
    [broker: string]: {
      status: 'online' | 'offline';
      latency: number;
    };
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  activeConnections: number;
}> {}

export interface GetSystemConfigRequest {
  // No parameters
}

export interface GetSystemConfigResponse extends ApiSuccessResponse<{
  tradingEnabled: boolean;
  paperTradingMode: boolean;
  maxPositions: number;
  maxRiskPerTrade: number;
  activeBrokers: string[];
  marketHours: {
    start: string;
    end: string;
    timezone: string;
  };
}> {}

export interface UpdateSystemConfigRequest {
  config: {
    tradingEnabled?: boolean;
    paperTradingMode?: boolean;
    maxPositions?: number;
    maxRiskPerTrade?: number;
  };
}

export interface UpdateSystemConfigResponse extends ApiSuccessResponse<{ updated: boolean }> {}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

export interface ValidationErrorResponse extends ApiErrorResponse {
  error: ApiError & {
    code: 'VALIDATION_ERROR';
    details: {
      validationErrors: ValidationError[];
    };
  };
}

export interface BrokerErrorResponse extends ApiErrorResponse {
  error: ApiError & {
    code: 'BROKER_ERROR';
    details: {
      brokerError: BrokerError;
    };
  };
}

export interface RateLimitErrorResponse extends ApiErrorResponse {
  error: ApiError & {
    code: 'RATE_LIMIT_EXCEEDED';
    details: {
      resetTime: Date;
      remaining: number;
    };
  };
}

export interface NotFoundErrorResponse extends ApiErrorResponse {
  error: ApiError & {
    code: 'NOT_FOUND';
    details: {
      resource: string;
      id: string;
    };
  };
}

export interface UnauthorizedErrorResponse extends ApiErrorResponse {
  error: ApiError & {
    code: 'UNAUTHORIZED';
    details: {
      reason: string;
    };
  };
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

export interface WebSocketSubscribeRequest {
  channels: ('signals' | 'trades' | 'notifications' | 'market_data')[];
  filters?: {
    tickers?: string[];
    signalIds?: string[];
    tradeIds?: string[];
  };
}

export interface WebSocketUnsubscribeRequest {
  channels: ('signals' | 'trades' | 'notifications' | 'market_data')[];
}

export interface WebSocketSignalMessage {
  type: 'SIGNAL_UPDATE';
  channel: 'signals';
  data: {
    signalId: string;
    status: string;
    ticker: string;
    action: string;
    quality: number;
    timestamp: Date;
  };
}

export interface WebSocketTradeMessage {
  type: 'TRADE_UPDATE';
  channel: 'trades';
  data: {
    tradeId: string;
    status: string;
    ticker: string;
    pnl?: number;
    pnlPercent?: number;
    timestamp: Date;
  };
}

export interface WebSocketNotificationMessage {
  type: 'NOTIFICATION';
  channel: 'notifications';
  data: NotificationMessage;
}

export interface WebSocketMarketDataMessage {
  type: 'MARKET_UPDATE';
  channel: 'market_data';
  data: {
    ticker: string;
    price: number;
    change: number;
    volume: number;
    timestamp: Date;
  };
}

export type WebSocketMessage = 
  | WebSocketSignalMessage 
  | WebSocketTradeMessage 
  | WebSocketNotificationMessage 
  | WebSocketMarketDataMessage;

// ============================================================================
// UTILITY TYPES FOR API RESPONSES
// ============================================================================

export type ApiEndpointResponse<T> = Promise<ApiSuccessResponse<T> | ApiErrorResponse>;

export interface PaginatedApiResponse<T> extends ApiSuccessResponse<PaginatedResponse<T>> {}

export interface BulkOperationResponse extends ApiSuccessResponse<{
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{
    index: number;
    error: ApiError;
  }>;
}> {}

// ============================================================================
// TYPE GUARDS FOR API RESPONSES
// ============================================================================

export function isApiSuccessResponse<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

export function isApiErrorResponse(response: ApiResponse<any>): response is ApiErrorResponse {
  return response.success === false;
}

export function isValidationErrorResponse(response: ApiResponse<any>): response is ValidationErrorResponse {
  return isApiErrorResponse(response) && response.error.code === 'VALIDATION_ERROR';
}

export function isBrokerErrorResponse(response: ApiResponse<any>): response is BrokerErrorResponse {
  return isApiErrorResponse(response) && response.error.code === 'BROKER_ERROR';
}

export function isRateLimitErrorResponse(response: ApiResponse<any>): response is RateLimitErrorResponse {
  return isApiErrorResponse(response) && response.error.code === 'RATE_LIMIT_EXCEEDED';
}

export function isNotFoundErrorResponse(response: ApiResponse<any>): response is NotFoundErrorResponse {
  return isApiErrorResponse(response) && response.error.code === 'NOT_FOUND';
}

export function isUnauthorizedErrorResponse(response: ApiResponse<any>): response is UnauthorizedErrorResponse {
  return isApiErrorResponse(response) && response.error.code === 'UNAUTHORIZED';
}

// ============================================================================
// HELPER FUNCTIONS FOR API RESPONSES
// ============================================================================

export function createSuccessResponse<T>(data: T, requestId?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    requestId,
  };
}

export function createErrorResponse(error: ApiError, requestId?: string): ApiErrorResponse {
  return {
    success: false,
    error,
    timestamp: new Date(),
    requestId,
  };
}

export function createValidationErrorResponse(
  validationErrors: ValidationError[],
  requestId?: string
): ValidationErrorResponse {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: { validationErrors },
      timestamp: new Date(),
    },
    timestamp: new Date(),
    requestId,
  };
}

export function createBrokerErrorResponse(
  brokerError: BrokerError,
  requestId?: string
): BrokerErrorResponse {
  return {
    success: false,
    error: {
      code: 'BROKER_ERROR',
      message: `Broker error: ${brokerError.message}`,
      details: { brokerError },
      timestamp: new Date(),
    },
    timestamp: new Date(),
    requestId,
  };
}