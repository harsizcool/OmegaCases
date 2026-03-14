import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import MuiProvider from '@/components/mui-provider'
import Navbar from '@/components/navbar'
import './globals.css'

export const metadata: Metadata = {
  title: 'OmegaCases — Open Cases, Win Rare Items',
  description: 'OmegaCases is a CS2-style case opening economy website. Open cases, win rare skins, trade on the marketplace.',
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
        <MuiProvider>
          <Navbar />
          <main>{children}</main>
        </MuiProvider>
        <Analytics />
      </body>
    </html>
  )
}
