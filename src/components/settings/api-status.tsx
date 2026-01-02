/**
 * API Status Component
 * Displays status of API integrations
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ApiStatusProps {
  status: {
    tradier: boolean
    twelvedata: boolean
    alpaca: boolean
    webhook: boolean
  }
}

export function ApiStatus({ status }: ApiStatusProps) {
  const apis = [
    { name: 'Tradier', key: 'tradier' as const, description: 'Options data, quotes, Greeks' },
    { name: 'TwelveData', key: 'twelvedata' as const, description: 'Technical indicators, volume' },
    { name: 'Alpaca', key: 'alpaca' as const, description: 'Market data, paper trading' },
    { name: 'Webhook Secret', key: 'webhook' as const, description: 'TradingView authentication' },
  ]

  const configuredCount = Object.values(status).filter(Boolean).length
  const totalCount = Object.keys(status).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>API Configuration</span>
          <span className={`text-sm font-normal ${
            configuredCount === totalCount ? 'text-green-600' : 'text-yellow-600'
          }`}>
            {configuredCount}/{totalCount} configured
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {apis.map((api) => (
            <div
              key={api.key}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <div className="font-medium">{api.name}</div>
                <div className="text-sm text-gray-500">{api.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  status[api.key] ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-sm font-medium ${
                  status[api.key] ? 'text-green-600' : 'text-red-600'
                }`}>
                  {status[api.key] ? 'Configured' : 'Not Set'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-blue-50 p-3">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> API keys are configured via environment variables for security.
            Update your <code className="bg-blue-100 px-1 rounded">.env.local</code> file to add or modify API keys.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
