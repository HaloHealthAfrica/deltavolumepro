// ============================================================================
// WEBHOOK MONITORING DASHBOARD TYPES
// ============================================================================
// Comprehensive TypeScript interfaces for the webhook monitoring system
// Compatible with Prisma models and existing codebase patterns

// ============================================================================
// CORE WEBHOOK MONITORING INTERFACES
// ============================================================================

/**
 * Interface for incoming webhook requests
 * Maps to WebhookLog Prisma model
 */
export interface WebhookRequest {
  /** Unique identifier for the webhook request */
  id: string;
  /** Timestamp when the webhook was received */
  createdAt: Date;
  
  // Request metadata
  /** Source IP address of the webhook request */
  sourceIp: string;
  /** User agent string from the request headers */
  userAgent?: string;
  /** Complete HTTP headers as key-value pairs */
  headers: Record<string, string>;
  /** Raw webhook payload data */
  payload: Record<string, any>;
  /** Size of the payload in bytes */
  payloadSize: number;
  /** Webhook signature for verification (if provided) */
  signature?: string;
  
  // Processing results
  /** Time taken to process the webhook in milliseconds */
  processingTime: number;
  /** Processing status: success, failed, or rejected */
  status: WebhookStatus;
  /** Error message if processing failed */
  errorMessage?: string;
  /** Full error stack trace for debugging */
  errorStack?: string;
  
  // Relations
  /** Associated signal ID if webhook created a signal */
  signalId?: string;
}

/**
 * Interface for signal processing stages
 * Maps to ProcessingStage Prisma model
 */
export interface ProcessingStage {
  /** Unique identifier for the processing stage */
  id: string;
  /** Timestamp when the stage record was created */
  createdAt: Date;
  
  // Stage identification
  /** Associated signal ID */
  signalId: string;
  /** Current processing stage name */
  stage: ProcessingStageType;
  
  // Timing information
  /** When this stage started processing */
  startedAt: Date;
  /** When this stage completed (null if still in progress) */
  completedAt?: Date;
  /** Duration of stage processing in milliseconds */
  duration?: number;
  
  // Status tracking
  /** Current status of this processing stage */
  status: ProcessingStageStatus;
  /** Error message if stage failed */
  errorMessage?: string;
  /** Stage-specific metadata and context */
  metadata?: Record<string, any>;
}

/**
 * Interface for system performance metrics
 * Maps to SystemMetrics Prisma model
 */
export interface SystemMetrics {
  /** Unique identifier for the metrics snapshot */
  id: string;
  /** Timestamp when metrics were captured */
  timestamp: Date;
  
  // Performance metrics
  /** Number of webhooks processed per minute */
  webhooksPerMinute: number;
  /** Average processing time across all webhooks in milliseconds */
  avgProcessingTime: number;
  /** Error rate as a percentage (0-100) */
  errorRate: number;
  /** Current depth of the processing queue */
  queueDepth: number;
  
  // System resource metrics
  /** Memory usage as a percentage (0-100) */
  memoryUsage: number;
  /** CPU usage as a percentage (0-100) */
  cpuUsage: number;
  /** Number of active database connections */
  dbConnections: number;
  
  // Business metrics
  /** Total signals processed in this time period */
  signalsProcessed: number;
  /** Total trades executed in this time period */
  tradesExecuted: number;
  /** Number of decisions that resulted in trades */
  decisionsApproved: number;
  /** Number of decisions that were rejected */
  decisionsRejected: number;
}

/**
 * Interface for system alerts and notifications
 * Maps to SystemAlert Prisma model
 */
export interface SystemAlert {
  /** Unique identifier for the alert */
  id: string;
  /** Timestamp when the alert was created */
  createdAt: Date;
  
  // Alert classification
  /** Severity level of the alert */
  severity: AlertSeverity;
  /** Category/type of the alert */
  category: AlertCategory;
  /** Short, descriptive title for the alert */
  title: string;
  /** Detailed alert message */
  message: string;
  /** Additional structured data related to the alert */
  details?: Record<string, any>;
  
