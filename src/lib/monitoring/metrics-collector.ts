/**
 * ============================================================================
 * METRICS COLLECTOR SERVICE IMPLEMENTATION
 * ============================================================================
 * 
 * Production-ready implementation of the IMetricsCollector interface for collecting,
 * storing, and retrieving system performance metrics. This service provides
 * comprehensive metrics collection capabilities including:
 * 
 * - System metrics collection (CPU, memory, database connections)
 * - Webhook processing metrics tracking
 * - Processing stage metrics recording
 * - Historical metrics retrieval with aggregation
 * - Trend analysis and anomaly detection
 * - Chart-ready data generation for dashboards
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import type {
  IMetricsCollector,
  MonitoringConfig,
} from './interfaces'
import {
  CollectionError,
  DEFAULT_MONITORING_CONFIG,
} from './interfaces'
import type {
  SystemMetrics,
  WebhookStatus,
  ProcessingStageType,
  ProcessingStageStatus,
  TimeRange,
  TimeSeriesDataPoint,
  ChartData,
  TrendDirection,
} from '@/types/monitoring'
import { TIME_RANGES } from '@/types/monitoring'

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Webhook metrics record for in-memory tracking */
interface WebhookMetricsRecord {
  webhookId: string
  processingTime: number
  status: WebhookStatus
  payloadSize: number
  timestamp: Date
}

/** Stage metrics record for in-memory tracking */
interface StageMetricsRecord {
  stageId: string
  stage: ProcessingStageType
  duration: number
  status: ProcessingStageStatus
  timestamp: Date
}

/** Anomaly detection result */
interface AnomalyResult {
  metric: string
  timestamp: Date
  value: number
  expectedRange: { min: number; max: number }
  severity: 'low' | 'medium' | 'high'
}

/** Aggregated metrics result */
interface AggregatedMetricsResult {
  webhookVolume: TimeSeriesDataPoint[]
  processingTimes: TimeSeriesDataPoint[]
  errorRates: TimeSeriesDataPoint[]
  queueDepths: TimeSeriesDataPoint[]
  systemLoad: TimeSeriesDataPoint[]
}

// ============================================================================
// METRICS COLLECTOR IMPLEMENTATION
// ============================================================================

/**
 * MetricsCollector service implementation
 * 
 * Implements the IMetricsCollector interface to provide comprehensive metrics
 * collection, storage, and analysis capabilities for the monitoring dashboard.
 */
export class MetricsCollector implements IMetricsCollector {
  private readonly logger = createLogger('MetricsCollector')
  private readonly config: MonitoringConfig
  
