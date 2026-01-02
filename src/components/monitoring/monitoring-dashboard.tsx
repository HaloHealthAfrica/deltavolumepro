'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MonitoringMetricsCards } from './monitoring-metrics-cards'
import { WebhookFeed } from './webhook-feed'
import { PipelineVisualization } from './pipeline-visualization'
import { SystemHealthPanel } from './system-health-panel'
import { DecisionAnalysis } from './decision-analysis'
import { ErrorMonitoring } from './error-monitoring'
import { useMonitoringEvents, ConnectionState } from '@/hooks/useMonitoringEvents'

type TabType = 'webhooks' | 'pipeline' | 'decisions' | 'errors' | 'health'

export function MonitoringDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('webhooks')
  
  const { connectionState, isConnected, isReconnecting } = useMonitoringEvents({
    onConnectionStateChange: (state: ConnectionState) => {
      console.log('Monitoring connection state:', state)
    },
  })

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'webhooks', label: 'Webhook Feed', icon: '📡' },
    { id: 'pipeline', label: 'Pipeline', icon: '⚡' },
    { id: 'decisions', label: 'Decisions', icon: '🧠' },
    { id: 'errors', label: 'Errors', icon: '🚨' },
    { id: 'health', label: 'System Health', icon: '💚' },
  ]

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse' : 
            isReconnecting ? 'bg-yellow-500 animate-pulse' : 
            'bg-red-500'
          }`} />
          <span className="text-sm text-gray-500">
            {isConnected ? 'Live' : isReconnecting ? 'Reconnecting...' : connectionState}
          </span>
        </div>
      </div>

      {/* Metrics Cards */}
      <MonitoringMetricsCards />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="gap-2"
          >
            <span>{tab.icon}</span>
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'webhooks' && <WebhookFeed />}
        {activeTab === 'pipeline' && <PipelineVisualization />}
        {activeTab === 'decisions' && <DecisionAnalysis />}
        {activeTab === 'errors' && <ErrorMonitoring />}
        {activeTab === 'health' && <SystemHealthPanel />}
      </div>
    </div>
  )
}
