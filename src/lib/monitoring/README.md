# Webhook Monitoring System

A comprehensive webhook monitoring system for the DeltaStack Pro application that provides real-time tracking, performance metrics, and health monitoring for webhook processing pipelines.

## Overview

The webhook monitoring system consists of several key components:

- **WebhookMonitor**: Main service for tracking webhook requests and processing stages
- **Interfaces**: TypeScript interfaces defining the monitoring contracts
- **Types**: Comprehensive type definitions for monitoring data structures
- **Examples**: Usage examples and integration patterns

## Features

### 🔍 Webhook Request Tracking
- Record incoming webhook requests with complete metadata
- Track processing results, timing, and error information
- Support for filtering and pagination
- Integration with existing Signal processing workflow

### 📊 Processing Stage Management
- Track webhook processing through multiple pipeline stages
- Monitor stage timing and completion status
- Support for stage metadata and error tracking
- Pipeline status visualization

### 📈 Performance Monitoring
- Real-time performance metrics calculation
- Historical performance analysis
- Processing time percentiles (P95, P99)
- Throughput and error rate tracking

### 🏥 Health Monitoring
- System health status checks
- Database connectivity monitoring
- Memory and queue health tracking
- External API status monitoring

### 🚨 Error Handling
- Comprehensive error classification
- Structured error reporting
- Validation and state management
- Database error recovery

## Quick Start

### Basic Usage

```typescript
import { WebhookMonitor } from '@/lib/monitoring'

const monitor = new WebhookMonitor()

// Record a webhook request
const webhook = await monitor.recordWebhookRequest({
  sourceIp: '192.168.1.100',
  userAgent: 'TradingView-Webhook/1.0',
  headers: { 'content-type': 'application/json' },
  payload: { action: 'LONG', ticker: 'AAPL' },
  payloadSize: 1024,
  processingTime: 150,
  status: 'success'
})

// Track processing stages
const stage = await monitor.startProcessingStage({
  signalId: 'signal_123',
  stage: 'enriching',
  startedAt: new Date(),
  status: 'in_progress'
})

// Complete the stage
await monitor.completeProcessingStage(
  stage.id,
  'completed',
  { dataQuality: 0.95 }
)

// Get performance metrics
const metrics = await monitor.getPerformanceMetrics('last_24_hours')
console.log(`Success rate: ${metrics.successRate}%`)

// Check system health
const health = await monitor.getSystemHealth()
console.log(`System status: ${health.status}`)
```

### Integration with Webhook Processing

```typescript
import { WebhookMonitor } from '@/lib/monitoring'

export async function processWebhook(payload: any, headers: Record<string, string>) {
  const monitor = new WebhookMonitor()
  const startTime = Date.now()
  
  try {
    // Record incoming webhook
    const webhook = await monitor.recordWebhookRequest({
      sourceIp: headers['x-forwarded-for'] || 'unknown',
      userAgent: headers['user-agent'],
      headers,
      payload,
      payloadSize: JSON.stringify(payload).length,
      processingTime: 0, // Will update later
      status: 'success'
    })

    // Process webhook (your existing logic)
    const signal = await createSignalFromWebhook(payload)
    
    // Track processing stages
    await trackProcessingPipeline(monitor, signal.id)
    
    // Update webhook with results
    await monitor.updateWebhookRequest(webhook.id, {
      processingTime: Date.now() - startTime,
      signalId: signal.id
    })

    return { success: true, signalId: signal.id }
  } catch (error) {
    // Record error
    await monitor.updateWebhookRequest(webhook.id, {
      processingTime: Date.now() - startTime,
      status: 'failed',
      errorMessage: error.message
    })
    throw error
  }
}
```

## API Reference

### WebhookMonitor Class

#### Webhook Request Management

##### `recordWebhookRequest(request: CreateWebhookRequestInput): Promise<WebhookRequest>`
Records a new incoming webhook request.

**Parameters:**
- `request`: Webhook request data including source IP, headers, payload, etc.

**Returns:** Promise resolving to the created webhook request record.

**Throws:**
- `ValidationError`: When request data is invalid
- `DatabaseError`: When database operation fails

