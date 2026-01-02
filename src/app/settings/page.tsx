import { MainLayout } from '@/components/layout'
import { prisma } from '@/lib/prisma'
import { SettingsClient } from './settings-client'

// Force dynamic rendering - these pages need database access
export const dynamic = 'force-dynamic'

async function getSettingsData() {
  // Get active trading rules
  const activeRules = await prisma.tradingRules.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  // Get rules history
  const rulesHistory = await prisma.tradingRules.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // API status from environment
  const apiStatus = {
    tradier: !!process.env.TRADIER_API_KEY,
    twelvedata: !!process.env.TWELVEDATA_API_KEY,
    alpaca: !!process.env.ALPACA_API_KEY,
    webhook: !!process.env.TRADINGVIEW_WEBHOOK_SECRET,
  }

  return {
    activeRules,
    rulesHistory,
    apiStatus,
  }
}

export default async function SettingsPage() {
  const data = await getSettingsData()

  return (
    <MainLayout>
      <SettingsClient
        activeRules={data.activeRules}
        rulesHistory={data.rulesHistory}
        apiStatus={data.apiStatus}
      />
    </MainLayout>
  )
}
