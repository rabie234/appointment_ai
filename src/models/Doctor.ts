import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDoctor extends Document {
  name: string;
  specialty: string;
  email: string;
  phone?: string;
  image?: string;
  rating: number;
  reviews: number;
  experience: string;
  successRate: number;
  totalPatients: number;
  workingHours: {
    day: string;
    hours: string;
  }[];
  status: 'active' | 'inactive';
  availability: 'available' | 'on-leave';
  joinedDate: Date;
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
    workingHours: [
      {
        day: String,
        hours: String,
      },
    ],
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
  },
  {
    timestamps: true,
  }
);

const Doctor: Model<IDoctor> = mongoose.models.Doctor || mongoose.model<IDoctor>('Doctor', DoctorSchema);

export default Doctor;
