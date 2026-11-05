// Automated balance playtest: a greedy bot plays the real game in headless Chromium at high speed
// and logs when milestones happen (in-game active-play time).
// Usage: node scripts/balance-sim.mjs [hours=24]
import { createRequire } from 'module'; import path from 'path'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HOURS = +(process.argv[2] || 24);

const bot = (HOURS) => {
  const A = HC.api, S = () => HC.state, log = [];
  let simT = 0, last = performance.now(), runStart = 0;
  const seen = new Set();
  const mark = (k, msg) => { if (!seen.has(k)) { seen.add(k); log.push(`${(simT / 60).toFixed(1).padStart(7)} min  ${msg}`); } };
  const heroPref = ['monere', 'tazar', 'jenova', 'lord_haart'];
  window.__simLog = log;
  function act() {
    const st = S();
    const g = HC.gps(false);
    // early clicking (a human clicks ~5/s for the first minutes)
    if (g < 200) for (let i = 0; i < 40; i++) A.doClick();
    const w = document.querySelector('.wander'); if (w) w.onclick();
    // hero
    if (st.time < 60) { const h = heroPref.find(id => A.unlocked(A.D.TOWNS.find(t => t.id === A.D.HEROES.find(x => x.id === id).town))); if (h && st.hero !== h) A.hire(h); }
    for (let k = 0; k < 60; k++) {
      let did = false;
      for (const u of A.UPGRADES) if (!st.upg[u.id] && (st.owned[u.unit] || 0) >= u.need && A.canAfford(A.upgCost(u))) { A.buyUpg(u.id); did = true; }
      for (const b of A.TB) if (A.unlocked(b.town) && !st.buildings[b.id] && (!b.req || st.buildings[b.req]) && A.canAfford(b.cost)) { A.buyTB(b); did = true; }
      for (const sk of A.D.SKILLS) if ((st.skills[sk.id] || 0) < 3 && A.canAfford(A.skillCost(sk))) { A.buySkill(sk); did = true; }
      for (const u of A.UNITS) if (u.tier > 0 && A.unlocked(u.town) && st.buildings[u.town.id + '_fort'] && (st.owned[u.key] || 0) > 0) {
        const c = A.dwCost(u.key); if (c.gold < st.gold * 0.25 && A.canAfford(c)) { A.buyDw(u.key); did = true; } }
      for (const m of A.D.MINES) if (A.mineCost(m).gold < st.gold * 0.05) { A.buyMine(m); did = true; }
      if (A.E.tradeOn) for (const r of A.D.RES) if (st.res[r] < 2000 && A.tradePrice(r) * 100 < st.gold * 0.01) { A.trade(r, 100); did = true; }
      // best unit by production per gold among visible units
      let best = null, bv = 0;
      for (const t of A.D.TOWNS) { if (!A.unlocked(t)) continue; const us = A.UNITS.filter(u => u.town === t);
        us.forEach((u, i) => { if (i && !(st.owned[us[i - 1].key] > 0)) return; const v = A.unitGps(u.key) / A.unitCost(u.key); if (v > bv) { bv = v; best = u; } }); }
      if (best && A.unitCost(best.key) <= st.gold) { A.buyUnit(best.key); did = true; }
      if (!did) break;
    }
    // milestones
    for (const th of [1e2, 1e4, 1e6, 1e9, 1e12, 1e15, 1e18, 1e21, 1e24, 1e27, 1e30]) if (g >= th) mark('gps' + th, `gold/sec >= ${HC.fmt(th)}`);
    for (const t of A.D.TOWNS) if (st.towns[t.id]) mark('town' + t.id, `${t.name} unlocked (grail ${HC.fmt(st.grail)})`);
    if (st.buildings.castle_tavern) mark('tavern', 'Tavern built');
    if (st.buildings.castle_fort) mark('fort', 'Castle Fort built (dwellings)');
    // Grail: dig once it would at least double points (and the run is 10+ min)
    const p = A.pendingGrail();
    if (p >= Math.max(1, st.grail) && (simT - runStart) > 600) {
      log.push(`${(simT / 60).toFixed(1).padStart(7)} min  dig #${st.ascensions + 1}: +${HC.fmt(p)} grail (run ${((simT - runStart) / 60).toFixed(0)} min, gps ${HC.fmt(g)})`);
      A.ascend(true); runStart = simT; document.getElementById('modalClose').click();
    }
  }
  return new Promise(res => {
    const iv = setInterval(() => {
      const now = performance.now(); const sp = simT < 1800 ? 50 : simT < 7200 ? 200 : 1000;
      HC.setSpeed(sp); simT += (now - last) / 1000 * sp; last = now;
      act();
      if (simT > HOURS * 3600) { clearInterval(iv); res(log); }
    }, 50);
  });
};

const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + path.join(ROOT, 'index.html'));
await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
await p.reload(); await p.waitForTimeout(300);
const timer = setInterval(async () => { try { const l = await p.evaluate(() => window.__simLog || []); process.stderr.write(`\r${l.length} events`); } catch (e) {} }, 10000);
const log = await p.evaluate(bot, HOURS);
clearInterval(timer);
console.log('\n' + log.join('\n'));
console.log('final:', await p.evaluate(() => ({ grail: HC.state.grail, towns: Object.keys(HC.state.towns).join(','), relics: Object.keys(HC.state.relics).length, digs: HC.state.ascensions })));
if (errs.length) console.log('errors', errs);
await b.close();
