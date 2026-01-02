/**
 * Rules History Component
 * Displays version history of trading rules
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RulesVersion {
  id: string
  version: string
  isActive: boolean
  createdAt: Date
  tradesExecuted: number
  winRate: number | null
  avgReturn: number | null
  sharpeRatio: number | null
}

interface RulesHistoryProps {
  history: RulesVersion[]
  onActivate: (rulesId: string) => Promise<void>
  isLoading?: boolean
}

export function RulesHistory({ history, onActivate, isLoading = false }: RulesHistoryProps) {
  const [activating, setActivating] = useState<string | null>(null)

  const handleActivate = async (rulesId: string) => {
    setActivating(rulesId)
    try {
      await onActivate(rulesId)
    } finally {
      setActivating(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rules Version History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-center text-gray-400 py-4">No rules history available</p>
          ) : (
            history.map((rules) => (
              <div
                key={rules.id}
                className={`rounded-lg border p-4 ${
                  rules.isActive ? 'border-green-300 bg-green-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{rules.version}</span>
                      {rules.isActive && (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(rules.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {!rules.isActive && (
                    <button
                      onClick={() => handleActivate(rules.id)}
                      disabled={isLoading || activating === rules.id}
                      className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {activating === rules.id ? 'Activating...' : 'Activate'}
                    </button>
                  )}
                </div>

                {/* Performance metrics */}
                <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Trades</span>
                    <p className="font-medium">{rules.tradesExecuted}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Win Rate</span>
                    <p className="font-medium">
                      {rules.winRate !== null ? `${(rules.winRate * 100).toFixed(1)}%` : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Return</span>
                    <p className={`font-medium ${
                      rules.avgReturn !== null && rules.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {rules.avgReturn !== null ? `${rules.avgReturn.toFixed(2)}%` : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Sharpe</span>
                    <p className="font-medium">
                      {rules.sharpeRatio !== null ? rules.sharpeRatio.toFixed(2) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
