import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';

export const rulesRouter = createTRPCRouter({
  getCurrent: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.tradingRules.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.prisma.tradingRules.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      qualityWeight: z.number().min(0).max(1),
      volumeWeight: z.number().min(0).max(1),
      oscillatorWeight: z.number().min(0).max(1),
      structureWeight: z.number().min(0).max(1),
      marketWeight: z.number().min(0).max(1),
      minQuality: z.number().min(1).max(5),
      minConfidence: z.number().min(0).max(1),
      minVolumePressure: z.number().min(0).max(100),
      maxRiskPercent: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      // Deactivate current rules
      await ctx.prisma.tradingRules.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });

      // Create new rule version
      const version = `v${Date.now()}`;
      return ctx.prisma.tradingRules.create({
        data: {
          version,
          isActive: true,
          ...input,
          baseSizePerQuality: { 1: 0, 2: 0, 3: 50, 4: 100, 5: 150 },
          allowedTimeframes: [5, 15, 30, 60],
          tradingHours: { start: '09:30', end: '16:00' },
          learningData: {},
        },
      });
    }),
});