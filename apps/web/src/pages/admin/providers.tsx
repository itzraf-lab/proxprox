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
import {
  Server, Plus, Trash2, KeyRound, Workflow, Zap,
  ChevronDown, ChevronRight, AlertTriangle, Globe, Link, CheckCircle2, XCircle, Loader2
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { ProviderInputType, ProviderInputLoadBalancing } from "@workspace/api-client-react"
import { getToken } from "@/lib/api"

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

/** One manually-specified model */
interface ModelEntry {
  modelId: string
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
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Cluster config
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<ProviderInputType>('openai')
  const [lb, setLb] = React.useState<ProviderInputLoadBalancing>('round_robin')
  const [baseUrls, setBaseUrls] = React.useState<BaseUrlEntry[]>([defaultBaseUrlEntry(1)])
  const [expandedBu, setExpandedBu] = React.useState<Set<number>>(new Set([0]))

  // Per-endpoint test status: 'idle' | 'testing' | 'ok' | 'error'
  const [testStatus, setTestStatus] = React.useState<Record<number, 'testing' | 'ok' | 'error'>>({})
  const [testErrors, setTestErrors] = React.useState<Record<number, string>>({})

  // Manual model list
  const [models, setModels] = React.useState<ModelEntry[]>([{ modelId: '' }])

  const reset = () => {
    setName(""); setType('openai'); setLb('round_robin')
    setBaseUrls([defaultBaseUrlEntry(1)])
    setExpandedBu(new Set([0]))
    setTestStatus({}); setTestErrors({})
    setModels([{ modelId: '' }])
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
    setTestStatus(prev => {
      const next: Record<number, 'testing' | 'ok' | 'error'> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const i = parseInt(k)
        if (i < idx) next[i] = v
        else if (i > idx) next[i - 1] = v
      })
      return next
    })
  }

  const updateBaseUrl = (idx: number, field: keyof BaseUrlEntry, value: any) => {
    const next = [...baseUrls]
    next[idx] = { ...next[idx], [field]: value }
    setBaseUrls(next)
    // Clear test result when URL changes
    if (field === 'url') {
      setTestStatus(prev => { const n = { ...prev }; delete n[idx]; return n })
      setTestErrors(prev => { const n = { ...prev }; delete n[idx]; return n })
    }
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
    // Clear test result when key changes
    if (field === 'key') {
      setTestStatus(prev => { const n = { ...prev }; delete n[buIdx]; return n })
      setTestErrors(prev => { const n = { ...prev }; delete n[buIdx]; return n })
    }
  }

  const removeKey = (buIdx: number, kIdx: number) => {
    const next = [...baseUrls]
    next[buIdx] = { ...next[buIdx], keys: next[buIdx].keys.filter((_, i) => i !== kIdx) }
    setBaseUrls(next)
  }

  // ── Connectivity test (no model fetching) ─────────────────────────────────

  const handleTestConnection = async (buIdx: number) => {
    const bu = baseUrls[buIdx]
    if (!bu.keys[0]?.key) { toast({ title: "API key required to test", variant: "destructive" }); return }
    if (type === 'custom' && !bu.url) { toast({ title: "Base URL required for this endpoint", variant: "destructive" }); return }

    setTestStatus(prev => ({ ...prev, [buIdx]: 'testing' }))
    setTestErrors(prev => { const n = { ...prev }; delete n[buIdx]; return n })

    try {
      const token = getToken()
      const res = await fetch('/api/admin/providers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ type, baseUrl: type === 'custom' ? bu.url : undefined, apiKey: bu.keys[0].key }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTestStatus(prev => ({ ...prev, [buIdx]: 'error' }))
        setTestErrors(prev => ({ ...prev, [buIdx]: data?.error ?? 'Connection failed' }))
      } else {
        setTestStatus(prev => ({ ...prev, [buIdx]: 'ok' }))
      }
    } catch (err: any) {
      setTestStatus(prev => ({ ...prev, [buIdx]: 'error' }))
      setTestErrors(prev => ({ ...prev, [buIdx]: err.message ?? 'Network error' }))
    }
  }

  // ── Model list management ─────────────────────────────────────────────────

  const addModel = () => setModels(prev => [...prev, { modelId: '' }])

  const updateModel = (idx: number, modelId: string) =>
    setModels(prev => prev.map((m, i) => i === idx ? { modelId } : m))

  const removeModel = (idx: number) =>
    setModels(prev => prev.filter((_, i) => i !== idx))

  // ── Submission ────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return

    // Validate endpoints
    for (const bu of baseUrls) {
      if (bu.keys.some(k => !k.key.trim())) {
        toast({ title: "All API key fields must be filled in", variant: "destructive" }); return
      }
      if (type === 'custom' && !bu.url.trim()) {
        toast({ title: "All endpoints must have a URL for custom providers", variant: "destructive" }); return
      }
    }

    const validModels = models.filter(m => m.modelId.trim() !== '')

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
          models: validModels.map(m => ({ id: m.modelId.trim() })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data?.error ?? "Failed to create provider", variant: "destructive" })
      } else {
        toast({ title: `Provider created${validModels.length > 0 ? ` with ${validModels.length} model${validModels.length !== 1 ? 's' : ''}` : ''}` })
        queryClient.invalidateQueries({ queryKey: getGetAdminProvidersQueryKey() })
        setOpen(false); reset()
      }
    } catch (err: any) {
      toast({ title: err.message ?? "Network error", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
              {/* Basic settings */}
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Provider Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required
                  className="rounded-none bg-sidebar/10 font-mono" placeholder="e.g. OpenRouter Cluster" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as ProviderInputType)}>
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
                      All endpoints in a cluster must expose the <strong>exact same model IDs</strong>.
                    </p>
                  </div>
                )}

                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {baseUrls.map((bu, buIdx) => {
                    const isExpanded = expandedBu.has(buIdx)
                    const status = testStatus[buIdx]
                    return (
                      <div key={buIdx} className="border bg-background">
                        {/* Endpoint header */}
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
                          {/* Test status indicator */}
                          {status === 'ok' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                          {status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                          {status === 'testing' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
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
                            {/* URL field (custom only) */}
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

                            {/* Keys within this endpoint */}
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

                            {/* Test connection */}
                            <Button
                              type="button" variant="secondary" size="sm"
                              className="w-full rounded-none font-mono uppercase text-[10px] h-7"
                              onClick={() => handleTestConnection(buIdx)}
                              disabled={status === 'testing' || !bu.keys[0]?.key}
                            >
                              {status === 'testing' ? "Testing..." : "Test Connection"}
                            </Button>

                            {/* Error message */}
                            {testErrors[buIdx] && (
                              <div className="p-2 bg-destructive/10 border border-destructive/30 text-destructive font-mono text-[10px] break-all">
                                {testErrors[buIdx]}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right — manual model entry */}
            <div className="md:border-l md:pl-6 flex flex-col border-t md:border-t-0 pt-4 md:pt-0">
              <div className="flex items-center justify-between mb-1">
                <Label className="font-mono text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Zap className="h-3 w-3" /> Models to Expose
                </Label>
                <button type="button"
                  className="font-mono text-[9px] uppercase text-primary hover:underline flex items-center gap-0.5"
                  onClick={addModel}>
                  <Plus className="w-2.5 h-2.5" /> Model
                </button>
              </div>

              <p className="font-mono text-[10px] text-muted-foreground mb-3 leading-relaxed">
                Enter the exact model IDs the provider uses (e.g.{" "}
                <span className="text-foreground">gpt-4o</span>,{" "}
                <span className="text-foreground">claude-3-5-sonnet-20241022</span>). You can add
                pricing and context window on the Models page after saving.
              </p>

              <div className="flex-1 space-y-1.5 max-h-[380px] overflow-y-auto">
                {models.map((m, idx) => (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <Input
                      value={m.modelId}
                      onChange={e => updateModel(idx, e.target.value)}
                      placeholder="model-id-as-used-by-provider"
                      className="rounded-none h-8 font-mono text-xs flex-1"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {models.length > 1 && (
                      <Button type="button" variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive rounded-none shrink-0"
                        onClick={() => removeModel(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {models.filter(m => m.modelId.trim()).length === 0 && (
                <p className="font-mono text-[10px] text-amber-600 dark:text-amber-400 mt-2">
                  No models — you can add them later via Model Definitions.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-none font-mono uppercase w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="rounded-none font-mono uppercase w-full sm:w-auto" disabled={isSaving || !name}>
              {isSaving
                ? "Saving..."
                : `Commit${models.filter(m => m.modelId.trim()).length > 0 ? ` (${models.filter(m => m.modelId.trim()).length} model${models.filter(m => m.modelId.trim()).length !== 1 ? 's' : ''})` : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
