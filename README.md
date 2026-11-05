# Heroes III Clicker

A browser idle/incremental game in the style of Cookie Clicker, themed on *Heroes of Might and Magic III*.
Non-commercial fan project.

## Play / run locally
Plain HTML/CSS/JS, no build step. Either open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. Debug tools are hidden by default: add `?debug` to the URL or tap the title 5 times (speed x10/x100/x1000, free gold, spawn artifact, find Grail now).

## Single-file build
`node scripts/build-single.mjs` writes `dist/heroes3-clicker.html` with all CSS, JS and images inlined as data URIs.

## Balance testing
`node scripts/balance-sim.mjs [hours]` runs a greedy bot through the real game in headless Chromium at high speed and prints
when milestones happen (first Grail, each town unlock, gold/sec thresholds). Last run (cautious bot that only digs when it can
double its Grail points): first Grail ~44 min, Necropolis ~6 h, Inferno ~9.5 h of active play.

## Art assets
- `public/ui/` – frame/leather/star UI art, shared with homm3-guess-who.
- `public/img/` – game art downloaded from [heroes.thelazy.net](https://heroes.thelazy.net) by `node scripts/scrape.mjs`.
  It collects every `img` file name in `js/data.js`, resolves them through the wiki's MediaWiki API, downloads them politely
  (delay between requests, fan-project User-Agent) and records the source URLs in `public/img/manifest.json`.
  To add art: reference the wiki file name in `js/data.js` (or pass names as arguments) and re-run the script.

## Sound effects
The wiki has no audio, so by default the game plays synthesized chimes (toggle/volume in Options).
To use the original sounds, extract them from **your own** HoMM3 install (`Data/Heroes3.snd`, e.g. with MMArchive or
Heroes 3 Resource Editor) and copy them into `public/sfx/` with these names (`.wav`, `.mp3` or `.ogg`):

| file | event | suggested original |
|---|---|---|
| `click` | clicking the chest | `PICKUP01.wav` |
| `appear` | wandering artifact appears | `MYSTERY.wav` |
| `treasure` | artifact collected | `TREASURE.wav` |
| `recruit` | creature recruited | `BUY.wav` |
| `build` | building / upgrade bought | `BUILDTWN.wav` |
| `flag` | mine captured | `FLAGMINE.wav` |
| `skill` | skill learned | `NWHEROLV.wav` |
| `week` | new week | `NEWWEEK.wav` |
| `achieve` | achievement | `ACHIEVE.wav` / `QUEST.wav` |
| `grail` | Grail found | `ULTIMATEARTIFACT.wav` |

Missing files fall back to the synthesized sound. `build-single.mjs` inlines whatever is in `public/sfx/`.
Original game audio is copyrighted, so it isn't committed here.

## Gameplay
- Click the treasure chest for gold. Recruit creatures (price x1.15 per creature *bought*).
- **Nine towns**: Castle, Rampart, Necropolis, Inferno, Tower, Dungeon, Stronghold, Fortress, Conflux, each ~1000x the previous.
  Towns unlock at Grail point thresholds (1, 100, 350, 800, 1.4K, 2.2K, 3.2K, 4.5K); points grow with the log of lifetime gold.
- **Upgrades**: upgraded creature forms (x3) and Veteran/Elite/Legendary drills (x2) at 25/50/100 owned.
- **Town tab**, per town: Village Hall → Town Hall → City Hall → Capitol (boost that town's creatures), Tavern, Blacksmith,
  Marketplace, Resource Silo, Mage Guild (kingdom-wide bonuses that stack across towns), Fort → Citadel → Castle,
  three unique buildings (Necromancy Amplifier, Mystic Pond, Castle Gate, Library, Portal of Summoning, ...) and a Grail structure.
- **Creature dwellings** (needs the town's Fort): each level grows HoMM3 weekly growth per in-game day for free. Free creatures don't raise prices.
- **Heroes**: one active hero; hiring another swaps the specialty (free on day 1 of a run). Skills belong to the kingdom and are kept; hero level comes from gold earned this run (+2% each).
- **Secondary skills**: Estates, Leadership, Offense, Logistics, Diplomacy, Mysticism, Luck, Scholar, Sorcery, Wisdom, Necromancy.
- **Mines + Trading Post** (after Marketplace): buy resources for gold, priced from your income.
- **Wandering artifacts**: Endless Sack of Gold (x7 gold for 77s, rare), Endless Purse of Gold, Angel Wings, Cornucopia.
  Each has a chance to leave one of 30 **permanent artifacts**, kept through Grail resets.
- One in-game day = 60s. Each week a random creature gets x2 ("Week of the Griffin").
- **Find the Grail** (prestige) from 1 billion lifetime gold; points grow quickly at first and slow down later: +10% production per Grail point, forever.
- Every purchase shows what it adds, its **ratio** (gold cost per +1 gold/sec, lower is better) and payback time; ★ marks the best deal.
- **Easy mode** (Options): wandering artifacts wait for you instead of vanishing.
- Autosaves to localStorage every 30s; export/import in Options. Offline earnings up to 8h (50%, 100% with any Village Hall).

## Deploy to Netlify
It's a static site. Drag the repo folder onto https://app.netlify.com/drop, or connect the repo with
build command empty and publish directory `.` (`netlify.toml` is included).

## Credits / disclaimer
Heroes of Might and Magic is a trademark of Ubisoft. All game art belongs to its respective owners and is sourced from the
community wiki heroes.thelazy.net. This project is free, non-commercial, and not affiliated with Ubisoft or New World Computing.
