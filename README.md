# DeltaStackPro

A comprehensive trading application that processes TradingView signals, enriches them with multi-source market data, makes intelligent trading decisions, and executes paper trades across multiple brokers while continuously learning and optimizing performance.

## Features

### 🎯 Signal Processing
- **TradingView Integration**: Secure webhook receiver with HMAC signature validation
- **Real-time Processing**: Background job queue for signal processing
- **Comprehensive Validation**: Multi-layer payload validation and error handling

### 📊 Data Enrichment
- **Multi-Source Data**: Integrates with Tradier, TwelveData, and Alpaca APIs
- **Parallel Processing**: Concurrent data fetching with intelligent fallbacks
- **Quality Scoring**: Data consistency validation and quality metrics

### 🧠 Intelligent Decision Engine
- **Weighted Scoring**: Configurable factor weights for decision making
- **Risk Management**: Quality thresholds, volume pressure, and risk limits
- **Instrument Selection**: Smart selection between stocks, options, and spreads
- **Position Sizing**: Dynamic sizing based on signal quality and market conditions

### 📈 Multi-Broker Paper Trading
- **Simultaneous Execution**: Orders placed across multiple brokers
- **Real-time Monitoring**: Live position tracking and P&L updates
- **Exit Management**: Automated stop losses, targets, and trailing stops

### 🤖 Learning Engine
- **Performance Analysis**: Comprehensive trade analysis and classification
- **Rule Optimization**: Continuous improvement of trading rules
- **Backtesting**: Validation of new rules against historical data
- **Insight Generation**: Automated improvement suggestions

### 🖥️ User Interface
- **Real-time Dashboard**: Live performance metrics and charts
- **Signal Feed**: Real-time signal processing with decision reasoning
- **Position Management**: Active trade monitoring and management
- **Trade History**: Comprehensive trade analysis and filtering
- **Configuration**: Interactive settings for rules and parameters

### 🔒 Security & Performance
- **Rate Limiting**: Comprehensive API protection
- **Encryption**: AES-256 encryption for sensitive data
- **Caching**: Intelligent caching with appropriate TTLs
- **Monitoring**: Error tracking and performance metrics
- **Authentication**: Secure user authentication with Clerk

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (for production) or SQLite (for development)
- API keys for brokers (Tradier, TwelveData, Alpaca)
- Clerk account for authentication
- Pusher account for real-time updates

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd deltastackpro
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys and configuration
   ```

3. **Set up database**
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Visit the application**
   Open http://localhost:3000

## Architecture

### Core Components

- **Webhook Receiver** (`/api/webhooks/tradingview`): Processes TradingView signals
- **Data Enrichment Engine**: Fetches and aggregates market data from multiple sources
- **Decision Engine**: Evaluates signals and makes trading decisions
- **Paper Trading System**: Executes and monitors trades across brokers
- **Learning Engine**: Analyzes performance and optimizes rules
- **Real-time Communication**: WebSocket updates via Pusher

### Database Schema

- **Signals**: Raw webhook data and processing status
- **EnrichedData**: Aggregated market data and quality metrics
- **Decisions**: Trading decisions with reasoning and confidence
- **Trades**: Paper trade execution and performance tracking
- **TradeAnalysis**: Detailed trade analysis and learning data
- **TradingRules**: Configurable decision engine parameters

### API Endpoints

- `GET /api/health` - System health check
- `POST /api/webhooks/tradingview` - TradingView webhook receiver
- `GET /api/monitoring` - System metrics and monitoring
- `GET /api/monitoring/errors` - Error tracking and statistics
- `GET /api/settings/rules` - Trading rules configuration

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Vercel Deployment

1. **Connect repository to Vercel**
2. **Configure environment variables**
3. **Set up PostgreSQL database**
4. **Deploy**

The application is optimized for Vercel's serverless environment with proper function timeouts and caching strategies.

## Configuration

### Trading Rules

Configure decision engine parameters:
- **Quality Weight**: Importance of signal quality (0-1)
- **Volume Weight**: Importance of volume pressure (0-1)
- **Oscillator Weight**: Importance of oscillator phase (0-1)
- **Structure Weight**: Importance of structure alignment (0-1)
- **Market Weight**: Importance of technical confirmation (0-1)

### Risk Parameters

- **Minimum Quality**: Required signal quality (1-5)
- **Minimum Confidence**: Required decision confidence (0-1)
- **Minimum Volume Pressure**: Required volume pressure (0-100)
- **Maximum Risk**: Maximum account risk percentage (0-100)

### Broker Configuration

Configure API keys and settings for:
- **Tradier**: Options data and execution
- **TwelveData**: Technical indicators and market data
- **Alpaca**: Market data and trade execution

## Monitoring

### System Health

- **Database Connectivity**: Real-time database health checks
- **Broker Connections**: API connectivity status
- **Real-time Communication**: WebSocket connection status

### Performance Metrics

- **Signal Processing**: Volume and processing times
- **Decision Engine**: Decision rates and confidence levels
- **Trading Performance**: P&L, win rates, and risk metrics
- **Error Tracking**: Error rates and resolution status

### Alerts

Critical errors trigger immediate alerts:
- Database connectivity issues
- Authentication failures
- Trade execution errors
- System performance degradation

## Testing

### Test Suite

- **Unit Tests**: Component-level testing
- **Integration Tests**: End-to-end workflow validation
- **Property Tests**: Universal correctness properties

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:property
```

## Development

### Project Structure

```
src/
├── app/                 # Next.js app router
│   ├── api/            # API routes
│   └── (pages)/        # UI pages
├── components/         # React components
├── lib/               # Core business logic
│   ├── api-clients/   # External API clients
│   ├── realtime/      # WebSocket communication
│   └── *.ts           # Core modules
└── test/              # Test suites
```

### Key Modules

- **webhook-utils.ts**: Webhook validation and parsing
- **data-enrichment.ts**: Multi-source data aggregation
- **decision-engine.ts**: Trading decision logic
- **paper-trading.ts**: Trade execution and monitoring
- **learning-engine.ts**: Performance analysis and optimization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

[License information]

## Support

For questions and support:
- Check the [deployment guide](./DEPLOYMENT.md)
- Review the monitoring endpoints
- Open an issue in the repository