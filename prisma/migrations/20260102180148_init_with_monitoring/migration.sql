-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSignInAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "timeframeMinutes" INTEGER NOT NULL,
    "entryPrice" REAL NOT NULL,
    "quality" INTEGER NOT NULL,
    "zScore" REAL NOT NULL,
    "buyPercent" REAL NOT NULL,
    "sellPercent" REAL NOT NULL,
    "buyersWinning" BOOLEAN NOT NULL,
    "trend" TEXT NOT NULL,
    "vwapPosition" TEXT NOT NULL,
    "atAtrLevel" BOOLEAN NOT NULL,
    "oscillatorValue" REAL NOT NULL,
    "oscillatorPhase" TEXT NOT NULL,
    "compression" BOOLEAN NOT NULL,
    "leavingAccumulation" BOOLEAN NOT NULL DEFAULT false,
    "leavingExtremeDown" BOOLEAN NOT NULL DEFAULT false,
    "leavingDistribution" BOOLEAN NOT NULL DEFAULT false,
    "leavingExtremeUp" BOOLEAN NOT NULL DEFAULT false,
    "stopLoss" REAL NOT NULL,
    "target1" REAL NOT NULL,
    "atr" REAL NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "signals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enriched_data" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalId" TEXT NOT NULL,
    "tradierData" JSONB NOT NULL,
    "twelveData" JSONB NOT NULL,
    "alpacaData" JSONB NOT NULL,
    "aggregatedData" JSONB NOT NULL,
    "dataQuality" REAL NOT NULL,
    "enrichedAt" BIGINT NOT NULL,
    CONSTRAINT "enriched_data_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "reasoning" JSONB NOT NULL,
    "instrumentType" TEXT,
    "strikes" JSONB,
    "expiration" DATETIME,
    "quantity" INTEGER,
    "positionSize" REAL,
    "riskAmount" REAL,
    "expectedReturn" REAL,
    "riskRewardRatio" REAL,
    "winProbability" REAL,
    "modelVersion" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    CONSTRAINT "decisions_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalId" TEXT NOT NULL,
    "userId" TEXT,
    "tradeId" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "enteredAt" DATETIME NOT NULL,
    "instrumentType" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "strikes" JSONB,
    "expiration" DATETIME,
    "side" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "entryPrice" REAL NOT NULL,
    "entryValue" REAL NOT NULL,
    "stopLoss" REAL NOT NULL,
    "target1" REAL NOT NULL,
    "target2" REAL,
    "trailing" BOOLEAN NOT NULL DEFAULT false,
    "exitedAt" DATETIME,
    "exitPrice" REAL,
    "exitValue" REAL,
    "exitReason" TEXT,
    "pnl" REAL,
    "pnlPercent" REAL,
    "rMultiple" REAL,
    "holdingPeriod" INTEGER,
    "status" TEXT NOT NULL,
    "brokerData" JSONB NOT NULL,
    CONSTRAINT "trades_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trade_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "vsExpectation" REAL NOT NULL,
    "signalQuality" REAL NOT NULL,
    "volumePressure" REAL NOT NULL,
    "oscillatorPhase" REAL NOT NULL,
    "marketCondition" REAL NOT NULL,
    "insights" JSONB NOT NULL,
    "improvements" JSONB NOT NULL,
    "appliedToModel" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" DATETIME,
    CONSTRAINT "trade_analyses_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "trading_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "qualityWeight" REAL NOT NULL DEFAULT 0.25,
    "volumeWeight" REAL NOT NULL DEFAULT 0.20,
    "oscillatorWeight" REAL NOT NULL DEFAULT 0.20,
    "structureWeight" REAL NOT NULL DEFAULT 0.20,
    "marketWeight" REAL NOT NULL DEFAULT 0.15,
    "minQuality" INTEGER NOT NULL DEFAULT 4,
    "minConfidence" REAL NOT NULL DEFAULT 0.65,
    "minVolumePressure" REAL NOT NULL DEFAULT 60.0,
    "maxRiskPercent" REAL NOT NULL DEFAULT 2.0,
    "baseSizePerQuality" JSONB NOT NULL,
    "compressionMultiplier" REAL NOT NULL DEFAULT 0.5,
    "allowedTimeframes" JSONB NOT NULL,
    "allowedTickers" JSONB,
    "tradingHours" JSONB NOT NULL,
    "tradesExecuted" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL,
    "avgReturn" REAL,
    "sharpeRatio" REAL,
    "learningData" JSONB NOT NULL,
    "backtestResults" JSONB
);

