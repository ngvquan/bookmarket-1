import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sequence: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    clientId: { type: String, required: true, maxlength: 80 },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
messageSchema.index({ conversationId: 1, sequence: 1 }, { unique: true });
messageSchema.index(
  { conversationId: 1, senderId: 1, clientId: 1 },
  { unique: true },
);
messageSchema.index({ recipientId: 1, readAt: 1, conversationId: 1 });
export default mongoose.model("Message", messageSchema);
