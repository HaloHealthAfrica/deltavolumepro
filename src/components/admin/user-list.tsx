'use client'

import { useState } from 'react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Edit,
  ToggleLeft,
  ToggleRight,
  Shield,
  User,
} from 'lucide-react'

interface UserListProps {
  users: Array<{
    id: string
    email: string
    name: string | null
    role: 'USER' | 'ADMIN'
    isActive: boolean
    lastSignInAt: Date | null
  }>
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onSearch: (query: string) => void
  onUserAction: (userId: string, action: 'edit' | 'toggleStatus' | 'changeRole') => void
}

function formatLastSignIn(date: Date | null): string {
  if (!date) return 'Never'
  
  const now = new Date()
  const signInDate = new Date(date)
  const diffMs = now.getTime() - signInDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`
    }
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  }
  
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  
  return signInDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: signInDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function UserList({
  users,
  total,
  page,
  totalPages,
  onPageChange,
  onSearch,
  onUserAction,
}: UserListProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    onSearch(query)
  }

  const startIndex = (page - 1) * users.length + 1
  const endIndex = Math.min(page * users.length, total)

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800">
      {/* Search Header */}
      <div className="border-b border-slate-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by email or name..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full rounded-md border border-slate-600 bg-slate-700 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700 text-left text-sm text-slate-400">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Sign In</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-700 last:border-b-0 hover:bg-slate-750"
                >
                  <td className="px-4 py-3 text-sm text-white">{user.email}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">
                    {user.name || <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isActive={user.isActive} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {formatLastSignIn(user.lastSignInAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <ActionButton
                        icon={<Edit className="h-4 w-4" />}
                        title="Edit user"
                        onClick={() => onUserAction(user.id, 'edit')}
                      />
                      <ActionButton
                        icon={
                          user.isActive ? (
                            <ToggleRight className="h-4 w-4 text-green-400" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-red-400" />
                          )
                        }
                        title={user.isActive ? 'Disable user' : 'Enable user'}
                        onClick={() => onUserAction(user.id, 'toggleStatus')}
                      />
                      <ActionButton
                        icon={
                          user.role === 'ADMIN' ? (
                            <User className="h-4 w-4 text-amber-400" />
                          ) : (
                            <Shield className="h-4 w-4 text-blue-400" />
                          )
                        }
                        title={user.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin'}
                        onClick={() => onUserAction(user.id, 'changeRole')}
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3">
        <div className="text-sm text-slate-400">
          {total > 0 ? (
            <>
              Showing <span className="font-medium text-white">{startIndex}</span> to{' '}
              <span className="font-medium text-white">{endIndex}</span> of{' '}
              <span className="font-medium text-white">{total}</span> users
            </>
          ) : (
            'No users to display'
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {page} of {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-700"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: 'USER' | 'ADMIN' }) {
  if (role === 'ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-400">
        <Shield className="h-3 w-3" />
        Admin
      </span>
    )
  }
  
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-400">
      <User className="h-3 w-3" />
      User
    </span>
  )
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        Active
      </span>
    )
  }
  
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
      Disabled
    </span>
  )
}

function ActionButton({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
    >
      {icon}
    </button>
  )
}
