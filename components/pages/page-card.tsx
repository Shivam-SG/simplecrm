"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Star, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { mutate as globalMutate } from "swr"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { RenameDialog } from "./rename-dialog"
import type { PageSummary } from "@/hooks/use-pages"

function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

export function PageCard({
  page,
  onMutate,
  canManage,
}: {
  page: PageSummary
  onMutate: () => void
  canManage: boolean
}) {
  const router = useRouter()
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function toggleStar(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const res = await fetch(`/api/pages/${page._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: !page.starred }),
    })
    if (!res.ok) {
      toast.error("Failed to update")
      return
    }
    onMutate()
    globalMutate("/api/pages")
  }

  async function confirmDelete() {
    const res = await fetch(`/api/pages/${page._id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete")
      return
    }
    toast.success("Page deleted")
    onMutate()
    globalMutate("/api/pages")
    setDeleteOpen(false)
  }

  return (
    <>
      <Link
        href={`/pages/${page._id}`}
        className="group relative block rounded-lg border bg-card p-4 transition hover:border-foreground/30 hover:shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-2xl leading-none">
            {page.icon || "📋"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate font-medium">{page.name}</h3>
              {canManage && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={toggleStar}
                    aria-label={page.starred ? "Unstar" : "Star"}
                  >
                    <Star
                      className={cn(
                        "size-4",
                        page.starred && "fill-yellow-400 text-yellow-400"
                      )}
                    />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      asChild
                      onClick={(e) => e.preventDefault()}
                    >
                      <Button variant="ghost" size="icon" className="size-7">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.preventDefault()}
                    >
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setRenameOpen(true)
                        }}
                      >
                        <Pencil className="size-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={(e) => {
                          e.preventDefault()
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{page.recordCount} records</span>
              <span>·</span>
              <span>updated {relativeTime(page.updatedAt)}</span>
            </div>
          </div>
        </div>
      </Link>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        pageId={page._id}
        initialName={page.name}
        initialIcon={page.icon}
        onUpdated={() => {
          onMutate()
          globalMutate("/api/pages")
          router.refresh()
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{page.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the page and all {page.recordCount} of its records.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
