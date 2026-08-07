import * as React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { Shell } from "@/components/layout"
import { useGetAdminModels, useCreateAdminModel, useUpdateAdminModel, useDeleteAdminModel, useGetAdminProviders, getGetAdminModelsQueryKey } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { BrainCircuit, Plus, Edit2, Trash2, Server, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { Model, ModelInput } from "@workspace/api-client-react"
import { ModelCombobox, type ConfiguredModel } from "@/components/model-combobox"
import { fmtCtx, type KnownModel } from "@/lib/known-models"

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
  const [modelToDelete, setModelToDelete] = React.useState<Model | null>(null)

  const configuredModels: ConfiguredModel[] = React.useMemo(
    () =>
      (models ?? []).map(m => ({
        id: m.id,
        name: m.name,
        litellmModel: m.litellmModel,
        provider: m.provider,
        contextWindow: m.contextWindow,
        inputCostPerMtok: m.inputCostPerMtok,
        outputCostPerMtok: m.outputCostPerMtok,
      })),
    [models]
  )

  const handleDeleteConfirm = () => {
    if (!modelToDelete) return
    deleteModel.mutate({ modelId: modelToDelete.id }, {
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
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-sidebar/10">
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight font-mono text-primary flex items-center gap-3">
            <BrainCircuit className="h-6 w-6 md:h-8 md:w-8" />
            Models
          </h1>
          <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider hidden sm:block">Configure routing targets and pricing</p>
        </div>
        <ModelDialog mode="create" configuredModels={configuredModels} />
      </div>

      {/* Desktop table */}
      <Card className="rounded-none border-2 shadow-lg hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b">
                <tr>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-left p-3">Identity</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-left p-3">Provider</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Context</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">In Cost</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Out Cost</th>
                  <th className="font-mono text-xs uppercase tracking-wider font-bold text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center font-mono py-12 text-muted-foreground">Loading catalog...</td></tr>
                ) : !models?.length ? (
                  <tr><td colSpan={6} className="text-center font-mono py-12 text-muted-foreground">Catalog is empty — define your first model</td></tr>
                ) : (
                  models.map(model => (
                    <tr key={model.id} className={`border-b hover:bg-sidebar/10 ${!model.enabled ? "opacity-50" : ""}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {!model.enabled && <Badge variant="secondary" className="rounded-none px-1 py-0 text-[8px] h-4">OFF</Badge>}
                          <span className="font-bold font-mono">{model.name}</span>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{model.litellmModel}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="rounded-none font-mono text-xs border-primary text-primary flex w-fit items-center gap-1">
                          <Server className="w-3 h-3" /> {model.provider}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-sm">{model.contextWindow ? fmtCtx(model.contextWindow) : "—"}</td>
                      <td className="p-3 text-right">
                        <div className="font-mono font-bold text-sm">{formatCurrency(model.inputCostPerMtok)}</div>
                        <div className="text-[9px] font-mono text-muted-foreground uppercase">Qr/MTok</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-mono font-bold text-sm">{formatCurrency(model.outputCostPerMtok)}</div>
                        <div className="text-[9px] font-mono text-muted-foreground uppercase">Qr/MTok</div>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <Button variant="ghost" size="icon" aria-label={`Edit model ${model.name}`} className="h-8 w-8 rounded-none hover:bg-sidebar/30" onClick={() => openEdit(model)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={`Delete model ${model.name}`} className="h-8 w-8 rounded-none text-destructive hover:bg-destructive/10" onClick={() => setModelToDelete(model)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
          <div className="text-center font-mono py-12 text-muted-foreground text-sm">Loading catalog...</div>
        ) : !models?.length ? (
          <div className="text-center font-mono py-12 text-muted-foreground text-sm border-2 border-dashed p-8">
            Catalog is empty — define your first model
          </div>
        ) : (
          models.map(model => (
            <Card key={model.id} className={`rounded-none border-2 ${!model.enabled ? "opacity-50" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!model.enabled && <Badge variant="secondary" className="rounded-none px-1 py-0 text-[8px] h-4">OFF</Badge>}
                      <span className="font-bold font-mono text-sm">{model.name}</span>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-0.5 break-all">{model.litellmModel}</div>
                    <Badge variant="outline" className="rounded-none font-mono text-[10px] border-primary text-primary mt-1.5 flex w-fit items-center gap-1">
                      <Server className="w-2.5 h-2.5" /> {model.provider}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" aria-label={`Edit model ${model.name}`} className="h-8 w-8 rounded-none hover:bg-sidebar/30" onClick={() => openEdit(model)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete model ${model.name}`} className="h-8 w-8 rounded-none text-destructive hover:bg-destructive/10" onClick={() => setModelToDelete(model)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t pt-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">Context</div>
                    <div className="font-mono font-bold text-sm">{model.contextWindow ? fmtCtx(model.contextWindow) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">In /MTok</div>
                    <div className="font-mono font-bold text-sm">{formatCurrency(model.inputCostPerMtok)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">Out /MTok</div>
                    <div className="font-mono font-bold text-sm">{formatCurrency(model.outputCostPerMtok)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {editModel && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl rounded-none border-2 max-h-[90vh] overflow-y-auto">
            <ModelForm mode="edit" initialData={editModel} configuredModels={configuredModels} onClose={() => setIsEditOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={modelToDelete !== null} onOpenChange={(open) => { if (!open) setModelToDelete(null) }}>
        <AlertDialogContent className="rounded-none border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono uppercase tracking-wider">Remove model</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              Remove {modelToDelete?.name} from the catalog? Requests routed to it will start failing. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none font-mono uppercase text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none font-mono uppercase text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleteModel.isPending}
            >
              {deleteModel.isPending ? "Removing..." : "Remove model"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ModelDialog({ mode, configuredModels }: { mode: 'create'; configuredModels: ConfiguredModel[] }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-none font-mono uppercase tracking-wider shrink-0">
          <Plus className="mr-1.5 w-4 h-4" /> <span className="hidden sm:inline">Define </span>Model
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl rounded-none border-2 max-h-[90vh] overflow-y-auto">
        <ModelForm mode={mode} configuredModels={configuredModels} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ModelForm({
  mode, initialData, configuredModels, onClose
}: {
  mode: 'create' | 'edit'
  initialData?: Model
  configuredModels: ConfiguredModel[]
  onClose: () => void
}) {
  const { data: providers } = useGetAdminProviders()
  const createModel = useCreateAdminModel()
  const updateModel = useUpdateAdminModel()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [name, setName] = React.useState(initialData?.name || "")
  const [litellmModel, setLitellmModel] = React.useState(initialData?.litellmModel || "")
  const [providerId, setProviderId] = React.useState(initialData?.providerId || "")
  const [contextWindow, setContextWindow] = React.useState(initialData?.contextWindow?.toString() || "")
  const [inputCost, setInputCost] = React.useState(initialData?.inputCostPerMtok?.toString() || "")
  const [outputCost, setOutputCost] = React.useState(initialData?.outputCostPerMtok?.toString() || "")
  const [enabled, setEnabled] = React.useState(initialData?.enabled ?? true)
  const [autoFilled, setAutoFilled] = React.useState(false)

  const handleModelSelect = (modelId: string, meta: KnownModel | null) => {
    setLitellmModel(modelId)
    if (meta) {
      if (!name) setName(meta.displayName)
      setContextWindow(meta.contextWindow.toString())
      setInputCost(meta.inputCostPerMtok.toString())
      setOutputCost(meta.outputCostPerMtok.toString())
      setAutoFilled(true)
    } else {
      setAutoFilled(false)
    }
  }

  // Strict validation: reject malformed numbers instead of silently coercing
  // them (a typo in a cost field must never become 0 = "free").
  const formError = React.useMemo(() => {
    if (!name.trim() || !litellmModel.trim() || !providerId) {
      return "Name, model target, and provider are required."
    }
    const ctx = Number(contextWindow)
    if (contextWindow.trim() === "" || !Number.isInteger(ctx) || ctx <= 0) {
      return "Context window must be a positive whole number."
    }
    const inCost = Number(inputCost)
    if (inputCost.trim() === "" || !Number.isFinite(inCost) || inCost < 0) {
      return "Input cost must be a non-negative number."
    }
    const outCost = Number(outputCost)
    if (outputCost.trim() === "" || !Number.isFinite(outCost) || outCost < 0) {
      return "Output cost must be a non-negative number."
    }
    return null
  }, [name, litellmModel, providerId, contextWindow, inputCost, outputCost])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formError) {
      toast({ title: "Invalid model configuration", description: formError, variant: "destructive" })
      return
    }

    const payload: ModelInput = {
      name: name.trim(),
      litellmModel: litellmModel.trim(),
      providerId,
      contextWindow: Number(contextWindow),
      inputCostPerMtok: Number(inputCost),
      outputCostPerMtok: Number(outputCost),
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <DialogHeader>
        <DialogTitle className="font-mono uppercase tracking-wider text-lg">
          {mode === 'create' ? 'Define Model' : 'Modify Model'}
        </DialogTitle>
        <DialogDescription className="font-mono text-xs">Map a user-facing name to a LiteLLM route.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider">LiteLLM Target</Label>
            <ModelCombobox
              value={litellmModel}
              onChange={handleModelSelect}
              configuredModels={configuredModels}
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider">
              Display Name
              {autoFilled && <span className="ml-2 text-emerald-600 dark:text-emerald-400 normal-case text-[10px]">auto-filled</span>}
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="rounded-none bg-sidebar/10 font-mono"
              placeholder="e.g. GPT-4o"
            />
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
            <Label className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5">
              Context Window (tokens)
              {autoFilled && contextWindow && (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 normal-case text-[10px]">
                  <Sparkles className="h-3 w-3" /> {fmtCtx(parseInt(contextWindow))}
                </span>
              )}
            </Label>
            <Input
              type="number"
              value={contextWindow}
              onChange={e => setContextWindow(e.target.value)}
              required
              className="rounded-none bg-sidebar/10 font-mono"
              placeholder="e.g. 128000"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-primary">Input Cost (Qr / MTok)</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={inputCost}
              onChange={e => setInputCost(e.target.value)}
              required
              className="rounded-none bg-sidebar/10 font-mono"
              placeholder="e.g. 2.50"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase tracking-wider text-primary">Output Cost (Qr / MTok)</Label>
            <Input
              type="number"
              step="any"
              min="0"
              value={outputCost}
              onChange={e => setOutputCost(e.target.value)}
              required
              className="rounded-none bg-sidebar/10 font-mono"
              placeholder="e.g. 10.00"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Checkbox
              checked={enabled}
              onCheckedChange={c => setEnabled(c === true)}
              id="enabled"
              className="border-2 rounded-none h-5 w-5"
            />
            <Label htmlFor="enabled" className="font-mono text-sm uppercase tracking-wider cursor-pointer">Route Active</Label>
          </div>
        </div>
      </div>

      <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-2">
        {formError && (
          <p className="w-full font-mono text-xs text-destructive sm:mr-auto" role="alert">{formError}</p>
        )}
        <Button type="button" variant="outline" onClick={onClose} className="rounded-none font-mono uppercase w-full sm:w-auto">Cancel</Button>
        <Button
          type="submit"
          className="rounded-none font-mono uppercase w-full sm:w-auto"
          disabled={createModel.isPending || updateModel.isPending || formError !== null}
        >
          Commit Configuration
        </Button>
      </DialogFooter>
    </form>
  )
}
