require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db/connect');
const PlayerWallet = require('./models/PlayerWallet');
async function test() {
  await connectDB();
  const FATHER = process.env.BOT_FATHER.split(',');
  console.log('FATHER IDs from env:', FATHER);
  const regexes = FATHER.map(f => new RegExp(f + '$'));
  const matches = await PlayerWallet.find({ userId: { $in: regexes } });
  for (const m of matches) {
     console.log('Found match:', m.userId);
  }
  process.exit(0);
}
test();
