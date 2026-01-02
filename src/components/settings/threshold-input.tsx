/**
 * Threshold Input Component
 * Input field for threshold values with validation
 */

'use client'

import { useState, useEffect } from 'react'

interface ThresholdInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
  description?: string
}

export function ThresholdInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
  disabled = false,
  description,
}: ThresholdInputProps) {
  const [localValue, setLocalValue] = useState(value.toString())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLocalValue(value.toString())
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setLocalValue(inputValue)

    const numValue = parseFloat(inputValue)
    if (isNaN(numValue)) {
      setError('Please enter a valid number')
      return
    }

    if (numValue < min || numValue > max) {
      setError(`Value must be between ${min} and ${max}`)
      return
    }

    setError(null)
    onChange(numValue)
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={handleChange}
          disabled={disabled}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            error 
              ? 'border-red-300 focus:ring-red-500' 
              : 'border-gray-300 focus:ring-blue-500'
          } disabled:bg-gray-100 disabled:cursor-not-allowed`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {description && !error && (
        <p className="text-xs text-gray-400">{description}</p>
      )}
    </div>
  )
}
