import * as React from "react"
import { Shell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"
import { Activity, EyeOff, KeyRound, Mail, MessageCircle, Route, ShieldCheck, Terminal } from "lucide-react"
import { ComplianceBadges } from "@/components/compliance-badges"
import { getOpenAiBaseUrl } from "@/lib/url"

export default function Home() {
  const chatCompletionsUrl = `${getOpenAiBaseUrl()}/chat/completions`
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="relative isolate overflow-hidden bg-background border-b">
          <div className="mx-auto max-w-7xl px-6 pb-16 pt-10 sm:pb-24 lg:flex lg:items-center lg:gap-x-12 lg:px-8 lg:py-32">
            <div className="max-w-2xl lg:max-w-xl lg:flex-1 lg:min-w-0">
              <div className="mt-16 sm:mt-24 lg:mt-16">
                <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-1 rounded-full text-xs font-semibold">
                  <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-full">v0.1.0-beta</span>
                  <span className="text-muted-foreground flex items-center">
                    Zero message logging
                  </span>
                </span>
              </div>
              <h1 className="mt-10 text-4xl font-bold tracking-tight text-foreground sm:text-6xl uppercase">
                One API Key. <br />
                <span className="text-primary">Every LLM.</span>
              </h1>
              <p className="mt-6 text-base sm:text-lg leading-8 text-muted-foreground font-mono">
                One account, one API key, every model you need. Get instant access to leading
                LLMs through a single OpenAI-compatible endpoint — no juggling provider accounts,
                no waiting, no one reading over your shoulder. Built for developers shipping
                production apps and writers running long, uninterrupted creative sessions.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="rounded-none font-mono uppercase tracking-wider">
                  <Link href="/register">Get Your API Key</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-none font-mono uppercase tracking-wider">
                  <Link href="/models">Explore Models</Link>
                </Button>
              </div>
            </div>
            <div className="mt-16 sm:mt-24 lg:mt-0 lg:flex-1 lg:min-w-0">
              <div className="w-full max-w-xl mx-auto lg:mx-0 lg:max-w-[600px] rounded-md bg-sidebar/50 border p-2 ring-1 ring-inset ring-sidebar-border lg:rounded-2xl lg:p-4">
                <div className="rounded-md bg-card p-4 sm:p-6 border shadow-2xl overflow-x-auto">
                  <div className="flex items-center justify-between border-b pb-4 mb-4">
                    <div className="flex gap-2" aria-hidden="true">
                      <div className="w-3 h-3 rounded-full bg-destructive"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">TERMINAL</div>
                  </div>
                  <pre className="text-xs sm:text-sm font-mono text-foreground">
                    <code className="block text-primary mb-2 whitespace-pre">$ curl -X POST {chatCompletionsUrl} \</code>
                    <code className="block ml-4 text-muted-foreground whitespace-pre">-H "Authorization: Bearer sk-qillin-..." \</code>
                    <code className="block ml-4 text-muted-foreground whitespace-pre">-H "Content-Type: application/json" \</code>
                    <code className="block ml-4 text-muted-foreground whitespace-pre">{"-d '{"}</code>
                    <code className="block ml-8 text-muted-foreground whitespace-pre">"model": "any-model-you-configure",</code>
                    <code className="block ml-8 text-muted-foreground whitespace-pre">"messages": [...]</code>
                    <code className="block ml-4 text-muted-foreground whitespace-pre">{"}'"}</code>
                    <code className="block text-emerald-500 mt-4 whitespace-pre">200 OK</code>
                    <code className="block text-muted-foreground mt-2 whitespace-pre">{'// Routed to your configured provider'}</code>
                    <code className="block text-muted-foreground whitespace-pre">{'// Message content: never stored'}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust band */}
        <div className="border-b bg-sidebar/30">
          <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <EyeOff className="h-5 w-5 flex-none text-primary mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-mono text-sm font-semibold uppercase text-foreground">No content logging</p>
                  <p className="mt-1 text-sm text-muted-foreground">Prompts and completions pass through — they're never written to disk or a database.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 flex-none text-primary mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-mono text-sm font-semibold uppercase text-foreground">Private &amp; secure</p>
                  <p className="mt-1 text-sm text-muted-foreground">Your account and API key are isolated from every other user. Nobody else can see your activity.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <KeyRound className="h-5 w-5 flex-none text-primary mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-mono text-sm font-semibold uppercase text-foreground">Your own access key</p>
                  <p className="mt-1 text-sm text-muted-foreground">One key for every model. Revoke or regenerate it instantly, any time, from your dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl lg:max-w-none lg:text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
              Built for how you actually work
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground max-w-2xl lg:mx-auto">
              Whether you're wiring an LLM into a production backend or writing long-form fiction
              and roleplay without a third party reading over your shoulder, Qillin gives you a
              single, standard OpenAI-compatible endpoint you control end to end.
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col border p-6 bg-card">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground font-mono uppercase">
                <Route className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                Any Model, One API
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                <p className="flex-auto">Connect any OpenAI-compatible or Anthropic-compatible provider. Switch or mix models without touching client code.</p>
              </dd>
            </div>
            <div className="flex flex-col border p-6 bg-card">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground font-mono uppercase">
                <KeyRound className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                Your API Key
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                <p className="flex-auto">Generate your key in seconds and drop it into any app. Regenerate or revoke it yourself, any time.</p>
              </dd>
            </div>
            <div className="flex flex-col border p-6 bg-card">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground font-mono uppercase">
                <EyeOff className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                Private by Design
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                <p className="flex-auto">Your messages are never persisted or reviewed by anyone. Only anonymized usage metadata is kept, solely to power your billing.</p>
              </dd>
            </div>
            <div className="flex flex-col border p-6 bg-card">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-foreground font-mono uppercase">
                <Activity className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
                Cost Tracking
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-muted-foreground">
                <p className="flex-auto">Every token you use is tracked and converted to Qredits (1 Qr = $1), so you always know exactly what you've spent.</p>
              </dd>
            </div>
          </dl>
        </div>

        {/* Contact / support */}
        <div className="border-t bg-background">
          <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground uppercase sm:text-4xl">
                Questions &amp; Issues
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Something not working, or just want to ask about plans, models, or billing? Reach
                out directly — a human will answer.
              </p>
            </div>
            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3 border bg-card p-6">
                <MessageCircle className="h-5 w-5 flex-none text-primary mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-mono text-sm font-semibold uppercase text-foreground">Discord</p>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">iraa.dakilla</p>
                </div>
              </div>
              <div className="flex items-start gap-3 border bg-card p-6">
                <Mail className="h-5 w-5 flex-none text-primary mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-mono text-sm font-semibold uppercase text-foreground">Email</p>
                  <a
                    href="mailto:eruudev4@gmail.com"
                    className="mt-1 block font-mono text-sm text-muted-foreground underline hover:text-foreground"
                  >
                    eruudev4@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compliance footer */}
        <footer className="border-t bg-sidebar/30">
          <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
            <div className="mb-8 text-center">
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Enterprise-Grade Compliance &amp; Security
              </h2>
            </div>
            <ComplianceBadges />
            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-sidebar-border pt-6 sm:flex-row">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                © {new Date().getFullYear()} Qillin — AI Proxy Platform
              </p>
              <div className="flex items-center gap-4 font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
                <span aria-hidden="true">·</span>
                <Link href="/legal" className="hover:text-foreground transition-colors">Privacy &amp; Terms</Link>
                <span aria-hidden="true">·</span>
                <span>Zero message logging</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </Shell>
  )
}
