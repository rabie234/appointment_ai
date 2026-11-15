import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISpecialty extends Document {
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
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
    nameAr: {
  type: String,
  trim: true,
},
    description: {
  type: String,
  trim: true,
},
descriptionAr: {
  type: String,
  trim: true,
  default: "",
},
    
  },
  {
    timestamps: true,
  }
);

const Specialty: Model<ISpecialty> =
  mongoose.models.Specialty || mongoose.model<ISpecialty>('Specialty', SpecialtySchema);

export default Specialty;
