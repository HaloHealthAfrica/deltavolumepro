// ============================================================================
// TYPE UTILITY FUNCTIONS AND HELPERS
// ============================================================================

import type {
  Signal,
  Trade,
  Decision,
  TradingViewWebhook,
  CreateSignalInput,
  CreateDecisionInput,
  CreateTradeInput,
  SignalStatus,
  DecisionType,
  TradeStatus,
  InstrumentType,
  BrokerType,
  MarketRegime,
  PerformanceMetrics,
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
} from '../types';

// ============================================================================
// TYPE CONVERSION UTILITIES
// ============================================================================

/**
 * Converts TradingView webhook payload to Signal creation input
 */
export function webhookToSignalInput(webhook: TradingViewWebhook): CreateSignalInput {
  return {
    rawPayload: webhook,
    action: webhook.action,
    ticker: webhook.ticker,
    timestamp: BigInt(webhook.timestamp),
    timeframeMinutes: webhook.timeframe_minutes,
    entryPrice: webhook.price.entry,
    quality: webhook.quality,
    
    // Volume data
    zScore: webhook.volume.z_score,
    buyPercent: webhook.volume.buy_percent,
    sellPercent: webhook.volume.sell_percent,
    buyersWinning: webhook.volume.buyers_winning,
    
    // Structure data
    trend: webhook.structure.trend,
    vwapPosition: webhook.structure.vwap_position,
    atAtrLevel: webhook.structure.at_atr_level,
    
    // Oscillator data
    oscillatorValue: webhook.oscillator.value,
    oscillatorPhase: webhook.oscillator.phase,
    compression: webhook.oscillator.compression,
    leavingAccumulation: webhook.oscillator.leaving_accumulation,
    leavingExtremeDown: webhook.oscillator.leaving_extreme_down,
    leavingDistribution: webhook.oscillator.leaving_distribution,
    leavingExtremeUp: webhook.oscillator.leaving_extreme_up,
    
    // Suggested levels
    stopLoss: webhook.suggested_levels.stop_loss,
    target1: webhook.suggested_levels.target_1,
    atr: webhook.suggested_levels.atr,
    
    // Processing status
    status: 'received' as SignalStatus,
  };
}

/**
 * Converts bigint timestamp to Date for API responses
 */
export function bigintToDate(timestamp: bigint): Date {
  return new Date(Number(timestamp));
}

/**
 * Converts Date to bigint timestamp for database storage
 */
export function dateToBigint(date: Date): bigint {
  return BigInt(date.getTime());
}

/**
 * Safely converts string to number with fallback
 */
