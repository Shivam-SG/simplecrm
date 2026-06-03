import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const statusAuditSchema = new Schema(
  {
    pageId: {
      type: Schema.Types.ObjectId,
      ref: "Page",
      required: true,
      index: true,
    },
    recordId: {
      type: Schema.Types.ObjectId,
      ref: "Record",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    username: { type: String, required: true },
    fromStatus: { type: String, default: "" },
    toStatus: { type: String, required: true },
    action: { type: String, enum: ["single", "bulk"], required: true },
  },
  { timestamps: true }
)

statusAuditSchema.index({ pageId: 1, createdAt: -1 })
statusAuditSchema.index({ userId: 1, createdAt: -1 })

export type StatusAuditDoc = InferSchemaType<typeof statusAuditSchema> & {
  _id: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

export const StatusAuditModel: Model<StatusAuditDoc> =
  (mongoose.models.StatusAudit as Model<StatusAuditDoc>) ||
  mongoose.model<StatusAuditDoc>("StatusAudit", statusAuditSchema)