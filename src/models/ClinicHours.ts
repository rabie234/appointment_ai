import mongoose, { Schema, Document, Model } from "mongoose";
import {
  DAYS,
  type Day,
  type DayHours,
  defaultWeek,
} from "@/lib/schedule";

export interface IClinicHours extends Document {
  key: string;
  hours: DayHours[];
  version: number;
  lastChangedDays: Day[];
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
    lastChangedDays: {
      type: [{ type: String, enum: DAYS }],
      default: [],
    },
  },
  { timestamps: true }
);

const ClinicHours: Model<IClinicHours> =
  mongoose.models.ClinicHours ||
  mongoose.model<IClinicHours>("ClinicHours", ClinicHoursSchema);

export default ClinicHours;