/**
 * ============================================================================
 * WEBHOOK MONITOR SERVICE IMPLEMENTATION
 * ============================================================================
 * 
 * Production-ready implementation of the IWebhookMonitor interface for tracking
 * webhook requests and processing stages throughout the signal processing pipeline.
 * 
 * This service provides comprehensive monitoring capabilities including:
 * - Webhook request lifecycle tracking
 * - Processing stage management
 * - Performance metrics calculation
 * - System health monitoring
 * - Integration with existing Signal processing workflow
 * 
 * @author DeltaStack Pro
 * @version 1.0.0
 */

import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import type {
  IWebhookMonitor,
  WebhookRequest,
  ProcessingStage,
  SystemHealth,
  MonitoringFilters,
  PerformanceMetrics,
  RealTimeMetrics,
  PipelineStatus,
  WebhookStatus,
  ProcessingStageType,
  ProcessingStageStatus,
  SystemHealthStatus,
  TimeRange,
  MonitoringPaginatedResponse,
  CreateWebhookRequestInput,
  UpdateWebhookRequestInput,
  CreateProcessingStageInput,
  UpdateProcessingStageInput,
  WebhookRequestWithRelations,
  ValidationError,
  NotFoundError,
  ConflictError,
  InvalidStateError,
  DatabaseError,
  TIME_RANGES,
  DEFAULT_PAGINATION,
  PROCESSING_STAGE_ORDER,
} from '@/lib/monitoring'

/**
 * WebhookMonitor service implementation
 * 
 * Implements the IWebhookMonitor interface to provide comprehensive webhook
 * monitoring capabilities integrated with the existing DeltaStack Pro pipeline.
 */
