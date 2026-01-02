import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@deltavolumepro.com' },
    update: { role: 'ADMIN' },
    create: {
      clerkId: 'user_admin_seed_placeholder',
      email: 'admin@deltavolumepro.com',
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true,
      lastSignInAt: new Date(),
    }
  })
  console.log('✅ Created admin user:', adminUser.email)

  // Create regular test user
  const testUser = await prisma.user.upsert({
    where: { email: 'trader@deltavolumepro.com' },
    update: {},
    create: {
      clerkId: 'user_trader_seed_placeholder',
      email: 'trader@deltavolumepro.com',
      name: 'Test Trader',
      role: 'USER',
      isActive: true,
      lastSignInAt: new Date(),
    }
  })
  console.log('✅ Created test user:', testUser.email)

  // Create default trading rules
  const tradingRules = await prisma.tradingRules.upsert({
    where: { version: 'v1.0.0' },
    update: {},
    create: {
      version: 'v1.0.0',
      isActive: true,
      qualityWeight: 0.25,
      volumeWeight: 0.20,
      oscillatorWeight: 0.20,
      structureWeight: 0.20,
      marketWeight: 0.15,
      minQuality: 4,
      minConfidence: 0.65,
      minVolumePressure: 60.0,
      maxRiskPercent: 2.0,
      baseSizePerQuality: { "1": 0, "2": 0, "3": 50, "4": 100, "5": 150 },
      compressionMultiplier: 0.5,
      allowedTimeframes: [5, 15, 30, 60],
      tradingHours: { start: '09:30', end: '16:00', timezone: 'America/New_York' },
      learningData: { modelVersion: 'v1.0.0', lastUpdated: new Date().toISOString() },
      tradesExecuted: 47,
      winRate: 0.68,
      avgReturn: 2.3,
      sharpeRatio: 1.85,
    }
  })
  console.log('✅ Created trading rules:', tradingRules.version)

  // Create market context
  const now = new Date()
  const marketContext = await prisma.marketContext.upsert({
    where: { timestamp: now },
    update: {},
    create: {
      timestamp: now,
      spyPrice: 592.45,
      spyChange: 1.23,
      vixLevel: 14.8,
      regime: 'BULL',
      volumeProfile: 'HIGH',
      sectorLeaders: [
        { sector: 'Technology', performance: 2.1 },
        { sector: 'Consumer Discretionary', performance: 1.5 },
      ],
      sectorLaggards: [
        { sector: 'Utilities', performance: -0.8 },
        { sector: 'Energy', performance: -0.3 },
      ]
    }
  })
  console.log('✅ Created market context')


  // Create sample signals with various statuses
  const signals = []
  const tickers = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'META']
  const actions = ['BUY', 'SELL']
  const statuses = ['received', 'processing', 'enriched', 'traded', 'rejected']
  const trends = ['BULLISH', 'BEARISH', 'NEUTRAL']
  const phases = ['ACCUMULATION', 'DISTRIBUTION', 'MARKUP', 'MARKDOWN']

  for (let i = 0; i < 15; i++) {
    const ticker = tickers[i % tickers.length]
    const action = actions[i % 2]
    const quality = Math.floor(Math.random() * 3) + 3 // 3-5
    const basePrice = 100 + Math.random() * 400
    const daysAgo = Math.floor(Math.random() * 30)
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    const signal = await prisma.signal.create({
      data: {
        userId: i % 3 === 0 ? adminUser.id : testUser.id,
        rawPayload: { source: 'tradingview', ticker, action },
        action,
        ticker,
        timestamp: BigInt(createdAt.getTime()),
        timeframeMinutes: [5, 15, 30, 60][i % 4],
        entryPrice: basePrice,
        quality,
        zScore: 1 + Math.random() * 2,
        buyPercent: 40 + Math.random() * 30,
        sellPercent: 30 + Math.random() * 30,
        buyersWinning: action === 'BUY',
        trend: trends[i % 3],
        vwapPosition: action === 'BUY' ? 'ABOVE' : 'BELOW',
        atAtrLevel: Math.random() > 0.5,
        oscillatorValue: Math.random() * 100,
        oscillatorPhase: phases[i % 4],
        compression: Math.random() > 0.6,
        leavingAccumulation: i % 4 === 0,
        leavingExtremeDown: i % 5 === 0,
        leavingDistribution: i % 6 === 0,
        leavingExtremeUp: i % 7 === 0,
        stopLoss: action === 'BUY' ? basePrice * 0.98 : basePrice * 1.02,
        target1: action === 'BUY' ? basePrice * 1.03 : basePrice * 0.97,
        atr: basePrice * 0.015,
        status: statuses[i % 5],
        createdAt,
      }
    })
    signals.push(signal)
  }
  console.log('✅ Created', signals.length, 'sample signals')

  // Create enriched data for some signals
  for (let i = 0; i < 8; i++) {
    await prisma.enrichedData.create({
      data: {
        signalId: signals[i].id,
        tradierData: { quote: { last: signals[i].entryPrice, volume: 1000000 + Math.random() * 5000000 } },
        twelveData: { price: signals[i].entryPrice, change: Math.random() * 2 - 1 },
        alpacaData: { trade: { price: signals[i].entryPrice, size: 100 } },
        aggregatedData: { confidence: 0.7 + Math.random() * 0.25, signals: ['volume_surge', 'trend_aligned'] },
        dataQuality: 0.85 + Math.random() * 0.15,
        enrichedAt: BigInt(Date.now()),
      }
    })
  }
  console.log('✅ Created enriched data for signals')

  // Create decisions for enriched signals
  for (let i = 0; i < 6; i++) {
    await prisma.decision.create({
      data: {
        signalId: signals[i].id,
        decision: i < 4 ? 'TRADE' : 'REJECT',
        confidence: 0.65 + Math.random() * 0.3,
        reasoning: { factors: ['quality_score', 'volume_confirmation', 'trend_alignment'], score: 0.75 },
        instrumentType: i % 2 === 0 ? 'STOCK' : 'CALL',
        strikes: i % 2 === 1 ? { strike: Math.round(signals[i].entryPrice / 5) * 5 } : {},
        expiration: i % 2 === 1 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
        quantity: 10 + Math.floor(Math.random() * 90),
        positionSize: 500 + Math.random() * 2000,
        riskAmount: 50 + Math.random() * 150,
        expectedReturn: 0.02 + Math.random() * 0.05,
        riskRewardRatio: 1.5 + Math.random() * 2,
        winProbability: 0.55 + Math.random() * 0.25,
        modelVersion: 'v1.0.0',
        weights: { quality: 0.25, volume: 0.2, oscillator: 0.2, structure: 0.2, market: 0.15 },
      }
    })
  }
  console.log('✅ Created decisions')


  // Create trades - mix of open and closed
  const trades = []
  for (let i = 0; i < 10; i++) {
    const signal = signals[i]
    const isOpen = i < 3
    const isWin = Math.random() > 0.35
    const entryPrice = signal.entryPrice
    const exitPrice = isWin 
      ? entryPrice * (signal.action === 'BUY' ? 1.025 : 0.975)
      : entryPrice * (signal.action === 'BUY' ? 0.985 : 1.015)
    const quantity = 10 + Math.floor(Math.random() * 50)
    const pnl = isOpen ? null : (exitPrice - entryPrice) * quantity * (signal.action === 'BUY' ? 1 : -1)
    const daysAgo = Math.floor(Math.random() * 20)
    const enteredAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

    const trade = await prisma.trade.create({
      data: {
        signalId: signal.id,
        userId: signal.userId,
        tradeId: `TRD-${Date.now()}-${i}`,
        broker: ['tradier', 'alpaca'][i % 2],
        enteredAt,
        instrumentType: i % 3 === 0 ? 'CALL' : 'STOCK',
        ticker: signal.ticker,
        strikes: i % 3 === 0 ? { strike: Math.round(entryPrice / 5) * 5 } : {},
        expiration: i % 3 === 0 ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
        side: signal.action === 'BUY' ? 'LONG' : 'SHORT',
        quantity,
        entryPrice,
        entryValue: entryPrice * quantity,
        stopLoss: signal.stopLoss,
        target1: signal.target1,
        target2: signal.target1 * 1.02,
        trailing: i % 4 === 0,
        exitedAt: isOpen ? null : new Date(enteredAt.getTime() + Math.random() * 5 * 24 * 60 * 60 * 1000),
        exitPrice: isOpen ? null : exitPrice,
        exitValue: isOpen ? null : exitPrice * quantity,
        exitReason: isOpen ? null : (isWin ? 'TARGET_1' : 'STOP_LOSS'),
        pnl: pnl,
        pnlPercent: isOpen ? null : (pnl! / (entryPrice * quantity)) * 100,
        rMultiple: isOpen ? null : (isWin ? 1.5 + Math.random() : -0.8 - Math.random() * 0.2),
        holdingPeriod: isOpen ? null : Math.floor(Math.random() * 1440 * 5),
        status: isOpen ? 'OPEN' : 'CLOSED',
        brokerData: { orderId: `ORD-${i}`, fills: [{ price: entryPrice, qty: quantity }] },
      }
    })
    trades.push(trade)
  }
  console.log('✅ Created', trades.length, 'trades (', trades.filter(t => t.status === 'OPEN').length, 'open)')

  // Create trade analyses for closed trades
  for (let i = 3; i < trades.length; i++) {
    const trade = trades[i]
    if (trade.status === 'CLOSED') {
      await prisma.tradeAnalysis.create({
        data: {
          tradeId: trade.id,
          outcome: trade.pnl! > 0 ? 'WIN' : 'LOSS',
          vsExpectation: Math.random() * 0.4 - 0.2,
          signalQuality: 0.7 + Math.random() * 0.3,
          volumePressure: 0.6 + Math.random() * 0.4,
          oscillatorPhase: 0.5 + Math.random() * 0.5,
          marketCondition: 0.6 + Math.random() * 0.4,
          insights: { 
            positive: ['Good entry timing', 'Volume confirmed'], 
            negative: ['Exit could be optimized'] 
          },
          improvements: { suggestions: ['Consider trailing stop', 'Watch for divergence'] },
          appliedToModel: i % 2 === 0,
          appliedAt: i % 2 === 0 ? new Date() : null,
        }
      })
    }
  }
  console.log('✅ Created trade analyses')

  // Create options positions for some trades
  for (let i = 0; i < 4; i++) {
    const trade = trades[i]
    if (trade.instrumentType === 'CALL' || i < 2) {
      const strike = Math.round(trade.entryPrice / 5) * 5
      const optionsPosition = await prisma.optionsPosition.create({
        data: {
          tradeId: trade.id,
          symbol: trade.ticker,
          optionSymbol: `${trade.ticker}${new Date().toISOString().slice(2,10).replace(/-/g,'')}C${strike}`,
          strategy: { type: 'LONG_CALL', legs: 1 },
          entryDate: trade.enteredAt,
          entryPrice: trade.entryPrice * 0.03,
          contracts: Math.ceil(trade.quantity / 100),
          entryGreeks: { delta: 0.45, gamma: 0.02, theta: -0.05, vega: 0.15 },
          entryIV: 0.25 + Math.random() * 0.15,
          currentPrice: trade.entryPrice * 0.035,
          currentGreeks: { delta: 0.52, gamma: 0.025, theta: -0.06, vega: 0.14 },
          currentIV: 0.28 + Math.random() * 0.1,
          currentPnL: Math.random() * 200 - 50,
          pnlPercent: Math.random() * 20 - 5,
          strike,
          expiration: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          daysToExpiration: 14,
          optionType: 'call',
          maxRisk: trade.entryPrice * 0.03 * Math.ceil(trade.quantity / 100) * 100,
          maxProfit: 999999, // Unlimited for long calls
          breakeven: strike + trade.entryPrice * 0.03,
          exitConditions: ['PROFIT_50', 'STOP_LOSS_25', 'DTE_3'],
          status: trade.status === 'OPEN' ? 'OPEN' : 'CLOSED',
        }
      })


      // Create strike selection record
      await prisma.strikeSelectionRecord.create({
        data: {
          tradeId: trade.id,
          positionId: optionsPosition.id,
          targetDelta: 0.45,
          actualDelta: 0.45 + Math.random() * 0.1 - 0.05,
          deltaDeviation: Math.random() * 0.05,
          underlyingPrice: trade.entryPrice,
          ivRank: 0.3 + Math.random() * 0.4,
          oscillatorValue: 50 + Math.random() * 30,
          signalQuality: signals[i].quality,
          selectedStrike: strike,
          premium: trade.entryPrice * 0.03,
          daysToExpiration: 14,
          finalPnL: trade.status === 'CLOSED' ? trade.pnl : null,
          holdingPeriod: trade.status === 'CLOSED' ? trade.holdingPeriod : null,
          performanceScore: trade.status === 'CLOSED' ? 0.6 + Math.random() * 0.4 : null,
          lessons: ['Delta targeting was accurate', 'Consider IV rank for entry'],
        }
      })

      // Create monitoring logs
      for (let j = 0; j < 5; j++) {
        await prisma.optionsMonitoringLog.create({
          data: {
            positionId: optionsPosition.id,
            timestamp: new Date(Date.now() - (5 - j) * 60 * 60 * 1000),
            underlyingPrice: trade.entryPrice * (1 + (Math.random() * 0.02 - 0.01)),
            optionPrice: trade.entryPrice * 0.03 * (1 + (Math.random() * 0.1 - 0.05)),
            greeks: { delta: 0.45 + j * 0.02, gamma: 0.02, theta: -0.05, vega: 0.15 },
            impliedVol: 0.25 + Math.random() * 0.05,
            totalPnL: (j - 2) * 20,
            intrinsicValue: Math.max(0, trade.entryPrice - strike),
            timeValue: trade.entryPrice * 0.02,
            volatilityPnL: Math.random() * 10 - 5,
            thetaDecay: -5 * j,
            deltaChange: j * 0.02,
            daysToExpiration: 14 - j,
            thetaDecayRate: -0.05,
            ivChange: Math.random() * 0.02 - 0.01,
            exitConditionsChecked: ['PROFIT_50: false', 'STOP_LOSS_25: false'],
          }
        })
      }

      // Create exit condition events
      await prisma.exitConditionEvent.create({
        data: {
          positionId: optionsPosition.id,
          conditionType: 'PROFIT_TARGET_1',
          triggered: false,
          value: 35,
          threshold: 50,
          description: 'Profit target 50% not yet reached',
          shouldExit: false,
          percentToClose: 0,
          urgency: 'LOW',
          reasoning: 'Position is profitable but below target',
          executed: false,
        }
      })
    }
  }
  console.log('✅ Created options positions with monitoring data')

  // Create performance analyses for closed trades
  for (let i = 3; i < 7; i++) {
    const trade = trades[i]
    if (trade.status === 'CLOSED') {
      await prisma.performanceAnalysis.create({
        data: {
          tradeId: trade.id,
          finalPnL: trade.pnl!,
          pnlPercent: trade.pnlPercent!,
          rMultiple: trade.rMultiple!,
          holdingPeriod: trade.holdingPeriod!,
          deltaPnL: trade.pnl! * 0.6,
          gammaPnL: trade.pnl! * 0.1,
          thetaPnL: trade.pnl! * -0.15,
          vegaPnL: trade.pnl! * 0.15,
          rhoPnL: trade.pnl! * 0.05,
          deltaAccuracy: 0.85 + Math.random() * 0.15,
          dteAccuracy: 0.8 + Math.random() * 0.2,
          ivAccuracy: 0.7 + Math.random() * 0.25,
          exitCondition: trade.exitReason!,
          exitTiming: ['EARLY', 'OPTIMAL', 'LATE'][i % 3],
          exitEffectiveness: 0.7 + Math.random() * 0.3,
          marketCondition: { regime: 'BULL', vix: 15, volume: 'HIGH' },
          conditionMatch: 0.75 + Math.random() * 0.25,
          insights: { key_factors: ['Volume surge', 'Trend confirmation'], lessons: ['Good entry'] },
          improvements: { suggestions: ['Tighter stops', 'Scale out earlier'] },
          appliedToModel: i % 2 === 0,
          appliedAt: i % 2 === 0 ? new Date() : null,
        }
      })
    }
  }
  console.log('✅ Created performance analyses')

  console.log('')
  console.log('🎉 Database seeding completed successfully!')
  console.log('')
  console.log('📊 Summary:')
  console.log('   - 2 users (1 admin, 1 trader)')
  console.log('   - 1 trading rules configuration')
  console.log('   - 1 market context snapshot')
  console.log('   - 15 signals')
  console.log('   - 8 enriched data records')
  console.log('   - 6 decisions')
  console.log('   - 10 trades (3 open, 7 closed)')
  console.log('   - Trade analyses and performance data')
  console.log('   - Options positions with monitoring logs')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
