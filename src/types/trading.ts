// ============================================================================
// DATABASE MODEL INTERFACES (matching Prisma schema)
// ============================================================================

export interface Signal {
  id: string;
  createdAt: Date;
  
  // Raw signal data
  rawPayload: Record<string, any>;
  action: string;
  ticker: string;
  timestamp: bigint;
  timeframeMinutes: number;
  entryPrice: number;
  quality: number;
  
  // Volume data
  zScore: number;
  buyPercent: number;
  sellPercent: number;
  buyersWinning: boolean;
  
  // Structure data
  trend: string;
  vwapPosition: string;
  atAtrLevel: boolean;
  
  // Oscillator data
  oscillatorValue: number;
  oscillatorPhase: string;
  compression: boolean;
  leavingAccumulation: boolean;
  leavingExtremeDown: boolean;
  leavingDistribution: boolean;
  leavingExtremeUp: boolean;
  
  // Suggested levels
  stopLoss: number;
  target1: number;
  atr: number;
  
  // Processing status
  status: SignalStatus;
  
  // Relations
  enrichedData?: EnrichedData;
  decision?: Decision;
  trades: Trade[];
}

export interface EnrichedData {
  id: string;
  createdAt: Date;
  signalId: string;
  
  // Data from external APIs
  tradierOptions: Record<string, any>;
  tradierQuote: Record<string, any>;
  tradierGreeks: Record<string, any>;
  
  twelveQuote: Record<string, any>;
  twelveTechnical: Record<string, any>;
  twelveVolume: Record<string, any>;
  
  alpacaQuote: Record<string, any>;
  alpacaOptions: Record<string, any>;
  alpacaBars: Record<string, any>;
  
  // Aggregated analysis
  aggregatedData: Record<string, any>;
  dataQuality: number;
  
  // Relations
  signal: Signal;
}

export interface Decision {
  id: string;
  createdAt: Date;
  signalId: string;
  
  // Decision outcome
  decision: DecisionType;
  confidence: number;
  reasoning: Record<string, any>;
  
  // Trade parameters (if decision = 'TRADE')
  instrumentType?: InstrumentType;
  strikes?: Record<string, any>;
  expiration?: Date;
  quantity?: number;
  positionSize?: number;
  riskAmount?: number;
  
  // Risk metrics
  expectedReturn?: number;
  riskRewardRatio?: number;
  winProbability?: number;
  
  // Model weights used
  modelVersion: string;
  weights: Record<string, any>;
  
  // Relations
  signal: Signal;
}

export interface Trade {
  id: string;
  createdAt: Date;
  signalId: string;
  
  // Trade identification
  tradeId: string;
  broker: BrokerType;
  
  // Entry details
  enteredAt: Date;
  instrumentType: string;
  ticker: string;
  strikes?: Record<string, any>;
  expiration?: Date;
  side: TradeSide;
  quantity: number;
  entryPrice: number;
  entryValue: number;
  
  // Risk management
  stopLoss: number;
  target1: number;
  target2?: number;
  trailing: boolean;
  
  // Exit details
  exitedAt?: Date;
  exitPrice?: number;
  exitValue?: number;
  exitReason?: ExitReason;
  
  // Performance
  pnl?: number;
  pnlPercent?: number;
  rMultiple?: number;
  holdingPeriod?: number;
  
  // Status
  status: TradeStatus;
  
  // Broker data
  brokerData: Record<string, any>;
  
  // Relations
  signal: Signal;
  analysis?: TradeAnalysis;
}

export interface TradeAnalysis {
  id: string;
  createdAt: Date;
  tradeId: string;
  
  // Analysis results
  outcome: TradeOutcome;
  vsExpectation: number;
  
  // Feature importance
  signalQuality: number;
  volumePressure: number;
  oscillatorPhase: number;
  marketCondition: number;
  
  // Lessons learned
  insights: Record<string, any>;
  improvements: Record<string, any>;
  
  // Applied to model
  appliedToModel: boolean;
  appliedAt?: Date;
  
  // Relations
  trade: Trade;
}

export interface TradingRules {
  id: string;
  version: string;
  createdAt: Date;
  isActive: boolean;
  
  // Rule weights
  qualityWeight: number;
  volumeWeight: number;
  oscillatorWeight: number;
  structureWeight: number;
  marketWeight: number;
  
  // Thresholds
  minQuality: number;
  minConfidence: number;
  minVolumePressure: number;
  maxRiskPercent: number;
  
  // Position sizing rules
  baseSizePerQuality: Record<string, any>;
  compressionMultiplier: number;
  
