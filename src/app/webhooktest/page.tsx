'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'META', 'GOOGL', 'AMZN']
const ACTIONS = ['LONG', 'LONG_PREMIUM', 'SHORT', 'SHORT_PREMIUM']
const QUALITIES = [1, 2, 3, 4, 5]

interface WebhookResult {
  success: boolean
  signalId?: string
  processingTime?: number
  webhookId?: string
  error?: string
}

export default function WebhookTestPage() {
  const [ticker, setTicker] = useState('SPY')
  const [action, setAction] = useState('LONG')
  const [quality, setQuality] = useState(4)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<WebhookResult[]>([])
  const [lastPayload, setLastPayload] = useState<any>(null)

  const sendTestWebhook = async () => {
    setIsLoading(true)
    try {
      // Generate signed payload
      const genRes = await fetch('/api/test/generate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, action, quality }),
      })

      if (!genRes.ok) {
        throw new Error('Failed to generate webhook')
      }

      const { payload, payloadString, signature } = await genRes.json()
      setLastPayload(payload)

      // Send to webhook endpoint
      const webhookRes = await fetch('/api/webhooks/tradingview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tradingview-signature': signature,
        },
        body: payloadString,
      })

      const result = await webhookRes.json()

      setResults(prev => [{
        success: webhookRes.ok,
        signalId: result.signalId,
        processingTime: result.processingTime,
        webhookId: result.webhookId,
        error: result.error,
      }, ...prev.slice(0, 9)])

    } catch (error) {
      setResults(prev => [{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, ...prev.slice(0, 9)])
    } finally {
      setIsLoading(false)
    }
  }

  const sendBulkWebhooks = async (count: number) => {
    setIsLoading(true)
    for (let i = 0; i < count; i++) {
      const randomTicker = TICKERS[Math.floor(Math.random() * TICKERS.length)]
      const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
      const randomQuality = QUALITIES[Math.floor(Math.random() * QUALITIES.length)]

      try {
        const genRes = await fetch('/api/test/generate-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ticker: randomTicker, 
            action: randomAction, 
            quality: randomQuality 
          }),
        })

        if (genRes.ok) {
          const { payloadString, signature } = await genRes.json()
          
          const webhookRes = await fetch('/api/webhooks/tradingview', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tradingview-signature': signature,
            },
            body: payloadString,
          })

          const result = await webhookRes.json()
          setResults(prev => [{
            success: webhookRes.ok,
            signalId: result.signalId,
            processingTime: result.processingTime,
            webhookId: result.webhookId,
            error: result.error,
          }, ...prev.slice(0, 19)])
        }
      } catch (error) {
        // Continue with next webhook
      }

      // Small delay between webhooks
      await new Promise(r => setTimeout(r, 200))
    }
    setIsLoading(false)
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Webhook Test Generator</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configure Test Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Ticker Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Ticker</label>
              <div className="flex flex-wrap gap-2">
                {TICKERS.map(t => (
                  <Button
                    key={t}
                    variant={ticker === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTicker(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {/* Action Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Action</label>
              <div className="flex flex-wrap gap-2">
                {ACTIONS.map(a => (
                  <Button
                    key={a}
                    variant={action === a ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAction(a)}
                    className={a.includes('LONG') ? 'border-green-500' : 'border-red-500'}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            </div>

            {/* Quality Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Quality (1-5)</label>
              <div className="flex gap-2">
                {QUALITIES.map(q => (
                  <Button
                    key={q}
                    variant={quality === q ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQuality(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>

            {/* Send Buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={sendTestWebhook} 
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? '⏳ Sending...' : '🚀 Send Webhook'}
              </Button>
              <Button 
                onClick={() => sendBulkWebhooks(5)} 
                disabled={isLoading}
                variant="outline"
              >
                Send 5
              </Button>
              <Button 
                onClick={() => sendBulkWebhooks(10)} 
                disabled={isLoading}
                variant="outline"
              >
                Send 10
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Last Payload */}
        <Card>
          <CardHeader>
            <CardTitle>Last Payload</CardTitle>
          </CardHeader>
          <CardContent>
            {lastPayload ? (
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-[300px]">
                {JSON.stringify(lastPayload, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500">Send a webhook to see the payload</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Results</span>
            {results.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setResults([])}>
                Clear
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No webhooks sent yet. Configure and send a test webhook above.
            </p>
          ) : (
            <div className="space-y-2">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${
                    result.success 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{result.success ? '✅' : '❌'}</span>
                      <span className="font-medium">
                        {result.success ? 'Success' : 'Failed'}
                      </span>
                      {result.signalId && (
                        <span className="text-sm text-gray-600">
                          Signal: {result.signalId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {result.processingTime && `${result.processingTime}ms`}
                    </div>
                  </div>
                  {result.error && (
                    <p className="text-sm text-red-600 mt-1">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>📖 Instructions</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="list-decimal list-inside space-y-2">
            <li>Select a ticker, action type, and quality level above</li>
            <li>Click "Send Webhook" to send a single test webhook</li>
            <li>Use "Send 5" or "Send 10" to send multiple random webhooks</li>
            <li>Check the <a href="/monitoring" className="text-blue-600 hover:underline">Monitoring Dashboard</a> to see webhooks appear in real-time</li>
          </ol>
          <p className="mt-4 text-gray-600">
            This page generates properly signed webhooks that simulate TradingView signals.
            The webhooks are processed through the full pipeline including monitoring.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
