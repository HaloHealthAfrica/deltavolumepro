/**
 * Settings Client Component
 * Interactive settings page with tabs
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  RulesEditor,
  RulesHistory,
  ApiStatus,
  TickerFilter,
  TimeframeFilter,
} from '@/components/settings'

interface TradingRules {
  id: string
  version: string
  isActive: boolean
  qualityWeight: number
  volumeWeight: number
  oscillatorWeight: number
  structureWeight: number
  marketWeight: number
  minQuality: number
  minConfidence: number
  minVolumePressure: number
  maxRiskPercent: number
  compressionMultiplier: number
  baseSizePerQuality: unknown
  allowedTimeframes: unknown
  allowedTickers: unknown | null
  tradingHours: unknown
  tradesExecuted: number
  winRate: number | null
  avgReturn: number | null
  sharpeRatio: number | null
  learningData: unknown
  backtestResults: unknown | null
  createdAt: Date
}

interface SettingsClientProps {
  activeRules: TradingRules | null
  rulesHistory: TradingRules[]
  apiStatus: {
    tradier: boolean
    twelvedata: boolean
    alpaca: boolean
    webhook: boolean
  }
}

type TabId = 'rules' | 'filters' | 'api' | 'history'

export function SettingsClient({ activeRules, rulesHistory, apiStatus }: SettingsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('rules')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const tabs: { id: TabId; label: string }[] = [
    { id: 'rules', label: 'Trading Rules' },
    { id: 'filters', label: 'Filters' },
    { id: 'api', label: 'API Status' },
    { id: 'history', label: 'Version History' },
  ]

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSaveRules = useCallback(async (updates: Partial<TradingRules>) => {
    if (!activeRules) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/settings/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rulesId: activeRules.id, updates }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save rules')
      }

      showMessage('success', 'Trading rules updated successfully')
      router.refresh()
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to save rules')
    } finally {
      setIsLoading(false)
    }
  }, [activeRules, router])

  const handleActivateRules = useCallback(async (rulesId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/settings/rules/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rulesId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate rules')
      }

      showMessage('success', 'Rules version activated successfully')
      router.refresh()
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Failed to activate rules')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const handleUpdateTickerFilters = useCallback(async (allowed: string[], blocked: string[]) => {
    // TODO: Implement ticker filter persistence
    console.log('Updating ticker filters:', { allowed, blocked })
    showMessage('success', 'Ticker filters updated')
  }, [])

  const handleUpdateTimeframeFilters = useCallback(async (timeframes: number[]) => {
    // TODO: Implement timeframe filter persistence
    console.log('Updating timeframe filters:', timeframes)
    showMessage('success', 'Timeframe filters updated')
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        {activeRules && (
          <span className="text-sm text-gray-500">
            Active: {activeRules.version}
          </span>
        )}
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'rules' && activeRules && (
          <RulesEditor
            rules={activeRules}
            onSave={handleSaveRules}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'rules' && !activeRules && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
            <p className="text-yellow-800">
              No active trading rules found. Please run database seed to create initial rules.
            </p>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="space-y-6">
            <TickerFilter
              allowedTickers={[]}
              blockedTickers={[]}
              onUpdate={handleUpdateTickerFilters}
              isLoading={isLoading}
            />
            <TimeframeFilter
              allowedTimeframes={[1, 5, 15, 30, 60, 240, 1440]}
              onUpdate={handleUpdateTimeframeFilters}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'api' && (
          <ApiStatus status={apiStatus} />
        )}

        {activeTab === 'history' && (
          <RulesHistory
            history={rulesHistory}
            onActivate={handleActivateRules}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  )
}
