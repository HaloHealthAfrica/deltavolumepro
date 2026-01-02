/**
 * Connection Status Indicator
 * Shows real-time connection status in the UI
 */

'use client'

import { useRealtimeConnection } from '@/hooks/use-realtime'

export function ConnectionStatus() {
  const { isConnected, connectionState } = useRealtimeConnection()

  const statusColors = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-red-500',
    unavailable: 'bg-gray-500',
    failed: 'bg-red-500',
  }

  const color = statusColors[connectionState as keyof typeof statusColors] || 'bg-gray-500'

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-500 capitalize">
        {isConnected ? 'Live' : connectionState}
      </span>
    </div>
  )
}
