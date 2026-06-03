import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import mongoose from "mongoose"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/user"
import { requireSession, UnauthorizedError } from "@/lib/session"
import { forbidden, isAdmin, normalizeMobile } from "@/lib/permissions"

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  mobile: z.string().trim().min(6).max(20).optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(["admin", "user"]).optional(),
})

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireSession()
    if (!isAdmin(session)) return forbidden()

    const { userId } = await ctx.params
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const json = await req.json().catch(() => null)
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    await connectDB()
    const user = await User.findById(userId)
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (parsed.data.name !== undefined) user.username = parsed.data.name
    if (parsed.data.mobile !== undefined)
      user.mobile = normalizeMobile(parsed.data.mobile)
    if (parsed.data.role !== undefined) user.role = parsed.data.role
    if (parsed.data.password) {
      user.passwordHash = await bcrypt.hash(parsed.data.password, 12)
    }
    await user.save()

    return NextResponse.json({
      user: {
        _id: user._id,
        username: user.username,
        mobile: user.mobile,
        role: user.role,
      },
    })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    throw err
  }
}
