'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProcessingStages } from '@/hooks/useMonitoringEvents'
import type { ProcessingStage, ProcessingStageType } from '@/types/monitoring'

const STAGE_ORDER: ProcessingStageType[] = [
  'webhook_received',
  'validation',
  'signal_creation',
  'decision_engine',
  'trade_execution',
  'notification',
]

const STAGE_LABELS: Record<ProcessingStageType, string> = {
  webhook_received: 'Webhook Received',
  validation: 'Validation',
  signal_creation: 'Signal Creation',
  decision_engine: 'Decision Engine',
  trade_execution: 'Trade Execution',
  notification: 'Notification',
}

interface PipelineItemProps {
  signalId: string
  stages: ProcessingStage[]
  isExpanded: boolean
  onToggle: () => void
}

function PipelineItem({ signalId, stages, isExpanded, onToggle }: PipelineItemProps) {
  const currentStage = stages.find(s => s.status === 'in_progress')
  const failedStage = stages.find(s => s.status === 'failed')
  const completedStages = stages.filter(s => s.status === 'completed')
  
  const overallStatus = failedStage ? 'failed' : currentStage ? 'in_progress' : 'completed'
  const totalDuration = stages.reduce((sum, s) => sum + (s.duration || 0), 0)

  const getStageStatus = (stageType: ProcessingStageType) => {
    const stage = stages.find(s => s.stage === stageType)
    if (!stage) return 'pending'
    return stage.status
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500 animate-pulse'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  return (
    <div 
      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${getStatusColor(overallStatus)}`} />
          <span className="font-mono text-sm">{signalId.slice(0, 12)}...</span>
          <span className={`px-2 py-0.5 rounded text-xs ${
            overallStatus === 'completed' ? 'bg-green-100 text-green-800' :
            overallStatus === 'failed' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {overallStatus}
          </span>
        </div>
        <div className="text-sm text-gray-500">
          {totalDuration}ms total
        </div>
      </div>

      {/* Pipeline stages visualization */}
      <div className="flex items-center gap-1">
        {STAGE_ORDER.map((stageType, index) => {
          const status = getStageStatus(stageType)
          return (
            <div key={stageType} className="flex items-center flex-1">
              <div 
                className={`h-2 flex-1 rounded ${getStatusColor(status)}`}
                title={`${STAGE_LABELS[stageType]}: ${status}`}
              />
              {index < STAGE_ORDER.length - 1 && (
                <div className="w-1 h-2 bg-gray-200" />
              )}
            </div>
          )
        })}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-2">
          {STAGE_ORDER.map((stageType) => {
            const stage = stages.find(s => s.stage === stageType)
            const status = stage?.status || 'pending'
            
            return (
              <div key={stageType} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
                  <span>{STAGE_LABELS[stageType]}</span>
                </div>
                <div className="text-gray-500">
                  {stage?.duration ? `${stage.duration}ms` : '-'}
                </div>
              </div>
            )
          })}
          
          {failedStage?.errorMessage && (
            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
              <span className="font-medium">Error:</span> {failedStage.errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PipelineVisualization() {
  const { stages, isLoading, isConnected, clearStages } = useProcessingStages()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Convert Map to array for rendering
  const pipelines = Array.from(stages.entries()).map(([signalId, stageList]) => ({
    signalId,
    stages: stageList,
  }))

  // Sort by most recent first
  const sortedPipelines = pipelines.sort((a, b) => {
    const aTime = a.stages[0]?.startedAt?.getTime() || 0
    const bTime = b.stages[0]?.startedAt?.getTime() || 0
    return bTime - aTime
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span>⚡</span>
          Signal Processing Pipeline
          {!isConnected && <span className="text-xs text-yellow-600">(Connecting...)</span>}
        </CardTitle>
        <button
          onClick={clearStages}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Clear
        </button>
      </CardHeader>
      <CardContent>
        {/* Stage legend */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {STAGE_ORDER.map((stage) => (
            <span key={stage} className="px-2 py-1 bg-gray-100 rounded">
              {STAGE_LABELS[stage]}
            </span>
          ))}
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {isLoading && pipelines.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mb-2" />
              <p>Connecting to pipeline feed...</p>
            </div>
          ) : sortedPipelines.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No active pipelines</p>
              <p className="text-sm">Signal processing will appear here in real-time</p>
            </div>
          ) : (
            sortedPipelines.map((pipeline) => (
              <PipelineItem
                key={pipeline.signalId}
                signalId={pipeline.signalId}
                stages={pipeline.stages}
                isExpanded={expandedId === pipeline.signalId}
                onToggle={() => setExpandedId(
                  expandedId === pipeline.signalId ? null : pipeline.signalId
                )}
              />
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t text-sm text-gray-500">
          Tracking {pipelines.length} signal{pipelines.length !== 1 ? 's' : ''}
        </div>
      </CardContent>
    </Card>
  )
}
