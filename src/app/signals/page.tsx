import { MainLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering - these pages need database access
export const dynamic = 'force-dynamic'

async function getSignals() {
  const signals = await prisma.signal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { decision: true }
  })
  
  return signals
}

export default async function SignalsPage() {
  const signals = await getSignals()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'traded': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'enriched': return 'bg-blue-100 text-blue-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes('LONG')) return 'text-green-600'
    if (action.includes('SHORT')) return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Live Signals</h1>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-gray-500">Live</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Signal Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {signals.length > 0 ? (
                signals.map((signal) => (
                  <div
                    key={signal.id}
                    className="rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg font-bold text-lg ${
                          signal.action.includes('LONG') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {signal.ticker.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">{signal.ticker}</span>
                            <span className={`font-medium ${getActionColor(signal.action)}`}>
                              {signal.action}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(signal.status)}`}>
                              {signal.status}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                            <span>Quality: {signal.quality}/5</span>
                            <span>Entry: ${signal.entryPrice.toFixed(2)}</span>
                            <span>TF: {signal.timeframeMinutes}m</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        {new Date(signal.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {/* Signal details */}
                    <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                      <div className="rounded bg-gray-50 p-2">
                        <div className="text-gray-500">Trend</div>
                        <div className="font-medium">{signal.trend}</div>
                      </div>
                      <div className="rounded bg-gray-50 p-2">
                        <div className="text-gray-500">VWAP</div>
                        <div className="font-medium">{signal.vwapPosition}</div>
                      </div>
                      <div className="rounded bg-gray-50 p-2">
                        <div className="text-gray-500">Buy %</div>
                        <div className="font-medium">{signal.buyPercent.toFixed(1)}%</div>
                      </div>
                      <div className="rounded bg-gray-50 p-2">
                        <div className="text-gray-500">Oscillator</div>
                        <div className="font-medium">{signal.oscillatorPhase}</div>
                      </div>
                    </div>

                    {/* Decision reasoning */}
                    {signal.decision && (
                      <div className="mt-4 rounded bg-blue-50 p-3">
                        <div className="text-sm font-medium text-blue-800">
                          Decision: {signal.decision.decision} ({(signal.decision.confidence * 100).toFixed(0)}% confidence)
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-gray-400">
                  No signals received yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
