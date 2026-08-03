require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db/connect');
const PlayerWallet = require('./models/PlayerWallet');
async function test() {
  await connectDB();
  const w1 = await PlayerWallet.findOne({ userId: '919332723557' });
  const w2 = await PlayerWallet.findOne({ userId: '9332723557' });
  console.log('w1 (with 91):', w1 ? w1.pokecoins : null);
  console.log('w2 (without 91):', w2 ? w2.pokecoins : null);
  process.exit(0);
}
test();
