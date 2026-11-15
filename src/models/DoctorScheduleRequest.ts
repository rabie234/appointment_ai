import mongoose, { Schema, type Document, type Model } from "mongoose";
import { DAYS, type DayHours } from "@/lib/schedule";

export type DoctorScheduleRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface IDoctorScheduleRequest extends Document {
  doctor: mongoose.Types.ObjectId;
  requestedSchedule: DayHours[];
  reason?: string;
  status: DoctorScheduleRequestStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TimeIntervalSchema = new Schema(
  {
    open: {
      type: String,
      required: true,
    },
    close: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const DayHoursSchema = new Schema<DayHours>(
  {
    day: {
      type: String,
      enum: DAYS,
      required: true,
    },
    open: {
      type: String,
      required: true,
    },
    close: {
      type: String,
      required: true,
    },
    closed: {
      type: Boolean,
      required: true,
      default: false,
    },
    intervals: {
      type: [TimeIntervalSchema],
      default: undefined,
    },
  },
  { _id: false }
);

const DoctorScheduleRequestSchema =
  new Schema<IDoctorScheduleRequest>(
    {
      doctor: {
        type: Schema.Types.ObjectId,
        ref: "Doctor",
        required: true,
        index: true,
      },
      requestedSchedule: {
        type: [DayHoursSchema],
        required: true,
      },
      reason: {
        type: String,
        trim: true,
        maxlength: 500,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "cancelled"],
        default: "pending",
        required: true,
        index: true,
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: {
        type: Date,
      },
      adminNote: {
        type: String,
        trim: true,
        maxlength: 500,
      },
    },
    { timestamps: true }
  );

DoctorScheduleRequestSchema.index(
  { doctor: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

const DoctorScheduleRequest: Model<IDoctorScheduleRequest> =
  mongoose.models.DoctorScheduleRequest ||
  mongoose.model<IDoctorScheduleRequest>(
    "DoctorScheduleRequest",
    DoctorScheduleRequestSchema
  );

export default DoctorScheduleRequest;