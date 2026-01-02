import { MainLayout } from '@/components/layout'
import { KPICards, EquityChart, RecentSignals, OpenPositions } from '@/components/dashboard'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering - these pages need database access
export const dynamic = 'force-dynamic'

async function getDashboardData() {
  // Get trade statistics
  const trades = await prisma.trade.findMany({
    where: { status: 'CLOSED' }
  })
  
  const wins = trades.filter(t => (t.pnl || 0) > 0).length
  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const avgRMultiple = trades.length > 0
    ? trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / trades.length
    : 0
  
  // Get open positions
  const openTrades = await prisma.trade.findMany({
    where: { status: 'OPEN' },
    include: { signal: true }
  })
  
  // Get today's signals
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const todaySignals = await prisma.signal.count({
    where: {
      createdAt: { gte: today }
    }
  })
  
  // Get recent signals
  const recentSignals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { decision: true }
  })
  
  // Generate equity curve data (simplified)
  const equityData = []
  let equity = 100000 // Starting equity
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(a.exitedAt || 0).getTime() - new Date(b.exitedAt || 0).getTime()
  )
  
  equityData.push({ date: 'Start', value: equity })
  for (const trade of sortedTrades.slice(-20)) {
    equity += trade.pnl || 0
    equityData.push({
      date: new Date(trade.exitedAt || Date.now()).toLocaleDateString(),
      value: equity
    })
  }
  
  return {
    kpis: {
      totalTrades: trades.length,
      winRate: trades.length > 0 ? wins / trades.length : 0,
      totalPnL,
      avgRMultiple,
      openPositions: openTrades.length,
      todaySignals
    },
    equityData,
    recentSignals: recentSignals.map(s => ({
      id: s.id,
      ticker: s.ticker,
      action: s.action,
      quality: s.quality,
      status: s.status,
      timestamp: s.createdAt,
      decision: s.decision?.decision
    })),
    openPositions: openTrades.map(t => ({
      id: t.id,
      ticker: t.ticker,
      side: t.side as 'LONG' | 'SHORT',
      quantity: t.quantity,
      entryPrice: t.entryPrice,
      currentPrice: t.entryPrice, // Would be real-time in production
      pnl: 0,
      pnlPercent: 0
    }))
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* KPI Cards */}
        <KPICards data={data.kpis} />

        {/* Charts and Lists */}
        <div className="grid gap-6 lg:grid-cols-3">
          <EquityChart data={data.equityData} />
          <RecentSignals signals={data.recentSignals} />
        </div>

        {/* Open Positions */}
        <OpenPositions positions={data.openPositions} />
      </div>
    </MainLayout>
  )
}
