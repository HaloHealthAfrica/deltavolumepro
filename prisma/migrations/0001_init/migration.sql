-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSignInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "action" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "timeframeMinutes" INTEGER NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "quality" INTEGER NOT NULL,
    "zScore" DOUBLE PRECISION NOT NULL,
    "buyPercent" DOUBLE PRECISION NOT NULL,
    "sellPercent" DOUBLE PRECISION NOT NULL,
    "buyersWinning" BOOLEAN NOT NULL,
    "trend" TEXT NOT NULL,
    "vwapPosition" TEXT NOT NULL,
    "atAtrLevel" BOOLEAN NOT NULL,
    "oscillatorValue" DOUBLE PRECISION NOT NULL,
    "oscillatorPhase" TEXT NOT NULL,
    "compression" BOOLEAN NOT NULL,
    "leavingAccumulation" BOOLEAN NOT NULL DEFAULT false,
    "leavingExtremeDown" BOOLEAN NOT NULL DEFAULT false,
    "leavingDistribution" BOOLEAN NOT NULL DEFAULT false,
    "leavingExtremeUp" BOOLEAN NOT NULL DEFAULT false,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "target1" DOUBLE PRECISION NOT NULL,
    "atr" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enriched_data" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalId" TEXT NOT NULL,
    "tradierData" JSONB NOT NULL,
    "twelveData" JSONB NOT NULL,
    "alpacaData" JSONB NOT NULL,
    "aggregatedData" JSONB NOT NULL,
    "dataQuality" DOUBLE PRECISION NOT NULL,
    "enrichedAt" BIGINT NOT NULL,

    CONSTRAINT "enriched_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" JSONB NOT NULL,
    "instrumentType" TEXT,
    "strikes" JSONB,
    "expiration" TIMESTAMP(3),
    "quantity" INTEGER,
    "positionSize" DOUBLE PRECISION,
    "riskAmount" DOUBLE PRECISION,
    "expectedReturn" DOUBLE PRECISION,
    "riskRewardRatio" DOUBLE PRECISION,
    "winProbability" DOUBLE PRECISION,
    "modelVersion" TEXT NOT NULL,
    "weights" JSONB NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signalId" TEXT NOT NULL,
    "userId" TEXT,
    "tradeId" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "instrumentType" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "strikes" JSONB,
    "expiration" TIMESTAMP(3),
    "side" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "entryValue" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "target1" DOUBLE PRECISION NOT NULL,
    "target2" DOUBLE PRECISION,
    "trailing" BOOLEAN NOT NULL DEFAULT false,
    "exitedAt" TIMESTAMP(3),
    "exitPrice" DOUBLE PRECISION,
    "exitValue" DOUBLE PRECISION,
    "exitReason" TEXT,
    "pnl" DOUBLE PRECISION,
    "pnlPercent" DOUBLE PRECISION,
    "rMultiple" DOUBLE PRECISION,
    "holdingPeriod" INTEGER,
    "status" TEXT NOT NULL,
    "brokerData" JSONB NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_analyses" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "vsExpectation" DOUBLE PRECISION NOT NULL,
    "signalQuality" DOUBLE PRECISION NOT NULL,
    "volumePressure" DOUBLE PRECISION NOT NULL,
    "oscillatorPhase" DOUBLE PRECISION NOT NULL,
    "marketCondition" DOUBLE PRECISION NOT NULL,
    "insights" JSONB NOT NULL,
    "improvements" JSONB NOT NULL,
    "appliedToModel" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "trade_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_rules" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "qualityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "volumeWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "oscillatorWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "structureWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "marketWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "minQuality" INTEGER NOT NULL DEFAULT 4,
    "minConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "minVolumePressure" DOUBLE PRECISION NOT NULL DEFAULT 60.0,
    "maxRiskPercent" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "baseSizePerQuality" JSONB NOT NULL,
    "compressionMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "allowedTimeframes" JSONB NOT NULL,
    "allowedTickers" JSONB,
    "tradingHours" JSONB NOT NULL,
    "tradesExecuted" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "avgReturn" DOUBLE PRECISION,
    "sharpeRatio" DOUBLE PRECISION,
    "learningData" JSONB NOT NULL,
    "backtestResults" JSONB,

    CONSTRAINT "trading_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_context" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "spyPrice" DOUBLE PRECISION NOT NULL,
    "spyChange" DOUBLE PRECISION NOT NULL,
    "vixLevel" DOUBLE PRECISION NOT NULL,
    "regime" TEXT NOT NULL,
    "volumeProfile" TEXT NOT NULL,
    "sectorLeaders" JSONB NOT NULL,
    "sectorLaggards" JSONB NOT NULL,

    CONSTRAINT "market_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_positions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tradeId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "optionSymbol" TEXT NOT NULL,
    "strategy" JSONB NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "contracts" INTEGER NOT NULL,
    "entryGreeks" JSONB NOT NULL,
    "entryIV" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "currentGreeks" JSONB,
    "currentIV" DOUBLE PRECISION,
    "currentPnL" DOUBLE PRECISION,
    "pnlPercent" DOUBLE PRECISION,
    "strike" DOUBLE PRECISION NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "daysToExpiration" INTEGER,
    "optionType" TEXT NOT NULL,
    "maxRisk" DOUBLE PRECISION NOT NULL,
    "maxProfit" DOUBLE PRECISION,
    "breakeven" DOUBLE PRECISION,
    "target1Hit" BOOLEAN NOT NULL DEFAULT false,
    "target2Hit" BOOLEAN NOT NULL DEFAULT false,
    "target3Hit" BOOLEAN NOT NULL DEFAULT false,
    "exitConditions" JSONB NOT NULL DEFAULT '[]',
    "tradierOrderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "options_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strike_selection_records" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tradeId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "targetDelta" DOUBLE PRECISION NOT NULL,
    "actualDelta" DOUBLE PRECISION NOT NULL,
    "deltaDeviation" DOUBLE PRECISION NOT NULL,
    "underlyingPrice" DOUBLE PRECISION NOT NULL,
    "ivRank" DOUBLE PRECISION NOT NULL,
    "oscillatorValue" DOUBLE PRECISION NOT NULL,
    "signalQuality" INTEGER NOT NULL,
    "selectedStrike" DOUBLE PRECISION NOT NULL,
    "premium" DOUBLE PRECISION NOT NULL,
    "daysToExpiration" INTEGER NOT NULL,
    "finalPnL" DOUBLE PRECISION,
    "holdingPeriod" INTEGER,
    "maxDrawdown" DOUBLE PRECISION,
    "selectionAccuracy" DOUBLE PRECISION,
    "performanceScore" DOUBLE PRECISION,
    "lessons" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "strike_selection_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_monitoring_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "underlyingPrice" DOUBLE PRECISION NOT NULL,
    "optionPrice" DOUBLE PRECISION NOT NULL,
    "greeks" JSONB NOT NULL,
    "impliedVol" DOUBLE PRECISION NOT NULL,
    "totalPnL" DOUBLE PRECISION NOT NULL,
    "intrinsicValue" DOUBLE PRECISION NOT NULL,
    "timeValue" DOUBLE PRECISION NOT NULL,
    "volatilityPnL" DOUBLE PRECISION NOT NULL,
    "thetaDecay" DOUBLE PRECISION NOT NULL,
    "deltaChange" DOUBLE PRECISION NOT NULL,
    "daysToExpiration" INTEGER NOT NULL,
    "thetaDecayRate" DOUBLE PRECISION NOT NULL,
    "ivChange" DOUBLE PRECISION NOT NULL,
    "exitConditionsChecked" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "options_monitoring_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exit_condition_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positionId" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "triggered" BOOLEAN NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "shouldExit" BOOLEAN NOT NULL,
    "percentToClose" DOUBLE PRECISION,
    "urgency" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "executionResult" JSONB,

    CONSTRAINT "exit_condition_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_analyses" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tradeId" TEXT NOT NULL,
    "finalPnL" DOUBLE PRECISION NOT NULL,
    "pnlPercent" DOUBLE PRECISION NOT NULL,
    "rMultiple" DOUBLE PRECISION NOT NULL,
    "holdingPeriod" INTEGER NOT NULL,
    "deltaPnL" DOUBLE PRECISION NOT NULL,
    "gammaPnL" DOUBLE PRECISION NOT NULL,
    "thetaPnL" DOUBLE PRECISION NOT NULL,
    "vegaPnL" DOUBLE PRECISION NOT NULL,
    "rhoPnL" DOUBLE PRECISION NOT NULL,
    "deltaAccuracy" DOUBLE PRECISION NOT NULL,
    "dteAccuracy" DOUBLE PRECISION NOT NULL,
    "ivAccuracy" DOUBLE PRECISION NOT NULL,
    "exitCondition" TEXT NOT NULL,
    "exitTiming" TEXT NOT NULL,
    "exitEffectiveness" DOUBLE PRECISION NOT NULL,
    "marketCondition" JSONB NOT NULL,
    "conditionMatch" DOUBLE PRECISION NOT NULL,
    "insights" JSONB NOT NULL,
    "improvements" JSONB NOT NULL,
    "appliedToModel" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "performance_analyses_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enriched_data" ADD CONSTRAINT "enriched_data_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_analyses" ADD CONSTRAINT "trade_analyses_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_positions" ADD CONSTRAINT "options_positions_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strike_selection_records" ADD CONSTRAINT "strike_selection_records_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strike_selection_records" ADD CONSTRAINT "strike_selection_records_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "options_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_monitoring_logs" ADD CONSTRAINT "options_monitoring_logs_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "options_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exit_condition_events" ADD CONSTRAINT "exit_condition_events_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "options_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_analyses" ADD CONSTRAINT "performance_analyses_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

