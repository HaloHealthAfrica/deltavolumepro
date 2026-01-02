# DeltaStackPro Type System Documentation

## Overview

This document describes the comprehensive TypeScript type system implemented for DeltaStackPro, a trading automation platform. The type system ensures type safety across the entire application, from database models to API responses and validation schemas.

## File Structure

```
src/
├── types/
│   ├── index.ts          # Main exports and legacy compatibility
│   ├── trading.ts        # Core trading types and database models
│   └── api.ts           # API response types for tRPC endpoints
├── lib/
│   ├── validations.ts   # Zod validation schemas
│   └── type-utils.ts    # Type utility functions and helpers
```

## Core Type Categories

### 1. Database Model Types

Located in `src/types/trading.ts`, these interfaces directly match the Prisma schema:

- **Signal**: Raw trading signals from TradingView webhooks
- **EnrichedData**: Market data from external APIs (Tradier, TwelveData, Alpaca)
- **Decision**: AI-driven trading decisions based on signals
- **Trade**: Executed trades with entry/exit details
- **TradeAnalysis**: Post-trade performance analysis
- **TradingRules**: Configurable trading parameters and weights
- **MarketContext**: Broad market conditions and regime data

### 2. TradingView Webhook Types

The `TradingViewWebhook` interface defines the structure of incoming signals:

```typescript
interface TradingViewWebhook {
  action: 'LONG' | 'LONG_PREMIUM' | 'SHORT' | 'SHORT_PREMIUM';
  ticker: string;
  timestamp: number;
  timeframe_minutes: number;
  price: { entry: number };
  volume: {
    z_score: number;
    buy_percent: number;
    sell_percent: number;
    buyers_winning: boolean;
  };
  // ... additional fields
}
```

### 3. External API Integration Types

Types for integrating with external market data providers:

- **TradierQuoteData**: Quote and options data from Tradier
- **TwelveDataQuote**: Market data from TwelveData API
- **AlpacaQuote**: Real-time quotes from Alpaca Markets
- **AggregatedMarketData**: Combined insights from all sources

### 4. Decision Engine Types

Types supporting the AI decision-making process:

- **DecisionFactors**: Input factors for trade decisions
- **DecisionReasoning**: Detailed reasoning and confidence scores
- **FilterResults**: Results of various trading filters
- **RiskAssessment**: Portfolio risk analysis

### 5. Performance Analytics Types

Types for tracking and analyzing trading performance:

- **PerformanceMetrics**: Comprehensive trading statistics
- **TradeStatistics**: Performance broken down by various dimensions
- **BacktestResults**: Historical simulation results
- **EquityCurvePoint**: Points on the equity curve

## Validation System

### Zod Schemas

Located in `src/lib/validations.ts`, these schemas provide runtime validation:

```typescript
// Example: TradingView webhook validation
export const TradingViewWebhookSchema = z.object({
  action: z.enum(['LONG', 'LONG_PREMIUM', 'SHORT', 'SHORT_PREMIUM']),
  ticker: z.string().min(1).max(10).regex(/^[A-Z]+$/),
  timestamp: z.number().int().positive(),
  // ... additional validations
});
```

### Validation Functions

Utility functions for common validation tasks:

```typescript
export function validateTradingViewWebhook(data: unknown) {
  return TradingViewWebhookSchema.safeParse(data);
}
```

## API Response Types

Located in `src/types/api.ts`, these types define the structure of tRPC endpoint responses:

### Standard Response Wrapper

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
  requestId?: string;
}
```

### Endpoint-Specific Types

Each tRPC endpoint has corresponding request/response types:

- **CreateSignalRequest/Response**
- **ListSignalsRequest/Response**
- **MakeDecisionRequest/Response**
- **RunBacktestRequest/Response**

## Utility Types

### CRUD Operation Types

```typescript
// Create types (omit auto-generated fields)
export type CreateSignalInput = Omit<Signal, 'id' | 'createdAt' | 'enrichedData' | 'decision' | 'trades'>;

