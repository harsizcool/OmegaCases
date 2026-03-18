import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import MuiProvider from '@/components/mui-provider'
import Navbar from '@/components/navbar'
import LiveRollsFeed from '@/components/live-rolls-feed'
import DiscountBanner from '@/components/discount-banner'
import './globals.css'

export const metadata: Metadata = {
  title: 'OmegaCases - The best case opening website.. of all time 🤤',
  description: 'OmegaCases is a website where you can like open cases and win rare items and sell. u can also like buy low sell high xdxd',
  generator: 'v0.app',
  icons: {
    icon: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1976d2',
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <MuiProvider>
            <Navbar />
            <DiscountBanner />
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <main style={{ flex: 1, minWidth: 0, backgroundColor: "inherit" }} className="pb-[44px] lg:pb-0">{children}</main>
              <LiveRollsFeed />
            </div>
          </MuiProvider>
        </NextThemesProvider>
        <Analytics />
      </body>
    </html>
  )
}
