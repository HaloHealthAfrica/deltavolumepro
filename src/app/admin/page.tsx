import { redirect } from 'next/navigation'

// Force dynamic rendering to avoid static generation issues with Clerk
export const dynamic = 'force-dynamic'

export default function AdminPage() {
  redirect('/admin/users')
}
