// Builds dist/heroes3-clicker.html: one self-contained file with CSS, JS and images inlined as data URIs.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rd = p => fs.readFileSync(path.join(ROOT, p));
const MIME = { png: 'image/png', gif: 'image/gif', webp: 'image/webp', jpg: 'image/jpeg' };
const uri = p => `data:${MIME[p.split('.').pop()]};base64,${rd(p).toString('base64')}`;
let css = rd('css/style.css').toString().replace(/url\(\.\.\/(public\/ui\/[\w.-]+)\)/g, (_, p) => `url(${uri(p)})`);
const manifest = JSON.parse(rd('public/img/manifest.json'));
const img = Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, uri('public/img/' + v.local)]));
const ui = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'public/ui')).map(f => [f, uri('public/ui/' + f)]));
const sfxDir = path.join(ROOT, 'public/sfx'), SMIME = { wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
const sfx = fs.existsSync(sfxDir) ? Object.fromEntries(fs.readdirSync(sfxDir).filter(f => SMIME[f.split('.').pop()])
  .map(f => [f.replace(/\.\w+$/, ''), `data:${SMIME[f.split('.').pop()]};base64,${rd('public/sfx/' + f).toString('base64')}`])) : {};
const js = s => `<script>\n${s.replace(/<\/script/gi, '<\\/script')}\n</script>`;
let html = rd('index.html').toString()
  .replace('href="public/img/Resource_Gold_20x18.gif"', () => `href="${uri('public/img/Resource_Gold_20x18.gif')}"`)
  .replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="js/data.js"></script>', () => js(`window.INLINE_IMG=${JSON.stringify(img)};window.INLINE_UI=${JSON.stringify(ui)};window.INLINE_SFX=${JSON.stringify(sfx)};`) + js(rd('js/data.js').toString()))
  .replace('<script src="js/sfx.js"></script>', () => js(rd('js/sfx.js').toString()))
  .replace('<script src="js/game.js"></script>', () => js(rd('js/game.js').toString()));
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/heroes3-clicker.html'), html);
console.log(`dist/heroes3-clicker.html ${(html.length / 1024).toFixed(0)} KB`);
