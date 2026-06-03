import "dotenv/config"
import bcrypt from "bcryptjs"
import { connectDB } from "../lib/db"
import { User } from "../lib/models/user"
import { normalizeMobile } from "../lib/permissions"

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const val = argv[i + 1]
      if (val && !val.startsWith("--")) {
        out[key] = val
        i++
      }
    }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const username = args.username
  const mobile = args.mobile ? normalizeMobile(args.mobile) : undefined
  const password = args.password

  if (!username || !mobile || !password) {
    console.error(
      "Usage: tsx scripts/seed-user.ts --username <u> --mobile <m> --password <p>"
    )
    process.exit(1)
  }

  await connectDB()

  const existing = await User.findOne({ $or: [{ username }, { mobile }] })
  const passwordHash = await bcrypt.hash(password, 12)

  if (existing) {
    existing.passwordHash = passwordHash
    existing.username = username
    existing.mobile = mobile
    existing.role = "admin"
    await existing.save()
    console.log(`Updated admin "${username}"`)
  } else {
    await User.create({ username, mobile, passwordHash, role: "admin" })
    console.log(`Created admin "${username}"`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