  // Filters
  allowedTimeframes: Record<string, any>;
  allowedTickers?: Record<string, any>;
  tradingHours: Record<string, any>;
  
  // Performance tracking
  tradesExecuted: number;
  winRate?: number;
  avgReturn?: number;
  sharpeRatio?: number;
  
  // Learning metadata
  learningData: Record<string, any>;
  backtestResults?: Record<string, any>;
}

export interface MarketContext {
  id: string;
  timestamp: Date;
  
  // Broad market
  spyPrice: number;
  spyChange: number;
  vixLevel: number;
  
  // Market regime
  regime: MarketRegime;
  volumeProfile: VolumeProfile;
  
  // Sector rotation
  sectorLeaders: Record<string, any>;
  sectorLaggards: Record<string, any>;
}

// ============================================================================
// ENUMS AND UNION TYPES
// ============================================================================

export type SignalStatus = 'received' | 'processing' | 'enriched' | 'traded' | 'rejected';
export type DecisionType = 'TRADE' | 'REJECT' | 'WAIT';
export type InstrumentType = 'STOCK' | 'CALL' | 'PUT' | 'SPREAD';
export type BrokerType = 'tradier' | 'twelvedata' | 'alpaca';
export type TradeSide = 'LONG' | 'SHORT';
export type ExitReason = 'TARGET_1' | 'TARGET_2' | 'STOP_LOSS' | 'TRAILING' | 'MANUAL';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';
export type TradeOutcome = 'WIN' | 'LOSS' | 'BREAKEVEN';
export type MarketRegime = 'BULL' | 'BEAR' | 'NEUTRAL' | 'VOLATILE';
export type VolumeProfile = 'HIGH' | 'NORMAL' | 'LOW';

// ============================================================================
// TRADINGVIEW WEBHOOK TYPES
// ============================================================================

export interface TradingViewWebhook {
  action: 'LONG' | 'LONG_PREMIUM' | 'SHORT' | 'SHORT_PREMIUM';
  ticker: string;
  timestamp: number;
  timeframe_minutes: number;
  price: {
    entry: number;
  };
  volume: {
    z_score: number;
    buy_percent: number;
    sell_percent: number;
    buyers_winning: boolean;
  };
  structure: {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    vwap_position: 'ABOVE' | 'BELOW';
    at_atr_level: boolean;
  };
  oscillator: {
    value: number;
    phase: string;
    compression: boolean;
    leaving_accumulation: boolean;
    leaving_extreme_down: boolean;
    leaving_distribution: boolean;
    leaving_extreme_up: boolean;
  };
  suggested_levels: {
    stop_loss: number;
    target_1: number;
    atr: number;
  };
  quality: 1 | 2 | 3 | 4 | 5;
}

// ============================================================================
// UTILITY TYPES FOR CRUD OPERATIONS
// ============================================================================

// Create types (omit auto-generated fields)
export type CreateSignalInput = Omit<Signal, 'id' | 'createdAt' | 'enrichedData' | 'decision' | 'trades'>;
export type CreateEnrichedDataInput = Omit<EnrichedData, 'id' | 'createdAt' | 'signal'>;
export type CreateDecisionInput = Omit<Decision, 'id' | 'createdAt' | 'signal'>;
export type CreateTradeInput = Omit<Trade, 'id' | 'createdAt' | 'signal' | 'analysis'>;
export type CreateTradeAnalysisInput = Omit<TradeAnalysis, 'id' | 'createdAt' | 'trade'>;
export type CreateTradingRulesInput = Omit<TradingRules, 'id' | 'createdAt' | 'tradesExecuted' | 'winRate' | 'avgReturn' | 'sharpeRatio'>;
export type CreateMarketContextInput = Omit<MarketContext, 'id'>;

// Update types (make all fields optional except id)
export type UpdateSignalInput = Partial<Omit<Signal, 'id' | 'createdAt'>> & { id: string };
export type UpdateEnrichedDataInput = Partial<Omit<EnrichedData, 'id' | 'createdAt'>> & { id: string };
export type UpdateDecisionInput = Partial<Omit<Decision, 'id' | 'createdAt'>> & { id: string };
export type UpdateTradeInput = Partial<Omit<Trade, 'id' | 'createdAt'>> & { id: string };
export type UpdateTradeAnalysisInput = Partial<Omit<TradeAnalysis, 'id' | 'createdAt'>> & { id: string };
export type UpdateTradingRulesInput = Partial<Omit<TradingRules, 'id' | 'createdAt'>> & { id: string };
export type UpdateMarketContextInput = Partial<Omit<MarketContext, 'id'>> & { id: string };

