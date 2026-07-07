const fs = require('fs');
const path = require('path');
class MongoStore {
  constructor({
    mongoose
  } = {}) {
    if (!mongoose) throw new Error('A valid Mongoose instance is required for MongoStore.');
    this.mongoose = mongoose;
  }
  async sessionExists(options) {
    try {
      let multiDeviceCollection = this.mongoose.connection.db.collection(`whatsapp-${options.session}.files`);
      let hasExistingSession = await multiDeviceCollection.countDocuments();
      console.log(`[MongoStore] sessionExists("${options.session}"): ${!!hasExistingSession} (${hasExistingSession} docs)`);
      return !!hasExistingSession;
    } catch (err) {
      console.error(`[MongoStore] sessionExists error:`, err.message);
      return false;
    }
  }
  async save(options) {
    var bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
      bucketName: `whatsapp-${options.session}`
    });
    const zipPath = path.join(process.cwd(), '.wwebjs_auth', `${options.session}.zip`);
    if (!fs.existsSync(zipPath)) {
      console.error(`[MongoStore] save() FAILED: Zip file not found at ${zipPath}`);
      return;
    }
    console.log(`[MongoStore] Saving session "${options.session}" from ${zipPath}...`);
    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath).pipe(bucket.openUploadStream(`${options.session}.zip`)).on('error', err => {
        console.error(`[MongoStore] save() stream error:`, err.message);
        reject(err);
      }).on('close', () => {
        console.log(`[MongoStore] Session "${options.session}" saved successfully to MongoDB.`);
        resolve();
      });
    });
    options.bucket = bucket;
    await this.#deletePrevious(options);
  }
  async extract(options) {
    console.log(`[MongoStore] Extracting session "${options.session}" to ${options.path}...`);
    var bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
      bucketName: `whatsapp-${options.session}`
    });
    const targetDir = path.dirname(options.path);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, {
        recursive: true
      });
    }
    return new Promise((resolve, reject) => {
      bucket.openDownloadStreamByName(`${options.session}.zip`).on('error', err => {
        console.error(`[MongoStore] extract() download stream error:`, err.message);
        reject(err);
      }).pipe(fs.createWriteStream(options.path)).on('error', err => {
        console.error(`[MongoStore] extract() write stream error:`, err.message);
        reject(err);
      }).on('close', () => {
        console.log(`[MongoStore] Session "${options.session}" extracted successfully to ${options.path}`);
        resolve();
      });
    });
  }
  async delete(options) {
    var bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
      bucketName: `whatsapp-${options.session}`
    });
    const documents = await bucket.find({
      filename: `${options.session}.zip`
    }).toArray();
    documents.map(async doc => {
      return bucket.delete(doc._id);
    });
  }
  async #deletePrevious(options) {
    const documents = await options.bucket.find({
      filename: `${options.session}.zip`
    }).toArray();
    if (documents.length > 1) {
      const oldSession = documents.reduce((a, b) => a.uploadDate < b.uploadDate ? a : b);
      return options.bucket.delete(oldSession._id);
    }
  }
}
module.exports = MongoStore;