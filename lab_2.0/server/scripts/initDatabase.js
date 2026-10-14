require('dotenv').config();

const mongoose = require('mongoose');
const models = require('../src/models');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vaani_doc_local';

async function createCollectionsAndIndexes() {
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  const modelEntries = Object.entries(models);

  for (const [modelName, model] of modelEntries) {
    try {
      await model.createCollection();
    } catch (error) {
      // MongoDB returns namespace-exists when a collection was already created.
      // Existing data is intentionally preserved by this initialization script.
      if (error.code !== 48) throw error;
    }

    await model.createIndexes();
    console.log(`Initialized ${model.collection.name} (${modelName})`);
  }
}

createCollectionsAndIndexes()
  .then(async () => {
    await mongoose.disconnect();
    console.log('MongoDB collections and indexes are ready.');
  })
  .catch(async (error) => {
    console.error(`Database initialization failed: ${error.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
