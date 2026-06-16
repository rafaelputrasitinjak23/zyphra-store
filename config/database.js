const mongoose = require('mongoose');
const { env } = require('./env');

let cached = global.__zyphraMongoose;
if (!cached) cached = global.__zyphraMongoose = { connection: null, promise: null };

async function connectDatabase() {
  if (cached.connection) return cached.connection;
  if (!env.mongoUri) throw new Error('MONGODB_URI belum diisi.');
  if (!cached.promise) {
    cached.promise = mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    });
  }
  try {
    cached.connection = await cached.promise;
    return cached.connection;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}

module.exports = { connectDatabase };
