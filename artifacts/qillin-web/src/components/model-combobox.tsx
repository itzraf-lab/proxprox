import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { KNOWN_MODELS, CATEGORIES, fmtCtx, type KnownModel } from "@/lib/known-models"

interface ModelComboboxProps {
  value: string
  onChange: (value: string, meta: KnownModel | null) => void
  placeholder?: string
}

export function ModelCombobox({ value, onChange, placeholder = "Search or type model ID…" }: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    if (!search.trim()) return KNOWN_MODELS
    const q = search.toLowerCase()
    return KNOWN_MODELS.filter(
      m =>
        m.litellmModel.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    )
  }, [search])

  const grouped = React.useMemo(() => {
    const map = new Map<string, KnownModel[]>()
    for (const cat of CATEGORIES) {
      const items = filtered.filter(m => m.category === cat)
      if (items.length) map.set(cat, items)
    }
    return map
  }, [filtered])

  const selectedModel = KNOWN_MODELS.find(m => m.litellmModel === value)

  const handleSelect = (model: KnownModel) => {
    onChange(model.litellmModel, model)
    setOpen(false)
    setSearch("")
  }

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    const known = KNOWN_MODELS.find(m => m.litellmModel === v) ?? null
    onChange(v, known)
  }

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
            <span className={`truncate ${!value ? "text-muted-foreground" : ""}`}>
              {value
                ? (selectedModel ? `${selectedModel.displayName} — ${value}` : value)
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[520px] p-0 rounded-none border-2" align="start">
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              className="flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
              placeholder="Search models, providers, or paste a model ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[340px] overflow-y-auto">
            {grouped.size === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-muted-foreground">
                No known models match. Type to use a custom model ID.
              </div>
            ) : (
              Array.from(grouped.entries()).map(([cat, models]) => (
                <div key={cat}>
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground bg-sidebar/30 border-b sticky top-0">
                    {cat}
                  </div>
                  {models.map(m => (
                    <div
                      key={m.litellmModel}
                      onClick={() => handleSelect(m)}
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
              ))
            )}
          </div>
          {search && !KNOWN_MODELS.find(m => m.litellmModel === search) && (
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

      {/* Editable field for direct typing / pasting */}
      <Input
        value={value}
        onChange={handleCustomInput}
        className="rounded-none bg-sidebar/10 font-mono text-xs h-7 border-dashed"
        placeholder="or type/paste a model ID directly"
      />
    </div>
  )
}
