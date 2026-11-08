import mongoose, { Schema, Document, Model } from 'mongoose';
import { type DayHours, defaultWeek } from '@/lib/schedule';

export interface IDoctor extends Document {
  name: string;
  nameAr:string;
  specialty: string;
  email: string;
  phone?: string;
  image?: string;
  rating: number;
  reviews: number;
  experience: string;
  successRate: number;
  totalPatients: number;
  // The doctor's weekly availability *within* the clinic. `closed` on a day
  // means the doctor is off that day. Kept within clinic hours at write time.
  schedule: DayHours[];
  /** Clinic-hours version the doctor last acknowledged. */
  clinicHoursAcknowledgedVersion: string;
  status: 'active' | 'inactive';
  availability: 'available' | 'on-leave';
  joinedDate: Date;
  /** The login account (role 'doctor') this profile belongs to, once the admin enables one. */
  user?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a doctor name'],
      trim: true,
    },
     nameAr: {
      type: String,
      trim: true,
      default: '',
    },
    specialty: {
      type: String,
      required: [true, 'Please provide a specialty'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: {
      type: Number,
      default: 0,
    },
    experience: {
      type: String,
      default: '0 Years',
    },
    successRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    totalPatients: {
      type: Number,
      default: 0,
    },
    schedule: {
      type: [
        new Schema<DayHours>(
          {
            day: { type: String, required: true },
            open: { type: String, default: '09:00' },
            close: { type: String, default: '17:00' },
            closed: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: defaultWeek,
    },
    clinicHoursAcknowledgedVersion: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    availability: {
      type: String,
      enum: ['available', 'on-leave'],
      default: 'available',
    },
    joinedDate: {
      type: Date,
      default: Date.now,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

const Doctor: Model<IDoctor> = mongoose.models.Doctor || mongoose.model<IDoctor>('Doctor', DoctorSchema);

export default Doctor;
