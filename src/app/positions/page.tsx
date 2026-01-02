import { MainLayout } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering - these pages need database access
export const dynamic = 'force-dynamic'

async function getPositions() {
  const positions = await prisma.trade.findMany({
    where: { status: 'OPEN' },
    orderBy: { enteredAt: 'desc' },
    include: { signal: true }
  })
  
  return positions
}

export default async function PositionsPage() {
  const positions = await getPositions()

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Open Positions</h1>
          <div className="text-sm text-gray-500">
            {positions.length} position{positions.length !== 1 ? 's' : ''}
          </div>
        </div>

        {positions.length > 0 ? (
          <div className="grid gap-4">
            {positions.map((position) => (
              <Card key={position.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-lg font-bold text-xl ${
                        position.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {position.side === 'LONG' ? '↑' : '↓'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold">{position.ticker}</span>
                          <span className={`rounded px-2 py-0.5 text-sm font-medium ${
                            position.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {position.side}
                          </span>
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-600">
                            {position.instrumentType}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          {position.quantity} shares @ ${position.entryPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-gray-500">Entry Value</div>
                      <div className="text-xl font-bold">${position.entryValue.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Risk levels */}
                  <div className="mt-6 grid grid-cols-4 gap-4">
                    <div className="rounded-lg bg-red-50 p-3">
                      <div className="text-xs text-red-600">Stop Loss</div>
                      <div className="text-lg font-semibold text-red-700">${position.stopLoss.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <div className="text-xs text-green-600">Target 1</div>
                      <div className="text-lg font-semibold text-green-700">${position.target1.toFixed(2)}</div>
                    </div>
                    {position.target2 && (
                      <div className="rounded-lg bg-green-50 p-3">
                        <div className="text-xs text-green-600">Target 2</div>
                        <div className="text-lg font-semibold text-green-700">${position.target2.toFixed(2)}</div>
                      </div>
                    )}
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs text-gray-600">Trailing</div>
                      <div className="text-lg font-semibold">{position.trailing ? 'Active' : 'Off'}</div>
                    </div>
                  </div>

                  {/* Trade info */}
                  <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <span>Broker: {position.broker}</span>
                    <span>Entered: {new Date(position.enteredAt).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              No open positions
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  )
}
