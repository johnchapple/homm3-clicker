// Downloads game art from heroes.thelazy.net (MediaWiki) listed in js/data.js.
// Usage: node scripts/scrape.mjs [--force]   -> public/img/*, public/img/manifest.json
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const DATA = require('../js/data.js');
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'public/img');
const API = 'https://heroes.thelazy.net/api.php';
const UA = 'HoMM3-Clicker-FanProject/0.1 (non-commercial fan game; polite asset scraper)';
const DELAY = 400, force = process.argv.includes('--force');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const extra = process.argv.filter(a => !a.startsWith('--')).slice(2); // extra wiki file names
fs.mkdirSync(OUT, { recursive: true });
const manPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : {};
const names = [...new Set([...DATA.allImages(), ...extra])];
const todo = names.filter(n => force || !manifest[n] || !fs.existsSync(path.join(OUT, manifest[n].local)));
console.log(`${names.length} images, ${todo.length} to fetch`);
const missing = [];
for (let i = 0; i < todo.length; i += 40) {
  const batch = todo.slice(i, i + 40);
  const url = `${API}?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(batch.map(n => 'File:' + n).join('|'))}`;
  const res = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
  const norm = Object.fromEntries((res.query.normalized || []).map(x => [x.to, x.from]));
  for (const p of Object.values(res.query.pages)) {
    const name = (norm[p.title] || p.title).replace(/^File:/, '').replace(/ /g, '_');
    const info = p.imageinfo && p.imageinfo[0];
    if (!info) { missing.push(name); continue; }
    await sleep(DELAY);
    const r = await fetch(info.url, { headers: { 'User-Agent': UA } });
    if (!r.ok) { missing.push(name); continue; }
    const local = DATA.localName(name);
    fs.writeFileSync(path.join(OUT, local), Buffer.from(await r.arrayBuffer()));
    manifest[name] = { local, source: info.url, page: info.descriptionurl };
    console.log('ok', name);
  }
  await sleep(DELAY);
}
fs.writeFileSync(manPath, JSON.stringify(manifest, null, 1));
if (missing.length) console.log('MISSING:', missing.join(', '));