// Query types with relations
export interface SignalWithRelations extends Signal {
  enrichedData?: EnrichedData;
  decision?: Decision;
  trades: TradeWithAnalysis[];
}

export interface TradeWithAnalysis extends Trade {
  analysis?: TradeAnalysis;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Filter types
export interface SignalFilters {
  status?: SignalStatus[];
  ticker?: string[];
  quality?: number[];
  dateFrom?: Date;
  dateTo?: Date;
  action?: string[];
}

export interface TradeFilters {
  status?: TradeStatus[];
  ticker?: string[];
  broker?: BrokerType[];
  instrumentType?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  outcome?: TradeOutcome[];
}

// ============================================================================
// EXTERNAL API DATA TYPES
// ============================================================================

export interface TradierQuoteData {
  symbol: string;
  description: string;
  exch: string;
  type: string;
  last: number;
  change: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bid: number;
  ask: number;
  underlying?: string;
  strike?: number;
  expiration_date?: string;
  expiration_type?: string;
  option_type?: string;
  contract_size?: number;
  average_volume?: number;
}

export interface TradierOptionsChain {
  symbol: string;
  expiration: string;
  options: {
    option: TradierOptionContract[];
  };
}

export interface TradierOptionContract {
  symbol: string;
  description: string;
  exch: string;
  type: string;
  last: number;
  change: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bid: number;
  ask: number;
  underlying: string;
  strike: number;
  expiration_date: string;
  expiration_type: string;
  option_type: string;
  contract_size: number;
  open_interest: number;
  bid_size: number;
  ask_size: number;
  average_volume: number;
  trade_date: number;
  prevclose: number;
  week_52_high: number;
  week_52_low: number;
  bidexch: string;
  bid_date: number;
  askexch: string;
  ask_date: number;
  implied_volatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  mic_code: string;
  currency: string;
  datetime: string;
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  previous_close: string;
  change: string;
  percent_change: string;
  average_volume: string;
  is_market_open: boolean;
  fifty_two_week: {
    low: string;
    high: string;
    low_change: string;
    high_change: string;
    low_change_percent: string;
    high_change_percent: string;
    range: string;
  };
}

export interface TwelveDataTechnicalIndicators {
  symbol: string;
  datetime: string;
  rsi: number;
  adx: number;
  cci: number;
  aroon: {
    aroon_up: number;
    aroon_down: number;
    aroon_oscillator: number;
  };
  bbands: {
    upper_band: number;
    middle_band: number;
    lower_band: number;
  };
  macd: {
    macd: number;
    macd_signal: number;
    macd_histogram: number;
  };
  stoch: {
    slow_k: number;
    slow_d: number;
  };
}

export interface AlpacaQuote {
  symbol: string;
  bid: number;
  ask: number;
  bid_size: number;
  ask_size: number;
  timestamp: string;
  timeframe: string;
}

export interface AlpacaBar {
  t: string; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  n: number; // trade count
  vw: number; // volume weighted average price
}

export interface AlpacaOptionContract {
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  expiration_date: string;
  root_symbol: string;
  underlying_symbol: string;
  underlying_asset_id: string;
  type: string;
  style: string;
  strike_price: string;
  multiplier: string;
  size: string;
  open_interest: string;
  open_interest_date: string;
  close_price: string;
  close_price_date: string;
}

// ============================================================================
// AGGREGATED INSIGHTS AND ANALYSIS TYPES
// ============================================================================

export interface AggregatedMarketData {
  confirmedPrice: number;
  priceConsistency: number; // 0-1 score across APIs
  volumeConfirmation: number; // 0-1 score
  technicalAlignment: number; // 0-1 score
  optionsFlow: OptionsFlowAnalysis;
  spreadAnalysis: SpreadAnalysis;
  ivAnalysis: ImpliedVolatilityAnalysis;
  marketRegimeScore: number; // 0-1 alignment with current regime
}

export interface OptionsFlowAnalysis {
  callPutRatio: number;
  unusualActivity: boolean;
  largeBlockTrades: number;
  netFlow: number; // positive = bullish, negative = bearish
  ivSkew: number;
  termStructure: number[];
}

export interface SpreadAnalysis {
  averageSpread: number;
  spreadPercent: number;
  liquidityScore: number; // 0-1
  marketMakerPresence: number; // 0-1
}

export interface ImpliedVolatilityAnalysis {
  currentIV: number;
  ivRank: number; // 0-100
  ivPercentile: number; // 0-100
  hvIvRatio: number; // historical vs implied
  ivTrend: 'RISING' | 'FALLING' | 'STABLE';
  termStructure: IVTermPoint[];
}

export interface IVTermPoint {
  expiration: string;
  daysToExpiry: number;
  iv: number;
}

// ============================================================================
// DECISION ENGINE TYPES
// ============================================================================

export interface DecisionFactors {
  signalQuality: number;      // 1-5 from webhook
  volumePressure: number;     // 0-100 from webhook
  oscillatorPhase: number;    // -150 to +150 from webhook
  structureAlignment: number; // 0-1 calculated
  priceConfirmation: number;  // 0-1 from API consistency
  volumeConfirmation: number; // 0-1 from API data
  technicalConfirmation: number; // 0-1 from indicators
  optionsActivity: number;    // 0-1 from options flow
  spreadQuality: number;      // 0-1 from bid/ask spreads
  marketRegime: MarketRegime;
  accountRisk: number;        // Current exposure percentage
  timeOfDay: number;          // 0-1 trading session factor
}

export interface DecisionReasoning {
  factors: DecisionFactors;
  weightedScore: number;
  filters: FilterResults;
  tradeParams?: TradeParameters;
  expectedMetrics?: ExpectedTradeMetrics;
  riskAssessment: RiskAssessment;
}

export interface FilterResults {
  minQuality: boolean;
  minVolumePressure: boolean;
  allowedTimeframe: boolean;
  allowedTicker: boolean;
  tradingHours: boolean;
  maxRiskNotExceeded: boolean;
  marketRegimeAllowed: boolean;
  liquidityAdequate: boolean;
}

export interface TradeParameters {
  instrumentType: InstrumentType;
  strikes?: StrikeSelection;
  expiration?: Date;
  quantity: number;
  riskAmount: number;
  positionSize: number;
  stopLoss: number;
  target1: number;
  target2?: number;
}

export interface StrikeSelection {
  long?: number;
  short?: number;
}

export interface ExpectedTradeMetrics {
  expectedReturn: number;
  riskRewardRatio: number;
  winProbability: number;
  maxLoss: number;
  breakeven: number;
  timeDecay?: number; // for options
  deltaExposure?: number; // for options
}

export interface RiskAssessment {
  portfolioHeatLevel: number; // 0-1
  correlationRisk: number; // 0-1
  concentrationRisk: number; // 0-1
  liquidityRisk: number; // 0-1
  overallRiskScore: number; // 0-1
  recommendations: string[];
}

// ============================================================================
// PERFORMANCE AND ANALYTICS TYPES
// ============================================================================

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  calmarRatio: number;
  recoveryFactor: number;
}

