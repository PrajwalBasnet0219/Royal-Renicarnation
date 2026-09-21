/* ROYAL REINCARNATION 3D — core.js
   Math, deterministic noise, input routing, audio, storage, fixed-step loop. */
'use strict';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, t, dt) => lerp(a, b, 1 - Math.pow(t, dt));
const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const TAU = Math.PI * 2;
const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const angLerp = (a, b, t) => {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
};

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rng = makeRng(seed);
  const perm = new Uint8Array(512), base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = base[i]; base[i] = base[j]; base[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => (h & 1 ? x : -x) + (h & 2 ? y : -y);
  function n2(x, y) {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[xi] + yi], ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi], bb = perm[perm[xi + 1] + yi + 1];
    return (lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
                 lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v) + 1) * 0.5;
  }
  function fbm(x, y, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2.05; gain = gain || 0.5;
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * a; n += a; a *= gain; f *= lac; }
    return s / n;
  }
  function ridge(x, y, oct) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < (oct || 4); i++) {
      s += (1 - Math.abs(n2(x * f, y * f) * 2 - 1)) * a;
      n += a; a *= 0.5; f *= 2.1;
    }
    return s / n;
  }
  return { n2, fbm, ridge };
}

/* ---------------- input ---------------- */
const Input = {
  held: Object.create(null), pressed: new Set(),
  context: 'ui',            // ui | play | dialogue | typing | menu
  mouse: { dx: 0, dy: 0, locked: false, wheel: 0, down: false },
  binds: {
    up: ['w'], down: ['s'], left: ['a'], right: ['d'], run: ['shift'],
    jump: [' '], interact: ['e'], attack: ['f'], command: ['g'],
    fire: ['1'], water: ['2'], wind: ['3'], earth: ['4'], lightning: ['5'], cast: ['v'],
    horn: ['h'], pov: ['p'], swoop: ['x'],
    menu: ['escape'], map: ['m'], quests: ['j'], bonds: ['r'], bag: ['i'], status: ['c']
  },
  init(canvas) {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (this.context === 'typing') return;
      if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      if (!this.held[k]) this.pressed.add(k);
      this.held[k] = true;
    });
    addEventListener('keyup', e => { this.held[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { this.held = Object.create(null); this.pressed.clear(); });
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('mousedown', e => {
      this.mouse.down = true;
      if (this.context === 'play' && !this.mouse.locked) canvas.requestPointerLock();
      void e;
    });
    addEventListener('mouseup', () => { this.mouse.down = false; });
    addEventListener('mousemove', e => {
      if (!this.mouse.locked) return;
      this.mouse.dx += e.movementX; this.mouse.dy += e.movementY;
    });
    addEventListener('wheel', e => { this.mouse.wheel += e.deltaY; }, { passive: true });
  },
  down(a) { return this.binds[a].some(k => this.held[k]); },
  consume(a) {
    for (const k of this.binds[a]) if (this.pressed.has(k)) { this.pressed.delete(k); return true; }
    return false;
  },
  axis() {
    let x = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    let z = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
    if (x && z) { x *= Math.SQRT1_2; z *= Math.SQRT1_2; }
    return { x, z };
  },
  release() { document.exitPointerLock && document.exitPointerLock(); },
  endFrame() { this.pressed.clear(); this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0; }
};

/* ---------------- settings + storage ---------------- */
const Settings = { music: 0.5, sfx: 0.7, textSpeed: 3, shadows: true, view: 'third', sens: 1 };
const Store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
Object.assign(Settings, Store.get('rr3.settings', {}));
const saveSettings = () => Store.set('rr3.settings', Settings);

/* ---------------- audio: synth SFX + mp3 BGM ----------------
   BGM comes from bgm/*.mp3 and follows where you are and what is
   happening. SFX stay synthesised so they never need files. */
