'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface DecisionFactor {
  name: string
  value: number
  weight: number
  contribution: number
  passed: boolean
}

interface Decision {
  id: string
  signalId: string
  ticker: string
  action: 'BUY' | 'SELL'
  outcome: 'approved' | 'rejected'
  confidenceScore: number
  threshold: number
  factors: DecisionFactor[]
  rejectionReasons?: string[]
  timestamp: Date
}

interface DecisionCardProps {
  decision: Decision
  isExpanded: boolean
  onToggle: () => void
}

function DecisionCard({ decision, isExpanded, onToggle }: DecisionCardProps) {
  return (
    <div 
      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            decision.outcome === 'approved' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {decision.outcome}
          </span>
          <span className="font-bold">{decision.ticker}</span>
          <span className={`text-sm ${
            decision.action === 'BUY' ? 'text-green-600' : 'text-red-600'
          }`}>
            {decision.action}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">
              {(decision.confidenceScore * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">
              threshold: {(decision.threshold * 100).toFixed(0)}%
            </div>
          </div>
          <span className="text-xs text-gray-500">
            {decision.timestamp.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="relative h-2 bg-gray-200 rounded overflow-hidden">
        <div 
          className={`absolute h-full ${
            decision.confidenceScore >= decision.threshold 
              ? 'bg-green-500' 
              : 'bg-red-500'
          }`}
          style={{ width: `${decision.confidenceScore * 100}%` }}
        />
        <div 
          className="absolute h-full w-0.5 bg-gray-800"
          style={{ left: `${decision.threshold * 100}%` }}
        />
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {/* Factor breakdown */}
          <div>
            <h4 className="text-sm font-medium mb-2">Decision Factors</h4>
            <div className="space-y-2">
              {decision.factors.map((factor) => (
                <div key={factor.name} className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    factor.passed ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="flex-1 text-sm">{factor.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded overflow-hidden">
                      <div 
                        className={`h-full ${factor.passed ? 'bg-green-400' : 'bg-red-400'}`}
                        style={{ width: `${factor.value * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {(factor.value * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-gray-400 w-16 text-right">
                      w: {(factor.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rejection reasons */}
          {decision.rejectionReasons && decision.rejectionReasons.length > 0 && (
            <div className="bg-red-50 p-3 rounded">
              <h4 className="text-sm font-medium text-red-800 mb-2">Rejection Reasons</h4>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {decision.rejectionReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function DecisionAnalysis() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, avgConfidence: 0 })

  // Fetch decisions from API
  const fetchDecisions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ timeRange: '24h' })
      if (filter !== 'all') params.set('outcome', filter)
      
      const res = await fetch(`/api/monitoring/decisions?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDecisions(data.data.map((d: any) => ({
          ...d,
          timestamp: new Date(d.createdAt),
        })))
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch decisions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchDecisions()
    const interval = setInterval(fetchDecisions, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [fetchDecisions])

  const filteredDecisions = decisions

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span>🧠</span>
          Decision Engine Analysis
        </CardTitle>
        <div className="flex items-center gap-2">
          {(['all', 'approved', 'rejected'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats summary */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-xs text-gray-500">Approved</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-xs text-gray-500">Rejected</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">
              {(stats.avgConfidence * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-500">Avg Confidence</div>
          </div>
        </div>

        {/* Decision list */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {filteredDecisions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No decisions to display</p>
            </div>
          ) : (
            filteredDecisions.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                isExpanded={expandedId === decision.id}
                onToggle={() => setExpandedId(
                  expandedId === decision.id ? null : decision.id
                )}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
