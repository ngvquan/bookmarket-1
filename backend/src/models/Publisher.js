// Nhà xuất bản thuộc phiên bản sách, không lặp tên trong từng tin bán.
import mongoose from "mongoose";
const publisherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    nameSearch: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);
export default mongoose.model("Publisher", publisherSchema);