const Sound = {
  ctx: null, master: null, ready: false, mood: 'calm',   // mood kept for compat
  decks: null, cur: 0, musicTrack: null, fade: null, _tick: 0,
  FADE_LEN: 1.8,   // seconds of overlap between the old and new track
  TRACKS: {
    menu:     'bgm/main_menu.mp3',
    town:     'bgm/town_safe.mp3',
    field:    'bgm/field_mobs.mp3',
    night:    'bgm/night.mp3',
    dungeon:  'bgm/dungeon_cave.mp3',
    hidden:   'bgm/hidden_dungeon.mp3',
    combat:   'bgm/combat.mp3',
    gate:     'bgm/silverwall_gate.mp3',
    volcanic: 'bgm/volcanic_road.mp3',
    boss:     'bgm/finale_boss.mp3'
  },
  unlock() {
    if (!this.ready) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      } catch { /* synth stays silent, mp3 still works */ }
      this.ready = true;
    }
    if (!this.decks) {
      this.decks = [new Audio(), new Audio()];
      for (const a of this.decks) {
        a.loop = true;
        a.preload = 'auto';
        a.volume = 0;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.pick();
    try { this.weather(World.weather ? World.weather.kind : 'clear'); } catch {}
  },
  apply() {
    // options slider: SFX read Settings live; BGM eases via the fade loop
  },
  deck() { return this.decks[this.cur]; },
  playTrack(name) {
    if (!this.TRACKS[name] || !this.decks) return;
    if (this.musicTrack === name && !this.fade) return;
    // hand the new track to the idle deck and crossfade over the old one
    const nxt = this.decks[1 - this.cur];
    try {
      nxt.src = encodeURI(this.TRACKS[name]);
      nxt.volume = 0;
      const pr = nxt.play();
      if (pr && pr.catch) pr.catch(() => {});
    } catch { return; }
    this.fade = { t: 0, out: this.decks[this.cur], inn: nxt };
    this.cur = 1 - this.cur;
    this.musicTrack = name;
  },
  /* Decide what should be playing from the game state. Called every second. */
  pick() {
    if (!this.ready || !this.decks) return;
    let want = 'town';
    try {
      if (typeof App !== 'undefined' && App.state !== 'play') want = 'menu';
      else if (World.mode === 'interior') want = 'gate';
      else if (World.mode === 'building') want = 'town';
      else if (World.mode === 'dungeon' && World.dungeon) {
        const id = World.dungeon.def.id;
        // any living guardian upgrades the dark to the finale
        const bossUp = Entities.mobs.some(m => !m.dead && m.def.boss && m.dungeonId);
        want = bossUp ? 'boss' : id === 'gloam' ? 'hidden' : 'dungeon';
      } else {
        const p = Entities.player;
        const in42 = m => !m.dead && m.state === 'chase' && dist2D(m.x, m.z, p.x, p.z) < 42;
        const threat = Entities.mobs.some(in42);
        if (threat) {
          const bossThreat = Entities.mobs.some(m => in42(m) && m.def.boss && dist2D(m.x, m.z, p.x, p.z) < 60);
          want = bossThreat ? 'boss' : 'combat';
        }
        else {
          const h = World.height(p.x, p.z);
          const b = World.biome(p.x, p.z, h);
          if (h < 1) want = 'field';   // open water sails to the wilds track
          else {
            const near = SITES.find(s => dist2D(p.x, p.z, s.x, s.z) < s.r + 60);
            if (near) want = near.id === 'castle' ? 'gate' : 'town';
            else if (b === 'volcano') want = 'volcanic';
            else if (b === 'snow' || b === 'marsh' || b === 'shore') want = 'night';
            else want = 'field';
          }
          // deep night swaps the wilds to the night track
          if (World.dayNightF && World.dayNightF() < 0.25 && (want === 'field')) want = 'night';
        }
      }
    } catch { want = this.musicTrack || 'menu'; }
    if (want !== this.musicTrack || this.deck().paused) this.playTrack(want);
  },
  /* Called every frame from App.render: 1 s track checks + equal-power
     crossfades (no middle dip the way linear fades dip). */
  update(dt) {
    if (!this.ready || !this.decks) return;
    this._tick += dt;
    if (this._tick > 1) { this._tick = 0; this.pick(); }
    const base = Settings.music * 0.9;
    if (this.fade) {
      this.fade.t += dt;
      const k = clamp(this.fade.t / this.FADE_LEN, 0, 1);
      this.fade.out.volume = base * Math.cos(k * Math.PI / 2);
      this.fade.inn.volume = base * Math.sin(k * Math.PI / 2);
      if (k >= 1) {
        try { this.fade.out.pause(); } catch {}
        this.fade.out.volume = 0;
        this.fade = null;
      }
    } else {
      const a = this.deck();
      if (Math.abs(a.volume - base) > 0.01) {
        a.volume = clamp(a.volume + sign(base - a.volume) * dt * 1.4, 0, 1);
      }
    }
    // weather bed eases toward its targets
    if (this._wx && this._wxTarget) {
      const k = Math.min(1, dt * 2);
      for (const key of ['rain', 'wind']) {
        const gn = this._wx[key];
        gn.gain.value += (this._wxTarget[key] - gn.gain.value) * k;
      }
    }
  },
  /* Weather bed: looped noise for rain and wind, cracked thunder on demand. */
  weather(kind) {
    if (!this.ready || !this.ctx) return;
    if (!this._wx) {
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
      const mk = (freq, type) => {
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = type; f.frequency.value = freq;
        const gn = this.ctx.createGain();
        gn.gain.value = 0;
        src.connect(f); f.connect(gn); gn.connect(this.master);
        src.start();
        return gn;
      };
      this._wx = { rain: mk(3200, 'bandpass'), wind: mk(380, 'bandpass') };
    }
    const wet = kind === 'rain' ? 0.10 : kind === 'storm' || kind === 'tornado' ? 0.16 : 0;
    const blow = kind === 'tornado' ? 0.20 : kind === 'storm' ? 0.08
      : kind === 'leaves' || kind === 'petals' ? 0.05 : 0;
    this._wxTarget = { rain: wet * Settings.sfx, wind: blow * Settings.sfx };
  },
  thunder(dist) {
    if (!this.ready || !this.ctx || !this._noise || Settings.sfx <= 0) return;
    const delay = clamp(dist, 0.2, 2.5);
    setTimeout(() => {
      if (!this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = this._noise;
        src.playbackRate.value = 0.3;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 140;
        const gn = this.ctx.createGain();
        const v = clamp(1.4 - delay * 0.45, 0.15, 1) * 0.9 * Settings.sfx;
        gn.gain.setValueAtTime(v, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
        src.connect(f); f.connect(gn); gn.connect(this.master);
        src.start(t); src.stop(t + 2);
      } catch {}
    }, delay * 1000);
  },
  wind(on) { /* levels ride the weather() targets; nothing per-frame needed */ },
  sfx(kind) {
    if (!this.ready || !this.ctx || Settings.sfx <= 0) return;
    const t = this.ctx.currentTime;
    const spec = {
      ui: ['triangle', 700, 900, 0.06, 0.14], back: ['triangle', 600, 420, 0.08, 0.14],
      hit: ['square', 260, 90, 0.10, 0.2], hurt: ['sawtooth', 190, 70, 0.20, 0.22],
      magic: ['sine', 440, 1100, 0.26, 0.16], good: ['triangle', 560, 940, 0.22, 0.18],
      bad: ['sawtooth', 210, 120, 0.26, 0.16], seal: ['sine', 180, 660, 0.9, 0.2]
    }[kind] || ['sine', 500, 500, 0.08, 0.12];
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = spec[0];
    o.frequency.setValueAtTime(spec[1], t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, spec[2]), t + spec[3]);
    g.gain.setValueAtTime(spec[4] * Settings.sfx, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec[3]);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + spec[3] + 0.02);
  }
};

/* ---------------- fixed-step loop ---------------- */
const Loop = {
  STEP: 1 / 60, acc: 0, last: 0, fps: 60, _n: 0, _t: 0,
  start(update, render) {
    this.last = performance.now();
    const frame = now => {
      requestAnimationFrame(frame);
      let dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= this.STEP && steps < 6) {
        try { update(this.STEP); } catch (e) { console.error('[update]', e); }
        this.acc -= this.STEP; steps++;
      }
      try { render(dt); } catch (e) { console.error('[render]', e); }
      Input.endFrame();
      this._t += dt; this._n++;
      if (this._t > 0.5) { this.fps = Math.round(this._n / this._t); this._t = 0; this._n = 0; }
    };
    requestAnimationFrame(frame);
  }
};
