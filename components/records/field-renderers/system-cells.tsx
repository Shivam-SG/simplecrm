"use client"

import { useState } from "react"
import { Plus, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const STATUS_COLORS: Record<string, string> = {
  new: "bg-muted text-foreground",
  contacted: "bg-blue-500/15 text-blue-500 border border-blue-500/30",
  interested: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
  not_interested: "bg-red-500/15 text-red-500 border border-red-500/30",
  call_not_picked: "bg-orange-500/15 text-orange-500 border border-orange-500/30",
  not_answered: "bg-rose-500/15 text-rose-500 border border-rose-500/30",
  call_back: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
}

export function statusClass(status: string): string {
  return STATUS_COLORS[status] || "bg-zinc-500/10 text-foreground border border-zinc-500/20"
}

export function StatusCell({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [customStatus, setCustomStatus] = useState("")

  function commitStatus(next: string) {
    const cleaned = next.trim()
    if (!cleaned) return
    onChange(cleaned)
    setCustomStatus("")
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium hover:opacity-80 transition",
            statusClass(value)
          )}
        >
          {value || "—"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-56"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          className="flex items-center gap-2 px-1 pb-2"
          onSubmit={(e) => {
            e.preventDefault()
            commitStatus(customStatus)
          }}
        >
          <Input
            value={customStatus}
            onChange={(e) => setCustomStatus(e.target.value)}
            placeholder="Type status..."
            className="h-8 text-foreground"
          />
          <Button type="submit" size="icon" variant="ghost" className="size-8">
            <Plus className="size-4" />
          </Button>
        </form>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onSelect={() => commitStatus(opt)}
          >
            <Badge variant="outline" className={cn("mr-1", statusClass(opt))}>
              {opt}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ScoreCell({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            onChange(i === value ? 0 : i)
          }}
          className="p-0.5 hover:scale-110 transition"
          aria-label={`Set score ${i}`}
        >
          <Star
            className={cn(
              "size-3.5",
              i <= value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function StarredCell({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onChange(!value)
      }}
      className="p-1 rounded hover:bg-accent"
      aria-label={value ? "Unstar" : "Star"}
    >
      <Star
        className={cn(
          "size-4",
          value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/60"
        )}
      />
    </button>
  )
}
