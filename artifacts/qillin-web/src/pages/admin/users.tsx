import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminUsers, useUpdateAdminUser, useAddUserCredits, getGetAdminUsersQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { Users, MoreVertical, Edit2, ShieldAlert, DollarSign, Activity } from "lucide-react"
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
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-sidebar/10">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight font-mono text-primary flex items-center gap-3">
          <Users className="h-8 w-8" />
          Operator Registry
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">Manage user access and Qredit balances</p>
      </div>

      <Card className="rounded-none border-2 shadow-lg">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-background">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold">Operator</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold">Role</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold">Status</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Balance</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Spend</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center font-mono py-12 text-muted-foreground">Loading registry...</TableCell>
                </TableRow>
              ) : users?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center font-mono py-12 text-muted-foreground">No operators found</TableCell>
                </TableRow>
              ) : (
                users?.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-bold text-sm">{user.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className="rounded-none font-mono text-[10px] uppercase">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'success' : 'outline'} className="rounded-none font-mono text-[10px] uppercase">
                        {user.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-bold text-emerald-500">{formatCurrency(user.qredits)}</div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">Qredits</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-bold">{formatCurrency(user.totalSpend)}</div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase">{formatNumber(user.totalRequests)} req</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserActions user={user} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function UserActions({ user }: { user: AdminUser }) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [creditsOpen, setCreditsOpen] = React.useState(false)

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-none font-mono text-xs uppercase tracking-wider">
            <DollarSign className="h-3 w-3 mr-1" /> Funding
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-none border-2">
          <CreditsForm user={user} onClose={() => setCreditsOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="rounded-none font-mono text-xs uppercase tracking-wider">
            <Edit2 className="h-3 w-3 mr-1" /> Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-none border-2">
          <EditUserForm user={user} onClose={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreditsForm({ user, onClose }: { user: AdminUser, onClose: () => void }) {
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
        onError: () => {
          toast({ title: "Error", description: "Failed to update funds", variant: "destructive" })
        }
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle className="font-mono uppercase tracking-wider text-xl">Allocate Funds</DialogTitle>
        <DialogDescription className="font-mono text-xs">Modify Qredit balance for {user.email}</DialogDescription>
      </DialogHeader>
      
      <div className="bg-sidebar/30 p-4 border grid grid-cols-2 items-center">
        <div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Current Balance</div>
          <div className="text-xl font-bold font-mono text-emerald-500">{formatCurrency(user.qredits)} Qr</div>
        </div>
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
            type="number" 
            step="0.0001" 
            min="0"
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            className="rounded-none font-mono text-lg bg-sidebar/10"
            placeholder="0.0000"
            required
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="rounded-none font-mono uppercase">Cancel</Button>
        <Button type="submit" className="rounded-none font-mono uppercase" disabled={addCredits.isPending || !amount}>
          {addCredits.isPending ? "Executing..." : "Execute"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditUserForm({ user, onClose }: { user: AdminUser, onClose: () => void }) {
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
          toast({ title: "Operator updated successfully" })
          queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() })
          onClose()
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update operator", variant: "destructive" })
        }
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle className="font-mono uppercase tracking-wider text-xl">Modify Operator</DialogTitle>
        <DialogDescription className="font-mono text-xs">Update system access for {user.email}</DialogDescription>
      </DialogHeader>
      
      <div className="space-y-6">
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
          {role === 'admin' && <p className="text-xs text-destructive font-mono mt-1 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Grants global system access</p>}
        </div>
        
        <div className="flex flex-row items-center justify-between border p-4 bg-sidebar/10">
          <div className="space-y-0.5">
            <Label className="text-base font-mono uppercase tracking-wider">Account Status</Label>
            <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
              Allow API access and system login
            </p>
          </div>
          <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} className="h-6 w-6 border-2" />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="rounded-none font-mono uppercase">Cancel</Button>
        <Button type="submit" className="rounded-none font-mono uppercase" disabled={updateUser.isPending}>
          {updateUser.isPending ? "Applying..." : "Apply Changes"}
        </Button>
      </DialogFooter>
    </form>
  )
}
