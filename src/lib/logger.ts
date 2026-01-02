/**
 * Logging System
 * Structured logging for debugging and audit purposes
 * 
 * Requirements: 11.5
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  data?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Current log level from environment
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
  ]

  if (entry.context) {
    parts.push(`[${entry.context}]`)
  }

  parts.push(entry.message)

  if (entry.data && Object.keys(entry.data).length > 0) {
    parts.push(JSON.stringify(entry.data))
  }

  if (entry.error) {
    parts.push(`Error: ${entry.error.name}: ${entry.error.message}`)
    if (entry.error.stack && process.env.NODE_ENV === 'development') {
      parts.push(`\n${entry.error.stack}`)
    }
  }

  return parts.join(' ')
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: Record<string, unknown>,
  error?: Error
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    data,
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined,
  }
}

/**
 * Output log entry
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry)
  
  switch (entry.level) {
    case 'debug':
      console.debug(formatted)
      break
    case 'info':
      console.info(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'error':
      console.error(formatted)
      break
  }
}

/**
 * Logger class for contextual logging
 */
export class Logger {
  private context: string

  constructor(context: string) {
    this.context = context
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (shouldLog('debug')) {
      outputLog(createLogEntry('debug', message, this.context, data))
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (shouldLog('info')) {
      outputLog(createLogEntry('info', message, this.context, data))
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (shouldLog('warn')) {
      outputLog(createLogEntry('warn', message, this.context, data))
    }
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (shouldLog('error')) {
      outputLog(createLogEntry('error', message, this.context, data, error))
    }
  }

  /**
   * Log with timing information
   */
  timed<T>(operation: string, fn: () => T): T {
    const start = Date.now()
    try {
      const result = fn()
      const duration = Date.now() - start
      this.debug(`${operation} completed`, { durationMs: duration })
      return result
    } catch (error) {
      const duration = Date.now() - start
      this.error(`${operation} failed`, error as Error, { durationMs: duration })
      throw error
    }
  }

  /**
   * Log async operation with timing
   */
  async timedAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now()
    try {
      const result = await fn()
      const duration = Date.now() - start
      this.debug(`${operation} completed`, { durationMs: duration })
      return result
    } catch (error) {
      const duration = Date.now() - start
      this.error(`${operation} failed`, error as Error, { durationMs: duration })
      throw error
    }
  }
}

/**
 * Create a logger for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context)
}

// Pre-configured loggers for common contexts
export const webhookLogger = createLogger('Webhook')
export const enrichmentLogger = createLogger('Enrichment')
export const decisionLogger = createLogger('Decision')
export const tradingLogger = createLogger('Trading')
export const monitorLogger = createLogger('Monitor')
export const learningLogger = createLogger('Learning')
export const apiLogger = createLogger('API')
