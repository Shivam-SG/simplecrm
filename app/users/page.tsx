"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  CalendarDays,
  Search,
  UserPlus,
  Clock3,
  ChevronRight,
} from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type UserRow = {
  _id: string
  username: string
  mobile?: string
  role: "admin" | "user"
  createdAt?: string
}

type StatusAuditSummary = {
  userId: string
  username: string
  changes: number
  statuses: string[]
  lastChangedAt: string
}

type StatusAuditEvent = {
  _id: string
  userId: string
  username: string
  pageId: string
  pageName: string
  recordId: string
  recordTitle: string
  fromStatus: string
  toStatus: string
  action: "single" | "bulk"
  createdAt: string
}

type AuditResponse = {
  range: string
  byUser: StatusAuditSummary[]
  events: StatusAuditEvent[]
  today: StatusAuditEvent[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function matchesSearch(user: UserRow, query: string) {
  if (!query.trim()) return true
  const term = query.trim().toLowerCase()
  return (
    user.username.toLowerCase().includes(term) ||
    (user.mobile ?? "").toLowerCase().includes(term)
  )
}

export default function UsersPage() {
  const { data, mutate } = useSWR<{ users: UserRow[] }>("/api/users", fetcher)
  const [range, setRange] = useState<"all" | "today" | "yesterday" | "custom">("today")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [search, setSearch] = useState("")
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const auditQuery = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set("range", range)
    if (range === "custom") {
      if (from) sp.set("from", from)
      if (to) sp.set("to", to)
    }
    return `/api/users/status-audit?${sp.toString()}`
  }, [range, from, to])

  const { data: audit } = useSWR<AuditResponse>(auditQuery, fetcher)

  const users = data?.users ?? []
  const filteredUsers = useMemo(
    () => users.filter((user) => matchesSearch(user, search)),
    [users, search]
  )

  const updateMap = useMemo(() => {
    const map = new Map<string, StatusAuditSummary>()
    for (const row of audit?.byUser ?? []) map.set(row.userId, row)
    return map
  }, [audit])

  const selectedUser = selectedUserId
    ? filteredUsers.find((user) => user._id === selectedUserId) ??
      users.find((user) => user._id === selectedUserId) ??
      null
    : null

  const selectedUserEvents = useMemo(() => {
    if (!selectedUserId) return []
    return (audit?.events ?? []).filter((event) => event.userId === selectedUserId)
  }, [audit, selectedUserId])

  const selectedUserToday = useMemo(() => {
    if (!selectedUserId) return []
    return (audit?.today ?? []).filter((event) => event.userId === selectedUserId)
  }, [audit, selectedUserId])

  async function createUser(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim()
    const mobile = String(formData.get("mobile") ?? "").trim()
    const password = String(formData.get("password") ?? "").trim()
    const role = String(formData.get("role") ?? "user") as "admin" | "user"

    if (!name || !mobile || !password) {
      toast.error("All fields are required")
      return
    }

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mobile, password, role }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(body.error || "User create failed")
      return
    }

    toast.success("User added")
    setAddOpen(false)
    mutate()
  }

  return (
    <AppShell title="Users">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">
            Search users and inspect status changes.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <UserPlus className="size-4" /> Add user
        </Button>
      </div>

      
          <div className="relative min-w-0 mb-4">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or mobile"
              className="h-10 pl-9"
            />
          </div>
        

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">All users</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
              <SelectTrigger className="h-10 w-40 gap-2">
                <CalendarDays className="size-4" />
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="custom">Select range</SelectItem>
              </SelectContent>
            </Select>

            {range === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-10 w-40"
                />
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-10 w-40"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredUsers.map((user) => {
            const summary = updateMap.get(user._id)
            return (
              <button
                key={user._id}
                type="button"
                onClick={() => setSelectedUserId(user._id)}
                className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{user.username}</span>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {user.mobile || "No mobile"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {summary?.changes ?? 0} updates
                  </Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </button>
            )
          })}
          {filteredUsers.length === 0 && (
            <p className="text-sm text-muted-foreground">No users match the search.</p>
          )}
        </CardContent>
      </Card>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={createUser} />

      <UserDetailSheet
        open={selectedUser !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedUserId(null)
        }}
        user={selectedUser}
        summary={selectedUser ? updateMap.get(selectedUser._id) ?? null : null}
        rangeLabel={audit?.range ?? "All time"}
        rangeEvents={selectedUserEvents}
        todayEvents={selectedUserToday}
      />
    </AppShell>
  )
}

function AddUserDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (payload: {
    name: string
    mobile: string
    password: string
    role: "admin" | "user"
  }) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [mobile, setMobile] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<"admin" | "user">("user")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void onSubmit({ name, mobile, password, role })
          }}
        >
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Create a new user account and assign a role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="add-name">Name</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-mobile">Mobile number</Label>
            <Input
              id="add-mobile"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-password">Password</Label>
            <Input
              id="add-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger id="add-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add user</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UserDetailSheet({
  open,
  onOpenChange,
  user,
  summary,
  rangeLabel,
  rangeEvents,
  todayEvents,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: UserRow | null
  summary: StatusAuditSummary | null
  rangeLabel: string
  rangeEvents: StatusAuditEvent[]
  todayEvents: StatusAuditEvent[]
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="space-y-2 px-6 pt-6">
          <SheetTitle>{user?.username ?? "User details"}</SheetTitle>
          <SheetDescription>
            {user?.mobile || "No mobile"}
          </SheetDescription>
        </SheetHeader>

        {user && (
          <div className="space-y-5 px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Role</div>
                <Badge className="mt-1" variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Updates</div>
                <div className="mt-1 text-lg font-semibold">{summary?.changes ?? 0}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Range</div>
                <div className="mt-1 text-sm font-medium">{rangeLabel}</div>
              </div>
            </div>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock3 className="size-4" />
                Status updates in selected range
              </div>
              <div className="space-y-2">
                {rangeEvents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No status changes in this range.</p>
                )}
                {rangeEvents.map((event) => (
                  <div key={event._id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{event.pageName}</div>
                      <Badge variant="outline">
                        {event.action === "bulk" ? "Bulk" : "Single"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Record: {event.recordTitle}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {event.fromStatus || "—"} → {event.toStatus}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="size-4" />
                Today&apos;s updates
              </div>
              <div className="space-y-2">
                {todayEvents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No updates today.</p>
                )}
                {todayEvents.map((event) => (
                  <div key={event._id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{event.pageName}</div>
                      <Badge variant="outline">
                        {event.action === "bulk" ? "Bulk" : "Single"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Record: {event.recordTitle}
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {event.fromStatus || "—"} → {event.toStatus}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}