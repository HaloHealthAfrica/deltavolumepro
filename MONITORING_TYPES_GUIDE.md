# Webhook Monitoring Dashboard Types Guide

This guide explains how to use the comprehensive TypeScript interfaces defined in `src/types/monitoring.ts` for the webhook monitoring dashboard system.

## Overview

The monitoring types provide a complete type system for:
- Webhook request tracking and logging
- Signal processing pipeline monitoring
- System performance metrics
- Real-time alerts and notifications
- Dashboard configuration and widgets
- API responses and filtering

## Core Interfaces

### WebhookRequest

Represents incoming webhook requests with complete metadata and processing results.

```typescript
import { WebhookRequest, WebhookStatus } from '@/types/monitoring';

// Example usage in API endpoint
async function logWebhookRequest(
  payload: Record<string, any>,
  headers: Record<string, string>,
  sourceIp: string
): Promise<WebhookRequest> {
  const webhookLog: CreateWebhookRequestInput = {
    sourceIp,
    userAgent: headers['user-agent'],
    headers,
    payload,
    payloadSize: JSON.stringify(payload).length,
    signature: headers['x-signature'],
    processingTime: 0, // Will be updated after processing
    status: 'success' as WebhookStatus,
  };
  
  return await createWebhookLog(webhookLog);
}
```

### ProcessingStage

Tracks each stage of the signal processing pipeline with timing and status information.

```typescript
import { ProcessingStage, ProcessingStageType } from '@/types/monitoring';

// Example usage in signal processor
async function startProcessingStage(
  signalId: string,
  stage: ProcessingStageType
): Promise<ProcessingStage> {
  return await createProcessingStage({
    signalId,
    stage,
    startedAt: new Date(),
    status: 'in_progress',
    metadata: {
      version: '1.0.0',
      environment: process.env.NODE_ENV
    }
  });
}

async function completeProcessingStage(
  stageId: string,
  success: boolean,
  errorMessage?: string
): Promise<ProcessingStage> {
  const completedAt = new Date();
  return await updateProcessingStage(stageId, {
    completedAt,
    status: success ? 'completed' : 'failed',
    errorMessage,
    duration: completedAt.getTime() - stage.startedAt.getTime()
  });
}
```

### SystemMetrics

Captures system performance and business metrics at regular intervals.

```typescript
import { SystemMetrics } from '@/types/monitoring';

// Example usage in metrics collector
async function captureSystemMetrics(): Promise<SystemMetrics> {
  const metrics: Omit<SystemMetrics, 'id' | 'timestamp'> = {
    webhooksPerMinute: await calculateWebhooksPerMinute(),
    avgProcessingTime: await calculateAvgProcessingTime(),
    errorRate: await calculateErrorRate(),
    queueDepth: await getQueueDepth(),
    memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100,
    cpuUsage: await getCpuUsage(),
    dbConnections: await getActiveDbConnections(),
    signalsProcessed: await countSignalsInPeriod(),
    tradesExecuted: await countTradesInPeriod(),
    decisionsApproved: await countDecisionsByType('TRADE'),
    decisionsRejected: await countDecisionsByType('REJECT')
  };
  
  return await saveSystemMetrics(metrics);
}
```

### SystemAlert

Manages system alerts with severity levels and lifecycle tracking.

```typescript
import { SystemAlert, AlertSeverity, AlertCategory } from '@/types/monitoring';

// Example usage in alert system
async function createAlert(
  severity: AlertSeverity,
  category: AlertCategory,
  title: string,
  message: string,
  details?: Record<string, any>
): Promise<SystemAlert> {
  const alert: CreateSystemAlertInput = {
    severity,
    category,
    title,
    message,
    details
  };
  
  // Auto-escalate critical alerts
  if (severity === 'critical') {
    await notifyOnCall(alert);
  }
  
  return await saveSystemAlert(alert);
}

async function acknowledgeAlert(alertId: string, userId: string): Promise<SystemAlert> {
  return await updateSystemAlert(alertId, {
    acknowledged: true,
    acknowledgedAt: new Date(),
    acknowledgedBy: userId
  });
}
```

