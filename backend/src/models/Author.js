// Tác giả được dùng lại bởi nhiều tác phẩm; nameSearch để tìm không dấu.
import mongoose from "mongoose";
const authorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    biography: {
      type: String,
      default: "",
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
export default mongoose.model("Author", authorSchema);
