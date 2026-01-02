import { createTRPCRouter } from '@/server/api/trpc';
import { signalsRouter } from '@/server/api/routers/signals';
import { tradesRouter } from '@/server/api/routers/trades';
import { rulesRouter } from '@/server/api/routers/rules';
import { usersRouter } from '@/server/api/routers/users';
import { monitoringRouter } from '@/server/api/routers/monitoring';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  signals: signalsRouter,
  trades: tradesRouter,
  rules: rulesRouter,
  users: usersRouter,
  monitoring: monitoringRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;