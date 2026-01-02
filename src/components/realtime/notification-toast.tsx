/**
 * Notification Toast Component
 * Displays real-time notifications as toast messages
 */

'use client'

import { useEffect } from 'react'
import { useNotifications } from '@/hooks/use-realtime'
import type { NotificationPayload } from '@/lib/realtime/broadcaster'

interface NotificationToastProps {
  notification: NotificationPayload
  onDismiss: (id: string) => void
}

function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const typeStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  }

  const iconMap = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅',
  }

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id)
    }, 5000)

    return () => clearTimeout(timer)
  }, [notification.id, onDismiss])

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg ${typeStyles[notification.type]}`}
      role="alert"
    >
      <span className="text-lg">{iconMap[notification.type]}</span>
      <div className="flex-1">
        <h4 className="font-medium">{notification.title}</h4>
        <p className="text-sm opacity-90">{notification.message}</p>
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="text-gray-400 hover:text-gray-600"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  )
}

export function NotificationContainer() {
  const { notifications, clearNotification } = useNotifications()

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={clearNotification}
        />
      ))}
    </div>
  )
}
