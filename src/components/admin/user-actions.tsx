'use client'

import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Shield, UserX, UserCheck, ChevronRight } from 'lucide-react'

interface UserActionsProps {
  user: {
    id: string
    email: string
    role: 'USER' | 'ADMIN'
    isActive: boolean
  }
  currentUserId: string
  onRoleChange: (userId: string, role: 'USER' | 'ADMIN') => void
  onToggleStatus: (userId: string, enable: boolean) => void
}

export function UserActions({ user, currentUserId, onRoleChange, onToggleStatus }: UserActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [showConfirmDisable, setShowConfirmDisable] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isSelf = currentUserId === user.id

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowRoleMenu(false)
        setShowConfirmDisable(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setShowRoleMenu(false)
        setShowConfirmDisable(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleRoleChange = (role: 'USER' | 'ADMIN') => {
    onRoleChange(user.id, role)
    setIsOpen(false)
    setShowRoleMenu(false)
  }

  const handleToggleStatus = () => {
    if (user.isActive) {
      // Show confirmation for disabling
      setShowConfirmDisable(true)
    } else {
      // Enable directly without confirmation
      onToggleStatus(user.id, true)
      setIsOpen(false)
    }
  }

  const confirmDisable = () => {
    onToggleStatus(user.id, false)
    setIsOpen(false)
    setShowConfirmDisable(false)
  }

  const cancelDisable = () => {
    setShowConfirmDisable(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
        aria-label="User actions"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
          {/* Confirmation Dialog for Disabling */}
          {showConfirmDisable ? (
            <div className="p-4">
              <p className="text-sm text-slate-300 mb-3">
                Are you sure you want to disable <span className="font-medium text-white">{user.email}</span>?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={cancelDisable}
                  className="flex-1 px-3 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDisable}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Disable
                </button>
              </div>
            </div>
          ) : (
            <div className="py-1">
              {/* Change Role - with submenu */}
              <div
                className="relative"
                onMouseEnter={() => setShowRoleMenu(true)}
                onMouseLeave={() => setShowRoleMenu(false)}
              >
                <button
                  disabled={isSelf}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${
                    isSelf
                      ? 'text-slate-500 cursor-not-allowed'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                >
                  <span className="flex items-center gap-3">
                    <Shield className="w-4 h-4" />
                    Change Role
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Role Submenu */}
                {showRoleMenu && !isSelf && (
                  <div className="absolute left-full top-0 ml-1 w-36 bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
                    <div className="py-1">
                      <button
                        onClick={() => handleRoleChange('USER')}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                          user.role === 'USER'
                            ? 'text-blue-400 bg-slate-700/50'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {user.role === 'USER' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                        <span className={user.role === 'USER' ? '' : 'ml-3.5'}>USER</span>
                      </button>
                      <button
                        onClick={() => handleRoleChange('ADMIN')}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                          user.role === 'ADMIN'
                            ? 'text-amber-400 bg-slate-700/50'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {user.role === 'ADMIN' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                        <span className={user.role === 'ADMIN' ? '' : 'ml-3.5'}>ADMIN</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="my-1 border-t border-slate-700" />

              {/* Enable/Disable Account */}
              <button
                disabled={isSelf}
                onClick={handleToggleStatus}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                  isSelf
                    ? 'text-slate-500 cursor-not-allowed'
                    : user.isActive
                    ? 'text-red-400 hover:bg-slate-700 hover:text-red-300'
                    : 'text-green-400 hover:bg-slate-700 hover:text-green-300'
                }`}
              >
                {user.isActive ? (
                  <>
                    <UserX className="w-4 h-4" />
                    Disable Account
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Enable Account
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
