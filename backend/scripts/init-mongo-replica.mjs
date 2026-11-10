import mongoose from "mongoose";
// Chỉ khởi tạo instance local cổng 27018; không thay cấu hình MongoDB gốc 27017.
const client = new mongoose.mongo.MongoClient(
  "mongodb://127.0.0.1:27018/?directConnection=true",
  { serverSelectionTimeoutMS: 10000 },
);
try {
  await client.connect();
  const admin = client.db("admin");
  const hello = await admin.command({ hello: 1 });
  if (hello.setName && hello.setName !== "bookmarket-rs")
    throw new Error("Port 27018 belongs to a different replica set.");
  if (!hello.setName)
    await admin.command({
      replSetInitiate: {
        _id: "bookmarket-rs",
        members: [{ _id: 0, host: "127.0.0.1:27018" }],
      },
    });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if ((await admin.command({ hello: 1 })).isWritablePrimary) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Replica set has not elected a primary yet.");
  console.log(
    "Replica set ready: mongodb://127.0.0.1:27018/bookmarket_foundation?replicaSet=bookmarket-rs",
  );
} finally {
  await client.close();
}
