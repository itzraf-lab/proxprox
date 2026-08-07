import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { KNOWN_MODELS, CATEGORIES, fmtCtx, type KnownModel } from "@/lib/known-models"

export interface ConfiguredModel {
  id: string
  name: string
  litellmModel: string
  provider: string
  contextWindow?: number | null
  inputCostPerMtok?: number | null
  outputCostPerMtok?: number | null
}

interface ModelComboboxProps {
  value: string
  onChange: (value: string, meta: KnownModel | null) => void
  configuredModels?: ConfiguredModel[]
  placeholder?: string
}

export function ModelCombobox({ value, onChange, configuredModels = [], placeholder = "Search or type model ID…" }: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const q = search.toLowerCase().trim()

  const filteredKnown = React.useMemo(() => {
    if (!q) return KNOWN_MODELS
    return KNOWN_MODELS.filter(
      m => m.litellmModel.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)
    )
  }, [q])

  const filteredConfigured = React.useMemo(() => {
    if (!q) return configuredModels
    return configuredModels.filter(
      m => m.name.toLowerCase().includes(q) || m.litellmModel.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q)
    )
  }, [q, configuredModels])

  const groupedKnown = React.useMemo(() => {
    const map = new Map<string, KnownModel[]>()
    for (const cat of CATEGORIES) {
      const items = filteredKnown.filter(m => m.category === cat)
      if (items.length) map.set(cat, items)
    }
    return map
  }, [filteredKnown])

  const selectedKnown = KNOWN_MODELS.find(m => m.litellmModel === value)
  const selectedConfigured = configuredModels.find(m => m.litellmModel === value)

  const displayLabel = () => {
    if (!value) return null
    if (selectedConfigured) return `${selectedConfigured.name} (${selectedConfigured.provider})`
    if (selectedKnown) return `${selectedKnown.displayName} — ${value}`
    return value
  }

  const handleSelectKnown = (model: KnownModel) => {
    onChange(model.litellmModel, model)
    setOpen(false)
    setSearch("")
  }

  const handleSelectConfigured = (model: ConfiguredModel) => {
    const known = KNOWN_MODELS.find(m => m.litellmModel === model.litellmModel) ?? null
    onChange(model.litellmModel, known)
    setOpen(false)
    setSearch("")
  }

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Typed input must NOT trigger catalog auto-fill: while editing an existing
    // model, an intermediate keystroke that exactly matches a catalog ID (e.g.
    // "gpt-4o" on the way to "gpt-4o-azure") would silently overwrite the
    // model's saved pricing/context with catalog values. Only explicit
    // popover selections auto-fill metadata.
    onChange(e.target.value, null)
  }

  const isEmpty = filteredConfigured.length === 0 && groupedKnown.size === 0

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between rounded-none bg-sidebar/10 font-mono text-sm h-9 px-3 border hover:bg-sidebar/20"
          >
            <span className={`truncate text-left ${!value ? "text-muted-foreground font-normal" : ""}`}>
              {displayLabel() ?? placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(520px,calc(100vw-2rem))] p-0 rounded-none border-2"
          align="start"
          sideOffset={4}
        >
          {/* Search bar */}
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
              placeholder="Search models or paste a model ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {isEmpty ? (
              <div className="py-8 text-center text-xs font-mono text-muted-foreground">
                No models match. Type to use a custom model ID.
              </div>
            ) : (
              <>
                {/* Configured / provider models */}
                {filteredConfigured.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-primary bg-background border-b sticky top-0 z-10">
                      ✦ Configured in this system
                    </div>
                    {filteredConfigured.map(m => (
                      <div
                        key={`cfg-${m.id}`}
                        onClick={() => handleSelectConfigured(m)}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-sidebar/20 border-b border-border/30 transition-colors
                          ${value === m.litellmModel ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                      >
                        <Check className={`h-3.5 w-3.5 shrink-0 ${value === m.litellmModel ? "text-primary" : "opacity-0"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm font-medium">{m.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate">{m.litellmModel}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-[10px] text-primary/70">{m.provider}</div>
                          {m.contextWindow ? (
                            <div className="font-mono text-[10px] text-muted-foreground">{fmtCtx(m.contextWindow)} ctx</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Known model catalog by category */}
                {Array.from(groupedKnown.entries()).map(([cat, models]) => (
                  <div key={cat}>
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground bg-background border-b sticky top-0 z-10">
                      {cat}
                    </div>
                    {models.map(m => (
                      <div
                        key={m.litellmModel}
                        onClick={() => handleSelectKnown(m)}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-sidebar/20 border-b border-border/30 transition-colors
                          ${value === m.litellmModel ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                      >
                        <Check className={`h-3.5 w-3.5 shrink-0 ${value === m.litellmModel ? "text-primary" : "opacity-0"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm font-medium">{m.displayName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground truncate">{m.litellmModel}</div>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="font-mono text-[10px] text-muted-foreground">{fmtCtx(m.contextWindow)} ctx</div>
                          {m.inputCostPerMtok > 0 ? (
                            <div className="font-mono text-[10px] text-foreground/70">
                              ${m.inputCostPerMtok} / ${m.outputCostPerMtok}
                            </div>
                          ) : (
                            <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">free</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Use as custom ID */}
          {search && !KNOWN_MODELS.find(m => m.litellmModel === search) && !configuredModels.find(m => m.litellmModel === search) && (
            <div
              onClick={() => { onChange(search, null); setOpen(false); setSearch("") }}
              className="flex items-center gap-2 px-3 py-2.5 border-t cursor-pointer hover:bg-sidebar/20 font-mono text-xs"
            >
              <span className="text-muted-foreground">Use custom ID:</span>
              <span className="font-bold text-primary">{search}</span>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Direct text input */}
      <Input
        value={value}
        onChange={handleCustomInput}
        className="rounded-none bg-sidebar/10 font-mono text-xs h-7 border-dashed"
        placeholder="or type/paste a model ID directly"
      />
    </div>
  )
}
