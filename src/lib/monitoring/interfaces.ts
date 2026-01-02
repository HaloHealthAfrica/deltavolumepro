/**
 * ============================================================================
 * WEBHOOK MONITORING SYSTEM - SERVICE INTERFACES
 * ============================================================================
 * 
 * Core service interfaces and configuration types for the webhook monitoring system.
 * These interfaces define the contracts for monitoring services that will be implemented
 * to track webhook processing, collect metrics, manage alerts, and provide real-time updates.
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

import type {
  WebhookRequest,
  ProcessingStage,
  SystemMetrics,
  SystemAlert,
  WebhookEvent,
  SystemHealth,
  MonitoringFilters,
  PerformanceMetrics,
  RealTimeMetrics,
  PipelineStatus,
  WebhookStatus,
  ProcessingStageType,
  ProcessingStageStatus,
  AlertSeverity,
  AlertCategory,
  WebhookEventType,
  SystemHealthStatus,
  TimeRange,
  MonitoringPaginatedResponse,
  CreateWebhookRequestInput,
  UpdateWebhookRequestInput,
  CreateProcessingStageInput,
  UpdateProcessingStageInput,
  CreateSystemAlertInput,
  UpdateSystemAlertInput,
  WebhookRequestWithRelations,
  ChartData,
  TimeSeriesDataPoint,
} from '@/types/monitoring'

// ============================================================================
// CORE SERVICE INTERFACES
// ============================================================================

/**
 * Main webhook monitoring service interface
 * 
 * Provides comprehensive tracking of webhook requests and their processing stages
 * throughout the signal processing pipeline. This service acts as the central
 * coordinator for monitoring webhook lifecycle events.
 */
export interface IWebhookMonitor {
  // ========================================
  // Webhook Request Management
  // ========================================

  /**
   * Record a new incoming webhook request
   * 
   * @param request - Webhook request data without auto-generated fields
   * @returns Promise resolving to the created webhook request record
   * @throws {ValidationError} When request data is invalid
   * @throws {DatabaseError} When database operation fails
   */
  recordWebhookRequest(request: CreateWebhookRequestInput): Promise<WebhookRequest>

  /**
   * Update an existing webhook request with processing results
   * 
   * @param id - Webhook request ID
   * @param updates - Partial update data
   * @returns Promise resolving to the updated webhook request
   * @throws {NotFoundError} When webhook request doesn't exist
   * @throws {ValidationError} When update data is invalid
   */
  updateWebhookRequest(id: string, updates: Partial<UpdateWebhookRequestInput>): Promise<WebhookRequest>

  /**
   * Get webhook request by ID with optional related data
   * 
   * @param id - Webhook request ID
   * @param includeRelations - Whether to include related signal and stages data
   * @returns Promise resolving to webhook request or null if not found
   */
  getWebhookRequest(id: string, includeRelations?: boolean): Promise<WebhookRequestWithRelations | null>

  /**
   * Get paginated list of webhook requests with filtering
   * 
   * @param filters - Filtering and pagination options
   * @returns Promise resolving to paginated webhook requests
   */
  getWebhookRequests(filters?: MonitoringFilters): Promise<MonitoringPaginatedResponse<WebhookRequestWithRelations>>

  // ========================================
  // Processing Stage Management
  // ========================================

  /**
   * Start tracking a new processing stage
   * 
   * @param stage - Processing stage data
   * @returns Promise resolving to the created processing stage
   * @throws {ValidationError} When stage data is invalid
   * @throws {ConflictError} When stage already exists for signal
   */
  startProcessingStage(stage: CreateProcessingStageInput): Promise<ProcessingStage>

  /**
   * Complete a processing stage with results
   * 
   * @param id - Processing stage ID
   * @param status - Final status (completed or failed)
   * @param metadata - Optional stage completion metadata
   * @param errorMessage - Error message if stage failed
   * @returns Promise resolving to the updated processing stage
   * @throws {NotFoundError} When processing stage doesn't exist
   * @throws {InvalidStateError} When stage is already completed
   */
  completeProcessingStage(
    id: string,
    status: 'completed' | 'failed',
    metadata?: Record<string, any>,
    errorMessage?: string
  ): Promise<ProcessingStage>

  /**
   * Get processing stages for a specific signal
   * 
   * @param signalId - Signal ID to get stages for
   * @returns Promise resolving to array of processing stages
   */
  getProcessingStages(signalId: string): Promise<ProcessingStage[]>

