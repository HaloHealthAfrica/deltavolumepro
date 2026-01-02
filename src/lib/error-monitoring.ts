/**
 * Error Monitoring and Alerting
 * 
 * Provides centralized error tracking, logging, and alerting capabilities.
 * Requirements: 12.4, 11.3
 */

import { createLogger } from './logger'

const logger = createLogger('ErrorMonitoring')

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorContext {
  userId?: string
  signalId?: string
  tradeId?: string
  endpoint?: string
  action?: string
  metadata?: Record<string, unknown>
}

export interface TrackedError {
  id: string
  timestamp: Date
  severity: ErrorSeverity
  message: string
  stack?: string
  context: ErrorContext
  resolved: boolean
}

// In-memory error store (would use Redis or database in production)
const errorStore: TrackedError[] = []
const MAX_ERRORS = 1000

/**
 * Generates a unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Determines error severity based on error type and context
 */
function determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
  const message = error.message.toLowerCase()
  
  // Critical errors
  if (
    message.includes('database') ||
    message.includes('prisma') ||
    message.includes('authentication') ||
    message.includes('unauthorized')
  ) {
    return 'critical'
  }
  
  // High severity
  if (
    message.includes('trade') ||
    message.includes('order') ||
    message.includes('execution') ||
    context.tradeId
  ) {
    return 'high'
  }
  
  // Medium severity
  if (
    message.includes('webhook') ||
    message.includes('signal') ||
    message.includes('api')
  ) {
    return 'medium'
  }
  
  return 'low'
}

/**
 * Tracks an error with context
 */
export function trackError(
  error: Error,
  context: ErrorContext = {},
  severity?: ErrorSeverity
): string {
  const errorId = generateErrorId()
  const actualSeverity = severity || determineSeverity(error, context)
  
  const trackedError: TrackedError = {
    id: errorId,
    timestamp: new Date(),
    severity: actualSeverity,
    message: error.message,
    stack: error.stack,
    context,
    resolved: false
  }
  
  // Add to store (with size limit)
  errorStore.unshift(trackedError)
  if (errorStore.length > MAX_ERRORS) {
    errorStore.pop()
  }
  
  // Log based on severity
  const logContext = {
    errorId,
    severity: actualSeverity,
    ...context
  }
  
  switch (actualSeverity) {
    case 'critical':
      logger.error(`[CRITICAL] ${error.message}`, error, logContext)
      // In production, would trigger immediate alert (PagerDuty, Slack, etc.)
      triggerAlert(trackedError)
      break
    case 'high':
      logger.error(`[HIGH] ${error.message}`, error, logContext)
      break
    case 'medium':
      logger.warn(`[MEDIUM] ${error.message}`, logContext)
      break
    case 'low':
      logger.info(`[LOW] ${error.message}`, logContext)
      break
  }
  
  return errorId
}

/**
 * Triggers an alert for critical errors
 */
async function triggerAlert(error: TrackedError): Promise<void> {
  // In production, this would integrate with:
  // - PagerDuty
  // - Slack
  // - Email
  // - SMS
  
  console.error(`
🚨 CRITICAL ERROR ALERT 🚨
ID: ${error.id}
Time: ${error.timestamp.toISOString()}
Message: ${error.message}
Context: ${JSON.stringify(error.context, null, 2)}
  `)
  
  // Example Slack webhook (would be implemented in production)
  // await fetch(process.env.SLACK_WEBHOOK_URL, {
  //   method: 'POST',
  //   body: JSON.stringify({
  //     text: `🚨 Critical Error: ${error.message}`,
  //     attachments: [{
  //       color: 'danger',
  //       fields: [
  //         { title: 'Error ID', value: error.id, short: true },
  //         { title: 'Time', value: error.timestamp.toISOString(), short: true },
  //         { title: 'Context', value: JSON.stringify(error.context) }
  //       ]
  //     }]
  //   })
  // })
}

/**
 * Gets recent errors with optional filtering
 */
export function getRecentErrors(options: {
  severity?: ErrorSeverity
  limit?: number
  resolved?: boolean
} = {}): TrackedError[] {
  let errors = [...errorStore]
  
  if (options.severity) {
    errors = errors.filter(e => e.severity === options.severity)
  }
  
  if (options.resolved !== undefined) {
    errors = errors.filter(e => e.resolved === options.resolved)
  }
  
  if (options.limit) {
    errors = errors.slice(0, options.limit)
  }
  
  return errors
}

/**
 * Marks an error as resolved
 */
export function resolveError(errorId: string): boolean {
  const error = errorStore.find(e => e.id === errorId)
  if (error) {
    error.resolved = true
    logger.info(`Error ${errorId} marked as resolved`)
    return true
  }
  return false
}

/**
 * Gets error statistics
 */
export function getErrorStats(): {
  total: number
  bySeverity: Record<ErrorSeverity, number>
  unresolved: number
  last24Hours: number
} {
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000
  
  const stats = {
    total: errorStore.length,
    bySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    } as Record<ErrorSeverity, number>,
    unresolved: 0,
    last24Hours: 0
  }
  
  for (const error of errorStore) {
    stats.bySeverity[error.severity]++
    if (!error.resolved) stats.unresolved++
    if (error.timestamp.getTime() > oneDayAgo) stats.last24Hours++
  }
  
  return stats
}

/**
 * Clears resolved errors older than specified days
 */
export function cleanupOldErrors(daysOld: number = 7): number {
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000
  const initialLength = errorStore.length
  
  const remaining = errorStore.filter(
    e => !e.resolved || e.timestamp.getTime() > cutoff
  )
  
  errorStore.length = 0
  errorStore.push(...remaining)
  
  const removed = initialLength - errorStore.length
  logger.info(`Cleaned up ${removed} old errors`)
  return removed
}

/**
 * Error boundary wrapper for async functions
 */
export function withErrorTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      trackError(error as Error, context)
      throw error
    }
  }) as T
}
