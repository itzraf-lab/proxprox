import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetMe, useGetUserUsage, useGetUserKeys, useCreateUserKey, useDeleteUserKey, getGetUserKeysQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { formatCurrency, formatNumber, formatTokens, copyTextToClipboard } from "@/lib/utils"
import { getOpenAiBaseUrl } from "@/lib/url"
import { Copy, Plus, Trash2, Key, Activity, DollarSign, TerminalSquare, AlertCircle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

export default function Dashboard() {
  return (
    <AuthGuard>
      <Shell>
        <DashboardContent />
      </Shell>
    </AuthGuard>
  )
}

function DashboardContent() {
  const { data: me, isLoading: meLoading } = useGetMe()
  const { data: usage, isLoading: usageLoading, isError: usageError } = useGetUserUsage()
  const { data: keys, isLoading: keysLoading, isError: keysError } = useGetUserKeys()
  const createKey = useCreateUserKey()
  const deleteKey = useDeleteUserKey()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [newKeyName, setNewKeyName] = useState("")
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [keyToRevoke, setKeyToRevoke] = useState<string | null>(null)

  const openAiBaseUrl = getOpenAiBaseUrl()
  const pythonSnippet = `from openai import OpenAI

client = OpenAI(
    base_url="${openAiBaseUrl}",
    api_key="sk-qillin-..."
)

response = client.chat.completions.create(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return
    createKey.mutate(
      { data: { name: newKeyName } },
      {
        onSuccess: (data) => {
          setCreatedToken(data.token)
          setNewKeyName("")
          queryClient.invalidateQueries({ queryKey: getGetUserKeysQueryKey() })
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create key", variant: "destructive" })
        }
      }
    )
  }

  const handleRevokeConfirm = () => {
    if (!keyToRevoke) return
    deleteKey.mutate(
      { keyHash: keyToRevoke },
      {
        onSuccess: () => {
          toast({ title: "Key revoked successfully" })
          queryClient.invalidateQueries({ queryKey: getGetUserKeysQueryKey() })
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to revoke key", variant: "destructive" })
        }
      }
    )
  }

  const copyToClipboard = async (text: string) => {
    const ok = await copyTextToClipboard(text)
    if (ok) {
      toast({ title: "Copied to clipboard" })
    } else {
      toast({ title: "Copy failed", description: "Select the text and copy it manually", variant: "destructive" })
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight font-mono">Overview</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">System status and resource utilization</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-none border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Available Qredits</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {meLoading ? (
              <Skeleton className="h-9 w-28" />
            ) : (
              <div className="text-3xl font-bold font-mono text-emerald-500">{formatCurrency(me?.qredits)} Qr</div>
            )}
            <p className="text-xs text-muted-foreground font-mono mt-1 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block"></span> ACTIVE BALANCE
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Total Spend</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <Skeleton className="h-9 w-28" />
            ) : usageError ? (
              <div className="text-sm font-mono text-destructive">Unavailable</div>
            ) : (
              <div className="text-3xl font-bold font-mono">{formatCurrency(usage?.totalSpend)} Qr</div>
            )}
            <p className="text-xs text-muted-foreground font-mono mt-1">THIS BILLING CYCLE</p>
          </CardContent>
        </Card>
        <Card className="rounded-none border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium font-mono uppercase tracking-wider">Total Requests</CardTitle>
            <TerminalSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : usageError ? (
              <div className="text-sm font-mono text-destructive">Unavailable</div>
            ) : (
              <div className="text-3xl font-bold font-mono">{formatNumber(usage?.totalRequests)}</div>
            )}
            <p className="text-xs text-muted-foreground font-mono mt-1">ALL MODELS</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-none border-2">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-wider flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              API Access Keys
            </CardTitle>
            <CardDescription className="font-mono text-xs">Credentials for programmatic access</CardDescription>
          </CardHeader>
          <CardContent>
            {keysLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : keysError ? (
              <div className="text-center py-8 border border-dashed bg-sidebar/10">
                <p className="font-mono text-sm text-destructive">Failed to load access keys</p>
              </div>
            ) : keys && keys.length > 0 ? (
              <div className="space-y-4">
                {keys.map(key => (
                  <div key={key.keyHash} className="flex items-center justify-between gap-3 p-3 border bg-sidebar/30">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold truncate" title={key.name}>{key.name}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-1 truncate">{key.keyHash.substring(0, 16)}...</div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-xs text-muted-foreground">SPEND</div>
                        <div className="font-mono text-sm font-bold">{formatCurrency(key.spend)} Qr</div>
                      </div>
                      <Button variant="ghost" size="icon" aria-label={`Revoke key ${key.name}`} onClick={() => setKeyToRevoke(key.keyHash)} className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-none">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed bg-sidebar/10">
                <p className="font-mono text-sm text-muted-foreground">No access keys generated</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t pt-6 bg-sidebar/10">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full rounded-none font-mono uppercase tracking-wider" onClick={() => setCreatedToken(null)}>
                  <Plus className="w-4 h-4 mr-2" /> Generate New Key
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-none border-2">
                <DialogHeader>
                  <DialogTitle className="font-mono uppercase tracking-wider text-xl">Generate Access Key</DialogTitle>
                  <DialogDescription className="font-mono text-xs">Create a new key for API authentication.</DialogDescription>
                </DialogHeader>

                {createdToken ? (
                  <div className="space-y-4 py-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      <div className="text-sm font-mono text-emerald-700 dark:text-emerald-400">
                        Please copy this key immediately. It will not be shown again.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input value={createdToken} readOnly className="font-mono text-xs rounded-none bg-sidebar/30" />
                      <Button variant="outline" size="icon" aria-label="Copy API key" className="shrink-0 rounded-none" onClick={() => copyToClipboard(createdToken)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="key-label" className="font-mono text-xs uppercase tracking-wider">Key Label</Label>
                      <Input
                        id="key-label"
                        placeholder="e.g. Production App, CI/CD Pipeline"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="rounded-none font-mono text-sm"
                      />
                    </div>
                  </div>
                )}

                <DialogFooter>
                  {createdToken ? (
                    <Button className="rounded-none font-mono uppercase w-full" onClick={() => setIsCreateOpen(false)}>Done</Button>
                  ) : (
                    <Button className="rounded-none font-mono uppercase" onClick={handleCreateKey} disabled={createKey.isPending || !newKeyName.trim()}>
                      {createKey.isPending ? "Generating..." : "Generate"}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>

        <Card className="rounded-none border-2">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-wider flex items-center gap-2">
              <TerminalSquare className="w-5 h-5 text-primary" />
              Quick Integration
            </CardTitle>
            <CardDescription className="font-mono text-xs">Base URL: <span className="font-bold text-foreground break-all">{openAiBaseUrl}</span></CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-sidebar border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-muted-foreground uppercase">Python (OpenAI SDK)</span>
                <Button variant="ghost" size="icon" aria-label="Copy Python example" className="h-6 w-6" onClick={() => copyToClipboard(pythonSnippet)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <pre className="text-xs font-mono overflow-x-auto text-foreground">
<span className="text-primary">from</span> openai <span className="text-primary">import</span> OpenAI{'\n\n'}
client = OpenAI({'\n'}
    base_url=<span className="text-emerald-500">"{openAiBaseUrl}"</span>,{'\n'}
    api_key=<span className="text-emerald-500">"sk-qillin-..."</span>{'\n'}
){'\n\n'}
response = client.chat.completions.create({'\n'}
    model=<span className="text-emerald-500">"openai/gpt-4o"</span>,{'\n'}
    messages=[{'{'}<span className="text-emerald-500">"role"</span>: <span className="text-emerald-500">"user"</span>, <span className="text-emerald-500">"content"</span>: <span className="text-emerald-500">"Hello!"</span>{'}'}]{'\n'}
)
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-2">
        <CardHeader>
          <CardTitle className="font-mono uppercase tracking-wider">Model Utilization</CardTitle>
          <CardDescription className="font-mono text-xs">Resource consumption breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold">Model</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Requests</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Tokens In</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Tokens Out</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Spend (Qr)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                  </TableCell>
                </TableRow>
              ) : usageError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center font-mono text-sm text-destructive py-8">
                    Failed to load usage data
                  </TableCell>
                </TableRow>
              ) : usage?.modelBreakdown && usage.modelBreakdown.length > 0 ? (
                usage.modelBreakdown.map(model => (
                  <TableRow key={model.modelId}>
                    <TableCell className="font-mono font-medium text-primary">{model.modelName}</TableCell>
                    <TableCell className="font-mono text-right">{formatNumber(model.requests)}</TableCell>
                    <TableCell className="font-mono text-right text-muted-foreground">{formatTokens(model.tokensIn)}</TableCell>
                    <TableCell className="font-mono text-right text-muted-foreground">{formatTokens(model.tokensOut)}</TableCell>
                    <TableCell className="font-mono text-right font-bold">{formatCurrency(model.spend)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center font-mono text-sm text-muted-foreground py-8">
                    No usage data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={keyToRevoke !== null} onOpenChange={(open) => { if (!open) setKeyToRevoke(null) }}>
        <AlertDialogContent className="rounded-none border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono uppercase tracking-wider">Revoke access key</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              This key will stop working immediately. Applications using it will lose access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none font-mono uppercase text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none font-mono uppercase text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRevokeConfirm}
              disabled={deleteKey.isPending}
            >
              {deleteKey.isPending ? "Revoking..." : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
