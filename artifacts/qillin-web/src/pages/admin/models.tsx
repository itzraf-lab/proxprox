import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminModels, useCreateAdminModel, useUpdateAdminModel, useDeleteAdminModel, useGetAdminProviders, getGetAdminModelsQueryKey } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { BrainCircuit, Plus, Edit2, Trash2, Server } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { Model, ModelInput } from "@workspace/api-client-react"

export default function AdminModels() {
  return (
    <AuthGuard requireAdmin>
      <Shell>
        <AdminModelsContent />
      </Shell>
    </AuthGuard>
  )
}

function AdminModelsContent() {
  const { data: models, isLoading } = useGetAdminModels()
  const deleteModel = useDeleteAdminModel()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [editModel, setEditModel] = React.useState<Model | null>(null)
  const [isEditOpen, setIsEditOpen] = React.useState(false)

  const handleDelete = (id: string) => {
    if (!confirm("Remove this model from the catalog?")) return
    deleteModel.mutate({ modelId: id }, {
      onSuccess: () => {
        toast({ title: "Model removed" })
        queryClient.invalidateQueries({ queryKey: getGetAdminModelsQueryKey() })
      },
      onError: () => toast({ title: "Error removing model", variant: "destructive" })
    })
  }

  const openEdit = (model: Model) => {
    setEditModel(model)
    setIsEditOpen(true)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-sidebar/10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight font-mono text-primary flex items-center gap-3">
            <BrainCircuit className="h-8 w-8" />
            Model Definitions
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-wider">Configure routing targets and pricing parameters</p>
        </div>
        <ModelDialog mode="create" />
      </div>

      <Card className="rounded-none border-2 shadow-lg">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-background">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold">Identity</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold">Provider Route</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Context</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">In Cost</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Out Cost</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center font-mono py-12 text-muted-foreground">Loading catalog...</TableCell>
                </TableRow>
              ) : models?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center font-mono py-12 text-muted-foreground">Catalog is empty</TableCell>
                </TableRow>
              ) : (
                models?.map(model => (
                  <TableRow key={model.id} className={!model.enabled ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {!model.enabled && <Badge variant="secondary" className="rounded-none px-1 py-0 text-[8px] h-4">OFF</Badge>}
                        <div className="font-bold text-sm font-mono">{model.name}</div>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{model.litellmModel}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-none font-mono text-xs border-primary text-primary flex w-fit items-center gap-1">
                        <Server className="w-3 h-3" /> {model.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {model.contextWindow >= 1000 ? `${model.contextWindow / 1000}K` : model.contextWindow}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-bold text-sm">{formatCurrency(model.inputCostPerMtok)}</div>
                      <div className="text-[9px] font-mono text-muted-foreground uppercase">Qr / MTok</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-mono font-bold text-sm">{formatCurrency(model.outputCostPerMtok)}</div>
                      <div className="text-[9px] font-mono text-muted-foreground uppercase">Qr / MTok</div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-sidebar/30" onClick={() => openEdit(model)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(model.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editModel && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl rounded-none border-2">
            <ModelForm mode="edit" initialData={editModel} onClose={() => setIsEditOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ModelDialog({ mode }: { mode: 'create' }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-none font-mono uppercase tracking-wider">
          <Plus className="mr-2 w-4 h-4" /> Define Model
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-none border-2">
        <ModelForm mode={mode} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ModelForm({ mode, initialData, onClose }: { mode: 'create' | 'edit', initialData?: Model, onClose: () => void }) {
  const { data: providers } = useGetAdminProviders()
  const createModel = useCreateAdminModel()
  const updateModel = useUpdateAdminModel()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [name, setName] = React.useState(initialData?.name || "")
  const [litellmModel, setLitellmModel] = React.useState(initialData?.litellmModel || "")
  const [providerId, setProviderId] = React.useState(initialData?.providerId || "")
  const [contextWindow, setContextWindow] = React.useState(initialData?.contextWindow?.toString() || "128000")
  const [inputCost, setInputCost] = React.useState(initialData?.inputCostPerMtok?.toString() || "0.0000")
  const [outputCost, setOutputCost] = React.useState(initialData?.outputCostPerMtok?.toString() || "0.0000")
  const [enabled, setEnabled] = React.useState(initialData?.enabled ?? true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !litellmModel || !providerId) return

    const payload: ModelInput = {
      name,
      litellmModel,
      providerId,
      contextWindow: parseInt(contextWindow, 10),
      inputCostPerMtok: parseFloat(inputCost),
      outputCostPerMtok: parseFloat(outputCost),
      enabled
    }

    if (mode === 'create') {
      createModel.mutate({ data: payload }, {
        onSuccess: () => {
          toast({ title: "Model defined" })
          queryClient.invalidateQueries({ queryKey: getGetAdminModelsQueryKey() })
          onClose()
        },
        onError: () => toast({ title: "Error defining model", variant: "destructive" })
      })
    } else if (mode === 'edit' && initialData) {
      updateModel.mutate({ modelId: initialData.id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Model updated" })
          queryClient.invalidateQueries({ queryKey: getGetAdminModelsQueryKey() })
          onClose()
        },
        onError: () => toast({ title: "Error updating model", variant: "destructive" })
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle className="font-mono uppercase tracking-wider text-xl">
          {mode === 'create' ? 'Define Model' : 'Modify Model'}
        </DialogTitle>
        <DialogDescription className="font-mono text-xs">Map a user-facing name to an internal LiteLLM route.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider">Display Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" placeholder="e.g. GPT-4o" />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider">LiteLLM Target</Label>
            <Input value={litellmModel} onChange={e => setLitellmModel(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" placeholder="e.g. openai/gpt-4o" />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider">Upstream Provider</Label>
            <Select value={providerId} onValueChange={setProviderId} required>
              <SelectTrigger className="rounded-none bg-sidebar/10 font-mono">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2">
                {providers?.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-mono">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider">Context Window (Tokens)</Label>
            <Input type="number" value={contextWindow} onChange={e => setContextWindow(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-primary">Input Cost (Qr / MTok)</Label>
            <Input type="number" step="0.0001" min="0" value={inputCost} onChange={e => setInputCost(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-primary">Output Cost (Qr / MTok)</Label>
            <Input type="number" step="0.0001" min="0" value={outputCost} onChange={e => setOutputCost(e.target.value)} required className="rounded-none bg-sidebar/10 font-mono" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Checkbox checked={enabled} onCheckedChange={c => setEnabled(c === true)} id="enabled" className="border-2 rounded-none h-5 w-5" />
            <Label htmlFor="enabled" className="font-mono text-sm uppercase tracking-wider cursor-pointer">Route Active</Label>
          </div>
        </div>
      </div>

      <DialogFooter className="border-t pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="rounded-none font-mono uppercase">Cancel</Button>
        <Button type="submit" className="rounded-none font-mono uppercase" disabled={createModel.isPending || updateModel.isPending}>
          Commit Configuration
        </Button>
      </DialogFooter>
    </form>
  )
}
