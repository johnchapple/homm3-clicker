// Game data. `img` values are file names on heroes.thelazy.net; scripts/scrape.mjs downloads them to public/img/.
(function (root) {
  const us = s => s.replace(/ /g, '_');
  const C = (name, upg, img, uimg) => ({ name, upg, img: `Creature_${img || us(name)}.png`, uimg: `Creature_${uimg || us(upg)}.png` });
  // Per-tier base cost / gold-per-sec (Cookie Clicker-like curve)
  const TIERS = [
    { cost: 15, gps: 0.1 }, { cost: 100, gps: 1 }, { cost: 1100, gps: 8 }, { cost: 12000, gps: 47 },
    { cost: 130000, gps: 260 }, { cost: 1.4e6, gps: 1400 }, { cost: 2e7, gps: 7800 }, { cost: 3.3e8, gps: 44000 },
  ];
  // HoMM3 weekly growth per tier (tier 0 = neutral, no dwelling). Here it is growth per in-game day per dwelling level.
  const GROWTH = [0, 14, 9, 7, 4, 3, 2, 1];

  // Towns. `grail` = Grail points needed to unlock. `dw` = dwelling names for tiers 1..7.
  // `idx` drives cost/production scaling (each town ~1000x the previous).
  const T = (id, name, idx, grail, units, dw, specials, grailB) => ({ id, name, idx, grail, units, dw, specials, grailB,
    costMul: Math.pow(1000, idx), gpsMul: Math.pow(1000, idx) * Math.pow(1.5, idx), img: `${name}_Castle_large.gif` });
  const TOWNS = [
    T('castle', 'Castle', 0, 0, [C('Peasant', 'Peasant Militia', null, 'Peasant'), C('Pikeman', 'Halberdier'), C('Archer', 'Marksman'), C('Griffin', 'Royal Griffin'),
      C('Swordsman', 'Crusader'), C('Monk', 'Zealot'), C('Cavalier', 'Champion'), C('Angel', 'Archangel')],
      ['Guardhouse', "Archers' Tower", 'Griffin Tower', 'Barracks', 'Monastery', 'Training Grounds', 'Portal of Glory'],
      [{ n: 'Stables', eff: { buff: 1.25 }, d: 'Artifact buffs last 25% longer.' },
       { n: 'Lighthouse', eff: { chest: 0.85 }, d: 'Wandering artifacts appear 15% more often.' },
       { n: 'Brotherhood of the Sword', eff: { click: 3 }, d: 'Clicks x3.' }],
      { n: 'Colossus', eff: { gps: 2 }, d: 'All gold production x2.' }),
    T('rampart', 'Rampart', 1, 1, [C('Halfling', 'Halfling Scout', null, 'Halfling'), C('Centaur', 'Centaur Captain'), C('Dwarf', 'Battle Dwarf'), C('Wood Elf', 'Grand Elf'),
      C('Pegasus', 'Silver Pegasus'), C('Dendroid Guard', 'Dendroid Soldier'), C('Unicorn', 'War Unicorn'), C('Green Dragon', 'Gold Dragon')],
      ['Centaur Stables', 'Dwarf Cottage', 'Homestead', 'Enchanted Spring', 'Dendroid Arches', 'Unicorn Glade', 'Dragon Cliffs'],
      [{ n: 'Mystic Pond', eff: { resDaily: 1 }, d: 'Each day, a random rare resource bubbles up (an hour of mine output, min 10).' },
       { n: 'Fountain of Fortune', eff: { artDrop: 2 }, d: 'Wandering artifacts are twice as likely to leave a permanent artifact.' },
       { n: 'Treasury', eff: { interest: 0.05 }, d: 'Each day, earn 5% interest on your gold (max 10 min of production).' }],
      { n: 'Spirit Guardian', eff: { gps: 2, artDrop: 1.5 }, d: 'Gold x2, artifact drops +50%.' }),
    T('necropolis', 'Necropolis', 2, 10, [C('Rogue', 'Rogue Cutpurse', null, 'Rogue'), C('Skeleton', 'Skeleton Warrior'), C('Walking Dead', 'Zombie'), C('Wight', 'Wraith'),
      C('Vampire', 'Vampire Lord'), C('Lich', 'Power Lich'), C('Black Knight', 'Dread Knight'), C('Bone Dragon', 'Ghost Dragon')],
      ['Cursed Temple', 'Graveyard', 'Tomb of Souls', 'Estate', 'Mausoleum', 'Hall of Darkness', 'Dragon Vault'],
      [{ n: 'Necromancy Amplifier', eff: { necro: 0.01 }, d: 'Each day, raise Skeletons equal to 1% of all your creatures.' },
       { n: 'Skeleton Transformer', eff: { unit: { necropolis_1: 5 } }, d: 'Skeleton production x5.' },
       { n: 'Cover of Darkness', eff: { offlineCap: 8 }, d: 'Offline earnings cap +8 hours.' }],
      { n: 'Soul Prison', eff: { gps: 2, necro: 0.02 }, d: 'Gold x2, Necromancy +2%.' }),
    T('inferno', 'Inferno', 3, 40, [C('Nomad', 'Nomad Rider', null, 'Nomad'), C('Imp', 'Familiar'), C('Gog', 'Magog'), C('Hell Hound', 'Cerberus'),
      C('Demon', 'Horned Demon'), C('Pit Fiend', 'Pit Lord'), C('Efreeti', 'Efreet Sultan'), C('Devil', 'Arch Devil')],
      ['Imp Crucible', 'Hall of Sins', 'Kennels', 'Demon Gate', 'Hell Hole', 'Fire Lake', 'Forsaken Palace'],
      [{ n: 'Castle Gate', eff: { week: 1 }, d: 'Week of the ... bonus is x3 instead of x2.' },
       { n: 'Order of Fire', eff: { click: 3 }, d: 'Clicks x3.' },
       { n: 'Brimstone Stormclouds', eff: { artPower: 2 }, d: 'Endless Purse and Cornucopia give twice as much.' }],
      { n: 'Deity of Fire', eff: { gps: 2, week: 1 }, d: 'Gold x2, weekly bonus +1x more.' }),
    T('tower', 'Tower', 4, 150, [C('Boar', 'Boar Rider', null, 'Boar'), C('Gremlin', 'Master Gremlin'), C('Stone Gargoyle', 'Obsidian Gargoyle'), C('Stone Golem', 'Iron Golem'),
      C('Mage', 'Arch Mage'), C('Genie', 'Master Genie'), C('Naga', 'Naga Queen'), C('Giant', 'Titan')],
      ['Workshop', 'Parapet', 'Golem Factory', 'Mage Tower', 'Altar of Wishes', 'Golden Pavilion', 'Cloud Temple'],
      [{ n: 'Library', eff: { skillCost: 0.5 }, d: 'Secondary skills cost half as much gold.' },
       { n: 'Wall of Knowledge', eff: { grailBonus: 0.01 }, d: 'Each Grail point gives +1% more production.' },
       { n: 'Lookout Tower', eff: { chestLife: 2 }, d: 'Wandering artifacts linger twice as long.' }],
      { n: 'Skyship', eff: { gps: 2, chest: 0.8 }, d: 'Gold x2, artifacts appear 20% more often.' }),
    T('dungeon', 'Dungeon', 5, 600, [C('Mummy', 'Mummy Lord', null, 'Mummy'), C('Troglodyte', 'Infernal Troglodyte'), C('Harpy', 'Harpy Hag'), C('Beholder', 'Evil Eye'),
      C('Medusa', 'Medusa Queen'), C('Minotaur', 'Minotaur King'), C('Manticore', 'Scorpicore'), C('Red Dragon', 'Black Dragon')],
      ['Warren', 'Harpy Loft', 'Pillar of Eyes', 'Chapel of Stilled Voices', 'Labyrinth', 'Manticore Lair', 'Dragon Cave'],
      [{ n: 'Artifact Merchants', eff: { artDrop: 2 }, d: 'Permanent artifact drops twice as likely.' },
       { n: 'Mana Vortex', eff: { buff: 1.5 }, d: 'Artifact buffs last 50% longer.' },
       { n: 'Portal of Summoning', eff: { growthAll: 1.5 }, d: 'All dwellings in every town grow 50% faster.' }],
      { n: 'Guardian of Earth', eff: { gps: 2, tier7: 2 }, d: 'Gold x2, all tier-7 creatures x2.' }),
    T('stronghold', 'Stronghold', 6, 2500, [C('Troll', 'Troll Chieftain', null, 'Troll'), C('Goblin', 'Hobgoblin'), C('Wolf Rider', 'Wolf Raider'), C('Orc', 'Orc Chieftain'),
      C('Ogre', 'Ogre Mage'), C('Roc', 'Thunderbird'), C('Cyclops', 'Cyclops King'), C('Behemoth', 'Ancient Behemoth')],
      ['Goblin Barracks', 'Wolf Pen', 'Orc Tower', 'Ogre Fort', 'Cliff Nest', 'Cyclops Cave', 'Behemoth Lair'],
      [{ n: "Freelancer's Guild", eff: { trade: 0.4 }, d: 'Trading Post prices -60%.' },
       { n: 'Hall of Valhalla', eff: { click: 5 }, d: 'Clicks x5.' },
       { n: 'Ballista Yard', eff: { clickGps: 0.05 }, d: 'Clicks gain +5% of gold/sec.' }],
      { n: "Warlords' Monument", eff: { gps: 2, click: 2 }, d: 'Gold x2, clicks x2.' }),
    T('fortress', 'Fortress', 7, 10000, [C('Sharpshooter', 'Sharpshooter Elite', null, 'Sharpshooter'), C('Gnoll', 'Gnoll Marauder'), C('Lizardman', 'Lizard Warrior'), C('Serpent Fly', 'Dragon Fly'),
      C('Basilisk', 'Greater Basilisk'), C('Gorgon', 'Mighty Gorgon'), C('Wyvern', 'Wyvern Monarch'), C('Hydra', 'Chaos Hydra')],
      ['Gnoll Hut', 'Lizard Den', 'Serpent Fly Hive', 'Basilisk Pit', 'Gorgon Lair', 'Wyvern Nest', 'Hydra Pond'],
      [{ n: 'Cage of Warlords', eff: { gps: 1.5 }, d: '+50% gold production.' },
       { n: 'Glyphs of Fear', eff: { upgCost: 0.5 }, d: 'Creature upgrades cost half as much gold.' },
       { n: 'Blood Obelisk', eff: { unitCost: 0.9 }, d: 'Creatures cost 10% less.' }],
      { n: 'Carnivorous Plant', eff: { gps: 3 }, d: 'Gold x3.' }),
    T('conflux', 'Conflux', 8, 40000, [C('Enchanter', 'Enchanter Elite', null, 'Enchanter'), C('Pixie', 'Sprite'), C('Air Elemental', 'Storm Elemental'), C('Water Elemental', 'Ice Elemental'),
      C('Fire Elemental', 'Energy Elemental'), C('Earth Elemental', 'Magma Elemental'), C('Psychic Elemental', 'Magic Elemental'), C('Firebird', 'Phoenix')],
      ['Magic Lantern', 'Altar of Air', 'Altar of Water', 'Altar of Fire', 'Altar of Earth', 'Altar of Thought', 'Pyre'],
      [{ n: 'Magic University', eff: { skillCost: 0.5 }, d: 'Secondary skills cost half as much gold.' },
       { n: 'Mage Guild level 5', eff: { buff: 2 }, d: 'Artifact buffs last twice as long.' },
       { n: 'Garden of Life', eff: { growthAll: 2 }, d: 'All dwellings grow twice as fast.' }],
      { n: 'Aurora Borealis', eff: { gps: 5 }, d: 'Gold x5.' }),
  ];
  // per-town fortifications: boost that town's dwelling growth (as in HoMM3)
  const FORTS = [
    { id: 'fort', n: 'Fort', eff: { growth: 1.25 }, d: "This town's dwellings grow 25% faster.", gold: 5e4, res: 1 },
    { id: 'citadel', n: 'Citadel', eff: { growth: 1.5 }, d: "This town's dwellings grow 50% faster.", gold: 5e5, res: 3 },
    { id: 'castle', n: 'Castle', eff: { growth: 2, tgps: 1.5 }, d: "Dwellings grow x2 faster; this town's creatures +50% gold.", gold: 5e6, res: 8 },
  ];

  const RES = ['wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'];
  const RARE = ['mercury', 'sulfur', 'crystal', 'gems'];
  const RES_INFO = {
    gold: { name: 'Gold', img: 'Resource_Gold_20x18.gif' },
    wood: { name: 'Wood', img: 'Resource_Wood_20x18.gif' }, ore: { name: 'Ore', img: 'Resource_Ore_20x18.gif' },
    mercury: { name: 'Mercury', img: 'Resource_Mercury_20x18.gif' }, sulfur: { name: 'Sulfur', img: 'Resource_Sulfur_20x18.gif' },
    crystal: { name: 'Crystal', img: 'Resource_Crystal_20x18.gif' }, gems: { name: 'Gems', img: 'Resource_Gem_20x18.gif' },
  };
  const MINES = [
    { id: 'wood', name: 'Sawmill', cost: 2000, rate: 0.03, img: 'Wood_(leather).gif' },
    { id: 'ore', name: 'Ore Pit', cost: 2000, rate: 0.03, img: 'Ore_(leather).gif' },
    { id: 'mercury', name: "Alchemist's Lab", cost: 25000, rate: 0.015, img: 'Mercury_(leather).gif' },
    { id: 'sulfur', name: 'Sulfur Dune', cost: 25000, rate: 0.015, img: 'Sulfur_(leather).gif' },
    { id: 'crystal', name: 'Crystal Cavern', cost: 25000, rate: 0.015, img: 'Crystal_(leather).gif' },
    { id: 'gems', name: 'Gem Pond', cost: 25000, rate: 0.015, img: 'Gem_(leather).gif' },
  ];
  // Kingdom-wide buildings
  const BUILDINGS = [
    { id: 'tavern', name: 'Tavern', cost: { gold: 500 }, eff: { click: 2 }, img: 'Castle_Tavern_large.gif', desc: 'Rumours of treasure. Clicks are twice as strong.' },
    { id: 'blacksmith', name: 'Blacksmith', cost: { gold: 5000, wood: 15 }, eff: { click: 2 }, img: 'Castle_Blacksmith_large.gif', desc: 'Sharper picks. Clicks x2.' },
    { id: 'marketplace', name: 'Marketplace', cost: { gold: 15000, wood: 15, ore: 15 }, eff: { gps: 1.1, tradeOn: 1 }, img: 'Castle_Marketplace_large.gif', desc: '+10% gold production. Opens the Trading Post (Mines tab).' },
    { id: 'silo', name: 'Resource Silo', cost: { gold: 40000, wood: 15, ore: 30 }, eff: { mines: 2 }, img: 'Castle_Resource_Silo_large.gif', desc: 'Mines produce twice as much.' },
    { id: 'villagehall', name: 'Village Hall', cost: { gold: 60000, wood: 20 }, eff: { gps: 1.1, offline: 1 }, img: 'Castle_Village_Hall_large.gif', desc: '+10% gold and full offline earnings (instead of 50%).' },
    { id: 'townhall', name: 'Town Hall', cost: { gold: 1e5, wood: 45, ore: 45 }, eff: { gps: 1.25 }, img: 'Castle_Town_Hall_large.gif', desc: '+25% gold production.' },
    { id: 'cityhall', name: 'City Hall', cost: { gold: 1e7, wood: 90, ore: 90, crystal: 15, gems: 15 }, eff: { gps: 1.5 }, img: 'Castle_City_Hall_large.gif', desc: '+50% gold production.' },
    { id: 'mageguild', name: 'Mage Guild', cost: { gold: 5e7, wood: 60, ore: 60, mercury: 30, sulfur: 30, crystal: 30, gems: 30 }, eff: { buff: 1.5 }, img: 'Castle_Mage_Guild_level_1_large.gif', desc: 'Artifact buffs last 50% longer.' },
    { id: 'capitol', name: 'Capitol', cost: { gold: 1e9, wood: 150, ore: 150, mercury: 60, sulfur: 60, crystal: 60, gems: 60 }, eff: { gps: 2 }, img: 'Castle_Capitol_large.gif', desc: 'Gold production x2.' },
  ];
  // Hero secondary skills, 3 levels each
  const SKILLS = [
    { id: 'Estates', desc: ['Clicks also gain 1% of gold/sec.', 'Clicks gain +2% of gold/sec.', 'Clicks gain +3% of gold/sec.'], base: 2000, res: 'gems' },
    { id: 'Leadership', desc: ['+5% gold production.', '+10% gold production.', '+15% gold production.'], base: 8000, res: 'crystal' },
    { id: 'Offense', desc: ['Clicks x2.', 'Clicks x2 again.', 'Clicks x2 again.'], base: 12000, res: 'sulfur' },
    { id: 'Logistics', desc: ['Artifacts appear 15% more often.', '+15% more often.', '+15% more often.'], base: 20000, res: 'mercury' },
    { id: 'Diplomacy', desc: ['Creatures 4% cheaper.', '4% cheaper again.', '4% cheaper again.'], base: 50000, res: 'gems' },
    { id: 'Mysticism', desc: ['Mines +50%.', 'Mines +50% more.', 'Mines +50% more.'], base: 60000, res: 'crystal' },
    { id: 'Luck', desc: ['Artifact buffs last 15% longer.', '+15% longer.', '+15% longer.'], base: 1e5, res: 'sulfur' },
    { id: 'Scholar', desc: ['Creature upgrades 10% cheaper.', '10% cheaper again.', '10% cheaper again.'], base: 2e5, res: 'mercury' },
    { id: 'Sorcery', desc: ['Purse & Cornucopia +50%.', '+50% more.', '+50% more.'], base: 5e5, res: 'mercury' },
    { id: 'Wisdom', desc: ['+1% gold per Grail point bonus.', '+1% more.', '+1% more.'], base: 1e6, res: 'crystal' },
    { id: 'Necromancy', desc: ['Each day raise Skeletons = 0.5% of your creatures.', '+0.5% more.', '+0.5% more.'], base: 1e7, res: 'mercury', town: 'necropolis' },
  ].map(s => ({ ...s, imgs: ['Basic', 'Advanced', 'Expert'].map(l => `${l}_${s.id}.png`) }));

  // Heroes: pick one per run. eff uses the same keys as buildings.
  const H = (name, town, spec, eff, d) => ({ id: us(name).toLowerCase(), name, town, spec, eff, d, img: `Hero_${us(name)}.png` });
  const HEROES = [
    H('Lord Haart', 'castle', 'Estates', { clickGps: 0.03, gps: 1.1 }, 'Clicks gain 3% of gold/sec, +10% gold.'),
    H('Edric', 'castle', 'Griffins', { unit: { castle_3: 4 } }, 'Griffins produce x4.'),
    H('Orrin', 'castle', 'Archery', { unit: { castle_2: 4 } }, 'Archers produce x4.'),
    H('Sorsha', 'castle', 'Swordsmen', { unit: { castle_4: 4 } }, 'Swordsmen produce x4.'),
    H('Ivor', 'rampart', 'Wood Elves', { unit: { rampart_3: 4 } }, 'Wood Elves produce x4.'),
    H('Kyrre', 'rampart', 'Logistics', { chest: 0.7 }, 'Wandering artifacts appear 30% more often.'),
    H('Jenova', 'rampart', 'Gold', { gps: 1.35 }, '+35% gold production.'),
    H('Galthran', 'necropolis', 'Skeletons', { unit: { necropolis_1: 6 } }, 'Skeletons produce x6.'),
    H('Isra', 'necropolis', 'Necromancy', { necro: 0.02 }, 'Each day raise Skeletons = 2% of your creatures.'),
    H('Sandro', 'necropolis', 'Sorcery', { buff: 1.5, artPower: 1.5 }, 'Buffs last 50% longer, artifact hauls +50%.'),
    H('Xeron', 'inferno', 'Devils', { unit: { inferno_7: 4 } }, 'Devils produce x4.'),
    H('Rashka', 'inferno', 'Efreeti', { unit: { inferno_6: 4 } }, 'Efreeti produce x4.'),
    H('Solmyr', 'tower', 'Chain Lightning', { click: 10 }, 'Clicks x10.'),
    H('Josephine', 'tower', 'Golems', { unit: { tower_3: 4 } }, 'Golems produce x4.'),
    H('Mutare', 'dungeon', 'Dragons', { tier7: 3 }, 'All tier-7 creatures produce x3.'),
    H('Gunnar', 'dungeon', 'Logistics', { chest: 0.6 }, 'Wandering artifacts appear 40% more often.'),
    H('Crag Hack', 'stronghold', 'Offense', { click: 10, clickGps: 0.02 }, 'Clicks x10 and +2% of gold/sec.'),
    H('Tyraxor', 'stronghold', 'Wolf Riders', { unit: { stronghold_2: 4 } }, 'Wolf Riders produce x4.'),
    H('Tazar', 'fortress', 'Armorer', { gps: 1.6 }, '+60% gold production.'),
    H('Broghild', 'fortress', 'Wyverns', { unit: { fortress_6: 4 } }, 'Wyverns produce x4.'),
    H('Luna', 'conflux', 'Fire Wall', { growthAll: 2 }, 'All dwellings grow twice as fast.'),
    H('Monere', 'conflux', 'Psychic Elementals', { unit: { conflux_6: 4 } }, 'Psychic Elementals produce x4.'),
  ];

  // Wandering (temporary) artifacts
  const ARTIFACTS = [
    { id: 'sack', name: 'Endless Sack of Gold', img: 'Artifact_Endless_Sack_of_Gold.gif', w: 1, desc: 'Gold production x7 for 77 seconds!' },
    { id: 'purse', name: 'Endless Purse of Gold', img: 'Artifact_Endless_Purse_of_Gold.gif', w: 6, desc: 'A lucky haul of gold!' },
    { id: 'wings', name: 'Angel Wings', img: 'Artifact_Angel_Wings.gif', w: 2, desc: 'Clicks x77 for 13 seconds!' },
    { id: 'cornucopia', name: 'Cornucopia', img: 'Artifact_Cornucopia.gif', w: 2, desc: 'A shower of rare resources!' },
  ];
  // Permanent artifacts (kept through Grail resets). Small chance to drop when you click a wandering artifact.
  const A = (name, eff, d) => ({ id: us(name).toLowerCase().replace(/'/g, ''), name, eff, d, img: `Artifact_${us(name)}.gif` });
  const RELICS = [
    A("Centaur's Axe", { click: 1.5 }, 'Clicks x1.5.'), A('Blackshard of the Dead Knight', { click: 1.5 }, 'Clicks x1.5.'),
    A("Greater Gnoll's Flail", { click: 1.5 }, 'Clicks x1.5.'), A("Ogre's Club of Havoc", { click: 2 }, 'Clicks x2.'),
    A('Ring of Vitality', { gps: 1.05 }, '+5% gold.'), A('Ring of Life', { gps: 1.05 }, '+5% gold.'), A('Vial of Lifeblood', { gps: 1.1 }, '+10% gold.'),
    A("Ring of the Wayfarer", { chest: 0.9 }, 'Artifacts appear 10% more often.'), A("Equestrian's Gloves", { chest: 0.9 }, 'Artifacts appear 10% more often.'),
    A('Boots of Speed', { chest: 0.85 }, 'Artifacts appear 15% more often.'),
    A('Charm of Mana', { buff: 1.1 }, 'Buffs last 10% longer.'), A('Talisman of Mana', { buff: 1.1 }, 'Buffs last 10% longer.'), A('Mystic Orb of Mana', { buff: 1.15 }, 'Buffs last 15% longer.'),
    A('Inexhaustible Cart of Lumber', { res: { wood: 2 } }, 'Wood income x2.'), A('Inexhaustible Cart of Ore', { res: { ore: 2 } }, 'Ore income x2.'),
    A('Everpouring Vial of Mercury', { res: { mercury: 2 } }, 'Mercury income x2.'), A('Eversmoking Ring of Sulfur', { res: { sulfur: 2 } }, 'Sulfur income x2.'),
    A('Everflowing Crystal Cloak', { res: { crystal: 2 } }, 'Crystal income x2.'), A('Ring of Infinite Gems', { res: { gems: 2 } }, 'Gem income x2.'),
    A('Clover of Fortune', { artDrop: 1.5 }, 'Permanent artifacts drop 50% more often.'), A('Ladybird of Luck', { artDrop: 1.5 }, 'Permanent artifacts drop 50% more often.'),
    A('Cards of Prophecy', { week: 1 }, 'Weekly creature bonus +1x.'), A("Statesman's Medal", { unitCost: 0.95 }, 'Creatures 5% cheaper.'),
    A("Diplomat's Ring", { unitCost: 0.95 }, 'Creatures 5% cheaper.'), A("Ambassador's Sash", { unitCost: 0.95 }, 'Creatures 5% cheaper.'),
    A('Golden Bow', { clickGps: 0.01 }, 'Clicks gain +1% of gold/sec.'), A('Crown of Dragontooth', { tier7: 1.5 }, 'Tier-7 creatures +50%.'),
    A('Sword of Judgement', { gps: 1.25 }, '+25% gold.'), A('Titan\'s Gladius', { click: 3 }, 'Clicks x3.'), A('Hourglass of the Evil Hour', { offlineCap: 4 }, 'Offline cap +4 hours.'),
  ];

  const ACH = [
    ['click1', 'First Coin', 'Click the treasure once.', 'Every empire starts with a single coin.', s => s.clicks >= 1],
    ['click100', 'Diligent Digger', 'Click 100 times.', 'Your arm aches. Your purse does not.', s => s.clicks >= 100],
    ['click1000', 'Treasure Hunter', 'Click 1,000 times.', 'Even the dragons are impressed.', s => s.clicks >= 1000],
    ['click10k', 'Obsessive Excavator', 'Click 10,000 times.', 'There may be a problem.', s => s.clicks >= 1e4],
    ['gold1k', 'Pocket Change', 'Earn 1,000 gold.', 'Enough to hire a few peasants.', s => s.runEarned >= 1e3],
    ['gold1m', 'Royal Treasury', 'Earn 1 million gold.', 'Lord Haart nods approvingly.', s => s.runEarned >= 1e6],
    ['gold1b', 'Gold Golem Sized', 'Earn 1 billion gold.', 'You could cast a golem from it.', s => s.runEarned >= 1e9],
    ['gold1t', 'Dragon Hoard', 'Earn 1 trillion gold.', 'Somewhere a Gold Dragon feels inadequate.', s => s.runEarned >= 1e12],
    ['gold1qa', 'Erathia Bankrupted', 'Earn 1 quadrillion gold in one run.', 'Catherine sends a polite letter asking for a loan.', s => s.runEarned >= 1e15],
    ['gold1qi', 'Antagarich Economy', 'Earn 1 quintillion gold in one run.', 'The whole continent trades in your coin.', s => s.runEarned >= 1e18],
    ['gold1sp', 'Beyond the Shadow of Death', 'Earn 1 septillion gold in one run.', 'Even the Liches lost count.', s => s.runEarned >= 1e24],
    ['units10', 'A Small Army', 'Own 10 creatures.', 'Few. Not very many.', s => s.totalUnits >= 10],
    ['units100', 'A Pack', 'Own 100 creatures.', 'Lots, by any measure.', s => s.totalUnits >= 100],
    ['units500', 'A Legion', 'Own 500 creatures.', 'Zounds! A legion approaches.', s => s.totalUnits >= 500],
    ['units5k', 'A Swarm', 'Own 5,000 creatures.', 'The map is mostly your army now.', s => s.totalUnits >= 5000],
    ['angel', 'Heavenly Host', 'Recruit an Angel.', 'Wings of gold, a sword of fire.', s => (s.owned.castle_7 || 0) >= 1],
    ['gps100', 'Steady Income', 'Reach 100 gold/sec.', 'The Marketplace hums.', s => s.gps >= 100],
    ['gps10k', 'Kingdom Overview', 'Reach 10,000 gold/sec.', 'Your realm prospers.', s => s.gps >= 1e4],
    ['gps1m', 'Capitol Ambitions', 'Reach 1 million gold/sec.', 'Taxes flow like the River of Souls.', s => s.gps >= 1e6],
    ['gps1t', 'Golden Age', 'Reach 1 trillion gold/sec.', 'Bards will sing of your treasury.', s => s.gps >= 1e12],
    ['mine1', 'Flagged!', 'Capture your first mine.', 'A blue flag waves over the Sawmill.', s => s.totalMines >= 1],
    ['mines6', 'Every Resource', 'Own one of each mine.', 'Wood, Ore, Mercury, Sulfur, Crystal and Gems: all yours.', s => s.mineKinds >= 6],
    ['trade', 'Shrewd Merchant', 'Trade at the Trading Post.', 'The rates are criminal. You pay anyway.', s => s.trades >= 1],
    ['chest1', 'Something Shiny', 'Click a wandering artifact.', 'Your hero picks up the strange object.', s => s.chests >= 1],
    ['chest25', 'Artifact Collector', 'Click 25 wandering artifacts.', 'The backpack is getting heavy.', s => s.chests >= 25],
    ['relic1', 'Treasure of the Ancients', 'Find a permanent artifact.', 'This one is staying with you.', s => s.relicCount >= 1],
    ['relic10', 'Curator', 'Own 10 permanent artifacts.', 'You need a bigger backpack.', s => s.relicCount >= 10],
    ['relicAll', 'Museum of Antagarich', 'Own every permanent artifact.', 'There is nothing left to find. Or is there?', s => s.relicCount >= RELICS.length],
    ['week', 'Astrologers Proclaim', 'Survive your first week.', 'Week of the Peasant. Population growth +1.', s => s.day >= 8],
    ['month', 'A New Month Dawns', 'Survive 4 weeks.', 'Month of the Plague narrowly avoided.', s => s.day >= 29],
    ['skill', 'Apprentice Hero', 'Learn a secondary skill.', 'Your hero gains experience!', s => s.skillLevels >= 1],
    ['expert', 'Expert', 'Reach Expert level in any skill.', 'Mastery is its own reward. Also gold.', s => s.maxSkill >= 3],
    ['lvl10', 'Seasoned Hero', 'Reach hero level 10.', 'Your hero has seen things.', s => s.heroLevel >= 10],
    ['lvl30', 'Legendary Hero', 'Reach hero level 30.', 'Tales of your deeds reach Enroth.', s => s.heroLevel >= 30],
    ['hire', 'New Blood', 'Hire a different hero at the Tavern.', '"I hear you are recruiting."', s => s.heroHires >= 1],
    ['dwell', 'Population Growth', 'Build a creature dwelling.', 'They will come on their own now.', s => s.dwellings >= 1],
    ['dwell25', 'Thriving Realm', 'Own 25 dwelling levels.', 'Creatures arrive faster than you can count.', s => s.dwellings >= 25],
    ['fortcastle', 'Fortified', 'Build a Castle in any town.', 'Walls, moat and arrow towers.', s => s.forts >= 1],
    ['capitol', 'Capitol Built', 'Build the Capitol.', '4,000 gold per day, in the old days.', s => s.buildings.capitol],
    ['grailb', 'Monument to Glory', 'Build a Grail structure.', 'Visible from three map sectors away.', s => s.grailBuildings >= 1],
    ['grail1', 'The Grail!', 'Find the Grail.', 'You dig... and find the Grail!', s => s.ascensions >= 1],
    ['grail10', 'Serial Excavator', 'Find the Grail 10 times.', 'The obelisks no longer need reading.', s => s.ascensions >= 10],
    ...TOWNS.slice(1).map(t => [`town_${t.id}`, `${t.name} Joins`, `Unlock ${t.name}.`, {
      rampart: 'The elves welcome you, warily.', necropolis: 'Necromancy: the ultimate recycling.', inferno: 'Kreegans welcome all coin.',
      tower: 'The wizards demand tuition.', dungeon: 'The Warlocks offer a dark bargain.', stronghold: 'Might makes right. And gold.',
      fortress: 'The swamp hides great riches.', conflux: 'The elements bow to your wealth.' }[t.id], s => !!s.towns[t.id]]),
  ].map(([id, name, req, flavor, test]) => ({ id, name, req, flavor, test }));
  const UI_IMG = { chest: 'Treasure_Chest.gif', grail: 'Grail.webp', bigGold: 'Gold_(leather).gif' };

  // image names for town buildings
  TOWNS.forEach(t => {
    t.specials.forEach(s => { s.img = `${t.name}_${us(s.n)}.gif`; });
    t.grailB.img = `Grail_${t.name}_${us(t.grailB.n)}.gif`;
  });

  const DATA = { TIERS, GROWTH, TOWNS, FORTS, RES, RARE, RES_INFO, MINES, BUILDINGS, SKILLS, HEROES, ARTIFACTS, RELICS, ACH, UI_IMG };
  DATA.dwImg = (t, i) => `${t.name}_${us(t.dw[i - 1])}.gif`;
  DATA.fortImg = (t, f) => `${t.name}_${f.n}_large.gif`;
  DATA.allImages = () => {
    const s = new Set(Object.values(UI_IMG));
    TOWNS.forEach(t => {
      s.add(t.img); t.units.forEach(u => { s.add(u.img); s.add(u.uimg); });
      t.specials.forEach(x => s.add(x.img)); s.add(t.grailB.img);
      for (let i = 1; i <= 7; i++) s.add(DATA.dwImg(t, i));
      FORTS.forEach(f => s.add(DATA.fortImg(t, f)));
    });
    Object.values(RES_INFO).forEach(r => s.add(r.img));
    MINES.forEach(m => s.add(m.img)); BUILDINGS.forEach(b => s.add(b.img));
    SKILLS.forEach(k => k.imgs.forEach(i => s.add(i))); ARTIFACTS.forEach(a => s.add(a.img));
    HEROES.forEach(h => s.add(h.img)); RELICS.forEach(a => s.add(a.img));
    return [...s];
  };
  DATA.localName = n => n.replace(/[^A-Za-z0-9._-]/g, '_');
  if (typeof module !== 'undefined') module.exports = DATA; else root.DATA = DATA;
})(this);
