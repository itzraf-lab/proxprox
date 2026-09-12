import * as React from "react"
import { Shell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Link } from "wouter"
import { Construction } from "lucide-react"

export default function TopUp() {
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-24">
          <div className="text-center max-w-lg">
            <Construction className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
            <h1 className="mt-8 text-4xl font-bold uppercase tracking-widest text-foreground sm:text-5xl">
              W.I.P
            </h1>
            <p className="mt-4 font-mono text-sm uppercase tracking-widest text-muted-foreground">
              Work in progress
            </p>
            <p className="mt-6 text-base leading-7 text-muted-foreground">
              The top-up flow isn't ready yet. In the meantime, reach out on Discord{" "}
              <span className="font-mono text-foreground">iraa.dakilla</span> or email{" "}
              <a href="mailto:eruudev4@gmail.com" className="underline hover:text-foreground">
                eruudev4@gmail.com
              </a>{" "}
              and we'll get you topped up manually.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="rounded-none font-mono uppercase tracking-wider">
                <Link href="/pricing">Back to Pricing</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-none font-mono uppercase tracking-wider">
                <Link href="/">Home</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  )
}
