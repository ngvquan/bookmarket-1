// Sao chep toan bo collection tu MongoDB nguon sang MongoDB dich.
// Script chi upsert theo _id, khong xoa du lieu o database nguon hoac dich.
import mongoose from "mongoose";

const sourceUri = process.env.SOURCE_MONGO_URI;
const targetUri = process.env.TARGET_MONGO_URI;

if (!sourceUri || !targetUri) {
  throw new Error("Can SOURCE_MONGO_URI va TARGET_MONGO_URI.");
}

const MongoClient = mongoose.mongo.MongoClient;
const source = new MongoClient(sourceUri);
const target = new MongoClient(targetUri);

try {
  await source.connect();
  await target.connect();

  const sourceDb = source.db();
  const targetDb = target.db();
  const collections = (
    await sourceDb.listCollections({}, { nameOnly: true }).toArray()
  )
    .map(({ name }) => name)
    .filter((name) => !name.startsWith("system."))
    .sort();

  for (const name of collections) {
    const documents = await sourceDb.collection(name).find({}).toArray();
    let copied = 0;

    // Chia nho de khong gui mot request qua lon len Atlas.
    for (let index = 0; index < documents.length; index += 500) {
      const batch = documents.slice(index, index + 500);
      if (!batch.length) continue;
      await targetDb.collection(name).bulkWrite(
        batch.map((document) => ({
          replaceOne: {
            filter: { _id: document._id },
            replacement: document,
            upsert: true,
          },
        })),
        { ordered: false },
      );
      copied += batch.length;
    }

    console.log(`${name}: ${copied}`);
  }
} finally {
  await Promise.allSettled([source.close(), target.close()]);
}
