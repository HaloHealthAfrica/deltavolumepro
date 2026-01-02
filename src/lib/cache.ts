/**
 * Caching System
 * In-memory cache with TTL for market data and API responses
 * 
 * Requirements: 12.5
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  createdAt: number
}

// In-memory cache store
// In production, use Redis for distributed caching
const cacheStore = new Map<string, CacheEntry<unknown>>()

// Default TTL values in milliseconds
export const CACHE_TTL = {
  QUOTE: 5 * 1000,           // 5 seconds for real-time quotes
  OPTIONS_CHAIN: 30 * 1000,  // 30 seconds for options chains
  TECHNICAL: 60 * 1000,      // 1 minute for technical indicators
  MARKET_CONTEXT: 5 * 60 * 1000, // 5 minutes for market context
  TRADING_RULES: 10 * 60 * 1000, // 10 minutes for trading rules
} as const

export interface CacheOptions {
  ttl?: number
  staleWhileRevalidate?: boolean
}

/**
 * Get item from cache
 */
export function cacheGet<T>(key: string): T | null {
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined
  
  if (!entry) {
    return null
  }

  const now = Date.now()
  
  // Check if expired
  if (now >= entry.expiresAt) {
    cacheStore.delete(key)
    return null
  }

  return entry.data
}

/**
 * Set item in cache
 */
export function cacheSet<T>(
  key: string,
  data: T,
  ttl: number = CACHE_TTL.QUOTE
): void {
  const now = Date.now()
  
  cacheStore.set(key, {
    data,
    expiresAt: now + ttl,
    createdAt: now,
  })
}

/**
 * Delete item from cache
 */
export function cacheDelete(key: string): boolean {
  return cacheStore.delete(key)
}

/**
 * Clear all cache entries
 */
export function cacheClear(): void {
  cacheStore.clear()
}

/**
 * Get cache stats
 */
export function cacheStats(): {
  size: number
  keys: string[]
} {
  return {
    size: cacheStore.size,
    keys: Array.from(cacheStore.keys()),
  }
}

/**
 * Get or set cache with callback
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.QUOTE
): Promise<T> {
  // Try to get from cache first
  const cached = cacheGet<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetchFn()
  
  // Store in cache
  cacheSet(key, data, ttl)
  
  return data
}

/**
 * Generate cache key for market data
 */
export function marketDataCacheKey(
  source: string,
  ticker: string,
  dataType: string
): string {
  return `market:${source}:${ticker}:${dataType}`
}

/**
 * Generate cache key for API responses
 */
export function apiCacheKey(
  endpoint: string,
  params: Record<string, string | number>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')
  return `api:${endpoint}:${sortedParams}`
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredCache(): number {
  const now = Date.now()
  let cleaned = 0
  
  for (const [key, entry] of cacheStore.entries()) {
    if (now >= entry.expiresAt) {
      cacheStore.delete(key)
      cleaned++
    }
  }
  
  return cleaned
}

// Cleanup expired entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredCache, 60 * 1000)
}
