import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page } from "@/lib/models/page"
import { RecordModel } from "@/lib/models/record"
import { StatusAuditModel } from "@/lib/models/status-audit"
import { requireSession, UnauthorizedError } from "@/lib/session"
import { forbidden, isAdmin } from "@/lib/permissions"

type AuditRow = {
  _id: mongoose.Types.ObjectId
  pageId: mongoose.Types.ObjectId
  recordId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  username: string
  fromStatus: string
  toStatus: string
  action: "single" | "bulk"
  createdAt: Date
}

type AuditEvent = {
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function getRangeFilter(url: URL) {
  const range = url.searchParams.get("range") ?? "all"
  const today = new Date()

  if (range === "today") {
    return {
      label: "Today",
      filter: { createdAt: { $gte: startOfDay(today), $lte: endOfDay(today) } },
    }
  }

  if (range === "yesterday") {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    return {
      label: "Yesterday",
      filter: {
        createdAt: { $gte: startOfDay(yesterday), $lte: endOfDay(yesterday) },
      },
    }
  }

  if (range === "custom") {
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const createdAt: Record<string, Date> = {}
    if (from) createdAt.$gte = new Date(`${from}T00:00:00.000Z`)
    if (to) createdAt.$lte = new Date(`${to}T23:59:59.999Z`)
    return {
      label: "Custom",
      filter: Object.keys(createdAt).length ? { createdAt } : {},
    }
  }

  return { label: "All time", filter: {} }
}

function getRecordTitle(
  record: Record<string, unknown> | null | undefined,
  titleField: string
) {
  if (!record) return ""
  const value = titleField ? record[titleField] : undefined
  if (value === undefined || value === null || value === "") return ""
  return String(value)
}

function toEvent(row: AuditRow, pageMap: Map<string, { name: string; titleField: string }>, recordMap: Map<string, { data: Record<string, unknown>; status: string }>): AuditEvent {
  const page = pageMap.get(String(row.pageId))
  const record = recordMap.get(String(row.recordId))
  const titleField = page?.titleField ?? ""
  return {
    _id: String(row._id),
    userId: String(row.userId),
    username: row.username,
    pageId: String(row.pageId),
    pageName: page?.name ?? "Unknown page",
    recordId: String(row.recordId),
    recordTitle:
      getRecordTitle(record?.data, titleField) || String(row.recordId),
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    action: row.action,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    if (!isAdmin(session)) return forbidden()

    await connectDB()

    const url = new URL(req.url)
    const rangeInfo = getRangeFilter(url)
    const auditFilter = { ...(rangeInfo.filter as Record<string, unknown>) }

    const [byUser, eventsRaw, todayRaw] = await Promise.all([
      StatusAuditModel.aggregate<{
        _id: { userId: mongoose.Types.ObjectId; username: string }
        changes: number
        statuses: string[]
        lastChangedAt: Date
      }>([
        { $match: auditFilter },
        {
          $group: {
            _id: { userId: "$userId", username: "$username" },
            changes: { $sum: 1 },
            statuses: { $addToSet: "$toStatus" },
            lastChangedAt: { $max: "$createdAt" },
          },
        },
        { $sort: { lastChangedAt: -1 } },
      ]),
      StatusAuditModel.find(
        auditFilter,
        { pageId: 1, recordId: 1, userId: 1, username: 1, fromStatus: 1, toStatus: 1, action: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(200)
        .lean<AuditRow[]>(),
      StatusAuditModel.find(
        {
          createdAt: {
            $gte: startOfDay(new Date()),
            $lte: endOfDay(new Date()),
          },
        },
        { pageId: 1, recordId: 1, userId: 1, username: 1, fromStatus: 1, toStatus: 1, action: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .limit(200)
        .lean<AuditRow[]>(),
    ])

    const pageIds = Array.from(
      new Set(eventsRaw.map((row) => String(row.pageId)).concat(todayRaw.map((row) => String(row.pageId))))
    )
    const recordIds = Array.from(
      new Set(eventsRaw.map((row) => String(row.recordId)).concat(todayRaw.map((row) => String(row.recordId))))
    )

    const [pages, records] = await Promise.all([
      Page.find({ _id: { $in: pageIds } }, { name: 1, titleField: 1 }).lean(),
      RecordModel.find(
        { _id: { $in: recordIds } },
        { data: 1, status: 1 }
      ).lean(),
    ])

    const pageMap = new Map<string, { name: string; titleField: string }>(
      pages.map((page) => [String(page._id), { name: page.name, titleField: page.titleField ?? "" }])
    )
    const recordMap = new Map<string, { data: Record<string, unknown>; status: string }>(
      records.map((record) => [String(record._id), { data: record.data as Record<string, unknown>, status: record.status }])
    )

    return NextResponse.json({
      range: rangeInfo.label,
      byUser: byUser.map((row) => ({
        userId: String(row._id.userId),
        username: row._id.username,
        changes: row.changes,
        statuses: row.statuses,
        lastChangedAt: row.lastChangedAt,
      })),
      events: eventsRaw.map((row) => toEvent(row, pageMap, recordMap)),
      today: todayRaw.map((row) => toEvent(row, pageMap, recordMap)),
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}