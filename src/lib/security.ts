/**
 * Security Utilities
 * HMAC validation, encryption, and security helpers
 * 
 * Requirements: 10.2, 10.3, 10.5
 */

import crypto from 'crypto'

/**
 * Validate HMAC signature for webhook requests
 */
export function validateHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  if (!payload || !signature || !secret) {
    return false
  }

  try {
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Generate HMAC signature
 */
export function generateHmacSignature(
  payload: string,
  secret: string,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
  return crypto
    .createHmac(algorithm, secret)
    .update(payload)
    .digest('hex')
}

/**
 * Encrypt sensitive data (API keys, etc.)
 */
export function encryptData(
  data: string,
  encryptionKey: string
): string {
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(encryptionKey, 'salt', 32)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Return IV + AuthTag + Encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

/**
 * Decrypt sensitive data
 */
export function decryptData(
  encryptedData: string,
  encryptionKey: string
): string {
  const parts = encryptedData.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivHex, authTagHex, encrypted] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key = crypto.scryptSync(encryptionKey, 'salt', 32)
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Hash a password or sensitive string
 */
export function hashString(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Sanitize user input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .trim()
}

/**
 * Validate that a string is a valid ticker symbol
 */
export function isValidTicker(ticker: string): boolean {
  // Ticker symbols are 1-5 uppercase letters
  return /^[A-Z]{1,5}$/.test(ticker)
}

/**
 * Validate that a string is a valid API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // API keys should be alphanumeric and at least 16 characters
  return /^[a-zA-Z0-9]{16,}$/.test(key)
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length)
  }
  
  const start = data.slice(0, visibleChars)
  const end = data.slice(-visibleChars)
  const masked = '*'.repeat(data.length - visibleChars * 2)
  
  return `${start}${masked}${end}`
}

/**
 * Check if request is from a trusted source
 */
export function isTrustedSource(
  ip: string,
  trustedIps: string[] = []
): boolean {
  // Always trust localhost in development
  if (process.env.NODE_ENV === 'development') {
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return true
    }
  }

  return trustedIps.includes(ip)
}

/**
 * Extract IP address from request headers
 */
export function getClientIp(headers: Headers): string {
  // Check common proxy headers
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

/**
 * Validate request origin
 */
export function isValidOrigin(
  origin: string | null,
  allowedOrigins: string[]
): boolean {
  if (!origin) {
    return false
  }

  return allowedOrigins.some(allowed => {
    if (allowed === '*') return true
    if (allowed === origin) return true
    // Support wildcard subdomains
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2)
      return origin.endsWith(domain)
    }
    return false
  })
}
