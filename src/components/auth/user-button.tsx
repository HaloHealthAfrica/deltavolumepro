'use client'

import { UserButton as ClerkUserButton, useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Shield, LogIn } from 'lucide-react'

interface UserButtonProps {
  showAdminLink?: boolean
}

export function UserButton({ showAdminLink = true }: UserButtonProps) {
  const { isSignedIn, isLoaded, user } = useUser()

  // Show loading state
  if (!isLoaded) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
    )
  }

  // Show sign-in link if not authenticated
  if (!isSignedIn) {
    return (
      <Link
        href="/sign-in"
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Sign In
      </Link>
    )
  }

  // Check if user is admin from public metadata
  const isAdmin = (user?.publicMetadata?.role as string) === 'ADMIN'

  return (
    <div className="flex items-center gap-3">
      {/* Admin badge and link */}
      {isAdmin && showAdminLink && (
        <Link
          href="/admin"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-full transition-colors"
        >
          <Shield className="w-3.5 h-3.5" />
          Admin
        </Link>
      )}

      {/* Clerk UserButton with custom styling */}
      <ClerkUserButton
        appearance={{
          elements: {
            avatarBox: 'w-9 h-9',
            userButtonPopoverCard: 'bg-slate-800 border border-slate-700',
            userButtonPopoverActionButton: 'text-slate-300 hover:bg-slate-700',
            userButtonPopoverActionButtonText: 'text-slate-300',
            userButtonPopoverActionButtonIcon: 'text-slate-400',
            userButtonPopoverFooter: 'hidden',
          },
        }}
        afterSignOutUrl="/"
      />
    </div>
  )
}
