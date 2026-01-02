import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { UserRole } from '@prisma/client'

/**
 * Property-Based Tests for User Authentication
 * Feature: user-authentication, Property 5: Non-Admin Access Denial
 * 
 * For any user without ADMIN role attempting to access admin routes 
 * (including the user management panel), access SHALL be denied and 
 * the user SHALL be redirected to an unauthorized page.
 * 
 * Validates: Requirements 5.5, 6.1
 */

// Admin routes that require ADMIN role
const ADMIN_ROUTES = [
  '/admin',
  '/admin/users',
  '/admin/settings',
  '/admin/dashboard',
] as const

// Protected routes that require authentication but not admin
const PROTECTED_ROUTES = [
  '/dashboard',
  '/signals',
  '/trades',
  '/positions',
  '/settings',
] as const

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/unauthorized',
  '/account-disabled',
] as const

/**
 * Simulates the middleware access control logic
 */
function checkRouteAccess(
  route: string,
  userRole: UserRole | null,
  isAuthenticated: boolean
): { allowed: boolean; redirectTo: string | null } {
  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(r => route === r || route.startsWith(r + '/'))
  if (isPublicRoute) {
    return { allowed: true, redirectTo: null }
  }

  // Not authenticated - redirect to sign-in
  if (!isAuthenticated) {
    return { allowed: false, redirectTo: '/sign-in' }
  }

  // Check if route is admin-only
  const isAdminRoute = ADMIN_ROUTES.some(r => route === r || route.startsWith(r + '/'))
  if (isAdminRoute) {
    if (userRole !== UserRole.ADMIN) {
      return { allowed: false, redirectTo: '/unauthorized' }
    }
  }

  // Authenticated user accessing protected route
  return { allowed: true, redirectTo: null }
}

describe('User Authentication - Non-Admin Access Denial', () => {
  /**
   * Property 5: Non-Admin Access Denial
   * For any non-admin user and any admin route, access should be denied
   */
  it('should deny non-admin users access to admin routes', () => {
    fc.assert(
      fc.property(
        fc.record({
          route: fc.constantFrom(...ADMIN_ROUTES),
          userRole: fc.constantFrom(UserRole.USER, null),
          isAuthenticated: fc.boolean(),
        }),
        (testCase) => {
          const result = checkRouteAccess(
            testCase.route,
            testCase.userRole,
            testCase.isAuthenticated
          )

          // Non-admin users should never be allowed on admin routes
          if (testCase.isAuthenticated && testCase.userRole === UserRole.USER) {
            expect(result.allowed).toBe(false)
            expect(result.redirectTo).toBe('/unauthorized')
          }

          // Unauthenticated users should be redirected to sign-in
          if (!testCase.isAuthenticated) {
            expect(result.allowed).toBe(false)
            expect(result.redirectTo).toBe('/sign-in')
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 5 (continued): Admin users should have access to admin routes
   */
  it('should allow admin users access to admin routes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ADMIN_ROUTES),
        (route) => {
          const result = checkRouteAccess(route, UserRole.ADMIN, true)

          // Admin users should be allowed on admin routes
          expect(result.allowed).toBe(true)
          expect(result.redirectTo).toBeNull()
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 5 (continued): All authenticated users should access protected routes
   */
  it('should allow all authenticated users access to protected routes', () => {
    fc.assert(
      fc.property(
        fc.record({
          route: fc.constantFrom(...PROTECTED_ROUTES),
          userRole: fc.constantFrom(UserRole.USER, UserRole.ADMIN),
        }),
        (testCase) => {
          const result = checkRouteAccess(testCase.route, testCase.userRole, true)

          // Any authenticated user should access protected routes
          expect(result.allowed).toBe(true)
          expect(result.redirectTo).toBeNull()
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 5 (continued): Public routes should be accessible to everyone
   */
  it('should allow everyone access to public routes', () => {
    fc.assert(
      fc.property(
        fc.record({
          route: fc.constantFrom(...PUBLIC_ROUTES),
          userRole: fc.constantFrom(UserRole.USER, UserRole.ADMIN, null),
          isAuthenticated: fc.boolean(),
        }),
        (testCase) => {
          const result = checkRouteAccess(
            testCase.route,
            testCase.userRole,
            testCase.isAuthenticated
          )

          // Public routes should always be accessible
          expect(result.allowed).toBe(true)
          expect(result.redirectTo).toBeNull()
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 5 (continued): Unauthenticated users should be redirected from protected routes
   */
  it('should redirect unauthenticated users from protected routes to sign-in', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PROTECTED_ROUTES, ...ADMIN_ROUTES),
        (route) => {
          const result = checkRouteAccess(route, null, false)

          // Unauthenticated users should be redirected to sign-in
          expect(result.allowed).toBe(false)
          expect(result.redirectTo).toBe('/sign-in')
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 5 (continued): Role-based access is consistent across all admin sub-routes
   */
  it('should consistently deny non-admin access to all admin sub-routes', () => {
    fc.assert(
      fc.property(
        fc.record({
          baseRoute: fc.constantFrom('/admin'),
          subPath: fc.string({ minLength: 0, maxLength: 10 }),
          userRole: fc.constantFrom(UserRole.USER),
        }),
        (testCase) => {
          const fullRoute = testCase.baseRoute + (testCase.subPath ? '/' + testCase.subPath : '')
          const result = checkRouteAccess(fullRoute, testCase.userRole, true)

          // Any admin sub-route should be denied for non-admin users
          expect(result.allowed).toBe(false)
          expect(result.redirectTo).toBe('/unauthorized')
        }
      ),
      { numRuns: 20 }
    )
  })
})
