"use client"

import NextLink from "next/link"
import { Mail, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/30 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Left — logo + copyright */}
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <div className="flex items-center gap-2">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
                alt="OmegaCases"
                className="w-6 h-6"
              />
              <span className="text-sm font-bold">
                Omega<span className="text-primary">Cases</span>
              </span>
              {/* v2.0 tag */}
              <span className="inline-flex items-center gap-1 bg-primary/15 border border-primary/25 text-primary text-[0.6rem] font-bold rounded-full px-2 py-0.5">
                <Star size={9} />
                v2.0.6
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 OmegaCases. All rights reserved.
            </p>
          </div>

          {/* Right — links */}
          <div className="flex items-center gap-3">
            <NextLink
              href="/leaderboard"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Leaderboard
            </NextLink>
            <Separator orientation="vertical" className="h-3 bg-border/60" />
            <NextLink
              href="/plus"
              className="text-xs text-amber-500 hover:text-amber-400 font-semibold transition-colors"
            >
              Plus
            </NextLink>
            <Separator orientation="vertical" className="h-3 bg-border/60" />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 border-border/60"
              asChild
            >
              <a href="mailto:juhahzi@atomicmail.io" target="_blank" rel="noopener noreferrer">
                <Mail size={11} />
                Support
              </a>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}
