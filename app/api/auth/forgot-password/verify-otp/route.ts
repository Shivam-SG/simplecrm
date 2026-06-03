import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/user"
import { normalizeMobile } from "@/lib/permissions"

const bodySchema = z.object({
  mobile: z.string().trim().min(6).max(20),
  otp: z.string().trim().length(6),
})

export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 })
  }

  await connectDB()
  const mobile = normalizeMobile(parsed.data.mobile)
  const user = await User.findOne({ mobile })
  if (!user?.resetOtpHash || !user.resetOtpExpiresAt) {
    return NextResponse.json({ error: "OTP not requested" }, { status: 400 })
  }

  if (user.resetOtpExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "OTP expired" }, { status: 400 })
  }

  const ok = await bcrypt.compare(parsed.data.otp, user.resetOtpHash)
  if (!ok) return NextResponse.json({ error: "Invalid OTP" }, { status: 400 })

  user.resetOtpVerifiedAt = new Date()
  await user.save()

  return NextResponse.json({ ok: true })
}
