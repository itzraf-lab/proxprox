import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import {
  useGetAdminUsers, useUpdateAdminUser, useAddUserCredits,
  useGetAdminModels,
  getGetAdminUsersQueryKey,
} from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { Users, Edit2, ShieldAlert, DollarSign, Activity, ChevronDown, ChevronRight, Lock, Unlock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { AdminUser, CreditInputOperation, Model } from "@workspace/api-client-react"

export default function AdminUsers() {
  return (
    <AuthGuard requireAdmin>
      <Shell>
        <AdminUsersContent />
      </Shell>
    </AuthGuard>
  )
}

function AdminUsersContent() {
  const { data: users, isLoading } = useGetAdminUsers()

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-sidebar/10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight font-mono text-primary flex items-center gap-3">
          <Users className="h-6 w-6 md:h-8 md:w-8" />
          Operators
        </h1>
        <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider hidden sm:block">Manage user access and Qredit balances</p>
      </div>

      {/* Desktop table */}
      <Card className="rounded-none border-2 shadow-lg hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b">
                <tr>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-left p-3">Operator</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-left p-3">Role</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-left p-3">Status</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-left p-3">Models</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Balance</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Spend</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center font-mono py-12 text-muted-foreground">Loading registry...</td></tr>
                ) : !users?.length ? (
                  <tr><td colSpan={7} className="text-center font-mono py-12 text-muted-foreground">No operators found</td></tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="border-b hover:bg-sidebar/10">
                      <td className="p-3">
                        <div className="font-bold text-sm">{user.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="rounded-none font-mono text-[10px] uppercase">
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={user.isActive ? 'success' : 'outline'} className="rounded-none font-mono text-[10px] uppercase">
                          {user.isActive ? 'Active' : 'Suspended'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <ModelAccessBadge allowedModels={user.allowedModels ?? null} />
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-mono font-bold text-emerald-500">{formatCurrency(user.qredits)}</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">Qredits</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-mono font-bold">{formatCurrency(user.totalSpend)}</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">{formatNumber(user.totalRequests)} req</div>
                      </td>
                      <td className="p-3 text-right">
                        <UserActions user={user} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center font-mono py-12 text-muted-foreground text-sm">Loading registry...</div>
        ) : !users?.length ? (
          <div className="text-center font-mono py-12 text-muted-foreground text-sm">No operators found</div>
        ) : (
          users.map(user => (
            <Card key={user.id} className="rounded-none border-2">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{user.name}</div>
                    <div className="font-mono text-xs text-muted-foreground truncate">{user.email}</div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="rounded-none font-mono text-[10px] uppercase">
                        {user.role}
                      </Badge>
                      <Badge variant={user.isActive ? 'success' : 'outline'} className="rounded-none font-mono text-[10px] uppercase">
                        {user.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                      <ModelAccessBadge allowedModels={user.allowedModels ?? null} />
                    </div>
                  </div>
                  <UserActions user={user} compact />
                </div>
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-2.5 w-2.5" /> Balance
                    </div>
                    <div className="font-mono font-bold text-emerald-500">{formatCurrency(user.qredits)} Qr</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
                      <Activity className="h-2.5 w-2.5" /> Spend
                    </div>
                    <div className="font-mono font-bold">{formatCurrency(user.totalSpend)}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{formatNumber(user.totalRequests)} req</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function ModelAccessBadge({ allowedModels }: { allowedModels: string[] | null }) {
  if (!allowedModels) {
    return (
      <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase gap-1 border-emerald-500/40 text-emerald-600">
        <Unlock className="h-2.5 w-2.5" /> Full
      </Badge>
    )
  }
  if (allowedModels.length === 0) {
    return (
      <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase gap-1 border-destructive/40 text-destructive">
        <Lock className="h-2.5 w-2.5" /> None
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase gap-1">
      <Lock className="h-2.5 w-2.5" /> {allowedModels.length}
    </Badge>
  )
}

function UserActions({ user, compact }: { user: AdminUser; compact?: boolean }) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [creditsOpen, setCreditsOpen] = React.useState(false)

  return (
    <div className={`flex gap-1.5 ${compact ? "flex-col" : "justify-end"}`}>
      <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-none font-mono text-xs uppercase tracking-wider">
            <DollarSign className="h-3 w-3 mr-1" /> {compact ? "" : "Funding"}
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-none border-2">
          <CreditsForm user={user} onClose={() => setCreditsOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="rounded-none font-mono text-xs uppercase tracking-wider">
            <Edit2 className="h-3 w-3 mr-1" /> {compact ? "" : "Edit"}
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-none border-2">
          <EditUserForm user={user} onClose={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreditsForm({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const addCredits = useAddUserCredits()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [amount, setAmount] = React.useState("")
  const [operation, setOperation] = React.useState<CreditInputOperation>('add')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Number() is strict — unlike parseFloat it rejects trailing garbage
    // ("10abc" → NaN instead of silently becoming 10).
    const numAmount = amount.trim() === "" ? NaN : Number(amount)
    // Zero is valid for "set" (Override Total to 0); for add/subtract it's a
    // pointless no-op. Either way, surface feedback instead of failing silently.
    if (isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount < 0 || (operation !== 'set' && numAmount === 0)) {
      toast({
        title: operation === 'set' ? "Enter a valid amount (0 or greater)" : "Enter a valid amount (greater than 0)",
        variant: "destructive",
      })
      return
    }
    addCredits.mutate(
      { userId: user.id, data: { amount: numAmount, operation } },
      {
        onSuccess: () => {
          toast({ title: "Funds updated successfully" })
          queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() })
          onClose()
        },
        onError: () => toast({ title: "Error updating funds", variant: "destructive" })
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle className="font-mono uppercase tracking-wider">Allocate Funds</DialogTitle>
        <DialogDescription className="font-mono text-xs">Modify Qredit balance for {user.email}</DialogDescription>
      </DialogHeader>
      <div className="bg-sidebar/30 p-4 border">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Current Balance</div>
        <div className="text-xl font-bold font-mono text-emerald-500">{formatCurrency(user.qredits)} Qr</div>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase tracking-wider">Operation</Label>
          <Select value={operation} onValueChange={(v) => setOperation(v as CreditInputOperation)}>
            <SelectTrigger className="rounded-none bg-sidebar/10 font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2">
              <SelectItem value="add" className="font-mono text-sm">Add Funds</SelectItem>
              <SelectItem value="subtract" className="font-mono text-sm">Deduct Funds</SelectItem>
              <SelectItem value="set" className="font-mono text-sm">Override Total</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase tracking-wider">Amount (Qr)</Label>
          <Input
            type="number" step="0.0001" min="0"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            className="rounded-none font-mono text-lg bg-sidebar/10"
            placeholder="0.0000" required
          />
        </div>
      </div>
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="rounded-none font-mono uppercase w-full sm:w-auto">Cancel</Button>
        <Button type="submit" className="rounded-none font-mono uppercase w-full sm:w-auto" disabled={addCredits.isPending || !amount}>
          {addCredits.isPending ? "Executing..." : "Execute"}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ── EditUserForm ──────────────────────────────────────────────────────────────

function groupByProvider(models: Model[]): Record<string, Model[]> {
  return models.reduce<Record<string, Model[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {})
}

function EditUserForm({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const updateUser = useUpdateAdminUser()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: allModels, isLoading: modelsLoading } = useGetAdminModels()

  const [role, setRole] = React.useState(user.role)
  const [isActive, setIsActive] = React.useState(user.isActive)

  // null = unrestricted, Set = specific allowed model names
  const [restricted, setRestricted] = React.useState<boolean>(user.allowedModels != null)
  const [selectedModels, setSelectedModels] = React.useState<Set<string>>(
    new Set(user.allowedModels ?? [])
  )

  // Collapsed state per provider group
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({})

  const enabledModels = React.useMemo(
    () => (allModels ?? []).filter(m => m.enabled),
    [allModels]
  )
  const byProvider = React.useMemo(() => groupByProvider(enabledModels), [enabledModels])
  const providerNames = Object.keys(byProvider).sort()

  function toggleModel(name: string, checked: boolean) {
    setSelectedModels(prev => {
      const next = new Set(prev)
      if (checked) next.add(name)
      else next.delete(name)
      return next
    })
  }

  function toggleProvider(provider: string, checked: boolean) {
    const models = byProvider[provider] ?? []
    setSelectedModels(prev => {
      const next = new Set(prev)
      models.forEach(m => { if (checked) next.add(m.name); else next.delete(m.name) })
      return next
    })
  }

  function providerCheckedState(provider: string): boolean | 'indeterminate' {
    const models = byProvider[provider] ?? []
    const checkedCount = models.filter(m => selectedModels.has(m.name)).length
    if (checkedCount === 0) return false
    if (checkedCount === models.length) return true
    return 'indeterminate'
  }

  function selectAll() {
    setSelectedModels(new Set(enabledModels.map(m => m.name)))
  }
  function selectNone() {
    setSelectedModels(new Set())
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const allowedModels = restricted ? Array.from(selectedModels) : null
    updateUser.mutate(
      { userId: user.id, data: { role, isActive, allowedModels } },
      {
        onSuccess: () => {
          toast({ title: "Operator updated" })
          queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() })
          onClose()
        },
        onError: () => toast({ title: "Error updating operator", variant: "destructive" })
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle className="font-mono uppercase tracking-wider">Modify Operator</DialogTitle>
        <DialogDescription className="font-mono text-xs">Update access for {user.email}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Role */}
        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase tracking-wider">Access Level</Label>
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger className="rounded-none bg-sidebar/10 font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2">
              <SelectItem value="user" className="font-mono text-sm">Standard Operator</SelectItem>
              <SelectItem value="admin" className="font-mono text-sm text-destructive font-bold">System Administrator</SelectItem>
            </SelectContent>
          </Select>
          {role === 'admin' && (
            <p className="text-xs text-destructive font-mono flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Grants global system access
            </p>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between border p-4 bg-sidebar/10">
          <div>
            <Label className="font-mono uppercase tracking-wider">Account Status</Label>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-0.5">Allow API access and login</p>
          </div>
          <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} className="h-6 w-6 border-2" />
        </div>

        {/* Model Access */}
        <div className="space-y-3">
          <Label className="font-mono text-xs uppercase tracking-wider flex items-center gap-2">
            Model Access
          </Label>

          {/* Toggle: unrestricted vs restricted */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRestricted(false)}
              className={`border-2 p-3 text-left transition-colors ${
                !restricted
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-sidebar/10 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Unlock className={`h-3.5 w-3.5 ${!restricted ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">Full Access</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">All enabled models</p>
            </button>
            <button
              type="button"
              onClick={() => setRestricted(true)}
              className={`border-2 p-3 text-left transition-colors ${
                restricted
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-sidebar/10 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Lock className={`h-3.5 w-3.5 ${restricted ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-mono text-xs font-bold uppercase tracking-wider">Restricted</span>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">Choose specific models</p>
            </button>
          </div>

          {/* Model picker (only when restricted) */}
          {restricted && (
            <div className="border-2 bg-sidebar/5">
              {/* Header with select all/none */}
              <div className="flex items-center justify-between px-3 py-2 border-b bg-background">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {selectedModels.size} of {enabledModels.length} selected
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAll} className="font-mono text-[10px] text-primary hover:underline uppercase">All</button>
                  <span className="text-muted-foreground text-[10px]">/</span>
                  <button type="button" onClick={selectNone} className="font-mono text-[10px] text-muted-foreground hover:underline uppercase">None</button>
                </div>
              </div>

              {modelsLoading ? (
                <div className="p-4 text-center font-mono text-xs text-muted-foreground">Loading models...</div>
              ) : enabledModels.length === 0 ? (
                <div className="p-4 text-center font-mono text-xs text-muted-foreground">No enabled models found</div>
              ) : (
                <ScrollArea className="h-56">
                  <div className="p-2 space-y-1">
                    {providerNames.map(provider => {
                      const models = byProvider[provider]
                      const isCollapsed = collapsed[provider] ?? false
                      const checkedState = providerCheckedState(provider)

                      return (
                        <div key={provider} className="border bg-background">
                          {/* Provider row */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-sidebar/20 hover:bg-sidebar/40 transition-colors">
                            <Checkbox
                              checked={checkedState}
                              onCheckedChange={(c) => toggleProvider(provider, c === true)}
                              className="h-4 w-4 border-2 rounded-none"
                            />
                            <button
                              type="button"
                              className="flex-1 flex items-center gap-2 text-left"
                              onClick={() => setCollapsed(p => ({ ...p, [provider]: !isCollapsed }))}
                            >
                              <span className="font-mono text-xs font-bold uppercase tracking-wider flex-1">{provider}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{models.length}</span>
                              {isCollapsed
                                ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              }
                            </button>
                          </div>

                          {/* Model rows */}
                          {!isCollapsed && (
                            <div className="divide-y">
                              {models.map(model => (
                                <label
                                  key={model.id}
                                  className="flex items-center gap-3 px-4 py-2 hover:bg-sidebar/10 cursor-pointer transition-colors"
                                >
                                  <Checkbox
                                    checked={selectedModels.has(model.name)}
                                    onCheckedChange={(c) => toggleModel(model.name, c === true)}
                                    className="h-4 w-4 border-2 rounded-none shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-mono text-xs break-all">{model.name}</div>
                                    {model.litellmModel !== model.name && (
                                      <div className="font-mono text-[10px] text-muted-foreground break-all">{model.litellmModel}</div>
                                    )}
                                  </div>
                                  {(model.inputCostPerMtok > 0 || model.outputCostPerMtok > 0) && (
                                    <div className="text-right shrink-0">
                                      <div className="font-mono text-[10px] text-muted-foreground">${model.inputCostPerMtok.toFixed(2)}</div>
                                      <div className="font-mono text-[10px] text-muted-foreground/60">${model.outputCostPerMtok.toFixed(2)}</div>
                                    </div>
                                  )}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="rounded-none font-mono uppercase w-full sm:w-auto">Cancel</Button>
        <Button type="submit" className="rounded-none font-mono uppercase w-full sm:w-auto" disabled={updateUser.isPending}>
          {updateUser.isPending ? "Applying..." : "Apply Changes"}
        </Button>
      </DialogFooter>
    </form>
  )
}
