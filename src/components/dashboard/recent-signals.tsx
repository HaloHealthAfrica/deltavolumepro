'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Signal {
  id: string
  ticker: string
  action: string
  quality: number
  status: string
  timestamp: Date
  decision?: string
}

interface RecentSignalsProps {
  signals: Signal[]
}

export function RecentSignals({ signals }: RecentSignalsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'traded': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
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
    <Card>
      <CardHeader>
        <CardTitle>Recent Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {signals.length > 0 ? (
            signals.map((signal) => (
              <div
                key={signal.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 font-bold">
                    {signal.ticker.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{signal.ticker}</span>
                      <span className={`text-sm font-medium ${getActionColor(signal.action)}`}>
                        {signal.action}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Quality: {signal.quality}/5 • {new Date(signal.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(signal.status)}`}>
                  {signal.status}
                </span>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-gray-400">
              No recent signals
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
