import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import {
  useGetAdminCachePricing,
  useUpdateAdminCachePricing,
  getGetAdminCachePricingQueryKey,
} from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Loader2, RotateCcw, Save, Info } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"

export default function AdminCachePricing() {
  return (
    <AuthGuard requireAdmin>
      <Shell>
        <AdminCachePricingContent />
      </Shell>
    </AuthGuard>
  )
}

function AdminCachePricingContent() {
  const { data: pricing, isLoading } = useGetAdminCachePricing()
  const updatePricing = useUpdateAdminCachePricing()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [writeInput, setWriteInput] = React.useState("")
  const [readInput, setReadInput] = React.useState("")
  const [initialized, setInitialized] = React.useState(false)

  // Pre-fill the form once the current configuration arrives.
  React.useEffect(() => {
    if (pricing && !initialized) {
      setWriteInput(pricing.cacheWriteCostPerMtok != null ? String(pricing.cacheWriteCostPerMtok) : "")
      setReadInput(pricing.cacheReadCostPerMtok != null ? String(pricing.cacheReadCostPerMtok) : "")
      setInitialized(true)
    }
  }, [pricing, initialized])

  const parseInput = (raw: string, name: string): number | null | undefined => {
    const trimmed = raw.trim()
    if (trimmed === "") return null
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0) {
      toast({ title: `${name} must be a non-negative number`, variant: "destructive" })
      return undefined
    }
    return n
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const write = parseInput(writeInput, "Cache write price")
    const read = parseInput(readInput, "Cache read price")
    if (write === undefined || read === undefined) return

    updatePricing.mutate(
      { data: { cacheWriteCostPerMtok: write, cacheReadCostPerMtok: read } },
      {
        onSuccess: () => {
          toast({ title: "Cache pricing updated" })
          queryClient.invalidateQueries({ queryKey: getGetAdminCachePricingQueryKey() })
          setInitialized(false)
        },
        onError: () => toast({ title: "Error updating cache pricing", variant: "destructive" }),
      },
    )
  }

  const handleReset = () => {
    updatePricing.mutate(
      { data: { cacheWriteCostPerMtok: null, cacheReadCostPerMtok: null } },
      {
        onSuccess: () => {
          toast({ title: "Cache pricing reset to provider defaults" })
          queryClient.invalidateQueries({ queryKey: getGetAdminCachePricingQueryKey() })
          setWriteInput("")
          setReadInput("")
          setInitialized(false)
        },
        onError: () => toast({ title: "Error resetting cache pricing", variant: "destructive" }),
      },
    )
  }

  const writeMultiplier = pricing?.defaults.writeMultiplier ?? 1.25
  const readMultiplier = pricing?.defaults.readMultiplier ?? 0.1

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-sidebar/10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight font-mono text-primary flex items-center gap-3">
          <Zap className="h-6 w-6 md:h-8 md:w-8" />
          Cache Pricing
        </h1>
        <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider hidden sm:block">
          Prompt-cache write / read rates per million tokens
        </p>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="rounded-none border-2 shadow-lg lg:col-span-2">
          <CardHeader className="border-b bg-background">
            <CardTitle className="font-mono uppercase tracking-wider text-sm">Custom Rates</CardTitle>
            <CardDescription className="font-mono text-xs">
              Leave a field empty to bill that operation at the provider-standard percentage of the
              model's base input price.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 bg-background">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cache-write" className="font-mono text-xs uppercase tracking-wider">
                        Cache Write / Mtok
                      </Label>
                      {pricing?.cacheWriteCostPerMtok != null ? (
                        <Badge className="rounded-none font-mono text-[9px] uppercase bg-primary/15 text-primary border border-primary/30">Custom</Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-none font-mono text-[9px] uppercase">Default</Badge>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
                      <Input
                        id="cache-write"
                        type="number"
                        min="0"
                        step="any"
                        value={writeInput}
                        onChange={(e) => setWriteInput(e.target.value)}
                        placeholder={`${writeMultiplier}× base input price`}
                        className="rounded-none border-2 font-mono text-sm pl-7 bg-background"
                      />
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Default: {writeMultiplier}× the model's input price (Anthropic standard, 5-min TTL)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cache-read" className="font-mono text-xs uppercase tracking-wider">
                        Cache Read / Mtok
                      </Label>
                      {pricing?.cacheReadCostPerMtok != null ? (
                        <Badge className="rounded-none font-mono text-[9px] uppercase bg-primary/15 text-primary border border-primary/30">Custom</Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-none font-mono text-[9px] uppercase">Default</Badge>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
                      <Input
                        id="cache-read"
                        type="number"
                        min="0"
                        step="any"
                        value={readInput}
                        onChange={(e) => setReadInput(e.target.value)}
                        placeholder={`${readMultiplier}× base input price`}
                        className="rounded-none border-2 font-mono text-sm pl-7 bg-background"
                      />
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      Default: {readMultiplier}× the model's input price (Anthropic standard)
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={updatePricing.isPending}
                    className="rounded-none font-mono text-xs uppercase tracking-wider"
                  >
                    {updatePricing.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Pricing
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={updatePricing.isPending || (pricing?.cacheWriteCostPerMtok == null && pricing?.cacheReadCostPerMtok == null)}
                    className="rounded-none border-2 font-mono text-xs uppercase tracking-wider"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Defaults
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-2 shadow-lg">
          <CardHeader className="border-b bg-background">
            <CardTitle className="font-mono uppercase tracking-wider text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> How It Applies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 bg-background space-y-4 font-mono text-xs text-muted-foreground leading-relaxed">
            <p>
              Cached requests are billed from their token breakdown:
              <span className="text-foreground"> uncached input × input price</span> +
              <span className="text-amber-600 dark:text-amber-400"> cache writes × write rate</span> +
              <span className="text-emerald-600 dark:text-emerald-400"> cache reads × read rate</span> +
              <span className="text-foreground"> output × output price</span>.
            </p>
            <p>
              Rates set here apply platform-wide, to every model, and take effect on the next
              request — no restart required.
            </p>
            <p>
              Clients opt into automatic caching with the
              <span className="text-primary"> cacheAtDepth </span>
              request parameter, or place manual <span className="text-primary">cache_control</span>
              blocks in their messages. Both can be used together.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