-- CreateTable
CREATE TABLE "market_context" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL,
    "spyPrice" REAL NOT NULL,
    "spyChange" REAL NOT NULL,
    "vixLevel" REAL NOT NULL,
    "regime" TEXT NOT NULL,
    "volumeProfile" TEXT NOT NULL,
    "sectorLeaders" JSONB NOT NULL,
    "sectorLaggards" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "options_positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tradeId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "optionSymbol" TEXT NOT NULL,
    "strategy" JSONB NOT NULL,
    "entryDate" DATETIME NOT NULL,
    "entryPrice" REAL NOT NULL,
    "contracts" INTEGER NOT NULL,
    "entryGreeks" JSONB NOT NULL,
    "entryIV" REAL NOT NULL,
    "currentPrice" REAL,
    "currentGreeks" JSONB,
    "currentIV" REAL,
    "currentPnL" REAL,
    "pnlPercent" REAL,
    "strike" REAL NOT NULL,
    "expiration" DATETIME NOT NULL,
    "daysToExpiration" INTEGER,
    "optionType" TEXT NOT NULL,
    "maxRisk" REAL NOT NULL,
    "maxProfit" REAL,
    "breakeven" REAL,
    "target1Hit" BOOLEAN NOT NULL DEFAULT false,
    "target2Hit" BOOLEAN NOT NULL DEFAULT false,
    "target3Hit" BOOLEAN NOT NULL DEFAULT false,
    "exitConditions" JSONB NOT NULL DEFAULT [],
    "tradierOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "options_positions_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "strike_selection_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tradeId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "targetDelta" REAL NOT NULL,
    "actualDelta" REAL NOT NULL,
    "deltaDeviation" REAL NOT NULL,
    "underlyingPrice" REAL NOT NULL,
    "ivRank" REAL NOT NULL,
    "oscillatorValue" REAL NOT NULL,
    "signalQuality" INTEGER NOT NULL,
    "selectedStrike" REAL NOT NULL,
    "premium" REAL NOT NULL,
    "daysToExpiration" INTEGER NOT NULL,
    "finalPnL" REAL,
    "holdingPeriod" INTEGER,
    "maxDrawdown" REAL,
    "selectionAccuracy" REAL,
    "performanceScore" REAL,
    "lessons" JSONB NOT NULL DEFAULT [],
    CONSTRAINT "strike_selection_records_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "strike_selection_records_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "options_positions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "options_monitoring_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positionId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "underlyingPrice" REAL NOT NULL,
    "optionPrice" REAL NOT NULL,
    "greeks" JSONB NOT NULL,
    "impliedVol" REAL NOT NULL,
    "totalPnL" REAL NOT NULL,
    "intrinsicValue" REAL NOT NULL,
    "timeValue" REAL NOT NULL,
    "volatilityPnL" REAL NOT NULL,
    "thetaDecay" REAL NOT NULL,
    "deltaChange" REAL NOT NULL,
    "daysToExpiration" INTEGER NOT NULL,
    "thetaDecayRate" REAL NOT NULL,
    "ivChange" REAL NOT NULL,
    "exitConditionsChecked" JSONB NOT NULL DEFAULT [],
    CONSTRAINT "options_monitoring_logs_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "options_positions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "exit_condition_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positionId" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "triggered" BOOLEAN NOT NULL,
    "value" REAL NOT NULL,
    "threshold" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "shouldExit" BOOLEAN NOT NULL,
    "percentToClose" REAL,
    "urgency" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" DATETIME,
    "executionResult" JSONB,
    CONSTRAINT "exit_condition_events_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "options_positions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "performance_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeId" TEXT NOT NULL,
    "finalPnL" REAL NOT NULL,
    "pnlPercent" REAL NOT NULL,
    "rMultiple" REAL NOT NULL,
    "holdingPeriod" INTEGER NOT NULL,
    "deltaPnL" REAL NOT NULL,
    "gammaPnL" REAL NOT NULL,
    "thetaPnL" REAL NOT NULL,
    "vegaPnL" REAL NOT NULL,
    "rhoPnL" REAL NOT NULL,
    "deltaAccuracy" REAL NOT NULL,
    "dteAccuracy" REAL NOT NULL,
    "ivAccuracy" REAL NOT NULL,
    "exitCondition" TEXT NOT NULL,
    "exitTiming" TEXT NOT NULL,
    "exitEffectiveness" REAL NOT NULL,
    "marketCondition" JSONB NOT NULL,
    "conditionMatch" REAL NOT NULL,
    "insights" JSONB NOT NULL,
    "improvements" JSONB NOT NULL,
    "appliedToModel" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" DATETIME,
    CONSTRAINT "performance_analyses_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceIp" TEXT NOT NULL,
    "userAgent" TEXT,
    "headers" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadSize" INTEGER NOT NULL,
    "signature" TEXT,
    "processingTime" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "signalId" TEXT,
    CONSTRAINT "webhook_logs_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "processing_stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "duration" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    CONSTRAINT "processing_stages_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "webhooksPerMinute" REAL NOT NULL,
    "avgProcessingTime" REAL NOT NULL,
    "errorRate" REAL NOT NULL,
    "queueDepth" INTEGER NOT NULL,
    "memoryUsage" REAL NOT NULL,
    "cpuUsage" REAL NOT NULL,
    "dbConnections" INTEGER NOT NULL,
    "signalsProcessed" INTEGER NOT NULL,
    "tradesExecuted" INTEGER NOT NULL,
    "decisionsApproved" INTEGER NOT NULL,
    "decisionsRejected" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    "acknowledgedBy" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_clerkId_idx" ON "users"("clerkId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "signals_status_idx" ON "signals"("status");