## Filtering and Querying

### MonitoringFilters

Comprehensive filtering interface for dashboard queries.

```typescript
import { MonitoringFilters, TimeRange, WebhookStatus } from '@/types/monitoring';

// Example usage in dashboard API
async function getWebhookLogs(filters: MonitoringFilters) {
  const query = buildQuery({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    status: filters.webhookStatus,
    sourceIps: filters.sourceIps,
    minProcessingTime: filters.minProcessingTime
  });
  
  return await executeQuery(query, {
    page: filters.page || 1,
    limit: filters.limit || 50,
    sortBy: filters.sortBy || 'createdAt',
    sortOrder: filters.sortOrder || 'desc'
  });
}

// Predefined filter presets
const FILTER_PRESETS = {
  recentErrors: {
    timeRange: 'last_24_hours' as TimeRange,
    webhookStatus: ['failed'] as WebhookStatus[],
    sortBy: 'createdAt',
    sortOrder: 'desc' as const
  },
  slowRequests: {
    timeRange: 'last_hour' as TimeRange,
    minProcessingTime: 5000, // 5 seconds
    sortBy: 'processingTime',
    sortOrder: 'desc' as const
  }
};
```

## Real-time Updates

### WebhookEvent

Interface for real-time event streaming via WebSocket.

```typescript
import { WebhookEvent, WebhookEventType } from '@/types/monitoring';

// Example usage in WebSocket handler
class MonitoringWebSocket {
  private clients: Set<WebSocket> = new Set();
  
  async broadcastEvent(type: WebhookEventType, data: any) {
    const event: WebhookEvent = {
      type,
      timestamp: new Date(),
      data,
      metadata: {
        source: 'monitoring-system',
        version: '1.0.0'
      }
    };
    
    const message = JSON.stringify(event);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  async onWebhookReceived(webhookId: string) {
    await this.broadcastEvent('webhook_received', { webhookId });
  }
  
  async onStageCompleted(signalId: string, stage: ProcessingStageType) {
    await this.broadcastEvent('stage_completed', { signalId, stage });
  }
}
```

## Performance Analytics

### PerformanceMetrics

Aggregated metrics for dashboard analytics and reporting.

```typescript
import { PerformanceMetrics, ErrorSummary } from '@/types/monitoring';

// Example usage in analytics service
async function generatePerformanceReport(
  startDate: Date,
  endDate: Date
): Promise<PerformanceMetrics> {
  const webhooks = await getWebhooksInPeriod(startDate, endDate);
  const successful = webhooks.filter(w => w.status === 'success');
  const failed = webhooks.filter(w => w.status === 'failed');
  
  const processingTimes = successful.map(w => w.processingTime);
  const errorSummary = await analyzeErrors(failed);
  
  return {
    period: {
      start: startDate,
      end: endDate,
      duration: (endDate.getTime() - startDate.getTime()) / 1000
    },
    totalWebhooks: webhooks.length,
    successfulWebhooks: successful.length,
    failedWebhooks: failed.length,
    successRate: (successful.length / webhooks.length) * 100,
    avgProcessingTime: average(processingTimes),
    p95ProcessingTime: percentile(processingTimes, 95),
    p99ProcessingTime: percentile(processingTimes, 99),
    maxProcessingTime: Math.max(...processingTimes),
    webhooksPerSecond: webhooks.length / ((endDate.getTime() - startDate.getTime()) / 1000),
    peakWebhooksPerMinute: await calculatePeakRate(webhooks),
    avgQueueDepth: await calculateAvgQueueDepth(startDate, endDate),
    maxQueueDepth: await calculateMaxQueueDepth(startDate, endDate),
    topErrors: errorSummary,
    errorTrend: calculateTrend(failed),
    signalsGenerated: await countSignalsInPeriod(startDate, endDate),
    signalConversionRate: await calculateSignalConversionRate(startDate, endDate),
    tradesExecuted: await countTradesInPeriod(startDate, endDate),
    tradeConversionRate: await calculateTradeConversionRate(startDate, endDate)
  };
}
```

## Dashboard Configuration