export function safeParseNumber(value: string | number, fallback: number = 0): number {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely converts string to integer with fallback
 */
export function safeParseInt(value: string | number, fallback: number = 0): number {
  if (typeof value === 'number') return Math.floor(value);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isSignalStatus(value: string): value is SignalStatus {
  return ['received', 'processing', 'enriched', 'traded', 'rejected'].includes(value);
}

export function isDecisionType(value: string): value is DecisionType {
  return ['TRADE', 'REJECT', 'WAIT'].includes(value);
}

export function isTradeStatus(value: string): value is TradeStatus {
  return ['OPEN', 'CLOSED', 'CANCELLED'].includes(value);
}

export function isInstrumentType(value: string): value is InstrumentType {
  return ['STOCK', 'CALL', 'PUT', 'SPREAD'].includes(value);
}

export function isBrokerType(value: string): value is BrokerType {
  return ['tradier', 'twelvedata', 'alpaca'].includes(value);
}

export function isMarketRegime(value: string): value is MarketRegime {
  return ['BULL', 'BEAR', 'NEUTRAL', 'VOLATILE'].includes(value);
}

export function isValidQuality(value: number): value is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isValidTicker(value: string): boolean {
  return /^[A-Z]{1,10}$/.test(value);
}

export function isValidPrice(value: number): boolean {
  return typeof value === 'number' && value > 0 && isFinite(value);
}

export function isValidPercentage(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 100;
}

export function isValidConfidence(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

// ============================================================================
// DATA VALIDATION UTILITIES
// ============================================================================

/**
 * Validates if a signal has all required fields for processing
 */
export function isSignalReadyForProcessing(signal: Signal): boolean {
  return (
    signal.status === 'received' &&
    isValidTicker(signal.ticker) &&
    isValidPrice(signal.entryPrice) &&
    isValidQuality(signal.quality) &&
    Number(signal.timestamp) > 0
  );
}

/**
 * Validates if a decision has all required fields for trade execution
 */
export function isDecisionReadyForTrade(decision: Decision): boolean {
  return (
    decision.decision === 'TRADE' &&
    decision.confidence >= 0.5 &&
    decision.instrumentType !== undefined &&
    decision.quantity !== undefined &&
    decision.quantity > 0 &&
    decision.riskAmount !== undefined &&
    decision.riskAmount > 0
  );
}

/**
 * Validates if trade data is complete
 */
export function isTradeDataComplete(trade: Trade): boolean {
  return (
    isValidTicker(trade.ticker) &&
    isValidPrice(trade.entryPrice) &&
    trade.quantity > 0 &&
    trade.entryValue > 0 &&
    isValidPrice(trade.stopLoss) &&
    isValidPrice(trade.target1)
  );
}

// ============================================================================
// CALCULATION UTILITIES
// ============================================================================

/**
 * Calculates PnL for a trade
 */
export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: 'LONG' | 'SHORT'
): number {
  const priceDiff = side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return priceDiff * quantity;
}

/**
 * Calculates PnL percentage for a trade
 */
export function calculatePnLPercent(
  entryPrice: number,
  exitPrice: number,
  side: 'LONG' | 'SHORT'
): number {
  const priceDiff = side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return (priceDiff / entryPrice) * 100;
}

/**
 * Calculates R-multiple for a trade
 */
export function calculateRMultiple(
  entryPrice: number,
  exitPrice: number,
  stopLoss: number,
  side: 'LONG' | 'SHORT'
): number {
  const actualReturn = side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
  const riskAmount = side === 'LONG' ? entryPrice - stopLoss : stopLoss - entryPrice;
  
  if (riskAmount <= 0) return 0;
  return actualReturn / riskAmount;
}

/**
 * Calculates position size based on risk amount and stop loss
 */
export function calculatePositionSize(
  entryPrice: number,
  stopLoss: number,
  riskAmount: number,
  side: 'LONG' | 'SHORT'
): number {
  const riskPerShare = side === 'LONG' ? entryPrice - stopLoss : stopLoss - entryPrice;
  if (riskPerShare <= 0) return 0;
  return Math.floor(riskAmount / riskPerShare);
}

/**
 * Calculates win rate from performance metrics
 */
export function calculateWinRate(winningTrades: number, totalTrades: number): number {
  if (totalTrades === 0) return 0;
  return (winningTrades / totalTrades) * 100;
}

/**
 * Calculates profit factor from performance metrics
 */
export function calculateProfitFactor(grossProfit: number, grossLoss: number): number {
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return Math.abs(grossProfit / grossLoss);
}

/**
 * Calculates Sharpe ratio
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02
): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  return (avgReturn - riskFreeRate) / stdDev;
}

/**
 * Calculates maximum drawdown from equity curve
 */
export function calculateMaxDrawdown(equityPoints: { equity: number }[]): number {
  if (equityPoints.length === 0) return 0;
  
  let maxDrawdown = 0;
  let peak = equityPoints[0].equity;
  
  for (const point of equityPoints) {
    if (point.equity > peak) {
      peak = point.equity;
    } else {
      const drawdown = (peak - point.equity) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  
  return maxDrawdown * 100; // Return as percentage
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Formats currency values
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formats percentage values
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formats large numbers with appropriate suffixes
 */
export function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  } else if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  } else if (Math.abs(value) >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Formats time duration in human-readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
}

// ============================================================================
// API RESPONSE UTILITIES
// ============================================================================

/**
 * Creates a standardized success response
 */
export function createApiSuccessResponse<T>(data: T, requestId?: string): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    requestId,
  };
}

/**
 * Creates a standardized error response
 */
export function createApiErrorResponse(
  code: string,
  message: string,
  details?: Record<string, any>,
  requestId?: string
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date(),
    },
    timestamp: new Date(),
    requestId,
  };
}

/**
 * Type guard to check if API response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if API response is an error
 */
export function isApiError(response: ApiResponse<any>): response is ApiErrorResponse {
  return response.success === false;
}

// ============================================================================
// DATE AND TIME UTILITIES
// ============================================================================

/**
 * Checks if current time is within trading hours
 */
