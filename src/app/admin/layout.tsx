import { AdminLayoutClient } from './admin-layout-client'

// Force dynamic rendering to avoid static generation issues with Clerk
export const dynamic = 'force-dynamic'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
