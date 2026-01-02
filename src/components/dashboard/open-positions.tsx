'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Position {
  id: string
  ticker: string
  side: 'LONG' | 'SHORT'
  quantity: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
}

interface OpenPositionsProps {
  positions: Position[]
}

export function OpenPositions({ positions }: OpenPositionsProps) {
  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Open Positions</span>
          <span className={`text-sm font-normal ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {positions.length > 0 ? (
            positions.map((position) => (
              <div
                key={position.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold ${
                    position.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {position.side === 'LONG' ? '↑' : '↓'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{position.ticker}</span>
                      <span className="text-xs text-gray-500">
                        {position.quantity} @ ${position.entryPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Current: ${position.currentPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                  </div>
                  <div className={`text-xs ${position.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-gray-400">
              No open positions
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