export function isWithinTradingHours(
  tradingHours: { start: string; end: string; timezone?: string },
  currentTime?: Date
): boolean {
  const now = currentTime || new Date();
  const timezone = tradingHours.timezone || 'America/New_York';
  
  // Convert to trading timezone
  const timeInTradingTz = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  
  const [currentHour, currentMinute] = timeInTradingTz.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;
  
  const [startHour, startMinute] = tradingHours.start.split(':').map(Number);
  const startMinutes = startHour * 60 + startMinute;
  
  const [endHour, endMinute] = tradingHours.end.split(':').map(Number);
  const endMinutes = endHour * 60 + endMinute;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Checks if current date is a trading day (weekday)
 */
export function isTradingDay(date?: Date): boolean {
  const checkDate = date || new Date();
  const dayOfWeek = checkDate.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
}

/**
 * Gets the next trading day
 */
export function getNextTradingDay(date?: Date): Date {
  const nextDay = new Date(date || new Date());
  nextDay.setDate(nextDay.getDate() + 1);
  
  while (!isTradingDay(nextDay)) {
    nextDay.setDate(nextDay.getDate() + 1);
  }
  
  return nextDay;
}

/**
 * Calculates trading days between two dates
 */
export function getTradingDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isTradingDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// ============================================================================
// RISK MANAGEMENT UTILITIES
// ============================================================================

/**
 * Calculates portfolio heat (total risk exposure)
 */
export function calculatePortfolioHeat(
  trades: Array<{ riskAmount: number; status: TradeStatus }>,
  accountValue: number
): number {
  const totalRisk = trades
    .filter(trade => trade.status === 'OPEN')
    .reduce((sum, trade) => sum + trade.riskAmount, 0);
  
  return (totalRisk / accountValue) * 100;
}

/**
 * Checks if adding a new trade would exceed risk limits
 */
export function wouldExceedRiskLimits(
  currentRisk: number,
  newTradeRisk: number,
  maxRiskPercent: number,
  accountValue: number
): boolean {
  const totalRisk = currentRisk + newTradeRisk;
  const riskPercent = (totalRisk / accountValue) * 100;
  return riskPercent > maxRiskPercent;
}

/**
 * Calculates correlation between two ticker symbols based on price movements
 */
export function calculateCorrelation(
  prices1: number[],
  prices2: number[]
): number {
  if (prices1.length !== prices2.length || prices1.length < 2) {
    return 0;
  }
  
  const returns1 = prices1.slice(1).map((price, i) => (price - prices1[i]) / prices1[i]);
  const returns2 = prices2.slice(1).map((price, i) => (price - prices2[i]) / prices2[i]);
  
  const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
  const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;
  
  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;
  
  for (let i = 0; i < returns1.length; i++) {
    const diff1 = returns1[i] - mean1;
    const diff2 = returns2[i] - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }
  
  const denominator = Math.sqrt(sumSq1 * sumSq2);
  return denominator === 0 ? 0 : numerator / denominator;
}

// ============================================================================
// PERFORMANCE ANALYSIS UTILITIES
// ============================================================================

/**
 * Analyzes trade performance by various dimensions
 */
export function analyzeTradePerformance(trades: Trade[]): {
  byQuality: Record<number, PerformanceMetrics>;
  byInstrument: Record<string, PerformanceMetrics>;
  byTimeframe: Record<number, PerformanceMetrics>;
} {
  const groupedTrades = {
    byQuality: {} as Record<number, Trade[]>,
    byInstrument: {} as Record<string, Trade[]>,
    byTimeframe: {} as Record<number, Trade[]>,
  };
  
  // Group trades
  trades.forEach(trade => {
    // By quality (from signal)
    const quality = 3; // Default, should come from signal relation
    if (!groupedTrades.byQuality[quality]) groupedTrades.byQuality[quality] = [];
    groupedTrades.byQuality[quality].push(trade);
    
    // By instrument
    if (!groupedTrades.byInstrument[trade.instrumentType]) {
      groupedTrades.byInstrument[trade.instrumentType] = [];
    }
    groupedTrades.byInstrument[trade.instrumentType].push(trade);
    
    // By timeframe (would need signal relation)
    const timeframe = 15; // Default, should come from signal relation
    if (!groupedTrades.byTimeframe[timeframe]) groupedTrades.byTimeframe[timeframe] = [];
    groupedTrades.byTimeframe[timeframe].push(trade);
  });
  
  // Calculate metrics for each group
  return {
    byQuality: Object.fromEntries(
      Object.entries(groupedTrades.byQuality).map(([key, trades]) => [
        key,
        calculatePerformanceMetrics(trades),
      ])
    ),
    byInstrument: Object.fromEntries(
      Object.entries(groupedTrades.byInstrument).map(([key, trades]) => [
        key,
        calculatePerformanceMetrics(trades),
      ])
    ),
    byTimeframe: Object.fromEntries(
      Object.entries(groupedTrades.byTimeframe).map(([key, trades]) => [
        key,
        calculatePerformanceMetrics(trades),
      ])
    ),
  };
}

/**
 * Calculates comprehensive performance metrics for a set of trades
 */
export function calculatePerformanceMetrics(trades: Trade[]): PerformanceMetrics {
  const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
  
  if (closedTrades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      calmarRatio: 0,
      recoveryFactor: 0,
    };
  }
  
  const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
  const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
  
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
  
  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  
  const returns = closedTrades.map(t => (t.pnlPercent || 0) / 100);
  const winRate = calculateWinRate(winningTrades.length, closedTrades.length);
  const profitFactor = calculateProfitFactor(grossProfit, grossLoss);
  const sharpeRatio = calculateSharpeRatio(returns);
  
  return {
    totalTrades: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    sharpeRatio,
    sortinoRatio: 0, // Would need more complex calculation
    maxDrawdown: 0, // Would need equity curve
    maxDrawdownDuration: 0, // Would need equity curve
    totalReturn: totalPnL,
    annualizedReturn: 0, // Would need time period
    volatility: 0, // Would need more complex calculation
    calmarRatio: 0, // Would need annualized return and max drawdown
    recoveryFactor: 0, // Would need more complex calculation
  };
}