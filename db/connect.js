const mongoose = require('mongoose');
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI is not defined in .env');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'celestia'
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};
module.exports = connectDB;