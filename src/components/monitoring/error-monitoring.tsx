'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ErrorGroup {
  id: string
  message: string
  category: string
  count: number
  firstSeen: Date
  lastSeen: Date
  samples: ErrorSample[]
}

interface ErrorSample {
  id: string
  timestamp: Date
  stack?: string
  context?: Record<string, unknown>
}

interface ErrorStats {
  total: number
  last24h: number
  byCategory: Record<string, number>
  trend: 'up' | 'down' | 'stable'
}

export function ErrorMonitoring() {
  const [errors, setErrors] = useState<ErrorGroup[]>([])
  const [stats, setStats] = useState<ErrorStats>({ total: 0, last24h: 0, byCategory: {}, trend: 'stable' })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  // Fetch errors from API
  const fetchErrors = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/errors')
      if (res.ok) {
        const data = await res.json()
        setErrors(data.groups || [])
        setStats(data.stats || { total: 0, last24h: 0, byCategory: {}, trend: 'stable' })
      }
    } catch (error) {
      console.error('Failed to fetch errors:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchErrors()
    const interval = setInterval(fetchErrors, 30000)
    return () => clearInterval(interval)
  }, [fetchErrors])

  const categories = ['all', ...Object.keys(stats.byCategory)]
  const filteredErrors = filter === 'all' 
    ? errors 
    : errors.filter(e => e.category === filter)

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '📈'
      case 'down': return '📉'
      default: return '➡️'
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-red-600'
      case 'down': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span>🚨</span>
          Error Monitoring
        </CardTitle>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchErrors}>
            🔄 Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats summary */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-gray-500">Total Errors</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{stats.last24h}</div>
            <div className="text-xs text-gray-500">Last 24h</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{errors.length}</div>
            <div className="text-xs text-gray-500">Unique Errors</div>
          </div>
          <div className={`text-center p-3 bg-gray-50 rounded ${getTrendColor(stats.trend)}`}>
            <div className="text-2xl font-bold">{getTrendIcon(stats.trend)}</div>
            <div className="text-xs text-gray-500">Trend</div>
          </div>
        </div>

        {/* Error list */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2" />
              <p>Loading errors...</p>
            </div>
          ) : filteredErrors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>🎉 No errors found</p>
              <p className="text-sm">System is running smoothly</p>
            </div>
          ) : (
            filteredErrors.map((error) => (
              <div
                key={error.id}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setExpandedId(expandedId === error.id ? null : error.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">
                        {error.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        {error.count} occurrence{error.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-sm font-mono text-gray-800 truncate">
                      {error.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Last seen: {error.lastSeen.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-red-600">{error.count}</span>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === error.id && error.samples.length > 0 && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <h4 className="text-sm font-medium">Recent Occurrences</h4>
                    {error.samples.slice(0, 3).map((sample) => (
                      <div key={sample.id} className="bg-gray-50 p-3 rounded text-sm">
                        <div className="text-xs text-gray-500 mb-1">
                          {sample.timestamp.toLocaleString()}
                        </div>
                        {sample.stack && (
                          <pre className="text-xs font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">
                            {sample.stack.slice(0, 500)}
                            {sample.stack.length > 500 && '...'}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
