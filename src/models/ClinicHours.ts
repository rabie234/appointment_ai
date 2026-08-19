import mongoose, { Schema, Document, Model } from 'mongoose';
import { type DayHours, defaultWeek } from '@/lib/schedule';

/**
 * A singleton document holding the clinic's weekly opening hours. We pin it to a
 * fixed `key` so `findOneAndUpdate({ key: 'clinic' }, …, { upsert: true })`
 * always targets the one-and-only record — there is never more than one.
 */
export interface IClinicHours extends Document {
  key: string;
  hours: DayHours[];
  createdAt: Date;
  updatedAt: Date;
}

const DayHoursSchema = new Schema<DayHours>(
  {
    day: { type: String, required: true },
    open: { type: String, default: '09:00' },
    close: { type: String, default: '17:00' },
    closed: { type: Boolean, default: false },
  },
  { _id: false }
);

const ClinicHoursSchema = new Schema<IClinicHours>(
  {
    key: {
      type: String,
      default: 'clinic',
      unique: true,
    },
    hours: {
      type: [DayHoursSchema],
      default: defaultWeek,
    },
  },
  { timestamps: true }
);

const ClinicHours: Model<IClinicHours> =
  mongoose.models.ClinicHours ||
  mongoose.model<IClinicHours>('ClinicHours', ClinicHoursSchema);

export default ClinicHours;
