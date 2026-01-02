/**
 * useWebhookFeed Hook
 * 
 * Re-exports the useWebhookFeed hook from useMonitoringEvents for convenience.
 * This file exists for backwards compatibility and cleaner imports.
 * 
 * @module hooks/useWebhookFeed
 * @see {@link ./useMonitoringEvents} for the main implementation
 */

'use client'

export { useWebhookFeed } from './useMonitoringEvents'
export type { UseWebhookFeedReturn, WebhookEventPayload } from './useMonitoringEvents'
