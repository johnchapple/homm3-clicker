// Game data. `img` values are file names on heroes.thelazy.net; scripts/scrape.mjs downloads them to img/.
(function (root) {
  const C = (name, upg, img, uimg) => ({ name, upg, img: `Creature_${img || name.replace(/ /g, '_')}.png`, uimg: `Creature_${uimg || upg.replace(/ /g, '_')}.png` });
  // Per-tier base cost / gold-per-sec (Cookie Clicker-like curve)
  const TIERS = [
    { cost: 15, gps: 0.1 }, { cost: 100, gps: 1 }, { cost: 1100, gps: 8 }, { cost: 12000, gps: 47 },
    { cost: 130000, gps: 260 }, { cost: 1.4e6, gps: 1400 }, { cost: 2e7, gps: 7800 }, { cost: 3.3e8, gps: 44000 },
  ];
  const TOWNS = [
    { id: 'castle', name: 'Castle', costMul: 1, gpsMul: 1, unlock: 0, img: 'Castle_Castle_large.gif', units: [
      C('Peasant', 'Peasant Militia', null, 'Peasant'), C('Pikeman', 'Halberdier'), C('Archer', 'Marksman'), C('Griffin', 'Royal Griffin'),
      C('Swordsman', 'Crusader'), C('Monk', 'Zealot'), C('Cavalier', 'Champion'), C('Angel', 'Archangel')] },
    { id: 'rampart', name: 'Rampart', costMul: 1e3, gpsMul: 1.4e3, unlock: 1, img: 'Rampart_Castle_large.gif', units: [
      C('Halfling', 'Halfling Scout', null, 'Halfling'), C('Centaur', 'Centaur Captain'), C('Dwarf', 'Battle Dwarf'), C('Wood Elf', 'Grand Elf'),
      C('Pegasus', 'Silver Pegasus'), C('Dendroid Guard', 'Dendroid Soldier'), C('Unicorn', 'War Unicorn'), C('Green Dragon', 'Gold Dragon')] },
    { id: 'necropolis', name: 'Necropolis', costMul: 1e6, gpsMul: 2e6, unlock: 2, img: 'Necropolis_Castle_large.gif', units: [
      C('Rogue', 'Rogue Cutpurse', null, 'Rogue'), C('Skeleton', 'Skeleton Warrior'), C('Walking Dead', 'Zombie'), C('Wight', 'Wraith'),
      C('Vampire', 'Vampire Lord'), C('Lich', 'Power Lich'), C('Black Knight', 'Dread Knight'), C('Bone Dragon', 'Ghost Dragon')] },
    { id: 'inferno', name: 'Inferno', costMul: 1e9, gpsMul: 3e9, unlock: 3, img: 'Inferno_Castle_large.gif', units: [
      C('Nomad', 'Nomad Rider', null, 'Nomad'), C('Imp', 'Familiar'), C('Gog', 'Magog'), C('Hell Hound', 'Cerberus'),
      C('Demon', 'Horned Demon'), C('Pit Fiend', 'Pit Lord'), C('Efreeti', 'Efreet Sultan'), C('Devil', 'Arch Devil')] },
  ];
  // Mines: bought with gold, produce resources/sec
  const RES = ['wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'];
  const RES_INFO = {
    gold: { name: 'Gold', img: 'Resource_Gold_20x18.gif' },
    wood: { name: 'Wood', img: 'Resource_Wood_20x18.gif' }, ore: { name: 'Ore', img: 'Resource_Ore_20x18.gif' },
    mercury: { name: 'Mercury', img: 'Resource_Mercury_20x18.gif' }, sulfur: { name: 'Sulfur', img: 'Resource_Sulfur_20x18.gif' },
    crystal: { name: 'Crystal', img: 'Resource_Crystal_20x18.gif' }, gems: { name: 'Gems', img: 'Resource_Gem_20x18.gif' },
  };
  const MINES = [
    { id: 'wood', name: 'Sawmill', cost: 2000, rate: 0.2, img: 'Wood_(leather).gif' },
    { id: 'ore', name: 'Ore Pit', cost: 2000, rate: 0.2, img: 'Ore_(leather).gif' },
    { id: 'mercury', name: "Alchemist's Lab", cost: 25000, rate: 0.1, img: 'Mercury_(leather).gif' },
    { id: 'sulfur', name: 'Sulfur Dune', cost: 25000, rate: 0.1, img: 'Sulfur_(leather).gif' },
    { id: 'crystal', name: 'Crystal Cavern', cost: 25000, rate: 0.1, img: 'Crystal_(leather).gif' },
    { id: 'gems', name: 'Gem Pond', cost: 25000, rate: 0.1, img: 'Gem_(leather).gif' },
  ];
  // Town buildings: global effects. eff: {gps: mult, click: mult, mines: mult, offline: frac, chest: mult}
  const BUILDINGS = [
    { id: 'tavern', name: 'Tavern', cost: { gold: 500 }, eff: { click: 2 }, img: 'Castle_Tavern_large.gif', desc: 'Rumours of treasure. Clicks are twice as strong.' },
    { id: 'blacksmith', name: 'Blacksmith', cost: { gold: 5000, wood: 5 }, eff: { click: 2 }, img: 'Castle_Blacksmith_large.gif', desc: 'Sharper picks. Clicks x2.' },
    { id: 'marketplace', name: 'Marketplace', cost: { gold: 15000, wood: 5, ore: 5 }, eff: { gps: 1.1 }, img: 'Castle_Marketplace_large.gif', desc: '+10% gold production.' },
    { id: 'silo', name: 'Resource Silo', cost: { gold: 40000, wood: 5, ore: 10 }, eff: { mines: 2 }, img: 'Castle_Resource_Silo_large.gif', desc: 'Mines produce twice as much.' },
    { id: 'townhall', name: 'Town Hall', cost: { gold: 1e5, wood: 15, ore: 15 }, eff: { gps: 1.25 }, img: 'Castle_Town_Hall_large.gif', desc: '+25% gold production.' },
    { id: 'fort', name: 'Fort', cost: { gold: 5e5, wood: 20, ore: 20 }, eff: { chest: 0.8 }, img: 'Castle_Fort_large.gif', desc: 'Wandering artifacts appear 20% more often.' },
    { id: 'treasury', name: 'Treasury', cost: { gold: 2e6, ore: 20, crystal: 5 }, eff: { gps: 1.1, offline: 1 }, img: 'Rampart_Treasury.gif', desc: '+10% gold and full offline earnings (instead of 50%).' },
    { id: 'cityhall', name: 'City Hall', cost: { gold: 1e7, wood: 30, ore: 30, crystal: 5, gems: 5 }, eff: { gps: 1.5 }, img: 'Castle_City_Hall_large.gif', desc: '+50% gold production.' },
    { id: 'mageguild', name: 'Mage Guild', cost: { gold: 5e7, wood: 20, ore: 20, mercury: 10, sulfur: 10, crystal: 10, gems: 10 }, eff: { buff: 1.5 }, img: 'Castle_Mage_Guild_level_1_large.gif', desc: 'Artifact buffs last 50% longer.' },
    { id: 'citadel', name: 'Citadel', cost: { gold: 2e8, ore: 50, mercury: 15 }, eff: { chest: 0.8 }, img: 'Castle_Citadel_large.gif', desc: 'Wandering artifacts appear 20% more often.' },
    { id: 'capitol', name: 'Capitol', cost: { gold: 1e9, wood: 50, ore: 50, mercury: 20, sulfur: 20, crystal: 20, gems: 20 }, eff: { gps: 2 }, img: 'Castle_Capitol_large.gif', desc: 'Gold production x2.' },
    { id: 'castlewalls', name: 'Castle', cost: { gold: 1e10, wood: 100, ore: 100, crystal: 40, gems: 40 }, eff: { gps: 1.5, chest: 0.8 }, img: 'Castle_Castle_large.gif', desc: '+50% gold and more frequent artifacts.' },
  ];
  // Hero secondary skills, 3 levels each
  const SKILLS = [
    { id: 'Estates', desc: ['Clicks also gain 1% of gold/sec.', 'Clicks gain +2% of gold/sec.', 'Clicks gain +3% of gold/sec.'], base: 2000, res: 'gems' },
    { id: 'Leadership', desc: ['+5% gold production.', '+10% gold production.', '+15% gold production.'], base: 8000, res: 'crystal' },
    { id: 'Logistics', desc: ['Artifacts appear 15% more often.', '+15% more often.', '+15% more often.'], base: 20000, res: 'mercury' },
    { id: 'Diplomacy', desc: ['Dwellings 4% cheaper.', '4% cheaper again.', '4% cheaper again.'], base: 50000, res: 'gems' },
    { id: 'Luck', desc: ['Artifact buffs last 15% longer.', '+15% longer.', '+15% longer.'], base: 1e5, res: 'sulfur' },
    { id: 'Wisdom', desc: ['+1% gold per Grail point bonus.', '+1% more.', '+1% more.'], base: 1e6, res: 'crystal' },
  ].map(s => ({ ...s, imgs: ['Basic', 'Advanced', 'Expert'].map(l => `${l}_${s.id}.png`) }));
  const ARTIFACTS = [
    { id: 'sack', name: 'Endless Sack of Gold', img: 'Artifact_Endless_Sack_of_Gold.gif', w: 5, desc: 'Gold production x7 for 77 seconds!' },
    { id: 'purse', name: 'Endless Purse of Gold', img: 'Artifact_Endless_Purse_of_Gold.gif', w: 5, desc: 'A lucky haul of gold!' },
    { id: 'wings', name: 'Angel Wings', img: 'Artifact_Angel_Wings.gif', w: 2, desc: 'Clicks x77 for 13 seconds!' },
    { id: 'cornucopia', name: 'Cornucopia', img: 'Artifact_Cornucopia.gif', w: 2, desc: 'A shower of rare resources!' },
  ];
  const ACH = [
    ['click1', 'First Coin', 'Click the treasure once.', 'Every empire starts with a single coin.', s => s.clicks >= 1],
    ['click100', 'Diligent Digger', 'Click 100 times.', 'Your arm aches. Your purse does not.', s => s.clicks >= 100],
    ['click1000', 'Treasure Hunter', 'Click 1,000 times.', 'Even the dragons are impressed.', s => s.clicks >= 1000],
    ['gold1k', 'Pocket Change', 'Earn 1,000 gold.', 'Enough to hire a few peasants.', s => s.runEarned >= 1e3],
    ['gold1m', 'Royal Treasury', 'Earn 1 million gold.', 'Lord Haart nods approvingly.', s => s.runEarned >= 1e6],
    ['gold1b', 'Gold Golem Sized', 'Earn 1 billion gold.', 'You could cast a golem from it.', s => s.runEarned >= 1e9],
    ['gold1t', 'Dragon Hoard', 'Earn 1 trillion gold.', 'Somewhere a Gold Dragon feels inadequate.', s => s.runEarned >= 1e12],
    ['units10', 'A Small Army', 'Own 10 creatures.', 'Few. Not very many.', s => s.totalUnits >= 10],
    ['units100', 'A Pack', 'Own 100 creatures.', 'Lots, by any measure.', s => s.totalUnits >= 100],
    ['units500', 'A Legion', 'Own 500 creatures.', 'Zounds! A legion approaches.', s => s.totalUnits >= 500],
    ['angel', 'Heavenly Host', 'Recruit an Angel.', 'Wings of gold, a sword of fire.', s => (s.owned.castle_7 || 0) >= 1],
    ['gps100', 'Steady Income', 'Reach 100 gold/sec.', 'The Marketplace hums.', s => s.gps >= 100],
    ['gps10k', 'Kingdom Overview', 'Reach 10,000 gold/sec.', 'Your realm prospers.', s => s.gps >= 1e4],
    ['gps1m', 'Capitol Ambitions', 'Reach 1 million gold/sec.', 'Taxes flow like the River of Souls.', s => s.gps >= 1e6],
    ['mine1', 'Flagged!', 'Capture your first mine.', 'A blue flag waves over the Sawmill.', s => s.totalMines >= 1],
    ['mines6', 'Every Resource', 'Own one of each mine.', 'Wood, Ore, Mercury, Sulfur, Crystal and Gems: all yours.', s => s.mineKinds >= 6],
    ['chest1', 'Something Shiny', 'Click a wandering artifact.', 'Your hero picks up the strange object.', s => s.chests >= 1],
    ['chest25', 'Artifact Collector', 'Click 25 wandering artifacts.', 'The backpack is getting heavy.', s => s.chests >= 25],
    ['week', 'Astrologers Proclaim', 'Survive your first week.', 'Week of the Peasant. Population growth +1.', s => s.day >= 8],
    ['month', 'A New Month Dawns', 'Survive 4 weeks.', 'Month of the Plague narrowly avoided.', s => s.day >= 29],
    ['skill', 'Apprentice Hero', 'Learn a secondary skill.', 'Your hero gains experience!', s => s.skillLevels >= 1],
    ['expert', 'Expert', 'Reach Expert level in any skill.', 'Mastery is its own reward. Also gold.', s => s.maxSkill >= 3],
    ['capitol', 'Capitol Built', 'Build the Capitol.', '4,000 gold per day, in the old days.', s => s.buildings.capitol],
    ['grail1', 'The Grail!', 'Find the Grail.', 'You dig... and find the Grail!', s => s.ascensions >= 1],
    ['rampart', 'Into the Forest', 'Unlock Rampart.', 'The elves welcome you, warily.', s => s.ascensions >= 1],
    ['necro', 'Raise the Dead', 'Unlock Necropolis.', 'Necromancy: the ultimate recycling.', s => s.ascensions >= 2],
    ['inferno', 'Gates of Inferno', 'Unlock Inferno.', 'Kreegans welcome all coin.', s => s.ascensions >= 3],
  ].map(([id, name, req, flavor, test]) => ({ id, name, req, flavor, test }));
  const UI_IMG = { chest: 'Treasure_Chest.gif', grail: 'Grail.webp', hero: 'Hero_Lord_Haart.png', bigGold: 'Gold_(leather).gif' };

  const DATA = { TIERS, TOWNS, RES, RES_INFO, MINES, BUILDINGS, SKILLS, ARTIFACTS, ACH, UI_IMG };
  DATA.allImages = () => {
    const s = new Set(Object.values(UI_IMG));
    TOWNS.forEach(t => { s.add(t.img); t.units.forEach(u => { s.add(u.img); s.add(u.uimg); }); });
    Object.values(RES_INFO).forEach(r => s.add(r.img));
    MINES.forEach(m => s.add(m.img)); BUILDINGS.forEach(b => s.add(b.img));
    SKILLS.forEach(k => k.imgs.forEach(i => s.add(i))); ARTIFACTS.forEach(a => s.add(a.img));
    return [...s];
  };
  DATA.localName = n => n.replace(/[^A-Za-z0-9._-]/g, '_');
  if (typeof module !== 'undefined') module.exports = DATA; else root.DATA = DATA;
})(this);