  /**
   * Get current pipeline status for a signal
   * 
   * @param signalId - Signal ID to get pipeline status for
   * @returns Promise resolving to pipeline status or null if not found
   */
  getPipelineStatus(signalId: string): Promise<PipelineStatus | null>

  /**
   * Get all active processing stages across all signals
   * 
   * @returns Promise resolving to array of active processing stages
   */
  getActiveProcessingStages(): Promise<ProcessingStage[]>

  // ========================================
  // Performance Monitoring
  // ========================================

  /**
   * Get performance metrics for a specific time period
   * 
   * @param timeRange - Time range for metrics calculation
   * @param customStart - Custom start date (used with 'custom' timeRange)
   * @param customEnd - Custom end date (used with 'custom' timeRange)
   * @returns Promise resolving to performance metrics
   */
  getPerformanceMetrics(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): Promise<PerformanceMetrics>

  /**
   * Get real-time metrics snapshot
   * 
   * @returns Promise resolving to current real-time metrics
   */
  getRealTimeMetrics(): Promise<RealTimeMetrics>

  /**
   * Get webhook processing statistics
   * 
   * @param filters - Optional filters for statistics calculation
   * @returns Promise resolving to processing statistics
   */
  getProcessingStatistics(filters?: MonitoringFilters): Promise<{
    totalWebhooks: number
    successfulWebhooks: number
    failedWebhooks: number
    rejectedWebhooks: number
    successRate: number
    avgProcessingTime: number
    medianProcessingTime: number
    p95ProcessingTime: number
    p99ProcessingTime: number
  }>

  // ========================================
  // Health Monitoring
  // ========================================

  /**
   * Get current system health status
   * 
   * @returns Promise resolving to system health information
   */
  getSystemHealth(): Promise<SystemHealth>

  /**
   * Perform health check on all monitored components
   * 
   * @returns Promise resolving to updated system health status
   */
  performHealthCheck(): Promise<SystemHealth>
}

/**
 * Metrics collection service interface
 * 
 * Handles collection, storage, and retrieval of system performance metrics.
 * Provides both real-time and historical metrics data for monitoring dashboards.
 */
export interface IMetricsCollector {
  // ========================================
  // Metrics Collection
  // ========================================

  /**
   * Collect and store current system metrics snapshot
   * 
   * @returns Promise resolving to the collected metrics
   * @throws {CollectionError} When metrics collection fails
   */
  collectMetrics(): Promise<SystemMetrics>

  /**
   * Record webhook processing metrics
   * 
   * @param webhookId - Webhook request ID
   * @param processingTime - Time taken to process webhook in milliseconds
   * @param status - Processing status
   * @param payloadSize - Size of webhook payload in bytes
   */
  recordWebhookMetrics(
    webhookId: string,
    processingTime: number,
    status: WebhookStatus,
    payloadSize: number
  ): Promise<void>

  /**
   * Record processing stage metrics
   * 
   * @param stageId - Processing stage ID
   * @param stage - Stage type
   * @param duration - Stage processing duration in milliseconds
   * @param status - Stage completion status
   */
  recordStageMetrics(
    stageId: string,
    stage: ProcessingStageType,
    duration: number,
    status: ProcessingStageStatus
  ): Promise<void>

  // ========================================
  // Metrics Retrieval
  // ========================================

  /**
   * Get historical metrics for a time period
   * 
   * @param timeRange - Time range for metrics
   * @param customStart - Custom start date (for 'custom' timeRange)
   * @param customEnd - Custom end date (for 'custom' timeRange)
   * @param interval - Data point interval (e.g., '1m', '5m', '1h')
   * @returns Promise resolving to time series metrics data
   */
  getHistoricalMetrics(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date,
    interval?: string
  ): Promise<SystemMetrics[]>

  /**
   * Get aggregated metrics for dashboard widgets
   * 
   * @param timeRange - Time range for aggregation
   * @param customStart - Custom start date
   * @param customEnd - Custom end date
   * @returns Promise resolving to aggregated metrics
   */
  getAggregatedMetrics(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): Promise<{
    webhookVolume: TimeSeriesDataPoint[]
    processingTimes: TimeSeriesDataPoint[]
    errorRates: TimeSeriesDataPoint[]
    queueDepths: TimeSeriesDataPoint[]
    systemLoad: TimeSeriesDataPoint[]
  }>

