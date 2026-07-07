import * as React from "react"
import { useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminRequests } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Loader2, FilterX, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function AdminRequests() {
  return (
    <AuthGuard requireAdmin>
      <Shell>
        <AdminRequestsContent />
      </Shell>
    </AuthGuard>
  )
}

function AdminRequestsContent() {
  const [page, setPage] = useState(1)
  const [modelFilter, setModelFilter] = useState("")
  const [appliedModel, setAppliedModel] = useState("")
  
  const queryParams = {
    page,
    limit: 20,
    ...(appliedModel ? { model: appliedModel } : {})
  }
  
  const { data: requestsPage, isLoading } = useGetAdminRequests(queryParams)

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setAppliedModel(modelFilter)
    setPage(1)
  }

  const clearFilter = () => {
    setModelFilter("")
    setAppliedModel("")
    setPage(1)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-sidebar/10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight font-mono text-primary">Global Stream</h1>
        <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider">System-wide event monitoring</p>
      </div>

      <Card className="rounded-none border-2 shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b bg-background">
          <div className="flex flex-col gap-2">
            <CardTitle className="font-mono uppercase tracking-wider text-sm">All Interceptions</CardTitle>
            {appliedModel && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-none font-mono text-[10px] uppercase bg-primary/20 text-primary border border-primary/30">
                  Model: {appliedModel}
                </Badge>
                <Button variant="ghost" size="sm" onClick={clearFilter} className="h-5 px-2 text-[10px] font-mono rounded-none">
                  <FilterX className="h-3 w-3 mr-1" /> CLEAR
                </Button>
              </div>
            )}
          </div>
          
          <form onSubmit={applyFilter} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Model alias..."
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="rounded-none border-2 font-mono text-xs w-[200px] h-8 pl-8 bg-background"
              />
            </div>
            <Button type="submit" size="sm" className="rounded-none h-8 font-mono text-xs uppercase tracking-wider">
              Filter
            </Button>
          </form>
        </CardHeader>
        
        <CardContent className="p-0 bg-background">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-sidebar/30">
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold">Timestamp</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold">Identity</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold">Target Model</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Tk In</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Tk Out</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Cost</TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider font-bold text-right">Lat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : requestsPage?.items && requestsPage.items.length > 0 ? (
                  requestsPage.items.map((req) => (
                    <TableRow key={req.id} className="hover:bg-sidebar/20 transition-colors">
                      <TableCell className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                        {new Date(req.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] truncate max-w-[150px]" title={req.userEmail || req.userId || "UNKNOWN"}>
                        {req.userEmail || req.userId || "UNKNOWN"}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] font-bold text-primary">{req.model}</TableCell>
                      <TableCell className="font-mono text-[11px] text-right text-muted-foreground">{formatNumber(req.tokensIn)}</TableCell>
                      <TableCell className="font-mono text-[11px] text-right text-muted-foreground">{formatNumber(req.tokensOut)}</TableCell>
                      <TableCell className="font-mono text-[11px] text-right font-bold">{formatCurrency(req.spend)}</TableCell>
                      <TableCell className="font-mono text-[11px] text-right text-muted-foreground">
                        {req.latencyMs !== null && req.latencyMs !== undefined ? `${req.latencyMs}ms` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center font-mono text-sm text-muted-foreground py-12 border-dashed">
                      NO RECORDS MATCHING CRITERIA
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {requestsPage?.totalPages ? (
            <div className="flex items-center justify-between p-4 border-t bg-sidebar/30">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                Buffer {requestsPage.page} / {requestsPage.totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-none border-2 font-mono text-xs h-7 px-3 bg-background"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  <ChevronLeft className="h-3 w-3 mr-1" /> PRV
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-none border-2 font-mono text-xs h-7 px-3 bg-background"
                  onClick={() => setPage(p => Math.min(requestsPage.totalPages, p + 1))}
                  disabled={page === requestsPage.totalPages || isLoading}
                >
                  NXT <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
