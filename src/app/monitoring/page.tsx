'use client'

import { Suspense } from 'react'
import { MonitoringDashboard } from '@/components/monitoring/monitoring-dashboard'

export default function MonitoringPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Webhook Monitoring</h2>
      </div>
      <Suspense fallback={<MonitoringLoadingSkeleton />}>
        <MonitoringDashboard />
      </Suspense>
    </div>
  )
}

function MonitoringLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="h-96 rounded-lg bg-gray-100 animate-pulse" />
    </div>
  )
}
