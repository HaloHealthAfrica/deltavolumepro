import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDatabase() {
  console.log('🔍 Checking database connection and setup...')
  
  try {
    // Test basic connection
    await prisma.$connect()
    console.log('✅ Database connection successful')
    
    // Check if tables exist by querying each model
    const checks = [
      { name: 'Signals', query: () => prisma.signal.count() },
      { name: 'TradingRules', query: () => prisma.tradingRules.count() },
      { name: 'MarketContext', query: () => prisma.marketContext.count() },
      { name: 'EnrichedData', query: () => prisma.enrichedData.count() },
      { name: 'Decisions', query: () => prisma.decision.count() },
      { name: 'Trades', query: () => prisma.trade.count() },
      { name: 'TradeAnalyses', query: () => prisma.tradeAnalysis.count() },
    ]
    
    console.log('\n📊 Table Status:')
    for (const check of checks) {
      try {
        const count = await check.query()
        console.log(`  ${check.name}: ✅ ${count} records`)
      } catch (error) {
        console.log(`  ${check.name}: ❌ Error - ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
    
    // Check for active trading rules
    const activeTradingRules = await prisma.tradingRules.findFirst({
      where: { isActive: true }
    })
    
    if (activeTradingRules) {
      console.log(`\n🎯 Active Trading Rules: ${activeTradingRules.version}`)
    } else {
      console.log('\n⚠️  No active trading rules found')
    }
    
    // Check recent market context
    const recentMarketContext = await prisma.marketContext.findFirst({
      orderBy: { timestamp: 'desc' }
    })
    
    if (recentMarketContext) {
      console.log(`📈 Latest Market Context: ${recentMarketContext.timestamp.toISOString()}`)
    } else {
      console.log('⚠️  No market context data found')
    }
    
    console.log('\n✅ Database health check completed')
    
  } catch (error) {
    console.error('❌ Database health check failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()