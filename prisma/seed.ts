import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Create default trading rules
  const defaultTradingRules = await prisma.tradingRules.upsert({
    where: { version: 'v1.0.0' },
    update: {},
    create: {
      version: 'v1.0.0',
      isActive: true,
      
      // Rule weights - balanced approach
      qualityWeight: 0.25,
      volumeWeight: 0.20,
      oscillatorWeight: 0.20,
      structureWeight: 0.20,
      marketWeight: 0.15,
      
      // Conservative thresholds for initial deployment
      minQuality: 4,
      minConfidence: 0.65,
      minVolumePressure: 60.0,
      maxRiskPercent: 2.0,
      
      // Position sizing based on signal quality
      baseSizePerQuality: {
        "1": 0,    // No trades on quality 1
        "2": 0,    // No trades on quality 2
        "3": 50,   // $50 base size for quality 3
        "4": 100,  // $100 base size for quality 4
        "5": 150   // $150 base size for quality 5
      },
      compressionMultiplier: 0.5, // Reduce size by 50% when not in compression
      
      // Allowed timeframes (in minutes)
      allowedTimeframes: [5, 15, 30, 60],
      
      // Trading hours (Eastern Time)
      tradingHours: {
        start: '09:30',
        end: '16:00',
        timezone: 'America/New_York'
      },
      
      // Learning metadata - initial empty state
      learningData: {
        modelVersion: 'v1.0.0',
        featureWeights: {
          quality: 0.25,
          volume: 0.20,
          oscillator: 0.20,
          structure: 0.20,
          market: 0.15
        },
        lastUpdated: new Date().toISOString()
      }
    }
  })

  console.log('✅ Created default trading rules:', defaultTradingRules.version)

  // Create sample market context for current time
  const now = new Date()
  // Round to nearest 5 minutes for market context
  const roundedTime = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000))
  
  const marketContext = await prisma.marketContext.upsert({
    where: { timestamp: roundedTime },
    update: {},
    create: {
      timestamp: roundedTime,
      
      // Sample market data (would be real data in production)
      spyPrice: 450.00,
      spyChange: 0.5,
      vixLevel: 18.5,
      
      // Market regime assessment
      regime: 'NEUTRAL',
      volumeProfile: 'NORMAL',
      
      // Sector rotation data
      sectorLeaders: [
        { sector: 'Technology', performance: 1.2 },
        { sector: 'Healthcare', performance: 0.8 },
        { sector: 'Financials', performance: 0.6 }
      ],
      sectorLaggards: [
        { sector: 'Energy', performance: -0.8 },
        { sector: 'Utilities', performance: -0.4 },
        { sector: 'Real Estate', performance: -0.2 }
      ]
    }
  })

  console.log('✅ Created sample market context for:', marketContext.timestamp)

  // Create a sample signal for testing (optional)
  const sampleSignal = await prisma.signal.create({
    data: {
      rawPayload: {
        source: 'seed_data',
        message: 'Sample signal for testing'
      },
      action: 'BUY',
      ticker: 'SPY',
      timestamp: Date.now(),
      timeframeMinutes: 15,
      entryPrice: 450.25,
      quality: 4,
      
      // Volume data
      zScore: 1.5,
      buyPercent: 65.0,
      sellPercent: 35.0,
      buyersWinning: true,
      
      // Structure data
      trend: 'BULLISH',
      vwapPosition: 'ABOVE',
      atAtrLevel: true,
      
      // Oscillator data
      oscillatorValue: 0.3,
      oscillatorPhase: 'ACCUMULATION',
      compression: true,
      leavingAccumulation: true,
      
      // Suggested levels
      stopLoss: 448.50,
      target1: 452.00,
      atr: 1.75,
      
      // Processing status
      status: 'received'
    }
  })

  console.log('✅ Created sample signal:', sampleSignal.id)

  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })