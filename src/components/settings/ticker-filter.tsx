/**
 * Ticker Filter Component
 * Configure allowed/blocked tickers for signal processing
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TickerFilterProps {
  allowedTickers: string[]
  blockedTickers: string[]
  onUpdate: (allowed: string[], blocked: string[]) => Promise<void>
  isLoading?: boolean
}

export function TickerFilter({
  allowedTickers: initialAllowed,
  blockedTickers: initialBlocked,
  onUpdate,
  isLoading = false,
}: TickerFilterProps) {
  const [allowedTickers, setAllowedTickers] = useState<string[]>(initialAllowed)
  const [blockedTickers, setBlockedTickers] = useState<string[]>(initialBlocked)
  const [newAllowed, setNewAllowed] = useState('')
  const [newBlocked, setNewBlocked] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAddAllowed = () => {
    const ticker = newAllowed.toUpperCase().trim()
    if (ticker && !allowedTickers.includes(ticker)) {
      setAllowedTickers([...allowedTickers, ticker])
      setNewAllowed('')
    }
  }

  const handleAddBlocked = () => {
    const ticker = newBlocked.toUpperCase().trim()
    if (ticker && !blockedTickers.includes(ticker)) {
      setBlockedTickers([...blockedTickers, ticker])
      setNewBlocked('')
    }
  }

  const handleRemoveAllowed = (ticker: string) => {
    setAllowedTickers(allowedTickers.filter(t => t !== ticker))
  }

  const handleRemoveBlocked = (ticker: string) => {
    setBlockedTickers(blockedTickers.filter(t => t !== ticker))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(allowedTickers, blockedTickers)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = 
    JSON.stringify(allowedTickers) !== JSON.stringify(initialAllowed) ||
    JSON.stringify(blockedTickers) !== JSON.stringify(initialBlocked)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticker Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Allowed Tickers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Allowed Tickers (leave empty for all)
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newAllowed}
              onChange={(e) => setNewAllowed(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleAddAllowed()}
              placeholder="Enter ticker symbol"
              disabled={isLoading}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddAllowed}
              disabled={isLoading || !newAllowed.trim()}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {allowedTickers.length === 0 ? (
              <span className="text-sm text-gray-400">All tickers allowed</span>
            ) : (
              allowedTickers.map((ticker) => (
                <span
                  key={ticker}
                  className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                >
                  {ticker}
                  <button
                    onClick={() => handleRemoveAllowed(ticker)}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Blocked Tickers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Blocked Tickers
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newBlocked}
              onChange={(e) => setNewBlocked(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleAddBlocked()}
              placeholder="Enter ticker symbol"
              disabled={isLoading}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddBlocked}
              disabled={isLoading || !newBlocked.trim()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Block
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {blockedTickers.length === 0 ? (
              <span className="text-sm text-gray-400">No tickers blocked</span>
            ) : (
              blockedTickers.map((ticker) => (
                <span
                  key={ticker}
                  className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
                >
                  {ticker}
                  <button
                    onClick={() => handleRemoveBlocked(ticker)}
                    className="ml-1 text-red-600 hover:text-red-800"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Filters'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
