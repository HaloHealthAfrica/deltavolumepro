import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/tradingview',
  '/api/webhooks/clerk(.*)',
  '/api/health',
  '/unauthorized',
  '/account-disabled',
  '/',
])

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  try {
    // Allow public routes without authentication
    if (isPublicRoute(request)) {
      return NextResponse.next()
    }

    // Protect all non-public routes
    const { userId, sessionClaims } = await auth.protect()

    // For admin routes, check if user has admin role in session claims
    // The role is synced to Clerk's public metadata via webhook
    if (isAdminRoute(request)) {
      const metadata = sessionClaims?.metadata as { role?: string } | undefined
      const userRole = metadata?.role
      
      // If no role in metadata or not admin, redirect to unauthorized
      // Note: First-time users won't have role in metadata until webhook syncs
      if (userRole !== 'ADMIN') {
        const url = new URL('/unauthorized', request.url)
        return NextResponse.redirect(url)
      }
    }

    return NextResponse.next()
  } catch (error) {
    // Log error for debugging (will appear in Vercel logs)
    console.error('Middleware error:', error)
    
    // For public routes that somehow failed, allow through
    if (isPublicRoute(request)) {
      return NextResponse.next()
    }
    
    // For protected routes, redirect to sign-in
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}