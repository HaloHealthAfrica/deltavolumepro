import { z } from 'zod';

// ============================================================================
// TRADINGVIEW WEBHOOK VALIDATION SCHEMAS
// ============================================================================

export const TradingViewWebhookSchema = z.object({
  action: z.enum(['LONG', 'LONG_PREMIUM', 'SHORT', 'SHORT_PREMIUM']),
  ticker: z.string().min(1).max(10).regex(/^[A-Z]+$/),
  timestamp: z.number().int().positive(),
  timeframe_minutes: z.number().int().positive().max(1440), // Max 1 day
  price: z.object({
    entry: z.number().positive(),
  }),
  volume: z.object({
    z_score: z.number().min(-10).max(10),
    buy_percent: z.number().min(0).max(100),
    sell_percent: z.number().min(0).max(100),
    buyers_winning: z.boolean(),
  }),
  structure: z.object({
    trend: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
    vwap_position: z.enum(['ABOVE', 'BELOW']),
    at_atr_level: z.boolean(),
  }),
  oscillator: z.object({
    value: z.number().min(-150).max(150),
    phase: z.string(),
    compression: z.boolean(),
    leaving_accumulation: z.boolean(),
    leaving_extreme_down: z.boolean(),
    leaving_distribution: z.boolean(),
    leaving_extreme_up: z.boolean(),
  }),
  suggested_levels: z.object({
    stop_loss: z.number().positive(),
    target_1: z.number().positive(),
    atr: z.number().positive(),
  }),
  quality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});

// ============================================================================
// DATABASE MODEL VALIDATION SCHEMAS
// ============================================================================

export const SignalStatusSchema = z.enum(['received', 'processing', 'enriched', 'traded', 'rejected']);
export const DecisionTypeSchema = z.enum(['TRADE', 'REJECT', 'WAIT']);
export const InstrumentTypeSchema = z.enum(['STOCK', 'CALL', 'PUT', 'SPREAD']);
export const BrokerTypeSchema = z.enum(['tradier', 'twelvedata', 'alpaca']);
export const TradeSideSchema = z.enum(['LONG', 'SHORT']);
export const ExitReasonSchema = z.enum(['TARGET_1', 'TARGET_2', 'STOP_LOSS', 'TRAILING', 'MANUAL']);
export const TradeStatusSchema = z.enum(['OPEN', 'CLOSED', 'CANCELLED']);
export const TradeOutcomeSchema = z.enum(['WIN', 'LOSS', 'BREAKEVEN']);
export const MarketRegimeSchema = z.enum(['BULL', 'BEAR', 'NEUTRAL', 'VOLATILE']);
export const VolumeProfileSchema = z.enum(['HIGH', 'NORMAL', 'LOW']);

export const CreateSignalSchema = z.object({
  rawPayload: z.record(z.string(), z.any()),
  action: z.string(),
  ticker: z.string().min(1).max(10),
  timestamp: z.bigint(),
  timeframeMinutes: z.number().int().positive(),
  entryPrice: z.number().positive(),
  quality: z.number().int().min(1).max(5),
  
  // Volume data
  zScore: z.number(),
  buyPercent: z.number().min(0).max(100),
  sellPercent: z.number().min(0).max(100),
  buyersWinning: z.boolean(),
  
  // Structure data
  trend: z.string(),
  vwapPosition: z.string(),
  atAtrLevel: z.boolean(),
  
  // Oscillator data
  oscillatorValue: z.number(),
  oscillatorPhase: z.string(),
  compression: z.boolean(),
  leavingAccumulation: z.boolean().default(false),
  leavingExtremeDown: z.boolean().default(false),
  leavingDistribution: z.boolean().default(false),
  leavingExtremeUp: z.boolean().default(false),
  
  // Suggested levels
  stopLoss: z.number().positive(),
  target1: z.number().positive(),
  atr: z.number().positive(),
  
  // Processing status
  status: SignalStatusSchema,
});

