require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db/connect');
const PlayerWallet = require('./models/PlayerWallet');
async function test() {
  await connectDB();
  const w = await PlayerWallet.findOne({});
  console.log('Sample Wallet:', w);
  process.exit(0);
}
test();
