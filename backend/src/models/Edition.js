// Phiên bản xuất bản; ISBN có giá trị là duy nhất, không có ISBN thì bỏ field này.
import mongoose from "mongoose";
const editionSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },
    isbn: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
      match: /^(\d{9}[\dX]|\d{13})$/,
    },
    publisherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publisher",
      default: null,
    },
    year: { type: Number, min: 1400, max: 2100, validate: Number.isInteger },
    binding: {
      type: String,
      enum: ["Bìa mềm", "Bìa cứng", "PDF"],
      default: "Bìa mềm",
    },
  },
  {
    timestamps: true,
  },
);
editionSchema.index({ publisherId: 1 });
export default mongoose.model("Edition", editionSchema);
