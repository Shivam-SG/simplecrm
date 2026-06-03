import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/user"
import { requireSession, UnauthorizedError } from "@/lib/session"
import { forbidden, isAdmin, normalizeMobile } from "@/lib/permissions"

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mobile: z.string().trim().min(6).max(20),
  password: z.string().min(6).max(100),
  role: z.enum(["admin", "user"]).default("user"),
})

export async function GET() {
  try {
    const session = await requireSession()
    if (!isAdmin(session)) return forbidden()

    await connectDB()
    const users = await User.find({}, { passwordHash: 0 })
      .sort({ createdAt: -1 })
      .lean()
    return NextResponse.json({ users })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession()
    if (!isAdmin(session)) return forbidden()

    const json = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    await connectDB()
    const mobile = normalizeMobile(parsed.data.mobile)
    const existing = await User.findOne({ mobile })
    if (existing) {
      return NextResponse.json(
        { error: "Mobile number already exists" },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12)
    const user = await User.create({
      username: parsed.data.name,
      mobile,
      role: parsed.data.role,
      passwordHash,
    })

    return NextResponse.json({
      user: {
        _id: user._id,
        username: user.username,
        mobile: user.mobile,
        role: user.role,
        createdAt: user.createdAt,
      },
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
