import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/user"
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from "@/lib/auth"
import { normalizeMobile } from "@/lib/permissions"

const bodySchema = z.object({
  mobile: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().min(1),
})

export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  await connectDB()
  const rawIdentifier = parsed.data.mobile ?? parsed.data.username
  const mobile = rawIdentifier ? normalizeMobile(rawIdentifier) : undefined
  const user = await User.findOne(
    rawIdentifier
      ? { $or: [{ mobile }, { username: rawIdentifier }] }
      : { username: parsed.data.username }
  )
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const token = await signSession({
    uid: user._id.toString(),
    username: user.username,
    mobile: user.mobile ?? undefined,
    role: user.role ?? "admin",
  })

  const res = NextResponse.json({
    ok: true,
    user: { username: user.username, mobile: user.mobile, role: user.role },
  })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
  return res
}
