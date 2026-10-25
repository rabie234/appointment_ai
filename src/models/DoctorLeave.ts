
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDoctorLeave extends Document {
  doctor: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorLeaveSchema = new Schema<IDoctorLeave>(
  {
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

DoctorLeaveSchema.index({ doctor: 1, startDate: 1, endDate: 1 });

const DoctorLeave: Model<IDoctorLeave> =
  mongoose.models.DoctorLeave ||
  mongoose.model<IDoctorLeave>("DoctorLeave", DoctorLeaveSchema);

export default DoctorLeave;
