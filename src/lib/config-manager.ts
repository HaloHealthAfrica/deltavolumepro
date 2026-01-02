/**
 * Configuration Manager
 * Handles trading rules configuration with validation and audit trails
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { prisma } from './prisma'
import { z } from 'zod'

// Validation schemas for configuration updates
export const TradingRulesUpdateSchema = z.object({
  // Factor weights (must sum to 1.0)
  qualityWeight: z.number().min(0).max(1).optional(),
  volumeWeight: z.number().min(0).max(1).optional(),
  oscillatorWeight: z.number().min(0).max(1).optional(),
  structureWeight: z.number().min(0).max(1).optional(),
  marketWeight: z.number().min(0).max(1).optional(),
  
  // Thresholds
  minQuality: z.number().int().min(1).max(5).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  minVolumePressure: z.number().min(0).max(100).optional(),
  maxRiskPercent: z.number().min(0.1).max(10).optional(),
  compressionMultiplier: z.number().min(0.1).max(1).optional(),
})

export const TickerFilterSchema = z.object({
  allowedTickers: z.array(z.string().toUpperCase()).optional(),
  blockedTickers: z.array(z.string().toUpperCase()).optional(),
})

export const TimeframeFilterSchema = z.object({
  allowedTimeframes: z.array(z.number().int().positive()).optional(),
  blockedTimeframes: z.array(z.number().int().positive()).optional(),
})

export type TradingRulesUpdate = z.infer<typeof TradingRulesUpdateSchema>
export type TickerFilter = z.infer<typeof TickerFilterSchema>
export type TimeframeFilter = z.infer<typeof TimeframeFilterSchema>

// Configuration change audit entry
export interface ConfigAuditEntry {
  id: string
  timestamp: Date
  userId: string
  changeType: 'RULES_UPDATE' | 'TICKER_FILTER' | 'TIMEFRAME_FILTER' | 'API_KEY_UPDATE'
  previousValue: Record<string, unknown>
  newValue: Record<string, unknown>
  description: string
}

/**
 * Get current active trading rules
 */
export async function getActiveTradingRules() {
  const rules = await prisma.tradingRules.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  
  return rules
}

/**
 * Get all trading rules versions
 */
export async function getTradingRulesHistory() {
  const rules = await prisma.tradingRules.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  
  return rules
}

/**
 * Update trading rules with validation
 */
export async function updateTradingRules(
  rulesId: string,
  updates: TradingRulesUpdate,
  userId: string
): Promise<{ success: boolean; error?: string; rules?: unknown }> {
  // Validate input
  const validation = TradingRulesUpdateSchema.safeParse(updates)
  if (!validation.success) {
    return { success: false, error: validation.error.message }
  }

  // Validate weights sum to 1.0 if any weights are being updated
  const weightKeys = ['qualityWeight', 'volumeWeight', 'oscillatorWeight', 'structureWeight', 'marketWeight']
  const hasWeightUpdate = weightKeys.some(key => key in updates)
  
  if (hasWeightUpdate) {
    const currentRules = await prisma.tradingRules.findUnique({ where: { id: rulesId } })
    if (!currentRules) {
      return { success: false, error: 'Rules not found' }
    }

    const newWeights = {
      qualityWeight: updates.qualityWeight ?? currentRules.qualityWeight,
      volumeWeight: updates.volumeWeight ?? currentRules.volumeWeight,
      oscillatorWeight: updates.oscillatorWeight ?? currentRules.oscillatorWeight,
      structureWeight: updates.structureWeight ?? currentRules.structureWeight,
      marketWeight: updates.marketWeight ?? currentRules.marketWeight,
    }

    const weightSum = Object.values(newWeights).reduce((sum, w) => sum + w, 0)
    if (Math.abs(weightSum - 1.0) > 0.01) {
      return { success: false, error: `Weights must sum to 1.0 (current sum: ${weightSum.toFixed(2)})` }
    }
  }

  // Get current rules for audit
  const currentRules = await prisma.tradingRules.findUnique({ where: { id: rulesId } })
  if (!currentRules) {
    return { success: false, error: 'Rules not found' }
  }

  // Update rules
  const updatedRules = await prisma.tradingRules.update({
    where: { id: rulesId },
    data: updates,
  })

  // Create audit entry
  await createAuditEntry({
    userId,
    changeType: 'RULES_UPDATE',
    previousValue: currentRules as unknown as Record<string, unknown>,
    newValue: updatedRules as unknown as Record<string, unknown>,
    description: `Updated trading rules: ${Object.keys(updates).join(', ')}`,
  })

  return { success: true, rules: updatedRules }
}

/**
 * Create a new version of trading rules
 */
