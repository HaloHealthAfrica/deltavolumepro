/**
 * Timeframe Filter Component
 * Configure allowed timeframes for signal processing
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const COMMON_TIMEFRAMES = [
  { value: 1, label: '1m' },
  { value: 5, label: '5m' },
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 240, label: '4h' },
  { value: 1440, label: '1D' },
]

interface TimeframeFilterProps {
  allowedTimeframes: number[]
  onUpdate: (timeframes: number[]) => Promise<void>
  isLoading?: boolean
}

export function TimeframeFilter({
  allowedTimeframes: initialTimeframes,
  onUpdate,
  isLoading = false,
}: TimeframeFilterProps) {
  const [selectedTimeframes, setSelectedTimeframes] = useState<number[]>(
    initialTimeframes.length > 0 ? initialTimeframes : COMMON_TIMEFRAMES.map(t => t.value)
  )
  const [saving, setSaving] = useState(false)

  const toggleTimeframe = (value: number) => {
    if (selectedTimeframes.includes(value)) {
      // Don't allow removing all timeframes
      if (selectedTimeframes.length > 1) {
        setSelectedTimeframes(selectedTimeframes.filter(t => t !== value))
      }
    } else {
      setSelectedTimeframes([...selectedTimeframes, value])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(selectedTimeframes)
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = JSON.stringify(selectedTimeframes.sort()) !== JSON.stringify(initialTimeframes.sort())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeframe Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          Select which timeframes to process signals for. At least one timeframe must be selected.
        </p>

        <div className="flex flex-wrap gap-2">
          {COMMON_TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => toggleTimeframe(tf.value)}
              disabled={isLoading}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedTimeframes.includes(tf.value)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="text-sm text-gray-500">
          {selectedTimeframes.length === COMMON_TIMEFRAMES.length
            ? 'All timeframes enabled'
            : `${selectedTimeframes.length} timeframe${selectedTimeframes.length !== 1 ? 's' : ''} enabled`}
        </div>

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Timeframes'}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
