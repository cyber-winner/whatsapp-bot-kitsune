const GachaProfile = require('../models/GachaProfile');
const PokemonEntry = require('../models/Pokemon');
const POKEMON_LIST = require('../data/pokemon.json');
const BANNER = require('../data/gachaBanner.json');
const BASE_5STAR_RATE = 0.006;
const SOFT_PITY_5STAR_START = 74;
const SOFT_PITY_5STAR_INCREMENT = 0.060;
const HARD_PITY_5STAR = 90;
const BASE_4STAR_RATE = 0.051;
const SOFT_PITY_4STAR_PULL = 9;
const SOFT_PITY_4STAR_RATE = 0.561;
const HARD_PITY_4STAR = 10;
const FEATURED_RATE = 0.55;
async function getProfile(userId) {
  let profile = await GachaProfile.findOne({
    userId
  });
  if (!profile) {
    profile = await GachaProfile.create({
      userId
    });
  }
  return profile;
}
function get5StarRate(n) {
  if (n >= HARD_PITY_5STAR) return 1.0;
  if (n >= SOFT_PITY_5STAR_START) {
    return Math.min(1.0, BASE_5STAR_RATE + SOFT_PITY_5STAR_INCREMENT * (n - 73));
  }
  return BASE_5STAR_RATE;
}
function get4StarRate(n) {
  if (n >= HARD_PITY_4STAR) return 1.0;
  if (n >= SOFT_PITY_4STAR_PULL) return SOFT_PITY_4STAR_RATE;
  return BASE_4STAR_RATE;
}
function pickPokemonCard(baseNameOrId, wantVariant) {
  let baseCard;
  let targetId;
  if (typeof baseNameOrId === 'number' || !isNaN(baseNameOrId)) {
    targetId = parseInt(baseNameOrId);
    const candidates = POKEMON_LIST.filter(p => p.id === targetId);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.name.length - b.name.length);
    baseCard = candidates[0];
  } else {
    const baseLower = baseNameOrId.toLowerCase();
    baseCard = POKEMON_LIST.find(p => p.name.toLowerCase() === baseLower);
    if (baseCard) {
      targetId = baseCard.id;
    }
  }
  if (!baseCard || !targetId) return null;
  const allVariants = POKEMON_LIST.filter(p => p.id === targetId);
  if (!wantVariant || allVariants.length <= 1) {
    return {
      ...baseCard,
      isVariant: false
    };
  }
  const variants = allVariants.filter(p => p.name.toLowerCase() !== baseCard.name.toLowerCase());
  if (variants.length === 0) {
    return {
      ...baseCard,
      isVariant: false
    };
  }
  const picked = variants[Math.floor(Math.random() * variants.length)];
  return {
    ...picked,
    isVariant: true
  };
}
async function executeSingleWish(profile) {
  profile.pity5++;
  profile.pity4++;
  profile.totalWishes++;
  const currentPity5 = profile.pity5;
  const currentPity4 = profile.pity4;
  const rate5 = get5StarRate(currentPity5);
  if (Math.random() < rate5) {
    profile.pity5 = 0;
    profile.pity4 = 0;
    profile.total5Stars++;
    let isFeatured;
    if (profile.guaranteed5) {
      isFeatured = true;
      profile.guaranteed5 = false;
    } else {
      isFeatured = Math.random() < FEATURED_RATE;
      if (!isFeatured) {
        profile.guaranteed5 = true;
      }
    }
    const pokemonCard = pickPokemonCard(BANNER.featured5Star, isFeatured);
    return {
      rarity: 5,
      isFeatured,
      won5050: isFeatured && !profile.guaranteed5,
      pokemon: pokemonCard,
      pityCount: currentPity5
    };
  }
  const rate4 = get4StarRate(currentPity4);
  if (Math.random() < rate4) {
    profile.pity4 = 0;
    profile.total4Stars++;
    const chosen4Star = BANNER.pool4Star[Math.floor(Math.random() * BANNER.pool4Star.length)];
    const wantVariant = Math.random() < 0.5;
    const pokemonCard = pickPokemonCard(chosen4Star, wantVariant);
    return {
      rarity: 4,
      pokemon: pokemonCard,
      pityCount: currentPity4
    };
  }
  const pool = BANNER.pool3StarPool || [{
    "itemName": "Level Orb",
    "chance": 50
  }, {
    "itemName": "Raid Pass",
    "chance": 30
  }, {
    "itemName": "Enchanted Stardust",
    "chance": 19
  }, {
    "itemName": "Dirty Diaper",
    "chance": 1
  }];
  const roll3 = Math.random() * 100;
  let item3 = 'Level Orb';
  let cumulative = 0;
  for (const reward of pool) {
    cumulative += reward.chance;
    if (roll3 < cumulative) {
      item3 = reward.itemName;
      break;
    }
  }
  return {
    rarity: 3,
    item: item3,
    quantity: 1
  };
}
async function executeWishes(userId, wishCount, economyStore) {
  const profile = await getProfile(userId);
  const results = [];
  for (let i = 0; i < wishCount; i++) {
    const result = await executeSingleWish(profile);
    if (result.rarity === 5 || result.rarity === 4) {
      const pokemon = result.pokemon;
      if (pokemon) {
        const levelCap = await economyStore.getLevelCapForUser(userId);
        const wallet = await economyStore.getWallet(userId);
        const entry = await PokemonEntry.create({
          userId,
          pokemonName: pokemon.name,
          level: levelCap,
          dexId: pokemon.id,
          prestigeStamp: wallet.prestigeLevel || 0
        });
        await economyStore.addUserXP(userId, 25);
        result.dbId = entry._id;
        result.pokemonName = pokemon.name;
        result.cardImage = pokemon.cardImage;
        result.types = pokemon.types;
        result.isVariant = pokemon.isVariant;
        result.level = levelCap;
        const bs = pokemon.baseStats || {
          hp: 50,
          atk: 50,
          def: 50,
          spAtk: 50,
          spDef: 50,
          speed: 50
        };
        result.doubledStats = {
          hp: (bs.hp || 50) * 2,
          atk: (bs.atk || 50) * 2,
          def: (bs.def || 50) * 2,
          spAtk: (bs.spAtk || 50) * 2,
          spDef: (bs.spDef || 50) * 2,
          speed: (bs.speed || 50) * 2
        };
        result.isLegendary = pokemon.isLegendary || false;
        result.isMythical = pokemon.isMythical || false;
      }
    } else if (result.rarity === 3) {
      await economyStore.addInventoryItem(userId, result.item, result.quantity);
    }
    results.push(result);
  }
  await profile.save();
  return {
    results,
    profile: {
      pity5: profile.pity5,
      pity4: profile.pity4,
      guaranteed5: profile.guaranteed5,
      totalWishes: profile.totalWishes,
      total5Stars: profile.total5Stars,
      total4Stars: profile.total4Stars
    }
  };
}
function getBannerInfo() {
  const featured5StarCard = POKEMON_LIST.find(p => p.id === BANNER.featured5Star);
  const featured5StarName = featured5StarCard ? featured5StarCard.name : 'Unknown';
  const pool4StarNames = BANNER.pool4Star.map(id => {
    const card = POKEMON_LIST.find(p => p.id === id);
    return card ? card.name : 'Unknown';
  });
  return {
    name: BANNER.name,
    featured5Star: featured5StarName,
    featured5StarId: BANNER.featured5Star,
    pool4Star: pool4StarNames,
    pool4StarIds: [...BANNER.pool4Star],
    pool3StarPool: BANNER.pool3StarPool || []
  };
}
async function getProfileStats(userId) {
  const profile = await getProfile(userId);
  return {
    pity5: profile.pity5,
    pity4: profile.pity4,
    guaranteed5: profile.guaranteed5,
    totalWishes: profile.totalWishes,
    total5Stars: profile.total5Stars,
    total4Stars: profile.total4Stars
  };
}
module.exports = {
  executeWishes,
  getProfile,
  getProfileStats,
  getBannerInfo,
  get5StarRate,
  get4StarRate,
  BANNER
};