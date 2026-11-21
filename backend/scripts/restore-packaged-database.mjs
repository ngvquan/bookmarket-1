// Restore the database bundled with the source ZIP into an empty database only.
import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const uri = process.argv[2];
const folder = path.resolve(process.argv[3] || path.join(root, "database"));
if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
  console.error(
    'Usage: node backend/scripts/restore-packaged-database.mjs "mongodb://127.0.0.1:27017/bookmarket_restore" [backup-folder]',
  );
  process.exit(1);
}

let client;
try {
  const metadata = JSON.parse(
    await fs.readFile(path.join(folder, "schema.json"), "utf8"),
  );
  // Validate every data file before connecting or writing anything.
  const collections = [];
  for (const info of metadata.collections) {
    if (!/^[a-zA-Z0-9_-]+$/.test(info.name))
      throw new Error("Invalid collection name in backup.");
    const records = mongoose.mongo.BSON.EJSON.parse(
      await fs.readFile(path.join(folder, "data", `${info.name}.json`), "utf8"),
      { relaxed: false },
    );
    if (!Array.isArray(records) || records.length !== info.documents) {
      throw new Error(`Record count mismatch: ${info.name}`);
    }
    collections.push({ ...info, records });
  }
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (!databaseName || ["admin", "local", "config"].includes(databaseName)) {
    throw new Error("Specify a new application database in the URI.");
  }
  client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  const db = client.db(databaseName);
  if ((await db.listCollections({}, { nameOnly: true }).toArray()).length) {
    throw new Error(
      "Target database already contains collections. Choose a new database; nothing was overwritten.",
    );
  }
  for (const info of collections) {
    await db.createCollection(info.name);
    const collection = db.collection(info.name);
    for (let start = 0; start < info.records.length; start += 1000) {
      await collection.insertMany(info.records.slice(start, start + 1000));
    }
    for (const index of info.indexes || []) {
      if (index.name === "_id_") continue;
      const { key, v, ns, ...options } = index;
      await collection.createIndex(key, options);
    }
    console.log(
      `${info.name}: ${await collection.countDocuments()} records restored`,
    );
  }
  console.log(
    `Restored ${collections.length} collections into ${databaseName}, including indexes. Set backend/.env MONGO_URI to this database.`,
  );
} catch (error) {
  // Do not print the connection URI or credentials on failure.
  console.error(
    `Restore failed: ${error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, "[MongoDB URI]")}`,
  );
  console.error(
    "If a restore was interrupted, retry using a different empty database.",
  );
  process.exitCode = 1;
} finally {
  await client?.close();
}
