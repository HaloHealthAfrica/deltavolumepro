'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EquityPoint {
  date: string
  value: number
}

interface EquityChartProps {
  data: EquityPoint[]
}

export function EquityChart({ data }: EquityChartProps) {
  // Calculate min/max for scaling
  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  // Generate SVG path
  const width = 100
  const height = 40
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d.value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const currentValue = data[data.length - 1]?.value || 0
  const startValue = data[0]?.value || 0
  const change = currentValue - startValue
  const changePercent = startValue > 0 ? (change / startValue) * 100 : 0

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Equity Curve</span>
          <span className={`text-sm font-normal ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          {data.length > 1 ? (
            <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#e5e7eb" strokeWidth="0.5" />
              <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#e5e7eb" strokeWidth="0.5" />
              <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#e5e7eb" strokeWidth="0.5" />
              
              {/* Area fill */}
              <polygon
                points={`0,${height} ${points} ${width},${height}`}
                fill={change >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}
              />
              
              {/* Line */}
              <polyline
                points={points}
                fill="none"
                stroke={change >= 0 ? '#22c55e' : '#ef4444'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>
        
        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <div className="text-gray-500">Starting</div>
            <div className="font-medium">${startValue.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500">Current</div>
            <div className="font-medium">${currentValue.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-gray-500">Change</div>
            <div className={`font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}${change.toLocaleString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
