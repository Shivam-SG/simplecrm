import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { sendPasswordResetOtp } from "@/lib/msg91"
import { User } from "@/lib/models/user"
import { normalizeMobile } from "@/lib/permissions"

const bodySchema = z.object({
  mobile: z.string().trim().min(6).max(20),
})

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid mobile number" },
      { status: 400 }
    )
  }

  await connectDB()
  const mobile = normalizeMobile(parsed.data.mobile)
  const user = await User.findOne({ mobile })

  if (!user) {
    return NextResponse.json(
      { error: "Mobile number not found" },
      { status: 404 }
    )
  }

  const otp = generateOtp()
  user.resetOtpHash = await bcrypt.hash(otp, 12)
  user.resetOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
  user.resetOtpVerifiedAt = undefined
  await user.save()

  try {
    await sendPasswordResetOtp(mobile, otp)
  } catch (error) {
    console.error("Failed to send password reset OTP via MSG91", error)
    return NextResponse.json(
      { error: "Could not send OTP message" },
      { status: 502 }
    )
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`Password reset OTP for ${mobile}: ${otp}`)
  }

  return NextResponse.json({
    ok: true,
    devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
  })
}
