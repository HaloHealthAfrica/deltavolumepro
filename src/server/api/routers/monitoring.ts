import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/api/trpc';
import { prisma } from '@/lib/prisma';

export const monitoringRouter = createTRPCRouter({
  // Get real-time metrics
  getMetrics: protectedProcedure
    .query(async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const [
        webhooksLastMinute,
        webhooksLast5Min,
        successfulWebhooks,
        failedWebhooks,
        avgProcessingTime,
        activeStages
      ] = await Promise.all([
        prisma.webhookLog.count({ where: { createdAt: { gte: oneMinuteAgo } } }),
        prisma.webhookLog.count({ where: { createdAt: { gte: fiveMinutesAgo } } }),
        prisma.webhookLog.count({ where: { createdAt: { gte: fiveMinutesAgo }, status: 'success' } }),
        prisma.webhookLog.count({ where: { createdAt: { gte: fiveMinutesAgo }, status: { in: ['failed', 'rejected'] } } }),
        prisma.webhookLog.aggregate({ where: { createdAt: { gte: fiveMinutesAgo } }, _avg: { processingTime: true } }),
        prisma.processingStage.count({ where: { status: 'in_progress' } })
      ]);

      const totalRecent = successfulWebhooks + failedWebhooks;
      const successRate = totalRecent > 0 ? (successfulWebhooks / totalRecent) * 100 : 100;
      const errorRate = totalRecent > 0 ? (failedWebhooks / totalRecent) * 100 : 0;

      return {
        timestamp: now.toISOString(),
        webhookVolume: webhooksLastMinute,
        webhooksPerMinute: webhooksLast5Min / 5,
        successRate,
        errorRate,
        avgProcessingTime: avgProcessingTime._avg.processingTime || 0,
        queueDepth: activeStages,
        activeStages,
      };
    }),

  // Get webhook logs with pagination
  getWebhooks: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
      status: z.string().optional(),
      timeRange: z.enum(['15m', '1h', '24h', '7d']).default('1h'),
    }))
    .query(async ({ input }) => {
      const { page, limit, status, timeRange } = input;
      const now = new Date();
      
      const timeRangeMs: Record<string, number> = {
        '15m': 15 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      
      const dateFrom = new Date(now.getTime() - timeRangeMs[timeRange]);
      
      const where: any = { createdAt: { gte: dateFrom } };
      if (status && status !== 'all') {
        where.status = status;
      }

      const [webhooks, total] = await Promise.all([
        prisma.webhookLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            signal: { select: { id: true, ticker: true, action: true, status: true } }
          }
        }),
        prisma.webhookLog.count({ where })
      ]);

      return {
        data: webhooks.map(w => ({
          id: w.id,
          sourceIp: w.sourceIp,
          status: w.status,
          processingTime: w.processingTime,
          payloadSize: w.payloadSize,
          signalId: w.signalId,
          ticker: w.signal?.ticker,
          errorMessage: w.errorMessage,
          createdAt: w.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      };
    }),

  // Get system health
  getHealth: protectedProcedure
    .query(async () => {
      const now = new Date();
      
      // Check database
      let database = { status: 'healthy' as const, latency: 0 };
      const dbStart = Date.now();
      try {
        await prisma.$queryRaw`SELECT 1`;
        database.latency = Date.now() - dbStart;
        if (database.latency > 1000) {
          database = { status: 'degraded', latency: database.latency };
        }
      } catch {
        database = { status: 'unhealthy', latency: 0 };
      }

      // Check memory
      const memoryUsage = process.memoryUsage();
      const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const memory = {
        status: memoryPercent > 90 ? 'unhealthy' as const : memoryPercent > 75 ? 'degraded' as const : 'healthy' as const,
        usagePercent: memoryPercent
      };

      // Check queue
      const activeStages = await prisma.processingStage.count({ where: { status: 'in_progress' } });
      const queue = {
        status: activeStages > 100 ? 'degraded' as const : 'healthy' as const,
        depth: activeStages
      };

      // Overall status
      const statuses = [database.status, memory.status, queue.status];
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (statuses.includes('unhealthy')) overallStatus = 'unhealthy';
      else if (statuses.includes('degraded')) overallStatus = 'degraded';

      return {
        status: overallStatus,
        database,
        api: { status: 'healthy' as const, latency: 0 },
        memory,
        queue,
        lastCheck: now.toISOString(),
      };
    }),

  // Get decisions
  getDecisions: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
      outcome: z.string().optional(),
      timeRange: z.enum(['1h', '24h', '7d']).default('24h'),
    }))
    .query(async ({ input }) => {
      const { page, limit, outcome, timeRange } = input;
      const now = new Date();
      
      const timeRangeMs: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
      };
      
      const dateFrom = new Date(now.getTime() - timeRangeMs[timeRange]);
      
      const where: any = { createdAt: { gte: dateFrom } };
      if (outcome && outcome !== 'all') {
        where.decision = outcome === 'approved' ? 'APPROVE' : 'REJECT';
      }

      const [decisions, total, approved, rejected, avgConfidence] = await Promise.all([
        prisma.decision.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { signal: { select: { id: true, ticker: true, action: true } } }
        }),
        prisma.decision.count({ where }),
        prisma.decision.count({ where: { ...where, decision: 'APPROVE' } }),
        prisma.decision.count({ where: { ...where, decision: 'REJECT' } }),
        prisma.decision.aggregate({ where, _avg: { confidence: true } })
      ]);

      return {
        data: decisions.map(d => ({
          id: d.id,
          signalId: d.signalId,
          ticker: d.signal?.ticker,
          action: d.signal?.action,
          outcome: d.decision === 'APPROVE' ? 'approved' : 'rejected',
          confidenceScore: d.confidence,
          threshold: 0.7,
          factors: d.factors as any[] || [],
          rejectionReasons: d.rejectionReasons as string[] || [],
          createdAt: d.createdAt,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          total,
          approved,
          rejected,
          avgConfidence: avgConfidence._avg.confidence || 0,
          approvalRate: total > 0 ? (approved / total) * 100 : 0,
        }
      };
    }),

  // Get alerts
  getAlerts: protectedProcedure
    .input(z.object({
      includeResolved: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const where: any = {};
      if (!input.includeResolved) {
        where.resolved = false;
      }

      const alerts = await prisma.systemAlert.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      });

      return {
        alerts,
        unacknowledgedCount: alerts.filter(a => !a.acknowledged).length,
      };
    }),

  // Acknowledge alert
  acknowledgeAlert: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const alert = await prisma.systemAlert.update({
        where: { id: input.alertId },
        data: {
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: ctx.userId,
        },
      });
      return alert;
    }),

  // Resolve alert
  resolveAlert: protectedProcedure
    .input(z.object({ alertId: z.string() }))
    .mutation(async ({ input }) => {
      const alert = await prisma.systemAlert.update({
        where: { id: input.alertId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
        },
      });
      return alert;
    }),
});
