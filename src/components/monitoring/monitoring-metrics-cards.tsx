'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSystemMetrics } from '@/hooks/useMonitoringEvents'

interface MetricCard {
  title: string
  value: string
  change?: 'positive' | 'negative' | null
  icon: string
  trend?: string
}

interface ApiMetrics {
  webhookVolume: number
  successRate: number
  avgProcessingTime: number
  errorRate: number
  queueDepth: number
  activeStages: number
  memoryUsage?: number
}

export function MonitoringMetricsCards() {
  const { metrics: realtimeMetrics, isLoading: rtLoading, isConnected, lastUpdated } = useSystemMetrics()
  const [apiMetrics, setApiMetrics] = useState<ApiMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch metrics from API
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/metrics')
      if (res.ok) {
        const data = await res.json()
        setApiMetrics(data)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch and polling
  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [fetchMetrics])

  // Use realtime metrics if available, otherwise use API metrics
  const metrics = realtimeMetrics || apiMetrics

  const displayMetrics: MetricCard[] = metrics ? [
    {
      title: 'Webhooks/min',
      value: (metrics.webhookVolume || 0).toString(),
      icon: '📡',
      change: null,
    },
    {
      title: 'Success Rate',
      value: `${(metrics.successRate || 0).toFixed(1)}%`,
      icon: '✅',
      change: (metrics.successRate || 0) >= 95 ? 'positive' : 'negative',
    },
    {
      title: 'Avg Processing',
      value: `${(metrics.avgProcessingTime || 0).toFixed(0)}ms`,
      icon: '⚡',
      change: (metrics.avgProcessingTime || 0) < 500 ? 'positive' : 'negative',
    },
    {
      title: 'Error Rate',
      value: `${(metrics.errorRate || 0).toFixed(1)}%`,
      icon: '❌',
      change: (metrics.errorRate || 0) < 5 ? 'positive' : 'negative',
    },
    {
      title: 'Queue Depth',
      value: (metrics.queueDepth || 0).toString(),
      icon: '📋',
      change: null,
    },
    {
      title: 'Active Stages',
      value: (metrics.activeStages || 0).toString(),
      icon: '🔄',
      change: null,
    },
  ] : [
    { title: 'Webhooks/min', value: '0', icon: '📡', change: null },
    { title: 'Success Rate', value: '0%', icon: '✅', change: null },
    { title: 'Avg Processing', value: '0ms', icon: '⚡', change: null },
    { title: 'Error Rate', value: '0%', icon: '❌', change: null },
    { title: 'Queue Depth', value: '0', icon: '📋', change: null },
    { title: 'Active Stages', value: '0', icon: '🔄', change: null },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Waiting for data...'}
        </span>
        {!isConnected && (
          <span className="text-xs text-yellow-600">Connecting to real-time feed...</span>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {displayMetrics.map((metric) => (
          <Card key={metric.title} className={isLoading ? 'animate-pulse' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {metric.title}
              </CardTitle>
              <span className="text-xl">{metric.icon}</span>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                metric.change === 'positive' ? 'text-green-600' :
                metric.change === 'negative' ? 'text-red-600' :
                'text-gray-900'
              }`}>
                {metric.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
