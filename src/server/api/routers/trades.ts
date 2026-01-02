import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

export const tradesRouter = createTRPCRouter({
  getOpen: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.trade.findMany({
        where: { status: 'OPEN' },
        orderBy: { enteredAt: 'desc' },
        include: {
          signal: true,
        },
      });
    }),

  getHistory: protectedProcedure
    .input(z.object({ 
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.trade.findMany({
        take: input.limit,
        skip: input.offset,
        orderBy: { createdAt: 'desc' },
        include: {
          signal: true,
          analysis: true,
        },
      });
    }),

  getPerformance: protectedProcedure
    .query(async ({ ctx }) => {
      const trades = await ctx.prisma.trade.findMany({
        where: { status: 'CLOSED' },
        select: {
          pnl: true,
          pnlPercent: true,
          rMultiple: true,
          holdingPeriod: true,
        },
      });

      if (trades.length === 0) {
        return {
          totalTrades: 0,
          winRate: 0,
          avgReturn: 0,
          totalPnl: 0,
          avgHoldingPeriod: 0,
        };
      }

      const wins = trades.filter(t => (t.pnl ?? 0) > 0).length;
      const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const avgReturn = trades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0) / trades.length;
      const avgHoldingPeriod = trades.reduce((sum, t) => sum + (t.holdingPeriod ?? 0), 0) / trades.length;

      return {
        totalTrades: trades.length,
        winRate: (wins / trades.length) * 100,
        avgReturn,
        totalPnl,
        avgHoldingPeriod,
      };
    }),

  closePosition: protectedProcedure
    .input(z.object({ 
      tradeId: z.string(),
      exitPrice: z.number(),
      exitReason: z.enum(['MANUAL', 'STOP_LOSS', 'TARGET_1', 'TARGET_2', 'TRAILING']),
    }))
    .mutation(async ({ ctx, input }) => {
      // This will be implemented in the paper trading task
      throw new Error('Manual position closure not yet implemented');
    }),
});