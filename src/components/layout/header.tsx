'use client'

import { UserButton } from '@/components/auth'
import { ConnectionStatus } from '@/components/realtime'

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-700 bg-slate-800 px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">Trading Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Real-time connection status */}
        <ConnectionStatus />

        {/* Market status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Market:</span>
          <span className="font-medium text-green-400">Open</span>
        </div>

        {/* User menu with admin badge */}
        <UserButton />
      </div>
    </header>
  )
}