  /**
   * Get chart data for specific metric type
   * 
   * @param metricType - Type of metric to chart
   * @param timeRange - Time range for chart data
   * @param customStart - Custom start date
   * @param customEnd - Custom end date
   * @returns Promise resolving to chart data
   */
  getChartData(
    metricType: 'webhookVolume' | 'processingTime' | 'errorRate' | 'queueDepth' | 'systemLoad',
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): Promise<ChartData>

  // ========================================
  // Metrics Analysis
  // ========================================

  /**
   * Calculate performance trends
   * 
   * @param timeRange - Time range for trend analysis
   * @param customStart - Custom start date
   * @param customEnd - Custom end date
   * @returns Promise resolving to trend analysis results
   */
  calculateTrends(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): Promise<{
    webhookVolumeTrend: 'up' | 'down' | 'stable'
    processingTimeTrend: 'up' | 'down' | 'stable'
    errorRateTrend: 'up' | 'down' | 'stable'
    queueDepthTrend: 'up' | 'down' | 'stable'
  }>

  /**
   * Detect performance anomalies
   * 
   * @param lookbackHours - Hours to look back for anomaly detection
   * @returns Promise resolving to detected anomalies
   */
  detectAnomalies(lookbackHours?: number): Promise<{
    anomalies: Array<{
      metric: string
      timestamp: Date
      value: number
      expectedRange: { min: number; max: number }
      severity: 'low' | 'medium' | 'high'
    }>
    summary: {
      totalAnomalies: number
      highSeverityCount: number
      affectedMetrics: string[]
    }
  }>
}

/**
 * Alert management service interface
 * 
 * Handles creation, management, and notification of system alerts.
 * Provides intelligent alerting based on configurable thresholds and conditions.
 */
export interface IAlertManager {
  // ========================================
  // Alert Management
  // ========================================

  /**
   * Create a new system alert
   * 
   * @param alert - Alert data without auto-generated fields
   * @returns Promise resolving to the created alert
   * @throws {ValidationError} When alert data is invalid
   */
  createAlert(alert: CreateSystemAlertInput): Promise<SystemAlert>

  /**
   * Acknowledge an alert
   * 
   * @param alertId - Alert ID to acknowledge
   * @param acknowledgedBy - User or system that acknowledged the alert
   * @returns Promise resolving to the updated alert
   * @throws {NotFoundError} When alert doesn't exist
   * @throws {InvalidStateError} When alert is already acknowledged
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<SystemAlert>

  /**
   * Resolve an alert
   * 
   * @param alertId - Alert ID to resolve
   * @returns Promise resolving to the updated alert
   * @throws {NotFoundError} When alert doesn't exist
   */
  resolveAlert(alertId: string): Promise<SystemAlert>

  /**
   * Get alert by ID
   * 
   * @param alertId - Alert ID
   * @returns Promise resolving to alert or null if not found
   */
  getAlert(alertId: string): Promise<SystemAlert | null>

  /**
   * Get paginated list of alerts with filtering
   * 
   * @param filters - Filtering and pagination options
   * @returns Promise resolving to paginated alerts
   */
  getAlerts(filters?: MonitoringFilters): Promise<MonitoringPaginatedResponse<SystemAlert>>

  /**
   * Get active (unresolved) alerts
   * 
   * @param severityFilter - Optional severity filter
   * @returns Promise resolving to array of active alerts
   */
  getActiveAlerts(severityFilter?: AlertSeverity[]): Promise<SystemAlert[]>

  // ========================================
  // Alert Rules and Thresholds
  // ========================================

  /**
   * Evaluate alert conditions based on current metrics
   * 
   * @param metrics - Current system metrics
   * @returns Promise resolving to array of triggered alerts
   */
  evaluateAlertConditions(metrics: SystemMetrics): Promise<SystemAlert[]>

  /**
   * Check webhook processing for alert conditions
   * 
   * @param webhook - Webhook request to check
   * @returns Promise resolving to array of triggered alerts
   */
  checkWebhookAlerts(webhook: WebhookRequest): Promise<SystemAlert[]>

  /**
   * Check processing stage for alert conditions
   * 
   * @param stage - Processing stage to check
   * @returns Promise resolving to array of triggered alerts
   */
  checkStageAlerts(stage: ProcessingStage): Promise<SystemAlert[]>

