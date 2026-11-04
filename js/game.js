/* Heroes III Clicker — game logic. Plain JS, no build step. */
(function () {
  'use strict';
  const D = window.DATA;
  const IMG = n => (window.INLINE_IMG && window.INLINE_IMG[n]) || 'public/img/' + D.localName(n);
  const UIIMG = n => (window.INLINE_UI && window.INLINE_UI[n]) || 'public/ui/' + n;
  const SAVE_KEY = 'homm3clicker.save.v1';
  const TICK = 0.1;                 // fixed timestep (s)
  const DAY_LEN = 60;               // seconds per in-game day
  const OFFLINE_CAP = 8 * 3600;
  const $ = id => document.getElementById(id);

  // ---------- number formatting ----------
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function fmt(n, dec) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n, dec);
    if (n < 1000) return n < 10 && dec !== 0 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
    const e = Math.min(Math.floor(Math.log10(n) / 3), SUF.length - 1);
    const v = n / Math.pow(1000, e);
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace(/\.?0+$/, '') + SUF[e];
  }
  const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
    return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + x + 's'; };

  // ---------- units ----------
  const UNITS = [];
  D.TOWNS.forEach((t, ti) => t.units.forEach((u, i) => UNITS.push({ ...u, key: `${t.id}_${i}`, town: t, tier: i,
    cost: D.TIERS[i].cost * t.costMul, gps: D.TIERS[i].gps * t.gpsMul })));
  const UNIT = Object.fromEntries(UNITS.map(u => [u.key, u]));

  // Creature upgrades: upgraded form (x3) + three drills (x2 each)
  const UPGRADES = [];
  UNITS.forEach(u => {
    const resCost = (k) => { const c = {}; const t = u.tier + u.town.unlock * 2;
      if (t >= 3) { c.wood = 3 * t * k; c.ore = 3 * t * k; }
      if (t >= 5) { const rare = ['mercury', 'sulfur', 'crystal', 'gems'][u.tier % 4]; c[rare] = 2 * t * k; }
      return c; };
    UPGRADES.push({ id: u.key + '_u', unit: u.key, need: 5, mult: 3, name: u.upg === u.name ? `${u.name} Training` : `Upgrade to ${u.upg}`,
      img: u.uimg, desc: `${u.name}s become ${u.upg}s: production x3.`, cost: { gold: u.cost * 15, ...resCost(1) } });
    [['Veteran', 25, 100, 2], ['Elite', 50, 2000, 4], ['Legendary', 100, 50000, 8]].forEach(([lab, need, cm, rk], j) =>
      UPGRADES.push({ id: u.key + '_d' + j, unit: u.key, need, mult: 2, name: `${lab} ${u.upg}s`, img: u.uimg,
        desc: `${u.upg} production x2. Requires ${need} owned.`, cost: { gold: u.cost * cm, ...resCost(rk) } }));
  });
  const UPG = Object.fromEntries(UPGRADES.map(x => [x.id, x]));

  // ---------- state ----------
  const fresh = (keep = {}) => ({
    v: 1, gold: 0, runEarned: 0, lifetime: keep.lifetime || 0, clicks: keep.clicks || 0, clickGold: keep.clickGold || 0,
    res: Object.fromEntries(D.RES.map(r => [r, 0])), owned: {}, upg: {}, mines: {}, buildings: {}, skills: {},
    grail: keep.grail || 0, ascensions: keep.ascensions || 0, chests: keep.chests || 0, ach: keep.ach || {},
    time: 0, week: null, buffs: [], nextChest: 45, started: keep.started || Date.now(), lastSave: Date.now(),
  });
  let S = fresh();
  let speed = 1, buyN = 1, tab = 'upgrades', townTab = 'castle', dirty = true;

  // ---------- derived values ----------
  const skill = id => S.skills[id] || 0;
  const bEff = (k, base, combine) => D.BUILDINGS.reduce((a, b) => S.buildings[b.id] && b.eff[k] != null ? combine(a, b.eff[k]) : a, base);
  const mul = (a, b) => a * b;
  const grailMult = () => 1 + S.grail * (0.02 + 0.01 * skill('Wisdom'));
  const buffMult = id => S.buffs.some(b => b.id === id);
  function unitMult(key) {
    let m = 1;
    for (const id of ['_u', '_d0', '_d1', '_d2']) if (S.upg[key + id]) m *= UPG[key + id].mult;
    if (S.week === key) m *= 2;
    return m;
  }
  const unitGps = key => UNIT[key].gps * unitMult(key);
  function globalMult(withBuffs = true) {
    let m = bEff('gps', 1, mul) * (1 + 0.05 * skill('Leadership') * (skill('Leadership') + 1) / 2) * grailMult();
    if (withBuffs && buffMult('sack')) m *= 7;
    return m;
  }
  function baseGps() { let g = 0; for (const u of UNITS) if (S.owned[u.key]) g += S.owned[u.key] * unitGps(u.key); return g; }
  const gps = (withBuffs = true) => baseGps() * globalMult(withBuffs);
  function clickValue() {
    let c = 1 * bEff('click', 1, mul) * grailMult() + gps() * 0.01 * skill('Estates') * (skill('Estates') + 1) / 2;
    if (buffMult('wings')) c *= 77;
    return c;
  }
  const mineRate = id => (S.mines[id] || 0) * D.MINES.find(m => m.id === id).rate * bEff('mines', 1, mul);
  const diplomacy = () => Math.pow(0.96, skill('Diplomacy'));
  function unitCost(key, n = 1) {
    const u = UNIT[key], o = S.owned[key] || 0, r = 1.15;
    return u.cost * diplomacy() * Math.pow(r, o) * (Math.pow(r, n) - 1) / (r - 1);
  }
  function maxBuy(key) { let n = 0; while (n < 1000 && unitCost(key, n + 1) <= S.gold) n++; return n; }
  const mineCost = m => ({ gold: m.cost * Math.pow(1.6, S.mines[m.id] || 0) });
  function skillCost(sk) {
    const l = skill(sk.id); const c = { gold: sk.base * Math.pow(25, l) };
    if (l >= 1) c[sk.res] = 10 * l * l; if (l >= 2) c.wood = 40; return c;
  }
  const chestInterval = () => bEff('chest', 1, mul) * Math.pow(0.85, skill('Logistics'));
  const buffDur = () => bEff('buff', 1, mul) * Math.pow(1.15, skill('Luck'));
  const grailTotal = l => Math.floor(Math.cbrt(l / 1e9));
  const pendingGrail = () => Math.max(0, grailTotal(S.lifetime) - S.grail);
  const unlocked = t => S.ascensions >= t.unlock;

  const canAfford = c => Object.entries(c).every(([k, v]) => (k === 'gold' ? S.gold : S.res[k]) >= v - 1e-9);
  function pay(c) { if (!canAfford(c)) return false; for (const [k, v] of Object.entries(c)) k === 'gold' ? S.gold -= v : S.res[k] -= v; return true; }
  function costHtml(c) {
    return '<span class="cost">' + Object.entries(c).map(([k, v]) => {
      const have = k === 'gold' ? S.gold : S.res[k];
      return `<img src="${IMG(D.RES_INFO[k].img)}" alt="${D.RES_INFO[k].name}"> <span class="${have >= v ? '' : 'no'}">${fmt(v)}</span>`;
    }).join(' ') + '</span>';
  }

  // ---------- simulation ----------
  function earn(g) { S.gold += g; S.runEarned += g; S.lifetime += g; }
  function step(dt) {
    earn(gps() * dt);
    for (const m of D.MINES) if (S.mines[m.id]) S.res[m.id] += mineRate(m.id) * dt;
    const prevDay = Math.floor(S.time / DAY_LEN);
    S.time += dt;
    const day = Math.floor(S.time / DAY_LEN);
    if (day !== prevDay && day % 7 === 0) newWeek();
    S.buffs = S.buffs.filter(b => (b.left -= dt) > 0);
    S.nextChest -= dt;
    if (S.nextChest <= 0 && !wanderEl) spawnWander();
    if (wanderEl && (wanderLeft -= dt) <= 0) removeWander();
  }
  let lastBuffCount = 0;
  function newWeek() {
    const pool = UNITS.filter(u => unlocked(u.town));
    const u = pool[Math.floor(Math.random() * pool.length)];
    S.week = u.key; dirty = true;
    toast(`<b>Astrologers proclaim Week of the ${u.name}!</b><br>${u.name} production x2 this week.`);
  }

  // ---------- actions ----------
  function doClick(ev) {
    const v = clickValue(); earn(v); S.clicks++; S.clickGold += v;
    const r = $('clicker').getBoundingClientRect();
    const x = ev && ev.clientX ? ev.clientX : r.left + r.width / 2, y = ev && ev.clientY ? ev.clientY : r.top + r.height / 2;
    const f = document.createElement('div'); f.className = 'float'; f.textContent = '+' + fmt(v);
    f.style.left = (x - 20 + Math.random() * 20) + 'px'; f.style.top = (y - 20) + 'px';
    document.body.appendChild(f); setTimeout(() => f.remove(), 1000);
  }
  function buyUnit(key) {
    const n = buyN === -1 ? Math.max(1, maxBuy(key)) : buyN; const c = unitCost(key, n);
    if (S.gold < c) return; S.gold -= c; S.owned[key] = (S.owned[key] || 0) + n; dirty = true;
  }
  function buyUpg(id) { const u = UPG[id]; if (S.upg[id] || (S.owned[u.unit] || 0) < u.need || !pay(u.cost)) return; S.upg[id] = 1; dirty = true; hideTip(); }
  function buyBuilding(b) { if (S.buildings[b.id] || !pay(b.cost)) return; S.buildings[b.id] = 1; dirty = true; toast(`<b>${b.name}</b> built!`); }
  function buyMine(m) { if (!pay(mineCost(m))) return; S.mines[m.id] = (S.mines[m.id] || 0) + 1; dirty = true; }
  function buySkill(sk) { if (skill(sk.id) >= 3 || !pay(skillCost(sk))) return; S.skills[sk.id] = skill(sk.id) + 1; dirty = true;
    toast(`<b>${['Basic', 'Advanced', 'Expert'][skill(sk.id) - 1]} ${sk.id}</b> learned!`); }
  function ascend() {
    const p = pendingGrail(); if (p < 1) return;
    if (!confirm(`Dig up the Grail? Your kingdom resets, but you gain ${p} Grail point(s) (+${fmt(p * 2)}% production forever).`)) return;
    const keep = { lifetime: S.lifetime, clicks: S.clicks, clickGold: S.clickGold, grail: S.grail + p, ascensions: S.ascensions + 1, chests: S.chests, ach: S.ach, started: S.started };
    S = fresh(keep); removeWander(); dirty = true; save();
    const t = D.TOWNS.find(t => t.unlock === S.ascensions);
    modal(`<h2>You dig... and find the Grail!</h2><p>You now hold <b>${S.grail}</b> Grail points.</p>${t ? `<p>The town of <b>${t.name}</b> now joins your cause!</p>` : ''}`);
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
    wanderEl.onclick = () => { claimArtifact(art); removeWander(); };
    document.body.appendChild(wanderEl); wanderLeft = 13;
  }
  function removeWander() {
    if (wanderEl) wanderEl.remove(); wanderEl = null;
    S.nextChest = (60 + Math.random() * 120) * chestInterval();
  }
  function claimArtifact(a) {
    S.chests++; let msg = a.desc;
    if (a.id === 'sack') addBuff('sack', 77, a);
    else if (a.id === 'wings') addBuff('wings', 13, a);
    else if (a.id === 'purse') { const g = Math.min(S.gold * 0.15, gps() * 900) + 13; earn(g); msg = `+${fmt(g)} gold!`; }
    else if (a.id === 'cornucopia') { msg = D.RES.map(r => { const v = Math.ceil(5 + mineRate(r) * 300); S.res[r] += v; return `+${fmt(v)} ${D.RES_INFO[r].name}`; }).join(', '); }
    toast(`<b>${a.name}</b><br>${msg}`); dirty = true;
  }
  function addBuff(id, dur, a) { S.buffs = S.buffs.filter(b => b.id !== id); S.buffs.push({ id, left: dur * buffDur(), max: dur * buffDur(), name: a.name, img: a.img, desc: a.desc }); }

  // ---------- achievements ----------
  function checkAch() {
    const st = { ...S, gps: gps(false), totalUnits: Object.values(S.owned).reduce((a, b) => a + b, 0),
      totalMines: Object.values(S.mines).reduce((a, b) => a + b, 0), mineKinds: Object.values(S.mines).filter(Boolean).length,
      day: Math.floor(S.time / DAY_LEN) + 1, skillLevels: Object.values(S.skills).reduce((a, b) => a + b, 0),
      maxSkill: Math.max(0, ...Object.values(S.skills)) };
    for (const a of D.ACH) if (!S.ach[a.id] && a.test(st)) { S.ach[a.id] = Date.now(); toast(`<b>Achievement: ${a.name}</b><br><i>${a.flavor}</i>`); if (tab === 'achievements') dirty = true; }
  }

  // ---------- save / load ----------
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.trim()))));
  function save() { S.lastSave = Date.now(); try { localStorage.setItem(SAVE_KEY, enc(S)); } catch (e) { /* storage unavailable */ } }
  function load(str) {
    const o = dec(str); const base = fresh();
    S = { ...base, ...o, res: { ...base.res, ...(o.res || {}) } };
  }
  function offline() {
    const away = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - S.lastSave) / 1000));
    if (away < 30) return;
    const frac = bEff('offline', 0.5, (a, b) => Math.max(a, b));
    const g = gps(false) * away * frac; earn(g);
    for (const m of D.MINES) S.res[m.id] += mineRate(m.id) * away * frac;
    S.time += away * frac;
    if (g > 0) modal(`<h2>While you were away…</h2><p>Your creatures toiled for ${fmtTime(away)} and gathered <b>${fmt(g)}</b> gold${frac < 1 ? ' (50% — build a Treasury for full offline earnings)' : ''}.</p>`);
  }

  // ---------- UI helpers ----------
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

  // ---------- render: static ----------
  $('clickImg').src = IMG(D.UI_IMG.chest);
  $('clicker').addEventListener('click', doClick);
  $('hero').innerHTML = `<img src="${IMG(D.UI_IMG.hero)}" alt="Lord Haart"><div>Lord Haart<br><span class="fine">Knight of Castle</span></div>`;
  const BUY = [[1, 'x1'], [10, 'x10'], [100, 'x100'], [-1, 'Max']];
  function renderBuyAmt() {
    $('buyAmt').innerHTML = 'Buy: ' + BUY.map(([n, l]) => `<button data-n="${n}" class="${buyN === n ? 'on' : ''}">${l}</button>`).join('');
    $('buyAmt').querySelectorAll('button').forEach(b => b.onclick = () => { buyN = +b.dataset.n; renderBuyAmt(); dirty = true; });
  }
  renderBuyAmt();

  const TABS = [['upgrades', 'Upgrades'], ['town', 'Town'], ['mines', 'Mines'], ['hero', 'Hero'], ['grail', 'Grail'], ['achievements', 'Feats'], ['options', 'Options']];
  function renderTabs() {
    $('tabs').innerHTML = TABS.map(([id, l]) => `<button data-t="${id}" class="${tab === id ? 'on' : ''}">${l}${id === 'grail' && pendingGrail() >= 1 ? ' <span class="dot">●</span>' : ''}</button>`).join('');
    $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; dirty = true; });
    const towns = D.TOWNS.filter(unlocked);
    $('townTabs').innerHTML = towns.length > 1 ? towns.map(t => `<button data-t="${t.id}" class="${townTab === t.id ? 'on' : ''}">${t.name}</button>`).join('') : '';
    $('townTabs').querySelectorAll('button').forEach(b => b.onclick = () => { townTab = b.dataset.t; dirty = true; });
  }

  // ---------- render: dynamic (rebuilt when dirty) ----------
  const row = (attrs, pic, name, sub, right, tall) =>
    `<div class="row" ${attrs}><div class="pic${tall ? ' tall' : ''}"><img src="${pic}" alt=""></div><div class="info"><div class="name">${name}</div><div class="sub">${sub}</div></div><div class="owned">${right}</div></div>`;
  function bind(container, sel, fn) { container.querySelectorAll(sel).forEach(el => el.onclick = () => fn(el)); }

  function renderDwellings() {
    const t = D.TOWNS.find(t => t.id === townTab) || D.TOWNS[0];
    const units = UNITS.filter(u => u.town === t);
    let html = '', shownLocked = 0;
    units.forEach((u, i) => {
      const prevOwned = i === 0 || (S.owned[units[i - 1].key] || 0) > 0 || (S.owned[u.key] || 0) > 0;
      if (!prevOwned) { if (shownLocked++ < 1) html += `<div class="row locked"><div class="pic"></div><div class="info"><div class="name">???</div><div class="sub">Recruit the previous creature to reveal.</div></div></div>`; return; }
      const name = S.upg[u.key + '_u'] ? u.upg : u.name;
      html += row(`data-k="${u.key}" id="dw_${u.key}"`, IMG(S.upg[u.key + '_u'] ? u.uimg : u.img), name,
        `<span class="c"></span><br><span class="fine">${fmt(unitGps(u.key) * globalMult())}/s each${S.week === u.key ? ' <span class="week">Week x2!</span>' : ''}</span>`,
        S.owned[u.key] || 0, true);
    });
    $('dwellings').innerHTML = html;
    bind($('dwellings'), '.row[data-k]', el => buyUnit(el.dataset.k));
    $('dwellings').querySelectorAll('.row[data-k]').forEach(el => {
      el.onmouseenter = () => { const u = UNIT[el.dataset.k], o = S.owned[u.key] || 0;
        showTip(el, `<b>${S.upg[u.key + '_u'] ? u.upg : u.name}</b> (${u.town.name})<br>Each produces ${fmt(unitGps(u.key) * globalMult())} gold/s.<br>${o} owned producing ${fmt(o * unitGps(u.key) * globalMult())}/s.`); };
      el.onmouseleave = hideTip;
    });
  }

  function availableUpgrades() {
    return UPGRADES.filter(u => !S.upg[u.id] && unlocked(UNIT[u.unit].town) && (S.owned[u.unit] || 0) >= u.need)
      .sort((a, b) => a.cost.gold - b.cost.gold);
  }
  function renderTab() {
    const body = $('tabBody');
    if (tab === 'upgrades') {
      const av = availableUpgrades(), done = UPGRADES.filter(u => S.upg[u.id]);
      body.innerHTML = `<h2>Creature Upgrades</h2>` + (av.length ? `<div class="grid">${av.map(u => `<button class="ucard" data-u="${u.id}"><img src="${IMG(u.img)}" alt="${u.name}"></button>`).join('')}</div>`
        : '<p class="fine">Recruit 5 of a creature to unlock its upgrade.</p>') +
        `<div class="detail" id="udetail">Hover or tap an upgrade for details. Tap again to buy.</div>` +
        (done.length ? `<h3>Purchased (${done.length})</h3><div class="grid">${done.map(u => `<div class="ucard done" title="${u.name}"><img src="${IMG(u.img)}" alt="${u.name}"></div>`).join('')}</div>` : '');
      let sel = null;
      body.querySelectorAll('.ucard[data-u]').forEach(el => {
        const u = UPG[el.dataset.u]; const show = () => { $('udetail').innerHTML = `<b>${u.name}</b> — ${u.desc}<br>Cost: ${costHtml(u.cost)}`; };
        el.onmouseenter = show; el.onfocus = show;
        el.onclick = () => { if (sel !== el && matchMedia('(hover: none)').matches) { sel = el; show(); return; } buyUpg(u.id); };
      });
    } else if (tab === 'town') {
      body.innerHTML = `<h2>Town Buildings</h2>` + D.BUILDINGS.map(b => row(`data-b="${b.id}"`, IMG(b.img), b.name,
        `${b.desc}<br>${S.buildings[b.id] ? '<span class="week">Built</span>' : costHtml(b.cost)}`, S.buildings[b.id] ? '✔' : '')).join('');
      bind(body, '.row', el => buyBuilding(D.BUILDINGS.find(b => b.id === el.dataset.b)));
    } else if (tab === 'mines') {
      body.innerHTML = `<h2>Mines</h2><p class="fine">Flag mines to gather the rare resources needed for town buildings and elite upgrades.</p>` +
        D.MINES.map(m => row(`data-m="${m.id}"`, IMG(m.img), m.name,
          `+${fmt(m.rate * bEff('mines', 1, mul))} ${D.RES_INFO[m.id].name}/s each<br>${costHtml(mineCost(m))}`, S.mines[m.id] || 0)).join('');
      bind(body, '.row', el => buyMine(D.MINES.find(m => m.id === el.dataset.m)));
    } else if (tab === 'hero') {
      body.innerHTML = `<h2>Secondary Skills</h2>` + D.SKILLS.map(sk => { const l = skill(sk.id);
        return row(`data-s="${sk.id}"`, IMG(sk.imgs[Math.max(0, l - 1)]), `${l ? ['Basic', 'Advanced', 'Expert'][l - 1] + ' ' : ''}${sk.id}`,
          l < 3 ? `Next: ${sk.desc[l]}<br>${costHtml(skillCost(sk))}` : 'Mastered.', `${l}/3`); }).join('');
      bind(body, '.row', el => buySkill(D.SKILLS.find(s => s.id === el.dataset.s)));
    } else if (tab === 'grail') {
      const p = pendingGrail(), next = Math.pow(grailTotal(S.lifetime) + 1, 3) * 1e9;
      const nt = D.TOWNS.find(t => !unlocked(t));
      body.innerHTML = `<h2>Find the Grail</h2><div class="center"><img src="${IMG(D.UI_IMG.grail)}" alt="Grail" style="width:82px"></div>
        <p>Grail points: <b>${S.grail}</b> (+${fmt(S.grail * (2 + skill('Wisdom')))}% all production). Grails found: <b>${S.ascensions}</b>.</p>
        <p>Digging now would yield <b>${p}</b> Grail point(s). Next point at ${fmt(next)} lifetime gold (you have ${fmt(S.lifetime)}).</p>
        ${nt ? `<p>Find the Grail ${nt.unlock - S.ascensions} more time(s) to unlock <b>${nt.name}</b>'s creatures.</p>` : '<p>All towns unlocked!</p>'}
        <p class="fine">Resets gold, creatures, upgrades, buildings, mines and skills. Keeps Grail points, achievements and unlocked towns.</p>
        <button class="big" id="ascendBtn" ${p < 1 ? 'disabled' : ''}>Dig for the Grail</button>`;
      $('ascendBtn').onclick = ascend;
    } else if (tab === 'achievements') {
      const n = Object.keys(S.ach).length;
      body.innerHTML = `<h2>Feats (${n}/${D.ACH.length})</h2>` + D.ACH.map(a => `<div class="ach ${S.ach[a.id] ? '' : 'no'}"><img src="${UIIMG('icon.png')}" alt="" width="16" height="16"><div><b>${a.name}</b> — ${a.req}${S.ach[a.id] ? `<br><i>${a.flavor}</i>` : ''}</div></div>`).join('');
    } else if (tab === 'options') {
      body.innerHTML = `<h2>Statistics</h2><div id="stats"></div><h2>Save</h2>
        <button id="saveBtn">Save now</button> <button id="exportBtn">Export</button> <button id="importBtn">Import</button>
        <textarea id="saveText" placeholder="Export string appears here; paste one to import."></textarea>
        <button id="resetBtn">Hard reset</button>
        <h2>Debug</h2><p class="fine">Speed multiplier for testing.</p><div class="buyamt" style="justify-content:flex-start">${[1, 10, 100, 1000].map(n => `<button data-sp="${n}" class="${speed === n ? 'on' : ''}">x${n}</button>`).join('')}
        <button id="dbgGold">+1h gold</button><button id="dbgArt">Spawn artifact</button></div>`;
      $('saveBtn').onclick = () => { save(); toast('Game saved.'); };
      $('exportBtn').onclick = () => { save(); $('saveText').value = enc(S); $('saveText').select(); };
      $('importBtn').onclick = () => { try { load($('saveText').value); dirty = true; save(); toast('Save imported.'); } catch (e) { toast('<b>Import failed</b><br>That save string is not valid.'); } };
      $('resetBtn').onclick = () => { if (confirm('Erase ALL progress including Grail points?')) { S = fresh(); removeWander(); save(); dirty = true; } };
      body.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { speed = +b.dataset.sp; dirty = true; });
      $('dbgGold').onclick = () => earn(Math.max(1000, gps(false) * 3600));
      $('dbgArt').onclick = () => { if (wanderEl) removeWander(); spawnWander(); };
    }
  }

  // ---------- render: per-frame numbers ----------
  function updateNumbers() {
    const g = gps();
    $('goldNow').textContent = fmt(S.gold) + ' gold';
    $('gpsNow').textContent = `per second: ${fmt(g)}` + (speed > 1 ? ` (x${speed} debug)` : '');
    $('clickInfo').textContent = `+${fmt(clickValue())} per click`;
    $('resbar').innerHTML = ['gold', ...D.RES].map(r => `<span class="res" title="${D.RES_INFO[r].name}"><img src="${IMG(D.RES_INFO[r].img)}" alt="${D.RES_INFO[r].name}">${fmt(r === 'gold' ? S.gold : S.res[r], 0)}${r !== 'gold' && mineRate(r) ? ` <small>+${fmt(mineRate(r))}/s</small>` : ''}</span>`).join('');
    const day = Math.floor(S.time / DAY_LEN);
    const wk = S.week && UNIT[S.week] ? `<br><span class="wk">Week of the ${UNIT[S.week].name}</span>` : '';
    $('calendar').innerHTML = `Month ${Math.floor(day / 28) + 1}, Week ${Math.floor(day / 7) % 4 + 1}, Day ${day % 7 + 1}${wk}`;
    $('buffs').innerHTML = S.buffs.map(b => `<div class="buff"><img src="${IMG(b.img)}" alt=""><div><b>${b.name}</b> ${Math.ceil(b.left)}s<br><span class="fine">${b.desc}</span></div></div>`).join('');
    // dwelling affordability + costs
    $('dwellings').querySelectorAll('.row[data-k]').forEach(el => {
      const k = el.dataset.k, n = buyN === -1 ? Math.max(1, maxBuy(k)) : buyN, c = unitCost(k, n);
      el.classList.toggle('cant', S.gold < c);
      el.querySelector('.c').innerHTML = `${n > 1 ? n + ' for ' : ''}${costHtml({ gold: c })}`;
    });
    $('tabBody').querySelectorAll('.ucard[data-u]').forEach(el => el.classList.toggle('cant', !canAfford(UPG[el.dataset.u].cost)));
    if (tab === 'options' && $('stats')) {
      $('stats').innerHTML = [['Gold this run', fmt(S.runEarned)], ['Lifetime gold', fmt(S.lifetime)], ['Clicks', fmt(S.clicks)], ['Gold from clicks', fmt(S.clickGold)],
        ['Artifacts found', S.chests], ['Grail points', S.grail], ['Playing since', new Date(S.started).toLocaleDateString()]]
        .map(([a, b]) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`).join('');
    }
    if (['town', 'mines', 'hero'].includes(tab)) $('tabBody').querySelectorAll('.row').forEach(el => {
      const c = el.dataset.b ? (S.buildings[el.dataset.b] ? null : D.BUILDINGS.find(b => b.id === el.dataset.b).cost)
        : el.dataset.m ? mineCost(D.MINES.find(m => m.id === el.dataset.m))
        : el.dataset.s ? (skill(el.dataset.s) >= 3 ? null : skillCost(D.SKILLS.find(s => s.id === el.dataset.s))) : null;
      el.classList.toggle('cant', !!c && !canAfford(c));
    });
  }

  // ---------- loop ----------
  let acc = 0, last = performance.now(), sinceUi = 1, sinceSave = 0, sinceAch = 0, lastUnitsSig = '';
  function frame() {
    const now = performance.now(); let dt = Math.min((now - last) / 1000, 3600) * speed; last = now;
    acc += dt;
    // fixed timestep; huge gaps (tab hidden for long) are integrated in a few big steps
    let steps = 0;
    while (acc >= TICK && steps < 2000) { step(TICK); acc -= TICK; steps++; }
    if (acc >= TICK) { step(acc); acc = 0; }
    sinceUi += dt / speed; sinceSave += dt / speed; sinceAch += dt / speed;
    lastBuffCount = S.buffs.length;
    // reveal newly affordable things
    const sig = availableUpgrades().length + '|' + pendingGrail() + '|' + S.buffs.length;
    if (sig !== lastUnitsSig) { lastUnitsSig = sig; if (tab === 'upgrades' || tab === 'grail') dirty = true; renderTabs(); }
    if (dirty) { dirty = false; renderTabs(); renderDwellings(); renderTab(); sinceUi = 1; }
    if (sinceUi >= 0.2) { sinceUi = 0; updateNumbers(); }
    if (sinceAch >= 1) { sinceAch = 0; checkAch(); }
    if (sinceSave >= 30) { sinceSave = 0; save(); }
  }
  setInterval(frame, 50);
  addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  // ---------- boot ----------
  try { const s = localStorage.getItem(SAVE_KEY); if (s) { load(s); offline(); } } catch (e) { console.warn('Could not load save', e); }
  if (/[?&]debug/.test(location.search)) { tab = 'options'; }
  dirty = true; frame();
  window.HC = { get state() { return S; }, gps, fmt, setSpeed: n => { speed = n; } }; // console helpers
})();
