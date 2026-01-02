/**
 * Database Deployment Script
 * 
 * Handles database migrations and seeding for production deployment.
 * Run with: npx ts-node scripts/deploy-database.ts
 */

import { execSync } from 'child_process'

async function deployDatabase() {
  console.log('🚀 Starting database deployment...\n')

  try {
    // Step 1: Generate Prisma client
    console.log('📦 Generating Prisma client...')
    execSync('npx prisma generate', { stdio: 'inherit' })
    console.log('✅ Prisma client generated\n')

    // Step 2: Run migrations
    console.log('🔄 Running database migrations...')
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    console.log('✅ Migrations applied\n')

    // Step 3: Seed database (if needed)
    const shouldSeed = process.argv.includes('--seed')
    if (shouldSeed) {
      console.log('🌱 Seeding database...')
      execSync('npx prisma db seed', { stdio: 'inherit' })
      console.log('✅ Database seeded\n')
    }

    // Step 4: Verify connection
    console.log('🔍 Verifying database connection...')
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    await prisma.$connect()
    const result = await prisma.$queryRaw`SELECT 1 as connected`
    console.log('✅ Database connection verified\n')
    
    // Get table counts
    const signalCount = await prisma.signal.count()
    const rulesCount = await prisma.tradingRules.count()
    
    console.log('📊 Database Statistics:')
    console.log(`   - Signals: ${signalCount}`)
    console.log(`   - Trading Rules: ${rulesCount}`)
    
    await prisma.$disconnect()

    console.log('\n🎉 Database deployment complete!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Database deployment failed:', error)
    process.exit(1)
  }
}

deployDatabase()
