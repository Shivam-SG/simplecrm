"use client"

import { useState } from "react"
import { Search, X, Filter as FilterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { statusClass } from "./field-renderers/system-cells"
import { cn } from "@/lib/utils"
import type { SchemaField } from "@/lib/schema-detector"
import type { FilterMap, FilterValue } from "@/lib/filter-builder"

type FiltersData = Record<
  string,
  { distinct?: string[]; min?: number; max?: number }
>

const HIDDEN_FILTER_LABELS = new Set([
  "Title",
  "Total Score",
  "Reviews Count",
  "Street",
  "City",
  "State",
  "Website",
  "Phone",
  "Categories",
  "URL",
  "Category Name",
])

export function FilterBar({
  schema,
  filtersData,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  status,
  onStatusChange,
  scoreMin,
  onScoreMinChange,
  statusOptions,
}: {
  schema: SchemaField[]
  filtersData: FiltersData
  search: string
  onSearchChange: (v: string) => void
  filters: FilterMap
  onFiltersChange: (m: FilterMap) => void
  status: string[]
  onStatusChange: (s: string[]) => void
  scoreMin: number
  onScoreMinChange: (v: number) => void
  statusOptions: string[]
}) {
  function setFilter(key: string, v: FilterValue | null) {
    const next = { ...filters }
    if (v === null) delete next[key]
    else next[key] = v
    onFiltersChange(next)
  }

  function clearAll() {
    onFiltersChange({})
    onStatusChange([])
    onScoreMinChange(0)
    onSearchChange("")
  }

  const visibleFields = schema.filter(
    (f) => f.visible && f.type !== "json" && !HIDDEN_FILTER_LABELS.has(f.label)
  )
  const activeChips = buildChips(filters, status, scoreMin, schema)
  const hasActive = activeChips.length > 0 || search.length > 0

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-[1_1_260px] sm:max-w-md">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        <StatusFilter
          options={statusOptions}
          value={status}
          onChange={onStatusChange}
        />

        <ScoreFilter value={scoreMin} onChange={onScoreMinChange} />

        {visibleFields.map((f) => (
          <FieldFilter
            key={f.key}
            field={f}
            data={filtersData[f.key]}
            value={filters[f.key]}
            onChange={(v) => setFilter(f.key, v)}
          />
        ))}

        {hasActive && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {activeChips.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1">
              {c.label}
              <button onClick={c.onRemove} aria-label="Remove filter">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )

  function buildChips(
    fs: FilterMap,
    statuses: string[],
    sMin: number,
    sch: SchemaField[]
  ): { id: string; label: React.ReactNode; onRemove: () => void }[] {
    const out: { id: string; label: React.ReactNode; onRemove: () => void }[] =
      []
    if (statuses.length > 0) {
      out.push({
        id: "status",
        label: `Status: ${statuses.join(", ")}`,
        onRemove: () => onStatusChange([]),
      })
    }
    if (sMin > 0) {
      out.push({
        id: "score",
        label: `Score ≥ ${sMin}`,
        onRemove: () => onScoreMinChange(0),
      })
    }
    for (const [key, v] of Object.entries(fs)) {
      const f = sch.find((x) => x.key === key)
      if (!f) continue
      if (HIDDEN_FILTER_LABELS.has(f.label)) continue
      let label = ""
      if (v.type === "text") label = `${f.label}: "${v.value}"`
      else if (v.type === "range")
        label = `${f.label}: ${v.min ?? "*"}–${v.max ?? "*"}`
      else if (v.type === "in") label = `${f.label}: ${v.values.join(", ")}`
      else if (v.type === "exists")
        label = `${f.label} ${v.value === "yes" ? "exists" : "missing"}`
      else if (v.type === "bool") label = `${f.label}: ${v.value}`
      out.push({
        id: key,
        label,
        onRemove: () => setFilter(key, null),
      })
    }
    return out
  }
}

function StatusFilter({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  function toggle(s: string) {
    if (value.includes(s)) onChange(value.filter((x) => x !== s))
    else onChange([...value, s])
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 shrink-0">
          <FilterIcon className="size-3" />
          Status
          {value.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {value.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-1.5">
          {options.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={value.includes(s)}
                onCheckedChange={() => toggle(s)}
              />
              <span
                className={cn("rounded px-1.5 py-0.5 text-xs", statusClass(s))}
              >
                {s}
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ScoreFilter({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-9 w-32 shrink-0">
        <SelectValue placeholder="Score ≥" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="0">Any score</SelectItem>
        {[1, 2, 3, 4, 5].map((n) => (
          <SelectItem key={n} value={String(n)}>
            ≥ {n} stars
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FieldFilter({
  field,
  data,
  value,
  onChange,
}: {
  field: SchemaField
  data?: { distinct?: string[]; min?: number; max?: number }
  value?: FilterValue
  onChange: (v: FilterValue | null) => void
}) {
  const [open, setOpen] = useState(false)

  if (field.type === "string") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterButton label={field.label} active={!!value} />
        </PopoverTrigger>
        <PopoverContent className="w-56" align="start">
          <Input
            placeholder={`Filter ${field.label}...`}
            defaultValue={value?.type === "text" ? value.value : ""}
            onChange={(e) => {
              const v = e.target.value
              if (!v) onChange(null)
              else onChange({ type: "text", value: v })
            }}
          />
        </PopoverContent>
      </Popover>
    )
  }

  if (field.type === "number") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterButton label={field.label} active={!!value} />
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <NumberRange
            value={value?.type === "range" ? value : { type: "range" }}
            placeholderMin={data?.min}
            placeholderMax={data?.max}
            onChange={(v) => {
              if (v.min === undefined && v.max === undefined) onChange(null)
              else onChange(v)
            }}
          />
        </PopoverContent>
      </Popover>
    )
  }

  if (field.type === "array") {
    const distinct = data?.distinct ?? []
    if (distinct.length === 0) return null
    const selected = value?.type === "in" ? value.values : []
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterButton
            label={field.label}
            active={!!value && selected.length > 0}
            count={selected.length}
          />
        </PopoverTrigger>
        <PopoverContent className="max-h-72 w-56 overflow-auto" align="start">
          <div className="space-y-1">
            {distinct.map((opt) => (
              <label
                key={opt}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...selected, opt]
                      : selected.filter((x) => x !== opt)
                    if (next.length === 0) onChange(null)
                    else onChange({ type: "in", values: next })
                  }}
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  if (
    field.type === "phone" ||
    field.type === "url" ||
    field.type === "email"
  ) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterButton label={field.label} active={!!value} />
        </PopoverTrigger>
        <PopoverContent className="w-48" align="start">
          <div className="space-y-1.5">
            <Label className="text-xs">{field.label}</Label>
            <Select
              value={value?.type === "exists" ? value.value : "any"}
              onValueChange={(v) => {
                if (v === "any") onChange(null)
                else onChange({ type: "exists", value: v as "yes" | "no" })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="yes">Has value</SelectItem>
                <SelectItem value="no">Missing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  if (field.type === "boolean") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FilterButton label={field.label} active={!!value} />
        </PopoverTrigger>
        <PopoverContent className="w-48" align="start">
          <Select
            value={value?.type === "bool" ? value.value : "any"}
            onValueChange={(v) => {
              if (v === "any") onChange(null)
              else onChange({ type: "bool", value: v as "yes" | "no" })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </PopoverContent>
      </Popover>
    )
  }

  return null
}

function FilterButton({
  label,
  active,
  count,
}: {
  label: string
  active?: boolean
  count?: number
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      className="h-9 max-w-[180px] shrink-0"
    >
      <span className="truncate">{label}</span>
      {active && count !== undefined && count > 0 && (
        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
          {count}
        </Badge>
      )}
    </Button>
  )
}

function NumberRange({
  value,
  placeholderMin,
  placeholderMax,
  onChange,
}: {
  value: { type: "range"; min?: number; max?: number }
  placeholderMin?: number
  placeholderMax?: number
  onChange: (v: { type: "range"; min?: number; max?: number }) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label className="text-xs">Min</Label>
        <Input
          type="number"
          placeholder={placeholderMin?.toString() ?? "min"}
          defaultValue={value.min ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              min: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
        />
      </div>
      <div>
        <Label className="text-xs">Max</Label>
        <Input
          type="number"
          placeholder={placeholderMax?.toString() ?? "max"}
          defaultValue={value.max ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              max: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
        />
      </div>
    </div>
  )
}
