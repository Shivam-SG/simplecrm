import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose"

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    mobile: { type: String, unique: true, sparse: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
      required: true,
    },
    passwordHash: { type: String, required: true },
    resetOtpHash: { type: String },
    resetOtpExpiresAt: { type: Date },
    resetOtpVerifiedAt: { type: Date },
  },
  { timestamps: true }
)

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId
}

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ||
  mongoose.model<UserDoc>("User", userSchema)
