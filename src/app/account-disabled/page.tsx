import Link from 'next/link'
import { UserX } from 'lucide-react'

export default function AccountDisabledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center p-8 max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-red-500/10 rounded-full">
            <UserX className="w-16 h-16 text-red-500" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          Account Disabled
        </h1>
        <p className="text-slate-400 mb-8">
          Your account has been disabled by an administrator. 
          If you believe this is an error, please contact support.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Back to Home
          </Link>
          <a
            href="mailto:support@deltastackpro.com"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  )
}
