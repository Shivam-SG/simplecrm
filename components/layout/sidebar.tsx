"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRouter } from "next/navigation"
import { useState } from "react"
import useSWR from "swr"
import { LayoutDashboard, Layers, Star, Users, MoreVertical, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
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
import { mutate as globalMutate } from "swr"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pages", label: "All Pages", icon: Layers },
]

const ADMIN_NAV = [{ href: "/users", label: "Users", icon: Users }]

type SidebarPage = {
  _id: string
  name: string
  icon?: string | null
  starred?: boolean
}

const fetcher = (url: string) =>
  fetch(url).then((r) => (r.ok ? r.json() : { pages: [] }))

export function AppSidebar() {
  const pathname = usePathname()
  const { data } = useSWR<{ pages: SidebarPage[] }>("/api/pages", fetcher)
  const { data: me } = useSWR<{ user: { role: "admin" | "user" } }>(
    "/api/auth/me",
    fetcher
  )
  const all = data?.pages ?? []
  const starred = all.filter((p) => p.starred)
  const others = all.filter((p) => !p.starred)

  return (
    <UISidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          className="flex items-center px-2 py-1"
          aria-label="SimpleCRM"
        >
          <img
            src="/simple-crm-icon.svg"
            alt=""
            className="hidden size-6 shrink-0 group-data-[collapsible=icon]:block"
          />
          <img
            src="/simple-crm-logo.svg"
            alt="SimpleCRM"
            className="h-7 w-auto group-data-[collapsible=icon]:hidden"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {[...NAV, ...(me?.user?.role === "admin" ? ADMIN_NAV : [])].map(
                (item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/pages" &&
                      pathname.startsWith(item.href + "/"))
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                }
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {starred.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Starred</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {starred.map((p) => (
                  <PageItem
                    key={p._id}
                    page={p}
                    pathname={pathname}
                    canManage={me?.user?.role === "admin"}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {others.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pages</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {others.map((p) => (
                  <PageItem
                    key={p._id}
                    page={p}
                    pathname={pathname}
                    canManage={me?.user?.role === "admin"}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarRail />
    </UISidebar>
  )
}

function PageItem({
  page,
  pathname,
  canManage,
}: {
  page: SidebarPage
  pathname: string
  canManage: boolean
}) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const href = `/pages/${page._id}`
  const active = pathname === href

  async function confirmDelete() {
    const res = await fetch(`/api/pages/${page._id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete page")
      return
    }
    toast.success("Page deleted")
    setDeleteOpen(false)
    globalMutate("/api/pages")
    globalMutate("/api/pages?starred=1")
    if (active) router.push("/pages")
  }

  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-1">
        <SidebarMenuButton asChild isActive={active} tooltip={page.name}>
          <Link href={href}>
            <span className="text-base leading-none">
              {page.icon || <Star className="size-4" />}
            </span>
            <span className="truncate">{page.name}</span>
          </Link>
        </SidebarMenuButton>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label="Page actions"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{page.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the page and all of its records. This cannot be undone.
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
    </SidebarMenuItem>
  )
}
