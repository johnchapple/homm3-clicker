/* Sound effects. If public/sfx/<name>.wav (or .mp3/.ogg) exists it is used, otherwise a synthesized
   fallback plays. Drop sounds extracted from your own HoMM3 install into public/sfx/ (see README). */
(function () {
  'use strict';
  const NAMES = ['click', 'appear', 'treasure', 'recruit', 'build', 'flag', 'skill', 'week', 'achieve', 'grail'];
  const EXT = ['wav', 'mp3', 'ogg'];
  const files = {};            // name -> url that loaded
  let ctx = null, muted = false, vol = 0.5;
  try { muted = localStorage.getItem('homm3clicker.muted') === '1'; vol = +(localStorage.getItem('homm3clicker.vol') || 0.5); } catch (e) {}

  // probe for sound files (inlined ones in the single-file build come from window.INLINE_SFX)
  NAMES.forEach(n => {
    if (window.INLINE_SFX) { if (window.INLINE_SFX[n]) files[n] = window.INLINE_SFX[n]; return; }
    const tryExt = i => { if (i >= EXT.length) return; const a = new Audio(); const url = `public/sfx/${n}.${EXT[i]}`;
      a.preload = 'auto'; a.oncanplaythrough = () => { files[n] = url; a.oncanplaythrough = null; }; a.onerror = () => tryExt(i + 1); a.src = url; };
    tryExt(0);
  });

  function ac() { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  // note: [freq, start, dur, type]
  function tones(notes, gain = 0.15) {
    const c = ac(); if (!c) return; const t0 = c.currentTime;
    const master = c.createGain(); master.gain.value = gain * vol; master.connect(c.destination);
    notes.forEach(([f, st, d, type = 'triangle']) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + st); g.gain.exponentialRampToValueAtTime(1, t0 + st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + d);
      o.connect(g); g.connect(master); o.start(t0 + st); o.stop(t0 + st + d + 0.05);
    });
  }
  const SYN = {
    click: () => tones([[1400 + Math.random() * 300, 0, 0.07, 'square'], [2100, 0.02, 0.06]], 0.06),
    appear: () => tones([[784, 0, 0.25], [988, 0.08, 0.25], [1319, 0.16, 0.4], [1568, 0.24, 0.5, 'sine']], 0.14),
    treasure: () => tones([[523, 0, 0.15], [659, 0.07, 0.15], [784, 0.14, 0.15], [1047, 0.21, 0.5], [1319, 0.21, 0.5, 'sine']], 0.16),
    recruit: () => tones([[330, 0, 0.12, 'square'], [440, 0.06, 0.15, 'square']], 0.05),
    build: () => tones([[196, 0, 0.12, 'sawtooth'], [196, 0.15, 0.12, 'sawtooth'], [392, 0.3, 0.35]], 0.08),
    flag: () => tones([[392, 0, 0.1], [523, 0.1, 0.25]], 0.1),
    skill: () => tones([[523, 0, 0.2], [659, 0.1, 0.2], [784, 0.2, 0.2], [1047, 0.3, 0.6]], 0.12),
    week: () => tones([[392, 0, 0.3], [523, 0.25, 0.3], [659, 0.5, 0.3], [784, 0.75, 0.8], [523, 0.75, 0.8, 'sine']], 0.13),
    achieve: () => tones([[880, 0, 0.15], [1175, 0.1, 0.4]], 0.1),
    grail: () => tones([[262, 0, 1.2, 'sine'], [330, 0.2, 1.2, 'sine'], [392, 0.4, 1.2, 'sine'], [523, 0.6, 1.5], [659, 0.8, 1.5, 'sine']], 0.15),
  };
  let lastClick = 0;
  function play(n) {
    if (muted) return;
    if (n === 'click') { const now = performance.now(); if (now - lastClick < 40) return; lastClick = now; }
    try {
      if (files[n]) { const a = new Audio(files[n]); a.volume = vol; a.play().catch(() => {}); }
      else if (SYN[n]) SYN[n]();
    } catch (e) { /* audio unavailable */ }
  }
  window.SFX = {
    play, get muted() { return muted; }, get vol() { return vol; }, hasFiles: () => Object.keys(files).length > 0,
    setMuted(m) { muted = m; try { localStorage.setItem('homm3clicker.muted', m ? '1' : '0'); } catch (e) {} },
    setVol(v) { vol = v; try { localStorage.setItem('homm3clicker.vol', v); } catch (e) {} },
  };
})();