##### `updateWebhookRequest(id: string, updates: Partial<UpdateWebhookRequestInput>): Promise<WebhookRequest>`
Updates an existing webhook request with processing results.

##### `getWebhookRequest(id: string, includeRelations?: boolean): Promise<WebhookRequestWithRelations | null>`
Retrieves a webhook request by ID with optional related data.

##### `getWebhookRequests(filters?: MonitoringFilters): Promise<MonitoringPaginatedResponse<WebhookRequestWithRelations>>`
Gets paginated list of webhook requests with filtering support.

#### Processing Stage Management

##### `startProcessingStage(stage: CreateProcessingStageInput): Promise<ProcessingStage>`
Starts tracking a new processing stage.

##### `completeProcessingStage(id: string, status: 'completed' | 'failed', metadata?: Record<string, any>, errorMessage?: string): Promise<ProcessingStage>`
Completes a processing stage with results.

##### `getProcessingStages(signalId: string): Promise<ProcessingStage[]>`
Gets processing stages for a specific signal.

##### `getPipelineStatus(signalId: string): Promise<PipelineStatus | null>`
Gets current pipeline status for a signal.

##### `getActiveProcessingStages(): Promise<ProcessingStage[]>`
Gets all active processing stages across all signals.

#### Performance Monitoring

##### `getPerformanceMetrics(timeRange: TimeRange, customStart?: Date, customEnd?: Date): Promise<PerformanceMetrics>`
Gets performance metrics for a specific time period.

##### `getRealTimeMetrics(): Promise<RealTimeMetrics>`
Gets real-time metrics snapshot.

##### `getProcessingStatistics(filters?: MonitoringFilters): Promise<ProcessingStatistics>`
Gets webhook processing statistics with optional filtering.

#### Health Monitoring

##### `getSystemHealth(): Promise<SystemHealth>`
Gets current system health status.

##### `performHealthCheck(): Promise<SystemHealth>`
Performs comprehensive health check on all monitored components.

## Data Models

### WebhookRequest
```typescript
interface WebhookRequest {
  id: string
  createdAt: Date
  sourceIp: string
  userAgent?: string
  headers: Record<string, string>
  payload: Record<string, any>
  payloadSize: number
  signature?: string
  processingTime: number
  status: WebhookStatus
  errorMessage?: string
  errorStack?: string
  signalId?: string
}
```

### ProcessingStage
```typescript
interface ProcessingStage {
  id: string
  createdAt: Date
  signalId: string
  stage: ProcessingStageType
  startedAt: Date
  completedAt?: Date
  duration?: number
  status: ProcessingStageStatus
  errorMessage?: string
  metadata?: Record<string, any>
}
```

### PerformanceMetrics
```typescript
interface PerformanceMetrics {
  period: { start: Date; end: Date; duration: number }
  totalWebhooks: number
  successfulWebhooks: number
  failedWebhooks: number
  successRate: number
  avgProcessingTime: number
  p95ProcessingTime: number
  p99ProcessingTime: number
  maxProcessingTime: number
  webhooksPerSecond: number
  peakWebhooksPerMinute: number
  avgQueueDepth: number
  maxQueueDepth: number
  topErrors: ErrorSummary[]
  errorTrend: TrendDirection
  signalsGenerated: number
  signalConversionRate: number
  tradesExecuted: number
  tradeConversionRate: number
}
```

## Processing Stages

The system tracks webhooks through the following processing stages:

1. **received** - Webhook received and validated
2. **enriching** - Fetching market data from external APIs
3. **enriched** - Market data enrichment completed
4. **deciding** - Running decision engine
5. **decided** - Decision made (trade/reject/wait)
6. **executing** - Executing trade with broker
7. **completed** - Processing fully completed
8. **failed** - Processing failed at this stage

## Filtering and Querying

The system supports comprehensive filtering options:

### Time-based Filtering
```typescript
// Predefined time ranges
const metrics = await monitor.getPerformanceMetrics('last_24_hours')

// Custom time range
const metrics = await monitor.getPerformanceMetrics(
  'custom',
  new Date('2024-01-01'),
  new Date('2024-01-31')
)
```

### Status Filtering
```typescript
const webhooks = await monitor.getWebhookRequests({
  webhookStatus: ['success', 'failed'],
  stageStatus: ['completed'],
  timeRange: 'last_7_days'
})
```

