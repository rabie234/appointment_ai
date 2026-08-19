import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISpecialty extends Document {
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SpecialtySchema = new Schema<ISpecialty>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a specialty name'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Specialty: Model<ISpecialty> =
  mongoose.models.Specialty || mongoose.model<ISpecialty>('Specialty', SpecialtySchema);

export default Specialty;
