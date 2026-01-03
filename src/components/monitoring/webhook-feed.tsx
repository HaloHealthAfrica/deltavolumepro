'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useWebhookFeed } from '@/hooks/useMonitoringEvents'

interface WebhookItem {
  id: string
  sourceIp: string
  status: string
  processingTime?: number
  payloadSize?: number
  ticker?: string
  action?: string
  quality?: number
  entryPrice?: number
  stopLoss?: number
  target1?: number
  signalStatus?: string
  signalId?: string
  errorMessage?: string
  createdAt: Date
  payload?: Record<string, any>
}

export function WebhookFeed() {
  const { webhooks: realtimeWebhooks, isLoading: rtLoading, isConnected, isPaused, pause, resume, clearWebhooks } = useWebhookFeed(100)
  const [apiWebhooks, setApiWebhooks] = useState<WebhookItem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')
  const [isLoading, setIsLoading] = useState(true)

  // Fetch webhooks from API
  const fetchWebhooks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ timeRange: '1h', limit: '100' })
      if (filter !== 'all') params.set('status', filter)
      
      const res = await fetch(`/api/monitoring/webhooks?${params}`)
      if (res.ok) {
        const data = await res.json()
        setApiWebhooks(data.data.map((w: any) => ({
          ...w,
          createdAt: new Date(w.createdAt),
        })))
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error)
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchWebhooks()
    const interval = setInterval(fetchWebhooks, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [fetchWebhooks])

  // Merge realtime and API webhooks, preferring realtime
  const mergedWebhooks: WebhookItem[] = [...realtimeWebhooks.map(w => ({
    id: w.webhook.id,
    sourceIp: w.webhook.sourceIp,
    status: w.webhook.status,
    processingTime: w.webhook.processingTime,
    payloadSize: w.webhook.payloadSize,
    signalId: w.webhook.signalId,
    errorMessage: w.webhook.errorMessage,
    createdAt: new Date(w.timestamp),
    // These may not be available in realtime, will be filled from API
    ticker: undefined,
    action: undefined,
    quality: undefined,
    entryPrice: undefined,
    stopLoss: undefined,
    target1: undefined,
    signalStatus: undefined,
    payload: undefined,
  })), ...apiWebhooks.filter(aw => !realtimeWebhooks.some(rw => rw.webhook.id === aw.id))]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 100)

  const filteredWebhooks = mergedWebhooks.filter((w) => {
    if (filter === 'all') return true
    if (filter === 'success') return w.status === 'success'
    if (filter === 'failed') return w.status === 'failed' || w.status === 'rejected'
    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'rejected': return 'bg-yellow-100 text-yellow-800'
      case 'pending': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span>📡</span>
          Real-time Webhook Feed
          {!isConnected && <span className="text-xs text-yellow-600">(Connecting...)</span>}
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          <div className="flex gap-1">
            {(['all', 'success', 'failed'] as const).map((f) => (
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
          {/* Pause/Resume */}
          <Button
            variant="outline"
            size="sm"
            onClick={isPaused ? resume : pause}
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </Button>
          {/* Clear */}
          <Button
            variant="outline"
            size="sm"
            onClick={clearWebhooks}
          >
            🗑️ Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {isLoading && mergedWebhooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2" />
              <p>Loading webhook feed...</p>
            </div>
          ) : filteredWebhooks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No webhooks received yet</p>
              <p className="text-sm">Webhooks will appear here in real-time</p>
            </div>
          ) : (
            filteredWebhooks.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                    {item.ticker && (
                      <span className="font-bold text-sm">{item.ticker}</span>
                    )}
                    {item.action && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.action.includes('LONG') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {item.action}
                      </span>
                    )}
                    {item.quality && (
                      <span className="text-xs text-gray-500">Q{item.quality}</span>
                    )}
                    <span className="font-mono text-xs text-gray-400">{item.sourceIp}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {item.processingTime && (
                      <span className="text-xs">{item.processingTime}ms</span>
                    )}
                    <span className="text-xs">{item.createdAt.toLocaleTimeString()}</span>
                  </div>
                </div>
                
                {/* Expanded details */}
                {expandedId === item.id && (
                  <div className="mt-3 pt-3 border-t text-sm space-y-3">
                    {/* Signal Info */}
                    {(item.ticker || item.signalId) && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="font-medium text-blue-800 mb-2">📊 Signal Details</div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          {item.ticker && (
                            <div>
                              <span className="text-gray-500">Ticker:</span>{' '}
                              <span className="font-medium">{item.ticker}</span>
                            </div>
                          )}
                          {item.action && (
                            <div>
                              <span className="text-gray-500">Action:</span>{' '}
                              <span className={`font-medium ${item.action.includes('LONG') ? 'text-green-600' : 'text-red-600'}`}>
                                {item.action}
                              </span>
                            </div>
                          )}
                          {item.quality && (
                            <div>
                              <span className="text-gray-500">Quality:</span>{' '}
                              <span className="font-medium">{item.quality}/5</span>
                            </div>
                          )}
                          {item.signalStatus && (
                            <div>
                              <span className="text-gray-500">Status:</span>{' '}
                              <span className="font-medium">{item.signalStatus}</span>
                            </div>
                          )}
                        </div>
                        {(item.entryPrice || item.stopLoss || item.target1) && (
                          <div className="grid grid-cols-3 gap-2 text-xs mt-2 pt-2 border-t border-blue-200">
                            {item.entryPrice && (
                              <div>
                                <span className="text-gray-500">Entry:</span>{' '}
                                <span className="font-medium">${item.entryPrice.toFixed(2)}</span>
                              </div>
                            )}
                            {item.stopLoss && (
                              <div>
                                <span className="text-gray-500">Stop:</span>{' '}
                                <span className="font-medium text-red-600">${item.stopLoss.toFixed(2)}</span>
                              </div>
                            )}
                            {item.target1 && (
                              <div>
                                <span className="text-gray-500">Target:</span>{' '}
                                <span className="font-medium text-green-600">${item.target1.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {item.signalId && (
                          <div className="text-xs text-gray-400 mt-2">
                            Signal ID: {item.signalId}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Request Info */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="font-medium text-gray-700 mb-2">🌐 Request Details</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Source IP:</span>{' '}
                          <span className="font-mono">{item.sourceIp}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Payload Size:</span>{' '}
                          <span>{item.payloadSize || 0} bytes</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Processing:</span>{' '}
                          <span>{item.processingTime || 0}ms</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Time:</span>{' '}
                          <span>{item.createdAt.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Error Message */}
                    {item.errorMessage && (
                      <div className="bg-red-50 p-3 rounded-lg">
                        <div className="font-medium text-red-700 mb-1">❌ Error</div>
                        <div className="text-red-600 text-xs">{item.errorMessage}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        
        {/* Stats footer */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-gray-500">
          <span>Showing {filteredWebhooks.length} of {mergedWebhooks.length} webhooks</span>
          {isPaused && <span className="text-yellow-600">Feed paused</span>}
        </div>
      </CardContent>
    </Card>
  )
}