  // ========================================
  // Alert Configuration
  // ========================================

  /**
   * Update alert thresholds and rules
   * 
   * @param config - New alert configuration
   * @returns Promise resolving when configuration is updated
   */
  updateAlertConfiguration(config: AlertConfiguration): Promise<void>

  /**
   * Get current alert configuration
   * 
   * @returns Promise resolving to current alert configuration
   */
  getAlertConfiguration(): Promise<AlertConfiguration>

  // ========================================
  // Alert Notifications
  // ========================================

  /**
   * Send alert notifications through configured channels
   * 
   * @param alert - Alert to send notifications for
   * @returns Promise resolving when notifications are sent
   */
  sendAlertNotifications(alert: SystemAlert): Promise<void>

  /**
   * Test alert notification channels
   * 
   * @returns Promise resolving to test results for each channel
   */
  testNotificationChannels(): Promise<{
    email: { success: boolean; error?: string }
    slack: { success: boolean; error?: string }
    webhook: { success: boolean; error?: string }
  }>
}

/**
 * Real-time monitoring events service interface
 * 
 * Handles real-time event broadcasting and subscription management
 * for live monitoring dashboard updates via WebSocket connections.
 */
export interface IMonitoringEvents {
  // ========================================
  // Event Broadcasting
  // ========================================

  /**
   * Broadcast webhook event to connected clients
   * 
   * @param event - Webhook event to broadcast
   * @returns Promise resolving when event is broadcast
   */
  broadcastWebhookEvent(event: WebhookEvent): Promise<void>

  /**
   * Broadcast processing stage event
   * 
   * @param signalId - Signal ID
   * @param stage - Processing stage type
   * @param status - Stage status
   * @param metadata - Optional stage metadata
   * @returns Promise resolving when event is broadcast
   */
  broadcastStageEvent(
    signalId: string,
    stage: ProcessingStageType,
    status: ProcessingStageStatus,
    metadata?: Record<string, any>
  ): Promise<void>

  /**
   * Broadcast alert event
   * 
   * @param alert - System alert to broadcast
   * @param eventType - Type of alert event (created, acknowledged, resolved)
   * @returns Promise resolving when event is broadcast
   */
  broadcastAlertEvent(
    alert: SystemAlert,
    eventType: 'created' | 'acknowledged' | 'resolved'
  ): Promise<void>

  /**
   * Broadcast metrics update
   * 
   * @param metrics - Updated system metrics
   * @returns Promise resolving when event is broadcast
   */
  broadcastMetricsUpdate(metrics: SystemMetrics): Promise<void>

  /**
   * Broadcast system health update
   * 
   * @param health - Updated system health status
   * @returns Promise resolving when event is broadcast
   */
  broadcastHealthUpdate(health: SystemHealth): Promise<void>

  // ========================================
  // Event Subscription Management
  // ========================================

  /**
   * Subscribe client to monitoring events
   * 
   * @param clientId - Unique client identifier
   * @param channels - Array of channels to subscribe to
   * @returns Promise resolving when subscription is established
   */
  subscribeClient(clientId: string, channels: string[]): Promise<void>

  /**
   * Unsubscribe client from monitoring events
   * 
   * @param clientId - Client identifier to unsubscribe
   * @returns Promise resolving when client is unsubscribed
   */
  unsubscribeClient(clientId: string): Promise<void>

  /**
   * Get list of connected clients
   * 
   * @returns Promise resolving to array of connected client information
   */
  getConnectedClients(): Promise<Array<{
    clientId: string
    connectedAt: Date
    channels: string[]
    lastActivity: Date
  }>>

  // ========================================
  // Event History
  // ========================================

  /**
   * Get recent events for a specific type
   * 
   * @param eventType - Type of events to retrieve
   * @param limit - Maximum number of events to return
   * @param since - Optional timestamp to get events since
   * @returns Promise resolving to array of recent events
   */
  getRecentEvents(
    eventType: WebhookEventType,
    limit?: number,
    since?: Date
  ): Promise<WebhookEvent[]>

  /**
   * Get event history for a specific signal
   * 
   * @param signalId - Signal ID to get events for
   * @returns Promise resolving to array of signal events
   */
  getSignalEventHistory(signalId: string): Promise<WebhookEvent[]>
}

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

/**
 * Main monitoring system configuration
 * 
 * Defines all configurable aspects of the monitoring system including
 * collection intervals, retention policies, alert thresholds, and feature flags.
 */