export const CreateEnrichedDataSchema = z.object({
  signalId: z.string().cuid(),
  tradierOptions: z.record(z.string(), z.any()),
  tradierQuote: z.record(z.string(), z.any()),
  tradierGreeks: z.record(z.string(), z.any()),
  twelveQuote: z.record(z.string(), z.any()),
  twelveTechnical: z.record(z.string(), z.any()),
  twelveVolume: z.record(z.string(), z.any()),
  alpacaQuote: z.record(z.string(), z.any()),
  alpacaOptions: z.record(z.string(), z.any()),
  alpacaBars: z.record(z.string(), z.any()),
  aggregatedData: z.record(z.string(), z.any()),
  dataQuality: z.number().min(0).max(1),
});

export const CreateDecisionSchema = z.object({
  signalId: z.string().cuid(),
  decision: DecisionTypeSchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.record(z.string(), z.any()),
  instrumentType: InstrumentTypeSchema.optional(),
  strikes: z.record(z.string(), z.any()).optional(),
  expiration: z.date().optional(),
  quantity: z.number().int().positive().optional(),
  positionSize: z.number().positive().optional(),
  riskAmount: z.number().positive().optional(),
  expectedReturn: z.number().optional(),
  riskRewardRatio: z.number().positive().optional(),
  winProbability: z.number().min(0).max(1).optional(),
  modelVersion: z.string(),
  weights: z.record(z.string(), z.any()),
});

export const CreateTradeSchema = z.object({
  signalId: z.string().cuid(),
  tradeId: z.string(),
  broker: BrokerTypeSchema,
  enteredAt: z.date(),
  instrumentType: z.string(),
  ticker: z.string().min(1).max(10),
  strikes: z.record(z.string(), z.any()).optional(),
  expiration: z.date().optional(),
  side: TradeSideSchema,
  quantity: z.number().int().positive(),
  entryPrice: z.number().positive(),
  entryValue: z.number().positive(),
  stopLoss: z.number().positive(),
  target1: z.number().positive(),
  target2: z.number().positive().optional(),
  trailing: z.boolean().default(false),
  exitedAt: z.date().optional(),
  exitPrice: z.number().positive().optional(),
  exitValue: z.number().positive().optional(),
  exitReason: ExitReasonSchema.optional(),
  pnl: z.number().optional(),
  pnlPercent: z.number().optional(),
  rMultiple: z.number().optional(),
  holdingPeriod: z.number().int().optional(),
  status: TradeStatusSchema,
  brokerData: z.record(z.string(), z.any()),
});

export const CreateTradeAnalysisSchema = z.object({
  tradeId: z.string().cuid(),
  outcome: TradeOutcomeSchema,
  vsExpectation: z.number(),
  signalQuality: z.number().min(0).max(1),
  volumePressure: z.number().min(0).max(1),
  oscillatorPhase: z.number().min(0).max(1),
  marketCondition: z.number().min(0).max(1),
  insights: z.record(z.string(), z.any()),
  improvements: z.record(z.string(), z.any()),
  appliedToModel: z.boolean().default(false),
  appliedAt: z.date().optional(),
});

export const CreateTradingRulesSchema = z.object({
  version: z.string(),
  isActive: z.boolean().default(false),
  qualityWeight: z.number().min(0).max(1).default(0.25),
  volumeWeight: z.number().min(0).max(1).default(0.20),
  oscillatorWeight: z.number().min(0).max(1).default(0.20),
  structureWeight: z.number().min(0).max(1).default(0.20),
  marketWeight: z.number().min(0).max(1).default(0.15),
  minQuality: z.number().int().min(1).max(5).default(4),
  minConfidence: z.number().min(0).max(1).default(0.65),
  minVolumePressure: z.number().min(0).max(100).default(60.0),
  maxRiskPercent: z.number().min(0).max(100).default(2.0),
  baseSizePerQuality: z.record(z.string(), z.any()),
  compressionMultiplier: z.number().min(0).max(2).default(0.5),
  allowedTimeframes: z.record(z.string(), z.any()),
  allowedTickers: z.record(z.string(), z.any()).optional(),
  tradingHours: z.record(z.string(), z.any()),
  learningData: z.record(z.string(), z.any()),
  backtestResults: z.record(z.string(), z.any()).optional(),
});

export const CreateMarketContextSchema = z.object({
  timestamp: z.date(),
  spyPrice: z.number().positive(),
  spyChange: z.number(),
  vixLevel: z.number().positive(),
  regime: MarketRegimeSchema,
  volumeProfile: VolumeProfileSchema,
  sectorLeaders: z.record(z.string(), z.any()),
  sectorLaggards: z.record(z.string(), z.any()),
});

