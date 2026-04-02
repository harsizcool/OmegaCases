"use client"

import { usePathname } from "next/navigation"
import Footer from "./footer"

const FOOTER_ROUTES = ["/", "/trade", "/leaderboard", "/plus"]

export default function FooterWrapper() {
  const pathname = usePathname()

  // Show on exact routes + /user/* pages
  const show =
    FOOTER_ROUTES.includes(pathname) ||
    pathname.startsWith("/user/")

  if (!show) return null
  return <Footer />
}
