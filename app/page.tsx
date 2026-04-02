"use client";

import NextLink from "next/link";
import {
  Package,
  Store,
  ArrowRight,
  Zap,
  Shield,
  Trophy,
  Star,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

const RARITIES = [
  { name: "Common", color: "#9e9e9e" },
  { name: "Uncommon", color: "#43a047" },
  { name: "Rare", color: "#1e88e5" },
  { name: "Legendary", color: "#8e24aa" },
  { name: "Omega", color: "#f4511e" },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-20 md:py-32 text-center">
        {/* Background glow blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] rounded-full bg-purple-500/8 blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-rose-500/8 blur-[100px]" />
        </div>

        <div className="relative max-w-3xl mx-auto">
          {/* Version badge */}

          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/omegacrate_logo-tJzRwAfwpZAQEkJOSjQGI93l5hRU06.png"
            alt="OmegaCases"
            className="w-20 h-20 md:w-28 md:h-28 mx-auto mb-5 drop-shadow-xl"
          />

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight tracking-tight">
            OmegaCases.
            <br />
            <span className="text-primary">Trade. Profit. Repeat.</span>
          </h1>

          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
            OmegaCases is a case-opening website where you try your luck, open
            cases, and trade them between players.
          </p>

          {user ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="gap-2 px-8 text-base font-bold shadow-lg shadow-primary/25"
                asChild
              >
                <NextLink href="/open">
                  <Package size={18} /> Open Cases Now
                </NextLink>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 px-8 text-base"
                asChild
              >
                <NextLink href="/marketplace">
                  <Store size={18} /> Browse Marketplace
                </NextLink>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="gap-2 px-8 text-base font-bold shadow-lg shadow-primary/25"
                asChild
              >
                <NextLink href="/register">
                  Start Opening 🤑🫰 <ArrowRight size={16} />
                </NextLink>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 px-8 text-base"
                asChild
              >
                <NextLink href="/login">Login</NextLink>
              </Button>
            </div>
          )}

          {/* Crypto logos + instant payouts */}
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground/70 font-medium">Supports:</span>
            {[
              { src: "/bitcoinbtclogo.png",       alt: "Bitcoin (BTC)"      },
              { src: "/litecoin-ltc-logo.png",    alt: "Litecoin (LTC)"     },
              { src: "/solana-sol-logo.png",       alt: "Solana (SOL)"       },
              { src: "/bitcoin-cash-bch-logo.png", alt: "Bitcoin Cash (BCH)" },
            ].map((c) => (
              <img
                key={c.src}
                src={c.src}
                alt={c.alt}
                title={c.alt}
                className="w-6 h-6 object-contain"
              />
            ))}
            <span className="text-muted-foreground/50 text-xs">·</span>
            <span className="text-xs text-muted-foreground/70 font-medium">Instant payouts</span>
          </div>
        </div>
      </section>

      {/* ── Rarity strip ─────────────────────────────────── */}
      <div className="border-y border-border/40 py-3 overflow-x-auto">
        <div className="flex items-center justify-center gap-3 min-w-max px-4">
          {RARITIES.map((r) => (
            <div key={r.name} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: r.color }}
              />
              <span className="text-xs font-semibold text-muted-foreground">
                {r.name}
              </span>
            </div>
          ))}
          <span className="text-muted-foreground/30 text-xs mx-1">|</span>
          <span className="text-xs text-muted-foreground/70 font-medium">
            5 item rarity tiers · provably fair case opening site
          </span>
        </div>
      </div>

      {/* ── CTA strip ────────────────────────────────────── */}
      {!user && (
        <section className="border-t border-border/40 bg-card/30">
          <div className="max-w-2xl mx-auto px-4 py-14 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              👇🤑 Start Opening Cases boss.. 👇🤑
            </h2>
            <p className="text-muted-foreground mb-6 text-sm md:text-base">
              Create a free account right now. No email required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="gap-2 font-bold shadow-lg shadow-primary/20"
                asChild
              >
                <NextLink href="/register">
                  Create Account <ChevronRight size={16} />
                </NextLink>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <NextLink href="/leaderboard">View Leaderboard</NextLink>
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