export interface MonitoringConfig {
  // ========================================
  // Collection Settings
  // ========================================

  /** Metrics collection configuration */
  metrics: {
    /** Interval for collecting system metrics (seconds) */
    collectionInterval: number
    /** How long to retain detailed metrics (days) */
    retentionDays: number
    /** Whether to collect detailed performance metrics */
    enableDetailedMetrics: boolean
    /** Batch size for metrics processing */
    batchSize: number
  }

  /** Webhook monitoring configuration */
  webhooks: {
    /** Maximum payload size to log (bytes) */
    maxPayloadSize: number
    /** Whether to log request headers */
    logHeaders: boolean
    /** Whether to log full request body */
    logFullPayload: boolean
    /** Headers to exclude from logging (for security) */
    excludeHeaders: string[]
    /** Maximum processing time before timeout (milliseconds) */
    processingTimeout: number
  }

  /** Processing stage monitoring configuration */
  stages: {
    /** Whether to track all processing stages */
    trackAllStages: boolean
    /** Stages to track (if not tracking all) */
    trackedStages: ProcessingStageType[]
    /** Maximum stage processing time before alert (milliseconds) */
    maxStageTime: number
    /** Whether to collect stage metadata */
    collectMetadata: boolean
  }

  // ========================================
  // Performance Thresholds
  // ========================================

  /** Performance monitoring thresholds */
  performance: {
    /** Maximum acceptable webhook processing time (milliseconds) */
    maxProcessingTime: number
    /** Maximum acceptable error rate (percentage) */
    maxErrorRate: number
    /** Maximum acceptable queue depth */
    maxQueueDepth: number
    /** Maximum acceptable memory usage (percentage) */
    maxMemoryUsage: number
    /** Maximum acceptable CPU usage (percentage) */
    maxCpuUsage: number
    /** Minimum acceptable success rate (percentage) */
    minSuccessRate: number
  }

  // ========================================
  // Alert Configuration
  // ========================================

  /** Alert system configuration */
  alerts: AlertConfiguration

  // ========================================
  // Real-time Features
  // ========================================

  /** Real-time monitoring configuration */
  realtime: {
    /** Whether real-time events are enabled */
    enabled: boolean
    /** Maximum number of concurrent WebSocket connections */
    maxConnections: number
    /** Connection timeout (seconds) */
    connectionTimeout: number
    /** Heartbeat interval (seconds) */
    heartbeatInterval: number
    /** Event buffer size for disconnected clients */
    eventBufferSize: number
  }

  // ========================================
  // Dashboard Settings
  // ========================================

  /** Dashboard configuration */
  dashboard: {
    /** Default refresh interval (seconds) */
    defaultRefreshInterval: number
    /** Available refresh intervals */
    refreshIntervals: number[]
    /** Default time range for charts */
    defaultTimeRange: TimeRange
    /** Maximum data points per chart */
    maxChartDataPoints: number
    /** Whether to enable auto-refresh */
    autoRefreshEnabled: boolean
  }

  // ========================================
  // Data Retention
  // ========================================

  /** Data retention policies */
  retention: {
    /** Webhook request retention (days) */
    webhookRequests: number
    /** Processing stage retention (days) */
    processingStages: number
    /** System metrics retention (days) */
    systemMetrics: number
    /** Alert retention (days) */
    alerts: number
    /** Event history retention (days) */
    eventHistory: number
  }

  // ========================================
  // Feature Flags
  // ========================================

  /** Feature flags for monitoring system */
  features: {
    /** Enable advanced analytics */
    advancedAnalytics: boolean
    /** Enable anomaly detection */
    anomalyDetection: boolean
    /** Enable predictive alerting */
    predictiveAlerting: boolean
    /** Enable performance profiling */
    performanceProfiling: boolean
    /** Enable security monitoring */
    securityMonitoring: boolean
    /** Enable cost tracking */
    costTracking: boolean
  }
}

/**
 * Alert system configuration
 * 
 * Defines alert rules, thresholds, notification channels, and escalation policies.
 */
export interface AlertConfiguration {
  // ========================================
  // Alert Rules
  // ========================================

  /** Webhook processing alert rules */
  webhookRules: {
    /** Alert on processing time threshold (milliseconds) */
    processingTimeThreshold: number
    /** Alert on error rate threshold (percentage) */
    errorRateThreshold: number
    /** Alert on consecutive failures count */
    consecutiveFailuresThreshold: number
    /** Alert on payload size threshold (bytes) */
    payloadSizeThreshold: number
  }