export interface TradeStatistics {
  byInstrument: Record<InstrumentType, PerformanceMetrics>;
  byTicker: Record<string, PerformanceMetrics>;
  byTimeframe: Record<number, PerformanceMetrics>;
  byQuality: Record<number, PerformanceMetrics>;
  byMarketRegime: Record<MarketRegime, PerformanceMetrics>;
  byTimeOfDay: Record<string, PerformanceMetrics>;
}

export interface EquityCurvePoint {
  timestamp: Date;
  equity: number;
  drawdown: number;
  tradeCount: number;
}

export interface BacktestConfiguration {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  riskPerTrade: number;
  maxPositions: number;
  rules: TradingRules;
  slippage: number;
  commission: number;
}

export interface BacktestResults {
  configuration: BacktestConfiguration;
  performance: PerformanceMetrics;
  statistics: TradeStatistics;
  equityCurve: EquityCurvePoint[];
  trades: BacktestTrade[];
  monthlyReturns: MonthlyReturn[];
}

export interface BacktestTrade {
  entryDate: Date;
  exitDate: Date;
  ticker: string;
  side: TradeSide;
  instrumentType: InstrumentType;
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  holdingPeriod: number;
  exitReason: ExitReason;
  signalQuality: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
  trades: number;
  winRate: number;
}

// ============================================================================
// LEARNING AND OPTIMIZATION TYPES
// ============================================================================

export interface FeatureImportance {
  signalQuality: number;
  volumePressure: number;
  oscillatorPhase: number;
  marketCondition: number;
  timeOfDay: number;
  technicalAlignment: number;
  optionsFlow: number;
  spreadQuality: number;
}

export interface ModelWeights {
  qualityWeight: number;
  volumeWeight: number;
  oscillatorWeight: number;
  structureWeight: number;
  marketWeight: number;
  technicalWeight: number;
  optionsWeight: number;
  liquidityWeight: number;
}

