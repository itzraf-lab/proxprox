import * as React from "react"
import { Shell } from "@/components/layout"
import { useGetModels } from "@workspace/api-client-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import { fmtCtx } from "@/lib/known-models"
import { Search, Server, Zap, BrainCircuit } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

export default function Models() {
  const { data: models, isLoading } = useGetModels()
  const [search, setSearch] = useState("")

  const filteredModels = models?.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.provider.toLowerCase().includes(search.toLowerCase()) ||
    m.litellmModel.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <Shell>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="border-b bg-background p-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-tight font-mono flex items-center gap-3">
                <BrainCircuit className="h-8 w-8 text-primary" />
                Model Catalog
              </h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">Available routing targets and cost parameters</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                className="pl-9 rounded-none font-mono border-2 bg-sidebar/50" 
                placeholder="Search models or providers..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-sidebar/20">
          <div className="max-w-6xl mx-auto">
            {isLoading ? (
              <div className="text-center font-mono text-muted-foreground py-12">Loading catalog...</div>
            ) : filteredModels.length === 0 ? (
              <div className="text-center font-mono text-muted-foreground py-12 border-2 border-dashed">No models match your search.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredModels.map(model => (
                  <Card key={model.id} className="rounded-none border-2 hover:border-primary/50 transition-colors overflow-hidden group flex flex-col">
                    <CardHeader className="bg-background border-b p-4 space-y-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant={model.enabled ? "success" : "secondary"} className="rounded-none font-mono text-[10px] mb-2 uppercase tracking-widest px-1.5 py-0">
                            {model.enabled ? "Online" : "Offline"}
                          </Badge>
                          <CardTitle className="font-mono text-lg truncate leading-tight group-hover:text-primary transition-colors" title={model.name}>
                            {model.name}
                          </CardTitle>
                          <CardDescription className="font-mono text-xs mt-1 truncate" title={model.litellmModel}>
                            {model.litellmModel}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 flex flex-col">
                      <div className="grid grid-cols-2 border-b">
                        <div className="p-3 border-r flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Provider</span>
                          <span className="font-mono text-sm font-semibold truncate flex items-center gap-1.5">
                            <Server className="w-3.5 h-3.5 text-primary" /> {model.provider}
                          </span>
                        </div>
                        <div className="p-3 flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">Context</span>
                          <span className="font-mono text-sm font-semibold truncate flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-500" /> {model.contextWindow ? fmtCtx(model.contextWindow) : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="bg-sidebar/30 p-3 grid grid-cols-2 gap-4 mt-auto">
                        <div>
                          <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground mb-0.5">Input / MTok</div>
                          <div className="font-mono text-sm font-bold text-foreground">
                            {formatCurrency(model.inputCostPerMtok)} Qr
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground mb-0.5">Output / MTok</div>
                          <div className="font-mono text-sm font-bold text-foreground">
                            {formatCurrency(model.outputCostPerMtok)} Qr
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
