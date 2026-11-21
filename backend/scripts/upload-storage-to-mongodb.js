// Tai cac tep dang luu local len GridFS cua MongoDB dich, giu nguyen ID tep.
import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";

const targetUri = process.env.TARGET_MONGO_URI;
if (!targetUri) throw new Error("Can TARGET_MONGO_URI.");

const storageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../storage",
);
const client = new mongoose.mongo.MongoClient(targetUri);

try {
  await client.connect();
  const db = client.db();
  const bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: "privateFiles",
  });

  for (const folder of ["images", "ebooks"]) {
    const directory = path.join(storageRoot, folder);
    const names = await fs.readdir(directory).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const id of names) {
      if (await db.collection("privateFiles.files").findOne({ _id: id })) {
        console.log(`${folder}/${id}: da co`);
        continue;
      }
      const data = await fs.readFile(path.join(directory, id));
      await new Promise((resolve, reject) => {
        const upload = bucket.openUploadStreamWithId(id, id, {
          metadata: { folder },
        });
        upload.once("error", reject);
        upload.once("finish", resolve);
        upload.end(data);
      });
      console.log(`${folder}/${id}: ${data.length} bytes`);
    }
  }
} finally {
  await client.close();
}