  /** System performance alert rules */
  systemRules: {
    /** Alert on memory usage threshold (percentage) */
    memoryUsageThreshold: number
    /** Alert on CPU usage threshold (percentage) */
    cpuUsageThreshold: number
    /** Alert on queue depth threshold */
    queueDepthThreshold: number
    /** Alert on database connection threshold */
    dbConnectionThreshold: number
  }

  /** Processing stage alert rules */
  stageRules: {
    /** Alert on stage timeout (milliseconds) */
    stageTimeoutThreshold: number
    /** Alert on stage failure rate (percentage) */
    stageFailureRateThreshold: number
    /** Stages to monitor for alerts */
    monitoredStages: ProcessingStageType[]
  }

  // ========================================
  // Notification Channels
  // ========================================

  /** Notification channel configuration */
  notifications: {
    /** Email notification settings */
    email: {
      enabled: boolean
      recipients: string[]
      smtpConfig?: {
        host: string
        port: number
        secure: boolean
        auth: {
          user: string
          pass: string
        }
      }
    }

    /** Slack notification settings */
    slack: {
      enabled: boolean
      webhookUrl?: string
      channel?: string
      username?: string
    }

    /** Webhook notification settings */
    webhook: {
      enabled: boolean
      url?: string
      headers?: Record<string, string>
      timeout?: number
    }

    /** In-app notification settings */
    inApp: {
      enabled: boolean
      persistDays: number
    }
  }

  // ========================================
  // Alert Policies
  // ========================================

  /** Alert escalation and suppression policies */
  policies: {
    /** Minimum time between duplicate alerts (minutes) */
    suppressionWindow: number
    /** Auto-resolve alerts after this time (minutes) */
    autoResolveAfter: number
    /** Escalation rules for unacknowledged alerts */
    escalation: {
      /** Time before escalation (minutes) */
      escalateAfter: number
      /** Escalation notification channels */
      escalationChannels: ('email' | 'slack' | 'webhook')[]
    }
    /** Alert severity mappings */
    severityMappings: {
      [key: string]: AlertSeverity
    }
  }
}

/**
 * Monitoring service health check configuration
 * 
 * Defines health check intervals and thresholds for monitoring system components.
 */
export interface HealthCheckConfig {
  /** Health check interval (seconds) */
  interval: number
  /** Health check timeout (milliseconds) */
  timeout: number
  /** Number of failed checks before marking unhealthy */
  failureThreshold: number
  /** Number of successful checks before marking healthy */
  successThreshold: number

  /** Component-specific health check settings */
  components: {
    database: {
      enabled: boolean
      query: string
      maxLatency: number
    }
    externalApis: {
      enabled: boolean
      endpoints: Array<{
        name: string
        url: string
        maxLatency: number
      }>
    }
    queue: {
      enabled: boolean
      maxDepth: number
      maxAge: number
    }
    memory: {
      enabled: boolean
      maxUsage: number
    }
  }
}

// ============================================================================
// SERVICE FACTORY AND REGISTRY INTERFACES
// ============================================================================

/**
 * Monitoring service factory interface
 * 
 * Provides a centralized way to create and configure monitoring services
 * with dependency injection and configuration management.
 */
export interface IMonitoringServiceFactory {
  /**
   * Create webhook monitor service instance
   * 
   * @param config - Monitoring configuration
   * @returns Configured webhook monitor service
   */
  createWebhookMonitor(config: MonitoringConfig): IWebhookMonitor

  /**
   * Create metrics collector service instance
   * 
   * @param config - Monitoring configuration
   * @returns Configured metrics collector service
   */
  createMetricsCollector(config: MonitoringConfig): IMetricsCollector

  /**
   * Create alert manager service instance
   * 
   * @param config - Monitoring configuration
   * @returns Configured alert manager service
   */
  createAlertManager(config: MonitoringConfig): IAlertManager

  /**
   * Create monitoring events service instance
   * 
   * @param config - Monitoring configuration
   * @returns Configured monitoring events service
   */
  createMonitoringEvents(config: MonitoringConfig): IMonitoringEvents

  /**
   * Get default monitoring configuration
   * 
   * @returns Default monitoring configuration
   */
  getDefaultConfig(): MonitoringConfig
}

