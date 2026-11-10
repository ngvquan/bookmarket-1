import "dotenv/config";
import mongoose from "mongoose";
import { removeExchange } from "../src/migrations/remove-exchange.js";

try {
  await mongoose.connect(process.env.MONGO_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 5000,
  });
  console.log(
    JSON.stringify(
      await removeExchange({ apply: process.argv.includes("--apply") }),
      null,
      2,
    ),
  );
} finally {
  await mongoose.disconnect();
}
