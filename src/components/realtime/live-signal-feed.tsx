/**
 * Live Signal Feed Component
 * Real-time display of incoming signals
 */

'use client'

import { useState, useEffect } from 'react'
import { useSignalEvents } from '@/hooks/use-realtime'
import type { SignalReceivedPayload, SignalDecisionPayload } from '@/lib/realtime/broadcaster'

interface SignalWithDecision extends SignalReceivedPayload {
  decision?: SignalDecisionPayload
}

export function LiveSignalFeed() {
  const [signals, setSignals] = useState<SignalWithDecision[]>([])
  
  const { latestSignal, latestDecision } = useSignalEvents({
    onSignalReceived: (signal) => {
      setSignals(prev => [signal, ...prev].slice(0, 20))
    },
    onSignalDecision: (decision) => {
      setSignals(prev => 
        prev.map(s => 
          s.id === decision.signalId 
            ? { ...s, decision } 
            : s
        )
      )
    },
  })

  const getActionColor = (action: string) => {
    if (action.includes('LONG')) return 'text-green-600 bg-green-50'
    if (action.includes('SHORT')) return 'text-red-600 bg-red-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case 'TRADE': return 'bg-green-100 text-green-700'
      case 'REJECT': return 'bg-red-100 text-red-700'
      case 'SKIP': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-3">
      {signals.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          <div className="mb-2 text-2xl">📡</div>
          <p>Waiting for signals...</p>
        </div>
      ) : (
        signals.map((signal) => (
          <div
            key={signal.id}
            className="rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg px-3 py-1 font-bold ${getActionColor(signal.action)}`}>
                  {signal.ticker}
                </div>
                <div>
                  <span className="font-medium">{signal.action}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    Q{signal.quality}/5
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-gray-400">
                {new Date(signal.timestamp).toLocaleTimeString()}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
              <span>Entry: ${signal.entryPrice.toFixed(2)}</span>
              <span>TF: {signal.timeframeMinutes}m</span>
            </div>

            {signal.decision && (
              <div className="mt-3 flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${getDecisionColor(signal.decision.decision)}`}>
                  {signal.decision.decision}
                </span>
                <span className="text-xs text-gray-500">
                  {(signal.decision.confidence * 100).toFixed(0)}% confidence
                </span>
                {signal.decision.instrumentType && (
                  <span className="text-xs text-gray-400">
                    → {signal.decision.instrumentType}
                  </span>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
