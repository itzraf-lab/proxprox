import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminProviders, useDeleteAdminProvider, getGetAdminProvidersQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Server, Plus, Trash2, KeyRound, Workflow, Zap, CheckSquare, Square, Database, DollarSign } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { ProviderInputType, ProviderInputLoadBalancing, ProviderApiKeyInput } from "@workspace/api-client-react"
import { getToken } from "@/lib/api"

interface FetchedModelInfo {
  id: string
  name: string
  contextWindow: number | null
  inputCostPerMtok: number | null
  outputCostPerMtok: number | null
  metaSource: "known" | "provider" | "unknown"
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
          <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider hidden sm:block">Configure API endpoints and load balancing</p>
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
                  </div>
                  <CardTitle className="text-lg md:text-xl font-mono uppercase tracking-wider truncate">{provider.name}</CardTitle>
                  {provider.baseUrl && (
                    <CardDescription className="font-mono text-xs mt-1 truncate">BASE: {provider.baseUrl}</CardDescription>
                  )}
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
                <div className="flex-1 p-4 md:p-6 border-b sm:border-b-0 sm:border-r">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                    <KeyRound className="h-3 w-3" /> Credentials
                  </h4>
                  <div className="space-y-2">
                    {provider.apiKeys.map(key => (
                      <div key={key.id} className="flex items-center justify-between bg-background border p-2 gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold truncate">{key.keyMasked}</div>
                          {key.label && <div className="font-mono text-[10px] text-muted-foreground uppercase">{key.label}</div>}
                        </div>
                        <div className="flex items-center gap-2 text-right shrink-0">
                          {key.failCount > 0 && <span className="text-xs font-mono text-destructive">FAILS: {key.failCount}</span>}
                          <Badge variant="secondary" className="rounded-none font-mono text-[10px]">P{key.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-full sm:w-56 md:w-64 p-4 md:p-6 bg-background">
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

function AddProviderDialog() {
  const [open, setOpen] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<ProviderInputType>('openai')
  const [baseUrl, setBaseUrl] = React.useState("")
  const [lb, setLb] = React.useState<ProviderInputLoadBalancing>('round_robin')
  const [keys, setKeys] = React.useState<ProviderApiKeyInput[]>([{ key: "", priority: 1 }])
  const [fetchedModels, setFetchedModels] = React.useState<FetchedModelInfo[] | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [testError, setTestError] = React.useState<string | null>(null)

  const reset = () => {
    setName(""); setType('openai'); setBaseUrl(""); setLb('round_robin')
    setKeys([{ key: "", priority: 1 }])
    setFetchedModels(null); setSelectedIds(new Set()); setTestError(null)
  }

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

  const handleFetchModels = async () => {
    if (!keys[0].key) return toast({ title: "API key required", variant: "destructive" })
    if (type === 'custom' && !baseUrl) return toast({ title: "Base URL required", variant: "destructive" })
    setIsTesting(true); setFetchedModels(null); setSelectedIds(new Set()); setTestError(null)
    try {
      const token = getToken()
      const res = await fetch('/api/admin/providers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ type, baseUrl: type === 'custom' ? baseUrl : undefined, apiKey: keys[0].key }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTestError(data?.error ?? 'Connection failed')
        toast({ title: "Connection failed", variant: "destructive" })
      } else {
        setFetchedModels(data)
        setSelectedIds(new Set(data.map((m: FetchedModelInfo) => m.id)))
      }
    } catch (err: any) {
      setTestError(err.message ?? 'Network error')
      toast({ title: "Failed to connect", variant: "destructive" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || keys.some(k => !k.key)) return
    setIsSaving(true)
    try {
      const token = getToken()
      const selectedModels = fetchedModels?.filter(m => selectedIds.has(m.id)) ?? []
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          name, type, loadBalancing: lb,
          baseUrl: type === 'custom' ? baseUrl : undefined,
          apiKeys: keys.filter(k => k.key.trim() !== ''),
          models: selectedModels,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data?.error ?? "Failed to create provider", variant: "destructive" })
      } else {
        toast({ title: `Provider created with ${selectedModels.length} model${selectedModels.length !== 1 ? 's' : ''}` })
        queryClient.invalidateQueries({ queryKey: getGetAdminProvidersQueryKey() })
        setOpen(false); reset()
      }
    } catch (err: any) {
      toast({ title: err.message ?? "Network error", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const allSelected = fetchedModels != null && selectedIds.size === fetchedModels.length

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button className="rounded-none font-mono uppercase tracking-wider shrink-0">
          <Plus className="mr-1.5 w-4 h-4" /> <span className="hidden sm:inline">Add </span>Provider
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-4xl rounded-none border-2 max-h-[92vh] overflow-y-auto p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-lg">Integrate Provider</DialogTitle>
          </DialogHeader>

          {/* Responsive: stack on mobile, side-by-side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {/* Left — provider config */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Provider Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" placeholder="e.g. OpenAI Primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Type</Label>
                  <Select value={type} onValueChange={(v) => { setType(v as ProviderInputType); setFetchedModels(null); setSelectedIds(new Set()) }}>
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

              {type === 'custom' && (
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Base URL</Label>
                  <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" placeholder="https://api.example.com/v1" />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-xs uppercase tracking-wider text-primary">API Keys</Label>
                  <Button type="button" variant="outline" size="sm" className="rounded-none font-mono text-[10px] uppercase h-6 px-2"
                    onClick={() => setKeys([...keys, { key: "", priority: keys.length + 1 }])}>
                    <Plus className="w-3 h-3 mr-1" /> Key
                  </Button>
                </div>
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {keys.map((k, i) => (
                    <div key={i} className="flex gap-2 p-2 bg-sidebar/10 border">
                      <div className="flex-1 space-y-1.5 min-w-0">
                        <Input type="password" value={k.key} onChange={e => { const nk = [...keys]; nk[i].key = e.target.value; setKeys(nk) }}
                          placeholder="sk-..." required className="rounded-none h-8 font-mono text-xs" />
                        <div className="flex gap-2">
                          <Input value={k.label || ''} onChange={e => { const nk = [...keys]; nk[i].label = e.target.value; setKeys(nk) }}
                            placeholder="Label (opt)" className="rounded-none h-7 font-mono text-xs w-full" />
                          {lb === 'priority' && (
                            <Input type="number" min="1" value={k.priority}
                              onChange={e => { const nk = [...keys]; nk[i].priority = parseInt(e.target.value) || 1; setKeys(nk) }}
                              className="rounded-none h-7 font-mono text-xs w-16 shrink-0" placeholder="P" />
                          )}
                        </div>
                      </div>
                      {keys.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-none shrink-0"
                          onClick={() => setKeys(keys.filter((_, idx) => idx !== i))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button type="button" variant="secondary" className="w-full rounded-none font-mono uppercase text-xs"
                onClick={handleFetchModels} disabled={isTesting || !keys[0].key}>
                {isTesting ? "Connecting..." : fetchedModels ? "Re-test Connection" : "Test Connection & Fetch Models"}
              </Button>
              {testError && (
                <div className="p-2 bg-destructive/10 border border-destructive/30 text-destructive font-mono text-xs break-all">
                  {testError}
                </div>
              )}
            </div>

            {/* Right — model selection */}
            <div className="md:border-l md:pl-6 flex flex-col border-t md:border-t-0 pt-4 md:pt-0">
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

              {!fetchedModels ? (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed p-6 text-center text-muted-foreground font-mono text-xs min-h-[120px]">
                  Test the connection first to detect models
                </div>
              ) : fetchedModels.length === 0 ? (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed p-6 text-center text-muted-foreground font-mono text-xs min-h-[120px]">
                  No models returned — add them manually via Model Definitions
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
                  <div className="flex-1 space-y-1 max-h-[280px] md:max-h-[360px] overflow-y-auto">
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
            </div>
          </div>

          <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-none font-mono uppercase w-full sm:w-auto">Cancel</Button>
            <Button type="submit" className="rounded-none font-mono uppercase w-full sm:w-auto" disabled={isSaving || !name}>
              {isSaving ? "Saving..." : `Commit${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
