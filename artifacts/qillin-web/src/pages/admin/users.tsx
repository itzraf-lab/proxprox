import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminUsers, useUpdateAdminUser, useAddUserCredits, getGetAdminUsersQueryKey } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { Users, Edit2, ShieldAlert, DollarSign, Activity } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { AdminUser, CreditInputOperation } from "@workspace/api-client-react"

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
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Balance</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Spend</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center font-mono py-12 text-muted-foreground">Loading registry...</td></tr>
                ) : !users?.length ? (
                  <tr><td colSpan={6} className="text-center font-mono py-12 text-muted-foreground">No operators found</td></tr>
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
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-none border-2">
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
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return
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

function EditUserForm({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const updateUser = useUpdateAdminUser()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [role, setRole] = React.useState(user.role)
  const [isActive, setIsActive] = React.useState(user.isActive)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateUser.mutate(
      { userId: user.id, data: { role, isActive } },
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
        <div className="flex items-center justify-between border p-4 bg-sidebar/10">
          <div>
            <Label className="font-mono uppercase tracking-wider">Account Status</Label>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mt-0.5">Allow API access and login</p>
          </div>
          <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} className="h-6 w-6 border-2" />
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