### Performance Filtering
```typescript
const slowWebhooks = await monitor.getWebhookRequests({
  minProcessingTime: 5000, // > 5 seconds
  timeRange: 'last_hour'
})
```

## Error Handling

The system provides structured error handling with specific error types:

### Error Types
- **ValidationError**: Invalid input data
- **NotFoundError**: Resource not found
- **ConflictError**: Resource conflicts (e.g., duplicate stages)
- **InvalidStateError**: Invalid state transitions
- **DatabaseError**: Database operation failures

### Error Handling Example
```typescript
try {
  await monitor.recordWebhookRequest(request)
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid request data:', error.details)
  } else if (error instanceof DatabaseError) {
    console.error('Database error:', error.message)
    // Implement retry logic or fallback
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields (status, createdAt, signalId)
- Efficient pagination with cursor-based queries
- Connection pooling and query optimization

### Memory Management
- Streaming large result sets
- Configurable batch sizes for bulk operations
- Automatic cleanup of old monitoring data

### Caching Strategy
- Cache frequently accessed metrics
- Real-time metrics with short TTL
- Background metric calculation for heavy queries

## Testing

The system includes comprehensive test coverage:

```bash
# Run webhook monitor tests
npm test webhook-monitor.test.ts

# Run all monitoring tests
npm test -- --grep "monitoring"
```

### Test Categories
- **Unit Tests**: Individual method testing
- **Integration Tests**: Database integration
- **Error Handling Tests**: Error scenario validation
- **Performance Tests**: Load and stress testing

## Configuration

### Environment Variables
```bash
# Database connection
DATABASE_URL="file:./dev.db"

# Logging level
LOG_LEVEL="info"

# Monitoring settings
MONITORING_RETENTION_DAYS="30"
MONITORING_BATCH_SIZE="100"
```

### Monitoring Configuration
```typescript
const config: MonitoringConfig = {
  metrics: {
    collectionInterval: 60, // seconds
    retentionDays: 30,
    enableDetailedMetrics: true,
    batchSize: 100
  },
  webhooks: {
    maxPayloadSize: 1024 * 1024, // 1MB
    logHeaders: true,
    logFullPayload: true,
    excludeHeaders: ['authorization', 'x-api-key'],
    processingTimeout: 30000 // 30 seconds
  },
  performance: {
    maxProcessingTime: 5000, // 5 seconds
    maxErrorRate: 5, // 5%
    maxQueueDepth: 100,
    minSuccessRate: 95 // 95%
  }
}
```

## Deployment

### Production Checklist
- [ ] Configure appropriate log levels
- [ ] Set up database indexes
- [ ] Configure monitoring retention policies
- [ ] Set up health check endpoints
- [ ] Configure alerting thresholds
- [ ] Test error handling scenarios
- [ ] Validate performance under load

### Monitoring Setup
1. Deploy the WebhookMonitor service
2. Configure database connections
3. Set up monitoring dashboards
4. Configure alert notifications
5. Test end-to-end functionality

## Troubleshooting

### Common Issues

#### High Memory Usage
- Check monitoring data retention settings
- Verify batch sizes for bulk operations
- Monitor database connection pool usage

#### Slow Query Performance
- Verify database indexes are in place
- Check query complexity and filtering
- Consider query optimization or caching

#### Missing Webhook Data
- Verify webhook recording is properly integrated
- Check error logs for validation failures
- Ensure database connectivity

### Debug Mode
```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug'

// Check system health
const health = await monitor.getSystemHealth()
console.log('System health:', health)

// Verify database connectivity
const metrics = await monitor.getRealTimeMetrics()
console.log('Real-time metrics:', metrics)
```

## Contributing

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up test database: `npm run db:setup`
4. Run tests: `npm test`
5. Start development server: `npm run dev`

### Code Style
- Follow existing TypeScript patterns
- Add JSDoc documentation for public methods
- Include comprehensive error handling
- Write tests for new functionality

### Pull Request Process
1. Create feature branch from main
2. Implement changes with tests
3. Update documentation
4. Submit pull request with description
5. Address review feedback

## License

This monitoring system is part of the DeltaStack Pro application and follows the same licensing terms.