-- CreateIndex
CREATE INDEX "signals_ticker_idx" ON "signals"("ticker");

-- CreateIndex
CREATE INDEX "signals_timestamp_idx" ON "signals"("timestamp");

-- CreateIndex
CREATE INDEX "signals_createdAt_idx" ON "signals"("createdAt");

-- CreateIndex
CREATE INDEX "signals_quality_idx" ON "signals"("quality");

-- CreateIndex
CREATE INDEX "signals_ticker_timestamp_idx" ON "signals"("ticker", "timestamp");

-- CreateIndex
CREATE INDEX "signals_status_createdAt_idx" ON "signals"("status", "createdAt");

-- CreateIndex
CREATE INDEX "signals_userId_idx" ON "signals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "enriched_data_signalId_key" ON "enriched_data"("signalId");

-- CreateIndex
CREATE INDEX "enriched_data_signalId_idx" ON "enriched_data"("signalId");

-- CreateIndex
CREATE INDEX "enriched_data_createdAt_idx" ON "enriched_data"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "decisions_signalId_key" ON "decisions"("signalId");

-- CreateIndex
CREATE INDEX "decisions_signalId_idx" ON "decisions"("signalId");

-- CreateIndex
CREATE INDEX "decisions_decision_idx" ON "decisions"("decision");

-- CreateIndex
CREATE INDEX "decisions_createdAt_idx" ON "decisions"("createdAt");

-- CreateIndex
CREATE INDEX "decisions_confidence_idx" ON "decisions"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "trades_tradeId_key" ON "trades"("tradeId");

-- CreateIndex
CREATE INDEX "trades_signalId_idx" ON "trades"("signalId");

-- CreateIndex
CREATE INDEX "trades_tradeId_idx" ON "trades"("tradeId");

-- CreateIndex
CREATE INDEX "trades_status_idx" ON "trades"("status");

-- CreateIndex
CREATE INDEX "trades_ticker_idx" ON "trades"("ticker");

