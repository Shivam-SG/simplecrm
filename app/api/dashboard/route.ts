import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { Page } from "@/lib/models/page"
import { RecordModel } from "@/lib/models/record"
import { requireSession, UnauthorizedError } from "@/lib/session"
import { isAdmin } from "@/lib/permissions"

export async function GET() {
  try {
    const session = await requireSession()
    await connectDB()
    const ownerMatch: Record<string, unknown> = {}
    if (isAdmin(session))
      ownerMatch.userId = new mongoose.Types.ObjectId(session.uid)

    const [pages, totalRecords, statusBreakdown, perPage] = await Promise.all([
      Page.countDocuments(ownerMatch),
      RecordModel.countDocuments(ownerMatch),
      RecordModel.aggregate([
        { $match: ownerMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Page.aggregate([
        { $match: ownerMatch },
        {
          $lookup: {
            from: "records",
            let: { pid: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$pageId", "$$pid"] } } },
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            as: "statusBreakdown",
          },
        },
        {
          $addFields: {
            recordCount: {
              $sum: "$statusBreakdown.count",
            },
          },
        },
        { $sort: { starred: -1, updatedAt: -1 } },
        {
          $project: {
            schema: 0,
          },
        },
      ]),
    ])

    const statusMap: Record<string, number> = {}
    for (const s of statusBreakdown) {
      statusMap[s._id || "unset"] = s.count
    }
    const contacted = totalRecords - (statusMap["new"] || 0)
    const converted = statusMap["converted"] || 0

    return NextResponse.json({
      totals: {
        pages,
        records: totalRecords,
        contactedPct:
          totalRecords > 0 ? Math.round((contacted / totalRecords) * 100) : 0,
        convertedPct:
          totalRecords > 0 ? Math.round((converted / totalRecords) * 100) : 0,
      },
      statusBreakdown: statusMap,
      pages: perPage,
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
