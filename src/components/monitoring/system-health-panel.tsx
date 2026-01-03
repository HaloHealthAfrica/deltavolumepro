'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSystemHealth, useSystemAlerts } from '@/hooks/useMonitoringEvents'

interface HealthData {
  status: string
  database?: { status: string; latency?: number }
  api?: { status: string; latency?: number }
  memory?: { status: string; usagePercent?: number }
  queue?: { status: string; depth?: number }
  lastCheck?: string
}

interface NormalizedHealth {
  status: string
  database?: { status: string; latency?: number }
  api?: { status: string; latency?: number }
  memory?: { status: string; usagePercent?: number }
  queue?: { status: string; depth?: number }
  lastCheck?: Date
}

export function SystemHealthPanel() {
  const { health: realtimeHealth, isLoading: rtLoading, isConnected, lastUpdated } = useSystemHealth()
  const { alerts, unacknowledgedCount, highestSeverity } = useSystemAlerts()
  const [apiHealth, setApiHealth] = useState<HealthData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch health from API
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/health')
      if (res.ok) {
        const data = await res.json()
        setApiHealth(data)
      }
    } catch (error) {
      console.error('Failed to fetch health:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch and polling
  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 15000) // Poll every 15s
    return () => clearInterval(interval)
  }, [fetchHealth])

  // Normalize health data from different sources
  const normalizeHealth = (): NormalizedHealth | null => {
    if (realtimeHealth) {
      return {
        status: realtimeHealth.status,
        database: realtimeHealth.database ? {
          status: realtimeHealth.database.status,
          latency: realtimeHealth.database.latency
        } : undefined,
        api: undefined, // SystemHealth uses externalApis, not api
        memory: realtimeHealth.memory ? {
          status: realtimeHealth.memory.status,
          usagePercent: realtimeHealth.memory.usedPercent
        } : undefined,
        queue: realtimeHealth.queue ? {
          status: realtimeHealth.queue.status,
          depth: realtimeHealth.queue.depth
        } : undefined,
        lastCheck: realtimeHealth.lastCheck
      }
    }
    if (apiHealth) {
      return {
        status: apiHealth.status,
        database: apiHealth.database,
        api: apiHealth.api,
        memory: apiHealth.memory,
        queue: apiHealth.queue,
        lastCheck: apiHealth.lastCheck ? new Date(apiHealth.lastCheck) : undefined
      }
    }
    return null
  }

  const health = normalizeHealth()

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'unhealthy': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  const getStatusBg = (status?: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-50 border-green-200'
      case 'degraded': return 'bg-yellow-50 border-yellow-200'
      case 'unhealthy': return 'bg-red-50 border-red-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'error': return 'bg-orange-100 text-orange-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'info': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const healthComponents = [
    { 
      name: 'Database', 
      status: health?.database?.status,
      detail: health?.database?.latency ? `${health.database.latency}ms` : undefined,
      icon: '🗄️'
    },
    { 
      name: 'API', 
      status: health?.api?.status,
      detail: health?.api?.latency ? `${health.api.latency}ms` : undefined,
      icon: '🌐'
    },
    { 
      name: 'Memory', 
      status: health?.memory?.status,
      detail: health?.memory?.usagePercent ? `${health.memory.usagePercent.toFixed(1)}%` : undefined,
      icon: '💾'
    },
    { 
      name: 'Queue', 
      status: health?.queue?.status,
      detail: health?.queue?.depth !== undefined ? `${health.queue.depth} items` : undefined,
      icon: '📋'
    },
  ]

  const healthLastUpdated = lastUpdated || health?.lastCheck || null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* System Health Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>💚</span>
            System Health
            {!isConnected && <span className="text-xs text-yellow-600">(Connecting...)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Overall status */}
          <div className={`p-4 rounded-lg border mb-4 ${getStatusBg(health?.status)}`}>
            <div className="flex items-center gap-3">
              <span className={`w-4 h-4 rounded-full ${getStatusColor(health?.status)}`} />
              <span className="font-medium capitalize">
                {health?.status || 'Unknown'}
              </span>
            </div>
            {healthLastUpdated && (
              <p className="text-xs text-gray-500 mt-2">
                Last check: {healthLastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Component status */}
          <div className="space-y-3">
            {healthComponents.map((component) => (
              <div 
                key={component.name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span>{component.icon}</span>
                  <span>{component.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {component.detail && (
                    <span className="text-sm text-gray-500">{component.detail}</span>
                  )}
                  <span className={`w-3 h-3 rounded-full ${getStatusColor(component.status)}`} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>🔔</span>
              Active Alerts
            </div>
            {unacknowledgedCount > 0 && (
              <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(highestSeverity || undefined)}`}>
                {unacknowledgedCount} unacknowledged
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No active alerts</p>
                <p className="text-sm">System is running smoothly</p>
              </div>
            ) : (
              alerts.filter(a => !a.resolved).map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.acknowledged ? 'bg-gray-50 border-gray-200' : getStatusBg(
                      alert.severity === 'critical' || alert.severity === 'error' ? 'unhealthy' :
                      alert.severity === 'warning' ? 'degraded' : 'healthy'
                    )
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-gray-500">{alert.category}</span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {alert.acknowledged && (
                      <span className="text-xs text-green-600">✓ Ack</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
