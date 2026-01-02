import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { UserRole } from '@prisma/client';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '@/server/api/trpc';
import { userService } from '@/lib/services/user-service';

// Input schemas
const listUsersSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  role: z.nativeEnum(UserRole).optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  sortBy: z.enum(['email', 'createdAt', 'lastSignInAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const updateRoleSchema = z.object({
  userId: z.string(),
  role: z.nativeEnum(UserRole),
});

export const usersRouter = createTRPCRouter({
  /**
   * Get current user's profile
   * Protected - requires authentication
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await userService.getUserByClerkId(ctx.session.userId);
    
    if (!user) {
      // User exists in Clerk but not in local DB - create them
      // This handles the case where webhook hasn't fired yet
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User profile not found. Please try again in a moment.',
      });
    }

    if (!user.isActive) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Your account has been disabled. Please contact an administrator.',
      });
    }

    return user;
  }),

  /**
   * List all users with pagination and filtering
   * Admin only
   */
  list: adminProcedure
    .input(listUsersSchema)
    .query(async ({ input }) => {
      return userService.listUsers(input);
    }),

  /**
   * Get a specific user by ID
   * Admin only
   */
  getById: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const user = await userService.getUserById(input.id);
      
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return user;
    }),

  /**
   * Update a user's role
   * Admin only - cannot change own role
   */
  updateRole: adminProcedure
    .input(updateRoleSchema)
    .mutation(async ({ ctx, input }) => {
      // Get the admin's user record to check they're not changing their own role
      const adminUser = await userService.getUserByClerkId(ctx.session.userId);
      
      if (adminUser?.id === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot change your own role',
        });
      }

      const targetUser = await userService.getUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return userService.setUserRole(input.userId, input.role);
    }),

  /**
   * Disable a user account
   * Admin only - cannot disable own account
   */
  disable: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get the admin's user record to check they're not disabling themselves
      const adminUser = await userService.getUserByClerkId(ctx.session.userId);
      
      if (adminUser?.id === input.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot disable your own account',
        });
      }

      const targetUser = await userService.getUserById(input.id);
      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return userService.disableUser(input.id);
    }),

  /**
   * Enable a user account
   * Admin only
   */
  enable: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const targetUser = await userService.getUserById(input.id);
      if (!targetUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return userService.enableUser(input.id);
    }),

  /**
   * Get user statistics
   * Admin only
   */
  stats: adminProcedure.query(async () => {
    const counts = await userService.getUserCountByRole();
    const recentUsers = await userService.listUsers({ 
      limit: 5, 
      sortBy: 'createdAt', 
      sortOrder: 'desc' 
    });

    return {
      totalUsers: counts.users + counts.admins,
      userCount: counts.users,
      adminCount: counts.admins,
      recentUsers: recentUsers.users,
    };
  }),
});