-- CreateIndex
CREATE INDEX "trades_enteredAt_idx" ON "trades"("enteredAt");

-- CreateIndex
CREATE INDEX "trades_exitedAt_idx" ON "trades"("exitedAt");

-- CreateIndex
CREATE INDEX "trades_status_enteredAt_idx" ON "trades"("status", "enteredAt");

-- CreateIndex
CREATE INDEX "trades_ticker_enteredAt_idx" ON "trades"("ticker", "enteredAt");

-- CreateIndex
CREATE INDEX "trades_userId_idx" ON "trades"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trade_analyses_tradeId_key" ON "trade_analyses"("tradeId");

-- CreateIndex
CREATE INDEX "trade_analyses_tradeId_idx" ON "trade_analyses"("tradeId");

-- CreateIndex
CREATE INDEX "trade_analyses_outcome_idx" ON "trade_analyses"("outcome");

-- CreateIndex
CREATE INDEX "trade_analyses_createdAt_idx" ON "trade_analyses"("createdAt");

-- CreateIndex
CREATE INDEX "trade_analyses_appliedToModel_idx" ON "trade_analyses"("appliedToModel");

-- CreateIndex
CREATE UNIQUE INDEX "trading_rules_version_key" ON "trading_rules"("version");

-- CreateIndex
CREATE INDEX "trading_rules_version_idx" ON "trading_rules"("version");

-- CreateIndex
CREATE INDEX "trading_rules_isActive_idx" ON "trading_rules"("isActive");

-- CreateIndex
CREATE INDEX "trading_rules_createdAt_idx" ON "trading_rules"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "market_context_timestamp_key" ON "market_context"("timestamp");

-- CreateIndex
CREATE INDEX "market_context_timestamp_idx" ON "market_context"("timestamp");

-- CreateIndex
CREATE INDEX "market_context_regime_idx" ON "market_context"("regime");

-- CreateIndex
CREATE UNIQUE INDEX "options_positions_tradeId_key" ON "options_positions"("tradeId");

-- CreateIndex
CREATE INDEX "options_positions_tradeId_idx" ON "options_positions"("tradeId");

-- CreateIndex
CREATE INDEX "options_positions_symbol_idx" ON "options_positions"("symbol");

-- CreateIndex
CREATE INDEX "options_positions_status_idx" ON "options_positions"("status");

-- CreateIndex
CREATE INDEX "options_positions_expiration_idx" ON "options_positions"("expiration");

-- CreateIndex
CREATE INDEX "options_positions_optionSymbol_idx" ON "options_positions"("optionSymbol");

-- CreateIndex
CREATE INDEX "options_positions_status_lastUpdated_idx" ON "options_positions"("status", "lastUpdated");

-- CreateIndex
CREATE INDEX "options_positions_symbol_expiration_idx" ON "options_positions"("symbol", "expiration");

-- CreateIndex
CREATE UNIQUE INDEX "strike_selection_records_tradeId_key" ON "strike_selection_records"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "strike_selection_records_positionId_key" ON "strike_selection_records"("positionId");

-- CreateIndex
CREATE INDEX "strike_selection_records_tradeId_idx" ON "strike_selection_records"("tradeId");

-- CreateIndex
CREATE INDEX "strike_selection_records_performanceScore_idx" ON "strike_selection_records"("performanceScore");

-- CreateIndex
CREATE INDEX "strike_selection_records_signalQuality_idx" ON "strike_selection_records"("signalQuality");

-- CreateIndex
CREATE INDEX "strike_selection_records_deltaDeviation_idx" ON "strike_selection_records"("deltaDeviation");

-- CreateIndex
CREATE INDEX "strike_selection_records_createdAt_idx" ON "strike_selection_records"("createdAt");

-- CreateIndex
CREATE INDEX "options_monitoring_logs_positionId_idx" ON "options_monitoring_logs"("positionId");

-- CreateIndex
CREATE INDEX "options_monitoring_logs_timestamp_idx" ON "options_monitoring_logs"("timestamp");

-- CreateIndex
CREATE INDEX "options_monitoring_logs_positionId_timestamp_idx" ON "options_monitoring_logs"("positionId", "timestamp");

