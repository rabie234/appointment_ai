import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * A persisted AI-chat conversation for one patient. Messages are stored inline
 * (a conversation is small and always loaded whole), with an optional booking
 * suggestion attached to a model turn so the UI can re-render the Book card when
 * a past conversation is reopened.
 */

export interface IChatMessage {
  role: 'user' | 'model';
  text: string;
  suggestion?: {
    doctorId: string;
    doctorName: string;
    specialty: string;
    date: string;
    time: string;
  };
  createdAt: Date;
}

export interface IConversation extends Document {
  patient: mongoose.Types.ObjectId;
  title: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const SuggestionSchema = new Schema(
  {
    doctorId: String,
    doctorName: String,
    specialty: String,
    date: String,
    time: String,
  },
  { _id: false }
);

const MessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['user', 'model'], required: true },
    text: { type: String, default: '' },
    suggestion: { type: SuggestionSchema, default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'New conversation',
      trim: true,
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Most recent conversations first, per patient.
ConversationSchema.index({ patient: 1, updatedAt: -1 });

const Conversation: Model<IConversation> =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>('Conversation', ConversationSchema);

export default Conversation;
