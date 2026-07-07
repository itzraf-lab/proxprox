import * as React from "react"
import { Shell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"
import { Activity, Shield, Zap, Terminal } from "lucide-react"

export default function Home() {
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="relative isolate overflow-hidden bg-background border-b">
          <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:flex lg:px-8 lg:py-40">
            <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
              <div className="mt-24 sm:mt-32 lg:mt-16">
                <a href="#" className="inline-flex space-x-6 border px-3 py-1 rounded-full text-xs font-semibold">
                  <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-full">v0.1.0-beta</span>
                  <span className="text-muted-foreground flex items-center">
                    System operations active
                  </span>
                </a>
              </div>
              <h1 className="mt-10 text-4xl font-bold tracking-tight text-foreground sm:text-6xl uppercase">
                Precision AI <br/>
                <span className="text-primary">Control Center</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted-foreground font-mono">
                Self-hosted proxy for unified AI model access. Manage API keys, route requests, track Qredit usage, and monitor provider performance from a single interface.
              </p>
              <div className="mt-10 flex items-center gap-x-6">
                <Button asChild size="lg" className="rounded-none font-mono uppercase tracking-wider">
                  <Link href="/register">Initialize System</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-none font-mono uppercase tracking-wider">
                  <Link href="/models">Explore Models</Link>
                </Button>
              </div>
            </div>
            <div className="mx-auto mt-16 flex max-w-2xl sm:mt-24 lg:ml-10 lg:mr-0 lg:mt-0 lg:max-w-none lg:flex-none xl:ml-32">
              <div className="max-w-3xl flex-none sm:max-w-5xl lg:max-w-none">
                <div className="rounded-md bg-sidebar/50 border p-2 ring-1 ring-inset ring-sidebar-border lg:rounded-2xl lg:p-4 w-[600px]">
                  <div className="rounded-md bg-card p-6 border shadow-2xl">
                    <div className="flex items-center justify-between border-b pb-4 mb-4">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-destructive"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">TERMINAL</div>
                    </div>
                    <pre className="text-sm font-mono text-foreground overflow-hidden">
                      <code className="block text-primary mb-2">$ curl -X POST https://qillin.local/v1/chat/completions \</code>
                      <code className="block ml-4 text-muted-foreground">-H "Authorization: Bearer sk-qillin-..." \</code>
                      <code className="block ml-4 text-muted-foreground">-H "Content-Type: application/json" \</code>
                      <code className="block ml-4 text-muted-foreground">-d '{'{'}</code>
                      <code className="block ml-8 text-muted-foreground">"model": "gpt-4o",</code>
                      <code className="block ml-8 text-muted-foreground">"messages": [...]</code>
                      <code className="block ml-4 text-muted-foreground">{'}'}'</code>
                      <code className="block text-emerald-500 mt-4">200 OK</code>
                      <code className="block text-muted-foreground mt-2">{'// Routed to optimal provider'}</code>
                      <code className="block text-muted-foreground">{'// Cost: 0.0042 Qr'}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8 border-t border-border/50">
          <div className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            <div className="flex flex-col border p-6 bg-card">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground font-mono uppercase">
                <Shield className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                Key Management
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                <p className="flex-auto">Issue isolated API keys for teams and microservices. Revoke access instantly. Set strict budgets in Qredits.</p>
              </dd>
            </div>
            <div className="flex flex-col border p-6 bg-card">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground font-mono uppercase">
                <Zap className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                Smart Routing
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                <p className="flex-auto">Load balance across multiple provider accounts. Fallback automatically on rate limits. Standardize on the OpenAI API spec.</p>
              </dd>
            </div>
            <div className="flex flex-col border p-6 bg-card">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground font-mono uppercase">
                <Activity className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                Cost Tracking
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                <p className="flex-auto">Every token tracked and converted to Qredits (1 Qr = $1). Pinpoint exact spend per model, key, and user.</p>
              </dd>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}
