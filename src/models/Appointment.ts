import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAppointment extends Document {
  patient: mongoose.Types.ObjectId;
  doctor: mongoose.Types.ObjectId;
  date: Date;
  time: string;
  type: 'video' | 'in-person';
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'missed';
  price: number;
  notes?: string;
  cancellationReason?: string;
  leaveConflict?: boolean;
  /** When the admin marked the patient as arrived (visit started). */
  startedAt?: Date;
  /** When the admin marked the visit finished. */
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Please provide a patient'],
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Please provide a doctor'],
    },
    date: {
      type: Date,
      required: [true, 'Please provide an appointment date'],
    },
    time: {
      type: String,
      required: [true, 'Please provide an appointment time'],
    },
    type: {
      type: String,
      enum: ['video', 'in-person'],
      required: [true, 'Please provide appointment type'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled','missed'],
      default: 'pending',
    },
    price: {
      type: Number,
      required: [true, 'Please provide appointment price'],
    },
    notes: {
      type: String,
      trim: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    cancellationReason: {
  type: String,
  trim: true,
    },
    leaveConflict: {
  type: Boolean,
  default: false,
},
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
AppointmentSchema.index({ patient: 1, date: 1 });
AppointmentSchema.index({ doctor: 1, date: 1 });
AppointmentSchema.index({ status: 1 });

AppointmentSchema.index(
  { doctor: 1, date: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
    },
  }
);

const Appointment: Model<IAppointment> =
  mongoose.models.Appointment || mongoose.model<IAppointment>('Appointment', AppointmentSchema);

export default Appointment;
