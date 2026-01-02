'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface KPIData {
  totalTrades: number
  winRate: number
  totalPnL: number
  avgRMultiple: number
  openPositions: number
  todaySignals: number
}

interface KPICardsProps {
  data: KPIData
}

export function KPICards({ data }: KPICardsProps) {
  const kpis = [
    {
      title: 'Total Trades',
      value: data.totalTrades.toString(),
      change: null,
      icon: '📈'
    },
    {
      title: 'Win Rate',
      value: `${(data.winRate * 100).toFixed(1)}%`,
      change: data.winRate >= 0.5 ? 'positive' : 'negative',
      icon: '🎯'
    },
    {
      title: 'Total P&L',
      value: `$${data.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      change: data.totalPnL >= 0 ? 'positive' : 'negative',
      icon: '💰'
    },
    {
      title: 'Avg R-Multiple',
      value: `${data.avgRMultiple.toFixed(2)}R`,
      change: data.avgRMultiple >= 1 ? 'positive' : 'negative',
      icon: '📊'
    },
    {
      title: 'Open Positions',
      value: data.openPositions.toString(),
      change: null,
      icon: '💼'
    },
    {
      title: "Today's Signals",
      value: data.todaySignals.toString(),
      change: null,
      icon: '📡'
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              {kpi.title}
            </CardTitle>
            <span className="text-xl">{kpi.icon}</span>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              kpi.change === 'positive' ? 'text-green-600' :
              kpi.change === 'negative' ? 'text-red-600' :
              'text-gray-900'
            }`}>
              {kpi.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