### DashboardWidget and DashboardLayout

Configure dashboard widgets and layouts with type safety.

```typescript
import { DashboardWidget, DashboardLayout, DashboardWidgetType } from '@/types/monitoring';

// Example widget configurations
const WIDGET_TEMPLATES: Record<DashboardWidgetType, Partial<DashboardWidget>> = {
  webhook_volume_chart: {
    type: 'webhook_volume_chart',
    title: 'Webhook Volume',
    config: {
      chartType: 'line',
      timeRange: 'last_24_hours',
      refreshInterval: 30
    },
    refreshInterval: 30
  },
  
  system_health_status: {
    type: 'system_health_status',
    title: 'System Health',
    config: {
      showDetails: true,
      alertThresholds: {
        cpu: 80,
        memory: 85,
        errorRate: 5
      }
    },
    refreshInterval: 10
  },
  
  recent_webhooks_table: {
    type: 'recent_webhooks_table',
    title: 'Recent Webhooks',
    config: {
      limit: 20,
      columns: ['timestamp', 'sourceIp', 'status', 'processingTime'],
      filters: {
        timeRange: 'last_hour'
      }
    },
    refreshInterval: 15
  }
};

// Create a dashboard layout
async function createMonitoringDashboard(): Promise<DashboardLayout> {
  const widgets: DashboardWidget[] = [
    {
      id: 'webhook-volume',
      ...WIDGET_TEMPLATES.webhook_volume_chart,
      layout: { x: 0, y: 0, width: 6, height: 4 },
      enabled: true
    },
    {
      id: 'system-health',
      ...WIDGET_TEMPLATES.system_health_status,
      layout: { x: 6, y: 0, width: 6, height: 4 },
      enabled: true
    },
    {
      id: 'recent-webhooks',
      ...WIDGET_TEMPLATES.recent_webhooks_table,
      layout: { x: 0, y: 4, width: 12, height: 6 },
      enabled: true
    }
  ];
  
  return {
    id: generateId(),
    name: 'Main Monitoring Dashboard',
    description: 'Primary dashboard for webhook monitoring',
    widgets,
    globalRefreshInterval: 30,
    autoRefresh: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
```

## Type Guards and Validation

Use the provided type guards for runtime validation:

```typescript
import { 
  isValidWebhookStatus, 
  isValidProcessingStageType, 
  isValidAlertSeverity 
} from '@/types/monitoring';

// Example validation in API endpoint
function validateWebhookStatus(status: string): WebhookStatus {
  if (!isValidWebhookStatus(status)) {
    throw new Error(`Invalid webhook status: ${status}`);
  }
  return status;
}

function validateProcessingStage(stage: string): ProcessingStageType {
  if (!isValidProcessingStageType(stage)) {
    throw new Error(`Invalid processing stage: ${stage}`);
  }
  return stage;
}
```

## Constants and Defaults

Use the provided constants for consistent behavior:

```typescript
import { 
  DEFAULT_PAGINATION, 
  TIME_RANGES, 
  ALERT_SEVERITY_PRIORITY,
  PROCESSING_STAGE_ORDER 
} from '@/types/monitoring';

// Example usage in API pagination
function getPaginationParams(query: any) {
  return {
    page: Math.max(1, parseInt(query.page) || DEFAULT_PAGINATION.page),
    limit: Math.min(
      DEFAULT_PAGINATION.maxLimit, 
      parseInt(query.limit) || DEFAULT_PAGINATION.limit
    )
  };
}

// Example usage in time range conversion
function getTimeRangeSeconds(range: TimeRange): number {
  return TIME_RANGES[range] || TIME_RANGES.last_24_hours;
}

// Example usage in alert prioritization
function sortAlertsBySeverity(alerts: SystemAlert[]): SystemAlert[] {
  return alerts.sort((a, b) => {
    const aPriority = ALERT_SEVERITY_PRIORITY.indexOf(a.severity);
    const bPriority = ALERT_SEVERITY_PRIORITY.indexOf(b.severity);
    return aPriority - bPriority;
  });
}
```

## Integration with Existing Types