  // Alert lifecycle management
  /** Whether the alert has been acknowledged by an operator */
  acknowledged: boolean;
  /** Timestamp when the alert was acknowledged */
  acknowledgedAt?: Date;
  /** User ID or name who acknowledged the alert */
  acknowledgedBy?: string;
  /** Whether the underlying issue has been resolved */
  resolved: boolean;
  /** Timestamp when the alert was resolved */
  resolvedAt?: Date;
}

/**
 * Interface for real-time webhook events
 * Used for WebSocket communications and live updates
 */
export interface WebhookEvent {
  /** Event type identifier */
  type: WebhookEventType;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Event payload data */
  data: WebhookEventData;
  /** Optional event metadata */
  metadata?: Record<string, any>;
}

/**
 * Interface for overall system health status
 * Aggregated view of system state
 */
export interface SystemHealth {
  /** Overall system status */
  status: SystemHealthStatus;
  /** System uptime in seconds */
  uptime: number;
  /** Current system version */
  version: string;
  /** Last health check timestamp */
  lastCheck: Date;
  
  // Component health
  /** Database connection status and metrics */
  database: DatabaseHealth;
  /** External API status and metrics */
  externalApis: Record<string, ApiHealth>;
  /** Memory usage statistics */
  memory: MemoryHealth;
  /** Processing queue status */
  queue: QueueHealth;
  
  // Performance indicators
  /** Number of active WebSocket connections */
  activeConnections: number;
  /** Current requests per second */
  requestsPerSecond: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
}

// ============================================================================
// FILTERING AND QUERY INTERFACES
// ============================================================================

/**
 * Interface for filtering webhook monitoring data
 * Used in dashboard queries and API endpoints
 */
export interface MonitoringFilters {
  // Time range filters
  /** Start date for filtering (inclusive) */
  dateFrom?: Date;
  /** End date for filtering (inclusive) */
  dateTo?: Date;
  /** Predefined time range shortcuts */
  timeRange?: TimeRange;
  
  // Status filters
  /** Filter by webhook processing status */
  webhookStatus?: WebhookStatus[];
  /** Filter by processing stage status */
  stageStatus?: ProcessingStageStatus[];
  /** Filter by alert severity levels */
  alertSeverity?: AlertSeverity[];
  
  // Source filters
  /** Filter by source IP addresses */
  sourceIps?: string[];
  /** Filter by user agent patterns */
  userAgents?: string[];
  /** Filter by signal tickers */
  tickers?: string[];
  
  // Performance filters
  /** Minimum processing time in milliseconds */
  minProcessingTime?: number;
  /** Maximum processing time in milliseconds */
  maxProcessingTime?: number;
  /** Minimum payload size in bytes */
  minPayloadSize?: number;
  /** Maximum payload size in bytes */
  maxPayloadSize?: number;
  
  // Pagination
  /** Page number for paginated results */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Field to sort by */
  sortBy?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for aggregated performance metrics
 * Used in dashboard charts and analytics
 */
export interface PerformanceMetrics {
  /** Time period these metrics cover */
  period: {
    start: Date;
    end: Date;
    duration: number; // seconds
  };
  
  // Webhook metrics
  /** Total webhooks received */
  totalWebhooks: number;
  /** Successful webhook processing count */
  successfulWebhooks: number;
  /** Failed webhook processing count */
  failedWebhooks: number;
  /** Success rate as percentage */
  successRate: number;
  
  // Performance metrics
  /** Average processing time in milliseconds */
  avgProcessingTime: number;
  /** 95th percentile processing time */
  p95ProcessingTime: number;
  /** 99th percentile processing time */
  p99ProcessingTime: number;
  /** Maximum processing time observed */
  maxProcessingTime: number;
  
