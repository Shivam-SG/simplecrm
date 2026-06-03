import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose"

export const DEFAULT_STATUS_OPTIONS = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "call_not_picked",
  "not_answered",
  "call_back",
]

const LEGACY_STATUS_OPTIONS = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "converted",
  "junk",
]

const STATUS_REMAP: Record<string, string> = {
  converted: "call_not_picked",
  junk: "not_answered",
}

export function normalizeStatusOptions(statusOptions?: string[] | null) {
  const cleaned = (statusOptions ?? [])
    .map((status) => status.trim())
    .filter(Boolean)

  if (cleaned.length === 0) return [...DEFAULT_STATUS_OPTIONS]

  const isLegacyDefault =
    cleaned.length === LEGACY_STATUS_OPTIONS.length &&
    LEGACY_STATUS_OPTIONS.every((status) => cleaned.includes(status))

  if (isLegacyDefault) return [...DEFAULT_STATUS_OPTIONS]

  const normalized: string[] = []
  for (const status of cleaned) {
    const nextStatus = STATUS_REMAP[status] ?? status
    if (!normalized.includes(nextStatus)) normalized.push(nextStatus)
  }

  return normalized
}

const schemaFieldSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, required: true },
    visible: { type: Boolean, default: true },
    pinned: { type: Boolean, default: false },
  },
  { _id: false }
)

const pageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "" },
    starred: { type: Boolean, default: false },
    schema: { type: [schemaFieldSchema], default: [] },
    titleField: { type: String, default: "" },
    dedupField: { type: String, default: "" },
    statusOptions: { type: [String], default: DEFAULT_STATUS_OPTIONS },
  },
  { timestamps: true }
)

pageSchema.index({ userId: 1, starred: -1, updatedAt: -1 })

export type PageDoc = InferSchemaType<typeof pageSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export const Page: Model<PageDoc> =
  (mongoose.models.Page as Model<PageDoc>) ||
  mongoose.model<PageDoc>("Page", pageSchema)