// ============================================================================
// UPDATE SCHEMAS (partial versions)
// ============================================================================

export const UpdateSignalSchema = CreateSignalSchema.partial().extend({
  id: z.string().cuid(),
});

export const UpdateEnrichedDataSchema = CreateEnrichedDataSchema.partial().extend({
  id: z.string().cuid(),
});

export const UpdateDecisionSchema = CreateDecisionSchema.partial().extend({
  id: z.string().cuid(),
});

export const UpdateTradeSchema = CreateTradeSchema.partial().extend({
  id: z.string().cuid(),
});

export const UpdateTradeAnalysisSchema = CreateTradeAnalysisSchema.partial().extend({
  id: z.string().cuid(),
});

export const UpdateTradingRulesSchema = CreateTradingRulesSchema.partial().extend({
  id: z.string().cuid(),
});

export const UpdateMarketContextSchema = CreateMarketContextSchema.partial().extend({
  id: z.string().cuid(),
});

// ============================================================================
// QUERY AND FILTER SCHEMAS
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const SignalFiltersSchema = z.object({
  status: z.array(SignalStatusSchema).optional(),
  ticker: z.array(z.string()).optional(),
  quality: z.array(z.number().int().min(1).max(5)).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  action: z.array(z.string()).optional(),
});

export const TradeFiltersSchema = z.object({
  status: z.array(TradeStatusSchema).optional(),
  ticker: z.array(z.string()).optional(),
  broker: z.array(BrokerTypeSchema).optional(),
  instrumentType: z.array(z.string()).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  outcome: z.array(TradeOutcomeSchema).optional(),
});

// ============================================================================
// EXTERNAL API VALIDATION SCHEMAS
// ============================================================================

export const TradierQuoteSchema = z.object({
  symbol: z.string(),
  description: z.string(),
  exch: z.string(),
  type: z.string(),
  last: z.number(),
  change: z.number(),
  volume: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  bid: z.number(),
  ask: z.number(),
  underlying: z.string().optional(),
  strike: z.number().optional(),
  expiration_date: z.string().optional(),
  expiration_type: z.string().optional(),
  option_type: z.string().optional(),
  contract_size: z.number().optional(),
  average_volume: z.number().optional(),
});

export const TradierOptionContractSchema = z.object({
  symbol: z.string(),
  description: z.string(),
  exch: z.string(),
  type: z.string(),
  last: z.number(),
  change: z.number(),
  volume: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  bid: z.number(),
  ask: z.number(),
  underlying: z.string(),
  strike: z.number(),
  expiration_date: z.string(),
  expiration_type: z.string(),
  option_type: z.string(),
  contract_size: z.number(),
  open_interest: z.number(),
  bid_size: z.number(),
  ask_size: z.number(),
  average_volume: z.number(),
  trade_date: z.number(),
  prevclose: z.number(),
  week_52_high: z.number(),
  week_52_low: z.number(),
  bidexch: z.string(),
  bid_date: z.number(),
  askexch: z.string(),
  ask_date: z.number(),
  implied_volatility: z.number(),
  delta: z.number(),
  gamma: z.number(),
  theta: z.number(),
  vega: z.number(),
  rho: z.number(),
});

export const TwelveDataQuoteSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  exchange: z.string(),
  mic_code: z.string(),
  currency: z.string(),
  datetime: z.string(),
  timestamp: z.number(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
  previous_close: z.string(),
  change: z.string(),
  percent_change: z.string(),
  average_volume: z.string(),
  is_market_open: z.boolean(),
  fifty_two_week: z.object({
    low: z.string(),
    high: z.string(),
    low_change: z.string(),
    high_change: z.string(),
    low_change_percent: z.string(),
    high_change_percent: z.string(),
    range: z.string(),
  }),
});

export const AlpacaQuoteSchema = z.object({
  symbol: z.string(),
  bid: z.number(),
  ask: z.number(),
  bid_size: z.number(),
  ask_size: z.number(),
  timestamp: z.string(),
  timeframe: z.string(),
});

