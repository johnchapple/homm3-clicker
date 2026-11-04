/* Heroes III Clicker — game logic. Plain JS, no build step. */
(function () {
  'use strict';
  const D = window.DATA;
  const IMG = n => (window.INLINE_IMG && window.INLINE_IMG[n]) || 'public/img/' + D.localName(n);
  const UIIMG = n => (window.INLINE_UI && window.INLINE_UI[n]) || 'public/ui/' + n;
  const SAVE_KEY = 'homm3clicker.save.v1';
  const TICK = 0.1;                 // fixed timestep (s)
  const DAY_LEN = 60;               // seconds per in-game day
  const $ = id => document.getElementById(id);
  const LV = ['Basic', 'Advanced', 'Expert'];

  // ---------- number formatting ----------
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg'];
  function fmt(n, dec) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n, dec);
    if (n < 1000) return n < 1 && n > 0 && dec !== 0 ? n.toFixed(2) : n < 10 && dec !== 0 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
    const e = Math.floor(Math.log10(n) / 3);
    if (e >= SUF.length) return n.toExponential(2).replace('+', '');
    const v = n / Math.pow(1000, e);
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + SUF[e];
  }
  const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + x + 's'; };

  // ---------- static tables ----------
  const TOWN = Object.fromEntries(D.TOWNS.map(t => [t.id, t]));
  const UNITS = [];
  D.TOWNS.forEach(t => t.units.forEach((u, i) => UNITS.push({ ...u, key: `${t.id}_${i}`, town: t, tier: i,
    cost: D.TIERS[i].cost * t.costMul, gps: D.TIERS[i].gps * t.gpsMul })));
  const UNIT = Object.fromEntries(UNITS.map(u => [u.key, u]));
  const resFor = (t, k) => { const c = {}; if (t >= 3) { c.wood = 8 * t * k; c.ore = 8 * t * k; }
    if (t >= 5) c[D.RARE[t % 4]] = 6 * t * k; return c; };

  // Creature upgrades: upgraded form (x3) + three drills (x2 each)
  const UPGRADES = [];
  UNITS.forEach(u => {
    const t = u.tier + u.town.idx * 2;
    UPGRADES.push({ id: u.key + '_u', unit: u.key, need: 5, mult: 3, name: u.upg === u.name ? `${u.name} Training` : `Upgrade to ${u.upg}`,
      img: u.uimg, desc: `${u.name}s become ${u.upg}s: production x3.`, gold: u.cost * 15, res: resFor(t, 1) });
    [['Veteran', 25, 100, 2], ['Elite', 50, 2000, 4], ['Legendary', 100, 50000, 8]].forEach(([lab, need, cm, rk], j) =>
      UPGRADES.push({ id: u.key + '_d' + j, unit: u.key, need, mult: 2, name: `${lab} ${u.upg}s`, img: u.uimg,
        desc: `${u.upg} production x2. Requires ${need} owned.`, gold: u.cost * cm, res: resFor(t, rk) }));
  });
  const UPG = Object.fromEntries(UPGRADES.map(x => [x.id, x]));

  // Per-town buildings: forts, specials, grail structure
  const TB = [];
  D.TOWNS.forEach(t => {
    const r = 1 + t.idx;
    D.BUILDINGS.forEach(b => TB.push({ id: `${t.id}_${b.id}`, town: t, g: b.g, name: b.name, desc: b.desc, eff: b.eff, img: D.bImg(t, b),
      req: b.req ? `${t.id}_${b.req}` : null,
      cost: Object.fromEntries(Object.entries(b.cost).map(([k, v]) => [k, k === 'gold' ? v * t.costMul : Math.ceil(v * r)])) }));
    D.FORTS.forEach((f, i) => TB.push({ id: `${t.id}_${f.id}`, town: t, name: f.n, desc: f.d, eff: f.eff, img: D.fortImg(t, f),
      req: i ? `${t.id}_${D.FORTS[i - 1].id}` : null,
      cost: { gold: f.gold * t.costMul, wood: 20 * f.res * r, ore: 20 * f.res * r, ...(i ? { [D.RARE[(t.idx + i) % 4]]: 10 * f.res * r } : {}) } }));
    t.specials.forEach((s, i) => TB.push({ id: `${t.id}_s${i}`, town: t, name: s.n, desc: s.d, eff: s.eff, img: s.img,
      cost: { gold: 2e5 * Math.pow(10, i) * t.costMul, wood: 30 * r * (i + 1), [D.RARE[(t.idx + i) % 4]]: 15 * r * (i + 1), [D.RARE[(t.idx + i + 1) % 4]]: 15 * r * (i + 1) } }));
    TB.push({ id: `${t.id}_grail`, town: t, name: t.grailB.n, desc: t.grailB.d + ' (Grail structure)', eff: t.grailB.eff, img: t.grailB.img, grail: true,
      req: `${t.id}_castle`, cost: { gold: 1e10 * t.costMul, wood: 100 * r, ore: 100 * r, mercury: 50 * r, sulfur: 50 * r, crystal: 50 * r, gems: 50 * r } });
  });
  const TBI = Object.fromEntries(TB.map(b => [b.id, b]));
  const HERO = Object.fromEntries(D.HEROES.map(h => [h.id, h]));
  const RELIC = Object.fromEntries(D.RELICS.map(a => [a.id, a]));

  // ---------- state ----------
  const fresh = (keep = {}) => ({
    v: 2, gold: 0, runEarned: 0, lifetime: keep.lifetime || 0, clicks: keep.clicks || 0, clickGold: keep.clickGold || 0,
    res: Object.fromEntries(D.RES.map(r => [r, 0])), owned: {}, bought: {}, upg: {}, mines: {}, buildings: {}, skills: {}, dw: {}, grow: {},
    grail: keep.grail || 0, ascensions: keep.ascensions || 0, chests: keep.chests || 0, ach: keep.ach || {},
    towns: keep.towns || { castle: 1 }, relics: keep.relics || {}, hero: keep.hero || 'lord_haart', heroHires: keep.heroHires || 0,
    trades: keep.trades || 0, time: 0, week: null, buffs: [], nextChest: 45, started: keep.started || Date.now(), lastSave: Date.now(),
  });
  let S = fresh();
  let speed = 1, buyN = 1, tab = 'upgrades', townTab = 'castle', townSub = 'castle', dirty = true;

  // ---------- effects ----------
  // E aggregates every bonus source (buildings, hero, relics). Rebuilt by recalc() after any purchase.
  const MULT = ['gps', 'click', 'mines', 'chest', 'chestLife', 'buff', 'growthAll', 'artPower', 'artDrop', 'skillCost', 'upgCost', 'unitCost', 'tier7', 'trade'];
  const ADD = ['clickGps', 'necro', 'interest', 'resDaily', 'grailBonus', 'week', 'offlineCap', 'tradeOn'];
  let E;
  function recalc() {
    E = { offline: 0.5, unit: {}, tgps: {}, growth: {}, res: {} };
    MULT.forEach(k => E[k] = 1); ADD.forEach(k => E[k] = 0);
    const apply = (eff, town) => {
      for (const [k, v] of Object.entries(eff)) {
        if (k === 'unit') for (const [u, m] of Object.entries(v)) E.unit[u] = (E.unit[u] || 1) * m;
        else if (k === 'res') for (const [r, m] of Object.entries(v)) E.res[r] = (E.res[r] || 1) * m;
        else if (k === 'growth' || k === 'tgps') E[k][town] = (E[k][town] || 1) * v;
        else if (k === 'offline') E.offline = Math.max(E.offline, v);
        else if (MULT.includes(k)) E[k] *= v; else if (ADD.includes(k)) E[k] += v;
      }
    };
    TB.forEach(b => S.buildings[b.id] && apply(b.eff, b.town.id));
    const h = HERO[S.hero]; if (h) apply(h.eff);
    Object.keys(S.relics).forEach(id => RELIC[id] && apply(RELIC[id].eff));
  }
  const skill = id => S.skills[id] || 0;
  const tri = l => l * (l + 1) / 2;
  const heroLevel = () => 1 + Math.floor(Math.log10(S.runEarned + 1) * 1.5);
  const grailMult = () => 1 + S.grail * (0.02 + 0.01 * skill('Wisdom') + E.grailBonus);
  const hasBuff = id => S.buffs.some(b => b.id === id);
  const unlocked = t => !!S.towns[t.id];
  function unitMult(key) {
    let m = E.unit[key] || 1; const u = UNIT[key];
    for (const id of ['_u', '_d0', '_d1', '_d2']) if (S.upg[key + id]) m *= UPG[key + id].mult;
    if (S.week === key) m *= 2 + E.week;
    if (u.tier === 7) m *= E.tier7;
    return m * (E.tgps[u.town.id] || 1);
  }
  const unitGps = key => UNIT[key].gps * unitMult(key);
  function globalMult(withBuffs = true) {
    let m = E.gps * (1 + 0.05 * tri(skill('Leadership'))) * grailMult() * (1 + 0.02 * (heroLevel() - 1));
    if (withBuffs && hasBuff('sack')) m *= 7;
    return m;
  }
  function baseGps() { let g = 0; for (const u of UNITS) if (S.owned[u.key]) g += S.owned[u.key] * unitGps(u.key); return g; }
  const gps = (withBuffs = true) => baseGps() * globalMult(withBuffs);
  function clickValue() {
    let c = E.click * Math.pow(2, skill('Offense')) * grailMult() + gps() * (0.01 * tri(skill('Estates')) + E.clickGps);
    if (hasBuff('wings')) c *= 77;
    return c;
  }
  const mineRate = id => (S.mines[id] || 0) * D.MINES.find(m => m.id === id).rate * E.mines * (E.res[id] || 1) * (1 + 0.5 * skill('Mysticism'));
  const growthRate = key => { const u = UNIT[key]; const l = S.dw[key] || 0;   // creatures per in-game day
    return l * D.GROWTH[u.tier] * E.growthAll * (E.growth[u.town.id] || 1); };
  const unitDiscount = () => Math.pow(0.96, skill('Diplomacy')) * E.unitCost;
  function unitCost(key, n = 1) {
    const u = UNIT[key], o = S.bought[key] || 0, r = 1.15;   // price follows units bought, so free growth never inflates it
    return u.cost * unitDiscount() * Math.pow(r, o) * (Math.pow(r, n) - 1) / (r - 1);
  }
  function maxBuy(key) { // binary search on geometric sum
    let lo = 0, hi = 1;
    while (hi < 1e6 && unitCost(key, hi) <= S.gold) hi *= 2;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (unitCost(key, mid) <= S.gold) lo = mid; else hi = mid - 1; }
    return lo;
  }
  const upgCost = u => ({ gold: u.gold * E.upgCost * Math.pow(0.9, skill('Scholar')), ...u.res });
  const mineCost = m => ({ gold: m.cost * Math.pow(2, S.mines[m.id] || 0) });
  function skillCost(sk) {
    const l = skill(sk.id); const c = { gold: sk.base * Math.pow(25, l) * E.skillCost };
    if (l >= 1) c[sk.res] = 30 * l * l; if (l >= 2) c.wood = 120; return c;
  }
  function dwCost(key) {
    const u = UNIT[key], l = S.dw[key] || 0, r = 1 + u.town.idx;
    const c = { gold: u.cost * 100 * Math.pow(2, l), wood: Math.ceil(4 * u.tier * r * (1 + l * 0.5)), ore: Math.ceil(4 * u.tier * r * (1 + l * 0.5)) };
    if (u.tier >= 4) c[D.RARE[u.tier % 4]] = Math.ceil(3 * u.tier * r * (1 + l * 0.5));
    return c;
  }
  const tradePrice = r => Math.max(r === 'wood' || r === 'ore' ? 60 : 250, gps(false) * (r === 'wood' || r === 'ore' ? 1.5 : 6)) * E.trade;
  const hireCost = () => S.time < 60 ? 0 : Math.max(2500, gps(false) * 600);
  const chestInterval = () => E.chest * Math.pow(0.85, skill('Logistics'));
  const buffDur = () => E.buff * Math.pow(1.15, skill('Luck'));
  const artPower = () => E.artPower * (1 + 0.5 * skill('Sorcery'));
  const relicChance = () => Math.min(0.9, 0.1 * E.artDrop);
  const necroFrac = () => E.necro + (unlocked(TOWN.necropolis) ? 0.005 * skill('Necromancy') : 0);
  const grailTotal = l => Math.floor(Math.cbrt(l / 1e9));
  const pendingGrail = () => Math.max(0, grailTotal(S.lifetime) - S.grail);
  const totalUnits = () => Object.values(S.owned).reduce((a, b) => a + b, 0);

  const have = k => k === 'gold' ? S.gold : S.res[k];
  const canAfford = c => Object.entries(c).every(([k, v]) => have(k) >= v - 1e-9);
  function pay(c) { if (!canAfford(c)) return false; for (const [k, v] of Object.entries(c)) k === 'gold' ? S.gold -= v : S.res[k] -= v; return true; }
  function costHtml(c) {
    return '<span class="cost">' + Object.entries(c).map(([k, v]) =>
      `<img src="${IMG(D.RES_INFO[k].img)}" alt="${D.RES_INFO[k].name}"> <span data-r="${k}" data-v="${v}" class="${have(k) >= v ? '' : 'no'}">${fmt(v)}</span>`).join(' ') + '</span>';
  }

  // ---------- simulation ----------
  function earn(g) { S.gold += g; S.runEarned += g; S.lifetime += g; }
  function addUnits(key, n) { S.owned[key] = (S.owned[key] || 0) + n; }
  function step(dt) {
    earn(gps() * dt);
    for (const m of D.MINES) if (S.mines[m.id]) S.res[m.id] += mineRate(m.id) * dt;
    for (const key in S.dw) {
      const g = growthRate(key); if (!g) continue;
      S.grow[key] = (S.grow[key] || 0) + g * dt / DAY_LEN;
      if (S.grow[key] >= 1) { const n = Math.floor(S.grow[key]); S.grow[key] -= n; addUnits(key, n); }
    }
    const prevDay = Math.floor(S.time / DAY_LEN);
    S.time += dt;
    const day = Math.floor(S.time / DAY_LEN);
    if (day !== prevDay) newDay(day);
    S.buffs = S.buffs.filter(b => (b.left -= dt) > 0);
    S.nextChest -= dt;
    if (S.nextChest <= 0 && !wanderEl) spawnWander();
    if (wanderEl && (wanderLeft -= dt) <= 0) removeWander();
  }
  function newDay(day) {
    const msgs = [];
    const nf = necroFrac();
    if (nf > 0) { const n = Math.floor(totalUnits() * nf); if (n > 0) { addUnits('necropolis_1', n); msgs.push(`Necromancy raised ${fmt(n)} Skeletons.`); } }
    if (E.resDaily) { const r = D.RARE[Math.floor(Math.random() * 4)]; const v = Math.ceil(Math.max(10, mineRate(r) * 3600) * E.resDaily); S.res[r] += v; msgs.push(`Mystic Pond: +${fmt(v)} ${D.RES_INFO[r].name}.`); }
    if (E.interest) { const g = Math.min(S.gold * E.interest, gps(false) * 600); if (g > 0) { earn(g); msgs.push(`Treasury interest: +${fmt(g)} gold.`); } }
    if (day % 7 === 0) newWeek();
    if (msgs.length) toast(msgs.join('<br>'));
    dirty = true;
  }
  function newWeek() {
    const pool = UNITS.filter(u => unlocked(u.town));
    const u = pool[Math.floor(Math.random() * pool.length)];
    S.week = u.key; dirty = true;
    SFX.play('week'); toast(`<b>Astrologers proclaim Week of the ${u.name}!</b><br>${u.name} production x${2 + E.week} this week.`);
  }

  // ---------- actions ----------
  const changed = () => { recalc(); dirty = true; };
  function doClick(ev) {
    SFX.play('click'); const v = clickValue(); earn(v); S.clicks++; S.clickGold += v;
    const r = $('clicker').getBoundingClientRect();
    const x = ev && ev.clientX ? ev.clientX : r.left + r.width / 2, y = ev && ev.clientY ? ev.clientY : r.top + r.height / 2;
    const f = document.createElement('div'); f.className = 'float'; f.textContent = '+' + fmt(v);
    f.style.left = (x - 20 + Math.random() * 20) + 'px'; f.style.top = (y - 20) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1000);
  }
  function buyUnit(key) {
    const n = buyN === -1 ? Math.max(1, maxBuy(key)) : buyN; const c = unitCost(key, n);
    if (S.gold < c) return; S.gold -= c; addUnits(key, n); S.bought[key] = (S.bought[key] || 0) + n; changed(); SFX.play('recruit');
  }
  function buyUpg(id) { const u = UPG[id]; if (S.upg[id] || (S.owned[u.unit] || 0) < u.need || !pay(upgCost(u))) return; S.upg[id] = 1; changed(); SFX.play('build'); }
  function buyTB(b) { if (S.buildings[b.id] || (b.req && !S.buildings[b.req]) || !pay(b.cost)) return; S.buildings[b.id] = 1; changed(); SFX.play(b.grail ? 'grail' : 'build'); toast(`<b>${b.name}</b> built in ${b.town.name}!`); }
  function buyDw(key) { if (!S.buildings[UNIT[key].town.id + '_fort'] || !pay(dwCost(key))) return; S.dw[key] = (S.dw[key] || 0) + 1; changed(); SFX.play('build'); }
  function buyMine(m) { if (!pay(mineCost(m))) return; S.mines[m.id] = (S.mines[m.id] || 0) + 1; changed(); SFX.play('flag'); }
  function trade(r, n) { const c = tradePrice(r) * n; if (S.gold < c) return; S.gold -= c; S.res[r] += n; S.trades++; dirty = true; SFX.play('recruit'); }
  function buySkill(sk) { if (skill(sk.id) >= 3 || !pay(skillCost(sk))) return; S.skills[sk.id] = skill(sk.id) + 1; changed(); SFX.play('skill');
    toast(`<b>${LV[skill(sk.id) - 1]} ${sk.id}</b> learned!`); }
  function hire(id) { if (S.hero === id || !unlocked(TOWN[HERO[id].town])) return; const c = hireCost(); if (S.gold < c) return;
    S.gold -= c; S.hero = id; S.heroHires++; changed(); SFX.play('skill'); toast(`<b>${HERO[id].name}</b> joins your cause!`); }
  function unlockTowns() {
    const got = [];
    D.TOWNS.forEach(t => { if (!S.towns[t.id] && S.grail >= t.grail) { S.towns[t.id] = 1; got.push(t.name); } });
    return got;
  }
  function ascend(force) {
    const p = pendingGrail(); if (p < 1) return;
    if (!force && !confirm(`Dig up the Grail? Your kingdom resets, but you gain ${p} Grail point(s) (+${fmt(p * 2)}% production forever).`)) return;
    const keep = { lifetime: S.lifetime, clicks: S.clicks, clickGold: S.clickGold, grail: S.grail + p, ascensions: S.ascensions + 1, chests: S.chests, ach: S.ach,
      started: S.started, towns: S.towns, relics: S.relics, hero: S.hero, heroHires: S.heroHires, trades: S.trades };
    S = fresh(keep); removeWander(); SFX.play('grail');
    const got = unlockTowns(); changed(); save();
    const nt = D.TOWNS.find(t => !unlocked(t));
    modal(`<h2>You dig... and find the Grail!</h2><p>You now hold <b>${fmt(S.grail)}</b> Grail points.</p>` +
      (got.length ? `<p>${got.map(n => `<b>${n}</b>`).join(', ')} now join${got.length > 1 ? '' : 's'} your cause!</p>` : '') +
      (nt ? `<p class="fine">${nt.name} unlocks at ${fmt(nt.grail)} Grail points.</p>` : ''));
  }

  // ---------- wandering artifacts ----------
  let wanderEl = null, wanderLeft = 0;
  function spawnWander() {
    const tot = D.ARTIFACTS.reduce((a, x) => a + x.w, 0); let r = Math.random() * tot;
    const art = D.ARTIFACTS.find(x => (r -= x.w) < 0) || D.ARTIFACTS[0];
    wanderEl = document.createElement('div'); wanderEl.className = 'wander'; wanderEl.title = art.name;
    wanderEl.innerHTML = `<img src="${IMG(art.img)}" alt="${art.name}">`;
    wanderEl.style.left = (10 + Math.random() * (innerWidth - 100)) + 'px';
    wanderEl.style.top = (80 + Math.random() * (innerHeight - 180)) + 'px';
    wanderEl.onclick = () => { SFX.play('treasure'); claimArtifact(art); removeWander(); };
    document.body.appendChild(wanderEl); wanderLeft = 13 * E.chestLife; SFX.play('appear');
  }
  function removeWander() {
    if (wanderEl) wanderEl.remove(); wanderEl = null;
    S.nextChest = (60 + Math.random() * 120) * chestInterval();
  }
  function claimArtifact(a) {
    S.chests++; let msg = a.desc;
    if (a.id === 'sack') addBuff('sack', 77, a);
    else if (a.id === 'wings') addBuff('wings', 13, a);
    else if (a.id === 'purse') { const g = (Math.min(S.gold * 0.15, gps() * 900) + 13) * artPower(); earn(g); msg = `+${fmt(g)} gold!`; }
    else if (a.id === 'cornucopia') { msg = D.RES.map(r => { const v = Math.ceil((5 + mineRate(r) * 600) * artPower()); S.res[r] += v; return `+${fmt(v)} ${D.RES_INFO[r].name}`; }).join(', '); }
    toast(`<b>${a.name}</b><br>${msg}`);
    const missing = D.RELICS.filter(x => !S.relics[x.id]);
    if (missing.length && Math.random() < relicChance()) {
      const x = missing[Math.floor(Math.random() * missing.length)]; S.relics[x.id] = Date.now();
      modal(`<h2>A treasure of the ancients!</h2><div class="center"><img src="${IMG(x.img)}" alt="" style="width:88px"></div><p>Inside you find <b>${x.name}</b>: ${x.d}</p><p class="fine">Permanent artifacts are kept when you find the Grail.</p>`);
      SFX.play('achieve');
    }
    changed();
  }
  function addBuff(id, dur, a) { S.buffs = S.buffs.filter(b => b.id !== id); S.buffs.push({ id, left: dur * buffDur(), max: dur * buffDur(), name: a.name, img: a.img, desc: a.desc }); }

  // ---------- achievements ----------
  function checkAch() {
    const st = { ...S, gps: gps(false), totalUnits: totalUnits(),
      totalMines: Object.values(S.mines).reduce((a, b) => a + b, 0), mineKinds: Object.values(S.mines).filter(Boolean).length,
      day: Math.floor(S.time / DAY_LEN) + 1, skillLevels: Object.values(S.skills).reduce((a, b) => a + b, 0),
      maxSkill: Math.max(0, ...Object.values(S.skills)), relicCount: Object.keys(S.relics).length, heroLevel: heroLevel(),
      dwellings: Object.values(S.dw).reduce((a, b) => a + b, 0), forts: TB.filter(b => b.id.endsWith('_castle') && S.buildings[b.id]).length,
      capitols: TB.filter(b => b.id.endsWith('_capitol') && S.buildings[b.id]).length,
      grailBuildings: TB.filter(b => b.grail && S.buildings[b.id]).length };
    for (const a of D.ACH) if (!S.ach[a.id] && a.test(st)) { S.ach[a.id] = Date.now(); SFX.play('achieve'); toast(`<b>Achievement: ${a.name}</b><br><i>${a.flavor}</i>`); if (tab === 'achievements') dirty = true; }
  }

  // ---------- save / load ----------
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
  function save() { S.lastSave = Date.now(); try { localStorage.setItem(SAVE_KEY, enc(S)); } catch (e) { /* storage unavailable */ } }
  function load(str) {
    const o = dec(str); const base = fresh();
    if (!o.towns) { // v1 saves unlocked towns by number of Grails found
      o.towns = { castle: 1 }; ['rampart', 'necropolis', 'inferno'].forEach((id, i) => { if ((o.ascensions || 0) > i) o.towns[id] = 1; });
    }
    if (o.buildings) D.BUILDINGS.forEach(b => { if (o.buildings[b.id]) { o.buildings['castle_' + b.id] = 1; delete o.buildings[b.id]; } });
    if (!o.bought) o.bought = { ...(o.owned || {}) };
    S = { ...base, ...o, res: { ...base.res, ...(o.res || {}) }, v: 2 };
    if (!HERO[S.hero]) S.hero = 'lord_haart';
    unlockTowns(); recalc();
  }
  function offline() {
    const away = Math.min((8 + E.offlineCap) * 3600, Math.max(0, (Date.now() - S.lastSave) / 1000));
    if (away < 30) return;
    const frac = E.offline;
    const g = gps(false) * away * frac; earn(g);
    for (const m of D.MINES) S.res[m.id] += mineRate(m.id) * away * frac;
    let born = 0;
    for (const key in S.dw) { const n = Math.floor(growthRate(key) * away * frac / DAY_LEN); addUnits(key, n); born += n; }
    S.time += away * frac;
    if (g > 0) modal(`<h2>While you were away…</h2><p>Your creatures toiled for ${fmtTime(away)} and gathered <b>${fmt(g)}</b> gold${frac < 1 ? ' (50% — build a Village Hall for full offline earnings)' : ''}.${born ? ` Your dwellings produced <b>${fmt(born)}</b> creatures.` : ''}</p>`);
  }

  // ---------- UI helpers ----------
  // put(): only touch the DOM when the markup actually changes. Rebuilding elements under the cursor
  // between mousedown and mouseup swallows clicks, which was the "can't click" bug.
  function put(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; return true; } return false; }
  function toast(html) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 5000); while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }
  function modal(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); }
  $('modalClose').onclick = () => $('modal').classList.add('hidden');
  const tip = $('tip');
  function showTip(el, html) {
    tip.innerHTML = html; tip.classList.remove('hidden');
    const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = Math.min(innerWidth - tw - 4, Math.max(4, r.left + r.width / 2 - tw / 2)), y = r.top - th - 6;
    if (y < 4) y = r.bottom + 6; tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { tip.classList.add('hidden'); }

  // ---------- static wiring (event delegation: handlers survive re-renders) ----------
  $('clickImg').src = IMG(D.UI_IMG.chest);
  $('clicker').addEventListener('click', doClick);
  const BUY = [[1, 'x1'], [10, 'x10'], [100, 'x100'], [-1, 'Max']];
  $('buyAmt').onclick = e => { const b = e.target.closest('[data-n]'); if (b) { buyN = +b.dataset.n; dirty = true; } };
  $('tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { tab = b.dataset.t; dirty = true; } };
  $('townTabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { townTab = b.dataset.t; dirty = true; } };
  $('dwellings').onclick = e => { const r = e.target.closest('[data-k]'); if (r) buyUnit(r.dataset.k); };
  $('dwellings').onmouseover = e => { const el = e.target.closest('[data-k]'); if (!el) return; const u = UNIT[el.dataset.k], o = S.owned[u.key] || 0;
    showTip(el, `<b>${S.upg[u.key + '_u'] ? u.upg : u.name}</b> (${u.town.name})<br>Each produces ${fmt(unitGps(u.key) * globalMult())} gold/s.<br>${fmt(o)} owned producing ${fmt(o * unitGps(u.key) * globalMult())}/s.` +
      (growthRate(u.key) ? `<br>Dwelling: +${fmt(growthRate(u.key))}/day` : '')); };
  $('dwellings').onmouseleave = hideTip;
  let selUpg = null;
  const ACT = {
    upg: id => { if (selUpg !== id && matchMedia('(hover: none)').matches) { selUpg = id; showUpg(id); return; } buyUpg(id); },
    tb: id => buyTB(TBI[id]), dw: id => buyDw(id),
    mine: id => buyMine(D.MINES.find(m => m.id === id)), skill: id => buySkill(D.SKILLS.find(s => s.id === id)), hire,
    trade: id => { const [r, n] = id.split(':'); trade(r, +n); }, sub: id => { townSub = id; dirty = true; }, ascend: () => ascend(),
  };
  $('tabBody').onclick = e => { const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) ACT[el.dataset.act](el.dataset.id); };
  $('tabBody').onmouseover = e => { const el = e.target.closest('[data-act="upg"]'); if (el) showUpg(el.dataset.id); };
  function showUpg(id) { const u = UPG[id], d = $('udetail'); if (d) d.innerHTML = `<b>${u.name}</b> — ${u.desc}<br>Cost: ${costHtml(upgCost(u))}`; }

  // ---------- render ----------
  const TABS = [['upgrades', 'Upgrades'], ['town', 'Town'], ['mines', 'Mines'], ['hero', 'Hero'], ['relics', 'Artifacts'], ['grail', 'Grail'], ['achievements', 'Feats'], ['options', 'Options']];
  function renderTabs() {
    put($('tabs'), TABS.map(([id, l]) => `<button data-t="${id}" class="${tab === id ? 'on' : ''}">${l}${id === 'grail' && pendingGrail() >= 1 ? ' <span class="dot">●</span>' : ''}</button>`).join(''));
    const towns = D.TOWNS.filter(unlocked);
    put($('townTabs'), towns.length > 1 ? towns.map(t => `<button data-t="${t.id}" class="${townTab === t.id ? 'on' : ''}">${t.name}</button>`).join('') : '');
    put($('buyAmt'), 'Buy: ' + BUY.map(([n, l]) => `<button data-n="${n}" class="${buyN === n ? 'on' : ''}">${l}</button>`).join(''));
    const h = HERO[S.hero];
    put($('hero'), `<img src="${IMG(h.img)}" alt="${h.name}"><div>${h.name}<br><span class="fine">Level ${heroLevel()} · ${h.spec}</span></div>`);
  }
  const row = (attrs, pic, name, sub, right, cls = '') =>
    `<div class="row ${cls}" ${attrs}><div class="pic${cls.includes('tall') ? ' tall' : ''}"><img src="${pic}" alt=""></div><div class="info"><div class="name">${name}</div><div class="sub">${sub}</div></div><div class="owned">${right}</div></div>`;

  function renderDwellings() {
    const t = TOWN[townTab] && unlocked(TOWN[townTab]) ? TOWN[townTab] : TOWN.castle; townTab = t.id;
    const units = UNITS.filter(u => u.town === t);
    let html = '', shownLocked = 0;
    units.forEach((u, i) => {
      const vis = i === 0 || (S.owned[units[i - 1].key] || 0) > 0 || (S.owned[u.key] || 0) > 0;
      if (!vis) { if (shownLocked++ < 1) html += `<div class="row locked"><div class="pic"></div><div class="info"><div class="name">???</div><div class="sub">Recruit the previous creature to reveal.</div></div></div>`; return; }
      const g = growthRate(u.key);
      html += row(`data-k="${u.key}"`, IMG(S.upg[u.key + '_u'] ? u.uimg : u.img), S.upg[u.key + '_u'] ? u.upg : u.name,
        `<span class="c"></span><br><span class="fine"><span class="each"></span>${g ? ` · +${fmt(g)}/day` : ''}${S.week === u.key ? ` <span class="week">Week x${2 + E.week}!</span>` : ''}</span>`,
        '<span class="own"></span>', 'tall');
    });
    put($('dwellings'), html);
  }

  function availableUpgrades() {
    return UPGRADES.filter(u => !S.upg[u.id] && unlocked(UNIT[u.unit].town) && (S.owned[u.unit] || 0) >= u.need).sort((a, b) => a.gold - b.gold);
  }
  function tbRow(b) {
    const built = S.buildings[b.id], locked = b.req && !S.buildings[b.req];
    return row(`data-act="tb" data-id="${b.id}"`, IMG(b.img), b.name,
      `${b.desc}<br>${built ? '<span class="week">Built</span>' : locked ? `<span class="fine">Requires ${TBI[b.req].name}.</span>` : costHtml(b.cost)}`, built ? '✔' : '', locked ? 'cant' : '');
  }
  function renderTab() {
    const body = $('tabBody');
    if (tab === 'upgrades') {
      const av = availableUpgrades(), done = UPGRADES.filter(u => S.upg[u.id]);
      if (put(body, `<h2>Creature Upgrades</h2>` + (av.length ? `<div class="grid">${av.map(u => `<button class="ucard" data-act="upg" data-id="${u.id}"><img src="${IMG(u.img)}" alt="${u.name}"></button>`).join('')}</div>`
        : '<p class="fine">Recruit 5 of a creature to unlock its upgrade.</p>') +
        `<div class="detail" id="udetail">Hover or tap an upgrade for details. Tap again to buy.</div>` +
        (done.length ? `<h3>Purchased (${done.length})</h3><div class="grid small">${done.map(u => `<div class="ucard done" title="${u.name}"><img src="${IMG(u.img)}" alt="${u.name}"></div>`).join('')}</div>` : ''))) selUpg = null;
    } else if (tab === 'town') {
      const towns = D.TOWNS.filter(unlocked);
      if (!(TOWN[townSub] && unlocked(TOWN[townSub]))) townSub = 'castle';
      let html = `<div class="tabs sub">${towns.map(t => [t.id, t.name]).map(([id, l]) => `<button data-act="sub" data-id="${id}" class="${townSub === id ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      {
        const t = TOWN[townSub];
        html += `<h2>${t.name}</h2><h3>Halls</h3>` + TB.filter(b => b.town === t && b.g === 'hall').map(tbRow).join('') +
          `<h3>Economy</h3>` + TB.filter(b => b.town === t && b.g === 'econ').map(tbRow).join('') + `<h3>Fortifications</h3>` + TB.filter(b => b.town === t && !b.grail && b.id.match(/_(fort|citadel|castle)$/)).map(tbRow).join('') +
          `<h3>Special Buildings</h3>` + TB.filter(b => b.town === t && /_s\d$/.test(b.id)).map(tbRow).join('') +
          `<h3>Creature Dwellings</h3><p class="fine">Each level adds HoMM3 weekly growth per in-game day (60s), free of charge. Requires a Fort. Free creatures don't raise recruiting prices.</p>` +
          UNITS.filter(u => u.town === t && u.tier > 0).map(u => { const l = S.dw[u.key] || 0;
            return row(`data-act="dw" data-id="${u.key}"`, IMG(D.dwImg(t, u.tier)), t.dw[u.tier - 1],
              `${l ? `+${fmt(growthRate(u.key))} ${u.name}s/day` : `Grows ${D.GROWTH[u.tier]} ${u.name}s/day per level`}<br>${costHtml(dwCost(u.key))}`, l); }).join('') +
          `<h3>Grail Structure</h3>` + tbRow(TBI[`${t.id}_grail`]);
      }
      put(body, html);
    } else if (tab === 'mines') {
      let html = `<h2>Mines</h2><p class="fine">Flag mines to gather the resources needed for buildings, dwellings and elite upgrades.</p>` +
        D.MINES.map(m => row(`data-act="mine" data-id="${m.id}"`, IMG(m.img), m.name,
          `+${fmt(D.MINES.find(x => x.id === m.id).rate * 60 * E.mines * (E.res[m.id] || 1) * (1 + 0.5 * skill('Mysticism')))} ${D.RES_INFO[m.id].name}/min each<br>${costHtml(mineCost(m))}`, S.mines[m.id] || 0)).join('');
      html += `<h2>Trading Post</h2>` + (E.tradeOn ? `<p class="fine">Buy resources for gold. Prices follow your income.</p>` +
        D.RES.map(r => `<div class="trade"><img src="${IMG(D.RES_INFO[r].img)}" alt=""> <b>${D.RES_INFO[r].name}</b> ` +
          [10, 100, 1000].map(n => `<button data-act="trade" data-id="${r}:${n}">+${n} <span class="tp" data-tr="${r}" data-n="${n}"></span></button>`).join('') + '</div>').join('')
        : `<p class="fine">Build a Marketplace in any town (Town tab) to trade gold for resources.</p>`);
      put(body, html);
    } else if (tab === 'hero') {
      const h = HERO[S.hero];
      put(body, `<h2>${h.name}</h2><div class="herobox"><img src="${IMG(h.img)}" alt=""><div>Level <b>${heroLevel()}</b> (+${(heroLevel() - 1) * 2}% gold; levels come from gold earned this run)<br>Specialty: <b>${h.spec}</b> — ${h.d}</div></div>
        <h2>Tavern</h2><p class="fine">You lead with one hero at a time; hiring another replaces their specialty. Secondary skills belong to your kingdom and are kept, and hero level comes from gold earned this run, so it carries over too. Hire a different hero. Free during the first in-game day of a run, otherwise <span class="hc"></span> gold. Heroes from a town appear once it is unlocked.</p>
        <div class="grid heroes">${D.HEROES.filter(x => unlocked(TOWN[x.town])).map(x => `<button class="ucard hero ${x.id === S.hero ? 'on' : ''}" data-act="hire" data-id="${x.id}" title="${x.name}: ${x.d}"><img src="${IMG(x.img)}" alt="${x.name}"><span>${x.name}</span></button>`).join('')}</div>
        <h2>Secondary Skills</h2>` + D.SKILLS.filter(sk => !sk.town || unlocked(TOWN[sk.town])).map(sk => { const l = skill(sk.id);
        return row(`data-act="skill" data-id="${sk.id}"`, IMG(sk.imgs[Math.max(0, l - 1)]), `${l ? LV[l - 1] + ' ' : ''}${sk.id}`,
          l < 3 ? `Next: ${sk.desc[l]}<br>${costHtml(skillCost(sk))}` : 'Mastered.', `${l}/3`); }).join(''));
    } else if (tab === 'relics') {
      const n = Object.keys(S.relics).length;
      put(body, `<h2>Artifacts (${n}/${D.RELICS.length})</h2><p class="fine">Each wandering artifact you catch has a ${Math.round(relicChance() * 100)}% chance to leave a permanent artifact. They are kept when you find the Grail.</p>
        <div class="grid">${D.RELICS.map(a => S.relics[a.id] ? `<div class="ucard done" title="${a.name}: ${a.d}"><img src="${IMG(a.img)}" alt="${a.name}"></div>` : `<div class="ucard cant" title="???"><span class="q">?</span></div>`).join('')}</div>
        <div class="detail">${D.RELICS.filter(a => S.relics[a.id]).map(a => `<b>${a.name}</b>: ${a.d}`).join('<br>') || 'None found yet.'}</div>`);
    } else if (tab === 'grail') {
      const p = pendingGrail(), next = Math.pow(grailTotal(S.lifetime) + 1, 3) * 1e9;
      put(body, `<h2>Find the Grail</h2><div class="center"><img src="${IMG(D.UI_IMG.grail)}" alt="Grail" style="width:82px"></div>
        <p>Grail points: <b>${fmt(S.grail)}</b> (+${fmt(S.grail * (2 + skill('Wisdom') + E.grailBonus * 100))}% all production). Grails found: <b>${S.ascensions}</b>.</p>
        <p>Digging now would yield <b>${fmt(p)}</b> Grail point(s). Next point at ${fmt(next)} lifetime gold (you have ${fmt(S.lifetime)}).</p>
        <h3>Towns</h3>${D.TOWNS.map(t => `<div class="stat"><span>${t.name}</span><b>${unlocked(t) ? '✔ unlocked' : `${fmt(t.grail)} Grail points`}</b></div>`).join('')}
        <p class="fine">Resets gold, creatures, upgrades, buildings, dwellings, mines and skills. Keeps Grail points, towns, your hero, permanent artifacts and achievements.</p>
        <button class="big" data-act="ascend" ${p < 1 ? 'disabled' : ''}>Dig for the Grail</button>`);
    } else if (tab === 'achievements') {
      const n = Object.keys(S.ach).length;
      put(body, `<h2>Feats (${n}/${D.ACH.length})</h2>` + D.ACH.map(a => `<div class="ach ${S.ach[a.id] ? '' : 'no'}"><img src="${UIIMG('icon.png')}" alt="" width="16" height="16"><div><b>${a.name}</b> — ${a.req}${S.ach[a.id] ? `<br><i>${a.flavor}</i>` : ''}</div></div>`).join(''));
    } else if (tab === 'options') {
      if (put(body, `<h2>Statistics</h2><div id="stats"></div><h2>Sound</h2><button id="sndBtn">${SFX.muted ? 'Sound: off' : 'Sound: on'}</button>
        <input type="range" id="vol" min="0" max="1" step="0.05" value="${SFX.vol}" aria-label="Volume" style="width:140px;vertical-align:middle">
        <p class="fine">Using ${SFX.hasFiles() ? 'sound files from public/sfx/' : 'synthesized sounds'}. See README to use original HoMM3 sounds.</p><h2>Save</h2>
        <button id="saveBtn">Save now</button> <button id="exportBtn">Export</button> <button id="importBtn">Import</button>
        <textarea id="saveText" placeholder="Export string appears here; paste one to import."></textarea>
        <button id="resetBtn">Hard reset</button>
        <h2>Debug</h2><p class="fine">Speed multiplier for testing.</p><div class="buyamt" style="justify-content:flex-start;flex-wrap:wrap">${[1, 10, 100, 1000].map(n => `<button data-sp="${n}" class="${speed === n ? 'on' : ''}">x${n}</button>`).join('')}
        <button id="dbgGold">+1h gold</button><button id="dbgRes">+1000 res</button><button id="dbgGrail">Find Grail now</button><button id="dbgArt">Spawn artifact</button><button id="dbgRelic">Give artifact</button></div>`)) {
        $('sndBtn').onclick = () => { SFX.setMuted(!SFX.muted); dirty = true; };
        $('vol').oninput = e => SFX.setVol(+e.target.value);
        $('saveBtn').onclick = () => { save(); toast('Game saved.'); };
        $('exportBtn').onclick = () => { save(); $('saveText').value = enc(S); $('saveText').select(); };
        $('importBtn').onclick = () => { try { load($('saveText').value); dirty = true; save(); toast('Save imported.'); } catch (e) { toast('<b>Import failed</b><br>That save string is not valid.'); } };
        $('resetBtn').onclick = () => { if (confirm('Erase ALL progress including Grail points?')) { S = fresh(); removeWander(); changed(); save(); } };
        body.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { speed = +b.dataset.sp; dirty = true; });
        $('dbgGold').onclick = () => earn(Math.max(1000, gps(false) * 3600));
        $('dbgRes').onclick = () => { D.RES.forEach(r => S.res[r] += 1000); };
        $('dbgGrail').onclick = () => { S.lifetime = Math.max(S.lifetime, Math.pow(grailTotal(S.lifetime) + Math.max(1, Math.ceil(S.grail * 0.5)), 3) * 1e9); ascend(true); };
        $('dbgArt').onclick = () => { if (wanderEl) removeWander(); spawnWander(); };
        $('dbgRelic').onclick = () => { const m = D.RELICS.filter(x => !S.relics[x.id]); if (m.length) { S.relics[m[0].id] = Date.now(); changed(); toast(`Got ${m[0].name}`); } };
      }
    }
  }

  // ---------- per-frame numbers (text only, never replaces interactive elements) ----------
  function updateNumbers() {
    const g = gps();
    $('goldNow').textContent = fmt(S.gold) + ' gold';
    $('gpsNow').textContent = `per second: ${fmt(g)}` + (speed > 1 ? ` (x${speed} debug)` : '');
    $('clickInfo').textContent = `+${fmt(clickValue())} per click`;
    put($('resbar'), ['gold', ...D.RES].map(r => `<span class="res" title="${D.RES_INFO[r].name}"><img src="${IMG(D.RES_INFO[r].img)}" alt="${D.RES_INFO[r].name}">${fmt(have(r), 0)}${r !== 'gold' && mineRate(r) ? ` <small>+${fmt(mineRate(r) * 60)}/min</small>` : ''}</span>`).join(''));
    const day = Math.floor(S.time / DAY_LEN);
    const wk = S.week && UNIT[S.week] ? `<br><span class="wk">Week of the ${UNIT[S.week].name}</span>` : '';
    put($('calendar'), `Month ${Math.floor(day / 28) + 1}, Week ${Math.floor(day / 7) % 4 + 1}, Day ${day % 7 + 1}${wk}`);
    put($('buffs'), S.buffs.map(b => `<div class="buff"><img src="${IMG(b.img)}" alt=""><div><b>${b.name}</b> ${Math.ceil(b.left)}s<br><span class="fine">${b.desc}</span></div></div>`).join(''));
    $('dwellings').querySelectorAll('.row[data-k]').forEach(el => {
      const k = el.dataset.k, n = buyN === -1 ? Math.max(1, maxBuy(k)) : buyN, c = unitCost(k, n);
      el.classList.toggle('cant', S.gold < c);
      const h = `${n > 1 ? fmt(n) + ' for ' : ''}${costHtml({ gold: c })}`; const cel = el.querySelector('.c'); if (cel._h !== h) { cel._h = h; cel.innerHTML = h; }
      el.querySelector('.own').textContent = fmt(S.owned[k] || 0, 0);
      el.querySelector('.each').textContent = `${fmt(unitGps(k) * globalMult())}/s each`;
    });
    const hc = $('tabBody').querySelector('.hc'); if (hc) hc.textContent = fmt(hireCost());
    document.querySelectorAll('.tp[data-tr]').forEach(el => { const c = tradePrice(el.dataset.tr) * +el.dataset.n; el.textContent = `(${fmt(c)}g)`; el.parentNode.disabled = S.gold < c; });
    document.querySelectorAll('.cost span[data-r]').forEach(el => el.classList.toggle('no', have(el.dataset.r) < +el.dataset.v - 1e-9));
    $('tabBody').querySelectorAll('[data-act]').forEach(el => {
      const id = el.dataset.id, a = el.dataset.act;
      const c = a === 'upg' ? upgCost(UPG[id]) : a === 'tb' ? (S.buildings[id] ? null : TBI[id].cost) : a === 'dw' ? dwCost(id) : a === 'mine' ? mineCost(D.MINES.find(m => m.id === id))
        : a === 'skill' ? (skill(id) >= 3 ? null : skillCost(D.SKILLS.find(s => s.id === id))) : null;
      const locked = (a === 'tb' && TBI[id].req && !S.buildings[TBI[id].req]) || (a === 'dw' && !S.buildings[UNIT[id].town.id + '_fort']);
      if (c || locked) el.classList.toggle('cant', locked || !canAfford(c));
    });
    if (tab === 'options' && $('stats')) {
      put($('stats'), [['Gold this run', fmt(S.runEarned)], ['Lifetime gold', fmt(S.lifetime)], ['Clicks', fmt(S.clicks)], ['Gold from clicks', fmt(S.clickGold)],
        ['Creatures', fmt(totalUnits())], ['Hero level', heroLevel()], ['Artifacts found', S.chests], ['Permanent artifacts', Object.keys(S.relics).length],
        ['Grail points', fmt(S.grail)], ['Grails found', S.ascensions], ['Playing since', new Date(S.started).toLocaleDateString()]]
        .map(([a, b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join(''));
    }
  }

  // ---------- loop ----------
  let acc = 0, last = performance.now(), sinceUi = 1, sinceSave = 0, sinceAch = 0, lastSig = '';
  function frame() {
    const now = performance.now(); const dt = Math.min((now - last) / 1000, 3600) * speed; last = now;
    acc += dt;
    let steps = 0;
    while (acc >= TICK && steps < 2000) { step(TICK); acc -= TICK; steps++; }
    if (acc >= TICK) { step(acc); acc = 0; }
    sinceUi += dt / speed; sinceSave += dt / speed; sinceAch += dt / speed;
    // structural changes worth a re-render (cheap: put() skips identical markup)
    const sig = availableUpgrades().length + '|' + (pendingGrail() >= 1) + '|' + heroLevel() + '|' + S.buffs.length + '|' + Object.keys(S.owned).length;
    if (sig !== lastSig) { lastSig = sig; dirty = true; }
    if (dirty) { dirty = false; renderTabs(); renderDwellings(); renderTab(); sinceUi = 1; }
    if (sinceUi >= 0.2) { sinceUi = 0; updateNumbers(); }
    if (sinceAch >= 1) { sinceAch = 0; checkAch(); }
    if (sinceSave >= 30) { sinceSave = 0; save(); }
  }

  // ---------- boot ----------
  recalc();
  try { const s = localStorage.getItem(SAVE_KEY); if (s) { load(s); offline(); } } catch (e) { console.warn('Could not load save', e); }
  if (/[?&]debug/.test(location.search)) { tab = 'options'; }
  dirty = true; frame();
  setInterval(frame, 50);
  addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.HC = { get state() { return S; }, gps, fmt, recalc, setSpeed: n => { speed = n; } }; // console helpers
})();