/**
 * Monitoring service registry interface
 * 
 * Manages lifecycle and access to monitoring service instances.
 */
export interface IMonitoringServiceRegistry {
  /**
   * Register a monitoring service instance
   * 
   * @param serviceName - Name of the service
   * @param serviceInstance - Service instance to register
   */
  register<T>(serviceName: string, serviceInstance: T): void

  /**
   * Get a registered monitoring service
   * 
   * @param serviceName - Name of the service to retrieve
   * @returns Service instance or undefined if not found
   */
  get<T>(serviceName: string): T | undefined

  /**
   * Check if a service is registered
   * 
   * @param serviceName - Name of the service to check
   * @returns True if service is registered
   */
  has(serviceName: string): boolean

  /**
   * Unregister a monitoring service
   * 
   * @param serviceName - Name of the service to unregister
   */
  unregister(serviceName: string): void

  /**
   * Initialize all registered services
   * 
   * @returns Promise resolving when all services are initialized
   */
  initializeAll(): Promise<void>

  /**
   * Shutdown all registered services
   * 
   * @returns Promise resolving when all services are shut down
   */
  shutdownAll(): Promise<void>
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base monitoring service error
 */
export class MonitoringServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message)
    this.name = 'MonitoringServiceError'
  }
}

/**
 * Validation error for monitoring operations
 */
export class ValidationError extends MonitoringServiceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

/**
 * Not found error for monitoring operations
 */
export class NotFoundError extends MonitoringServiceError {
  constructor(resource: string, id: string) {
    super(`${resource} with ID ${id} not found`, 'NOT_FOUND', { resource, id })
    this.name = 'NotFoundError'
  }
}

/**
 * Conflict error for monitoring operations
 */
export class ConflictError extends MonitoringServiceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT_ERROR', details)
    this.name = 'ConflictError'
  }
}

/**
 * Invalid state error for monitoring operations
 */
export class InvalidStateError extends MonitoringServiceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'INVALID_STATE', details)
    this.name = 'InvalidStateError'
  }
}

/**
 * Collection error for metrics operations
 */
export class CollectionError extends MonitoringServiceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'COLLECTION_ERROR', details)
    this.name = 'CollectionError'
  }
}

/**
 * Database error for monitoring operations
 */
export class DatabaseError extends MonitoringServiceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', details)
    this.name = 'DatabaseError'
  }
}

// ============================================================================
// UTILITY TYPES AND CONSTANTS
// ============================================================================

/**
 * Service initialization options
 */
export interface ServiceInitOptions {
  /** Configuration to use for service initialization */
  config: MonitoringConfig
  /** Whether to start background tasks immediately */
  startBackgroundTasks?: boolean
  /** Custom logger instance */
  logger?: {
    info: (message: string, meta?: any) => void
    warn: (message: string, meta?: any) => void
    error: (message: string, meta?: any) => void
    debug: (message: string, meta?: any) => void
  }
}

/**
 * Background task configuration
 */
export interface BackgroundTaskConfig {
  /** Task name */
  name: string
  /** Task execution interval (milliseconds) */
  interval: number
  /** Whether task is enabled */
  enabled: boolean
  /** Task timeout (milliseconds) */
  timeout?: number
  /** Maximum number of retries on failure */
  maxRetries?: number
}

/**
 * Monitoring service status
 */
export type ServiceStatus = 'initializing' | 'running' | 'stopping' | 'stopped' | 'error'

/**
 * Service health information
 */
