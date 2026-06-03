import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/user"
import { normalizeMobile } from "@/lib/permissions"

const bodySchema = z.object({
  mobile: z.string().trim().min(6).max(20),
  password: z.string().min(6).max(100),
  confirmPassword: z.string().min(6).max(100),
})

export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success || parsed.data.password !== parsed.data.confirmPassword) {
    return NextResponse.json(
      { error: "Passwords do not match" },
      { status: 400 }
    )
  }

  await connectDB()
  const mobile = normalizeMobile(parsed.data.mobile)
  const user = await User.findOne({ mobile })
  if (!user?.resetOtpVerifiedAt || !user.resetOtpExpiresAt) {
    return NextResponse.json(
      { error: "OTP verification required" },
      { status: 400 }
    )
  }

  if (
    user.resetOtpExpiresAt.getTime() < Date.now() ||
    user.resetOtpVerifiedAt.getTime() < Date.now() - 10 * 60 * 1000
  ) {
    return NextResponse.json(
      { error: "OTP verification expired" },
      { status: 400 }
    )
  }

  user.passwordHash = await bcrypt.hash(parsed.data.password, 12)
  user.resetOtpHash = undefined
  user.resetOtpExpiresAt = undefined
  user.resetOtpVerifiedAt = undefined
  await user.save()

  return NextResponse.json({ ok: true })
}