The monitoring types are designed to work seamlessly with existing trading types:

```typescript
import { Signal, Trade } from '@/types/trading';
import { WebhookRequest, ProcessingStage } from '@/types/monitoring';

// Example: Link webhook to signal
interface WebhookWithSignal extends WebhookRequest {
  signal?: Pick<Signal, 'id' | 'ticker' | 'action' | 'quality' | 'status'>;
}

// Example: Processing pipeline with trade outcome
interface ProcessingPipelineWithOutcome {
  webhook: WebhookRequest;
  stages: ProcessingStage[];
  signal?: Signal;
  trade?: Trade;
  finalStatus: 'completed' | 'failed' | 'rejected';
}
```

## Best Practices

1. **Always use type guards** for runtime validation of enum values
2. **Leverage utility types** like `CreateWebhookRequestInput` for API inputs
3. **Use constants** instead of magic strings for consistency
4. **Implement proper error handling** with structured error types
5. **Follow the existing patterns** established in the trading types
6. **Use JSDoc comments** for additional context in your implementations
7. **Prefer composition** over inheritance when extending interfaces

## Example: Complete Webhook Processing Flow

```typescript
import { 
  WebhookRequest, 
  ProcessingStage, 
  SystemAlert,
  WebhookEvent,
  CreateWebhookRequestInput,
  CreateProcessingStageInput,
  CreateSystemAlertInput
} from '@/types/monitoring';

class WebhookProcessor {
  async processWebhook(
    payload: Record<string, any>,
    headers: Record<string, string>,
    sourceIp: string
  ): Promise<void> {
    const startTime = Date.now();
    let webhookLog: WebhookRequest;
    let currentStage: ProcessingStage | null = null;
    
    try {
      // 1. Log the incoming webhook
      webhookLog = await this.logWebhook({
        sourceIp,
        userAgent: headers['user-agent'],
        headers,
        payload,
        payloadSize: JSON.stringify(payload).length,
        signature: headers['x-signature'],
        processingTime: 0,
        status: 'success'
      });
      
      // 2. Start processing stages
      const signalId = await this.createSignal(payload);
      
      currentStage = await this.startStage(signalId, 'received');
      await this.completeStage(currentStage.id, true);
      
      currentStage = await this.startStage(signalId, 'enriching');
      await this.enrichSignal(signalId);
      await this.completeStage(currentStage.id, true);
      
      currentStage = await this.startStage(signalId, 'deciding');
      const decision = await this.makeDecision(signalId);
      await this.completeStage(currentStage.id, true);
      
      if (decision.decision === 'TRADE') {
        currentStage = await this.startStage(signalId, 'executing');
        await this.executeTrade(signalId, decision);
        await this.completeStage(currentStage.id, true);
      }
      
      // 3. Update final webhook status
      const processingTime = Date.now() - startTime;
      await this.updateWebhookLog(webhookLog.id, {
        processingTime,
        status: 'success',
        signalId
      });
      
      // 4. Broadcast success event
      await this.broadcastEvent('webhook_processed', {
        webhookId: webhookLog.id,
        signalId,
        processingTime
      });
      
    } catch (error) {
      // Handle errors and update status
      const processingTime = Date.now() - startTime;
      
      if (webhookLog) {
        await this.updateWebhookLog(webhookLog.id, {
          processingTime,
          status: 'failed',
          errorMessage: error.message,
          errorStack: error.stack
        });
      }
      
      if (currentStage) {
        await this.completeStage(currentStage.id, false, error.message);
      }
      
      // Create alert for processing failure
      await this.createAlert('error', 'processing', 'Webhook Processing Failed', 
        `Failed to process webhook from ${sourceIp}: ${error.message}`, {
          webhookId: webhookLog?.id,
          sourceIp,
          error: error.message
        });
      
      // Broadcast failure event
      await this.broadcastEvent('webhook_failed', {
        webhookId: webhookLog?.id,
        error: error.message,
        processingTime
      });
      
      throw error;
    }
  }
}
```

This comprehensive type system provides full type safety and consistency across the webhook monitoring dashboard while maintaining compatibility with the existing trading system architecture.