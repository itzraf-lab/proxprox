import * as React from "react"
import { Shell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"
import { Coins, ArrowRightLeft, Zap, ShieldCheck, Wallet } from "lucide-react"

const TOP_UPS = [
  { usd: 5, qredits: 10 },
  { usd: 10, qredits: 20 },
  { usd: 25, qredits: 50 },
  { usd: 50, qredits: 100 },
]

export default function Pricing() {
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="border-b bg-background">
          <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground uppercase sm:text-5xl">
              Simple, <span className="text-primary">Transparent</span> Pricing
            </h1>
            <p className="mt-6 text-base sm:text-lg leading-8 text-muted-foreground font-mono max-w-2xl mx-auto">
              No subscriptions. No tiers. No surprises. You top up Qredits, you spend them on AI
              usage — that's the whole model.
            </p>
          </div>
        </div>

        {/* The exchange rate */}
        <div className="border-b bg-sidebar/30">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="border bg-card p-8">
                <div className="flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-wider text-primary">
                  <Coins className="h-5 w-5" /> Spending power
                </div>
                <p className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                  1 Qr = <span className="text-primary">$1 USD</span>
                </p>
                <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-7">
                  One Qredit (Qr) buys exactly one US dollar of AI usage at provider list prices.
                  What you see in the model catalog is what you pay — token for token, no markup
                  games.
                </p>
              </div>
              <div className="border bg-card p-8">
                <div className="flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-wider text-primary">
                  <ArrowRightLeft className="h-5 w-5" /> Topping up
                </div>
                <p className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                  $1 = <span className="text-primary">2 Qr</span>
                </p>
                <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-7">
                  Every dollar you top up is credited as two Qredits. That's a permanent 2× bonus
                  on every deposit — your money goes twice as far, always.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Top-up table */}
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
              What your top-up gets you
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Every top-up doubles. Here are common amounts:
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TOP_UPS.map(({ usd, qredits }) => (
              <div key={usd} className="flex flex-col border p-6 bg-card text-center">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Top up
                </div>
                <div className="mt-2 text-3xl font-bold text-foreground">${usd}</div>
                <div className="my-4 border-t border-dashed" />
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  You receive
                </div>
                <div className="mt-2 text-3xl font-bold text-primary">{qredits} Qr</div>
                <div className="mt-4 font-mono text-[10px] uppercase tracking-widest text-emerald-500">
                  2× bonus applied
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indonesian pricing */}
        <div className="border-t bg-background">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
            <div className="mx-auto max-w-3xl border bg-card p-8 sm:p-10">
              <div className="flex items-center justify-center gap-3 font-mono text-sm font-semibold uppercase tracking-wider text-primary">
                <Wallet className="h-5 w-5" /> For Indonesians
              </div>
              <p className="mt-6 text-center text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                $1 top up = <span className="text-primary">2 Qr</span> = Rp. 16.000
              </p>
              <p className="mt-4 text-center text-sm sm:text-base text-muted-foreground leading-7">
                Top up in Rupiah at a flat, fixed rate — a $1 top-up (credited as 2 Qredits) costs
                only Rp. 16.000. No conversion surprises, no hidden fees.
              </p>
              <div className="mt-8 text-center">
                <Button asChild size="lg" className="rounded-none font-mono uppercase tracking-wider">
                  <Link href="/top-up">Top Up</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Fine print / principles */}
        <div className="border-t bg-sidebar/30">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 flex-none text-primary mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-mono text-sm font-semibold uppercase text-foreground">Pay as you go</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Usage is metered per token and deducted from your Qredit balance in real time.
                    1 Qr of spend always equals $1 USD of AI usage at the model's listed rate.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 flex-none text-primary mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-mono text-sm font-semibold uppercase text-foreground">No lock-in</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Qredits don't expire, there are no monthly minimums, and your full usage history
                    is visible in your request log — down to the last token.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-12 text-center">
              <Button asChild size="lg" className="rounded-none font-mono uppercase tracking-wider">
                <Link href="/register">Create Account &amp; Top Up</Link>
              </Button>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                By topping up you agree to our{" "}
                <Link href="/legal" className="underline hover:text-foreground">
                  Privacy Policy &amp; Terms of Service
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}