export const AlpacaBarSchema = z.object({
  t: z.string(), // timestamp
  o: z.number(), // open
  h: z.number(), // high
  l: z.number(), // low
  c: z.number(), // close
  v: z.number(), // volume
  n: z.number(), // trade count
  vw: z.number(), // volume weighted average price
});

// ============================================================================
// DECISION ENGINE VALIDATION SCHEMAS
// ============================================================================

export const DecisionFactorsSchema = z.object({
  signalQuality: z.number().min(1).max(5),
  volumePressure: z.number().min(0).max(100),
  oscillatorPhase: z.number().min(-150).max(150),
  structureAlignment: z.number().min(0).max(1),
  priceConfirmation: z.number().min(0).max(1),
  volumeConfirmation: z.number().min(0).max(1),
  technicalConfirmation: z.number().min(0).max(1),
  optionsActivity: z.number().min(0).max(1),
  spreadQuality: z.number().min(0).max(1),
  marketRegime: MarketRegimeSchema,
  accountRisk: z.number().min(0).max(100),
  timeOfDay: z.number().min(0).max(1),
});

export const FilterResultsSchema = z.object({
  minQuality: z.boolean(),
  minVolumePressure: z.boolean(),
  allowedTimeframe: z.boolean(),
  allowedTicker: z.boolean(),
  tradingHours: z.boolean(),
  maxRiskNotExceeded: z.boolean(),
  marketRegimeAllowed: z.boolean(),
  liquidityAdequate: z.boolean(),
});

export const TradeParametersSchema = z.object({
  instrumentType: InstrumentTypeSchema,
  strikes: z.object({
    long: z.number().optional(),
    short: z.number().optional(),
  }).optional(),
  expiration: z.date().optional(),
  quantity: z.number().int().positive(),
  riskAmount: z.number().positive(),
  positionSize: z.number().positive(),
  stopLoss: z.number().positive(),
  target1: z.number().positive(),
  target2: z.number().positive().optional(),
});

export const ExpectedTradeMetricsSchema = z.object({
  expectedReturn: z.number(),
  riskRewardRatio: z.number().positive(),
  winProbability: z.number().min(0).max(1),
  maxLoss: z.number().negative(),
  breakeven: z.number().positive(),
  timeDecay: z.number().optional(),
  deltaExposure: z.number().optional(),
});

export const RiskAssessmentSchema = z.object({
  portfolioHeatLevel: z.number().min(0).max(1),
  correlationRisk: z.number().min(0).max(1),
  concentrationRisk: z.number().min(0).max(1),
  liquidityRisk: z.number().min(0).max(1),
  overallRiskScore: z.number().min(0).max(1),
  recommendations: z.array(z.string()),
});

// ============================================================================
// WEBSOCKET MESSAGE VALIDATION SCHEMAS
// ============================================================================

export const WebSocketMessageSchema = z.object({
  type: z.enum(['SIGNAL_UPDATE', 'TRADE_UPDATE', 'PNL_UPDATE', 'NOTIFICATION', 'MARKET_UPDATE']),
  payload: z.any(),
  timestamp: z.date(),
});

export const SignalUpdateSchema = z.object({
  type: z.enum(['SIGNAL_RECEIVED', 'SIGNAL_PROCESSED', 'DECISION_MADE', 'TRADE_EXECUTED']),
  signalId: z.string().cuid(),
  data: z.record(z.string(), z.any()),
});

export const TradeUpdateSchema = z.object({
  type: z.enum(['TRADE_OPENED', 'TRADE_CLOSED', 'STOP_MOVED', 'TARGET_HIT']),
  tradeId: z.string().cuid(),
  data: z.record(z.string(), z.any()),
});

export const NotificationMessageSchema = z.object({
  id: z.string().cuid(),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']),
  title: z.string(),
  message: z.string(),
  timestamp: z.date(),
  read: z.boolean().default(false),
  actionRequired: z.boolean().optional(),
  relatedEntity: z.object({
    type: z.enum(['signal', 'trade', 'decision']),
    id: z.string().cuid(),
  }).optional(),
});

// ============================================================================
// CONFIGURATION VALIDATION SCHEMAS
// ============================================================================

