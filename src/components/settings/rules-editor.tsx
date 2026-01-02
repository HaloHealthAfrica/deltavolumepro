/**
 * Trading Rules Editor Component
 * Interactive editor for trading rules configuration
 */

'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WeightSlider } from './weight-slider'
import { ThresholdInput } from './threshold-input'

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
}

interface RulesEditorProps {
  rules: TradingRules
  onSave: (updates: Partial<TradingRules>) => Promise<void>
  isLoading?: boolean
}

export function RulesEditor({ rules, onSave, isLoading = false }: RulesEditorProps) {
  const [weights, setWeights] = useState({
    qualityWeight: rules.qualityWeight,
    volumeWeight: rules.volumeWeight,
    oscillatorWeight: rules.oscillatorWeight,
    structureWeight: rules.structureWeight,
    marketWeight: rules.marketWeight,
  })

  const [thresholds, setThresholds] = useState({
    minQuality: rules.minQuality,
    minConfidence: rules.minConfidence,
    minVolumePressure: rules.minVolumePressure,
    maxRiskPercent: rules.maxRiskPercent,
    compressionMultiplier: rules.compressionMultiplier,
  })

  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)

  const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0)
  const isWeightValid = Math.abs(weightSum - 1.0) < 0.01

  const handleWeightChange = useCallback((key: keyof typeof weights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }, [])

  const handleThresholdChange = useCallback((key: keyof typeof thresholds, value: number) => {
    setThresholds(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }, [])

  const handleSave = async () => {
    if (!isWeightValid) return

    setSaving(true)
    try {
      await onSave({
        ...weights,
        ...thresholds,
      })
      setHasChanges(false)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setWeights({
      qualityWeight: rules.qualityWeight,
      volumeWeight: rules.volumeWeight,
      oscillatorWeight: rules.oscillatorWeight,
      structureWeight: rules.structureWeight,
      marketWeight: rules.marketWeight,
    })
    setThresholds({
      minQuality: rules.minQuality,
      minConfidence: rules.minConfidence,
      minVolumePressure: rules.minVolumePressure,
      maxRiskPercent: rules.maxRiskPercent,
      compressionMultiplier: rules.compressionMultiplier,
    })
    setHasChanges(false)
  }

  return (
    <div className="space-y-6">
      {/* Factor Weights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Factor Weights</span>
            <span className={`text-sm font-normal ${isWeightValid ? 'text-green-600' : 'text-red-600'}`}>
              Sum: {(weightSum * 100).toFixed(0)}% {isWeightValid ? '✓' : '(must equal 100%)'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <WeightSlider
            label="Quality Weight"
            value={weights.qualityWeight}
            onChange={(v) => handleWeightChange('qualityWeight', v)}
            disabled={isLoading}
          />
          <WeightSlider
            label="Volume Weight"
            value={weights.volumeWeight}
            onChange={(v) => handleWeightChange('volumeWeight', v)}
            disabled={isLoading}
          />
          <WeightSlider
            label="Oscillator Weight"
            value={weights.oscillatorWeight}
            onChange={(v) => handleWeightChange('oscillatorWeight', v)}
            disabled={isLoading}
          />
          <WeightSlider
            label="Structure Weight"
            value={weights.structureWeight}
            onChange={(v) => handleWeightChange('structureWeight', v)}
            disabled={isLoading}
          />
          <WeightSlider
            label="Market Weight"
            value={weights.marketWeight}
            onChange={(v) => handleWeightChange('marketWeight', v)}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle>Decision Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <ThresholdInput
              label="Minimum Quality"
              value={thresholds.minQuality}
              onChange={(v) => handleThresholdChange('minQuality', v)}
              min={1}
              max={5}
              step={1}
              suffix="/5"
              disabled={isLoading}
              description="Minimum signal quality rating"
            />
            <ThresholdInput
              label="Minimum Confidence"
              value={thresholds.minConfidence * 100}
              onChange={(v) => handleThresholdChange('minConfidence', v / 100)}
              min={0}
              max={100}
              step={5}
              suffix="%"
              disabled={isLoading}
              description="Minimum decision confidence"
            />
            <ThresholdInput
              label="Min Volume Pressure"
              value={thresholds.minVolumePressure}
              onChange={(v) => handleThresholdChange('minVolumePressure', v)}
              min={0}
              max={100}
              step={5}
              suffix="%"
              disabled={isLoading}
              description="Minimum buying/selling pressure"
            />
            <ThresholdInput
              label="Max Risk Percent"
              value={thresholds.maxRiskPercent}
              onChange={(v) => handleThresholdChange('maxRiskPercent', v)}
              min={0.1}
              max={10}
              step={0.1}
              suffix="%"
              disabled={isLoading}
              description="Maximum risk per trade"
            />
            <ThresholdInput
              label="Compression Multiplier"
              value={thresholds.compressionMultiplier}
              onChange={(v) => handleThresholdChange('compressionMultiplier', v)}
              min={0.1}
              max={1}
              step={0.1}
              suffix="x"
              disabled={isLoading}
              description="Position size reduction during compression"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleReset}
          disabled={!hasChanges || saving}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset Changes
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || !isWeightValid || saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