// Update types (make all fields optional except id)
export type UpdateSignalInput = Partial<Omit<Signal, 'id' | 'createdAt'>> & { id: string };
```

### Pagination and Filtering

```typescript
interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface SignalFilters {
  status?: SignalStatus[];
  ticker?: string[];
  quality?: number[];
  dateFrom?: Date;
  dateTo?: Date;
}
```

## Type Utilities

Located in `src/lib/type-utils.ts`, these functions provide:

### Type Guards

```typescript
export function isSignalStatus(value: string): value is SignalStatus {
  return ['received', 'processing', 'enriched', 'traded', 'rejected'].includes(value);
}
```

### Conversion Utilities

```typescript
export function webhookToSignalInput(webhook: TradingViewWebhook): CreateSignalInput {
  // Converts webhook payload to database input format
}
```

### Calculation Functions

```typescript
export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: 'LONG' | 'SHORT'
): number {
  // Calculates profit/loss for a trade
}
```

## Best Practices

### 1. Type Safety

- Always use TypeScript interfaces instead of `any`
- Leverage union types for enums (`SignalStatus`, `DecisionType`, etc.)
- Use generic types for reusable patterns (`ApiResponse<T>`, `PaginatedResponse<T>`)

### 2. Validation

- Validate all external inputs using Zod schemas
- Use type guards for runtime type checking
- Provide meaningful error messages in validation schemas

### 3. API Design

- Use consistent request/response patterns
- Include proper error handling types
- Leverage discriminated unions for different response types

### 4. Database Integration

- Keep database model types in sync with Prisma schema
- Use utility types for CRUD operations
- Include relation types for complex queries

## Usage Examples

### 1. Processing a TradingView Webhook

```typescript
import { validateTradingViewWebhook, webhookToSignalInput } from '@/lib/validations';
import { CreateSignalInput } from '@/types';

export async function processWebhook(payload: unknown) {
  // Validate the webhook
  const validation = validateTradingViewWebhook(payload);
  if (!validation.success) {
    throw new Error('Invalid webhook payload');
  }

  // Convert to database input
  const signalInput: CreateSignalInput = webhookToSignalInput(validation.data);
  
  // Save to database
  const signal = await prisma.signal.create({ data: signalInput });
  return signal;
}
```

### 2. Creating a tRPC Endpoint

```typescript
import { z } from 'zod';
import { CreateSignalSchema } from '@/lib/validations';
import { createApiSuccessResponse } from '@/lib/type-utils';

export const signalRouter = router({
  create: publicProcedure
    .input(CreateSignalSchema)
    .mutation(async ({ input }) => {
      const signal = await prisma.signal.create({ data: input });
      return createApiSuccessResponse(signal);
    }),
});
```

### 3. Type-Safe API Calls

```typescript
import { trpc } from '@/lib/trpc';
import type { CreateSignalRequest } from '@/types/api';

export async function createSignal(data: CreateSignalRequest) {
  const response = await trpc.signals.create.mutate(data);
  
  if (response.success) {
    console.log('Signal created:', response.data);
  } else {
    console.error('Error:', response.error);
  }
}
```

## Migration Guide

### From Legacy Types

The new type system maintains backward compatibility through the main index file:

```typescript
// Legacy import (still works)
import { TradingViewWebhook } from '@/types';

// New recommended import
import { TradingViewWebhook } from '@/types/trading';
```

### Adding New Types

1. Add database model types to `trading.ts`
2. Create corresponding Zod schemas in `validations.ts`
3. Add API request/response types to `api.ts`
4. Export from `index.ts` for backward compatibility

## Testing

The type system includes comprehensive validation that can be tested:

```typescript
import { validateTradingViewWebhook } from '@/lib/validations';

describe('Webhook Validation', () => {
  it('should validate correct webhook payload', () => {
    const payload = {
      action: 'LONG',
      ticker: 'SPY',
      timestamp: Date.now(),
      // ... other fields
    };
    
    const result = validateTradingViewWebhook(payload);
    expect(result.success).toBe(true);
  });
});
```

## Future Enhancements

1. **Runtime Type Generation**: Generate types from OpenAPI specs
2. **Enhanced Validation**: Add custom validation rules for business logic
3. **Type Documentation**: Generate documentation from TypeScript types
4. **Performance Optimization**: Optimize validation schemas for high-throughput scenarios

## Conclusion

This type system provides a robust foundation for the DeltaStackPro trading platform, ensuring type safety from the database layer through to the user interface. The combination of TypeScript interfaces, Zod validation, and utility functions creates a maintainable and scalable codebase that can evolve with the platform's needs.