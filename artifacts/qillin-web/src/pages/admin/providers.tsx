import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminProviders, useCreateAdminProvider, useDeleteAdminProvider, getGetAdminProvidersQueryKey } from "@workspace/api-client-react"
import { getToken } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Server, Plus, Trash2, KeyRound, Workflow, Zap } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { ProviderInputType, ProviderInputLoadBalancing, ProviderApiKeyInput, ProviderInput } from "@workspace/api-client-react"

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
    if (!confirm("Are you sure you want to completely remove this provider? All associated models will go offline.")) return
    deleteProvider.mutate({ providerId: id }, {
      onSuccess: () => {
        toast({ title: "Provider eliminated" })
        queryClient.invalidateQueries({ queryKey: getGetAdminProvidersQueryKey() })
      },
      onError: () => toast({ title: "Error", variant: "destructive" })
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-sidebar/10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight font-mono text-primary flex items-center gap-3">
            <Server className="h-8 w-8" />
            Upstream Providers
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">Configure API endpoints and load balancing</p>
        </div>
        <AddProviderDialog />
      </div>

      {isLoading ? (
        <div className="text-center py-12 font-mono text-muted-foreground">Fetching provider configs...</div>
      ) : providers?.length === 0 ? (
        <Card className="rounded-none border-2 border-dashed bg-transparent">
          <CardContent className="p-12 text-center text-muted-foreground font-mono">
            No providers configured. System cannot route requests.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {providers?.map(provider => (
            <Card key={provider.id} className="rounded-none border-2 shadow-lg overflow-hidden group">
              <CardHeader className="bg-background border-b pb-4 flex flex-row items-start justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={provider.isActive ? "success" : "secondary"} className="rounded-none font-mono text-[10px] uppercase">
                      {provider.isActive ? 'Active Route' : 'Offline'}
                    </Badge>
                    <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase border-primary text-primary">
                      {provider.type}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-mono uppercase tracking-wider">{provider.name}</CardTitle>
                  {provider.baseUrl && <CardDescription className="font-mono text-xs mt-1">BASE: {provider.baseUrl}</CardDescription>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(provider.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive rounded-none">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0 bg-sidebar/20 flex flex-col md:flex-row">
                <div className="flex-1 p-6 border-b md:border-b-0 md:border-r">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <KeyRound className="h-3 w-3" /> Credentials
                  </h4>
                  <div className="space-y-3">
                    {provider.apiKeys.map(key => (
                      <div key={key.id} className="flex items-center justify-between bg-background border p-2">
                        <div>
                          <div className="font-mono text-sm font-bold">{key.keyMasked}</div>
                          {key.label && <div className="font-mono text-[10px] text-muted-foreground uppercase">{key.label}</div>}
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          {key.failCount > 0 && <span className="text-xs font-mono text-destructive">FAILS: {key.failCount}</span>}
                          <Badge variant="secondary" className="rounded-none font-mono text-[10px]">PRIO {key.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-full md:w-64 p-6 bg-background">
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <Workflow className="h-3 w-3" /> Routing Policy
                  </h4>
                  <div className="text-sm font-mono uppercase font-bold mb-6">
                    {provider.loadBalancing.replace('_', ' ')}
                  </div>
                  <h4 className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                    <Zap className="h-3 w-3" /> Capabilities
                  </h4>
                  <div className="text-sm font-mono">
                    <span className="font-bold text-primary">{provider.modelCount}</span> models exposed
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
  const createProvider = useCreateAdminProvider()
  const [isTesting, setIsTesting] = React.useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<ProviderInputType>('openai')
  const [baseUrl, setBaseUrl] = React.useState("")
  const [lb, setLb] = React.useState<ProviderInputLoadBalancing>('round_robin')
  
  const [keys, setKeys] = React.useState<ProviderApiKeyInput[]>([{ key: "", priority: 1 }])
  const [fetchedModels, setFetchedModels] = React.useState<{id: string, name: string}[] | null>(null)
  const [testError, setTestError] = React.useState<string | null>(null)

  const reset = () => {
    setName("")
    setType('openai')
    setBaseUrl("")
    setLb('round_robin')
    setKeys([{ key: "", priority: 1 }])
    setFetchedModels(null)
    setTestError(null)
  }

  const handleFetchModels = async () => {
    if (!keys[0].key) return toast({ title: "API key required", variant: "destructive" })
    if (type === 'custom' && !baseUrl) return toast({ title: "Base URL required for custom providers", variant: "destructive" })
    setIsTesting(true)
    setFetchedModels(null)
    setTestError(null)
    try {
      const token = getToken()
      const res = await fetch('/api/admin/providers/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type, baseUrl: type === 'custom' ? baseUrl : undefined, apiKey: keys[0].key }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTestError(data?.error ?? 'Connection failed')
        toast({ title: "Connection failed", variant: "destructive" })
      } else {
        setFetchedModels(data)
      }
    } catch (err: any) {
      setTestError(err.message ?? 'Network error')
      toast({ title: "Failed to connect to provider", variant: "destructive" })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || keys.some(k => !k.key)) return

    const payload: ProviderInput = {
      name,
      type,
      loadBalancing: lb,
      baseUrl: type === 'custom' ? baseUrl : undefined,
      apiKeys: keys.filter(k => k.key.trim() !== '')
    }

    createProvider.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "Provider initialized" })
          queryClient.invalidateQueries({ queryKey: getGetAdminProvidersQueryKey() })
          setOpen(false)
          reset()
        },
        onError: () => toast({ title: "Failed to create provider", variant: "destructive" })
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if(!o) reset() }}>
      <DialogTrigger asChild>
        <Button className="rounded-none font-mono uppercase tracking-wider">
          <Plus className="mr-2 w-4 h-4" /> Add Provider
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl rounded-none border-2">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-wider text-xl">Integrate Provider</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Provider Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" placeholder="e.g. OpenAI Primary" />
              </div>
              
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Spec Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as ProviderInputType)}>
                  <SelectTrigger className="rounded-none bg-sidebar/10 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2">
                    <SelectItem value="openai" className="font-mono">OpenAI Native</SelectItem>
                    <SelectItem value="anthropic" className="font-mono">Anthropic</SelectItem>
                    <SelectItem value="custom" className="font-mono">Custom Compatible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {type === 'custom' && (
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Base URL Override</Label>
                  <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" placeholder="https://api.example.com/v1" />
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Routing Policy</Label>
                <Select value={lb} onValueChange={(v) => setLb(v as ProviderInputLoadBalancing)}>
                  <SelectTrigger className="rounded-none bg-sidebar/10 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2">
                    <SelectItem value="round_robin" className="font-mono">Round Robin (Distribute Evenly)</SelectItem>
                    <SelectItem value="priority" className="font-mono">Strict Priority (Fallback Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-l pl-6">
              <div className="flex items-center justify-between">
                <Label className="font-mono text-xs uppercase tracking-wider text-primary">Authentication Keys</Label>
                <Button type="button" variant="outline" size="sm" className="rounded-none font-mono text-[10px] uppercase h-6 px-2" onClick={() => setKeys([...keys, { key: "", priority: keys.length + 1 }])}>
                  <Plus className="w-3 h-3 mr-1" /> Add Key
                </Button>
              </div>

              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                {keys.map((k, i) => (
                  <div key={i} className="flex gap-2 p-2 bg-sidebar/10 border">
                    <div className="flex-1 space-y-2">
                      <Input type="password" value={k.key} onChange={e => { const nk = [...keys]; nk[i].key = e.target.value; setKeys(nk) }} placeholder="sk-..." required className="rounded-none h-8 font-mono text-xs" />
                      <div className="flex gap-2">
                        <Input value={k.label || ''} onChange={e => { const nk = [...keys]; nk[i].label = e.target.value; setKeys(nk) }} placeholder="Label (opt)" className="rounded-none h-7 font-mono text-xs w-full" />
                        {lb === 'priority' && (
                          <Input type="number" min="1" value={k.priority} onChange={e => { const nk = [...keys]; nk[i].priority = parseInt(e.target.value) || 1; setKeys(nk) }} className="rounded-none h-7 font-mono text-xs w-20" placeholder="Prio" />
                        )}
                      </div>
                    </div>
                    {keys.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-none shrink-0" onClick={() => setKeys(keys.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t">
                <Button type="button" variant="secondary" className="w-full rounded-none font-mono uppercase text-xs" onClick={handleFetchModels} disabled={isTesting || !keys[0].key}>
                  {isTesting ? "Testing Connection..." : "Test Connection & View Models"}
                </Button>
                {fetchedModels && (
                  <div className="mt-4 p-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-mono text-xs">
                    Connection success. Detected {fetchedModels.length} models.
                  </div>
                )}
                {testError && (
                  <div className="mt-4 p-2 bg-destructive/10 border border-destructive/30 text-destructive font-mono text-xs break-all">
                    {testError}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-none font-mono uppercase">Cancel</Button>
            <Button type="submit" className="rounded-none font-mono uppercase" disabled={createProvider.isPending}>
              Commit Integration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