  // Throughput metrics
  /** Webhooks processed per second */
  webhooksPerSecond: number;
  /** Peak webhooks per minute */
  peakWebhooksPerMinute: number;
  /** Average queue depth */
  avgQueueDepth: number;
  /** Maximum queue depth observed */
  maxQueueDepth: number;
  
  // Error analysis
  /** Most common error types */
  topErrors: ErrorSummary[];
  /** Error rate trend */
  errorTrend: TrendDirection;
  
  // Business metrics
  /** Signals generated from webhooks */
  signalsGenerated: number;
  /** Signal conversion rate */
  signalConversionRate: number;
  /** Trades executed from signals */
  tradesExecuted: number;
  /** Trade conversion rate */
  tradeConversionRate: number;
}

// ============================================================================
// ENUM TYPES AND CONSTANTS
// ============================================================================

/** Webhook processing status values */
export type WebhookStatus = 'success' | 'failed' | 'rejected';

/** Processing stage types in the signal pipeline */
export type ProcessingStageType = 
  | 'received'     // Webhook received and validated
  | 'enriching'    // Fetching market data from external APIs
  | 'enriched'     // Market data enrichment completed
  | 'deciding'     // Running decision engine
  | 'decided'      // Decision made (trade/reject/wait)
  | 'executing'    // Executing trade with broker
  | 'completed'    // Processing fully completed
  | 'failed';      // Processing failed at this stage

/** Processing stage status values */
export type ProcessingStageStatus = 'in_progress' | 'completed' | 'failed';

/** Alert severity levels */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/** Alert category types */
export type AlertCategory = 'webhook' | 'processing' | 'system' | 'performance' | 'security';

/** Webhook event types for real-time updates */
export type WebhookEventType = 
  | 'webhook_received'
  | 'webhook_processed'
  | 'webhook_failed'
  | 'stage_started'
  | 'stage_completed'
  | 'stage_failed'
  | 'alert_created'
  | 'alert_resolved'
  | 'metrics_updated'
  | 'system_status_changed';

/** Overall system health status */
export type SystemHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'maintenance';

/** Predefined time range options */
export type TimeRange = 
  | 'last_hour'
  | 'last_4_hours'
  | 'last_24_hours'
  | 'last_7_days'
  | 'last_30_days'
  | 'custom';

/** Trend direction indicators */
export type TrendDirection = 'up' | 'down' | 'stable';

// ============================================================================
// SUPPORTING INTERFACES
// ============================================================================

/** Webhook event data payload */
export interface WebhookEventData {
  /** Event-specific data */
  [key: string]: any;
  
  // Common fields
  /** Associated webhook ID */
  webhookId?: string;
  /** Associated signal ID */
  signalId?: string;
  /** Processing stage if applicable */
  stage?: ProcessingStageType;
  /** Error information if applicable */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/** Database health information */
export interface DatabaseHealth {
  /** Connection status */
  status: 'connected' | 'disconnected' | 'degraded';
  /** Connection latency in milliseconds */
  latency: number;
  /** Number of active connections */
  activeConnections: number;
  /** Maximum allowed connections */
  maxConnections: number;
  /** Connection pool utilization percentage */
  poolUtilization: number;
}

/** External API health information */
export interface ApiHealth {
  /** API status */
  status: 'online' | 'offline' | 'degraded';
  /** Response latency in milliseconds */
  latency: number;
  /** Last successful request timestamp */
  lastSuccess: Date;
  /** Current error rate percentage */
  errorRate: number;
  /** Rate limit information */
  rateLimit?: {
    remaining: number;
    resetTime: Date;
    limit: number;
  };
}

/** Memory usage information */
export interface MemoryHealth {
  /** Used memory in bytes */
  used: number;
  /** Total available memory in bytes */
  total: number;
  /** Memory usage percentage */
  percentage: number;
  /** Memory usage trend */
  trend: TrendDirection;
}

/** Processing queue health information */
export interface QueueHealth {
  /** Current queue depth */
  depth: number;
  /** Maximum queue capacity */
  maxCapacity: number;
  /** Queue utilization percentage */
  utilization: number;
  /** Average processing time per item */
  avgProcessingTime: number;
  /** Oldest item age in seconds */
  oldestItemAge: number;
}

/** Error summary for analytics */
export interface ErrorSummary {
  /** Error type or code */
  type: string;
  /** Error message pattern */
  message: string;
  /** Number of occurrences */
  count: number;
  /** Percentage of total errors */
  percentage: number;
  /** First occurrence timestamp */
  firstSeen: Date;
  /** Last occurrence timestamp */
  lastSeen: Date;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/** Paginated response wrapper for monitoring data */
export interface MonitoringPaginatedResponse<T> {
  /** Array of data items */
  data: T[];
  /** Pagination metadata */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  /** Applied filters */
  filters: MonitoringFilters;
  /** Response metadata */
  metadata: {
    generatedAt: Date;
    processingTime: number;
    cacheHit?: boolean;
  };
}

/** Real-time metrics snapshot */
export interface RealTimeMetrics {
  /** Snapshot timestamp */
  timestamp: Date;
  
