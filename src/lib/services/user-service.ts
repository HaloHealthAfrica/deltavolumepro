import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import type { User } from '@prisma/client'

// Types for user service operations
export interface CreateUserInput {
  clerkId: string
  email: string
  name?: string
  imageUrl?: string
}

export interface UpdateUserInput {
  email?: string
  name?: string
  imageUrl?: string
  lastSignInAt?: Date
}

export interface ListUsersOptions {
  page?: number
  limit?: number
  role?: UserRole
  search?: string
  isActive?: boolean
  sortBy?: 'email' | 'createdAt' | 'lastSignInAt' | 'name'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedUsers {
  users: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ClerkUserData {
  id: string
  emailAddresses: Array<{ emailAddress: string }>
  firstName?: string | null
  lastName?: string | null
  imageUrl?: string | null
}

/**
 * User Service - handles all user-related database operations
 */
export const userService = {
  /**
   * Create a new user with default USER role
   */
  async createUser(input: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data: {
        clerkId: input.clerkId,
        email: input.email,
        name: input.name,
        imageUrl: input.imageUrl,
        role: UserRole.USER, // Default role is always USER
        isActive: true,
      },
    })
  },

  /**
   * Get user by Clerk ID
   */
  async getUserByClerkId(clerkId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { clerkId },
    })
  },

  /**
   * Get user by internal ID
   */
  async getUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    })
  },

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    })
  },

  /**
   * Update user data
   */
  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    })
  },

  /**
   * Update user's last sign-in timestamp
   */
  async updateLastSignIn(clerkId: string): Promise<User> {
    return prisma.user.update({
      where: { clerkId },
      data: { lastSignInAt: new Date() },
    })
  },

  /**
   * Set user role (admin only operation)
   */
  async setUserRole(id: string, role: UserRole): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { role },
    })
  },

  /**
   * Check if a user has admin role
   */
  async isAdmin(clerkId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { role: true, isActive: true },
    })
    return user?.role === UserRole.ADMIN && user?.isActive === true
  },

  /**
   * Disable a user account
   */
  async disableUser(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
    })
  },

  /**
   * Enable a user account
   */
  async enableUser(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { isActive: true },
    })
  },

  /**
   * List users with pagination and filtering (admin only)
   */
  async listUsers(options: ListUsersOptions = {}): Promise<PaginatedUsers> {
    const {
      page = 1,
      limit = 20,
      role,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options

    const skip = (page - 1) * limit

    // Build where clause
    const where: {
      role?: UserRole
      isActive?: boolean
      OR?: Array<{ email?: { contains: string }; name?: { contains: string } }>
    } = {}

    if (role) {
      where.role = role
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
      ]
    }

    // Execute queries in parallel
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.user.count({ where }),
    ])

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  },

  /**
   * Sync user data from Clerk webhook
   * Creates user if not exists, updates if exists
   */
  async syncFromClerk(clerkUser: ClerkUserData): Promise<User> {
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) {
      throw new Error('Clerk user has no email address')
    }

    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(' ') || undefined

    const existingUser = await prisma.user.findUnique({
      where: { clerkId: clerkUser.id },
    })

    if (existingUser) {
      // Update existing user
      return prisma.user.update({
        where: { clerkId: clerkUser.id },
        data: {
          email,
          name,
          imageUrl: clerkUser.imageUrl ?? undefined,
          lastSignInAt: new Date(),
        },
      })
    }

    // Create new user with default USER role
    return prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        email,
        name,
        imageUrl: clerkUser.imageUrl ?? undefined,
        role: UserRole.USER,
        isActive: true,
      },
    })
  },

  /**
   * Mark user as inactive when deleted from Clerk
   * We don't delete to preserve trade history
   */
  async handleClerkUserDeleted(clerkId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { clerkId },
    })

    if (!user) {
      return null
    }

    return prisma.user.update({
      where: { clerkId },
      data: { isActive: false },
    })
  },

  /**
   * Get user count by role
   */
  async getUserCountByRole(): Promise<{ users: number; admins: number }> {
    const [users, admins] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.USER } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
    ])
    return { users, admins }
  },

  /**
   * Check if user is active
   */
  async isUserActive(clerkId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { isActive: true },
    })
    return user?.isActive ?? false
  },
}

export type { User, UserRole }
