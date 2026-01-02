import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs'
import { RealtimeProvider } from '@/components/providers'
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DeltaStackPro - Intelligent Trading Platform",
  description: "Advanced trading platform with TradingView integration, multi-broker execution, and machine learning optimization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  
  // Only wrap with ClerkProvider if we have a valid key
  if (publishableKey && publishableKey !== 'pk_test_placeholder') {
    return (
      <ClerkProvider publishableKey={publishableKey}>
        <html lang="en">
          <body className={`${inter.className} antialiased`}>
            <RealtimeProvider>
              {children}
            </RealtimeProvider>
          </body>
        </html>
      </ClerkProvider>
    );
  }

  // Fallback without Clerk for build time
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <RealtimeProvider>
          {children}
        </RealtimeProvider>
      </body>
    </html>
  );
}
