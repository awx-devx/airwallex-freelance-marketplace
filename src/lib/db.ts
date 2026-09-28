import mongoose from "mongoose";
import { getServerConfig } from "@/lib/config";

import "@/models";

type Cache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & { mongooseCache?: Cache };

function cache(): Cache {
  if (!globalForMongoose.mongooseCache) {
    globalForMongoose.mongooseCache = { conn: null, promise: null };
  }
  return globalForMongoose.mongooseCache;
}

export async function connectDb(uri = getServerConfig().mongodbUri): Promise<typeof mongoose> {
  const cached = cache();
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 2_000 })
      .then((connection) => {
        cached.conn = connection;
        return connection;
      })
      .catch((error: unknown) => {
        cached.promise = null;
        throw error;
      });
  }
  return cached.promise;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  const cached = cache();
  cached.conn = null;
  cached.promise = null;
}
