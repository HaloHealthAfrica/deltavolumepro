import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md p-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            DeltaStackPro
          </h1>
          <p className="text-slate-400">
            Create an account to start trading
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-slate-800 border border-slate-700 shadow-xl',
              headerTitle: 'text-white',
              headerSubtitle: 'text-slate-400',
              socialButtonsBlockButton: 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600',
              socialButtonsBlockButtonText: 'text-white',
              dividerLine: 'bg-slate-600',
              dividerText: 'text-slate-400',
              formFieldLabel: 'text-slate-300',
              formFieldInput: 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500',
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
              footerActionLink: 'text-blue-400 hover:text-blue-300',
              identityPreviewText: 'text-white',
              identityPreviewEditButton: 'text-blue-400',
              formFieldInputShowPasswordButton: 'text-slate-400',
              otpCodeFieldInput: 'bg-slate-700 border-slate-600 text-white',
            },
          }}
          afterSignUpUrl="/dashboard"
          signInUrl="/sign-in"
        />
      </div>
    </div>
  )
}
