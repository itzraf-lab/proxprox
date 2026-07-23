import * as React from "react"
import { useState, useMemo } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetUserRequests, useGetUserUsage } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatNumber, formatTokens } from "@/lib/utils"
import { Activity, TerminalSquare, DollarSign, ChevronLeft, ChevronRight, Loader2, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function Requests() {
  return (
    <AuthGuard>
      <Shell>
        <RequestsContent />
      </Shell>
    </AuthGuard>
  )
}

function RequestsContent() {
  const [page, setPage] = useState(1)
  const [model, setModel] = useState<string>("all")
  
  const { data: usage } = useGetUserUsage()
  
  const queryParams = {
    page,
    limit: 20,
    ...(model !== "all" ? { model } : {})
  }
  
  const { data: requestsPage, isLoading } = useGetUserRequests(queryParams)

  // Extract unique models from the usage stats to populate filter
  const availableModels = useMemo(() => {
    if (!usage?.modelBreakdown) return []
    return usage.modelBreakdown.map(m => m.modelName)
  }, [usage])

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight font-mono text-primary">Request Log</h1>
        <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider">Historical event trace</p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="rounded-none border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold font-mono uppercase tracking-widest text-muted-foreground">Total Events</CardTitle>
            <TerminalSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatNumber(usage?.totalRequests)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold font-mono uppercase tracking-widest text-muted-foreground">Tokens Cycled</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {formatTokens((usage?.modelBreakdown || []).reduce((acc, m) => acc + m.tokensIn + m.tokensOut, 0))}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-bold font-mono uppercase tracking-widest text-muted-foreground">Total Burn</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">{formatCurrency(usage?.totalSpend)} Qr</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-none border-2">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <CardTitle className="font-mono uppercase tracking-wider text-sm">Event Stream</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={model} onValueChange={(val) => { setModel(val); setPage(1); }}>
              <SelectTrigger className="w-[180px] rounded-none font-mono text-xs border-2 bg-background">
                <SelectValue placeholder="Filter by model" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 font-mono text-xs">
                <SelectItem value="all">ALL MODELS</SelectItem>
                {availableModels.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-sidebar/50">
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold">Timestamp</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold">Model</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Tokens In</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Tokens Out</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Cache Read</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Cache Write</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Uncached</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Spend (Qr)</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : requestsPage?.items && requestsPage.items.length > 0 ? (
                  requestsPage.items.map((req) => (
                    <TableRow key={req.id} className={req.cached ? "bg-primary/5" : undefined}>
                      <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(req.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        <div className="flex items-center gap-2">
                          {req.model}
                          {req.cached && (
                            <Badge variant="secondary" className="rounded-none px-1.5 py-0 text-[9px] h-4 font-mono uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <Zap className="h-2.5 w-2.5 mr-0.5" /> Cached
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right text-muted-foreground">{formatNumber(req.tokensIn)}</TableCell>
                      <TableCell className="font-mono text-xs text-right text-muted-foreground">{formatNumber(req.tokensOut)}</TableCell>
                      <TableCell className="font-mono text-xs text-right text-emerald-600 dark:text-emerald-400">{req.cached ? formatNumber(req.cacheReadTokens) : "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-right text-amber-600 dark:text-amber-400">{req.cached ? formatNumber(req.cacheWriteTokens) : "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-right text-muted-foreground">{formatNumber(req.uncachedTokens)}</TableCell>
                      <TableCell className="font-mono text-xs text-right font-bold">{formatCurrency(req.spend)}</TableCell>
                      <TableCell className="font-mono text-xs text-right text-muted-foreground">
                        {req.latencyMs !== null && req.latencyMs !== undefined ? `${req.latencyMs}ms` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center font-mono text-sm text-muted-foreground py-12 border-dashed">
                      NO EVENTS DETECTED
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {requestsPage?.totalPages ? (
            <div className="flex items-center justify-between p-4 border-t bg-sidebar/10">
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                Page {requestsPage.page} of {requestsPage.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-none border-2 font-mono text-xs h-8"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> PREV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-none border-2 font-mono text-xs h-8"
                  onClick={() => setPage(p => Math.min(requestsPage.totalPages, p + 1))}
                  disabled={page === requestsPage.totalPages || isLoading}
                >
                  NEXT <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
