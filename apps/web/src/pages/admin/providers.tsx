import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminProviders, useDeleteAdminProvider, getGetAdminProvidersQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Server, Plus, Trash2, KeyRound, Workflow, Zap, CheckSquare, Square,
  Database, DollarSign, Link, ChevronDown, ChevronRight, AlertTriangle, Globe
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { ProviderInputType, ProviderInputLoadBalancing } from "@workspace/api-client-react"
import { getToken } from "@/lib/api"

interface FetchedModelInfo {
  id: string
  name: string
  contextWindow: number | null
  inputCostPerMtok: number | null
  outputCostPerMtok: number | null
  metaSource: "known" | "provider" | "unknown"
}

/** One API key entry within a base URL */
interface KeyEntry {
  key: string
  label: string
  priority: number
}

/** One base URL entry within the cluster */
interface BaseUrlEntry {
  url: string
  priority: number
  keys: KeyEntry[]
}

/** One manually-typed model entry */
interface ManualModelEntry {
  modelId: string
}

function fmtCtx(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function fmtPrice(n: number | null): string {
  if (n == null) return "—"
  if (n === 0) return "free"
  return `$${n % 1 === 0 ? n.toFixed(2) : n.toString()}`
}

function defaultBaseUrlEntry(priority = 1): BaseUrlEntry {
  return { url: "", priority, keys: [{ key: "", label: "", priority: 1 }] }
}

export default function AdminProviders() {
  return (
    <AuthGuard requireAdmin>
      <Shell>
        <AdminProvidersContent />
      </Shell>
    </AuthGuard>
  )
}

function AdminProvidersContent() {
  const { data: providers, isLoading } = useGetAdminProviders()
  const deleteProvider = useDeleteAdminProvider()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const handleDelete = (id: string) => {
    if (!confirm("Remove this provider? Associated models will go offline.")) return
    deleteProvider.mutate({ providerId: id }, {
      onSuccess: () => {
        toast({ title: "Provider eliminated" })
        queryClient.invalidateQueries({ queryKey: getGetAdminProvidersQueryKey() })
      },
      onError: () => toast({ title: "Error", variant: "destructive" })
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-sidebar/10">
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight font-mono text-primary flex items-center gap-3">
            <Server className="h-6 w-6 md:h-8 md:w-8" />
            Providers
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider hidden sm:block">
            Configure API clusters with multiple endpoints and keys
          </p>
        </div>
        <AddProviderDialog />
      </div>

      {isLoading ? (
        <div className="text-center py-12 font-mono text-muted-foreground text-sm">Fetching provider configs...</div>
      ) : providers?.length === 0 ? (
        <Card className="rounded-none border-2 border-dashed bg-transparent">
          <CardContent className="p-8 md:p-12 text-center text-muted-foreground font-mono text-sm">
            No providers configured. System cannot route requests.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:gap-6">
          {providers?.map(provider => (
            <Card key={provider.id} className="rounded-none border-2 shadow-lg overflow-hidden group">
              <CardHeader className="bg-background border-b pb-4 px-4 md:px-6 flex flex-row items-start justify-between space-y-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={provider.isActive ? "success" : "secondary"} className="rounded-none font-mono text-[10px] uppercase">
                      {provider.isActive ? 'Active' : 'Offline'}
                    </Badge>
                    <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase border-primary text-primary">
                      {provider.type}
                    </Badge>
                    <Badge variant="secondary" className="rounded-none font-mono text-[10px] uppercase">
                      {provider.baseUrls.length} endpoint{provider.baseUrls.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg md:text-xl font-mono uppercase tracking-wider truncate">{provider.name}</CardTitle>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => handleDelete(provider.id)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-none shrink-0 ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0 bg-sidebar/20 flex flex-col sm:flex-row">
                {/* Cluster endpoint hierarchy */}
                <div className="flex-1 p-4 md:p-6 border-b sm:border-b-0 sm:border-r">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Globe className="h-3 w-3" /> Cluster Endpoints
                  </h4>
                  <div className="space-y-3">
                    {provider.baseUrls.map((bu, buIdx) => (
                      <div key={bu.id} className="border bg-background">
                        <div className="flex items-center gap-2 p-2 border-b bg-sidebar/10">
                          <Badge variant="outline" className="rounded-none font-mono text-[9px] shrink-0">
                            EP{buIdx + 1}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                            {bu.url || <span className="italic opacity-60">default endpoint</span>}
                          </span>
                          <span className="font-mono text-[9px] text-muted-foreground shrink-0">P{bu.priority}</span>
                        </div>
                        <div className="p-2 space-y-1">
                          {bu.keys.map(key => (
                            <div key={key.id} className="flex items-center justify-between gap-2 pl-4 border-l-2 border-primary/20">
                              <div className="min-w-0 flex items-center gap-2">
                                <KeyRound className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                                <span className="font-mono text-xs truncate">{key.keyMasked}</span>
                                {key.label && <span className="font-mono text-[9px] text-muted-foreground uppercase">{key.label}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {key.failCount > 0 && <span className="text-[10px] font-mono text-destructive">FAILS:{key.failCount}</span>}
                                <Badge variant="secondary" className="rounded-none font-mono text-[9px]">P{key.priority}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Routing + model count */}
                <div className="w-full sm:w-48 md:w-56 p-4 md:p-6 bg-background">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <Workflow className="h-3 w-3" /> Routing
                  </h4>
                  <div className="text-sm font-mono uppercase font-bold mb-4">
                    {provider.loadBalancing.replace('_', ' ')}
                  </div>
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-2">
                    <Zap className="h-3 w-3" /> Models
                  </h4>
                  <div className="text-sm font-mono">
                    <span className="font-bold text-primary">{provider.modelCount}</span> exposed
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add Provider Dialog ───────────────────────────────────────────────────────

function AddProviderDialog() {
  const [open, setOpen] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState<number | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<ProviderInputType>('openai')
  const [lb, setLb] = React.useState<ProviderInputLoadBalancing>('round_robin')
  const [baseUrls, setBaseUrls] = React.useState<BaseUrlEntry[]>([defaultBaseUrlEntry(1)])

  // Auto-detect state
  const [fetchedModels, setFetchedModels] = React.useState<FetchedModelInfo[] | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [testError, setTestError] = React.useState<string | null>(null)
  const [expandedBu, setExpandedBu] = React.useState<Set<number>>(new Set([0]))

  // Manual model entry state
  const [manualModels, setManualModels] = React.useState<ManualModelEntry[]>([])
  const [showManual, setShowManual] = React.useState(false)

  const reset = () => {
    setName(""); setType('openai'); setLb('round_robin')
    setBaseUrls([defaultBaseUrlEntry(1)])
    setFetchedModels(null); setSelectedIds(new Set()); setTestError(null)
    setExpandedBu(new Set([0]))
    setManualModels([]); setShowManual(false)
  }

  // ── Base URL management ───────────────────────────────────────────────────

  const addBaseUrl = () => {
    const next = [...baseUrls, defaultBaseUrlEntry(baseUrls.length + 1)]
    setBaseUrls(next)
    setExpandedBu(prev => new Set([...prev, next.length - 1]))
  }

  const removeBaseUrl = (idx: number) => {
    setBaseUrls(baseUrls.filter((_, i) => i !== idx))
    setExpandedBu(prev => {
      const next = new Set<number>()
      prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1) })
      return next
    })
  }

  const updateBaseUrl = (idx: number, field: keyof BaseUrlEntry, value: any) => {
    const next = [...baseUrls]
    next[idx] = { ...next[idx], [field]: value }
    setBaseUrls(next)
  }

  // ── Key management within a base URL ─────────────────────────────────────

  const addKey = (buIdx: number) => {
    const next = [...baseUrls]
    next[buIdx] = {
      ...next[buIdx],
      keys: [...next[buIdx].keys, { key: "", label: "", priority: next[buIdx].keys.length + 1 }]
    }
    setBaseUrls(next)
  }

  const updateKey = (buIdx: number, kIdx: number, field: keyof KeyEntry, value: any) => {
    const next = [...baseUrls]
    const keys = [...next[buIdx].keys]
    keys[kIdx] = { ...keys[kIdx], [field]: value }
    next[buIdx] = { ...next[buIdx], keys }
    setBaseUrls(next)
  }

  const removeKey = (buIdx: number, kIdx: number) => {
    const next = [...baseUrls]
    next[buIdx] = { ...next[buIdx], keys: next[buIdx].keys.filter((_, i) => i !== kIdx) }
    setBaseUrls(next)
  }

  // ── Auto-detect: test connection and fetch model list ─────────────────────

  const handleFetchModels = async (buIdx: number) => {
    const bu = baseUrls[buIdx]
    if (!bu.keys[0]?.key) { toast({ title: "API key required", variant: "destructive" }); return }
    if (type === 'custom' && !bu.url) { toast({ title: "Base URL required for this endpoint", variant: "destructive" }); return }
    setIsTesting(buIdx); setFetchedModels(null); setSelectedIds(new Set()); setTestError(null)
    try {
      const token = getToken()
      const res = await fetch('/api/admin/providers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ type, baseUrl: type === 'custom' ? bu.url : undefined, apiKey: bu.keys[0].key }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTestError(data?.error ?? 'Connection failed')
        toast({ title: "Connection failed", variant: "destructive" })
      } else {
        setFetchedModels(data)
        setSelectedIds(new Set(data.map((m: FetchedModelInfo) => m.id)))
        toast({ title: `Found ${data.length} model${data.length !== 1 ? 's' : ''}` })
      }
    } catch (err: any) {
      setTestError(err.message ?? 'Network error')
      toast({ title: "Failed to connect", variant: "destructive" })
    } finally {
      setIsTesting(null)
    }
  }

  // ── Auto-detect: model selection ──────────────────────────────────────────

  const toggleModel = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (!fetchedModels) return
    setSelectedIds(
      selectedIds.size === fetchedModels.length
        ? new Set()
        : new Set(fetchedModels.map(m => m.id))
    )
  }

  const allSelected = fetchedModels != null && selectedIds.size === fetchedModels.length

  // ── Manual model entry ────────────────────────────────────────────────────

  const addManualModel = () => {
    setManualModels(prev => [...prev, { modelId: '' }])
    setShowManual(true)
  }

  const updateManualModel = (idx: number, modelId: string) =>
    setManualModels(prev => prev.map((m, i) => i === idx ? { modelId } : m))

  const removeManualModel = (idx: number) =>
    setManualModels(prev => prev.filter((_, i) => i !== idx))

  // ── Submission ────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    for (const bu of baseUrls) {
      if (bu.keys.some(k => !k.key.trim())) {
        toast({ title: "All API key fields must be filled in", variant: "destructive" }); return
      }
      if (type === 'custom' && !bu.url.trim()) {
        toast({ title: "All endpoints must have a URL for custom providers", variant: "destructive" }); return
      }
    }

    // Combine auto-detected (selected) + manual entries
    const autoModels = fetchedModels?.filter(m => selectedIds.has(m.id)) ?? []
    const validManual = manualModels.filter(m => m.modelId.trim() !== '')

    // Deduplicate: manual entries override auto-detected ones with same id
    const manualIds = new Set(validManual.map(m => m.modelId.trim()))
    const deduped = autoModels.filter(m => !manualIds.has(m.id))
    const combined = [
      ...deduped,
      ...validManual.map(m => ({ id: m.modelId.trim() })),
    ]

    setIsSaving(true)
    try {
      const token = getToken()
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          name,
          type,
          loadBalancing: lb,
          baseUrls: baseUrls.map(bu => ({
            url: type === 'custom' ? bu.url : null,
            priority: bu.priority,
            keys: bu.keys.filter(k => k.key.trim() !== '').map(k => ({
              key: k.key,
              label: k.label || undefined,
              priority: k.priority,
            })),
          })),
          models: combined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data?.error ?? "Failed to create provider", variant: "destructive" })
      } else {
        toast({ title: `Provider created with ${combined.length} model${combined.length !== 1 ? 's' : ''}` })
        queryClient.invalidateQueries({ queryKey: getGetAdminProvidersQueryKey() })
        setOpen(false); reset()
      }
    } catch (err: any) {
      toast({ title: err.message ?? "Network error", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // ── Derived counts ────────────────────────────────────────────────────────

  const autoCount = fetchedModels ? selectedIds.size : 0
  const manualCount = manualModels.filter(m => m.modelId.trim()).length
  const totalCount = autoCount + manualCount

  const isCustom = type === 'custom'

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button className="rounded-none font-mono uppercase tracking-wider shrink-0">
          <Plus className="mr-1.5 w-4 h-4" /> <span className="hidden sm:inline">Add </span>Provider
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl rounded-none border-2 max-h-[92vh] overflow-y-auto p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-lg">Integrate Provider Cluster</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {/* Left — cluster config */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Provider Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required
                  className="rounded-none bg-sidebar/10 font-mono" placeholder="e.g. OpenRouter Cluster" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Type</Label>
                  <Select value={type} onValueChange={(v) => {
                    setType(v as ProviderInputType)
                    setFetchedModels(null); setSelectedIds(new Set())
                  }}>
                    <SelectTrigger className="rounded-none bg-sidebar/10 font-mono text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none border-2">
                      <SelectItem value="openai" className="font-mono">OpenAI</SelectItem>
                      <SelectItem value="anthropic" className="font-mono">Anthropic</SelectItem>
                      <SelectItem value="custom" className="font-mono">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Routing</Label>
                  <Select value={lb} onValueChange={(v) => setLb(v as ProviderInputLoadBalancing)}>
                    <SelectTrigger className="rounded-none bg-sidebar/10 font-mono text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none border-2">
                      <SelectItem value="round_robin" className="font-mono">Round Robin</SelectItem>
                      <SelectItem value="priority" className="font-mono">Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cluster endpoints */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Globe className="h-3 w-3" /> Cluster Endpoints
                  </Label>
                  <Button type="button" variant="outline" size="sm"
                    className="rounded-none font-mono text-[10px] uppercase h-6 px-2"
                    onClick={addBaseUrl}>
                    <Plus className="w-3 h-3 mr-1" /> Endpoint
                  </Button>
                </div>

                {baseUrls.length > 1 && (
                  <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <p className="font-mono text-[10px] leading-relaxed">
                      All endpoints in a cluster must expose the <strong>exact same model IDs</strong>. LiteLLM will load-balance and fail-over across endpoints.
                    </p>
                  </div>
                )}

                <div className="space-y-2 max-h-[340px] overflow-y-auto">
                  {baseUrls.map((bu, buIdx) => {
                    const isExpanded = expandedBu.has(buIdx)
                    return (
                      <div key={buIdx} className="border bg-background">
                        <div className="flex items-center gap-2 p-2 bg-sidebar/10 border-b">
                          <button type="button" onClick={() => {
                            setExpandedBu(prev => {
                              const next = new Set(prev)
                              isExpanded ? next.delete(buIdx) : next.add(buIdx)
                              return next
                            })
                          }} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                            {isExpanded
                              ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                              : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            <Badge variant="outline" className="rounded-none font-mono text-[9px] shrink-0">EP{buIdx + 1}</Badge>
                            <span className="font-mono text-xs text-muted-foreground truncate">
                              {bu.url || (isCustom ? "no URL set" : "default endpoint")}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground shrink-0 ml-auto mr-1">
                              {bu.keys.length} key{bu.keys.length !== 1 ? 's' : ''}
                            </span>
                          </button>
                          {baseUrls.length > 1 && (
                            <Button type="button" variant="ghost" size="icon"
                              className="h-5 w-5 text-destructive rounded-none shrink-0"
                              onClick={() => removeBaseUrl(buIdx)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="p-2 space-y-2">
                            {isCustom && (
                              <div className="flex gap-2">
                                <div className="flex-1 space-y-1">
                                  <Label className="font-mono text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                                    <Link className="h-2.5 w-2.5" /> Base URL
                                  </Label>
                                  <Input
                                    value={bu.url}
                                    onChange={e => updateBaseUrl(buIdx, 'url', e.target.value)}
                                    placeholder="https://api.example.com/v1"
                                    className="rounded-none h-7 font-mono text-xs"
                                    required={isCustom}
                                  />
                                </div>
                                {lb === 'priority' && (
                                  <div className="w-16 space-y-1">
                                    <Label className="font-mono text-[10px] uppercase text-muted-foreground">Priority</Label>
                                    <Input type="number" min="1" value={bu.priority}
                                      onChange={e => updateBaseUrl(buIdx, 'priority', parseInt(e.target.value) || 1)}
                                      className="rounded-none h-7 font-mono text-xs" />
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="font-mono text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                                  <KeyRound className="h-2.5 w-2.5" /> API Keys
                                </Label>
                                <button type="button"
                                  className="font-mono text-[9px] uppercase text-primary hover:underline flex items-center gap-0.5"
                                  onClick={() => addKey(buIdx)}>
                                  <Plus className="w-2.5 h-2.5" /> Key
                                </button>
                              </div>
                              {bu.keys.map((k, kIdx) => (
                                <div key={kIdx} className="flex gap-1.5 items-start pl-2 border-l-2 border-primary/20">
                                  <div className="flex-1 space-y-1 min-w-0">
                                    <Input
                                      type="password"
                                      value={k.key}
                                      onChange={e => updateKey(buIdx, kIdx, 'key', e.target.value)}
                                      placeholder="sk-..."
                                      required
                                      className="rounded-none h-7 font-mono text-xs"
                                    />
                                    <div className="flex gap-1.5">
                                      <Input
                                        value={k.label}
                                        onChange={e => updateKey(buIdx, kIdx, 'label', e.target.value)}
                                        placeholder="Label (opt)"
                                        className="rounded-none h-6 font-mono text-[10px] flex-1"
                                      />
                                      {lb === 'priority' && (
                                        <Input
                                          type="number" min="1" value={k.priority}
                                          onChange={e => updateKey(buIdx, kIdx, 'priority', parseInt(e.target.value) || 1)}
                                          className="rounded-none h-6 font-mono text-[10px] w-12 shrink-0"
                                          placeholder="P"
                                        />
                                      )}
                                    </div>
                                  </div>
                                  {bu.keys.length > 1 && (
                                    <Button type="button" variant="ghost" size="icon"
                                      className="h-7 w-7 text-destructive rounded-none shrink-0"
                                      onClick={() => removeKey(buIdx, kIdx)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>

                            <Button
                              type="button" variant="secondary" size="sm"
                              className="w-full rounded-none font-mono uppercase text-[10px] h-7"
                              onClick={() => handleFetchModels(buIdx)}
                              disabled={isTesting !== null || !bu.keys[0]?.key}
                            >
                              {isTesting === buIdx
                                ? "Connecting..."
                                : fetchedModels && buIdx === 0
                                  ? "Re-test & Fetch Models"
                                  : "Test Connection & Fetch Models"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {testError && (
                <div className="p-2 bg-destructive/10 border border-destructive/30 text-destructive font-mono text-xs break-all">
                  {testError}
                </div>
              )}
            </div>

            {/* Right — model selection */}
            <div className="md:border-l md:pl-6 flex flex-col border-t md:border-t-0 pt-4 md:pt-0">

              {/* ── Auto-detect section ── */}
              <div className="flex items-center justify-between mb-3">
                <Label className="font-mono text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Zap className="h-3 w-3" /> Models to Expose
                </Label>
                {fetchedModels && fetchedModels.length > 0 && (
                  <button type="button" onClick={toggleAll}
                    className="font-mono text-[10px] uppercase text-muted-foreground hover:text-primary flex items-center gap-1">
                    {allSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                    {allSelected ? "None" : "All"}
                  </button>
                )}
              </div>

              {baseUrls.length > 1 && (
                <p className="font-mono text-[10px] text-muted-foreground mb-2 border-l-2 border-amber-500/40 pl-2">
                  Test any one endpoint — all must share the same model IDs.
                </p>
              )}

              {/* Auto-detect: empty / results */}
              {!fetchedModels ? (
                <div className="flex items-center justify-center border-2 border-dashed p-5 text-center text-muted-foreground font-mono text-xs min-h-[80px]">
                  Test an endpoint above to auto-detect available models
                </div>
              ) : fetchedModels.length === 0 ? (
                <div className="flex items-center justify-center border-2 border-dashed p-5 text-center text-muted-foreground font-mono text-xs min-h-[80px]">
                  No models returned by the provider
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">{selectedIds.size}/{fetchedModels.length} selected</span>
                    <div className="flex gap-2 font-mono text-[10px] text-muted-foreground uppercase">
                      <span className="flex items-center gap-1"><Database className="w-2.5 h-2.5" />Ctx</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-2.5 h-2.5" />In/Out</span>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto mb-3">
                    {fetchedModels.map(m => (
                      <div
                        key={m.id}
                        onClick={() => toggleModel(m.id)}
                        className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors hover:bg-sidebar/20
                          ${selectedIds.has(m.id) ? 'bg-primary/5 border-primary/30' : 'bg-background'}`}
                      >
                        <Checkbox
                          checked={selectedIds.has(m.id)}
                          onCheckedChange={() => toggleModel(m.id)}
                          className="rounded-none shrink-0"
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs font-medium truncate">{m.name}</div>
                          {m.metaSource === 'known' && (
                            <div className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 uppercase">verified</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-right shrink-0">
                          <span className="font-mono text-[10px] text-muted-foreground w-10 text-right">{fmtCtx(m.contextWindow)}</span>
                          <span className="font-mono text-[10px] w-20 text-right hidden sm:block">
                            {m.inputCostPerMtok != null
                              ? `${fmtPrice(m.inputCostPerMtok)}/${fmtPrice(m.outputCostPerMtok)}`
                              : <span className="text-muted-foreground">—</span>}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Manual model entry section ── */}
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 border-t border-dashed" />
                  <button
                    type="button"
                    onClick={() => {
                      if (!showManual) {
                        setShowManual(true)
                        if (manualModels.length === 0) setManualModels([{ modelId: '' }])
                      } else {
                        setShowManual(false)
                      }
                    }}
                    className="font-mono text-[10px] uppercase text-muted-foreground hover:text-primary flex items-center gap-1 shrink-0 px-1"
                  >
                    {showManual ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                    Add manually
                  </button>
                  <div className="flex-1 border-t border-dashed" />
                </div>

                {showManual && (
                  <div className="space-y-2">
                    <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                      Enter exact model IDs the provider uses (e.g.{" "}
                      <span className="text-foreground">llama-3.3-70b</span>,{" "}
                      <span className="text-foreground">deepseek-r1</span>). Useful when the provider
                      has no <code className="text-[9px]">/v1/models</code> endpoint.
                    </p>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {manualModels.map((m, idx) => (
                        <div key={idx} className="flex gap-1.5 items-center">
                          <Input
                            value={m.modelId}
                            onChange={e => updateManualModel(idx, e.target.value)}
                            placeholder="model-id-as-used-by-provider"
                            className="rounded-none h-7 font-mono text-xs flex-1"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <Button type="button" variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive rounded-none shrink-0"
                            onClick={() => removeManualModel(idx)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addManualModel}
                      className="font-mono text-[9px] uppercase text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" /> Add model
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-none font-mono uppercase w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="rounded-none font-mono uppercase w-full sm:w-auto" disabled={isSaving || !name}>
              {isSaving ? "Saving..." : `Commit${totalCount > 0 ? ` (${totalCount})` : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
