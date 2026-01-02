import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

export const signalsRouter = createTRPCRouter({
  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.signal.findMany({
        take: input.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          decision: true,
          trades: true,
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.signal.findUnique({
        where: { id: input.id },
        include: {
          enrichedData: true,
          decision: true,
          trades: {
            include: {
              analysis: true,
            },
          },
        },
      });
    }),

  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const [total, processed, traded] = await Promise.all([
        ctx.prisma.signal.count(),
        ctx.prisma.signal.count({ where: { status: 'enriched' } }),
        ctx.prisma.signal.count({ where: { status: 'traded' } }),
      ]);

      return {
        total,
        processed,
        traded,
        processingRate: total > 0 ? (processed / total) * 100 : 0,
        tradingRate: processed > 0 ? (traded / processed) * 100 : 0,
      };
    }),
});