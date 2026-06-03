import { NextResponse } from "next/server"
import type { SessionPayload } from "./auth"

export function isAdmin(session: Pick<SessionPayload, "role">) {
  return session.role === "admin"
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export function normalizeMobile(value: string) {
  return value.replace(/[^\d+]/g, "").trim()
}