export class WebhookMonitor implements IWebhookMonitor {
  private readonly logger = createLogger('WebhookMonitor')

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
  async recordWebhookRequest(request: CreateWebhookRequestInput): Promise<WebhookRequest> {
    this.logger.debug('Recording webhook request', { 
      sourceIp: request.sourceIp,
      payloadSize: request.payloadSize,
      status: request.status 
    })

    try {
      // Validate required fields
      this.validateWebhookRequestInput(request)

      // Create webhook log record
      const webhookLog = await prisma.webhookLog.create({
        data: {
          sourceIp: request.sourceIp,
          userAgent: request.userAgent || null,
          headers: request.headers,
          payload: request.payload,
          payloadSize: request.payloadSize,
          signature: request.signature || null,
          processingTime: request.processingTime,
          status: request.status,
          errorMessage: request.errorMessage || null,
          errorStack: request.errorStack || null,
          signalId: request.signalId || null,
        },
      })

      this.logger.info('Webhook request recorded successfully', {
        webhookId: webhookLog.id,
        status: webhookLog.status,
        processingTime: webhookLog.processingTime,
      })

      return this.mapWebhookLogToRequest(webhookLog)
    } catch (error) {
      this.logger.error('Failed to record webhook request', error as Error, {
        sourceIp: request.sourceIp,
        status: request.status,
      })

      if (error instanceof ValidationError) {
        throw error
      }

      throw new DatabaseError('Failed to record webhook request', {
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Update an existing webhook request with processing results
   * 
   * @param id - Webhook request ID
   * @param updates - Partial update data
   * @returns Promise resolving to the updated webhook request
   * @throws {NotFoundError} When webhook request doesn't exist
   * @throws {ValidationError} When update data is invalid
   */
  async updateWebhookRequest(id: string, updates: Partial<UpdateWebhookRequestInput>): Promise<WebhookRequest> {
    this.logger.debug('Updating webhook request', { webhookId: id, updates })

    try {
      // Validate update data
      this.validateWebhookRequestUpdate(updates)

      // Check if webhook exists
      const existing = await prisma.webhookLog.findUnique({
        where: { id },
      })

      if (!existing) {
        throw new NotFoundError('WebhookRequest', id)
      }

      // Update webhook log
      const updated = await prisma.webhookLog.update({
        where: { id },
        data: {
          ...(updates.userAgent !== undefined && { userAgent: updates.userAgent }),
          ...(updates.headers !== undefined && { headers: updates.headers }),
          ...(updates.payload !== undefined && { payload: updates.payload }),
          ...(updates.payloadSize !== undefined && { payloadSize: updates.payloadSize }),
          ...(updates.signature !== undefined && { signature: updates.signature }),
          ...(updates.processingTime !== undefined && { processingTime: updates.processingTime }),
          ...(updates.status !== undefined && { status: updates.status }),
          ...(updates.errorMessage !== undefined && { errorMessage: updates.errorMessage }),
          ...(updates.errorStack !== undefined && { errorStack: updates.errorStack }),
          ...(updates.signalId !== undefined && { signalId: updates.signalId }),
        },
      })

      this.logger.info('Webhook request updated successfully', {
        webhookId: id,
        status: updated.status,
      })

      return this.mapWebhookLogToRequest(updated)
    } catch (error) {
      this.logger.error('Failed to update webhook request', error as Error, {
        webhookId: id,
      })

      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error
      }

      throw new DatabaseError('Failed to update webhook request', {
        webhookId: id,
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Get webhook request by ID with optional related data
   * 
   * @param id - Webhook request ID
   * @param includeRelations - Whether to include related signal and stages data
   * @returns Promise resolving to webhook request or null if not found
   */
  async getWebhookRequest(id: string, includeRelations = false): Promise<WebhookRequestWithRelations | null> {
    this.logger.debug('Fetching webhook request', { webhookId: id, includeRelations })

    try {
      const webhookLog = await prisma.webhookLog.findUnique({
        where: { id },
        include: includeRelations ? {
          signal: {
            select: {
              id: true,
              ticker: true,
              action: true,
              quality: true,
              status: true,
            },
          },
        } : undefined,
      })

      if (!webhookLog) {
        return null
      }

      const webhook = this.mapWebhookLogToRequest(webhookLog) as WebhookRequestWithRelations

      if (includeRelations && webhookLog.signal) {
        webhook.signal = webhookLog.signal
        
        // Fetch processing stages if signal exists
        if (webhookLog.signalId) {
          webhook.stages = await this.getProcessingStages(webhookLog.signalId)
        }
      }

      return webhook
    } catch (error) {
      this.logger.error('Failed to fetch webhook request', error as Error, {
        webhookId: id,
      })

      throw new DatabaseError('Failed to fetch webhook request', {
        webhookId: id,
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Get paginated list of webhook requests with filtering
   * 
   * @param filters - Filtering and pagination options
   * @returns Promise resolving to paginated webhook requests
   */
  async getWebhookRequests(filters: MonitoringFilters = {}): Promise<MonitoringPaginatedResponse<WebhookRequestWithRelations>> {
    const startTime = Date.now()
    this.logger.debug('Fetching webhook requests with filters', { filters })

    try {
      const {
        page = DEFAULT_PAGINATION.page,
        limit = DEFAULT_PAGINATION.limit,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        dateFrom,
        dateTo,
        timeRange,
        webhookStatus,
        sourceIps,
        userAgents,
        tickers,
        minProcessingTime,
        maxProcessingTime,
        minPayloadSize,
        maxPayloadSize,
      } = filters

      // Build where clause
      const where: any = {}

      // Date filtering
      if (dateFrom || dateTo || timeRange) {
        where.createdAt = {}
        
        if (timeRange && timeRange !== 'custom') {
          const now = new Date()
          const secondsAgo = TIME_RANGES[timeRange]
          where.createdAt.gte = new Date(now.getTime() - secondsAgo * 1000)
        } else {
          if (dateFrom) where.createdAt.gte = dateFrom
          if (dateTo) where.createdAt.lte = dateTo
        }
      }

      // Status filtering
      if (webhookStatus && webhookStatus.length > 0) {
        where.status = { in: webhookStatus }
      }

      // Source IP filtering
      if (sourceIps && sourceIps.length > 0) {
        where.sourceIp = { in: sourceIps }
      }

      // User agent filtering
      if (userAgents && userAgents.length > 0) {
        where.userAgent = { in: userAgents }
      }

      // Processing time filtering
      if (minProcessingTime !== undefined || maxProcessingTime !== undefined) {
        where.processingTime = {}
        if (minProcessingTime !== undefined) where.processingTime.gte = minProcessingTime
        if (maxProcessingTime !== undefined) where.processingTime.lte = maxProcessingTime
      }

      // Payload size filtering
      if (minPayloadSize !== undefined || maxPayloadSize !== undefined) {
        where.payloadSize = {}
        if (minPayloadSize !== undefined) where.payloadSize.gte = minPayloadSize
        if (maxPayloadSize !== undefined) where.payloadSize.lte = maxPayloadSize
      }

      // Ticker filtering (requires join with signal)
      if (tickers && tickers.length > 0) {
        where.signal = {
          ticker: { in: tickers }
        }
      }

      // Calculate pagination
      const skip = (page - 1) * limit
      const take = Math.min(limit, DEFAULT_PAGINATION.maxLimit)

      // Execute queries
      const [webhookLogs, total] = await Promise.all([
        prisma.webhookLog.findMany({
          where,
          include: {
            signal: {
              select: {
                id: true,
                ticker: true,
                action: true,
                quality: true,
                status: true,
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take,
        }),
        prisma.webhookLog.count({ where }),
      ])

      // Map results and fetch stages for each webhook with a signal
      const data: WebhookRequestWithRelations[] = await Promise.all(
        webhookLogs.map(async (log) => {
          const webhook = this.mapWebhookLogToRequest(log) as WebhookRequestWithRelations
          
          if (log.signal) {
            webhook.signal = log.signal
            
            if (log.signalId) {
              webhook.stages = await this.getProcessingStages(log.signalId)
            }
          }
          
          return webhook
        })
      )

      const totalPages = Math.ceil(total / take)
      const processingTime = Date.now() - startTime

      this.logger.info('Webhook requests fetched successfully', {
        total,
        page,
        limit: take,
        processingTime,
      })

      return {
        data,
        pagination: {
          page,
          limit: take,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters,
        metadata: {
          generatedAt: new Date(),
          processingTime,
        },
      }
    } catch (error) {
      this.logger.error('Failed to fetch webhook requests', error as Error, { filters })

      throw new DatabaseError('Failed to fetch webhook requests', {
        filters,
        originalError: (error as Error).message,
      })
    }
  }

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
  async startProcessingStage(stage: CreateProcessingStageInput): Promise<ProcessingStage> {
    this.logger.debug('Starting processing stage', {
      signalId: stage.signalId,
      stage: stage.stage,
    })

    try {
      // Validate stage data
      this.validateProcessingStageInput(stage)

      // Check if stage already exists for this signal
      const existing = await prisma.processingStage.findFirst({
        where: {
          signalId: stage.signalId,
          stage: stage.stage,
        },
      })

      if (existing) {
        throw new ConflictError('Processing stage already exists for signal', {
          signalId: stage.signalId,
          stage: stage.stage,
        })
      }

      // Create processing stage
      const processingStage = await prisma.processingStage.create({
        data: {
          signalId: stage.signalId,
          stage: stage.stage,
          startedAt: stage.startedAt,
          completedAt: stage.completedAt || null,
          duration: stage.duration || null,
          status: stage.status,
          errorMessage: stage.errorMessage || null,
          metadata: stage.metadata || null,
        },
      })

      this.logger.info('Processing stage started successfully', {
        stageId: processingStage.id,
        signalId: stage.signalId,
        stage: stage.stage,
      })

      return this.mapProcessingStageFromDb(processingStage)
    } catch (error) {
      this.logger.error('Failed to start processing stage', error as Error, {
        signalId: stage.signalId,
        stage: stage.stage,
      })

      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error
      }

      throw new DatabaseError('Failed to start processing stage', {
        signalId: stage.signalId,
        stage: stage.stage,
        originalError: (error as Error).message,
      })
    }
  }

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
  async completeProcessingStage(
    id: string,
    status: 'completed' | 'failed',
    metadata?: Record<string, any>,
    errorMessage?: string
  ): Promise<ProcessingStage> {
    this.logger.debug('Completing processing stage', {
      stageId: id,
      status,
      hasMetadata: !!metadata,
    })

    try {
      // Check if stage exists and is not already completed
      const existing = await prisma.processingStage.findUnique({
        where: { id },
      })

      if (!existing) {
        throw new NotFoundError('ProcessingStage', id)
      }

      if (existing.status !== 'in_progress') {
        throw new InvalidStateError('Processing stage is already completed', {
          stageId: id,
          currentStatus: existing.status,
        })
      }

      const completedAt = new Date()
      const duration = completedAt.getTime() - existing.startedAt.getTime()

      // Update processing stage
      const updated = await prisma.processingStage.update({
        where: { id },
        data: {
          status,
          completedAt,
          duration,
          errorMessage: errorMessage || null,
          metadata: metadata ? { ...existing.metadata, ...metadata } : existing.metadata,
        },
      })

      this.logger.info('Processing stage completed successfully', {
        stageId: id,
        status,
        duration,
      })

      return this.mapProcessingStageFromDb(updated)
    } catch (error) {
      this.logger.error('Failed to complete processing stage', error as Error, {
        stageId: id,
        status,
      })

      if (error instanceof NotFoundError || error instanceof InvalidStateError) {
        throw error
      }

      throw new DatabaseError('Failed to complete processing stage', {
        stageId: id,
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Get processing stages for a specific signal
   * 
   * @param signalId - Signal ID to get stages for
   * @returns Promise resolving to array of processing stages
   */
  async getProcessingStages(signalId: string): Promise<ProcessingStage[]> {
    this.logger.debug('Fetching processing stages', { signalId })

    try {
      const stages = await prisma.processingStage.findMany({
        where: { signalId },
        orderBy: { startedAt: 'asc' },
      })

      return stages.map(stage => this.mapProcessingStageFromDb(stage))
    } catch (error) {
      this.logger.error('Failed to fetch processing stages', error as Error, {
        signalId,
      })

      throw new DatabaseError('Failed to fetch processing stages', {
        signalId,
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Get current pipeline status for a signal
   * 
   * @param signalId - Signal ID to get pipeline status for
   * @returns Promise resolving to pipeline status or null if not found
   */
  async getPipelineStatus(signalId: string): Promise<PipelineStatus | null> {
    this.logger.debug('Fetching pipeline status', { signalId })

    try {
      const stages = await this.getProcessingStages(signalId)
      
      if (stages.length === 0) {
        return null
      }

      // Find current stage and overall status
      const inProgressStage = stages.find(s => s.status === 'in_progress')
      const failedStage = stages.find(s => s.status === 'failed')
      
      let currentStage: ProcessingStageType
      let status: ProcessingStageStatus
      
      if (failedStage) {
        currentStage = failedStage.stage
        status = 'failed'
      } else if (inProgressStage) {
        currentStage = inProgressStage.stage
        status = 'in_progress'
      } else {
        // All stages completed, find the last one
        const lastStage = stages[stages.length - 1]
        currentStage = lastStage.stage
        status = 'completed'
      }

      // Calculate total processing time
      const startTime = stages[0].startedAt.getTime()
      const endTime = status === 'in_progress' ? Date.now() : 
        Math.max(...stages.filter(s => s.completedAt).map(s => s.completedAt!.getTime()))
      
      const totalProcessingTime = endTime - startTime

      // Estimate completion time for in-progress pipelines
      let estimatedCompletion: Date | undefined
      if (status === 'in_progress') {
        const avgStageTime = stages
          .filter(s => s.duration)
          .reduce((sum, s) => sum + s.duration!, 0) / stages.filter(s => s.duration).length || 5000
        
        const remainingStages = PROCESSING_STAGE_ORDER.length - stages.length
        estimatedCompletion = new Date(Date.now() + remainingStages * avgStageTime)
      }

      return {
        id: `pipeline-${signalId}`,
        signalId,
        currentStage,
        status,
        startedAt: stages[0].startedAt,
        totalProcessingTime,
        stages,
        estimatedCompletion,
      }
    } catch (error) {
      this.logger.error('Failed to fetch pipeline status', error as Error, {
        signalId,
      })

      throw new DatabaseError('Failed to fetch pipeline status', {
        signalId,
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Get all active processing stages across all signals
   * 
   * @returns Promise resolving to array of active processing stages
   */
  async getActiveProcessingStages(): Promise<ProcessingStage[]> {
    this.logger.debug('Fetching active processing stages')

    try {
      const stages = await prisma.processingStage.findMany({
        where: { status: 'in_progress' },
        orderBy: { startedAt: 'desc' },
      })

      return stages.map(stage => this.mapProcessingStageFromDb(stage))
    } catch (error) {
      this.logger.error('Failed to fetch active processing stages', error as Error)

      throw new DatabaseError('Failed to fetch active processing stages', {
        originalError: (error as Error).message,
      })
    }
  }

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
  async getPerformanceMetrics(
    timeRange: TimeRange,
    customStart?: Date,
    customEnd?: Date
  ): Promise<PerformanceMetrics> {
    this.logger.debug('Calculating performance metrics', { timeRange, customStart, customEnd })

    try {
      // Calculate time period
      let start: Date
      let end: Date = new Date()

      if (timeRange === 'custom') {
        if (!customStart || !customEnd) {
          throw new ValidationError('Custom start and end dates are required for custom time range')
        }
        start = customStart
        end = customEnd
      } else {
        const secondsAgo = TIME_RANGES[timeRange]
        start = new Date(end.getTime() - secondsAgo * 1000)
      }

      const duration = Math.floor((end.getTime() - start.getTime()) / 1000)

      // Fetch webhook data for the period
      const webhooks = await prisma.webhookLog.findMany({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
        include: {
          signal: {
            select: {
              id: true,
              ticker: true,
              trades: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      })

      // Calculate basic metrics
      const totalWebhooks = webhooks.length
      const successfulWebhooks = webhooks.filter(w => w.status === 'success').length
      const failedWebhooks = webhooks.filter(w => w.status === 'failed').length
      const successRate = totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks) * 100 : 0

      // Processing time metrics
      const processingTimes = webhooks.map(w => w.processingTime).sort((a, b) => a - b)
      const avgProcessingTime = processingTimes.length > 0 ? 
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length : 0
      
      const p95Index = Math.floor(processingTimes.length * 0.95)
      const p99Index = Math.floor(processingTimes.length * 0.99)
      const p95ProcessingTime = processingTimes[p95Index] || 0
      const p99ProcessingTime = processingTimes[p99Index] || 0
      const maxProcessingTime = processingTimes[processingTimes.length - 1] || 0

      // Throughput metrics
      const webhooksPerSecond = duration > 0 ? totalWebhooks / duration : 0
      const peakWebhooksPerMinute = await this.calculatePeakWebhooksPerMinute(start, end)
      
      // Queue metrics (current snapshot)
      const activeStages = await this.getActiveProcessingStages()
      const avgQueueDepth = activeStages.length
      const maxQueueDepth = await this.calculateMaxQueueDepth(start, end)

      // Error analysis
      const topErrors = await this.calculateTopErrors(start, end)
      const errorTrend = await this.calculateErrorTrend(start, end)

      // Business metrics
      const signalsGenerated = webhooks.filter(w => w.signalId).length
      const signalConversionRate = totalWebhooks > 0 ? (signalsGenerated / totalWebhooks) * 100 : 0
      
      const tradesExecuted = webhooks.reduce((count, w) => 
        count + (w.signal?.trades?.length || 0), 0)
      const tradeConversionRate = signalsGenerated > 0 ? (tradesExecuted / signalsGenerated) * 100 : 0

      return {
        period: {
          start,
          end,
          duration,
        },
        totalWebhooks,
        successfulWebhooks,
        failedWebhooks,
        successRate,
        avgProcessingTime,
        p95ProcessingTime,
        p99ProcessingTime,
        maxProcessingTime,
        webhooksPerSecond,
        peakWebhooksPerMinute,
        avgQueueDepth,
        maxQueueDepth,
        topErrors,
        errorTrend,
        signalsGenerated,
        signalConversionRate,
        tradesExecuted,
        tradeConversionRate,
      }
    } catch (error) {
      this.logger.error('Failed to calculate performance metrics', error as Error, {
        timeRange,
        customStart,
        customEnd,
      })

      if (error instanceof ValidationError) {
        throw error
      }

      throw new DatabaseError('Failed to calculate performance metrics', {
        timeRange,
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Get real-time metrics snapshot
   * 
   * @returns Promise resolving to current real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    this.logger.debug('Fetching real-time metrics')

    try {
      const now = new Date()
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)
      const recentLimit = 100

      // Get recent webhooks (last minute)
      const recentWebhooks = await prisma.webhookLog.findMany({
        where: {
          createdAt: { gte: oneMinuteAgo },
        },
      })

      // Get active processing stages
      const activeStages = await this.getActiveProcessingStages()

      // Get recent processing times (last 100 requests)
      const recentProcessingTimes = await prisma.webhookLog.findMany({
        select: { processingTime: true },
        orderBy: { createdAt: 'desc' },
        take: recentLimit,
      })

      const avgProcessingTime = recentProcessingTimes.length > 0 ?
        recentProcessingTimes.reduce((sum, w) => sum + w.processingTime, 0) / recentProcessingTimes.length : 0

      // Calculate current error rate (last 100 requests)
      const recentErrors = recentProcessingTimes.length > 0 ?
        await prisma.webhookLog.count({
          where: {
            status: { in: ['failed', 'rejected'] },
            createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) }, // Last hour
          },
          orderBy: { createdAt: 'desc' },
          take: recentLimit,
        }) : 0

      const currentErrorRate = recentLimit > 0 ? (recentErrors / Math.min(recentLimit, recentProcessingTimes.length)) * 100 : 0

      // Get unacknowledged alerts
      const unacknowledgedAlerts = await prisma.systemAlert.count({
        where: {
          acknowledged: false,
          resolved: false,
        },
      })

      // Get highest alert severity
      const highestAlert = await prisma.systemAlert.findFirst({
        where: {
          acknowledged: false,
          resolved: false,
        },
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
      })

      // System load approximation (based on active stages and recent activity)
      const systemLoad = Math.min(100, (activeStages.length * 10) + (recentWebhooks.length * 2))

      return {
        timestamp: now,
        webhooksLastMinute: recentWebhooks.length,
        activeStages: activeStages.length,
        queueDepth: activeStages.length,
        recentAvgProcessingTime: avgProcessingTime,
        currentErrorRate,
        systemLoad,
        unacknowledgedAlerts,
        highestAlertSeverity: highestAlert?.severity as any,
      }
    } catch (error) {
      this.logger.error('Failed to fetch real-time metrics', error as Error)

      throw new DatabaseError('Failed to fetch real-time metrics', {
        originalError: (error as Error).message,
      })
    }
  }

  /**
   * Get webhook processing statistics
   * 
   * @param filters - Optional filters for statistics calculation
   * @returns Promise resolving to processing statistics
   */
  async getProcessingStatistics(filters: MonitoringFilters = {}): Promise<{
    totalWebhooks: number
    successfulWebhooks: number
    failedWebhooks: number
    rejectedWebhooks: number
    successRate: number
    avgProcessingTime: number
    medianProcessingTime: number
    p95ProcessingTime: number
    p99ProcessingTime: number
  }> {
    this.logger.debug('Calculating processing statistics', { filters })

    try {
      // Build where clause (reuse logic from getWebhookRequests)
      const where: any = {}

      // Apply filters
      if (filters.dateFrom || filters.dateTo || filters.timeRange) {
        where.createdAt = {}
        
        if (filters.timeRange && filters.timeRange !== 'custom') {
          const now = new Date()
          const secondsAgo = TIME_RANGES[filters.timeRange]
          where.createdAt.gte = new Date(now.getTime() - secondsAgo * 1000)
        } else {
          if (filters.dateFrom) where.createdAt.gte = filters.dateFrom
          if (filters.dateTo) where.createdAt.lte = filters.dateTo
        }
      }

      if (filters.webhookStatus && filters.webhookStatus.length > 0) {
        where.status = { in: filters.webhookStatus }
      }

      // Fetch webhook data
      const webhooks = await prisma.webhookLog.findMany({
        where,
        select: {
          status: true,
          processingTime: true,
        },
      })

      // Calculate statistics
      const totalWebhooks = webhooks.length
      const successfulWebhooks = webhooks.filter(w => w.status === 'success').length
      const failedWebhooks = webhooks.filter(w => w.status === 'failed').length
      const rejectedWebhooks = webhooks.filter(w => w.status === 'rejected').length
      const successRate = totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks) * 100 : 0

      // Processing time statistics
      const processingTimes = webhooks.map(w => w.processingTime).sort((a, b) => a - b)
      const avgProcessingTime = processingTimes.length > 0 ?
        processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length : 0

      const medianIndex = Math.floor(processingTimes.length / 2)
      const medianProcessingTime = processingTimes.length > 0 ?
        (processingTimes.length % 2 === 0 ?
          (processingTimes[medianIndex - 1] + processingTimes[medianIndex]) / 2 :
          processingTimes[medianIndex]) : 0

      const p95Index = Math.floor(processingTimes.length * 0.95)
      const p99Index = Math.floor(processingTimes.length * 0.99)
      const p95ProcessingTime = processingTimes[p95Index] || 0
      const p99ProcessingTime = processingTimes[p99Index] || 0

      return {
        totalWebhooks,
        successfulWebhooks,
        failedWebhooks,
        rejectedWebhooks,
        successRate,
        avgProcessingTime,
        medianProcessingTime,
        p95ProcessingTime,
        p99ProcessingTime,
      }
    } catch (error) {
      this.logger.error('Failed to calculate processing statistics', error as Error, { filters })

      throw new DatabaseError('Failed to calculate processing statistics', {
        filters,
        originalError: (error as Error).message,
      })
    }
  }

  // ========================================
  // Health Monitoring
  // ========================================

  /**
   * Get current system health status
   * 
   * @returns Promise resolving to system health information
   */
  async getSystemHealth(): Promise<SystemHealth> {
    this.logger.debug('Fetching system health status')

    try {
      // Get basic system info
      const now = new Date()
      const uptime = process.uptime()
      const version = process.env.npm_package_version || '1.0.0'

      // Check database health
      const dbHealth = await this.checkDatabaseHealth()

      // Check external APIs health (placeholder - would integrate with actual API clients)
      const externalApis = await this.checkExternalApisHealth()

      // Check memory health
      const memoryHealth = await this.checkMemoryHealth()

      // Check queue health
      const queueHealth = await this.checkQueueHealth()

      // Get current metrics
      const realTimeMetrics = await this.getRealTimeMetrics()

      // Determine overall status
      let status: SystemHealthStatus = 'healthy'
      
      if (!dbHealth.status || dbHealth.status === 'disconnected') {
        status = 'unhealthy'
      } else if (
        memoryHealth.percentage > 90 ||
        queueHealth.utilization > 90 ||
        realTimeMetrics.currentErrorRate > 20
      ) {
        status = 'degraded'
      }

      return {
        status,
        uptime,
        version,
        lastCheck: now,
        database: dbHealth,
        externalApis,
        memory: memoryHealth,
        queue: queueHealth,
        activeConnections: 0, // Would be populated by WebSocket service
        requestsPerSecond: realTimeMetrics.webhooksLastMinute / 60,
        avgResponseTime: realTimeMetrics.recentAvgProcessingTime,
      }
    } catch (error) {
      this.logger.error('Failed to fetch system health', error as Error)

      // Return unhealthy status if we can't determine health
      return {
        status: 'unhealthy',
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        lastCheck: new Date(),
        database: {
          status: 'disconnected',
          latency: 0,
          activeConnections: 0,
          maxConnections: 0,
          poolUtilization: 0,
        },
        externalApis: {},
        memory: {
          used: 0,
          total: 0,
          percentage: 0,
          trend: 'stable',
        },
        queue: {
          depth: 0,
          maxCapacity: 0,
          utilization: 0,
          avgProcessingTime: 0,
          oldestItemAge: 0,
        },
        activeConnections: 0,
        requestsPerSecond: 0,
        avgResponseTime: 0,
      }
    }
  }

  /**
   * Perform health check on all monitored components
   * 
   * @returns Promise resolving to updated system health status
   */
  async performHealthCheck(): Promise<SystemHealth> {
    this.logger.info('Performing comprehensive health check')

    try {
      // Force fresh health check by calling getSystemHealth
      // In a production system, this might trigger additional checks
      const health = await this.getSystemHealth()

      this.logger.info('Health check completed', {
        status: health.status,
        dbStatus: health.database.status,
        memoryUsage: health.memory.percentage,
        queueUtilization: health.queue.utilization,
      })

      return health
    } catch (error) {
      this.logger.error('Health check failed', error as Error)
      throw error
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Validate webhook request input data
   */
  private validateWebhookRequestInput(request: CreateWebhookRequestInput): void {
    if (!request.sourceIp) {
      throw new ValidationError('Source IP is required')
    }

    if (!request.headers || typeof request.headers !== 'object') {
      throw new ValidationError('Headers must be a valid object')
    }

    if (!request.payload || typeof request.payload !== 'object') {
      throw new ValidationError('Payload must be a valid object')
    }

    if (typeof request.payloadSize !== 'number' || request.payloadSize < 0) {
      throw new ValidationError('Payload size must be a non-negative number')
    }

    if (typeof request.processingTime !== 'number' || request.processingTime < 0) {
      throw new ValidationError('Processing time must be a non-negative number')
    }

    if (!['success', 'failed', 'rejected'].includes(request.status)) {
      throw new ValidationError('Status must be one of: success, failed, rejected')
    }
  }

  /**
   * Validate webhook request update data
   */
  private validateWebhookRequestUpdate(updates: Partial<UpdateWebhookRequestInput>): void {
    if (updates.payloadSize !== undefined && (typeof updates.payloadSize !== 'number' || updates.payloadSize < 0)) {
      throw new ValidationError('Payload size must be a non-negative number')
    }

    if (updates.processingTime !== undefined && (typeof updates.processingTime !== 'number' || updates.processingTime < 0)) {
      throw new ValidationError('Processing time must be a non-negative number')
    }

    if (updates.status !== undefined && !['success', 'failed', 'rejected'].includes(updates.status)) {
      throw new ValidationError('Status must be one of: success, failed, rejected')
    }
  }

  /**
   * Validate processing stage input data
   */
  private validateProcessingStageInput(stage: CreateProcessingStageInput): void {
    if (!stage.signalId) {
      throw new ValidationError('Signal ID is required')
    }

    if (!stage.stage) {
      throw new ValidationError('Stage type is required')
    }

    if (!PROCESSING_STAGE_ORDER.includes(stage.stage as any)) {
      throw new ValidationError(`Invalid stage type: ${stage.stage}`)
    }

    if (!stage.startedAt) {
      throw new ValidationError('Started at timestamp is required')
    }

    if (!['in_progress', 'completed', 'failed'].includes(stage.status)) {
      throw new ValidationError('Status must be one of: in_progress, completed, failed')
    }
  }

  /**
   * Map database webhook log to WebhookRequest interface
   */
  private mapWebhookLogToRequest(log: any): WebhookRequest {
    return {
      id: log.id,
      createdAt: log.createdAt,
      sourceIp: log.sourceIp,
      userAgent: log.userAgent,
      headers: log.headers,
      payload: log.payload,
      payloadSize: log.payloadSize,
      signature: log.signature,
      processingTime: log.processingTime,
      status: log.status as WebhookStatus,
      errorMessage: log.errorMessage,
      errorStack: log.errorStack,
      signalId: log.signalId,
    }
  }

  /**
   * Map database processing stage to ProcessingStage interface
   */
  private mapProcessingStageFromDb(stage: any): ProcessingStage {
    return {
      id: stage.id,
      createdAt: stage.createdAt,
      signalId: stage.signalId,
      stage: stage.stage as ProcessingStageType,
      startedAt: stage.startedAt,
      completedAt: stage.completedAt,
      duration: stage.duration,
      status: stage.status as ProcessingStageStatus,
      errorMessage: stage.errorMessage,
      metadata: stage.metadata,
    }
  }

  /**
   * Calculate peak webhooks per minute in time period
   */
  private async calculatePeakWebhooksPerMinute(start: Date, end: Date): Promise<number> {
    // This would require more sophisticated time-series analysis
    // For now, return a simple approximation
    const totalMinutes = Math.ceil((end.getTime() - start.getTime()) / (60 * 1000))
    const totalWebhooks = await prisma.webhookLog.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    })

    return totalMinutes > 0 ? Math.ceil(totalWebhooks / totalMinutes) : 0
  }

  /**
   * Calculate maximum queue depth in time period
   */
  private async calculateMaxQueueDepth(start: Date, end: Date): Promise<number> {
    // This would require historical queue depth tracking
    // For now, return current active stages as approximation
    const activeStages = await this.getActiveProcessingStages()
    return activeStages.length
  }

  /**
   * Calculate top error types in time period
   */
  private async calculateTopErrors(start: Date, end: Date): Promise<any[]> {
    const errors = await prisma.webhookLog.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['failed', 'rejected'] },
        errorMessage: { not: null },
      },
      select: {
        errorMessage: true,
        createdAt: true,
      },
    })

    // Group by error message and count occurrences
    const errorCounts = new Map<string, { count: number; firstSeen: Date; lastSeen: Date }>()
    
    errors.forEach(error => {
      const message = error.errorMessage || 'Unknown error'
      const existing = errorCounts.get(message)
      
      if (existing) {
        existing.count++
        existing.lastSeen = error.createdAt
      } else {
        errorCounts.set(message, {
          count: 1,
          firstSeen: error.createdAt,
          lastSeen: error.createdAt,
        })
      }
    })

    // Convert to array and sort by count
    return Array.from(errorCounts.entries())
      .map(([message, data]) => ({
        type: 'webhook_error',
        message,
        count: data.count,
        percentage: errors.length > 0 ? (data.count / errors.length) * 100 : 0,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 errors
  }

  /**
   * Calculate error rate trend
   */
  private async calculateErrorTrend(start: Date, end: Date): Promise<'up' | 'down' | 'stable'> {
    // This would require more sophisticated trend analysis
    // For now, return stable as placeholder
    return 'stable'
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<any> {
    try {
      const startTime = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const latency = Date.now() - startTime

      return {
        status: 'connected',
        latency,
        activeConnections: 1, // Simplified
        maxConnections: 10, // Simplified
        poolUtilization: 10, // Simplified
      }
    } catch (error) {
      return {
        status: 'disconnected',
        latency: 0,
        activeConnections: 0,
        maxConnections: 0,
        poolUtilization: 0,
      }
    }
  }

  /**
   * Check external APIs health
   */
  private async checkExternalApisHealth(): Promise<Record<string, any>> {
    // Placeholder for external API health checks
    return {
      tradier: {
        status: 'online',
        latency: 100,
        lastSuccess: new Date(),
        errorRate: 0,
      },
      twelvedata: {
        status: 'online',
        latency: 150,
        lastSuccess: new Date(),
        errorRate: 0,
      },
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<any> {
    const memUsage = process.memoryUsage()
    const totalMemory = memUsage.heapTotal + memUsage.external
    const usedMemory = memUsage.heapUsed
    const percentage = (usedMemory / totalMemory) * 100

    return {
      used: usedMemory,
      total: totalMemory,
      percentage,
      trend: 'stable' as const,
    }
  }

  /**
   * Check queue health
   */
  private async checkQueueHealth(): Promise<any> {
    const activeStages = await this.getActiveProcessingStages()
    const maxCapacity = 1000 // Configurable
    const utilization = (activeStages.length / maxCapacity) * 100

    // Calculate average processing time from recent stages
    const recentStages = await prisma.processingStage.findMany({
      where: {
        status: 'completed',
        duration: { not: null },
      },
      select: { duration: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const avgProcessingTime = recentStages.length > 0 ?
      recentStages.reduce((sum, s) => sum + (s.duration || 0), 0) / recentStages.length : 0

    // Find oldest active stage
    const oldestStage = activeStages.length > 0 ?
      Math.max(...activeStages.map(s => Date.now() - s.startedAt.getTime())) / 1000 : 0

    return {
      depth: activeStages.length,
      maxCapacity,
      utilization,
      avgProcessingTime,
      oldestItemAge: oldestStage,
    }
  }
}