export interface OptimizationResult {
  originalWeights: ModelWeights;
  optimizedWeights: ModelWeights;
  improvement: number; // percentage improvement
  backtestComparison: {
    original: PerformanceMetrics;
    optimized: PerformanceMetrics;
  };
  confidence: number; // 0-1
}

export interface LearningInsights {
  patterns: TradingPattern[];
  recommendations: string[];
  warnings: string[];
  marketRegimeInsights: Record<MarketRegime, string[]>;
  instrumentInsights: Record<InstrumentType, string[]>;
}

export interface TradingPattern {
  name: string;
  description: string;
  conditions: Record<string, any>;
  performance: PerformanceMetrics;
  frequency: number;
  confidence: number;
}

// ============================================================================
// REAL-TIME DATA AND WEBSOCKET TYPES
// ============================================================================

export interface WebSocketMessage {
  type: 'SIGNAL_UPDATE' | 'TRADE_UPDATE' | 'PNL_UPDATE' | 'NOTIFICATION' | 'MARKET_UPDATE';
  payload: any;
  timestamp: Date;
}

export interface SignalUpdate {
  type: 'SIGNAL_RECEIVED' | 'SIGNAL_PROCESSED' | 'DECISION_MADE' | 'TRADE_EXECUTED';
  signalId: string;
  data: Partial<Signal>;
}

export interface TradeUpdate {
  type: 'TRADE_OPENED' | 'TRADE_CLOSED' | 'STOP_MOVED' | 'TARGET_HIT';
  tradeId: string;
  data: Partial<Trade>;
}

export interface PnLUpdate {
  totalPnL: number;
  dailyPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positions: PositionSummary[];
}

export interface PositionSummary {
  id: string;
  ticker: string;
  side: TradeSide;
  instrumentType: InstrumentType;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  daysHeld: number;
  broker: BrokerType;
  riskAmount: number;
}

export interface NotificationMessage {
  id: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionRequired?: boolean;
  relatedEntity?: {
    type: 'signal' | 'trade' | 'decision';
    id: string;
  };
}

// ============================================================================
// DASHBOARD AND UI TYPES
// ============================================================================

export interface DashboardMetrics {
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  dailyPnL: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  activePositions: number;
  todayTrades: number;
  weeklyTrades: number;
  monthlyTrades: number;
  accountValue: number;
  buyingPower: number;
  riskUtilization: number;
}

export interface SignalFeedItem {
  id: string;
  timestamp: Date;
  ticker: string;
  action: string;
  quality: number;
  confidence?: number;
  decision: DecisionType;
  reasoning?: string;
  status: SignalStatus;
  entryPrice: number;
  currentPrice?: number;
  pnl?: number;
}

export interface TradingCalendar {
  date: Date;
  trades: number;
  pnl: number;
  winRate: number;
  isMarketOpen: boolean;
  marketEvents: MarketEvent[];
}

export interface MarketEvent {
  type: 'EARNINGS' | 'DIVIDEND' | 'SPLIT' | 'ECONOMIC' | 'FED';
  ticker?: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  time?: string;
}

// ============================================================================
// ERROR AND VALIDATION TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

export interface BrokerError {
  broker: BrokerType;
  code: string;
  message: string;
  originalError: any;
  retryable: boolean;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface TradingConfiguration {
  rules: TradingRules;
  riskManagement: RiskManagementConfig;
  brokerSettings: BrokerSettings;
  notifications: NotificationSettings;
  backtesting: BacktestConfiguration;
}

export interface RiskManagementConfig {
  maxRiskPerTrade: number;
  maxPortfolioRisk: number;
  maxPositions: number;
  maxCorrelatedPositions: number;
  stopLossMultiplier: number;
  trailingStopEnabled: boolean;
  positionSizingMethod: 'FIXED' | 'PERCENT_RISK' | 'KELLY' | 'OPTIMAL_F';
}

export interface BrokerSettings {
  primary: BrokerType;
  backup?: BrokerType;
  paperTrading: boolean;
  slippage: number;
  commission: number;
  apiKeys: Record<BrokerType, BrokerApiConfig>;
}

export interface BrokerApiConfig {
  enabled: boolean;
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
  rateLimit: number;
  timeout: number;
}

export interface NotificationSettings {
  email: boolean;
  sms: boolean;
  webhook: boolean;
  discord: boolean;
  slack: boolean;
  filters: {
    minTradeValue: number;
    criticalErrorsOnly: boolean;
    tradingHoursOnly: boolean;
  };
}