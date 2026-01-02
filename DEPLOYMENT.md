# DeltaStackPro Deployment Guide

This guide covers deploying DeltaStackPro to production on Vercel with a PostgreSQL database.

## Prerequisites

- Node.js 18+ installed locally
- Vercel account (https://vercel.com)
- PostgreSQL database (Vercel Postgres, Neon, Supabase, or similar)
- Clerk account for authentication (https://clerk.com)
- Pusher account for real-time updates (https://pusher.com)
- API keys for brokers (Tradier, TwelveData, Alpaca)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd deltastackpro
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in all required values in `.env.local`.

### 3. Set Up Database

For local development (SQLite):
```bash
npx prisma migrate dev
npx prisma db seed
```

For production (PostgreSQL):
```bash
# Update DATABASE_URL in .env.local to your PostgreSQL connection string
npx prisma migrate deploy
npx prisma db seed
```

### 4. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

## Vercel Deployment

### 1. Connect Repository

1. Go to https://vercel.com/new
2. Import your Git repository
3. Select the `deltastackpro` directory as the root

### 2. Configure Environment Variables

In Vercel project settings, add all environment variables from `.env.example`:

**Required Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `TRADINGVIEW_WEBHOOK_SECRET` - Webhook validation secret
- `ENCRYPTION_KEY` - 32-byte hex string for encryption

**Broker API Keys:**
- `TRADIER_API_KEY`, `TRADIER_ACCOUNT_ID`
- `TWELVEDATA_API_KEY`
- `ALPACA_API_KEY`, `ALPACA_API_SECRET`

**Real-time (Pusher):**
- `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
- `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`

### 3. Database Setup

If using Vercel Postgres:
1. Go to Storage tab in Vercel dashboard
2. Create a new Postgres database
3. Copy the connection string to `DATABASE_URL`

Run migrations:
```bash
npx prisma migrate deploy
```

### 4. Deploy

Push to your main branch or click "Deploy" in Vercel dashboard.

## TradingView Webhook Setup

1. Get your deployment URL (e.g., `https://your-app.vercel.app`)
2. In TradingView, create an alert with webhook URL:
   ```
   https://your-app.vercel.app/api/webhooks/tradingview
   ```
3. Set the webhook message format (see Webhook Format section below)
4. Add the `X-Webhook-Signature` header with HMAC-SHA256 signature

### Webhook Format

```json
{
  "action": "LONG",
  "ticker": "{{ticker}}",
  "timestamp": {{timenow}},
  "timeframe_minutes": 15,
  "price": { "entry": {{close}} },
  "quality": 4,
  "volume": {
    "z_score": 1.5,
    "buy_percent": 65,
    "sell_percent": 35,
    "buyers_winning": true
  },
  "structure": {
    "trend": "BULLISH",
    "vwap_position": "ABOVE",
    "at_atr_level": true
  },
  "oscillator": {
    "value": 0.3,
    "phase": "ACCUMULATION",
    "compression": false,
    "leaving_accumulation": true,
    "leaving_extreme_down": false,
    "leaving_distribution": false,
    "leaving_extreme_up": false
  },
  "suggested_levels": {
    "stop_loss": 172.00,
    "target_1": 180.00,
    "atr": 2.50
  }
}
```

## Monitoring

### Health Check Endpoint

```
GET /api/health
```

Returns system health status including database connectivity.

### Monitoring Dashboard

```
GET /api/monitoring
```

Returns comprehensive system metrics:
- Signal processing statistics
- Decision engine metrics
- Trade performance
- System health status

## Security Considerations

1. **Webhook Validation**: All webhooks are validated using HMAC-SHA256 signatures
2. **Rate Limiting**: API endpoints are rate-limited to prevent abuse
3. **Encryption**: Sensitive data (API keys) are encrypted at rest using AES-256
4. **Authentication**: All routes are protected by Clerk authentication
5. **HTTPS**: Vercel automatically provides SSL/TLS certificates

## Troubleshooting

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Check if database allows connections from Vercel IPs
3. Ensure SSL mode is enabled for production

### Webhook Not Receiving

1. Check webhook URL is correct
2. Verify `TRADINGVIEW_WEBHOOK_SECRET` matches
3. Check Vercel function logs for errors

### Real-time Updates Not Working

1. Verify Pusher credentials are correct
2. Check browser console for WebSocket errors
3. Ensure `NEXT_PUBLIC_PUSHER_*` variables are set

## Support

For issues and questions:
- Check the logs in Vercel dashboard
- Review the monitoring endpoint for system status
- Open an issue in the repository
