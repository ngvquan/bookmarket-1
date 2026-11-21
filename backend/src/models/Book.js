// Tác phẩm không chứa ISBN/giá; một tác phẩm có thể có nhiều phiên bản xuất bản.
import mongoose from "mongoose";
const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    authorIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Author",
        },
      ],
      required: true,
      validate: (ids) => ids.length >= 1 && ids.length <= 10,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    titleSearch: {
      type: String,
      required: true,
      index: true,
    },
    // Khóa từ tên/tác giả/thể loại giúp upsert không tạo trùng tác phẩm khi gửi đồng thời.
    catalogKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);
bookSchema.index({ authorIds: 1 });
bookSchema.index({ categoryId: 1 });
export default mongoose.model("Book", bookSchema);