  // Current activity
  /** Webhooks in the last minute */
  webhooksLastMinute: number;
  /** Active processing stages */
  activeStages: number;
  /** Current queue depth */
  queueDepth: number;
  
  // Performance indicators
  /** Average processing time (last 100 requests) */
  recentAvgProcessingTime: number;
  /** Current error rate percentage */
  currentErrorRate: number;
  /** System load percentage */
  systemLoad: number;
  
  // Alert summary
  /** Number of unacknowledged alerts */
  unacknowledgedAlerts: number;
  /** Highest alert severity currently active */
  highestAlertSeverity?: AlertSeverity;
}

/** Webhook processing pipeline status */
export interface PipelineStatus {
  /** Pipeline identifier */
  id: string;
  /** Associated signal ID */
  signalId: string;
  /** Current stage in the pipeline */
  currentStage: ProcessingStageType;
  /** Overall pipeline status */
  status: ProcessingStageStatus;
  /** Pipeline start timestamp */
  startedAt: Date;
  /** Total processing time so far */
  totalProcessingTime: number;
  /** All stages in this pipeline */
  stages: ProcessingStage[];
  /** Estimated completion time */
  estimatedCompletion?: Date;
}

// ============================================================================
// DASHBOARD CONFIGURATION TYPES
// ============================================================================

/** Dashboard widget configuration */
export interface DashboardWidget {
  /** Widget unique identifier */
  id: string;
  /** Widget type */
  type: DashboardWidgetType;
  /** Widget title */
  title: string;
  /** Widget position and size */
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Widget-specific configuration */
  config: Record<string, any>;
  /** Refresh interval in seconds */
  refreshInterval: number;
  /** Whether widget is enabled */
  enabled: boolean;
}

/** Dashboard widget types */
export type DashboardWidgetType = 
  | 'webhook_volume_chart'
  | 'processing_time_chart'
  | 'error_rate_chart'
  | 'system_health_status'
  | 'recent_webhooks_table'
  | 'active_alerts_list'
  | 'performance_metrics_grid'
  | 'pipeline_status_flow'
  | 'queue_depth_gauge'
  | 'success_rate_donut';

/** Dashboard layout configuration */
export interface DashboardLayout {
  /** Layout identifier */
  id: string;
  /** Layout name */
  name: string;
  /** Layout description */
  description?: string;
  /** Widgets in this layout */
  widgets: DashboardWidget[];
  /** Global refresh interval */
  globalRefreshInterval: number;
  /** Auto-refresh enabled */
  autoRefresh: boolean;
  /** Layout creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Create input type for webhook requests (omit auto-generated fields) */
export type CreateWebhookRequestInput = Omit<WebhookRequest, 'id' | 'createdAt'>;

/** Update input type for webhook requests */
export type UpdateWebhookRequestInput = Partial<Omit<WebhookRequest, 'id' | 'createdAt'>> & { id: string };

/** Create input type for processing stages */
export type CreateProcessingStageInput = Omit<ProcessingStage, 'id' | 'createdAt'>;

/** Update input type for processing stages */
export type UpdateProcessingStageInput = Partial<Omit<ProcessingStage, 'id' | 'createdAt'>> & { id: string };

/** Create input type for system alerts */
export type CreateSystemAlertInput = Omit<SystemAlert, 'id' | 'createdAt' | 'acknowledged' | 'acknowledgedAt' | 'acknowledgedBy' | 'resolved' | 'resolvedAt'>;

/** Update input type for system alerts */
export type UpdateSystemAlertInput = Partial<Omit<SystemAlert, 'id' | 'createdAt'>> & { id: string };

/** Webhook request with related data */
export interface WebhookRequestWithRelations extends WebhookRequest {
  /** Associated signal data if available */
  signal?: {
    id: string;
    ticker: string;
    action: string;
    quality: number;
    status: string;
  };
  /** Processing stages for this webhook */
  stages?: ProcessingStage[];
}

/** Time series data point for charts */
export interface TimeSeriesDataPoint {
  /** Data point timestamp */
  timestamp: Date;
  /** Data point value */
  value: number;
  /** Optional label for the data point */
  label?: string;
  /** Optional metadata */
  metadata?: Record<string, any>;
}

/** Chart data structure for dashboard widgets */
export interface ChartData {
  /** Chart title */
  title: string;
  /** Chart type */
  type: 'line' | 'bar' | 'area' | 'pie' | 'donut' | 'gauge';
  /** Time series data */
  data: TimeSeriesDataPoint[];
  /** Chart configuration options */
  options?: Record<string, any>;
  /** Last updated timestamp */
  lastUpdated: Date;
}

// ============================================================================
// TYPE GUARDS AND VALIDATION
// ============================================================================

/** Type guard to check if a webhook status is valid */
export function isValidWebhookStatus(status: string): status is WebhookStatus {
  return ['success', 'failed', 'rejected'].includes(status);
}

/** Type guard to check if a processing stage type is valid */
export function isValidProcessingStageType(stage: string): stage is ProcessingStageType {
  return ['received', 'enriching', 'enriched', 'deciding', 'decided', 'executing', 'completed', 'failed'].includes(stage);
}

/** Type guard to check if an alert severity is valid */
export function isValidAlertSeverity(severity: string): severity is AlertSeverity {
  return ['info', 'warning', 'error', 'critical'].includes(severity);
}

/** Type guard to check if a system health status is valid */
export function isValidSystemHealthStatus(status: string): status is SystemHealthStatus {
  return ['healthy', 'degraded', 'unhealthy', 'maintenance'].includes(status);
}

// ============================================================================
// CONSTANTS AND DEFAULTS
// ============================================================================

/** Default pagination limits */
export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 50,
  maxLimit: 1000,
} as const;

/** Default time ranges in seconds */
export const TIME_RANGES = {
  last_hour: 3600,
  last_4_hours: 14400,
  last_24_hours: 86400,
  last_7_days: 604800,
  last_30_days: 2592000,
} as const;

/** Alert severity priority order (highest to lowest) */
export const ALERT_SEVERITY_PRIORITY: AlertSeverity[] = ['critical', 'error', 'warning', 'info'];

/** Processing stage order in the pipeline */
export const PROCESSING_STAGE_ORDER: ProcessingStageType[] = [
  'received',
  'enriching', 
  'enriched',
  'deciding',
  'decided',
  'executing',
  'completed'
];

/** Default dashboard refresh intervals in seconds */
export const REFRESH_INTERVALS = {
  realtime: 5,
  fast: 30,
  normal: 60,
  slow: 300,
} as const;