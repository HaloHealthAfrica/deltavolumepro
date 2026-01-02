/**
 * ============================================================================
 * WEBHOOK MONITORING SYSTEM - MODULE EXPORTS
 * ============================================================================
 * 
 * Central export point for all monitoring system interfaces, types, and utilities.
 * This module provides the complete contract for implementing webhook monitoring
 * services in the DeltaStack Pro application.
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

// ============================================================================
// CORE SERVICE INTERFACES
// ============================================================================

export type {
  IWebhookMonitor,
  IMetricsCollector,
  IAlertManager,
  IMonitoringEvents,
} from './interfaces'

// ============================================================================
// SERVICE IMPLEMENTATIONS
// ============================================================================

export { WebhookMonitor } from './webhook-monitor'

export {
  MetricsCollector,
  getMetricsCollector,
  createMetricsCollector,
  metricsCollector,
} from './metrics-collector'

// ============================================================================
// REAL-TIME BROADCASTING
// ============================================================================

export {
  MonitoringBroadcaster,
  getMonitoringBroadcaster,
  createMonitoringBroadcaster,
} from './monitoring-broadcaster'

export type {
  WebhookEventPayload,
  StageEventPayload,
  AlertEventPayload,
  MetricsUpdatePayload,
  HealthUpdatePayload,
  BroadcastResult,
} from './monitoring-broadcaster'

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

export type {
  MonitoringConfig,
  AlertConfiguration,
  HealthCheckConfig,
} from './interfaces'

// ============================================================================
// SERVICE MANAGEMENT INTERFACES
// ============================================================================

export type {
  IMonitoringServiceFactory,
  IMonitoringServiceRegistry,
  ServiceInitOptions,
  BackgroundTaskConfig,
  ServiceHealth,
} from './interfaces'

// ============================================================================
// ERROR CLASSES
// ============================================================================

export {
  MonitoringServiceError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InvalidStateError,
  CollectionError,
  DatabaseError,
} from './interfaces'

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type {
  ServiceStatus,
} from './interfaces'

// ============================================================================
// CONSTANTS AND DEFAULTS
// ============================================================================

export {
  DEFAULT_MONITORING_CONFIG,
  MONITORING_SERVICES,
  BACKGROUND_TASKS,
  MONITORING_CHANNELS,
  MONITORING_EVENTS,
} from './interfaces'

// ============================================================================
// RE-EXPORT MONITORING TYPES
// ============================================================================

// Re-export all monitoring types for convenience
export type {
  // Core data types
  WebhookRequest,
  ProcessingStage,
  SystemMetrics,
  SystemAlert,
  WebhookEvent,
  SystemHealth,
  
  // Query and filter types
  MonitoringFilters,
  PerformanceMetrics,
  RealTimeMetrics,
  PipelineStatus,
  
  // Status and enum types
  WebhookStatus,
  ProcessingStageType,
  ProcessingStageStatus,
  AlertSeverity,
  AlertCategory,
  WebhookEventType,
  SystemHealthStatus,
  TimeRange,
  
  // Response and pagination types
  MonitoringPaginatedResponse,
  
  // Input types for CRUD operations
  CreateWebhookRequestInput,
  UpdateWebhookRequestInput,
  CreateProcessingStageInput,
  UpdateProcessingStageInput,
  CreateSystemAlertInput,
  UpdateSystemAlertInput,
  
  // Extended types with relations
  WebhookRequestWithRelations,
  
  // Chart and visualization types
  ChartData,
  TimeSeriesDataPoint,
  
  // Health monitoring types
  DatabaseHealth,
  ApiHealth,
  MemoryHealth,
  QueueHealth,
  ErrorSummary,
  
  // Dashboard types
  DashboardWidget,
  DashboardWidgetType,
  DashboardLayout,
  
  // Utility types
  TrendDirection,
} from '@/types/monitoring'

// ============================================================================
// TYPE GUARDS AND VALIDATION
// ============================================================================

export {
  isValidWebhookStatus,
  isValidProcessingStageType,
  isValidAlertSeverity,
  isValidSystemHealthStatus,
} from '@/types/monitoring'

// ============================================================================
// CONSTANTS FROM MONITORING TYPES
// ============================================================================

export {
  DEFAULT_PAGINATION,
  TIME_RANGES,
  ALERT_SEVERITY_PRIORITY,
  PROCESSING_STAGE_ORDER,
  REFRESH_INTERVALS,
} from '@/types/monitoring'

// ============================================================================
// DOCUMENTATION AND USAGE EXAMPLES
// ============================================================================

/**
 * @fileoverview
 * 
 * This module provides comprehensive interfaces for implementing a webhook monitoring
 * system in the DeltaStack Pro application. The monitoring system consists of four
 * main service interfaces:
 * 
 * ## Core Services
 * 
 * ### IWebhookMonitor
 * Main service for tracking webhook requests and processing stages throughout
 * the signal processing pipeline. Handles CRUD operations for webhooks and stages,
 * performance metrics calculation, and system health monitoring.
 * 
 * ### IMetricsCollector
 * Service for collecting, storing, and retrieving system performance metrics.
 * Provides both real-time and historical metrics data for monitoring dashboards,
 * trend analysis, and anomaly detection.
 * 
 * ### IAlertManager
 * Service for managing system alerts and notifications. Handles alert creation,
 * acknowledgment, resolution, and notification delivery through multiple channels
 * (email, Slack, webhooks, in-app).
 * 
 * ### IMonitoringEvents
 * Service for real-time event broadcasting and subscription management via
 * WebSocket connections. Enables live dashboard updates and real-time monitoring.
 * 
 * ## Configuration
 * 
 * The monitoring system is highly configurable through the `MonitoringConfig`
 * interface, which includes:
 * 
 * - Metrics collection intervals and retention policies
 * - Webhook processing settings and limits
 * - Performance thresholds and alert rules
 * - Real-time event configuration
 * - Dashboard settings and feature flags
 * 
 * ## Usage Example
 * 
 * ```typescript
 * import {
 *   IWebhookMonitor,
 *   IMetricsCollector,
 *   IAlertManager,
 *   IMonitoringEvents,
 *   MonitoringConfig,
 *   DEFAULT_MONITORING_CONFIG
 * } from '@/lib/monitoring'
 * 
 * // Create monitoring services with custom configuration
 * const config: MonitoringConfig = {
 *   ...DEFAULT_MONITORING_CONFIG,
 *   metrics: {
 *     ...DEFAULT_MONITORING_CONFIG.metrics,
 *     collectionInterval: 30, // Collect metrics every 30 seconds
 *   },
 * }
 * 
 * // Use services in your application
 * const webhookMonitor: IWebhookMonitor = createWebhookMonitor(config)
 * const metricsCollector: IMetricsCollector = createMetricsCollector(config)
 * const alertManager: IAlertManager = createAlertManager(config)
 * const monitoringEvents: IMonitoringEvents = createMonitoringEvents(config)
 * 
 * // Record a webhook request
 * const webhook = await webhookMonitor.recordWebhookRequest({
 *   sourceIp: '192.168.1.1',
 *   headers: { 'content-type': 'application/json' },
 *   payload: { ticker: 'AAPL', action: 'BUY' },
 *   payloadSize: 1024,
 *   processingTime: 150,
 *   status: 'success'
 * })
 * 
 * // Collect current metrics
 * const metrics = await metricsCollector.collectMetrics()
 * 
 * // Check for alert conditions
 * const alerts = await alertManager.evaluateAlertConditions(metrics)
 * 
 * // Broadcast real-time updates
 * await monitoringEvents.broadcastWebhookEvent({
 *   type: 'webhook_received',
 *   timestamp: new Date(),
 *   data: { webhookId: webhook.id }
 * })
 * ```
 * 
 * ## Integration Points
 * 
 * The monitoring system is designed to integrate with:
 * 
 * - **Existing webhook processing pipeline**: Track requests and stages
 * - **Database models**: Store monitoring data using Prisma models
 * - **Real-time events**: Broadcast updates via Pusher WebSocket connections
 * - **Performance metrics**: Collect system and business metrics
 * - **Alert notifications**: Send alerts through multiple channels
 * 
 * ## Error Handling
 * 
 * The module provides specific error classes for different failure scenarios:
 * 
 * - `ValidationError`: Invalid input data
 * - `NotFoundError`: Resource not found
 * - `ConflictError`: Resource conflicts (e.g., duplicate stages)
 * - `InvalidStateError`: Invalid state transitions
 * - `CollectionError`: Metrics collection failures
 * - `DatabaseError`: Database operation failures
 * 
 * All errors extend the base `MonitoringServiceError` class and include
 * structured error codes and details for proper error handling and logging.
 */