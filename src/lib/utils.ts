import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Trading utility functions
export function generateTradeId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `trade_${timestamp}_${random}`
}

export function calculateRMultiple(pnl: number, riskAmount: number): number {
  if (riskAmount === 0) return 0
  return pnl / Math.abs(riskAmount)
}

export function calculateHoldingPeriod(entryTime: Date, exitTime: Date): number {
  return Math.floor((exitTime.getTime() - entryTime.getTime()) / (1000 * 60)) // Minutes
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  
  return sorted[middle]
}

export function calculatePriceDeviation(prices: number[]): number {
  if (prices.length < 2) return 0
  
  const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length
  const maxDeviation = Math.max(...prices.map(price => Math.abs(price - avg) / avg))
  
  return maxDeviation * 100 // Return as percentage
}

export function isWithinTradingHours(tradingHours: { start: string; end: string }): boolean {
  const now = new Date()
  const currentTime = now.toTimeString().substring(0, 5) // HH:MM format
  
  return currentTime >= tradingHours.start && currentTime <= tradingHours.end
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn()
        resolve(result)
        return
      } catch (error) {
        if (attempt === maxRetries) {
          reject(error)
          return
        }
        
        const delay = baseDelay * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
  })
}

// Validation helpers
export function isValidTicker(ticker: string): boolean {
  return /^[A-Z]{1,5}$/.test(ticker)
}

export function isValidQuality(quality: number): boolean {
  return Number.isInteger(quality) && quality >= 1 && quality <= 5
}

export function isValidTimeframe(timeframe: number): boolean {
  const validTimeframes = [1, 5, 15, 30, 60, 240, 1440]
  return validTimeframes.includes(timeframe)
}

// Logging utility
export function createLogger(component: string) {
  return {
    info: (message: string, data?: any) => {
      console.log(`[${component}] ${message}`, data || '')
    },
    warn: (message: string, data?: any) => {
      console.warn(`[${component}] ${message}`, data || '')
    },
    error: (message: string, error?: any) => {
      console.error(`[${component}] ${message}`, error || '')
    }
  }
}