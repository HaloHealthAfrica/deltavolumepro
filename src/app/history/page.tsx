import { MainLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering - these pages need database access
export const dynamic = 'force-dynamic'

async function getTradeHistory() {
  const trades = await prisma.trade.findMany({
    where: { status: 'CLOSED' },
    orderBy: { exitedAt: 'desc' },
    take: 100,
    include: { signal: true }
  })
  
  return trades
}

export default async function HistoryPage() {
  const trades = await getTradeHistory()

  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const wins = trades.filter(t => (t.pnl || 0) > 0).length
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Trade History</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500">{trades.length} trades</span>
            <span className={totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </span>
            <span className="text-gray-500">{winRate.toFixed(1)}% win rate</span>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-sm text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ticker</th>
                    <th className="px-4 py-3 font-medium">Side</th>
                    <th className="px-4 py-3 font-medium">Entry</th>
                    <th className="px-4 py-3 font-medium">Exit</th>
                    <th className="px-4 py-3 font-medium">P&L</th>
                    <th className="px-4 py-3 font-medium">R-Multiple</th>
                    <th className="px-4 py-3 font-medium">Exit Reason</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {trades.length > 0 ? (
                    trades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-medium">{trade.ticker}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                            trade.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="px-4 py-3">${trade.entryPrice.toFixed(2)}</td>
                        <td className="px-4 py-3">${trade.exitPrice?.toFixed(2) || '-'}</td>
                        <td className={`px-4 py-3 font-medium ${
                          (trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                        </td>
                        <td className={`px-4 py-3 ${
                          (trade.rMultiple || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(trade.rMultiple || 0).toFixed(2)}R
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-0.5 text-xs ${
                            trade.exitReason === 'TARGET_1' || trade.exitReason === 'TARGET_2'
                              ? 'bg-green-100 text-green-700'
                              : trade.exitReason === 'STOP_LOSS'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {trade.exitReason || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {trade.holdingPeriod ? `${trade.holdingPeriod}m` : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {trade.exitedAt ? new Date(trade.exitedAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                        No trade history
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