-- CreateIndex
CREATE INDEX "exit_condition_events_positionId_idx" ON "exit_condition_events"("positionId");

-- CreateIndex
CREATE INDEX "exit_condition_events_conditionType_idx" ON "exit_condition_events"("conditionType");

-- CreateIndex
CREATE INDEX "exit_condition_events_triggered_idx" ON "exit_condition_events"("triggered");

-- CreateIndex
CREATE INDEX "exit_condition_events_createdAt_idx" ON "exit_condition_events"("createdAt");

-- CreateIndex
CREATE INDEX "exit_condition_events_positionId_conditionType_idx" ON "exit_condition_events"("positionId", "conditionType");

-- CreateIndex
CREATE UNIQUE INDEX "performance_analyses_tradeId_key" ON "performance_analyses"("tradeId");

-- CreateIndex
CREATE INDEX "performance_analyses_tradeId_idx" ON "performance_analyses"("tradeId");

-- CreateIndex
CREATE INDEX "performance_analyses_finalPnL_idx" ON "performance_analyses"("finalPnL");

-- CreateIndex
CREATE INDEX "performance_analyses_exitCondition_idx" ON "performance_analyses"("exitCondition");

-- CreateIndex
CREATE INDEX "performance_analyses_createdAt_idx" ON "performance_analyses"("createdAt");

-- CreateIndex
CREATE INDEX "performance_analyses_appliedToModel_idx" ON "performance_analyses"("appliedToModel");

-- CreateIndex
CREATE INDEX "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_status_idx" ON "webhook_logs"("status");

-- CreateIndex
CREATE INDEX "webhook_logs_sourceIp_idx" ON "webhook_logs"("sourceIp");

-- CreateIndex
CREATE INDEX "webhook_logs_signalId_idx" ON "webhook_logs"("signalId");

-- CreateIndex
CREATE INDEX "webhook_logs_status_createdAt_idx" ON "webhook_logs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_sourceIp_createdAt_idx" ON "webhook_logs"("sourceIp", "createdAt");

-- CreateIndex
CREATE INDEX "processing_stages_signalId_idx" ON "processing_stages"("signalId");

-- CreateIndex
CREATE INDEX "processing_stages_stage_idx" ON "processing_stages"("stage");

-- CreateIndex
CREATE INDEX "processing_stages_status_idx" ON "processing_stages"("status");

-- CreateIndex
CREATE INDEX "processing_stages_startedAt_idx" ON "processing_stages"("startedAt");

-- CreateIndex
CREATE INDEX "processing_stages_signalId_stage_idx" ON "processing_stages"("signalId", "stage");

-- CreateIndex
CREATE INDEX "processing_stages_status_startedAt_idx" ON "processing_stages"("status", "startedAt");

-- CreateIndex
CREATE INDEX "processing_stages_stage_status_idx" ON "processing_stages"("stage", "status");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_errorRate_idx" ON "system_metrics"("timestamp", "errorRate");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_avgProcessingTime_idx" ON "system_metrics"("timestamp", "avgProcessingTime");

-- CreateIndex
CREATE INDEX "system_alerts_severity_idx" ON "system_alerts"("severity");

-- CreateIndex
CREATE INDEX "system_alerts_category_idx" ON "system_alerts"("category");

-- CreateIndex
CREATE INDEX "system_alerts_acknowledged_idx" ON "system_alerts"("acknowledged");

-- CreateIndex
CREATE INDEX "system_alerts_resolved_idx" ON "system_alerts"("resolved");

-- CreateIndex
CREATE INDEX "system_alerts_createdAt_idx" ON "system_alerts"("createdAt");

-- CreateIndex
CREATE INDEX "system_alerts_severity_acknowledged_idx" ON "system_alerts"("severity", "acknowledged");

-- CreateIndex
CREATE INDEX "system_alerts_category_resolved_idx" ON "system_alerts"("category", "resolved");

-- CreateIndex
CREATE INDEX "system_alerts_acknowledged_resolved_idx" ON "system_alerts"("acknowledged", "resolved");
