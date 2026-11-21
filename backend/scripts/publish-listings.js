import "dotenv/config";
import mongoose from "mongoose";
import { publishPendingListings } from "../src/migrations/publish-listings.js";

try {
  await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: false,
    autoCreate: false,
  });
  console.log(
    JSON.stringify(
      await publishPendingListings({ apply: process.argv.includes("--apply") }),
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