  // In-memory buffers for recent metrics (for real-time calculations)
  private webhookMetricsBuffer: WebhookMetricsRecord[] = []
  private stageMetricsBuffer: StageMetricsRecord[] = []
  private readonly bufferMaxSize = 1000
  private readonly bufferRetentionMs = 5 * 60 * 1000 // 5 minutes

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config }
    this.logger.info('MetricsCollector initialized', {
      collectionInterval: this.config.metrics.collectionInterval,
      retentionDays: this.config.metrics.retentionDays,
    })
  }


  // ========================================
  // Metrics Collection
  // ========================================

  /**
   * Collect and store current system metrics snapshot
   * 
   * Gathers metrics from multiple sources:
   * - webhooksPerMinute: Count of webhooks in the last minute
   * - avgProcessingTime: Average processing time from recent webhooks
   * - errorRate: Percentage of failed webhooks
   * - queueDepth: Count of in-progress processing stages
   * - memoryUsage: Process memory usage percentage
   * - cpuUsage: Approximate CPU usage
   * - dbConnections: Active database connections (estimate)
   * - signalsProcessed: Count of signals created
   * - tradesExecuted: Count of trades executed
   * - decisionsApproved: Count of TRADE decisions
   * - decisionsRejected: Count of REJECT decisions
   * 
   * @returns Promise resolving to the collected metrics
   * @throws {CollectionError} When metrics collection fails
   */
  async collectMetrics(): Promise<SystemMetrics> {
    const startTime = Date.now()
    this.logger.debug('Starting metrics collection')

    try {
      // Clean up old buffer entries
      this.cleanupBuffers()

      // Collect all metrics in parallel for efficiency
      const [
        webhookMetrics,
        systemResources,
        businessMetrics,
      ] = await Promise.all([
        this.collectWebhookMetrics(),
        this.collectSystemResources(),
        this.collectBusinessMetrics(),
      ])

      // Create metrics snapshot
      const metricsData = {
        timestamp: new Date(),
        webhooksPerMinute: webhookMetrics.webhooksPerMinute,
        avgProcessingTime: webhookMetrics.avgProcessingTime,
        errorRate: webhookMetrics.errorRate,
        queueDepth: webhookMetrics.queueDepth,
        memoryUsage: systemResources.memoryUsage,
        cpuUsage: systemResources.cpuUsage,
        dbConnections: systemResources.dbConnections,
        signalsProcessed: businessMetrics.signalsProcessed,
        tradesExecuted: businessMetrics.tradesExecuted,
        decisionsApproved: businessMetrics.decisionsApproved,
        decisionsRejected: businessMetrics.decisionsRejected,
      }


      // Store metrics in database
      const storedMetrics = await prisma.systemMetrics.create({
        data: metricsData,
      })

      const collectionTime = Date.now() - startTime
      this.logger.info('Metrics collection completed', {
        metricsId: storedMetrics.id,
        collectionTimeMs: collectionTime,
        webhooksPerMinute: metricsData.webhooksPerMinute,
        errorRate: metricsData.errorRate,
      })

      return this.mapSystemMetricsFromDb(storedMetrics)
    } catch (error) {
      this.logger.error('Failed to collect metrics', error as Error)
      throw new CollectionError('Failed to collect system metrics', {
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Record webhook processing metrics
   * 
   * @param webhookId - Webhook request ID
   * @param processingTime - Time taken to process webhook in milliseconds
   * @param status - Processing status
   * @param payloadSize - Size of webhook payload in bytes
   */
  async recordWebhookMetrics(
    webhookId: string,
    processingTime: number,
    status: WebhookStatus,
    payloadSize: number
  ): Promise<void> {
    try {
      this.logger.debug('Recording webhook metrics', {
        webhookId,
        processingTime,
        status,
        payloadSize,
      })

      // Add to in-memory buffer for real-time calculations
      this.webhookMetricsBuffer.push({
        webhookId,
        processingTime,
        status,
        payloadSize,
        timestamp: new Date(),
      })

      // Trim buffer if it exceeds max size
      if (this.webhookMetricsBuffer.length > this.bufferMaxSize) {
        this.webhookMetricsBuffer = this.webhookMetricsBuffer.slice(-this.bufferMaxSize)
      }
    } catch (error) {
      this.logger.error('Failed to record webhook metrics', error as Error, { webhookId })
    }
  }


  /**
   * Record processing stage metrics
   * 
   * @param stageId - Processing stage ID
   * @param stage - Stage type
   * @param duration - Stage processing duration in milliseconds
   * @param status - Stage completion status
   */
  async recordStageMetrics(
    stageId: string,
    stage: ProcessingStageType,
    duration: number,
    status: ProcessingStageStatus
  ): Promise<void> {
    try {
      this.logger.debug('Recording stage metrics', {
        stageId,
        stage,
        duration,
        status,
      })

      // Add to in-memory buffer for real-time calculations
      this.stageMetricsBuffer.push({
        stageId,
        stage,
        duration,
        status,
        timestamp: new Date(),
      })

      // Trim buffer if it exceeds max size
      if (this.stageMetricsBuffer.length > this.bufferMaxSize) {
        this.stageMetricsBuffer = this.stageMetricsBuffer.slice(-this.bufferMaxSize)
      }
    } catch (error) {
      this.logger.error('Failed to record stage metrics', error as Error, { stageId })
    }
  }

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
  async getHistoricalMetrics(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date,
    interval?: string
  ): Promise<SystemMetrics[]> {
    try {
      const { startDate, endDate } = this.getDateRange(timeRange, customStart, customEnd)
      
      this.logger.debug('Fetching historical metrics', {
        timeRange,
        startDate,
        endDate,
        interval,
      })


      const metrics = await prisma.systemMetrics.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      })

      // Apply interval sampling if specified
      const sampledMetrics = interval 
        ? this.sampleMetricsByInterval(metrics, interval)
        : metrics

      return sampledMetrics.map(m => this.mapSystemMetricsFromDb(m))
    } catch (error) {
      this.logger.error('Failed to get historical metrics', error as Error)
      throw new CollectionError('Failed to retrieve historical metrics', {
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Get aggregated metrics for dashboard widgets
   * 
   * @param timeRange - Time range for aggregation
   * @param customStart - Custom start date
   * @param customEnd - Custom end date
   * @returns Promise resolving to aggregated metrics
   */
  async getAggregatedMetrics(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): Promise<AggregatedMetricsResult> {
    try {
      const { startDate, endDate } = this.getDateRange(timeRange, customStart, customEnd)
      
      this.logger.debug('Fetching aggregated metrics', {
        timeRange,
        startDate,
        endDate,
      })

      const metrics = await prisma.systemMetrics.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      })


      // Transform metrics into time series data points
      const webhookVolume: TimeSeriesDataPoint[] = metrics.map(m => ({
        timestamp: m.timestamp,
        value: m.webhooksPerMinute,
        label: 'Webhooks/min',
      }))

      const processingTimes: TimeSeriesDataPoint[] = metrics.map(m => ({
        timestamp: m.timestamp,
        value: m.avgProcessingTime,
        label: 'Avg Processing Time (ms)',
      }))

      const errorRates: TimeSeriesDataPoint[] = metrics.map(m => ({
        timestamp: m.timestamp,
        value: m.errorRate,
        label: 'Error Rate (%)',
      }))

      const queueDepths: TimeSeriesDataPoint[] = metrics.map(m => ({
        timestamp: m.timestamp,
        value: m.queueDepth,
        label: 'Queue Depth',
      }))

      const systemLoad: TimeSeriesDataPoint[] = metrics.map(m => ({
        timestamp: m.timestamp,
        value: (m.cpuUsage + m.memoryUsage) / 2,
        label: 'System Load (%)',
        metadata: {
          cpuUsage: m.cpuUsage,
          memoryUsage: m.memoryUsage,
        },
      }))

      return {
        webhookVolume,
        processingTimes,
        errorRates,
        queueDepths,
        systemLoad,
      }
    } catch (error) {
      this.logger.error('Failed to get aggregated metrics', error as Error)
      throw new CollectionError('Failed to retrieve aggregated metrics', {
        originalError: (error as Error).message,
      })
    }
  }


  /**
   * Get chart data for specific metric type
   * 
   * @param metricType - Type of metric to chart
   * @param timeRange - Time range for chart data
   * @param customStart - Custom start date
   * @param customEnd - Custom end date
   * @returns Promise resolving to chart data
   */
  async getChartData(
    metricType: 'webhookVolume' | 'processingTime' | 'errorRate' | 'queueDepth' | 'systemLoad',
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): Promise<ChartData> {
    try {
      const aggregatedMetrics = await this.getAggregatedMetrics(timeRange, customStart, customEnd)
      
      const metricConfig: Record<string, { title: string; type: ChartData['type']; data: TimeSeriesDataPoint[] }> = {
        webhookVolume: {
          title: 'Webhook Volume',
          type: 'area',
          data: aggregatedMetrics.webhookVolume,
        },
        processingTime: {
          title: 'Processing Time',
          type: 'line',
          data: aggregatedMetrics.processingTimes,
        },
        errorRate: {
          title: 'Error Rate',
          type: 'line',
          data: aggregatedMetrics.errorRates,
        },
        queueDepth: {
          title: 'Queue Depth',
          type: 'bar',
          data: aggregatedMetrics.queueDepths,
        },
        systemLoad: {
          title: 'System Load',
          type: 'area',
          data: aggregatedMetrics.systemLoad,
        },
      }

      const config = metricConfig[metricType]
      
      return {
        title: config.title,
        type: config.type,
        data: config.data,
        lastUpdated: new Date(),
        options: {
          timeRange,
          metricType,
        },
      }
    } catch (error) {
      this.logger.error('Failed to get chart data', error as Error, { metricType })
      throw new CollectionError('Failed to retrieve chart data', {
        originalError: (error as Error).message,
      })
    }
  }


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
  async calculateTrends(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): Promise<{
    webhookVolumeTrend: TrendDirection
    processingTimeTrend: TrendDirection
    errorRateTrend: TrendDirection
    queueDepthTrend: TrendDirection
  }> {
    try {
      const { startDate, endDate } = this.getDateRange(timeRange, customStart, customEnd)
      
      // Get metrics for the time range
      const metrics = await prisma.systemMetrics.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      })

      if (metrics.length < 2) {
        return {
          webhookVolumeTrend: 'stable',
          processingTimeTrend: 'stable',
          errorRateTrend: 'stable',
          queueDepthTrend: 'stable',
        }
      }

      // Split metrics into first and second half for comparison
      const midpoint = Math.floor(metrics.length / 2)
      const firstHalf = metrics.slice(0, midpoint)
      const secondHalf = metrics.slice(midpoint)


      // Calculate averages for each half
      const firstHalfAvg = {
        webhookVolume: this.average(firstHalf.map(m => m.webhooksPerMinute)),
        processingTime: this.average(firstHalf.map(m => m.avgProcessingTime)),
        errorRate: this.average(firstHalf.map(m => m.errorRate)),
        queueDepth: this.average(firstHalf.map(m => m.queueDepth)),
      }

      const secondHalfAvg = {
        webhookVolume: this.average(secondHalf.map(m => m.webhooksPerMinute)),
        processingTime: this.average(secondHalf.map(m => m.avgProcessingTime)),
        errorRate: this.average(secondHalf.map(m => m.errorRate)),
        queueDepth: this.average(secondHalf.map(m => m.queueDepth)),
      }

      // Determine trends (10% threshold for change)
      const threshold = 0.1

      return {
        webhookVolumeTrend: this.determineTrend(firstHalfAvg.webhookVolume, secondHalfAvg.webhookVolume, threshold),
        processingTimeTrend: this.determineTrend(firstHalfAvg.processingTime, secondHalfAvg.processingTime, threshold),
        errorRateTrend: this.determineTrend(firstHalfAvg.errorRate, secondHalfAvg.errorRate, threshold),
        queueDepthTrend: this.determineTrend(firstHalfAvg.queueDepth, secondHalfAvg.queueDepth, threshold),
      }
    } catch (error) {
      this.logger.error('Failed to calculate trends', error as Error)
      throw new CollectionError('Failed to calculate performance trends', {
        originalError: (error as Error).message,
      })
    }
  }


  /**
   * Detect performance anomalies
   * 
   * @param lookbackHours - Hours to look back for anomaly detection (default: 24)
   * @returns Promise resolving to detected anomalies
   */
  async detectAnomalies(lookbackHours: number = 24): Promise<{
    anomalies: AnomalyResult[]
    summary: {
      totalAnomalies: number
      highSeverityCount: number
      affectedMetrics: string[]
    }
  }> {
    try {
      const startDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000)
      
      this.logger.debug('Detecting anomalies', { lookbackHours, startDate })

      // Get historical metrics for baseline calculation
      const metrics = await prisma.systemMetrics.findMany({
        where: {
          timestamp: {
            gte: startDate,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      })

      if (metrics.length < 10) {
        return {
          anomalies: [],
          summary: {
            totalAnomalies: 0,
            highSeverityCount: 0,
            affectedMetrics: [],
          },
        }
      }

      const anomalies: AnomalyResult[] = []
      const metricsToCheck = [
        { name: 'webhooksPerMinute', key: 'webhooksPerMinute' as const },
        { name: 'avgProcessingTime', key: 'avgProcessingTime' as const },
        { name: 'errorRate', key: 'errorRate' as const },
        { name: 'queueDepth', key: 'queueDepth' as const },
        { name: 'memoryUsage', key: 'memoryUsage' as const },
        { name: 'cpuUsage', key: 'cpuUsage' as const },
      ]


      for (const metricDef of metricsToCheck) {
        const values = metrics.map(m => m[metricDef.key])
        const mean = this.average(values)
        const stdDev = this.standardDeviation(values)

        // Check each data point for anomalies (values outside 2 standard deviations)
        for (const metric of metrics) {
          const value = metric[metricDef.key]
          const zScore = stdDev > 0 ? Math.abs(value - mean) / stdDev : 0

          if (zScore > 2) {
            const severity = zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low'
            
            anomalies.push({
              metric: metricDef.name,
              timestamp: metric.timestamp,
              value,
              expectedRange: {
                min: mean - 2 * stdDev,
                max: mean + 2 * stdDev,
              },
              severity,
            })
          }
        }
      }

      // Sort anomalies by severity and timestamp
      anomalies.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 }
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity]
        }
        return b.timestamp.getTime() - a.timestamp.getTime()
      })

      const highSeverityCount = anomalies.filter(a => a.severity === 'high').length
      const affectedMetrics = [...new Set(anomalies.map(a => a.metric))]

      this.logger.info('Anomaly detection completed', {
        totalAnomalies: anomalies.length,
        highSeverityCount,
        affectedMetrics,
      })

      return {
        anomalies,
        summary: {
          totalAnomalies: anomalies.length,
          highSeverityCount,
          affectedMetrics,
        },
      }
    } catch (error) {
      this.logger.error('Failed to detect anomalies', error as Error)
      throw new CollectionError('Failed to detect performance anomalies', {
        originalError: (error as Error).message,
      })
    }
  }


  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Collect webhook-related metrics from database and buffer
   */
  private async collectWebhookMetrics(): Promise<{
    webhooksPerMinute: number
    avgProcessingTime: number
    errorRate: number
    queueDepth: number
  }> {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    try {
      // Count webhooks in the last minute
      const webhooksLastMinute = await prisma.webhookLog.count({
        where: {
          createdAt: {
            gte: oneMinuteAgo,
          },
        },
      })

      // Get recent webhooks for processing time calculation
      const recentWebhooks = await prisma.webhookLog.findMany({
        where: {
          createdAt: {
            gte: fiveMinutesAgo,
          },
        },
        select: {
          processingTime: true,
          status: true,
        },
      })

      // Calculate average processing time
      const processingTimes = recentWebhooks.map(w => w.processingTime)
      const avgProcessingTime = processingTimes.length > 0
        ? this.average(processingTimes)
        : 0

      // Calculate error rate
      const failedCount = recentWebhooks.filter(w => w.status === 'failed').length
      const errorRate = recentWebhooks.length > 0
        ? (failedCount / recentWebhooks.length) * 100
        : 0

      // Count in-progress processing stages (queue depth)
      const queueDepth = await prisma.processingStage.count({
        where: {
          status: 'in_progress',
        },
      })

      return {
        webhooksPerMinute: webhooksLastMinute,
        avgProcessingTime,
        errorRate,
        queueDepth,
      }
    } catch (error) {
      this.logger.error('Failed to collect webhook metrics', error as Error)
      return {
        webhooksPerMinute: 0,
        avgProcessingTime: 0,
        errorRate: 0,
        queueDepth: 0,
      }
    }
  }


  /**
   * Collect system resource metrics
   */
  private async collectSystemResources(): Promise<{
    memoryUsage: number
    cpuUsage: number
    dbConnections: number
  }> {
    try {
      // Get memory usage from process
      const memoryInfo = process.memoryUsage()
      const totalMemory = memoryInfo.heapTotal
      const usedMemory = memoryInfo.heapUsed
      const memoryUsage = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0

      // Approximate CPU usage using process.cpuUsage()
      // Note: This is a rough estimate; for production, consider using os-utils or similar
      const cpuUsage = await this.estimateCpuUsage()

      // Estimate database connections
      // In a real implementation, this would query the database connection pool
      const dbConnections = await this.estimateDbConnections()

      return {
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        dbConnections,
      }
    } catch (error) {
      this.logger.error('Failed to collect system resources', error as Error)
      return {
        memoryUsage: 0,
        cpuUsage: 0,
        dbConnections: 0,
      }
    }
  }

  /**
   * Estimate CPU usage
   */
  private async estimateCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage()
      const startTime = Date.now()

      // Sample CPU usage over 100ms
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage)
        const elapsedTime = (Date.now() - startTime) * 1000 // Convert to microseconds
        
        // Calculate CPU percentage
        const totalCpuTime = endUsage.user + endUsage.system
        const cpuPercent = elapsedTime > 0 ? (totalCpuTime / elapsedTime) * 100 : 0
        
        resolve(Math.min(cpuPercent, 100))
      }, 100)
    })
  }


  /**
   * Estimate active database connections
   */
  private async estimateDbConnections(): Promise<number> {
    try {
      // For SQLite, we estimate based on recent activity
      // In production with PostgreSQL/MySQL, you would query the connection pool
      const recentActivity = await prisma.webhookLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 10 * 1000), // Last 10 seconds
          },
        },
      })
      
      // Estimate connections based on activity (rough approximation)
      // Minimum 1 connection, scale with activity
      return Math.max(1, Math.min(recentActivity, 10))
    } catch (error) {
      this.logger.error('Failed to estimate DB connections', error as Error)
      return 1
    }
  }

  /**
   * Collect business metrics from database
   */
  private async collectBusinessMetrics(): Promise<{
    signalsProcessed: number
    tradesExecuted: number
    decisionsApproved: number
    decisionsRejected: number
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    try {
      // Count signals processed in the last hour
      const signalsProcessed = await prisma.signal.count({
        where: {
          createdAt: {
            gte: oneHourAgo,
          },
        },
      })

      // Count trades executed in the last hour
      const tradesExecuted = await prisma.trade.count({
        where: {
          createdAt: {
            gte: oneHourAgo,
          },
        },
      })

      // Count approved decisions (TRADE)
      const decisionsApproved = await prisma.decision.count({
        where: {
          createdAt: {
            gte: oneHourAgo,
          },
          decision: 'TRADE',
        },
      })

      // Count rejected decisions (REJECT)
      const decisionsRejected = await prisma.decision.count({
        where: {
          createdAt: {
            gte: oneHourAgo,
          },
          decision: 'REJECT',
        },
      })

      return {
        signalsProcessed,
        tradesExecuted,
        decisionsApproved,
        decisionsRejected,
      }
    } catch (error) {
      this.logger.error('Failed to collect business metrics', error as Error)
      return {
        signalsProcessed: 0,
        tradesExecuted: 0,
        decisionsApproved: 0,
        decisionsRejected: 0,
      }
    }
  }


  /**
   * Clean up old entries from in-memory buffers
   */
  private cleanupBuffers(): void {
    const cutoffTime = Date.now() - this.bufferRetentionMs

    this.webhookMetricsBuffer = this.webhookMetricsBuffer.filter(
      record => record.timestamp.getTime() > cutoffTime
    )

    this.stageMetricsBuffer = this.stageMetricsBuffer.filter(
      record => record.timestamp.getTime() > cutoffTime
    )
  }

  /**
   * Get date range from time range specification
   */
  private getDateRange(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): { startDate: Date; endDate: Date } {
    const endDate = customEnd || new Date()
    let startDate: Date

    if (timeRange === 'custom' && customStart) {
      startDate = customStart
    } else if (timeRange !== 'custom') {
      const rangeSeconds = TIME_RANGES[timeRange]
      startDate = new Date(endDate.getTime() - rangeSeconds * 1000)
    } else {
      // Default to last 24 hours if custom but no start date provided
      startDate = new Date(endDate.getTime() - TIME_RANGES.last_24_hours * 1000)
    }

    return { startDate, endDate }
  }

  /**
   * Sample metrics by interval
   */
  private sampleMetricsByInterval(
    metrics: any[],
    interval: string
  ): any[] {
    if (metrics.length === 0) return []

    // Parse interval (e.g., '1m', '5m', '1h')
    const match = interval.match(/^(\d+)([mh])$/)
    if (!match) return metrics

    const value = parseInt(match[1], 10)
    const unit = match[2]
    const intervalMs = unit === 'h' ? value * 60 * 60 * 1000 : value * 60 * 1000

    const sampled: any[] = []
    let lastSampleTime = 0

    for (const metric of metrics) {
      const metricTime = metric.timestamp.getTime()
      if (metricTime - lastSampleTime >= intervalMs) {
        sampled.push(metric)
        lastSampleTime = metricTime
      }
    }

    return sampled
  }


  /**
   * Map database record to SystemMetrics type
   */
  private mapSystemMetricsFromDb(dbRecord: any): SystemMetrics {
    return {
      id: dbRecord.id,
      timestamp: dbRecord.timestamp,
      webhooksPerMinute: dbRecord.webhooksPerMinute,
      avgProcessingTime: dbRecord.avgProcessingTime,
      errorRate: dbRecord.errorRate,
      queueDepth: dbRecord.queueDepth,
      memoryUsage: dbRecord.memoryUsage,
      cpuUsage: dbRecord.cpuUsage,
      dbConnections: dbRecord.dbConnections,
      signalsProcessed: dbRecord.signalsProcessed,
      tradesExecuted: dbRecord.tradesExecuted,
      decisionsApproved: dbRecord.decisionsApproved,
      decisionsRejected: dbRecord.decisionsRejected,
    }
  }

  /**
   * Calculate average of an array of numbers
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * Calculate standard deviation of an array of numbers
   */
  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0
    const avg = this.average(values)
    const squareDiffs = values.map(value => Math.pow(value - avg, 2))
    const avgSquareDiff = this.average(squareDiffs)
    return Math.sqrt(avgSquareDiff)
  }

  /**
   * Determine trend direction based on value comparison
   */
  private determineTrend(
    oldValue: number,
    newValue: number,
    threshold: number
  ): TrendDirection {
    if (oldValue === 0) {
      return newValue > 0 ? 'up' : 'stable'
    }
    
    const changePercent = (newValue - oldValue) / oldValue
    
    if (changePercent > threshold) return 'up'
    if (changePercent < -threshold) return 'down'
    return 'stable'
  }
}


// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/** Singleton instance of MetricsCollector */
let metricsCollectorInstance: MetricsCollector | null = null

/**
 * Get the singleton MetricsCollector instance
 * 
 * @param config - Optional configuration to use when creating the instance
 * @returns The MetricsCollector singleton instance
 */
export function getMetricsCollector(config?: Partial<MonitoringConfig>): MetricsCollector {
  if (!metricsCollectorInstance) {
    metricsCollectorInstance = new MetricsCollector(config)
  }
  return metricsCollectorInstance
}

/**
 * Create a new MetricsCollector instance (for testing or custom configurations)
 * 
 * @param config - Optional configuration for the new instance
 * @returns A new MetricsCollector instance
 */
export function createMetricsCollector(config?: Partial<MonitoringConfig>): MetricsCollector {
  return new MetricsCollector(config)
}

/** Default export of the singleton instance */
export const metricsCollector = getMetricsCollector()