export async function createNewRulesVersion(
  baseRulesId: string,
  updates: TradingRulesUpdate,
  userId: string
): Promise<{ success: boolean; error?: string; rules?: unknown }> {
  const baseRules = await prisma.tradingRules.findUnique({ where: { id: baseRulesId } })
  if (!baseRules) {
    return { success: false, error: 'Base rules not found' }
  }

  // Generate new version number
  const versionMatch = baseRules.version.match(/v(\d+)\.(\d+)\.(\d+)/)
  let newVersion = 'v1.0.1'
  if (versionMatch) {
    const [, major, minor, patch] = versionMatch
    newVersion = `v${major}.${minor}.${parseInt(patch) + 1}`
  }

  // Create new rules version (inactive by default)
  const newRules = await prisma.tradingRules.create({
    data: {
      version: newVersion,
      isActive: false,
      qualityWeight: updates.qualityWeight ?? baseRules.qualityWeight,
      volumeWeight: updates.volumeWeight ?? baseRules.volumeWeight,
      oscillatorWeight: updates.oscillatorWeight ?? baseRules.oscillatorWeight,
      structureWeight: updates.structureWeight ?? baseRules.structureWeight,
      marketWeight: updates.marketWeight ?? baseRules.marketWeight,
      minQuality: updates.minQuality ?? baseRules.minQuality,
      minConfidence: updates.minConfidence ?? baseRules.minConfidence,
      minVolumePressure: updates.minVolumePressure ?? baseRules.minVolumePressure,
      maxRiskPercent: updates.maxRiskPercent ?? baseRules.maxRiskPercent,
      compressionMultiplier: updates.compressionMultiplier ?? baseRules.compressionMultiplier,
      baseSizePerQuality: baseRules.baseSizePerQuality as object,
      allowedTimeframes: baseRules.allowedTimeframes as object,
      allowedTickers: baseRules.allowedTickers as object | undefined,
      tradingHours: baseRules.tradingHours as object,
      learningData: baseRules.learningData as object,
    },
  })

  // Create audit entry
  await createAuditEntry({
    userId,
    changeType: 'RULES_UPDATE',
    previousValue: { baseVersion: baseRules.version },
    newValue: { newVersion: newRules.version },
    description: `Created new rules version ${newVersion} based on ${baseRules.version}`,
  })

  return { success: true, rules: newRules }
}

/**
 * Activate a specific rules version
 */
export async function activateRulesVersion(
  rulesId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Deactivate all other rules
  await prisma.tradingRules.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  })

  // Activate the specified rules
  const rules = await prisma.tradingRules.update({
    where: { id: rulesId },
    data: { isActive: true },
  })

  // Create audit entry
  await createAuditEntry({
    userId,
    changeType: 'RULES_UPDATE',
    previousValue: {},
    newValue: { activatedVersion: rules.version },
    description: `Activated rules version ${rules.version}`,
  })

  return { success: true }
}

/**
 * Create audit entry for configuration changes
 */
async function createAuditEntry(entry: Omit<ConfigAuditEntry, 'id' | 'timestamp'>) {
  // Store in database - using a simple approach with JSON in a dedicated table
  // For now, we'll log it. In production, this would go to a ConfigAudit table
  console.log('[Config Audit]', {
    timestamp: new Date().toISOString(),
    ...entry,
  })
  
  // TODO: Create ConfigAudit model in Prisma schema for persistent audit trail
}

/**
 * Validate API key format (basic validation)
 */
export function validateApiKeyFormat(provider: string, key: string): boolean {
  if (!key || key.length < 10) return false
  
  switch (provider) {
    case 'tradier':
      // Tradier keys are typically alphanumeric
      return /^[a-zA-Z0-9]+$/.test(key)
    case 'twelvedata':
      // TwelveData keys are alphanumeric
      return /^[a-zA-Z0-9]+$/.test(key)
    case 'alpaca':
      // Alpaca keys start with PK or AK
      return /^[A-Z]{2}[a-zA-Z0-9]+$/.test(key)
    default:
      return key.length >= 10
  }
}

/**
 * Get configuration summary for display
 */
export async function getConfigurationSummary() {
  const rules = await getActiveTradingRules()
  
  return {
    rules: rules ? {
      version: rules.version,
      isActive: rules.isActive,
      weights: {
        quality: rules.qualityWeight,
        volume: rules.volumeWeight,
        oscillator: rules.oscillatorWeight,
        structure: rules.structureWeight,
        market: rules.marketWeight,
      },
      thresholds: {
        minQuality: rules.minQuality,
        minConfidence: rules.minConfidence,
        minVolumePressure: rules.minVolumePressure,
        maxRiskPercent: rules.maxRiskPercent,
        compressionMultiplier: rules.compressionMultiplier,
      },
      performance: {
        tradesExecuted: rules.tradesExecuted,
        winRate: rules.winRate,
        avgReturn: rules.avgReturn,
        sharpeRatio: rules.sharpeRatio,
      },
    } : null,
    apiStatus: {
      tradier: !!process.env.TRADIER_API_KEY,
      twelvedata: !!process.env.TWELVEDATA_API_KEY,
      alpaca: !!process.env.ALPACA_API_KEY,
      webhook: !!process.env.TRADINGVIEW_WEBHOOK_SECRET,
    },
  }
}
