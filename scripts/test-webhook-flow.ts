/**
 * Test Webhook Flow Script
 * 
 * Sends a test webhook and verifies it appears in the monitoring system.
 * 
 * Usage: npx ts-node scripts/test-webhook-flow.ts
 */

import crypto from 'crypto'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.TRADINGVIEW_WEBHOOK_SECRET

async function main() {
  console.log('🧪 Testing Webhook Flow\n')
  console.log(`Base URL: ${BASE_URL}`)
  
  if (!WEBHOOK_SECRET) {
    console.error('❌ TRADINGVIEW_WEBHOOK_SECRET not set')
    console.log('Set it with: $env:TRADINGVIEW_WEBHOOK_SECRET="your-secret"')
    process.exit(1)
  }

  // Step 1: Check initial webhook count
  console.log('\n📊 Step 1: Checking initial state...')
  const initialDebug = await fetch(`${BASE_URL}/api/monitoring/debug`).then(r => r.json())
  console.log(`   Webhooks: ${initialDebug.webhooks?.total || 0}`)
  console.log(`   Signals: ${initialDebug.signals?.total || 0}`)

  // Step 2: Generate test payload
  console.log('\n📝 Step 2: Generating test payload...')
  const payload = {
    action: 'LONG',
    ticker: 'TEST',
    timestamp: Date.now(),
    timeframe_minutes: 15,
    price: { entry: 100.50 },
    volume: {
      z_score: 2.1,
      buy_percent: 65,
      sell_percent: 35,
      buyers_winning: true,
    },
    structure: {
      trend: 'BULLISH',
      vwap_position: 'ABOVE',
      at_atr_level: false,
    },
    oscillator: {
      value: 35,
      phase: 'ACCUMULATION',
      compression: false,
      leaving_accumulation: true,
      leaving_extreme_down: false,
      leaving_distribution: false,
      leaving_extreme_up: false,
    },
    suggested_levels: {
      stop_loss: 98.50,
      target_1: 104.50,
      atr: 2.0,
    },
    quality: 4,
  }

  const payloadString = JSON.stringify(payload)
  console.log(`   Ticker: ${payload.ticker}`)
  console.log(`   Action: ${payload.action}`)
  console.log(`   Payload size: ${payloadString.length} bytes`)

  // Step 3: Sign the payload
  console.log('\n🔐 Step 3: Signing payload...')
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET)
  hmac.update(payloadString)
  const signature = hmac.digest('hex')
  console.log(`   Signature: ${signature.substring(0, 16)}...`)

  // Step 4: Send webhook
  console.log('\n🚀 Step 4: Sending webhook...')
  const startTime = Date.now()
  
  try {
    const response = await fetch(`${BASE_URL}/api/webhooks/tradingview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tradingview-signature': signature,
      },
      body: payloadString,
    })

    const result = await response.json()
    const elapsed = Date.now() - startTime

    if (response.ok) {
      console.log(`   ✅ Success! (${elapsed}ms)`)
      console.log(`   Signal ID: ${result.signalId}`)
      console.log(`   Webhook ID: ${result.webhookId || 'not returned'}`)
      console.log(`   Processing time: ${result.processingTime}ms`)
    } else {
      console.log(`   ❌ Failed: ${result.error}`)
      console.log(`   Status: ${response.status}`)
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }

  // Step 5: Wait and check monitoring
  console.log('\n⏳ Step 5: Waiting 2 seconds for database write...')
  await new Promise(r => setTimeout(r, 2000))

  // Step 6: Verify in monitoring
  console.log('\n🔍 Step 6: Checking monitoring system...')
  const finalDebug = await fetch(`${BASE_URL}/api/monitoring/debug`).then(r => r.json())
  
  const webhookDiff = (finalDebug.webhooks?.total || 0) - (initialDebug.webhooks?.total || 0)
  const signalDiff = (finalDebug.signals?.total || 0) - (initialDebug.signals?.total || 0)

  console.log(`   Webhooks: ${finalDebug.webhooks?.total || 0} (+${webhookDiff})`)
  console.log(`   Signals: ${finalDebug.signals?.total || 0} (+${signalDiff})`)

  if (webhookDiff > 0) {
    console.log('\n   ✅ Webhook recorded in WebhookLog table!')
  } else {
    console.log('\n   ⚠️  Webhook NOT recorded in WebhookLog table')
    console.log('   Check Vercel logs for errors')
  }

  if (signalDiff > 0) {
    console.log('   ✅ Signal created in Signal table!')
  } else {
    console.log('   ⚠️  Signal NOT created')
  }

  // Step 7: Check webhook feed API
  console.log('\n📡 Step 7: Checking webhook feed API...')
  const webhookFeed = await fetch(`${BASE_URL}/api/monitoring/webhooks?timeRange=1h&limit=5`).then(r => r.json())
  
  if (webhookFeed.data && webhookFeed.data.length > 0) {
    console.log(`   Found ${webhookFeed.pagination?.total || webhookFeed.data.length} webhooks`)
    console.log('   Latest webhook:')
    const latest = webhookFeed.data[0]
    console.log(`     ID: ${latest.id}`)
    console.log(`     Status: ${latest.status}`)
    console.log(`     Ticker: ${latest.ticker || 'N/A'}`)
    console.log(`     Time: ${latest.createdAt}`)
  } else {
    console.log('   No webhooks found in feed')
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  if (webhookDiff > 0 && signalDiff > 0) {
    console.log('✅ TEST PASSED: Webhook flow is working correctly!')
    console.log('   Webhooks should appear on /monitoring dashboard')
  } else if (signalDiff > 0 && webhookDiff === 0) {
    console.log('⚠️  PARTIAL: Signal created but webhook not logged')
    console.log('   Check WebhookMonitor.recordWebhookRequest for errors')
  } else {
    console.log('❌ TEST FAILED: Check the logs above for issues')
  }
  console.log('='.repeat(50))
}

main().catch(console.error)
