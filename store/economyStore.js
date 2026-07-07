const PlayerWallet = require('../models/PlayerWallet');
const PokemonEntry = require('../models/Pokemon');
const itemsList = require('../data/items.json');
const TAX_RATE = 0.18;
async function resolveTransactionTax(userId, basePrice) {
  const familyStore = require('./familyStore');
  const wallet = await getWallet(userId);
  if (wallet.customTitle) {
    return {
      taxPayers: [],
      taxAmount: 0,
      totalPrice: basePrice,
      basePrice,
      exempt: true
    };
  }
  const taxPayers = await familyStore.resolveTaxPayers(userId);
  if (taxPayers.length === 0) {
    return {
      taxPayers: [],
      taxAmount: 0,
      totalPrice: basePrice,
      basePrice,
      exempt: true
    };
  }
  const selfPays = taxPayers.length === 1 && taxPayers[0].userId === userId;
  const taxAmount = Math.ceil(basePrice * TAX_RATE);
  return {
    taxPayers,
    taxAmount,
    totalPrice: selfPays ? basePrice + taxAmount : basePrice,
    basePrice,
    exempt: false,
    selfPays
  };
}
async function deductTaxFromPayers(taxPayers, taxAmount) {
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  const taxDetails = [];
  for (const payer of taxPayers) {
    const payerAmount = Math.ceil(taxAmount * payer.share);
    if (payerAmount <= 0) continue;
    const payerWallet = await getWallet(payer.userId);
    payerWallet.pokecoins = Math.max(0, payerWallet.pokecoins - payerAmount);
    await payerWallet.save();
    taxDetails.push({
      userId: payer.userId,
      amount: payerAmount
    });
  }
  if (taxDetails.length > 0) {
    const totalTaxCollected = taxDetails.reduce((sum, t) => sum + t.amount, 0);
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += totalTaxCollected;
    await fatherWallet.save();
  }
  return taxDetails;
}
async function distributePocketMoney(parentId, earningAmount) {
  const familyStore = require('./familyStore');
  const pocketMoney = await familyStore.calculatePocketMoney(parentId, earningAmount);
  for (const {
    childId,
    amount
  } of pocketMoney) {
    const childWallet = await getWallet(childId);
    childWallet.pokecoins += amount;
    await childWallet.save();
  }
  return pocketMoney;
}
const MARKET_ITEMS = {};
for (const item of itemsList) {
  MARKET_ITEMS[item.id] = {
    displayName: item.displayName,
    emoji: item.emoji,
    description: item.description,
    price: item.price,
    quantity: item.quantity,
    category: item.category,
    aliases: item.aliases || [],
    guide: item.guide || ''
  };
}
function getItemDetails(nameOrAlias) {
  if (!nameOrAlias) return null;
  const cleaned = nameOrAlias.toLowerCase().trim();
  if (MARKET_ITEMS[cleaned]) {
    return {
      id: cleaned,
      ...MARKET_ITEMS[cleaned]
    };
  }
  for (const [id, details] of Object.entries(MARKET_ITEMS)) {
    if (details.aliases.some(a => a.toLowerCase() === cleaned)) {
      return {
        id,
        ...details
      };
    }
  }
  for (const [id, details] of Object.entries(MARKET_ITEMS)) {
    if (details.displayName.toLowerCase() === cleaned) {
      return {
        id,
        ...details
      };
    }
  }
  return getOmegaItemDetails(nameOrAlias);
}
async function getWallet(userId) {
  let wallet = await PlayerWallet.findOne({
    userId
  });
  if (!wallet) {
    wallet = await PlayerWallet.create({
      userId,
      pokecoins: 0,
      pokeballs: 20,
      inventory: []
    });
  }
  return wallet;
}
function calculateCoinReward(pkmn) {
  if (!pkmn) return 50;
  const bs = pkmn.baseStats || {
    hp: 50,
    atk: 50,
    def: 50,
    spAtk: 50,
    spDef: 50,
    speed: 50
  };
  const bst = (bs.hp || 50) + (bs.atk || 50) + (bs.def || 50) + (bs.spAtk || 50) + (bs.spDef || 50) + (bs.speed || 50);
  const bstCoins = bst / 720 * 220;
  const rarityCoins = (pkmn.isLegendary ? 160 : 0) + (pkmn.isMythical ? 200 : 0);
  const capRate = pkmn.captureRate || 45;
  const capCoins = (255 - capRate) / 252 * 80;
  const tcgHp = parseInt(pkmn.hp) || 70;
  const hpCoins = Math.min(50, tcgHp / 340 * 50);
  const movesList = pkmn.attacks || pkmn.moves || [];
  const maxPower = Math.max(...movesList.map(m => m.power || 0), 0);
  const moveCoins = Math.min(50, maxPower / 180 * 50);
  const baseReward = bstCoins + rarityCoins + capCoins + hpCoins + moveCoins;
  const variance = Math.floor(Math.random() * 41) - 20;
  const finalCoins = Math.round(baseReward + variance);
  return Math.min(650, Math.max(30, finalCoins));
}
async function addCoins(userId, amount) {
  const wallet = await getWallet(userId);
  wallet.pokecoins += amount;
  await wallet.save();
  try {
    await distributePocketMoney(userId, amount);
  } catch (e) {
    console.warn('[Economy] Pocket money distribution failed:', e.message);
  }
  return wallet;
}
async function deductCoins(userId, amount) {
  const wallet = await getWallet(userId);
  if (wallet.pokecoins < amount) return {
    success: false,
    balance: wallet.pokecoins
  };
  wallet.pokecoins -= amount;
  await wallet.save();
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += amount;
    await fatherWallet.save();
  }
  return {
    success: true,
    balance: wallet.pokecoins
  };
}
async function transferCoins(fromUserId, toUserId, amount) {
  if (amount <= 0) return {
    success: false,
    reason: 'invalid_amount'
  };
  const fromWallet = await getWallet(fromUserId);
  if (fromWallet.pokecoins < amount) {
    return {
      success: false,
      reason: 'insufficient',
      balance: fromWallet.pokecoins
    };
  }
  fromWallet.pokecoins -= amount;
  await fromWallet.save();
  const toWallet = await getWallet(toUserId);
  toWallet.pokecoins += amount;
  await toWallet.save();
  return {
    success: true,
    fromBalance: fromWallet.pokecoins,
    toBalance: toWallet.pokecoins
  };
}
async function getBalance(userId) {
  if (global.BOT_ID && userId === global.BOT_ID) {
    return {
      pokecoins: 1000000000000,
      pokeballs: 1000000000000,
      radiantCrystals: 1000000000000
    };
  }
  const wallet = await getWallet(userId);
  return {
    pokecoins: wallet.pokecoins,
    pokeballs: wallet.pokeballs,
    radiantCrystals: wallet.radiantCrystals || 0
  };
}
async function hasPokeballs(userId) {
  const wallet = await getWallet(userId);
  return wallet.pokeballs > 0;
}
async function consumePokeball(userId) {
  const wallet = await getWallet(userId);
  if (wallet.pokeballs <= 0) return {
    success: false,
    remaining: 0
  };
  wallet.pokeballs -= 1;
  await wallet.save();
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokeballs += 1;
    await fatherWallet.save();
  }
  return {
    success: true,
    remaining: wallet.pokeballs
  };
}
async function addPokeballs(userId, amount) {
  const wallet = await getWallet(userId);
  wallet.pokeballs += amount;
  await wallet.save();
  return wallet.pokeballs;
}
async function addInventoryItem(userId, itemName, quantity = 1) {
  const wallet = await PlayerWallet.findOne({
    userId
  });
  if (!wallet) {
    const newWallet = await PlayerWallet.create({
      userId,
      pokecoins: 0,
      pokeballs: 20,
      inventory: [{
        itemName,
        quantity
      }]
    });
    return newWallet.inventory;
  }
  const existing = wallet.inventory.find(i => i.itemName.toLowerCase() === itemName.toLowerCase());
  if (existing) {
    await PlayerWallet.updateOne({
      userId,
      'inventory.itemName': existing.itemName
    }, {
      $inc: {
        'inventory.$.quantity': quantity
      }
    });
  } else {
    await PlayerWallet.updateOne({
      userId
    }, {
      $push: {
        inventory: {
          itemName,
          quantity
        }
      }
    });
  }
  const updated = await PlayerWallet.findOne({
    userId
  });
  return updated.inventory;
}
async function removeInventoryItem(userId, itemName, quantity = 1) {
  const wallet = await getWallet(userId);
  const existing = wallet.inventory.find(i => i.itemName.toLowerCase() === itemName.toLowerCase());
  if (!existing || existing.quantity < quantity) return false;
  existing.quantity -= quantity;
  if (existing.quantity <= 0) {
    wallet.inventory = wallet.inventory.filter(i => i.itemName.toLowerCase() !== itemName.toLowerCase());
  }
  await wallet.save();
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    const fatherItem = fatherWallet.inventory.find(i => i.itemName.toLowerCase() === itemName.toLowerCase());
    if (fatherItem) {
      fatherItem.quantity += quantity;
    } else {
      fatherWallet.inventory.push({
        itemName,
        quantity
      });
    }
    await fatherWallet.save();
  }
  return true;
}
async function getInventory(userId) {
  if (global.BOT_ID && userId === global.BOT_ID) {
    return {
      pokecoins: 1000000000000,
      pokeballs: 1000000000000,
      items: itemsList.map(item => ({
        itemName: item.displayName,
        quantity: 1000000000000
      }))
    };
  }
  const wallet = await getWallet(userId);
  return {
    pokecoins: wallet.pokecoins,
    pokeballs: wallet.pokeballs,
    radiantCrystals: wallet.radiantCrystals || 0,
    items: wallet.inventory
  };
}
async function buyItem(userId, itemKey, qty = 1) {
  const item = MARKET_ITEMS[itemKey];
  if (!item) return {
    success: false,
    reason: 'not_found'
  };
  if (qty < 1) qty = 1;
  const wallet = await getWallet(userId);
  let basePrice = item.price * qty;
  if (wallet.customTitle) {
    basePrice = Math.floor(basePrice * 0.85);
  }
  const totalQty = item.quantity * qty;
  const taxInfo = await resolveTransactionTax(userId, basePrice);
  const taxAmount = taxInfo.taxAmount;
  const buyerPays = taxInfo.selfPays ? basePrice + taxAmount : basePrice;
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (itemKey === 'wishing compass') {
    const crystals = wallet.radiantCrystals || 0;
    if (crystals < buyerPays) {
      return {
        success: false,
        reason: 'insufficient_crystals',
        needed: buyerPays,
        have: crystals,
        currency: 'Radiant Crystals'
      };
    }
    wallet.radiantCrystals -= buyerPays;
    if (userId !== fatherId) {
      const fatherWallet = await getWallet(fatherId);
      fatherWallet.radiantCrystals = (fatherWallet.radiantCrystals || 0) + basePrice;
      await fatherWallet.save();
    }
    const existing = wallet.inventory.find(i => i.itemName === item.displayName);
    if (existing) {
      existing.quantity += totalQty;
    } else {
      wallet.inventory.push({
        itemName: item.displayName,
        quantity: totalQty
      });
    }
    await wallet.save();
    let taxDetails = [];
    if (!taxInfo.exempt && !taxInfo.selfPays && taxAmount > 0) {
      taxDetails = await deductTaxFromPayers(taxInfo.taxPayers, taxAmount);
    }
    return {
      success: true,
      item: item.displayName,
      quantity: totalQty,
      basePrice,
      taxAmount: taxInfo.exempt ? 0 : taxAmount,
      taxPaidBy: taxDetails,
      spent: buyerPays,
      currency: 'Radiant Crystals',
      newBalance: wallet.radiantCrystals
    };
  }
  if (wallet.pokecoins < buyerPays) {
    return {
      success: false,
      reason: 'insufficient_coins',
      needed: buyerPays,
      have: wallet.pokecoins
    };
  }
  wallet.pokecoins -= buyerPays;
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += basePrice;
    await fatherWallet.save();
  }
  if (itemKey === 'pokeball') {
    wallet.pokeballs += totalQty;
  } else {
    const existing = wallet.inventory.find(i => i.itemName === item.displayName);
    if (existing) {
      existing.quantity += totalQty;
    } else {
      wallet.inventory.push({
        itemName: item.displayName,
        quantity: totalQty
      });
    }
  }
  await wallet.save();
  let taxDetails = [];
  if (!taxInfo.exempt && !taxInfo.selfPays && taxAmount > 0) {
    taxDetails = await deductTaxFromPayers(taxInfo.taxPayers, taxAmount);
  } else if (taxInfo.selfPays && taxAmount > 0) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += taxAmount;
    await fatherWallet.save();
    taxDetails = [{
      userId,
      amount: taxAmount
    }];
  }
  return {
    success: true,
    item: item.displayName,
    quantity: totalQty,
    basePrice,
    taxAmount: taxInfo.exempt ? 0 : taxAmount,
    taxPaidBy: taxDetails,
    spent: buyerPays,
    newBalance: wallet.pokecoins
  };
}
async function useLevelOrb(userId, pokemonName) {
  const wallet = await getWallet(userId);
  const orbItem = wallet.inventory.find(i => i.itemName === 'Level Orb');
  if (!orbItem || orbItem.quantity <= 0) {
    return {
      success: false,
      reason: 'no_orbs'
    };
  }
  const entry = await PokemonEntry.findOne({
    userId,
    pokemonName: {
      $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }).sort({
    level: -1
  });
  if (!entry) return {
    success: false,
    reason: 'no_pokemon'
  };
  const levelCap = getLevelCap(wallet);
  if (entry.level >= levelCap) return {
    success: false,
    reason: 'max_level',
    cap: levelCap
  };
  const removed = await removeInventoryItem(userId, 'Level Orb', 1);
  if (!removed) return {
    success: false,
    reason: 'no_orbs'
  };
  const roll = Math.random();
  if (roll > 0.60) {
    return {
      success: false,
      reason: 'failed',
      pokemonName: entry.pokemonName,
      level: entry.level
    };
  }
  const maxGain = levelCap - entry.level;
  const levelsGained = Math.floor(Math.random() * maxGain) + 1;
  entry.level = Math.min(entry.level + levelsGained, levelCap);
  await entry.save();
  return {
    success: true,
    pokemonName: entry.pokemonName,
    oldLevel: entry.level - levelsGained,
    newLevel: entry.level,
    levelsGained
  };
}
function getMarketCatalog() {
  return MARKET_ITEMS;
}
async function getBalTop(limit = 10) {
  const {
    FATHER
  } = require('../config');
  return PlayerWallet.find({
    userId: {
      $nin: FATHER
    }
  }).sort({
    pokecoins: -1
  }).limit(limit);
}
async function getCrystalTop(limit = 10) {
  const {
    FATHER
  } = require('../config');
  return PlayerWallet.find({
    userId: {
      $nin: FATHER
    }
  }).sort({
    radiantCrystals: -1
  }).limit(limit);
}
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DAILY_COINS = 800;
const DAILY_BALLS = 10;
async function claimDaily(userId) {
  const wallet = await getWallet(userId);
  const now = Date.now();
  if (wallet.lastDaily) {
    const elapsed = now - wallet.lastDaily.getTime();
    if (elapsed < DAILY_COOLDOWN_MS) {
      const remaining = DAILY_COOLDOWN_MS - elapsed;
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor(remaining % (60 * 60 * 1000) / (60 * 1000));
      return {
        success: false,
        reason: 'cooldown',
        hours,
        minutes
      };
    }
  }
  wallet.pokecoins += DAILY_COINS;
  wallet.pokeballs += DAILY_BALLS;
  wallet.lastDaily = new Date(now);
  await wallet.save();
  return {
    success: true,
    coinsAwarded: DAILY_COINS,
    ballsAwarded: DAILY_BALLS,
    totalCoins: wallet.pokecoins,
    totalBalls: wallet.pokeballs
  };
}
const WEEKLY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKLY_COINS = 10000;
const WEEKLY_BALLS = 50;
const WEEKLY_ORBS = 3;
async function claimWeekly(userId) {
  const wallet = await getWallet(userId);
  const now = Date.now();
  if (wallet.lastWeekly) {
    const elapsed = now - wallet.lastWeekly.getTime();
    if (elapsed < WEEKLY_COOLDOWN_MS) {
      const remaining = WEEKLY_COOLDOWN_MS - elapsed;
      const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
      const hours = Math.floor(remaining % (24 * 60 * 60 * 1000) / (60 * 60 * 1000));
      const minutes = Math.floor(remaining % (60 * 60 * 1000) / (60 * 1000));
      return {
        success: false,
        reason: 'cooldown',
        days,
        hours,
        minutes
      };
    }
  }
  wallet.pokecoins += WEEKLY_COINS;
  wallet.pokeballs += WEEKLY_BALLS;
  const existing = wallet.inventory.find(i => i.itemName === 'Level Orb');
  if (existing) {
    existing.quantity += WEEKLY_ORBS;
  } else {
    wallet.inventory.push({
      itemName: 'Level Orb',
      quantity: WEEKLY_ORBS
    });
  }
  wallet.lastWeekly = new Date(now);
  await wallet.save();
  return {
    success: true,
    coinsAwarded: WEEKLY_COINS,
    ballsAwarded: WEEKLY_BALLS,
    orbsAwarded: WEEKLY_ORBS,
    totalCoins: wallet.pokecoins,
    totalBalls: wallet.pokeballs
  };
}
const MONTHLY_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const MONTHLY_COINS = 100000;
const MONTHLY_BALLS = 100;
const MONTHLY_ORBS = 15;
const MONTHLY_RAID_PASS = 15;
const MONTHLY_COMPASS = 30;
async function claimMonthly(userId) {
  const wallet = await getWallet(userId);
  const now = Date.now();
  if (wallet.lastMonthly) {
    const elapsed = now - wallet.lastMonthly.getTime();
    if (elapsed < MONTHLY_COOLDOWN_MS) {
      const remaining = MONTHLY_COOLDOWN_MS - elapsed;
      const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
      const hours = Math.floor(remaining % (24 * 60 * 60 * 1000) / (60 * 60 * 1000));
      const minutes = Math.floor(remaining % (60 * 60 * 1000) / (60 * 1000));
      return {
        success: false,
        reason: 'cooldown',
        days,
        hours,
        minutes
      };
    }
  }
  wallet.pokecoins += MONTHLY_COINS;
  wallet.pokeballs += MONTHLY_BALLS;
  const addItem = (itemName, qty) => {
    const existing = wallet.inventory.find(i => i.itemName === itemName);
    if (existing) {
      existing.quantity += qty;
    } else {
      wallet.inventory.push({
        itemName,
        quantity: qty
      });
    }
  };
  addItem('Level Orb', MONTHLY_ORBS);
  addItem('Raid Pass', MONTHLY_RAID_PASS);
  addItem('Wishing Compass', MONTHLY_COMPASS);
  wallet.lastMonthly = new Date(now);
  await wallet.save();
  return {
    success: true,
    coinsAwarded: MONTHLY_COINS,
    ballsAwarded: MONTHLY_BALLS,
    orbsAwarded: MONTHLY_ORBS,
    raidPassAwarded: MONTHLY_RAID_PASS,
    compassAwarded: MONTHLY_COMPASS,
    totalCoins: wallet.pokecoins,
    totalBalls: wallet.pokeballs
  };
}
const SUMMON_COOLDOWN_MS = 24 * 60 * 60 * 1000;
async function checkSummonCooldown(userId) {
  const wallet = await getWallet(userId);
  if (wallet.cdBypass) return {
    allowed: true
  };
  const now = Date.now();
  if (wallet.lastSummon) {
    const elapsed = now - wallet.lastSummon.getTime();
    if (elapsed < SUMMON_COOLDOWN_MS) {
      const remaining = SUMMON_COOLDOWN_MS - elapsed;
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor(remaining % (60 * 60 * 1000) / (60 * 1000));
      return {
        allowed: false,
        hours,
        minutes
      };
    }
  }
  return {
    allowed: true
  };
}
async function recordSummonUsage(userId) {
  const wallet = await getWallet(userId);
  wallet.lastSummon = new Date();
  await wallet.save();
}
async function addRadiantCrystals(userId, amount) {
  const wallet = await getWallet(userId);
  wallet.radiantCrystals = (wallet.radiantCrystals || 0) + amount;
  await wallet.save();
  return wallet.radiantCrystals;
}
async function deductRadiantCrystals(userId, amount) {
  const wallet = await getWallet(userId);
  const crystals = wallet.radiantCrystals || 0;
  if (crystals < amount) return {
    success: false,
    balance: crystals
  };
  wallet.radiantCrystals -= amount;
  await wallet.save();
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.radiantCrystals = (fatherWallet.radiantCrystals || 0) + amount;
    await fatherWallet.save();
  }
  return {
    success: true,
    balance: wallet.radiantCrystals
  };
}
async function getRadiantCrystals(userId) {
  if (global.BOT_ID && userId === global.BOT_ID) return 1000000000000;
  const wallet = await getWallet(userId);
  return wallet.radiantCrystals || 0;
}
async function setCooldownBypass(userId, state) {
  const wallet = await getWallet(userId);
  wallet.cdBypass = state;
  await wallet.save();
  return wallet.cdBypass;
}
async function hasCooldownBypass(userId) {
  const wallet = await getWallet(userId);
  return !!(wallet.cdBypass || wallet.karenExpiry && new Date(wallet.karenExpiry) > new Date());
}
function getLevelCap(walletOrValues) {
  const prestige = walletOrValues.prestigeLevel || 0;
  const omega = walletOrValues.omegaLevel || 0;
  const masterBonus = walletOrValues.customTitle ? 100 : 0;
  return 100 + prestige * 100 + omega * 1000 + masterBonus;
}
async function getLevelCapForUser(userId) {
  const wallet = await getWallet(userId);
  return getLevelCap(wallet);
}
function getPrestigeMultiplier(prestigeLevel) {
  if (!prestigeLevel || prestigeLevel <= 0) return 1;
  return prestigeLevel * 5;
}
async function getPrestigeMultiplierForUser(userId) {
  const wallet = await getWallet(userId);
  return getPrestigeMultiplier(wallet.prestigeLevel);
}
function applyPrestigeToStats(baseStats, prestigeLevel) {
  if (!baseStats) return null;
  const mult = getPrestigeMultiplier(prestigeLevel);
  if (mult <= 1) return {
    ...baseStats
  };
  const boosted = {};
  for (const key in baseStats) {
    boosted[key] = Math.floor(baseStats[key] * mult);
  }
  return boosted;
}
function applyPrestigeToAttacks(attacks, prestigeLevel) {
  if (!attacks || !Array.isArray(attacks)) return attacks;
  const mult = getPrestigeMultiplier(prestigeLevel);
  if (mult <= 1) return attacks;
  return attacks.map(atk => {
    if (atk && typeof atk.power === 'number' && atk.power > 0) {
      return {
        ...atk,
        power: Math.floor(atk.power * mult)
      };
    }
    return atk;
  });
}
function getEffectivePrestige(ownerPrestigeLevel, pokemonPrestigeStamp) {
  const ownerPrestige = ownerPrestigeLevel || 0;
  const stamp = pokemonPrestigeStamp || 0;
  return Math.max(ownerPrestige, stamp);
}
async function getEffectivePrestigeForPokemon(userId, pokemonEntry) {
  const wallet = await getWallet(userId);
  const ownerPrestige = wallet.prestigeLevel || 0;
  const stamp = pokemonEntry?.prestigeStamp || 0;
  return Math.max(ownerPrestige, stamp);
}
function getPrestigeRequirements(currentPrestige) {
  return {
    minDex: 100 + currentPrestige * 100,
    minLeveledPokemon: 20,
    minPokemonLevel: 100 + currentPrestige * 100,
    minCoins: 300000 + currentPrestige * 100000
  };
}
async function checkPrestigeEligibility(userId) {
  const wallet = await getWallet(userId);
  const reqs = getPrestigeRequirements(wallet.prestigeLevel);
  const allEntries = await PokemonEntry.find({
    userId
  });
  const pokemonStore = require('./pokemonStore');
  if (allEntries.length < reqs.minDex) {
    return {
      eligible: false,
      reason: 'insufficient_dex',
      have: allEntries.length,
      need: reqs.minDex,
      requirements: reqs
    };
  }
  const qualifyingPokemon = allEntries.filter(e => e.level >= reqs.minPokemonLevel);
  if (qualifyingPokemon.length < reqs.minLeveledPokemon) {
    return {
      eligible: false,
      reason: 'insufficient_leveled',
      have: qualifyingPokemon.length,
      need: reqs.minLeveledPokemon,
      minLevel: reqs.minPokemonLevel,
      requirements: reqs
    };
  }
  if (wallet.pokecoins < reqs.minCoins) {
    return {
      eligible: false,
      reason: 'insufficient_coins',
      have: wallet.pokecoins,
      need: reqs.minCoins,
      requirements: reqs
    };
  }
  return {
    eligible: true,
    requirements: reqs,
    wallet
  };
}
async function performPrestige(userId) {
  const eligibility = await checkPrestigeEligibility(userId);
  if (!eligibility.eligible) return {
    success: false,
    ...eligibility
  };
  const wallet = eligibility.wallet || (await getWallet(userId));
  const reqs = eligibility.requirements;
  wallet.pokecoins -= reqs.minCoins;
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += reqs.minCoins;
    await fatherWallet.save();
  }
  wallet.prestigeLevel += 1;
  wallet.totalPrestigeCount += 1;
  wallet.userXP = (wallet.userXP || 0) + 500;
  wallet.lastDaily = null;
  wallet.lastWeekly = null;
  wallet.lastMonthly = null;
  wallet.lastSummon = null;
  await wallet.save();
  await PokemonEntry.updateMany({
    userId
  }, {
    level: 1
  });
  return {
    success: true,
    newPrestige: wallet.prestigeLevel,
    newLevelCap: getLevelCap(wallet),
    coinsDeducted: reqs.minCoins
  };
}
function getOmegaRequirements(currentOmega) {
  return {
    minPrestige: 10 + currentOmega,
    minCoins: 7500000,
    minLeveledPokemon: 50,
    minPokemonLevel: 1100 + currentOmega * 1100,
    minTotalPokemon: 1200
  };
}
async function checkOmegaEligibility(userId) {
  const wallet = await getWallet(userId);
  if (wallet.omegaLevel >= 1) {
    return {
      eligible: false,
      reason: 'max_omega'
    };
  }
  const reqs = getOmegaRequirements(wallet.omegaLevel);
  if (wallet.prestigeLevel < reqs.minPrestige) {
    return {
      eligible: false,
      reason: 'insufficient_prestige',
      have: wallet.prestigeLevel,
      need: reqs.minPrestige,
      requirements: reqs
    };
  }
  if (wallet.pokecoins < reqs.minCoins) {
    return {
      eligible: false,
      reason: 'insufficient_coins',
      have: wallet.pokecoins,
      need: reqs.minCoins,
      requirements: reqs
    };
  }
  const allEntries = await PokemonEntry.find({
    userId
  });
  if (allEntries.length < reqs.minTotalPokemon) {
    return {
      eligible: false,
      reason: 'insufficient_pokemon',
      have: allEntries.length,
      need: reqs.minTotalPokemon,
      requirements: reqs
    };
  }
  const qualifyingPokemon = allEntries.filter(e => e.level >= reqs.minPokemonLevel);
  if (qualifyingPokemon.length < reqs.minLeveledPokemon) {
    return {
      eligible: false,
      reason: 'insufficient_leveled',
      have: qualifyingPokemon.length,
      need: reqs.minLeveledPokemon,
      minLevel: reqs.minPokemonLevel,
      requirements: reqs
    };
  }
  return {
    eligible: true,
    requirements: reqs,
    wallet
  };
}
async function performOmega(userId) {
  const eligibility = await checkOmegaEligibility(userId);
  if (!eligibility.eligible) return {
    success: false,
    ...eligibility
  };
  const wallet = eligibility.wallet || (await getWallet(userId));
  const beforeCoins = wallet.pokecoins;
  wallet.pokecoins = 0;
  wallet.pokeballs = 20;
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (userId !== fatherId && beforeCoins > 0) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += beforeCoins;
    await fatherWallet.save();
  }
  const compassItem = wallet.inventory.find(i => i.itemName === 'Wishing Compass');
  wallet.inventory = compassItem && compassItem.quantity > 0 ? [compassItem] : [];
  wallet.prestigeLevel = 0;
  wallet.omegaLevel += 1;
  wallet.totalOmegaCount += 1;
  wallet.userXP = (wallet.userXP || 0) + 2000;
  wallet.lastDaily = null;
  wallet.lastWeekly = null;
  wallet.lastMonthly = null;
  wallet.lastSummon = null;
  await wallet.save();
  await PokemonEntry.updateMany({
    userId
  }, {
    level: 1
  });
  return {
    success: true,
    newOmega: wallet.omegaLevel,
    newLevelCap: getLevelCap(wallet),
    summonCandlesPerDay: 5
  };
}
function getRankBadge(level, levelCap = 100) {
  if (!levelCap || levelCap < 100) levelCap = 100;
  const ratio = level / levelCap;
  if (ratio > 0.90) return '🔥 S-Rank';
  if (ratio > 0.80) return '⭐ A-Rank';
  if (ratio > 0.70) return '🟢 B-Rank';
  if (ratio > 0.60) return '🔵 C-Rank';
  if (ratio > 0.50) return '🟣 D-Rank';
  return '⬜ F-Rank';
}
function xpForLevel(level) {
  return 100 + (level - 1) * 50;
}
function totalXPForLevel(level) {
  if (level <= 1) return 0;
  return 25 * (level - 1) * (level + 2);
}
function calculateUserLevel(xp) {
  if (!xp || xp <= 0) return 1;
  const L = Math.floor((-1 + Math.sqrt(1 + 4 * (2 + xp / 25))) / 2);
  return Math.max(1, L);
}
async function addUserXP(userId, amount) {
  const wallet = await getWallet(userId);
  wallet.userXP = (wallet.userXP || 0) + amount;
  await wallet.save();
  return wallet.userXP;
}
async function getUserProfile(userId) {
  const wallet = await getWallet(userId);
  const allEntries = await PokemonEntry.find({
    userId
  });
  const pokemonStore = require('./pokemonStore');
  const uniqueIds = new Set(allEntries.map(e => e.dexId || pokemonStore.getDexId(e.pokemonName)));
  uniqueIds.delete(0);
  uniqueIds.delete(undefined);
  const bestLevel = allEntries.length > 0 ? Math.max(...allEntries.map(e => e.level)) : 0;
  const sumLevels = allEntries.reduce((sum, e) => sum + e.level, 0);
  const avgLevel = allEntries.length > 0 ? Math.round(sumLevels / allEntries.length) : 0;
  let legendariesCaught = 0;
  let mythicalsCaught = 0;
  const pokemonMetaMap = require('./pokemonStore').pokemonMetaMap;
  for (const entry of allEntries) {
    const meta = pokemonMetaMap[entry.pokemonName.toLowerCase()];
    if (meta) {
      if (meta.isLeg) legendariesCaught++;
      if (meta.isMyth) mythicalsCaught++;
    }
  }
  const levelCap = getLevelCap(wallet);
  const userLevel = calculateUserLevel(wallet.userXP || 0);
  const xpNeededForNext = totalXPForLevel(userLevel + 1);
  const xpToNext = xpNeededForNext - (wallet.userXP || 0);
  const xpForCurrentLevel = xpForLevel(userLevel);
  const xpProgressInLevel = (wallet.userXP || 0) - totalXPForLevel(userLevel);
  let itemWorth = 0;
  for (const item of wallet.inventory) {
    const details = getItemDetails(item.itemName);
    if (details) {
      itemWorth += (details.price || 0) * (item.quantity || 0);
    }
  }
  const crystalWorth = (wallet.radiantCrystals || 0) * 1500;
  const netWorth = wallet.pokecoins + crystalWorth + itemWorth + wallet.pokeballs * 25;
  return {
    pokecoins: wallet.pokecoins,
    pokeballs: wallet.pokeballs,
    radiantCrystals: wallet.radiantCrystals || 0,
    prestigeLevel: wallet.prestigeLevel || 0,
    omegaLevel: wallet.omegaLevel || 0,
    totalPrestigeCount: wallet.totalPrestigeCount || 0,
    totalOmegaCount: wallet.totalOmegaCount || 0,
    userLevel,
    userXP: wallet.userXP || 0,
    xpToNext,
    xpForCurrentLevel,
    xpProgressInLevel,
    levelCap,
    totalPokemon: allEntries.length,
    uniquePokemon: uniqueIds.size,
    legendariesCaught,
    mythicalsCaught,
    bestLevel,
    avgLevel,
    netWorth,
    itemWorth,
    crystalWorth,
    inventory: wallet.inventory,
    createdAt: wallet.createdAt,
    customTitle: wallet.customTitle,
    titleEmoji: wallet.titleEmoji || '⚜️',
    lastTitleEntrance: wallet.lastTitleEntrance
  };
}
async function getNetWorthTop(limit = 10) {
  const {
    FATHER
  } = require('../config');
  const wallets = await PlayerWallet.find({
    userId: {
      $nin: FATHER
    }
  });
  const results = [];
  for (const w of wallets) {
    let itemWorth = 0;
    for (const item of w.inventory || []) {
      const details = getItemDetails(item.itemName);
      if (details) {
        itemWorth += (details.price || 0) * (item.quantity || 0);
      }
    }
    const crystalWorth = (w.radiantCrystals || 0) * 1500;
    const netWorth = (w.pokecoins || 0) + crystalWorth + itemWorth + (w.pokeballs || 0) * 25;
    results.push({
      userId: w.userId,
      netWorth,
      pokecoins: w.pokecoins,
      radiantCrystals: w.radiantCrystals || 0,
      pokeballs: w.pokeballs || 0
    });
  }
  results.sort((a, b) => b.netWorth - a.netWorth);
  return results.slice(0, limit);
}
const omegaItemsList = require('../data/omegaItems.json');
const OMEGA_MARKET_ITEMS = {};
for (const item of omegaItemsList) {
  OMEGA_MARKET_ITEMS[item.id] = {
    id: item.id,
    displayName: item.displayName,
    emoji: item.emoji,
    description: item.description,
    price: item.price,
    quantity: item.quantity,
    category: item.category,
    aliases: item.aliases || [],
    guide: item.guide || '',
    requiresPrestige: item.requiresPrestige || 0,
    dailyLimit: item.dailyLimit || 0
  };
}
function getOmegaItemDetails(nameOrAlias) {
  if (!nameOrAlias) return null;
  const cleaned = nameOrAlias.toLowerCase().trim();
  if (OMEGA_MARKET_ITEMS[cleaned]) {
    return {
      id: cleaned,
      ...OMEGA_MARKET_ITEMS[cleaned]
    };
  }
  for (const [id, details] of Object.entries(OMEGA_MARKET_ITEMS)) {
    if (details.aliases.some(a => a.toLowerCase() === cleaned)) {
      return {
        id,
        ...details
      };
    }
  }
  for (const [id, details] of Object.entries(OMEGA_MARKET_ITEMS)) {
    if (details.displayName.toLowerCase() === cleaned) {
      return {
        id,
        ...details
      };
    }
  }
  return null;
}
function getOmegaMarketCatalog() {
  return OMEGA_MARKET_ITEMS;
}
async function buyOmegaItem(userId, itemKey, qty = 1) {
  const item = OMEGA_MARKET_ITEMS[itemKey];
  if (!item) return {
    success: false,
    reason: 'not_found'
  };
  if (qty < 1) qty = 1;
  const wallet = await getWallet(userId);
  if (item.requiresPrestige > 0 && (wallet.prestigeLevel || 0) < item.requiresPrestige) {
    return {
      success: false,
      reason: 'insufficient_prestige',
      needed: item.requiresPrestige,
      have: wallet.prestigeLevel || 0
    };
  }
  if (item.dailyLimit > 0 && itemKey === 'dirty diaper') {
    if (wallet.lastOmegaDiaperBuy) {
      const elapsed = Date.now() - wallet.lastOmegaDiaperBuy.getTime();
      if (elapsed < 24 * 60 * 60 * 1000) {
        const remaining = 24 * 60 * 60 * 1000 - elapsed;
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor(remaining % (60 * 60 * 1000) / (60 * 1000));
        return {
          success: false,
          reason: 'daily_limit',
          hours,
          minutes
        };
      }
    }
  }
  const basePrice = item.price * qty;
  const totalQty = item.quantity * qty;
  const taxInfo = await resolveTransactionTax(userId, basePrice);
  const taxAmount = taxInfo.taxAmount;
  const buyerPays = taxInfo.selfPays ? basePrice + taxAmount : basePrice;
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  if (wallet.pokecoins < buyerPays) {
    return {
      success: false,
      reason: 'insufficient_coins',
      needed: buyerPays,
      have: wallet.pokecoins
    };
  }
  wallet.pokecoins -= buyerPays;
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += basePrice;
    await fatherWallet.save();
  }
  const existing = wallet.inventory.find(i => i.itemName === item.displayName);
  if (existing) {
    existing.quantity += totalQty;
  } else {
    wallet.inventory.push({
      itemName: item.displayName,
      quantity: totalQty
    });
  }
  if (item.dailyLimit > 0 && itemKey === 'dirty diaper') {
    wallet.lastOmegaDiaperBuy = new Date();
  }
  await wallet.save();
  let taxDetails = [];
  if (!taxInfo.exempt && !taxInfo.selfPays && taxAmount > 0) {
    taxDetails = await deductTaxFromPayers(taxInfo.taxPayers, taxAmount);
  } else if (taxInfo.selfPays && taxAmount > 0) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += taxAmount;
    await fatherWallet.save();
    taxDetails = [{
      userId,
      amount: taxAmount
    }];
  }
  return {
    success: true,
    item: item.displayName,
    quantity: totalQty,
    basePrice,
    taxAmount: taxInfo.exempt ? 0 : taxAmount,
    taxPaidBy: taxDetails,
    spent: buyerPays,
    newBalance: wallet.pokecoins
  };
}
async function useEnchantedStardust(userId, pokemonName) {
  const wallet = await getWallet(userId);
  const stardustItem = wallet.inventory.find(i => i.itemName === 'Enchanted Stardust');
  if (!stardustItem || stardustItem.quantity <= 0) {
    return {
      success: false,
      reason: 'no_stardust'
    };
  }
  const entry = await PokemonEntry.findOne({
    userId,
    pokemonName: {
      $regex: new RegExp(`^${pokemonName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }
  }).sort({
    level: -1
  });
  if (!entry) return {
    success: false,
    reason: 'no_pokemon'
  };
  const levelCap = getLevelCap(wallet);
  if (entry.level > levelCap - 10) {
    return {
      success: false,
      reason: 'too_close_to_cap',
      level: entry.level,
      cap: levelCap
    };
  }
  const removed = await removeInventoryItem(userId, 'Enchanted Stardust', 1);
  if (!removed) return {
    success: false,
    reason: 'no_stardust'
  };
  const minNewLevel = entry.level + 10;
  const maxNewLevel = levelCap;
  const newLevel = Math.floor(Math.random() * (maxNewLevel - minNewLevel + 1)) + minNewLevel;
  const levelsGained = newLevel - entry.level;
  entry.level = newLevel;
  await entry.save();
  return {
    success: true,
    pokemonName: entry.pokemonName,
    oldLevel: newLevel - levelsGained,
    newLevel: entry.level,
    levelsGained
  };
}
async function useEnchantedWand(userId, targetId) {
  const wallet = await getWallet(userId);
  const wandItem = wallet.inventory.find(i => i.itemName === 'Enchanted Wand');
  if (!wandItem || wandItem.quantity <= 0) {
    return {
      success: false,
      reason: 'no_wand'
    };
  }
  if (!targetId || targetId === userId) {
    return {
      success: false,
      reason: 'invalid_target'
    };
  }
  const targetWallet = await getWallet(targetId);
  if (!targetWallet) {
    return {
      success: false,
      reason: 'target_not_found'
    };
  }
  const removed = await removeInventoryItem(userId, 'Enchanted Wand', 1);
  if (!removed) return {
    success: false,
    reason: 'no_wand'
  };
  const success = Math.random() < 0.5;
  if (success) {
    targetWallet.wandBlockSpawns = 5;
    await targetWallet.save();
    return {
      success: true,
      targetId,
      backfired: false
    };
  } else {
    const updatedWallet = await getWallet(userId);
    updatedWallet.wandBlockSpawns = 5;
    await updatedWallet.save();
    return {
      success: true,
      targetId,
      backfired: true
    };
  }
}
async function useDirtyDiaper(userId) {
  const wallet = await getWallet(userId);
  const diaperItem = wallet.inventory.find(i => i.itemName === 'Dirty Diaper');
  if (!diaperItem || diaperItem.quantity <= 0) {
    return {
      success: false,
      reason: 'no_diaper'
    };
  }
  const removed = await removeInventoryItem(userId, 'Dirty Diaper', 1);
  if (!removed) return {
    success: false,
    reason: 'no_diaper'
  };
  const updatedWallet = await getWallet(userId);
  updatedWallet.diaperModeSpawns = (updatedWallet.diaperModeSpawns || 0) + 20;
  await updatedWallet.save();
  return {
    success: true,
    totalCharges: updatedWallet.diaperModeSpawns
  };
}
async function useLiterallyKaren(userId) {
  const wallet = await getWallet(userId);
  const karenItem = wallet.inventory.find(i => i.itemName === 'Literally Karen');
  if (!karenItem || karenItem.quantity <= 0) {
    return {
      success: false,
      reason: 'no_karen'
    };
  }
  const removed = await removeInventoryItem(userId, 'Literally Karen', 1);
  if (!removed) return {
    success: false,
    reason: 'no_karen'
  };
  const updatedWallet = await getWallet(userId);
  updatedWallet.karenExpiry = new Date(Date.now() + 30 * 60 * 1000);
  await updatedWallet.save();
  return {
    success: true,
    expiry: wallet.karenExpiry
  };
}
async function transferRadiantCrystals(fromUserId, toUserId, amount) {
  if (amount <= 0) return {
    success: false,
    reason: 'invalid_amount'
  };
  const fromWallet = await getWallet(fromUserId);
  const fromCrystals = fromWallet.radiantCrystals || 0;
  if (fromCrystals < amount) {
    return {
      success: false,
      reason: 'insufficient',
      balance: fromCrystals
    };
  }
  fromWallet.radiantCrystals = fromCrystals - amount;
  await fromWallet.save();
  const toWallet = await getWallet(toUserId);
  toWallet.radiantCrystals = (toWallet.radiantCrystals || 0) + amount;
  await toWallet.save();
  return {
    success: true,
    fromBalance: fromWallet.radiantCrystals,
    toBalance: toWallet.radiantCrystals
  };
}
const CRYSTAL_TO_COINS_RATE = 25;
const COINS_TO_CRYSTAL_RATE = 30;
const ITEM_EXCHANGE_PENALTY = 0.10;
async function ensureFatherBalance(fatherId, currency, needed) {
  const fatherWallet = await getWallet(fatherId);
  if (currency === 'pokecoins') {
    if (fatherWallet.pokecoins < needed) {
      fatherWallet.pokecoins += needed;
      await fatherWallet.save();
    }
  } else if (currency === 'crystals') {
    const crystals = fatherWallet.radiantCrystals || 0;
    if (crystals < needed) {
      fatherWallet.radiantCrystals = (fatherWallet.radiantCrystals || 0) + needed;
      await fatherWallet.save();
    }
  }
  return fatherWallet;
}
async function exchangeCrystalsForCoins(userId, crystalAmount) {
  if (crystalAmount <= 0) return {
    success: false,
    reason: 'invalid_amount'
  };
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  const wallet = await getWallet(userId);
  const userCrystals = wallet.radiantCrystals || 0;
  if (userCrystals < crystalAmount) {
    return {
      success: false,
      reason: 'insufficient_crystals',
      have: userCrystals,
      need: crystalAmount
    };
  }
  const coinsToReceive = crystalAmount * CRYSTAL_TO_COINS_RATE;
  await ensureFatherBalance(fatherId, 'pokecoins', coinsToReceive);
  wallet.radiantCrystals -= crystalAmount;
  wallet.pokecoins += coinsToReceive;
  await wallet.save();
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.radiantCrystals = (fatherWallet.radiantCrystals || 0) + crystalAmount;
    fatherWallet.pokecoins -= coinsToReceive;
    await fatherWallet.save();
  }
  return {
    success: true,
    exchanged: crystalAmount,
    received: coinsToReceive,
    fromCurrency: 'Radiant Crystals',
    toCurrency: 'PokéCoins',
    newCrystals: wallet.radiantCrystals,
    newCoins: wallet.pokecoins
  };
}
async function exchangeCoinsForCrystals(userId, coinAmount) {
  if (coinAmount <= 0) return {
    success: false,
    reason: 'invalid_amount'
  };
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  const crystalsToReceive = Math.floor(coinAmount / COINS_TO_CRYSTAL_RATE);
  if (crystalsToReceive <= 0) {
    return {
      success: false,
      reason: 'too_few_coins',
      minimum: COINS_TO_CRYSTAL_RATE
    };
  }
  const actualCoinsConsumed = crystalsToReceive * COINS_TO_CRYSTAL_RATE;
  const wallet = await getWallet(userId);
  if (wallet.pokecoins < actualCoinsConsumed) {
    return {
      success: false,
      reason: 'insufficient_coins',
      have: wallet.pokecoins,
      need: actualCoinsConsumed
    };
  }
  await ensureFatherBalance(fatherId, 'crystals', crystalsToReceive);
  wallet.pokecoins -= actualCoinsConsumed;
  wallet.radiantCrystals = (wallet.radiantCrystals || 0) + crystalsToReceive;
  await wallet.save();
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    fatherWallet.pokecoins += actualCoinsConsumed;
    fatherWallet.radiantCrystals = (fatherWallet.radiantCrystals || 0) - crystalsToReceive;
    await fatherWallet.save();
  }
  return {
    success: true,
    exchanged: actualCoinsConsumed,
    received: crystalsToReceive,
    fromCurrency: 'PokéCoins',
    toCurrency: 'Radiant Crystals',
    newCoins: wallet.pokecoins,
    newCrystals: wallet.radiantCrystals
  };
}
async function exchangeItemForCoins(userId, itemNameOrAlias, quantity) {
  if (quantity <= 0) return {
    success: false,
    reason: 'invalid_amount'
  };
  const {
    FATHER
  } = require('../config');
  const fatherId = FATHER[0];
  let itemDetails = getItemDetails(itemNameOrAlias);
  if (!itemDetails) {
    itemDetails = getOmegaItemDetails(itemNameOrAlias);
  }
  if (!itemDetails) {
    return {
      success: false,
      reason: 'item_not_found'
    };
  }
  const marketPrice = itemDetails.price || 0;
  if (marketPrice <= 0) {
    return {
      success: false,
      reason: 'no_value'
    };
  }
  const payoutPerUnit = Math.floor(marketPrice * (1 - ITEM_EXCHANGE_PENALTY));
  const totalPayout = payoutPerUnit * quantity;
  const wallet = await getWallet(userId);
  let haveQuantity = 0;
  const isPokeball = itemDetails.id === 'pokeball';
  if (isPokeball) {
    haveQuantity = wallet.pokeballs || 0;
  } else {
    const invItem = wallet.inventory.find(i => i.itemName.toLowerCase() === itemDetails.displayName.toLowerCase());
    haveQuantity = invItem ? invItem.quantity : 0;
  }
  if (haveQuantity < quantity) {
    return {
      success: false,
      reason: 'insufficient_items',
      have: haveQuantity,
      need: quantity,
      itemName: itemDetails.displayName
    };
  }
  await ensureFatherBalance(fatherId, 'pokecoins', totalPayout);
  if (isPokeball) {
    wallet.pokeballs -= quantity;
  } else {
    const invItem = wallet.inventory.find(i => i.itemName.toLowerCase() === itemDetails.displayName.toLowerCase());
    invItem.quantity -= quantity;
    if (invItem.quantity <= 0) {
      wallet.inventory = wallet.inventory.filter(i => i.itemName.toLowerCase() !== itemDetails.displayName.toLowerCase());
    }
  }
  wallet.pokecoins += totalPayout;
  await wallet.save();
  if (userId !== fatherId) {
    const fatherWallet = await getWallet(fatherId);
    if (isPokeball) {
      fatherWallet.pokeballs += quantity;
    } else {
      const fatherItem = fatherWallet.inventory.find(i => i.itemName.toLowerCase() === itemDetails.displayName.toLowerCase());
      if (fatherItem) {
        fatherItem.quantity += quantity;
      } else {
        fatherWallet.inventory.push({
          itemName: itemDetails.displayName,
          quantity
        });
      }
    }
    fatherWallet.pokecoins -= totalPayout;
    await fatherWallet.save();
  }
  return {
    success: true,
    itemName: itemDetails.displayName,
    itemEmoji: itemDetails.emoji,
    quantity,
    marketPrice,
    payoutPerUnit,
    totalPayout,
    newCoins: wallet.pokecoins
  };
}

async function getHallOfFame() {
  const { FATHER } = require('../config');
  const wallets = await PlayerWallet.find({
    userId: { $nin: FATHER },
    $or: [
      { customTitle: { $ne: null } },
      { omegaLevel: { $gte: 1 } }
    ]
  }).sort({ omegaLevel: -1, userXP: -1 });
  return wallets;
}
module.exports = {
  getWallet,
  calculateCoinReward,
  addCoins,
  deductCoins,
  transferCoins,
  transferRadiantCrystals,
  getBalance,
  hasPokeballs,
  consumePokeball,
  addPokeballs,
  addInventoryItem,
  removeInventoryItem,
  getInventory,
  buyItem,
  useLevelOrb,
  getMarketCatalog,
  getBalTop,
  getCrystalTop,
  getNetWorthTop,
  claimDaily,
  claimWeekly,
  claimMonthly,
  checkSummonCooldown,
  recordSummonUsage,
  setCooldownBypass,
  hasCooldownBypass,
  getItemDetails,
  addRadiantCrystals,
  deductRadiantCrystals,
  getRadiantCrystals,
  getLevelCap,
  getLevelCapForUser,
  getPrestigeMultiplier,
  getPrestigeMultiplierForUser,
  applyPrestigeToStats,
  applyPrestigeToAttacks,
  getEffectivePrestige,
  getEffectivePrestigeForPokemon,
  getPrestigeRequirements,
  checkPrestigeEligibility,
  performPrestige,
  getOmegaRequirements,
  checkOmegaEligibility,
  performOmega,
  calculateUserLevel,
  addUserXP,
  getUserProfile,
  getRankBadge,
  MARKET_ITEMS,
  TAX_RATE,
  OMEGA_MARKET_ITEMS,
  getOmegaItemDetails,
  getOmegaMarketCatalog,
  buyOmegaItem,
  useEnchantedStardust,
  useEnchantedWand,
  useDirtyDiaper,
  useLiterallyKaren,
  CRYSTAL_TO_COINS_RATE,
  COINS_TO_CRYSTAL_RATE,
  ITEM_EXCHANGE_PENALTY,
  exchangeCrystalsForCoins,
  exchangeCoinsForCrystals,
  exchangeItemForCoins,
  ensureFatherBalance,
  getHallOfFame
};