export const RiskManagementConfigSchema = z.object({
  maxRiskPerTrade: z.number().min(0).max(100),
  maxPortfolioRisk: z.number().min(0).max(100),
  maxPositions: z.number().int().positive(),
  maxCorrelatedPositions: z.number().int().positive(),
  stopLossMultiplier: z.number().positive(),
  trailingStopEnabled: z.boolean(),
  positionSizingMethod: z.enum(['FIXED', 'PERCENT_RISK', 'KELLY', 'OPTIMAL_F']),
});

export const BrokerApiConfigSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().optional(),
  secretKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  rateLimit: z.number().int().positive(),
  timeout: z.number().int().positive(),
});

export const BrokerSettingsSchema = z.object({
  primary: BrokerTypeSchema,
  backup: BrokerTypeSchema.optional(),
  paperTrading: z.boolean(),
  slippage: z.number().min(0).max(1),
  commission: z.number().min(0),
  apiKeys: z.record(BrokerTypeSchema, BrokerApiConfigSchema),
});

export const NotificationSettingsSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  webhook: z.boolean(),
  discord: z.boolean(),
  slack: z.boolean(),
  filters: z.object({
    minTradeValue: z.number().min(0),
    criticalErrorsOnly: z.boolean(),
    tradingHoursOnly: z.boolean(),
  }),
});

// ============================================================================
// UTILITY VALIDATION FUNCTIONS
// ============================================================================

export function validateTradingViewWebhook(data: unknown) {
  return TradingViewWebhookSchema.safeParse(data);
}

export function validateSignalCreate(data: unknown) {
  return CreateSignalSchema.safeParse(data);
}

export function validateDecisionCreate(data: unknown) {
  return CreateDecisionSchema.safeParse(data);
}

export function validateTradeCreate(data: unknown) {
  return CreateTradeSchema.safeParse(data);
}

export function validatePagination(data: unknown) {
  return PaginationSchema.safeParse(data);
}

export function validateSignalFilters(data: unknown) {
  return SignalFiltersSchema.safeParse(data);
}

export function validateTradeFilters(data: unknown) {
  return TradeFiltersSchema.safeParse(data);
}

// ============================================================================
// CUSTOM VALIDATION HELPERS
// ============================================================================

export const TickerSymbolSchema = z.string()
  .min(1)
  .max(10)
  .regex(/^[A-Z]+$/, 'Ticker must be uppercase letters only');

export const PriceSchema = z.number()
  .positive('Price must be positive')
  .finite('Price must be finite')
  .refine((val) => val < 1000000, 'Price seems unreasonably high');

export const PercentageSchema = z.number()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100');

export const ConfidenceSchema = z.number()
  .min(0, 'Confidence cannot be negative')
  .max(1, 'Confidence cannot exceed 1');

export const QualityScoreSchema = z.number()
  .int('Quality must be an integer')
  .min(1, 'Quality must be at least 1')
  .max(5, 'Quality cannot exceed 5');

// Date validation helpers
export const FutureDateSchema = z.date()
  .refine((date) => date > new Date(), 'Date must be in the future');

export const PastDateSchema = z.date()
  .refine((date) => date <= new Date(), 'Date cannot be in the future');

export const TradingHoursSchema = z.object({
  start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  timezone: z.string().default('America/New_York'),
}).refine((data) => {
  const start = new Date(`2000-01-01T${data.start}:00`);
  const end = new Date(`2000-01-01T${data.end}:00`);
  return start < end;
}, 'Start time must be before end time');

// Strike price validation for options
export const StrikeSelectionSchema = z.object({
  long: z.number().positive().optional(),
  short: z.number().positive().optional(),
}).refine((data) => {
  if (data.long && data.short) {
    return data.long !== data.short;
  }
  return true;
}, 'Long and short strikes must be different');

// Risk validation
export const RiskAmountSchema = z.number()
  .positive('Risk amount must be positive')
  .max(100000, 'Risk amount seems unreasonably high');

// Position size validation
export const PositionSizeSchema = z.number()
  .positive('Position size must be positive')
  .max(1000000, 'Position size seems unreasonably high');

// Quantity validation
export const QuantitySchema = z.number()
  .int('Quantity must be an integer')
  .positive('Quantity must be positive')
  .max(10000, 'Quantity seems unreasonably high');