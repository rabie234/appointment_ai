import mongoose, { Schema, Document, Model } from "mongoose";
import { type DayHours, defaultWeek } from "@/lib/schedule";

export interface IClinicHours extends Document {
  key: string;
  hours: DayHours[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const TimeIntervalSchema = new Schema(
  {
    open: { type: String, required: true },
    close: { type: String, required: true },
  },
  { _id: false }
);

const DayHoursSchema = new Schema<DayHours>(
  {
    day: { type: String, required: true },
    open: { type: String, default: "09:00" },
    close: { type: String, default: "17:00" },
    closed: { type: Boolean, default: false },

    // Undefined by default so older records can still use open/close.
    intervals: {
      type: [TimeIntervalSchema],
      default: undefined,
    },
  },
  { _id: false }
);

const ClinicHoursSchema = new Schema<IClinicHours>(
  {
    key: {
      type: String,
      default: "clinic",
      unique: true,
    },
    hours: {
      type: [DayHoursSchema],
      default: defaultWeek,
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const ClinicHours: Model<IClinicHours> =
  mongoose.models.ClinicHours ||
  mongoose.model<IClinicHours>("ClinicHours", ClinicHoursSchema);

export default ClinicHours;