export interface ServiceHealth {
  /** Service name */
  name: string
  /** Current service status */
  status: ServiceStatus
  /** Service uptime in milliseconds */
  uptime: number
  /** Last health check timestamp */
  lastHealthCheck: Date
  /** Health check result */
  healthy: boolean
  /** Error message if unhealthy */
  error?: string
  /** Service-specific metrics */
  metrics?: Record<string, number>
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default monitoring configuration values
 */
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  metrics: {
    collectionInterval: 60, // 1 minute
    retentionDays: 30,
    enableDetailedMetrics: true,
    batchSize: 100,
  },
  webhooks: {
    maxPayloadSize: 1024 * 1024, // 1MB
    logHeaders: true,
    logFullPayload: true,
    excludeHeaders: ['authorization', 'x-api-key', 'cookie'],
    processingTimeout: 30000, // 30 seconds
  },
  stages: {
    trackAllStages: true,
    trackedStages: ['received', 'enriching', 'deciding', 'executing', 'completed'],
    maxStageTime: 10000, // 10 seconds
    collectMetadata: true,
  },
  performance: {
    maxProcessingTime: 5000, // 5 seconds
    maxErrorRate: 5, // 5%
    maxQueueDepth: 100,
    maxMemoryUsage: 80, // 80%
    maxCpuUsage: 70, // 70%
    minSuccessRate: 95, // 95%
  },
  alerts: {
    webhookRules: {
      processingTimeThreshold: 5000,
      errorRateThreshold: 10,
      consecutiveFailuresThreshold: 5,
      payloadSizeThreshold: 10 * 1024 * 1024, // 10MB
    },
    systemRules: {
      memoryUsageThreshold: 85,
      cpuUsageThreshold: 80,
      queueDepthThreshold: 150,
      dbConnectionThreshold: 80,
    },
    stageRules: {
      stageTimeoutThreshold: 15000,
      stageFailureRateThreshold: 15,
      monitoredStages: ['enriching', 'deciding', 'executing'],
    },
    notifications: {
      email: {
        enabled: false,
        recipients: [],
      },
      slack: {
        enabled: false,
      },
      webhook: {
        enabled: false,
      },
      inApp: {
        enabled: true,
        persistDays: 7,
      },
    },
    policies: {
      suppressionWindow: 15, // 15 minutes
      autoResolveAfter: 60, // 1 hour
      escalation: {
        escalateAfter: 30, // 30 minutes
        escalationChannels: ['email'],
      },
      severityMappings: {
        'high_processing_time': 'warning',
        'high_error_rate': 'error',
        'system_overload': 'critical',
        'stage_timeout': 'warning',
      },
    },
  },
  realtime: {
    enabled: true,
    maxConnections: 100,
    connectionTimeout: 30,
    heartbeatInterval: 30,
    eventBufferSize: 50,
  },
  dashboard: {
    defaultRefreshInterval: 30,
    refreshIntervals: [5, 10, 30, 60, 300],
    defaultTimeRange: 'last_24_hours',
    maxChartDataPoints: 100,
    autoRefreshEnabled: true,
  },
  retention: {
    webhookRequests: 90,
    processingStages: 90,
    systemMetrics: 30,
    alerts: 180,
    eventHistory: 7,
  },
  features: {
    advancedAnalytics: true,
    anomalyDetection: false,
    predictiveAlerting: false,
    performanceProfiling: true,
    securityMonitoring: true,
    costTracking: false,
  },
} as const

/**
 * Service names for registry
 */
export const MONITORING_SERVICES = {
  WEBHOOK_MONITOR: 'webhookMonitor',
  METRICS_COLLECTOR: 'metricsCollector',
  ALERT_MANAGER: 'alertManager',
  MONITORING_EVENTS: 'monitoringEvents',
} as const

/**
 * Background task names
 */
export const BACKGROUND_TASKS = {
  METRICS_COLLECTION: 'metricsCollection',
  HEALTH_CHECK: 'healthCheck',
  ALERT_EVALUATION: 'alertEvaluation',
  DATA_CLEANUP: 'dataCleanup',
  ANOMALY_DETECTION: 'anomalyDetection',
} as const

/**
 * Event channel names for real-time monitoring
 */
export const MONITORING_CHANNELS = {
  WEBHOOKS: 'monitoring.webhooks',
  STAGES: 'monitoring.stages',
  ALERTS: 'monitoring.alerts',
  METRICS: 'monitoring.metrics',
  HEALTH: 'monitoring.health',
  SYSTEM: 'monitoring.system',
} as const

/**
 * Event names for real-time monitoring
 */
export const MONITORING_EVENTS = {
  WEBHOOK_RECEIVED: 'webhook.received',
  WEBHOOK_PROCESSED: 'webhook.processed',
  WEBHOOK_FAILED: 'webhook.failed',
  STAGE_STARTED: 'stage.started',
  STAGE_COMPLETED: 'stage.completed',
  STAGE_FAILED: 'stage.failed',
  ALERT_CREATED: 'alert.created',
  ALERT_ACKNOWLEDGED: 'alert.acknowledged',
  ALERT_RESOLVED: 'alert.resolved',
  METRICS_UPDATED: 'metrics.updated',
  HEALTH_CHANGED: 'health.changed',
} as const