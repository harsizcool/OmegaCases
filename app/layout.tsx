import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import AppProvider from '@/components/app-provider'
import Navbar from '@/components/navbar'
import LiveRollsFeed from '@/components/live-rolls-feed'
import DiscountBanner from '@/components/discount-banner'
import FooterWrapper from '@/components/footer-wrapper'
import PullToRefresh from '@/components/pull-to-refresh'
import './globals.css'

const LOGO =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"

export const metadata: Metadata = {
  title: 'OmegaCases - The best case opening website.. of all time 🤤',
  description: 'OmegaCases is a website where you can like open cases and win rare items and sell. u can also like buy low sell high xdxd',
  generator: 'v0.app',
  // PWA / homescreen icons
  icons: {
    icon: [
      { url: LOGO, sizes: "32x32",  type: "image/png" },
      { url: LOGO, sizes: "192x192", type: "image/png" },
      { url: LOGO, sizes: "512x512", type: "image/png" },
    ],
    // iOS "Add to Home Screen" icon
    apple: [
      { url: LOGO, sizes: "180x180", type: "image/png" },
    ],
    shortcut: LOGO,
  },
  // iOS PWA meta
  appleWebApp: {
    capable: true,
    title: "OmegaCases",
    statusBarStyle: "black-translucent",
    startupImage: LOGO,
  },
}

export const viewport: Viewport = {
  themeColor: '#5865f2',
  userScalable: false,
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geologica:wght,CRSV@100..900,0&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AppProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <DiscountBanner />
              <div className="flex flex-1 items-start">
                <main className="flex-1 min-w-0 pb-[44px] lg:pb-0">{children}</main>
                <LiveRollsFeed />
              </div>
              <FooterWrapper />
            </div>
          </AppProvider>
        </NextThemesProvider>
        <PullToRefresh />
        <Analytics />
      </body>
    </html>
  )
}
