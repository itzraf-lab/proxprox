import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { customFetch } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { getGetMeQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "wouter"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  QrCode,
  RefreshCw,
  Wallet,
  XCircle,
} from "lucide-react"

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")

// Rp 16.000 = $1 top-up = 2 Qr (mirrors TOPUP_IDR_PER_QREDIT on the server).
const IDR_PER_QREDIT = 8000

const PRESETS = [16_000, 40_000, 80_000, 160_000, 400_000]

interface Topup {
  id: string
  amountIdr: number
  qredits: number
  status: "pending" | "paid" | "expired" | "failed"
  qrImageUrl: string | null
  createdAt: string
  expiresAt: string | null
  paidAt: string | null
  payerIssuer: string | null
}

function formatIdr(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`
}

function formatQr(qredits: number) {
  return `${formatCurrency(qredits).replace(/\.?0+$/, "")} Qr`
}

export default function TopUp() {
  return (
    <AuthGuard>
      <Shell>
        <TopUpContent />
      </Shell>
    </AuthGuard>
  )
}

function TopUpContent() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selected, setSelected] = React.useState<number | null>(80_000)
  const [custom, setCustom] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [active, setActive] = React.useState<Topup | null>(null)
  const [history, setHistory] = React.useState<Topup[]>([])

  const amountIdr = selected ?? (Number(custom.replace(/[^\d]/g, "")) || 0)

  const loadHistory = React.useCallback(async () => {
    try {
      const res = await customFetch(`${API_BASE}/api/topup`)
      if (res.ok) setHistory(await res.json())
    } catch {
      // history is best-effort; the create flow below reports its own errors
    }
  }, [])

  React.useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await customFetch(`${API_BASE}/api/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountIdr }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't create top-up",
          description: body?.error ?? `HTTP ${res.status}`,
        })
        return
      }
      setActive(body)
      loadHistory()
    } catch {
      toast({ variant: "destructive", title: "Network error", description: "Please try again." })
    } finally {
      setCreating(false)
    }
  }

  const handleDone = React.useCallback(() => {
    setActive(null)
    setSelected(80_000)
    setCustom("")
    loadHistory()
    // Refresh the balance shown in the dashboard/shell.
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() })
  }, [loadHistory, queryClient])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <Button asChild variant="ghost" size="sm" className="rounded-none font-mono uppercase tracking-wider -ml-3">
          <Link href="/pricing">
            <ArrowLeft className="mr-2 h-4 w-4" /> Pricing
          </Link>
        </Button>

        <h1 className="mt-6 text-3xl font-bold uppercase tracking-widest text-foreground sm:text-4xl">
          Top Up <span className="text-primary">Qredits</span>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-7">
          Pay with any QRIS app (GoPay, OVO, Dana, mobile banking).{" "}
          <span className="text-foreground">$1 = 2 Qr = {formatIdr(16_000)}</span> — every top-up
          doubles.
        </p>

        {active ? (
          <PaymentPanel topup={active} onDone={handleDone} onExpired={loadHistory} />
        ) : (
          <div className="mt-10 border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-3 font-mono text-sm font-semibold uppercase tracking-wider text-primary">
              <Wallet className="h-5 w-5" /> Choose an amount
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setSelected(preset)
                    setCustom("")
                  }}
                  className={`border p-4 text-left transition-colors ${
                    selected === preset
                      ? "border-primary bg-primary/5"
                      : "bg-background hover:border-foreground/40"
                  }`}
                >
                  <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    Pay
                  </div>
                  <div className="mt-1 text-lg font-bold text-foreground">{formatIdr(preset)}</div>
                  <div className="mt-2 font-mono text-xs uppercase tracking-widest text-primary">
                    +{formatQr(preset / IDR_PER_QREDIT)}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6">
              <Label htmlFor="custom-amount" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Or enter a custom amount (IDR)
              </Label>
              <Input
                id="custom-amount"
                inputMode="numeric"
                placeholder="e.g. 100000"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value)
                  setSelected(null)
                }}
                className="mt-2 rounded-none font-mono"
              />
              {selected === null && amountIdr > 0 && (
                <p className="mt-2 font-mono text-xs uppercase tracking-widest text-primary">
                  You'll receive {formatQr(amountIdr / IDR_PER_QREDIT)}
                </p>
              )}
            </div>

            <Button
              size="lg"
              disabled={creating || amountIdr < 8_000}
              onClick={handleCreate}
              className="mt-8 w-full rounded-none font-mono uppercase tracking-wider"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating QRIS…
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" /> Generate QRIS for {formatIdr(amountIdr)}
                </>
              )}
            </Button>
            {amountIdr > 0 && amountIdr < 8_000 && (
              <p className="mt-3 text-center font-mono text-xs uppercase tracking-widest text-destructive">
                Minimum top-up is {formatIdr(8_000)} (1 Qr)
              </p>
            )}
          </div>
        )}

        {history.length > 0 && !active && (
          <div className="mt-10">
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent top-ups
            </h2>
            <div className="mt-4 divide-y border bg-card">
              {history.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <div>
                    <span className="font-mono font-semibold text-foreground">{formatIdr(t.amountIdr)}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      +{formatQr(t.qredits)}
                    </span>
                  </div>
                  <TopupStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TopupStatusBadge({ status }: { status: Topup["status"] }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5" /> Paid
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-amber-500">
        <Clock className="h-3.5 w-3.5" /> Pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
      <XCircle className="h-3.5 w-3.5" /> {status}
    </span>
  )
}

const POLL_INTERVAL_MS = 8_000

function PaymentPanel({
  topup,
  onDone,
  onExpired,
}: {
  topup: Topup
  onDone: () => void
  onExpired: () => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [current, setCurrent] = React.useState(topup)
  const [qrObjectUrl, setQrObjectUrl] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(false)
  const [secondsLeft, setSecondsLeft] = React.useState(() =>
    Math.max(0, Math.floor((Date.parse(topup.expiresAt ?? "") - Date.now()) / 1000)),
  )

  // Load the QR image through customFetch (it needs the Authorization header)
  // and hand it to <img> as an object URL.
  React.useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    ;(async () => {
      try {
        const res = await customFetch(`${API_BASE}${topup.qrImageUrl}`)
        if (!res.ok) throw new Error()
        const blob = await res.blob()
        if (cancelled) return
        revoked = URL.createObjectURL(blob)
        setQrObjectUrl(revoked)
      } catch {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "Couldn't load the QR code",
            description: "Try creating the top-up again.",
          })
        }
      }
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topup.id])

  // Countdown to expiry.
  React.useEffect(() => {
    if (current.status !== "pending") return
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((Date.parse(current.expiresAt ?? "") - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(timer)
  }, [current.status, current.expiresAt])

  const checkStatus = React.useCallback(
    async (manual = false) => {
      if (manual) setChecking(true)
      try {
        const res = await customFetch(`${API_BASE}/api/topup/${topup.id}`)
        if (!res.ok) return
        const body: Topup = await res.json()
        setCurrent(body)
        if (body.status === "paid") {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() })
        }
      } catch {
        // transient network error — next poll retries
      } finally {
        if (manual) setChecking(false)
      }
    },
    [topup.id, queryClient],
  )

  // Auto-poll while pending.
  React.useEffect(() => {
    if (current.status !== "pending") return
    const timer = setInterval(() => checkStatus(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [current.status, checkStatus])

  // Tell the parent when the QR lapses so the history list stays accurate.
  React.useEffect(() => {
    if (current.status === "expired") onExpired()
  }, [current.status, onExpired])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const ss = String(secondsLeft % 60).padStart(2, "0")

  if (current.status === "paid") {
    return (
      <div className="mt-10 border bg-card p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden="true" />
        <h2 className="mt-6 text-2xl font-bold uppercase tracking-widest text-foreground sm:text-3xl">
          Payment received
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          <span className="font-mono font-semibold text-primary">+{formatQr(current.qredits)}</span>{" "}
          has been added to your balance
          {current.payerIssuer ? ` — paid via ${current.payerIssuer}` : ""}.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" className="rounded-none font-mono uppercase tracking-wider">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onDone}
            className="rounded-none font-mono uppercase tracking-wider"
          >
            Top Up Again
          </Button>
        </div>
      </div>
    )
  }

  if (current.status === "expired") {
    return (
      <div className="mt-10 border bg-card p-8 text-center sm:p-10">
        <XCircle className="mx-auto h-14 w-14 text-destructive" aria-hidden="true" />
        <h2 className="mt-6 text-2xl font-bold uppercase tracking-widest text-foreground sm:text-3xl">
          QRIS expired
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          The 5-minute window closed before payment arrived. Nothing was charged — generate a new
          code when you're ready.
        </p>
        <Button
          size="lg"
          onClick={onDone}
          className="mt-8 rounded-none font-mono uppercase tracking-wider"
        >
          Create New QRIS
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-10 border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Scan to pay
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground">{formatIdr(current.amountIdr)}</div>
          <div className="font-mono text-xs uppercase tracking-widest text-primary">
            You'll receive {formatQr(current.qredits)}
          </div>
        </div>
        <div className="border px-4 py-2 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Expires in
          </div>
          <div className={`font-mono text-xl font-bold ${secondsLeft < 60 ? "text-destructive" : "text-foreground"}`}>
            {mm}:{ss}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center border bg-white p-4">
        {qrObjectUrl ? (
          <img src={qrObjectUrl} alt="QRIS payment code" className="h-64 w-64" />
        ) : (
          <div className="flex h-64 w-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Open GoPay, OVO, Dana, or your mobile-banking app and scan this code. It works with any
        QRIS-compatible app.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-amber-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for payment — checking
          automatically every 8s
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={() => checkStatus(true)}
          className="rounded-none font-mono uppercase tracking-wider"
        >
          {checking ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          I've paid — check now
        </Button>
      </div>
    </div>
  )
}
