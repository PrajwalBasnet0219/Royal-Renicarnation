/* ROYAL REINCARNATION 3D — entities.js
   Player, companions, townsfolk and monsters.

   Movement is free from the start: Shift runs, walking is brisk.
   Low tuning only dulls you slightly instead of rooting you in place. */
'use strict';

/* Companion fighting styles — every heroine fights differently.
   dmg/perLvl scale with player level, plus bond: closeness hits harder. */
const HEROKIND = {
  sword:      { dmg: 12, perLvl: 3, cd: 1.0,  range: 2.8 },
  light:      { dmg: 10, perLvl: 3, cd: 1.2,  range: 16, bolt: 0xffe8a0 },
  greatsword: { dmg: 16, perLvl: 4, cd: 1.5,  range: 3.0, aoe: 3.5 },
  mage:       { dmg: 11, perLvl: 3, cd: 1.3,  range: 18, bolt: 0x9a7fe8 },
  healer:     { heal: 18, cd: 1.4 },
  claw:       { dmg: 8,  perLvl: 2, cd: 0.65, range: 2.6 },
  ward:       { dmg: 10, perLvl: 3, cd: 1.2,  range: 16, bolt: 0x6fa8e8, ward: 6 }
};
function heroKind(h) { return HEROKIND[h.def.combat] || HEROKIND.sword; }

/* Signature circles: each magic kind draws its own seal.
   Yorune counts rings, Seraphine issues edicts in gold, Liora holds
   the tide in triangles, Rurika keeps a lantern cross. */
const HERO_CIRCLE = {
  mage:   { rings: 3, runes: 14, star: null,      spin: 2.0 },
  light:  { rings: 2, runes: 8,  star: 'diamond', spin: 1.4 },
  ward:   { rings: 2, runes: 10, star: 'tri',     spin: 1.2 },
  healer: { rings: 1, runes: 6,  star: 'cross',   spin: 1.0 }
};
function heroCircle(h) { return HERO_CIRCLE[h.def.combat] || HERO_CIRCLE.mage; }

/* Self-research: every heroine develops her own art as she levels.
   Casters research spells, steel masters forms. Old-loop skills
   (Twin Fang, Battle Ward, Arc Surge, Revive Touch) are still honored. */
const HERO_SPELLS = {
  light:      { 3: 'Prism Ray',   5: 'Dawn Lance',  8: 'Coronation',   12: 'Radiance' },
  mage:       { 3: 'Twin Comets', 5: 'Starfall',    8: 'Eventide',     12: 'Singularity' },
  ward:       { 3: 'Twin Sigils', 5: 'Tideward',    8: 'Moonhold',     12: 'Sanctuary' },
  healer:     { 3: 'Soothing Verse', 5: 'Deep Mending', 8: 'Lantern Rite', 12: 'Panacea' },
  sword:      { 3: 'Twin Fang',   5: 'Whirlwind',   8: 'Battle Ward',  12: 'Rose Cross' },
  greatsword: { 3: 'Cleave',      5: 'Ember Rush',  8: 'Twin Fang',    12: 'Calamity Arc' },
  claw:       { 3: 'Flurry',      5: 'Twin Fang',   8: 'Battle Ward',  12: 'Moonfall' }
};
function heroSpells(h) { return HERO_SPELLS[h.def.combat] || HERO_SPELLS.sword; }

/* Personal gear: every 5 levels each heroine reforges her own weapon,
   garb and token (+tier). Gacha rules — HER crit has NO maxima. */
const GEAR_NAMES = {
  sword: ['Blade', 'Garb', 'Rose Token'],
  greatsword: ['Greatsword', 'Duel Garb', 'Ember Token'],
  claw: ['Claws', 'Night Garb', 'Thorn Token'],
  light: ['Dawn Focus', 'Court Garb', 'Crown Token'],
  mage: ['Violet Focus', 'Hall Garb', 'Moth Token'],
  ward: ['Tide Focus', 'Deep Garb', 'Bloom Token'],
  healer: ['Lantern', 'Archive Garb', 'Lily Token']
};
function heroGearTier(h) { return 1 + Math.floor(((h.lvl || 1) - 1) / 5); }
function heroGearName(h) {
  const first = h.def.name.split(' ')[0];
  const g = GEAR_NAMES[h.def.combat] || GEAR_NAMES.sword;
  const tier = heroGearTier(h);
  const tag = tier <= 6 ? ['I', 'II', 'III', 'IV', 'V', 'VI'][tier - 1] : '+' + tier;
  return `${first}'s ${g[0]} ${tag}`;
}
function heroGearBonus(h) {
  const tier = heroGearTier(h), lvl = h.lvl || 1;
  return {
    tier,
    dmg: tier * 2 + Math.floor(lvl / 3),
    heal: tier * 2,
    ward: tier,
    critR: tier * 0.5 + lvl * 0.3,   // uncapped
    critD: tier * 5 + lvl * 2
  };
}
/* Gacha roll, uncapped: { dmg, crit } so the meter can call out crits. */
function rollHeroCrit(h, base) {
  const lvl = h.lvl || 1, tier = heroGearTier(h);
  const cr = 5 + lvl * 0.3 + tier * 0.5;
  if (Math.random() * 100 < cr) return { dmg: Math.round(base * (150 + lvl * 2 + tier * 5) / 100), crit: true };
  return { dmg: base, crit: false };
}

const Entities = {
  scene: null,
  player: null, companions: [], npcs: [], mobs: [], effects: [],
  SPEED: { walk: 5.4, run: 9.6 },       // m/s — 12 km across ≈ 21 min running
  MOB_CAP: 16, spawnTimer: 0,
  _hitFlash: [],

  init(scene) {
    this.scene = scene;
    this.buildPlayer();
    this.buildCastleCast();
    this.buildShip();
    this.buildDragon();
    this.buildSkyTrade();
    this.buildRoadTrade();
  },

  groundY(x, z, e) {
    if (World.mode === 'dungeon') return -800;
    // inside the keep everyone stands on their own floor
    if (World.mode === 'interior') {
      if (e && e.floorY != null) return e.floorY;
      const I = World.interior;
      return I ? I.floors[I.cur].y : 0;
    }
    // inside a walk-in building: single flat floor
    if (World.mode === 'building') return BINT.y;
    // atop the Drift: stand on the isle, step off to fall gently home
    if (e && e.sky != null && World.skyIsles) {
      const S = World.skyIsles[e.sky];
      if (S && dist2D(x, z, S.x, S.z) < S.r) return S.topY;
      return World.height(x, z);
    }
    return World.height(x, z);
  },

  blockedAt(x, z, r, swim, e) {
    // open sky has no walls — what goes up comes gently down
    if (e && e.y > 60 && World.mode === 'overworld') return false;
    if (World.mode === 'interior') {
      for (const c of World.interiorCols()) {
        const rr = c.r + r;
        if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < rr * rr) return true;
      }
      return false;
    }
    if (World.mode === 'dungeon') {
      const d = World.dungeon;
      if (!d) return false;
      for (const c of d.colliders) {
        const rr = c.r + r;
        if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < rr * rr) return true;
      }
      return false;
    }
    if (World.mode === 'building') {
      for (const c of World.buildingCols()) {
        const rr = c.r + r;
        if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < rr * rr) return true;
      }
      return false;
    }
    if (Math.abs(x) > EXTENT || Math.abs(z) > EXTENT) return true;
    // open water is swimmable for the player and recruited companions;
    // everyone and everything else stays dry
    if (World.height(x, z) < SEA + 0.4 && !swim) return true;         // no swimming in Arc One
    return !!World.blocked(x, z, r);
  },

  /* Axis-separated slide, same idea as the 2D build but in XZ. */
  move(e, dx, dz) {
    const r = e.radius || 0.6;
    const swim = e.type === 'player' || (e.type === 'heroine' && e.recruited) ||
      (e.type === 'mob' && e.def && e.def.swim);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.45));
    const sx = dx / steps, sz = dz / steps;
    let moved = false;
    for (let i = 0; i < steps; i++) {
      if (sx && !this.blockedAt(e.x + sx, e.z, r, swim, e)) { e.x += sx; moved = true; }
      if (sz && !this.blockedAt(e.x, e.z + sz, r, swim, e)) { e.z += sz; moved = true; }
    }
    return moved;
  },

  /* ---------------- player ---------------- */
  buildPlayer() {
    const look = {
      hair: 0x2f2723, hair2: 0x1d1714, eye: 0x3e5a80, skin: 0xf0d3ba,
      style: 'short', length: 0.34, dressA: 0x232838, dressB: 0x39405a,
      trim: 0xb9a06a, metal: 0xcbb37c, silhouette: 'outsider', cape: 'half',
      capeColor: 0x1b2030, height: 1.06, feminine: false,
      bust: 0.9, waist: 1.0, hip: 0.95
    };
    const ch = buildCharacter(look);
    this.scene.add(ch.root);
    const s = SITES[0];
    const spot = World.findOpenSpot(s.x, s.z + s.r * 0.42, 0.7);
    const p = {
      type: 'player', name: 'Outsider', ch, look,
      x: spot.x, z: spot.z, y: 0, yaw: 0, radius: 0.55,
      vx: 0, vz: 0, moveAmt: 0, action: null, actionT: 0,
      hp: 70, maxhp: 70, focus: 40, maxfocus: 40,
      atkCd: 0, hurtCd: 0, calm: 0, grounded: true, vy: 0
    };
    p.y = this.groundY(p.x, p.z);
    ch.root.position.set(p.x, p.y, p.z);
    this.player = p;
  },

  /* Castle cast: the people you meet before you are allowed outside. */
  buildCastleCast() {
    const s = SITES[0];
    const jobs = [
      { id: 'physician', name: 'Physician Wren',   a: 1.30, r: 60 },
      { id: 'guard',     name: 'Gate Warden Holt', a: Math.PI / 2, r: s.r - 14 },
      { id: 'cook',      name: 'Cook Bess',        a: 2.05, r: 74 },
      { id: 'scribe',    name: 'Scribe Aldo',      a: 1.80, r: 52 },
      { id: 'child',     name: 'Pip',              a: 1.05, r: 84 },
      { id: 'merchant',  name: 'Pedlar Ost',       a: 0.72, r: 96 }
    ];
    for (const j of jobs) {
      const sp = World.findOpenSpot(s.x + Math.cos(j.a) * j.r, s.z + Math.sin(j.a) * j.r, 0.7);
      this.addNpc(j.id, j.name, sp.x, sp.z);
    }

    // townsfolk elsewhere
    const roster = ['merchant', 'fisher', 'smith', 'archivist', 'mourner', 'child', 'guard'];
    for (const site of SITES.slice(1)) {
      const rng = makeRng((site.x * 13 + site.z * 7) >>> 0);
      const n = site.kind === 'ruin' || site.kind === 'shrine' ? 2 : 5;
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, r = site.r * (0.25 + rng() * 0.4);
        const job = roster[(rng() * roster.length) | 0];
        const sp = World.findOpenSpot(site.x + Math.cos(a) * r, site.z + Math.sin(a) * r, 0.7);
        this.addNpc(job, this.npcName(rng), sp.x, sp.z);
      }
    }

    // heroines at their homes
    for (const def of HEROINES) {
      if (def.sealed) continue;
      const site = SITES.find(x => x.id === def.home) || SITES[0];
      const a = HEROINES.indexOf(def) / 7 * TAU;
      const r = site.r * 0.42;
      const sp = World.findOpenSpot(site.x + Math.cos(a) * r, site.z + Math.sin(a) * r, 0.7);
      this.addHeroine(def, sp.x, sp.z);
    }
    this.placeSiteCast();
    this.spawnTraders();
  },

  npcName(rng) {
    const a = ['Bram', 'Nessa', 'Koda', 'Marga', 'Finn', 'Rook', 'Tilly', 'Grig', 'Ovie', 'Wren', 'Juno', 'Mott', 'Sable', 'Harl'];
    return a[(rng() * a.length) | 0];
  },

  addNpc(job, name, x, z, yOverride) {
    const rng = makeRng((x * 31 + z * 17) >>> 0);
    const pal = [[0x6b4a32, 0x4a3324], [0xd8c07a, 0xa8904e], [0x2f2a36, 0x1b1822], [0x8a4a34, 0x5e3122]];
    const p = pal[(rng() * 4) | 0];
    const look = {
      hair: p[0], hair2: p[1], eye: 0x3a3340, skin: [0xf3d8c2, 0xe0b48c, 0xc08a5c][(rng() * 3) | 0],
      style: rng() < 0.5 ? 'straight' : 'short', length: 0.3 + rng() * 0.5,
      dressA: [0x6a5c48, 0x4e5a64, 0x6b4a4a, 0x4f5c46][(rng() * 4) | 0],
      dressB: 0x3f382e, trim: 0x8a7a58, metal: 0x9a8a62,
      silhouette: (job === 'guard' || job === 'warden') ? 'armoured-gown'
        : job === 'maid' ? 'maid'
        : rng() < 0.28 ? 'a-line' : 'outsider',
      feminine: job === 'maid' ? true : rng() < 0.55,
      cape: 'none', height: job === 'child' ? 0.68 : 0.96 + rng() * 0.06
    };
    if (job === 'choir') {
      look.dressA = 0x1d102e; look.dressB = 0x2a1542; look.trim = 0x9a5fe0;
      look.silhouette = 'shroud'; look.cape = 'full'; look.capeColor = 0x140e1e; look.hood = true;
    }
    if (job === 'warden') { look.trim = 0x3f6fc4; look.metal = 0xb8c8e8; }
    if (job === 'maid') { look.dressA = 0x2a2a34; }
    if (job === 'barmaid') {
      look.silhouette = 'barmaid'; look.feminine = true;
      look.dressA = [0x8e0f22, 0x3b6032, 0x6a4a8a, 0x8a5a2a][(rng() * 4) | 0];
      look.dressB = 0x3f2a3a;
    }
    const ch = buildCharacter(look);
    this.scene.add(ch.root);
    const y = yOverride != null ? yOverride : this.groundY(x, z);
    ch.root.position.set(x, y, z);
    const e = {
      type: 'npc', job, name, ch, x, z, y, yaw: rng() * TAU, radius: 0.5,
      homeX: x, homeZ: z, state: 'idle', wait: rng() * 4, tx: x, tz: z,
      moveAmt: 0, speed: job === 'child' ? 2.6 : 1.5, talked: false, mark: null
    };
    if (yOverride != null) e.floorY = yOverride;
    this.npcs.push(e);
    return e;
  },

  /* The keep's indoor staff. Placed on first entry; they freeze with everyone
     else when you are 20 km away, and wake when you walk in. */
  placeInteriorCast() {
    if (this._interiorCast) return;
    this._interiorCast = true;
    const at = (lx, lz) => ({ x: INT.x + lx, z: INT.z + lz });
    let s = at(24, 4);
    this.addNpc('cook', 'Undercook Pippa', s.x, s.z, 0);
    s = at(-8, 14);
    this.addNpc('guard', 'Hallguard Sera', s.x, s.z, 0);
    s = at(4, -14);
    this.addNpc('scribe', 'Chronicler Fen', s.x, s.z, INT.dh);
  },

  /* Site specialists: cultists at the chapel, traders at the market,
     wardens at the castle gate. Called once after the world is built. */
  placeSiteCast() {
    if (this._siteCast) return;
    this._siteCast = true;
    const put = (job, name, siteId, ox, oz, chore) => {
      const s = SITES.find(x => x.id === siteId);
      if (!s) return null;
      const sp = World.findOpenSpot(s.x + ox, s.z + oz, 0.7);
      const e = this.addNpc(job, name, sp.x, sp.z);
      if (chore) e.chore = chore;
      return e;
    };
    put('choir', 'Hummer Sill', 'chapel', -4, 6);
    put('choir', 'Hummer Vex', 'chapel', 5, -2);
    put('choir', 'Hummer Ode', 'chapel', 0, 10);
    put('merchant', 'Stallwife Meg', 'crossroads', -8, 4, 'work');
    put('merchant', 'Pedlar Quin', 'crossroads', 9, -3, 'work');
    put('child', 'Tib', 'crossroads', 3, 12);
    put('maid', 'Maid Tilly', 'castle', -30, 40, 'work');
    put('maid', 'Maid Odette', 'castle', 34, 20, 'work');
    put('maid', 'Maid Poppy', 'rosegate', -20, 30, 'work');
    put('barmaid', 'Rosie', 'rosegate', 18, 10);
    put('barmaid', 'Tansy', 'rosegate', -14, -8);
    put('barmaid', 'Clover', 'crossroads', 12, 6);
    put('barmaid', 'Bramble', 'crossroads', -10, -4);
    put('barmaid', 'Wren', 'lullwater', 8, 12);
    put('barmaid', 'Saffron', 'greyhollow', -8, 8);
    const c = SITES[0];
    put('warden', 'Warden Rook', 'castle', 12, c.r - 20);
    put('warden', 'Warden Sable', 'castle', -12, c.r - 20);
  },

  /* Walking merchants pacing the trade routes, pack horse in tow. */
  traders: [],
  spawnTraders() {
    if (this._traders) return;
    this._traders = true;
    const defs = [
      ['castle', 'crossroads'], ['crossroads', 'rosegate'],
      ['greyhollow', 'lullwater'], ['chapel', 'greyhollow'],
      ['rosegate', 'whisper'], ['crossroads', 'chapel'],
      ['prismere', 'tarn'], ['ashmire', 'whisper']
    ];
    const coats = [0x5a4030, 0x3a3a3a, 0x6a5a3a, 0x4a3a50];
    defs.forEach(([aid, bid], i) => {
      const A = SITES.find(s => s.id === aid), B = SITES.find(s => s.id === bid);
      if (!A || !B) return;
      const t = 0.2 + Math.random() * 0.6;
      const e = this.addNpc('trader', this.npcName(makeRng((i * 991 + 7) >>> 0)) + ' the Trader',
        lerp(A.x, B.x, t), lerp(A.z, B.z, t));
      e.trader = { ax: A.x, az: A.z, bx: B.x, bz: B.z, t, dir: Math.random() < 0.5 ? 1 : -1, wait: 0, stuck: 0 };
      const hm = buildHorse(coats[i % coats.length]);
      this.scene.add(hm.root);
      this.traders.push({ npc: e, horse: hm });
    });
    this.spawnTravelers();
    this.buildFerries();
  },

  /* Inter-town townsfolk: villagers/pilgrims walking full tours
     town -> town -> town, resting at each stop. Talk to them anywhere. */
  travelers: [],
  spawnTravelers() {
    if (this._travelers) return;
    this._travelers = true;
    const tours = [
      ['rosegate', 'crossroads', 'greyhollow', 'lullwater'],
      ['castle', 'crossroads', 'chapel', 'emberfall'],
      ['ashmire', 'whisper', 'rosegate', 'castle'],
      ['greyhollow', 'crossroads', 'chapel', 'greyhollow'],
      ['prismere', 'tarn', 'greyhollow', 'crossroads'],
      ['lullwater', 'greyhollow', 'crossroads', 'castle']
    ];
    const jobs = ['merchant', 'mourner', 'archivist', 'fisher', 'child', 'guard'];
    tours.forEach((tour, i) => {
      const A = SITES.find(s => s.id === tour[0]);
      if (!A) return;
      const rng = makeRng((i * 331 + 17) >>> 0);
      const e = this.addNpc(jobs[i % jobs.length], this.npcName(rng) + ' the Wayfarer', A.x + 6, A.z + 6);
      e.travel = { tour, leg: 0, t: Math.random(), wait: 4 + rng() * 6, speed: 3.0 };
      this.travelers.push(e);
    });
  },

  updateTraveler(n, dt) {
    const T = n.travel;
    if (!T) return false;
    const A = SITES.find(s => s.id === T.tour[T.leg % T.tour.length]);
    const B = SITES.find(s => s.id === T.tour[(T.leg + 1) % T.tour.length]);
    if (!A || !B) return true;
    if (T.wait > 0) {
      T.wait -= dt;
      n.moveAmt = damp(n.moveAmt, 0, 1e-6, dt);
      n.y = damp(n.y, this.groundY(n.x, n.z, n), 1e-8, dt);
      n.ch.root.position.set(n.x, n.y, n.z);
      n.ch.root.rotation.y = n.yaw;
      n.ch.update(dt, n.moveAmt, null);
      return true;
    }
    const dist = Math.max(1, Math.hypot(B.x - A.x, B.z - A.z));
    T.t += dt * (T.speed || 3.0) / dist;
    if (T.t >= 1) {
      T.t = 0; T.leg = (T.leg + 1) % T.tour.length;
      T.wait = 10 + Math.random() * 14;
      return true;
    }
    const tx = lerp(A.x, B.x, T.t), tz = lerp(A.z, B.z, T.t);
    const d = dist2D(n.x, n.z, tx, tz);
    if (d > 2.5) {
      // walk toward the road point; swim flag off so travelers use bridges/roads
      const ux = (tx - n.x) / d, uz = (tz - n.z) / d;
      const h = World.height(n.x + ux * 3, n.z + uz * 3);
      if (h < SEA + 0.4) {
        // water ahead: wait for the ferry line instead of drowning
        T.wait = 3;
      } else {
        const ok = this.fanStep(n, ux, uz, (T.speed || 3.0), dt, false);
        n.moveAmt = ok ? 0.5 : 0;
        n.yaw = angLerp(n.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.001, dt));
      }
    } else {
      n.moveAmt = damp(n.moveAmt, 0, 1e-6, dt);
    }
    n.y = damp(n.y, this.groundY(n.x, n.z, n), 1e-8, dt);
    n.ch.root.position.set(n.x, n.y, n.z);
    n.ch.root.rotation.y = n.yaw;
    n.ch.update(dt, n.moveAmt, null);
    return true;
  },

  /* Scheduled ferry ships between water towns (see FERRIES in story.js).
     They sail berth-to-berth and NEVER enter town centers: each endpoint
     gets a shore berth (water point near the town) at build time. */
  ferries: [],
  findBerth(site) {
    // ring-search for water just off shore; fall back to a point at r+120
    for (let r = (site.r || 150) * 0.9; r <= (site.r || 150) + 420; r += 25) {
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU + (r % 7) * 0.13;
        const x = site.x + Math.cos(a) * r, z = site.z + Math.sin(a) * r;
        if (Math.abs(x) > EXTENT - 50 || Math.abs(z) > EXTENT - 50) continue;
        const h = World.height(x, z);
        if (h < -1.5 && h > -9) return { x, z };
      }
    }
    const a = Math.atan2(site.x, site.z);
    return { x: site.x + Math.sin(a) * ((site.r || 150) + 120), z: site.z + Math.cos(a) * ((site.r || 150) + 120) };
  },
  buildFerries() {
    if (this._ferries || typeof FERRIES === 'undefined') return;
    this._ferries = true;
    for (const f of FERRIES) {
      const A = SITES.find(s => s.id === f.from), B = SITES.find(s => s.id === f.to);
      if (!A || !B) continue;
      const mesh = buildShip();
      mesh.scale.setScalar(0.85);
      this.scene.add(mesh);
      const berthA = this.findBerth(A), berthB = this.findBerth(B);
      const t0 = Math.random();
      this.ferries.push({
        def: f, mesh, t: t0, dir: 1, speed: 0.03, wait: 0,
        berthA, berthB,
        x: lerp(berthA.x, berthB.x, t0), z: lerp(berthA.z, berthB.z, t0),
        yaw: 0, bob: Math.random() * 6
      });
    }
  },
  ferryPos(F) {
    return { x: lerp(F.berthA.x, F.berthB.x, F.t), z: lerp(F.berthA.z, F.berthB.z, F.t) };
  },
  updateFerries(dt) {
    for (const F of this.ferries) {
      const dist = Math.max(1, Math.hypot(F.berthB.x - F.berthA.x, F.berthB.z - F.berthA.z));
      // situation speed: full make-way (~18, your waters) offshore, ease
      // to ~4 at the berths, heavy weather knocks a third off
      const edge = Math.min(F.t, 1 - F.t);
      let target = 4 + 14 * clamp(edge / 0.15, 0, 1);
      const wk = World.weather ? World.weather.kind : 'clear';
      if (wk === 'storm' || wk === 'tornado') target *= 0.65;
      else if (wk === 'rain') target *= 0.85;
      F.vel = damp(F.vel || 0, target, 0.8, dt);
      if (F.wait > 0) { F.wait -= dt; F.vel = damp(F.vel || 0, 0, 1.5, dt); }
      else {
        F.t += F.dir * (F.vel || 0) * dt / dist;
        if (F.t >= 1) { F.t = 1; F.dir = -1; F.wait = 12; this.shipTraffic(F, F.def.to); }
        if (F.t <= 0) { F.t = 0; F.dir = 1; F.wait = 12; this.shipTraffic(F, F.def.from); }
      }
      const { x, z } = this.ferryPos(F);
      const tgt = F.dir > 0 ? F.berthB : F.berthA;
      F.yaw = angLerp(F.yaw || 0, Math.atan2(tgt.x - x, tgt.z - z), 1 - Math.pow(0.1, dt));
      F.bob += dt;
      F.x = x; F.z = z;
      F.mesh.position.set(x, SEA + 0.1 + Math.sin(F.bob) * 0.15, z);
      F.mesh.rotation.y = F.yaw;
      // carry the player if aboard the ferry
      const p = this.player;
      if (p && p.ferry === F) {
        p.x = x; p.z = z; p.y = SEA + 2.0;
        p.ch.root.position.set(p.x, p.y, p.z);
        for (const h of this.companions) {
          h.x = x - 2; h.z = z - 2; h.y = SEA + 2.0;
          h.ch.root.position.set(h.x, h.y, h.z);
        }
        if (typeof Camera3 !== 'undefined') Camera3.target.set(p.x, p.y + 1.5, p.z);
      }
    }
  },
  boardFerry(F, dockSite) {
    const p = this.player;
    // one deck at a time: stepping onto the ferry leaves the helm behind
    p.aboard = false;
    // boarding from a dock: the ship rows in to YOUR berth first, so you
    // step aboard at the shore instead of teleporting to mid-water
    if (dockSite && F && F.berthA && F.berthB) {
      if (dockSite.id === F.def.from) { F.t = 0; F.dir = 1; }
      else if (dockSite.id === F.def.to) { F.t = 1; F.dir = -1; }
      F.wait = Math.max(F.wait || 0, 4);
      const pos = this.ferryPos(F);
      F.x = pos.x; F.z = pos.z;
      F.mesh.position.set(F.x, SEA + 0.1, F.z);
    }
    p.ferry = F;
    p.aboardFerry = true;
    Sound.sfx('good');
    const dest = F.dir > 0 ? F.def.to : F.def.from;
    const s = SITES.find(x => x.id === dest);
    UI.toast(`Aboard ${F.def.name} — bound for ${s ? s.name : dest}. E to step ashore.`);
    UI.refresh();
  },
  leaveFerry() {
    const p = this.player;
    const F = p.ferry;
    if (!F) return;
    // step onto nearest dry land
    for (let r = 4; r <= 40; r += 4) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r;
        if (World.height(x, z) > SEA + 0.4 && !World.blocked(x, z, 0.6)) {
          p.ferry = null; p.aboardFerry = false;
          p.x = x; p.z = z; p.y = World.height(x, z);
          for (const h of this.companions) { h.x = x - 2; h.z = z - 2; h.y = p.y; h.wx = null; }
          Camera3.target.set(p.x, p.y + 1.5, p.z);
          Sound.sfx('back');
          UI.refresh();
          return;
        }
      }
    }
    // no beach in reach: over the side, swim for it
    for (let r = 4; r <= 14; r += 2) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        const x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r;
        if (Math.abs(x) > EXTENT || Math.abs(z) > EXTENT) continue;
        if (World.height(x, z) < SEA + 0.4) {
          p.ferry = null; p.aboardFerry = false;
          p.x = x; p.z = z; p.y = SEA + 0.3;
          for (const h of this.companions) { h.x = x - 2; h.z = z - 2; h.y = SEA + 0.3; h.wx = null; }
          Camera3.target.set(p.x, p.y + 1.5, p.z);
          Sound.sfx('back');
          UI.toast('Over the side — swim for it!');
          UI.refresh();
          return;
        }
      }
    }
    UI.toast('Open water — wait for the landing.');
  },

  /* Living trade ships: every landing breathes passengers both ways.
     Off come 2–3 arrivals (singles, a couple, some with crates on heads)
     walking up to town; 1–2 departures walk down and "board" (fade out
     at the shore). Pure flavor, capped so the docks never flood. */
  visitors: [],
  shipTraffic(F, siteId) {
    const S = SITES.find(s => s.id === siteId);
    if (!S || this.visitors.length >= 8) return;
    const berth = siteId === F.def.from ? F.berthA : F.berthB;
    if (!berth) return;
    // shore: first dry step from the berth toward town
    const dx = S.x - berth.x, dz = S.z - berth.z, L = Math.hypot(dx, dz) || 1;
    const ux = dx / L, uz = dz / L;
    let shore = null;
    for (let r = 4; r <= 320; r += 6) {
      const x = berth.x + ux * r, z = berth.z + uz * r;
      if (Math.abs(x) > EXTENT || Math.abs(z) > EXTENT) break;
      if (World.height(x, z) > SEA + 0.6 && !World.blocked(x, z, 0.6)) { shore = { x, z }; break; }
    }
    if (!shore) return;
    // town-side anchor: the dock bell if there is one, else the plaza edge
    const town = S.dock ? { x: S.dock.x, z: S.dock.z }
      : { x: S.x + ux * -(S.r * 0.3), z: S.z + uz * -(S.r * 0.3) };
    const rng = makeRng(((Math.random() * 1e9) | 0) >>> 0);
    const jobs = ['merchant', 'fisher', 'mourner', 'archivist', 'child'];
    const spawnWalker = (sx, sz, ex, ez, withCrate, endKind) => {
      const job = jobs[(rng() * jobs.length) | 0];
      const e = this.addNpc(job, this.npcName(rng) + (withCrate ? ' the Porter' : ''), sx, sz);
      e.speed = 2.0 + rng() * 1.2;
      if (withCrate && job !== 'child') {
        const crate = box(0.7, 0.7, 0.7, WOOD());
        crate.position.set(0, 1.95, 0);
        e.ch.root.add(crate);
      }
      e.visitor = { tx: ex, tz: ez, end: endKind, ferry: F };
      this.visitors.push(e);
      return e;
    };
    // arrivals: off the ship, up to town
    const nOff = 2 + ((rng() * 2) | 0);
    const couple = rng() < 0.5 && nOff >= 2;
    for (let i = 0; i < nOff; i++) {
      const side = (i - (nOff - 1) / 2) * 2.2;
      const px = -uz * side, pz = ux * side;
      const withCrate = rng() < 0.4;
      // couples share pace and stride: same speed, adjacent lane
      const e = spawnWalker(
        shore.x + px, shore.z + pz,
        town.x + px, town.z + pz,
        withCrate, 'town');
      if (couple && i < 2) e.speed = 2.4;
    }
    // departures: down to the ship, board and vanish at the waterline
    const nOn = 1 + ((rng() * 2) | 0);
    for (let i = 0; i < nOn; i++) {
      const side = (i - (nOn - 1) / 2) * 2.2;
      const px = -uz * side, pz = ux * side;
      spawnWalker(
        town.x + px * 2, town.z + pz * 2,
        shore.x + px, shore.z + pz,
        rng() < 0.25, 'ship');
    }
  },

  updateVisitor(n, dt) {
    const V = n.visitor;
    if (!V) return true;
    const d = dist2D(n.x, n.z, V.tx, V.tz);
    if (d < 2.0) {
      // arrived: townsfolk melt into the crowd, boarders step aboard
      this.ring(n.x, n.y, n.z, 0xbfe0ff, 1.6);
      this.scene.remove(n.ch.root);
      this.disposeModel(n.ch.root);
      let k = this.npcs.indexOf(n);
      if (k >= 0) this.npcs.splice(k, 1);
      k = this.visitors.indexOf(n);
      if (k >= 0) this.visitors.splice(k, 1);
      const rec = this.traders.find(r => r.npc === n);
      if (rec) this.traders.splice(this.traders.indexOf(rec), 1);
      return false;
    }
    const ux = (V.tx - n.x) / d, uz = (V.tz - n.z) / d;
    const ok = this.fanStep(n, ux, uz, n.speed, dt, false);
    n.moveAmt = ok ? 0.55 : 0;
    if (!ok) {
      // sidestep around whatever blocks the gangway, else give up quietly
      V.stuck = (V.stuck || 0) + dt;
      if (V.stuck > 4) {
        this.scene.remove(n.ch.root);
        this.disposeModel(n.ch.root);
        let k = this.npcs.indexOf(n);
        if (k >= 0) this.npcs.splice(k, 1);
        k = this.visitors.indexOf(n);
        if (k >= 0) this.visitors.splice(k, 1);
        return false;
      }
      this.move(n, -uz * n.speed * dt, ux * n.speed * dt);
    } else V.stuck = 0;
    n.yaw = angLerp(n.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.001, dt));
    n.y = damp(n.y, this.groundY(n.x, n.z, n), 1e-8, dt);
    n.ch.root.position.set(n.x, n.y, n.z);
    n.ch.root.rotation.y = n.yaw;
    n.ch.update(dt, n.moveAmt, null);
    return true;
  },

  /* Aurelia the gold: a tame dragon for traveling, kept at her roost by
     Sora. Evil kin (Dusk Maw, Pale Wyrm) hunt the wilds; she hums. */
  dragon: null,
  roost: null,
  buildDragon() {
    if (this.dragon || typeof MOBS === 'undefined' || !MOBS.aurelia) return;
    let rx = 1700, rz = 800, ok = false;
    for (let r = 0; r <= 600 && !ok; r += 40) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        const x = 1700 + Math.cos(a) * r, z = 800 + Math.sin(a) * r;
        if (Math.abs(x) > EXTENT - 100 || Math.abs(z) > EXTENT - 100) continue;
        const h = World.height(x, z);
        if (h > 8 && h < 120) { rx = x; rz = z; ok = true; break; }
      }
    }
    const def = MOBS.aurelia;
    const mesh = buildMob(def);
    mesh.root.scale.setScalar(1.6);
    this.scene.add(mesh.root);
    const y = World.height(rx, rz);
    mesh.root.position.set(rx, y, rz);
    this.dragon = { mesh, model: mesh, def, x: rx, z: rz, y, yaw: 0, bob: Math.random() * 6, speed: 0 };
    this.roost = { x: rx, z: rz };
    const ksp = World.findOpenSpot(rx + 7, rz + 7, 0.7);
    this.addNpc('keeper', 'Dragonkeeper Sora', ksp.x, ksp.z);
  },
  boardDragon() {
    const p = this.player, D = this.dragon;
    if (!D || p.dragon || World.mode !== 'overworld') return false;
    if (dist2D(p.x, p.z, D.x, D.z) > 14) { UI.toast('Aurelia is perched just over there.'); return false; }
    // one deck at a time: climbing on steps you off everything else
    this.endRide(true);
    p.aboard = false; p.riding = false; p.ferry = null; p.aboardFerry = false;
    p.dragon = true;
    D.speed = 0;
    Sound.sfx('good');
    UI.toast('Aloft! WASD to fly, SPACE to climb, X to dive, E to land.');
    UI.refresh();
    return true;
  },
  leaveDragon() {
    const p = this.player, D = this.dragon;
    if (!D) return;
    for (let r = 4; r <= 120; r += 6) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        const x = D.x + Math.cos(a) * r, z = D.z + Math.sin(a) * r;
        if (Math.abs(x) > EXTENT - 20 || Math.abs(z) > EXTENT - 20) continue;
        if (World.height(x, z) > SEA + 0.4 && !World.blocked(x, z, 0.6)) {
          p.dragon = false;
          // she spirals down to meet you — mounts wait where they land
          D.x = x; D.z = z; D.y = World.height(x, z); D.speed = 0;
          p.x = x; p.z = z; p.y = D.y;
          for (const h of this.companions) { h.x = x - 2; h.z = z - 2; h.y = p.y; h.wx = null; }
          Camera3.target.set(p.x, p.y + 1.5, p.z);
          Sound.sfx('back');
          UI.refresh();
          return;
        }
      }
    }
    UI.toast('No landing below — open sky or shoreline.');
  },
  updateDragon(dt) {
    const D = this.dragon;
    if (!D || World.mode !== 'overworld') return;
    const p = this.player;
    D.bob += dt * (p.dragon ? 2 : 0.8);
    if (!p.dragon) {
      D.mesh.root.position.set(D.x, World.height(D.x, D.z), D.z);
      D.mesh.root.rotation.y = D.yaw;
      // the hover rig owns position.y — feed it our altitude first
      D.model.root.userData.baseY = D.mesh.root.position.y;
      D.model.update(dt, 0);
      // the chart tracks where she perches, not where she was born
      if (this.roost) { this.roost.x = D.x; this.roost.z = D.z; }
      return;
    }
    if (Input.context === 'play') {
      const a = Input.axis();
      const cruise = a.z < -0.01 ? 24 : a.z > 0.01 ? 7 : 14;
      D.speed = damp(D.speed, cruise, 0.6, dt);
      D.yaw -= a.x * 1.1 * dt * clamp(Math.abs(D.speed) / 8, 0.3, 1);
      const gy = World.height(D.x, D.z);
      let vy = 0;
      if (Input.down('jump')) vy = 9;
      else if (Input.down('swoop')) vy = -9;
      D.y = clamp(D.y + vy * dt, Math.max(gy + 2.5, SEA + 1.5), 400);
      D.x += Math.sin(D.yaw) * D.speed * dt;
      D.z += Math.cos(D.yaw) * D.speed * dt;
      if (Math.abs(D.x) > EXTENT - 20 || Math.abs(D.z) > EXTENT - 20) {
        D.x = clamp(D.x, -EXTENT + 20, EXTENT - 20);
        D.z = clamp(D.z, -EXTENT + 20, EXTENT - 20);
        D.speed *= 0.5;
      }
    }
    D.mesh.root.position.set(D.x, D.y + Math.sin(D.bob) * 0.3, D.z);
    D.mesh.root.rotation.y = D.yaw;
    D.model.root.userData.baseY = D.y;
    D.model.update(dt, clamp(Math.abs(D.speed) / 14, 0, 1));
    p.x = D.x; p.z = D.z; p.y = D.y + 6.8;
    p.yaw = D.yaw; p.moveAmt = 0;
    p.ch.root.position.set(p.x, p.y, p.z);
    p.ch.root.rotation.y = p.yaw;
    p.ch.update(dt, 0, null);
    Camera3.target.set(p.x, p.y + 1.5, p.z);
  },

  /* Sky trade: merchant dragons flying fixed runs between far towns,
     the way ferries sail fixed crossings. They keep office hours —
     cruise, pause, turn, cruise back. */
  skyTrade: [],
  buildSkyTrade() {
    if (this._skyTrade) return;
    this._skyTrade = true;
    const runs = [
      { a: 'castle', b: 'emberfall', color: 0xc8b46e, eye: 0x4ae8c8, alt: 150 },
      { a: 'crossroads', b: 'prismere', color: 0x7ab8c8, eye: 0x3a5ae8, alt: 170 }
    ];
    for (const r of runs) {
      const A = SITES.find(s => s.id === r.a), B = SITES.find(s => s.id === r.b);
      if (!A || !B) continue;
      const model = buildMob({ color: r.color, r: 2.0, shape: 'drake', fly: true, eye: r.eye });
      model.root.scale.setScalar(1.3);
      this.scene.add(model.root);
      this.skyTrade.push({
        model, ax: A.x, az: A.z, bx: B.x, bz: B.z, alt: r.alt,
        t: 0.2 + Math.random() * 0.6, dir: Math.random() < 0.5 ? 1 : -1,
        wait: 0, x: 0, z: 0, y: r.alt, yaw: 0, bob: Math.random() * 6
      });
    }
  },
  updateSkyTrade(dt) {
    if (World.mode !== 'overworld') return;
    for (const R of this.skyTrade) {
      const dist = Math.max(1, Math.hypot(R.bx - R.ax, R.bz - R.az));
      // same sky you fly: cruise ~20 out high, flare to ~8 at each end,
      // storms shove them around like they shove you
      const edge = Math.min(R.t, 1 - R.t);
      let target = 8 + 12 * clamp(edge / 0.15, 0, 1);
      const wk = World.weather ? World.weather.kind : 'clear';
      if (wk === 'storm' || wk === 'tornado') target *= 0.65;
      else if (wk === 'rain') target *= 0.85;
      R.vel = damp(R.vel || 0, target, 0.8, dt);
      if (R.wait > 0) {
        R.wait -= dt;
        R.vel = damp(R.vel || 0, 0, 1.5, dt);
      } else {
        R.t += R.dir * (R.vel || 0) * dt / dist;
        if (R.t >= 1) { R.t = 1; R.dir = -1; R.wait = 10; }
        if (R.t <= 0) { R.t = 0; R.dir = 1; R.wait = 10; }
      }
      R.x = lerp(R.ax, R.bx, R.t);
      R.z = lerp(R.az, R.bz, R.t);
      R.bob += dt * 1.2;
      R.y = R.alt + Math.sin(R.bob) * 4;
      const tgt = R.dir > 0 ? { x: R.bx, z: R.bz } : { x: R.ax, z: R.az };
      R.yaw = angLerp(R.yaw, Math.atan2(tgt.x - R.x, tgt.z - R.z), 1 - Math.pow(0.05, dt));
      R.model.root.position.set(R.x, R.y, R.z);
      R.model.root.rotation.y = R.yaw;
      R.model.root.userData.baseY = R.y;
      R.model.update(dt, clamp((R.vel || 0) / 16, 0.1, 1));
    }
  },

  /* Road trade: wagon caravans rolling land routes on their own, no hire
     needed. Horses, driver, turning wheels — scenery with somewhere to be. */
  roadTrade: [],
  buildRoadTrade() {
    if (this._roadTrade) return;
    this._roadTrade = true;
    const runs = [
      ['castle', 'crossroads', 'merchant'],
      ['crossroads', 'rosegate', 'farm'],
      ['rosegate', 'whisper', 'merchant']
    ];
    const dl = {
      hair: 0x4a3b2a, hair2: 0x2e241a, eye: 0x3a3340, skin: 0xe0b48c,
      style: 'short', length: 0.3, dressA: 0x5a4c38, dressB: 0x3f382e,
      trim: 0x8a7a58, metal: 0x9a8a62, silhouette: 'outsider', cape: 'none', height: 1
    };
    runs.forEach(([aid, bid, kind], i) => {
      const A = SITES.find(s => s.id === aid), B = SITES.find(s => s.id === bid);
      if (!A || !B) return;
      const mesh = buildWagon(kind);
      this.scene.add(mesh.root);
      const hm = buildHorse([0x5a4030, 0x3a3a3a][i % 2]);
      this.scene.add(hm.root);
      const dch = buildCharacter(dl);
      this.scene.add(dch.root);
      this.roadTrade.push({
        mesh: mesh.root, wheels: mesh.wheels, horse: hm, driver: dch,
        ax: A.x, az: A.z, bx: B.x, bz: B.z,
        t: 0.2 + Math.random() * 0.6, dir: Math.random() < 0.5 ? 1 : -1, wait: 0
      });
    });
  },
  updateRoadTrade(dt) {
    if (World.mode !== 'overworld') return;
    for (const R of this.roadTrade) {
      const dist = Math.max(1, Math.hypot(R.bx - R.ax, R.bz - R.az));
      // walk pace through town, trot on the open road, mud in the rain
      const edge = Math.min(R.t, 1 - R.t);
      let target = 4 + 6 * clamp(edge / 0.15, 0, 1);
      const wk = World.weather ? World.weather.kind : 'clear';
      if (wk === 'storm' || wk === 'tornado') target *= 0.7;
      else if (wk === 'rain') target *= 0.85;
      R.vel = damp(R.vel || 0, target, 0.8, dt);
      if (R.wait > 0) {
        R.wait -= dt;
        R.vel = damp(R.vel || 0, 0, 1.5, dt);
      } else {
        R.t += R.dir * (R.vel || 0) * dt / dist;
        if (R.t >= 1) { R.t = 1; R.dir = -1; R.wait = 12; }
        if (R.t <= 0) { R.t = 0; R.dir = 1; R.wait = 12; }
      }
      const x = lerp(R.ax, R.bx, R.t), z = lerp(R.az, R.bz, R.t);
      const y = Math.max(World.height(x, z), SEA + 0.3);
      const tgt = R.dir > 0 ? { x: R.bx, z: R.bz } : { x: R.ax, z: R.az };
      const yaw = Math.atan2(tgt.x - x, tgt.z - z);
      const rolling = (R.vel || 0) > 0.5;
      R.mesh.position.set(x, y + 0.2, z);
      R.mesh.rotation.y = yaw;
      for (const w of R.wheels) w.rotation.x += ((R.vel || 0) / 0.7) * dt;
      R.horse.root.position.set(x + Math.sin(yaw) * 5.5, y + 0.2, z + Math.cos(yaw) * 5.5);
      R.horse.root.rotation.y = yaw;
      R.horse.update(dt, rolling ? clamp((R.vel || 0) / 6, 0, 1) : 0);
      R.driver.root.position.set(x + Math.sin(yaw) * 2.3, y + 1.55, z + Math.cos(yaw) * 2.3);
      R.driver.root.rotation.y = yaw;
      R.driver.update(dt, 0, 'sit');
    }
  },

  updateTrader(n, dt) {
    // escorted traders abandon their route and trail the player instead
    if (typeof Game !== 'undefined' && Game.escort && Game.escort.npc === n) {
      return this.updateEscorted(n, dt);
    }
    const R = n.trader;
    const dist = Math.max(1, Math.hypot(R.bx - R.ax, R.bz - R.az));
    if (R.wait > 0) {
      R.wait -= dt;
      n.moveAmt = damp(n.moveAmt, 0, 1e-6, dt);
    } else {
      R.t += R.dir * dt * 2.4 / dist;
      if (R.t >= 1) { R.t = 1; R.dir = -1; R.wait = 8; }
      if (R.t <= 0) { R.t = 0; R.dir = 1; R.wait = 8; }
      const tx = lerp(R.ax, R.bx, R.t), tz = lerp(R.az, R.bz, R.t);
      const d = dist2D(n.x, n.z, tx, tz);
      if (d > 1.2) {
        const ux = (tx - n.x) / d, uz = (tz - n.z) / d;
        const ok = this.fanStep(n, ux, uz, 2.4, dt, false);
        n.moveAmt = ok ? 0.4 : 0;
        n.yaw = angLerp(n.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.001, dt));
        R.stuck = ok ? 0 : (R.stuck || 0) + dt;
        if (R.stuck > 3) { R.dir *= -1; R.stuck = 0; }
      } else n.moveAmt = damp(n.moveAmt, 0, 1e-6, dt);
    }
    n.y = damp(n.y, this.groundY(n.x, n.z, n), 1e-8, dt);
    n.ch.root.position.set(n.x, n.y, n.z);
    n.ch.root.rotation.y = n.yaw;
    n.ch.update(dt, n.moveAmt, null);
    this.walkHorse(n, dt);
  },

  // under escort: trail the player at 4 m, horse in tow
  updateEscorted(n, dt) {
    const p = this.player;
    const d = dist2D(n.x, n.z, p.x, p.z);
    if (d > 4) {
      const ux = (p.x - n.x) / d, uz = (p.z - n.z) / d;
      const ok = this.fanStep(n, ux, uz, 5.2, dt);
      n.moveAmt = ok ? 0.85 : 0;
      n.yaw = angLerp(n.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.001, dt));
    } else {
      n.moveAmt = damp(n.moveAmt, 0, 1e-6, dt);
      n.yaw = angLerp(n.yaw, Math.atan2(p.x - n.x, p.z - n.z), 1 - Math.pow(0.01, dt));
    }
    n.y = damp(n.y, this.groundY(n.x, n.z, n), 1e-8, dt);
    n.ch.root.position.set(n.x, n.y, n.z);
    n.ch.root.rotation.y = n.yaw;
    n.ch.update(dt, n.moveAmt, null);
    this.walkHorse(n, dt);
  },

  walkHorse(n, dt) {
    // pack horse trails behind
    const rec = this.traders.find(r => r.npc === n);
    if (rec) {
      const fx = Math.sin(n.yaw), fz = Math.cos(n.yaw);
      const hx = n.x - fx * 2.8 - fz * 0.8, hz = n.z - fz * 2.8 + fx * 0.8;
      rec.horse.root.position.set(hx, damp(rec.horse.root.position.y, this.groundY(hx, hz, n), 1e-8, dt), hz);
      rec.horse.root.rotation.y = n.yaw;
      rec.horse.update(dt, n.moveAmt);
    }
  },

  addHeroine(def, x, z) {
    const ch = buildCharacter(def.look);
    this.scene.add(ch.root);
    const y = this.groundY(x, z);
    ch.root.position.set(x, y, z);
    const e = {
      type: 'heroine', def, id: def.id, name: def.name, ch,
      x, z, y, yaw: 0, radius: 0.55, homeX: x, homeZ: z,
      state: 'post', wait: 0, tx: x, tz: z, moveAmt: 0,
      speed: 4.2, recruited: false, command: 'follow',
      hp: 120, maxhp: 120, focus: 60, maxfocus: 60, downT: 0, atkCd: 0, target: null, mark: null,
      lvl: 1, xp: 0, skills: []
    };
    this.heroineOf = this.heroineOf || {};
    this.heroineOf[def.id] = e;
    this.npcs.push(e);
    return e;
  },

  /* Heroine growth: own level + skill unlocks (post-story balance).
     Skills: 3 Twin Fang / 5 Battle Ward / 8 Arc Surge / 12 Revive Touch. */
  heroineNeed(h) { return 60 * h.lvl * h.lvl; },
  heroineGainXp(h, n) {
    if (!h || h.downT > 0) return;
    h.xp += n;
    let up = false;
    while (h.xp >= this.heroineNeed(h) && h.lvl < 999) {
      h.xp -= this.heroineNeed(h);
      h.lvl++;
      h.maxhp += 22; h.hp = Math.min(h.maxhp, h.hp + 30);
      h.maxfocus = (h.maxfocus || 60) + 6;
      up = true;
      const table = heroSpells(h);
      if (table[h.lvl] && !(h.skills || []).includes(table[h.lvl])) {
        h.skills.push(table[h.lvl]);
        if (typeof UI !== 'undefined') {
          const first = h.def.name.split(' ')[0];
          const verb = h.def.combat === 'sword' || h.def.combat === 'greatsword' || h.def.combat === 'claw'
            ? 'mastered' : 'researched';
          UI.toast(`${first} ${verb} ${table[h.lvl]}! (Lv ${h.lvl})`, 'good');
        }
      }
      // personal gear reforges every 5 levels: sturdier body with it
      const tier = heroGearTier(h);
      if (tier > (h.gearTier || 1)) {
        h.gearTier = tier;
        h.maxhp += 20; h.hp = Math.min(h.maxhp, h.hp + 20);
        if (typeof UI !== 'undefined') UI.toast(`${h.def.name.split(' ')[0]} reforged ${heroGearName(h)}!`, 'good');
      }
    }
    if (up && typeof UI !== 'undefined') {
      UI.toast(`${h.def.name.split(' ')[0]} reaches Lv ${h.lvl}.`, 'good');
      this.ring(h.x, h.y, h.z, 0xff9ec4, 3);
    }
  },

  get roster() { return this.npcs.filter(n => n.type === 'heroine'); },

  /* The party ship: helm + 9 bench seats, moored at the port pier. */
  buildShip() {
    const mesh = buildShip();
    this.scene.add(mesh);
    const s = SITES.find(x => x.id === 'lullwater') || SITES[1];
    let dx = s.x, dz = s.z;
    for (let r = 20; r < 420; r += 20) {
      let done = false;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
        const h = World.height(x, z);
        if (h < -1.5 && h > -8) { dx = x; dz = z; done = true; break; }
      }
      if (done) break;
    }
    this.ship = {
      mesh, x: dx, z: dz, yaw: 0, speed: 0, bob: 0,
      seats: [[0, -6.5], [-2.2, -3], [2.2, -3], [-2.2, 0], [2.2, 0],
              [-2.2, 3], [2.2, 3], [-2.2, 6], [2.2, 6], [0, 8]]
    };
    this.placeShip();
    this.buildPier(s, dx, dz);
  },

  buildPier(s, wx, wz) {
    const g = new THREE.Group();
    const dx = s.x - wx, dz = s.z - wz, L = Math.hypot(dx, dz) || 1;
    const ux = dx / L, uz = dz / L;
    const n = Math.min(24, Math.floor(L / 2.4));
    for (let i = 0; i < n; i++) {
      const px = wx + ux * i * 2.4, pz = wz + uz * i * 2.4;
      const h = Math.max(World.height(px, pz), SEA);
      const plank = box(3.2, 0.25, 2.2, WOOD());
      plank.position.set(px, h + 1.1, pz);
      plank.rotation.y = Math.atan2(ux, uz);
      g.add(plank);
      if (i % 3 === 0) {
        const post = cyl(0.18, 0.18, 3.5, WOOD(), 6);
        post.position.set(px, h - 0.4, pz);
        g.add(post);
      }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  },

  placeShip() {
    const s = this.ship;
    if (!s) return;
    s.mesh.position.set(s.x, SEA + 0.1 + Math.sin(s.bob) * 0.15, s.z);
    s.mesh.rotation.y = s.yaw;
    s.mesh.rotation.z = Math.sin(s.bob * 0.7) * 0.02;
  },

  shipDeckY() { return this.ship.mesh.position.y + 1.95; },
  shipSeat(i) {
    const s = this.ship, L = s.seats[i % s.seats.length];
    const sy = Math.sin(s.yaw), cy = Math.cos(s.yaw);
    return { x: s.x + L[0] * -cy + L[1] * sy, z: s.z + L[0] * sy + L[1] * cy };
  },

  /* Sound the horn: the ship sails itself to the nearest berth beside you.
     Only works near water — the horn needs a shore in earshot. */
  summonShip() {
    const s = this.ship, p = this.player;
    if (!s || World.mode !== 'overworld' || p.aboard) return false;
    if ((this._hornCd || 0) > 0) { UI.toast('The horn is still echoing.'); return false; }
    let nearWater = false;
    for (let r = 4; r <= 40 && !nearWater; r += 6) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        if (World.height(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r) < SEA + 0.4) { nearWater = true; break; }
      }
    }
    if (!nearWater) { UI.toast('No water in earshot — the horn needs a shore.'); Sound.sfx('bad'); return false; }
    let berth = null;
    for (let r = 6; r <= 20 && !berth; r += 2) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        const h = World.height(x, z);
        if (h < -1.5 && h > -8) { berth = { x, z }; break; }
      }
    }
    if (!berth) { UI.toast('The water here is too shallow to berth.'); Sound.sfx('bad'); return false; }
    s.summon = berth; s.stuckN = 0;
    this._hornCd = 10;
    Sound.sfx('seal');
    const km = dist2D(s.x, s.z, berth.x, berth.z);
    UI.toast(`You sound the horn. The ship turns toward you (${km > 1000 ? (km / 1000).toFixed(1) + ' km' : Math.round(km) + ' m'} — watch the compass).`);
    UI.refresh();
    return true;
  },

  boardShip() {
    const p = this.player;
    p.aboard = true; p.swimming = false; p.manualSwim = false;
    p.vy = 0; p.grounded = true; p.vx = 0; p.vz = 0;
    Sound.sfx('good');
    UI.toast('Aboard! WASD to sail, E to step ashore.');
    UI.refresh();
  },

  findLanding() {
    const s = this.ship;
    for (let r = 4; r <= 16; r += 3) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
        if (Math.abs(x) > EXTENT || Math.abs(z) > EXTENT) continue;
        if (World.height(x, z) > SEA + 0.4 && !World.blocked(x, z, 0.6)) return { x, z };
      }
    }
    return null;
  },

  disembark() {
    const p = this.player;
    const spot = this.findLanding();
    if (!spot) {
      // blue water everywhere: over the side, swim for it
      const s = this.ship;
      for (let r = 4; r <= 12 && !spot; r += 2) {
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
          if (Math.abs(x) > EXTENT || Math.abs(z) > EXTENT) continue;
          if (World.height(x, z) < SEA + 0.4) {
            p.aboard = false;
            p.x = x; p.z = z; p.y = SEA + 0.3;
            Camera3.target.set(p.x, p.y + 1.5, p.z);
            let k = 0;
            for (const h of this.companions) {
              h.x = x - 2 - k; h.z = z - 2; h.y = SEA + 0.3; h.wx = null; k++;
            }
            Sound.sfx('back');
            UI.toast('Over the side — swim for it!');
            UI.refresh();
            return;
          }
        }
      }
      UI.toast('Nowhere to go — not even water in reach.'); Sound.sfx('bad'); return;
    }
    p.aboard = false;
    p.x = spot.x; p.z = spot.z; p.y = World.height(spot.x, spot.z);
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    let i = 0;
    for (const h of this.companions) {
      h.x = spot.x - 2 - i; h.z = spot.z - 2; h.y = World.height(h.x, h.z);
      delete h.floorY; h.wx = null; i++;
    }
    Sound.sfx('back');
    UI.refresh();
  },

  updateShip(dt) {
    const s = this.ship;
    if (!s || World.mode !== 'overworld') return;
    const p = this.player;
    this._hornCd = Math.max(0, (this._hornCd || 0) - dt);
    // ghost voyage: summoned ship sails itself to your berth.
    // far legs ride a swift tide; land in the way catches a current around it.
    if (s.summon && !p.aboard) {
      const dx = s.summon.x - s.x, dz = s.summon.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 8) {
        s.summon = null; s.speed = 0; s.stuckN = 0;
        this.ring(s.x, SEA, s.z, 0xbfe0ff, 4);
        UI.toast('The ship answers, sails full. Board with E.');
      } else {
        const cruise = clamp(d * 0.25, 14, 220);
        s.yaw = angLerp(s.yaw, Math.atan2(dx, dz), 1 - Math.pow(0.05, dt));
        const nx = s.x + Math.sin(s.yaw) * cruise * dt;
        const nz = s.z + Math.cos(s.yaw) * cruise * dt;
        if (World.height(nx, nz) > SEA - 0.5 || Math.abs(nx) > EXTENT || Math.abs(nz) > EXTENT) {
          s.stuckN = (s.stuckN || 0) + 1;
          if (s.stuckN > 300) {
            // beached on a headland: catch a current past it, reappear offshore
            this.burst(s.x, SEA + 1, s.z, 0xbfe0ff, 16);
            let px = s.summon.x, pz = s.summon.z;
            for (let r = 60; r <= 300; r += 40) {
              const a = Math.atan2(s.summon.x - p.x, s.summon.z - p.z);
              const cx = s.summon.x + Math.sin(a) * r, cz = s.summon.z + Math.cos(a) * r;
              if (World.height(cx, cz) < -2) { px = cx; pz = cz; break; }
            }
            s.x = px; s.z = pz; s.stuckN = 0;
            this.ring(px, SEA, pz, 0xbfe0ff, 4);
            UI.toast('The ship catches a swift current.');
          }
        } else { s.x = nx; s.z = nz; s.stuckN = 0; s.speed = 10; }
        s.wakeT = (s.wakeT || 0) - dt;
        if (s.wakeT <= 0) { s.wakeT = 0.5; this.ring(s.x, SEA, s.z, 0xbfe0ff, 3); }
      }
    } else if (p.aboard && Input.context === 'play') {
      const a = Input.axis();
      const target = a.z < -0.01 ? 20 : a.z > 0.01 ? -4.5 : 0;
      s.speed = damp(s.speed, target, 0.5, dt);
      const grip = clamp(Math.abs(s.speed) / 6, 0.25, 1) * (s.speed < -0.1 ? -1 : 1);
      s.yaw -= a.x * 0.9 * dt * grip;
      if (Math.abs(s.speed) > 0.2) {
        const nx = s.x + Math.sin(s.yaw) * s.speed * dt;
        const nz = s.z + Math.cos(s.yaw) * s.speed * dt;
        if (World.height(nx, nz) > SEA - 0.5 || Math.abs(nx) > EXTENT || Math.abs(nz) > EXTENT) {
          if (Math.abs(s.speed) > 4) { Camera3.kick(0.2); Sound.sfx('hit'); }
          s.speed *= 0.3;
        } else { s.x = nx; s.z = nz; }
      }
    } else {
      s.speed = damp(s.speed, 0, 0.5, dt);
    }
    s.bob += dt * (1 + Math.abs(s.speed) * 0.06);
    this.placeShip();
    if (p.aboard) {
      const helm = this.shipSeat(0);
      p.x = helm.x; p.z = helm.z; p.y = this.shipDeckY();
      p.yaw = s.yaw; p.moveAmt = 0;
      p.ch.root.position.set(p.x, p.y, p.z);
      p.ch.root.rotation.y = p.yaw;
      p.ch.update(dt, 0, null);
      // the medic still makes rounds below deck
      const med = this.companions.find(h => heroKind(h).heal);
      if (med) {
        med.atkCd = (med.atkCd || 0) - dt;
        if (med.atkCd <= 0) {
          if (this.healAlly(med, 18)) med.atkCd = 1.4;
          else med.atkCd = 0.5;
        }
      }
      // embarked casters join the broadside: seated deck volleys, no channel
      for (const h of this.companions) {
        const K = heroKind(h);
        if (!K.bolt || h.downT > 0) continue;
        h.atkCd = Math.max(0, (h.atkCd || 0) - dt);
        h.focus = Math.min(h.maxfocus, (h.focus || 0) + 6 * dt);
        if (h.atkCd > 0) continue;
        const foe = this.nearestMob(s.x, s.z, 26);
        if (!foe || (h.focus || 0) < 6) continue;
        h.focus -= 6;
        this.heroineFire(h, foe);
      }
      this.companions.forEach((h, i) => {
        if (h.downT > 0) {
          h.downT -= dt;
          if (h.downT <= 0) { h.hp = h.maxhp * 0.6; UI.toast(`${h.def.name.split(' ')[0]} is back on her feet.`); }
        }
        const seat = this.shipSeat(1 + i);
        h.x = seat.x; h.z = seat.z; h.y = this.shipDeckY();
        h.yaw = s.yaw; h.moveAmt = 0;
        h.ch.root.position.set(h.x, h.y, h.z);
        h.ch.root.rotation.y = h.yaw;
        h.ch.update(dt, 0, 'sit');
      });
    }
  },

  /* ---------------- wagon caravan ----------------
     4 passengers + 1 driver per wagon; big parties roll two wagons. */
  caravan: null,

  startRide(destId, kind) {
    const p = this.player;
    const dest = SITES.find(s => s.id === destId);
    if (!dest || World.mode !== 'overworld' || p.aboard || p.riding || p.ferry || p.dragon || this.caravan) return false;
    const party = this.companions.slice();
    const units = [];
    const need = Math.max(1, Math.ceil((1 + party.length) / 4));
    for (let u = 0; u < Math.min(2, need); u++) {
      const mesh = buildWagon(u === 0 ? kind : 'farm');
      this.scene.add(mesh.root);
      // white waterlights: glow discs under every wheel while fording
      const floaters = [];
      for (const [lx, lz] of [[-1.4, 1.5], [1.4, 1.5], [-1.4, -1.5], [1.4, -1.5]]) {
        const f = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
        disc.rotation.x = -Math.PI / 2;
        f.add(disc);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.95, 16),
          new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, fog: false, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        f.add(ring);
        f.position.set(lx, 0, lz);
        f.visible = false;
        mesh.root.add(f);
        floaters.push(f);
      }
      const horses = [];
      const hn = (u === 0 && kind === 'merchant') || kind === 'war' ? 2 : 1;
      for (let k = 0; k < (u === 0 ? hn : 1); k++) {
        const hm = buildHorse([0x5a4030, 0x3a3a3a][(u + k) % 2]);
        this.scene.add(hm.root);
        // hoof-light so the team floats visibly over water
        const hf = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, fog: false, depthWrite: false }));
        hf.rotation.x = -Math.PI / 2;
        hf.visible = false;
        hm.root.add(hf);
        hm.float = hf;
        horses.push(hm);
      }
      // a driver for every wagon (scenery with one line each)
      const dl = { hair: 0x4a3b2a, hair2: 0x2e241a, eye: 0x3a3340, skin: 0xe0b48c,
        style: 'short', length: 0.3, dressA: 0x5a4c38, dressB: 0x3f382e,
        trim: 0x8a7a58, metal: 0x9a8a62, silhouette: 'outsider', cape: 'none', height: 1 };
      const dch = buildCharacter(dl);
      this.scene.add(dch.root);
      units.push({ mesh: mesh.root, wheels: mesh.wheels, horses, driver: dch, ox: 0, oz: 0, float: floaters });
    }
    const ax = (dest.stone || dest).x + 8, az = (dest.stone || dest).z + 8;
    this.caravan = {
      units, dest, kind,
      x0: p.x, z0: p.z, x1: ax, z1: az,
      dist: Math.max(1, Math.hypot(ax - p.x, az - p.z)),
      t: 0, speed: 11, ambush: [false, false], held: false
    };
    p.riding = true; p.swimming = false; p.manualSwim = false; p.vy = 0; p.grounded = true;
    UI.toast('Rolling! E to stop the wagons anywhere.');
    return true;
  },

  endRide(silent) {
    const c = this.caravan;
    if (!c) return;
    for (const u of c.units) {
      this.scene.remove(u.mesh);
      this.disposeModel(u.mesh);
      for (const h of u.horses) { this.scene.remove(h.root); this.disposeModel(h.root); }
      this.scene.remove(u.driver.root);
      this.disposeModel(u.driver.root);
    }
    this.caravan = null;
    const p = this.player;
    p.riding = false;
    if (!silent) {
      const spot = World.findOpenSpot(p.x, p.z, 0.7);
      p.x = spot.x; p.z = spot.z; p.y = World.height(p.x, p.z);
      let i = 0;
      for (const h of this.companions) {
        h.x = p.x - 2 - i; h.z = p.z - 2; h.y = World.height(h.x, h.z);
        h.wx = null; i++;
      }
      Camera3.target.set(p.x, p.y + 1.5, p.z);
      UI.refresh();
    }
  },

  updateCaravan(dt) {
    const c = this.caravan;
    if (!c || World.mode !== 'overworld') return;
    const p = this.player;
    if (Input.context !== 'play') return;
    // ambushes at 40% and 75% of the road
    const frac = c.t / c.dist;
    [[0.4, 0], [0.75, 1]].forEach(([at, k]) => {
      if (!c.ambush[k] && frac >= at) {
        c.ambush[k] = true;
        c.held = true;
        const mx = lerp(c.x0, c.x1, frac), mz = lerp(c.z0, c.z1, frac);
        const b = World.biome(mx, mz, World.height(mx, mz));
        const pool = Object.keys(MOBS).filter(mk2 => MOBS[mk2].biome === b && !MOBS[mk2].boss && !MOBS[mk2].passive);
        for (let i = 0; i < 3 && pool.length; i++) {
          const a = Math.random() * TAU;
          this.spawnMob(pool[(Math.random() * pool.length) | 0], mx + Math.cos(a) * 15, mz + Math.sin(a) * 15);
        }
        UI.toast('Ambush on the road!', 'warn');
        Sound.sfx('bad');
      }
    });
    if (c.held) {
      const clear = !this.mobs.some(m => !m.dead && dist2D(m.x, m.z, p.x, p.z) < 50);
      if (clear) { c.held = false; UI.toast('Road clear. Rolling on.'); }
      else { this.poseCaravan(dt, true); return; }
    }
    c.t += c.speed * dt;
    if (c.t >= c.dist) {
      const d = c.dest;
      Game.onArrive(d);
      return;
    }
    this.poseCaravan(dt, false);
  },

  poseCaravan(dt, held) {
    const c = this.caravan;
    if (!c) return;
    const p = this.player;
    const sp = held ? 0 : c.speed;
    const yaw = Math.atan2(c.x1 - c.x0, c.z1 - c.z0);
    c.units.forEach((u, ui) => {
      const back = ui * 16;
      const t = clamp((c.t - back) / c.dist, 0, 1);
      const x = lerp(c.x0, c.x1, t), z = lerp(c.z0, c.z1, t);
      const y = Math.max(World.height(x, z), SEA + 0.3);
      u.mesh.position.set(x, y + 0.2, z);
      u.mesh.rotation.y = yaw;
      // waterlights: wheels and hooves glow where the road runs wet
      const wet = World.height(x, z) < SEA - 0.2;
      for (const f of (u.float || [])) {
        f.visible = wet;
        if (wet) f.position.y = (SEA + 0.06) - (y + 0.2);
      }
      for (const w of u.wheels) w.rotation.x += (sp / 0.7) * dt;
      u.horses.forEach((hm, hi) => {
        const hx = x + Math.sin(yaw) * 5.5, hz = z + Math.cos(yaw) * 5.5;
        hm.root.position.set(hx + (hi - (u.horses.length - 1) / 2) * 1.6 * Math.cos(yaw), y + 0.2, hz - (hi - (u.horses.length - 1) / 2) * 1.6 * Math.sin(yaw));
        hm.root.rotation.y = yaw;
        hm.update(dt, sp > 0.5 ? 0.8 : 0);
        if (hm.float) {
          const hw = World.height(hm.root.position.x, hm.root.position.z) < SEA - 0.2;
          hm.float.visible = hw;
          if (hw) hm.float.position.y = (SEA + 0.06) - hm.root.position.y;
        }
      });
      // driver up front, passengers on the benches
      u.driver.root.position.set(
        u.ox + 2.3 * Math.sin(yaw),
        y + 1.55,
        u.oz + 2.3 * Math.cos(yaw));
      u.driver.root.rotation.y = yaw;
      u.driver.update(dt, 0, 'sit');
      u.ox = x; u.oz = z;
    });
    // party distributed 4 to a wagon (player rides the first)
    const seats = [[0, -1.2], [-0.65, -1.2], [0.65, -1.2], [0, 1.2]];
    const riders = [p, ...this.companions];
    riders.forEach((r, i) => {
      const u = c.units[Math.min(c.units.length - 1, Math.floor(i / 4))];
      const L = seats[i % 4];
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      r.x = u.ox + L[0] * -cy + L[1] * sy;
      r.z = u.oz + L[0] * sy + L[1] * cy;
      r.y = Math.max(World.height(u.ox, u.oz), SEA + 0.3) + 1.75;
      r.yaw = yaw; r.moveAmt = 0;
      r.ch.root.position.set(r.x, r.y, r.z);
      r.ch.root.rotation.y = yaw;
      r.ch.update(dt, 0, 'sit');
    });
  },

  /* ---------------- mobs ---------------- */
  spawnMob(key, x, z) {
    const def = MOBS[key];
    if (!def) return null;
    // never spawn clinging to a cliff face: nudge to walkable ground first
    if (World.mode === 'overworld') {
      const steep = (sx, sz) =>
        Math.abs(World.height(sx + 2.5, sz) - World.height(sx - 2.5, sz)) +
        Math.abs(World.height(sx, sz + 2.5) - World.height(sx, sz - 2.5));
      if (steep(x, z) > 9) {
        let found = false;
        for (let r = 4; r <= 40 && !found; r += 4) {
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * TAU;
            const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
            if (Math.abs(nx) > EXTENT || Math.abs(nz) > EXTENT) continue;
            if (steep(nx, nz) <= 9 && !this.blockedAt(nx, nz, def.r * 0.8, false, null)) {
              x = nx; z = nz; found = true; break;
            }
          }
        }
      }
    }
    const model = buildMob(def);
    this.scene.add(model.root);
    const y = this.groundY(x, z);
    model.root.position.set(x, y, z);
    model.root.userData.baseY = y;
    // post-story balance: wilds scale with player level so completed-story
    // grinding never turns trivial; OP world bosses scale slower (already huge).
    const lv = (typeof Game !== 'undefined' ? Game.level : 1) || 1;
    const isOP = !!def.worldBoss;
    const scale = def.boss && !isOP ? 1 + (lv - 1) * 0.06
      : isOP ? 1 + (lv - 1) * 0.04
      : 1 + (lv - 1) * 0.12;
    const hp = Math.round(def.hp * scale);
    const m = {
      type: 'mob', key, def, model, name: def.name,
      x, z, y, yaw: 0, radius: def.r * 0.8,
      hp, maxhp: hp, atk: Math.round(def.atk * (1 + (lv - 1) * (isOP ? 0.03 : 0.07))),
      homeX: x, homeZ: z,
      state: 'idle', wait: Math.random() * 3, tx: x, tz: z,
      moveAmt: 0, cd: 0, target: null, dead: false, hurtT: 0
    };
    this.mobs.push(m);
    return m;
  },

  /* Roaming terrors: fixed lairs in the deep wilds, announced, respawning.
     8 OP side bosses for the open world (not dungeons): high HP, heavy hits. */
  worldBosses: [
    { key: 'magmawyrm', x: 2358, z: 2173, timer: 5 },
    { key: 'frostmaw', x: -100, z: 2200, timer: 10 },
    { key: 'briarancient', x: -4000, z: -2500, timer: 15 },
    { key: 'drownedchoir', x: -400, z: -3600, timer: 20 },
    { key: 'stormsovereign', x: 4200, z: -800, timer: 25 },
    { key: 'abysscantor', x: -4200, z: -800, timer: 30 },
    { key: 'gloomtitan', x: 800, z: 4200, timer: 35 },
    { key: 'cinderqueen', x: 4200, z: 3600, timer: 40 },
    { key: 'embersaint', x: 2900, z: 2900, timer: 45 },
    { key: 'rimechoir', x: -700, z: 2600, timer: 50 },
    { key: 'thornwretch', x: -3500, z: -1900, timer: 55 },
    { key: 'brinetyrant', x: -900, z: -3000, timer: 60 },
    { key: 'trialcrab', x: -750, z: 1550, timer: 5, respawn: 90 },
    { key: 'rocmother', x: 3700, z: -1500, timer: 65 },
    { key: 'palewyrm', x: -1200, z: 2900, timer: 70 },
    { key: 'duskmaw', x: 4900, z: -300, timer: 75 }
  ],

  updateSpawner(dt) {
    if (World.mode !== 'overworld') return;
    // lairs restock five minutes after a terror falls
    for (const L of this.worldBosses) {
      L.timer -= dt;
      const alive = this.mobs.some(m => !m.dead && m.key === L.key);
      if (L.timer <= 0 && !alive) {
        const m = this.spawnMob(L.key, L.x, L.z);
        m.worldBoss = true;
        L.timer = L.respawn || 300;
      }
      if (alive) {
        const m = this.mobs.find(m => !m.dead && m.key === L.key);
        if (m && !m.announced && dist2D(m.x, m.z, this.player.x, this.player.z) < 130) {
          m.announced = true;
          UI.toast(`Something vast stirs nearby… (${m.def.name})`, 'warn');
          Sound.sfx('bad');
        }
      }
    }
    this.spawnTimer -= dt;
    const p = this.player;
    // despawn stragglers (never the lair terrors — they wait for you)
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const d = dist2D(m.x, m.z, p.x, p.z);
      if (m.dead || (d > 420 && !m.worldBoss)) {
        this.scene.remove(m.model.root);
        this.disposeModel(m.model.root);
        this.mobs.splice(i, 1);
      }
    }
    if (this.spawnTimer > 0 || this.mobs.length >= this.MOB_CAP) return;
    this.spawnTimer = 1.1;
    if (!Game.flags.leftCastle) return;               // castle grounds stay safe
    const a = Math.random() * TAU;
    const r = 110 + Math.random() * 130;
    const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
    const h = World.height(x, z);
    const site = SITES.find(s => dist2D(x, z, s.x, s.z) < s.r + 70);
    if (site) return;
    const b = World.biome(x, z, h);
    const pool = Object.keys(MOBS).filter(k => MOBS[k].biome === b && !MOBS[k].boss && !MOBS[k].passive);
    if (!pool.length) return;
    const pick = pool[(Math.random() * pool.length) | 0];
    // dry feet only — unless you were born swimming
    if (h < 2 && !MOBS[pick].swim) return;
    this.spawnMob(pick, x, z);
    // wild animals wander in separately, harmless
    if (Math.random() < 0.3) {
      const critters = Object.keys(MOBS).filter(k => MOBS[k].biome === b && MOBS[k].passive);
      if (critters.length) this.spawnMob(critters[(Math.random() * critters.length) | 0], x + 20, z + 20);
    }
  },

  /* ---------------- update ---------------- */
  update(dt) {
    this.updatePlayer(dt);
    this.updateSpawner(dt);
    // Only simulate people you could plausibly see. Everyone else is frozen
    // in place, which is invisible at 90 m and saves most of the frame.
    // Travelers walk far roads: always tick them (cheap, few bodies).
    for (const n of this.travelers) this.updateTraveler(n, dt);
    // Ship passengers walk the gangway on their own clock, copy-safe loop.
    for (const n of [...this.visitors]) this.updateVisitor(n, dt);
    const p = this.player;
    for (const n of this.npcs) {
      if (n.travel) continue;   // ticked above, on their own long road
      if (n.visitor) continue;  // ticked above, walking the docks
      if (n.type === 'heroine') {
        if (n.recruited || dist2D(n.x, n.z, p.x, p.z) < 120) this.updateHeroine(n, dt);
        continue;
      }
      if (dist2D(n.x, n.z, p.x, p.z) > 95) { n.moveAmt = 0; continue; }
      this.updateNpc(n, dt);
    }
    for (const m of this.mobs) this.updateMob(m, dt);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.t += dt;
      fx.tick(fx.t, dt);
      // effect props are per-effect materials/textures — free them, or long
      // fights slowly eat the GPU (shared mat() cache is never touched here)
      if (fx.t >= fx.life) {
        this.scene.remove(fx.obj);
        fx.obj.traverse(o => {
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          const m = o.material;
          if (m) {
            if (m.map && m.map.dispose) m.map.dispose();
            if (m.dispose) m.dispose();
          }
        });
        // traverse() visits a lone Sprite/Mesh itself, so this covers all
        this.effects.splice(i, 1);
      }
    }
    this.separate();
    this.updateShip(dt);
    this.updateFerries(dt);
    this.updateCaravan(dt);
    this.updateDragon(dt);
    this.updateSkyTrade(dt);
    this.updateRoadTrade(dt);
  },

  updatePlayer(dt) {
    const p = this.player;
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    if (p.actionT > 0) { p.actionT -= dt; if (p.actionT <= 0) p.action = null; }

    let ax = 0, az = 0, wantRun = false;
    if (Input.context === 'play' && !p.aboard && !p.riding && !p.ferry && !p.dragon) {
      const a = Input.axis();
      ax = a.x; az = a.z;
      wantRun = Input.down('run');
    }

    // veil sickness: low tuning dulls you slightly, never roots you.
    // Shift always runs; tuning only trims the top end a little.
    const tune = Game.tuning;
    const walkCap = lerp(0.82, 1, clamp(tune / 60, 0, 1));
    const canRun = tune >= 12;
    const baseSpd = (canRun && wantRun && !p.swimming ? this.SPEED.run : this.SPEED.walk);
    const speed = baseSpd * walkCap * (p.swimming ? 0.78 : 1);

    // movement is relative to where the camera is looking.
    // forward = (sin yaw, cos yaw); right = (-cos yaw, sin yaw).
    const yaw = Camera3.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const dx = (-az * fx - ax * fz);
    const dz = (-az * fz + ax * fx);
    const len = Math.hypot(dx, dz);
    let tvx = 0, tvz = 0;
    if (len > 0.001) { tvx = dx / len * speed; tvz = dz / len * speed; }

    p.vx = damp(p.vx, tvx, 1e-7, dt);
    p.vz = damp(p.vz, tvz, 1e-7, dt);
    if (Math.abs(p.vx) < 0.05) p.vx = 0;
    if (Math.abs(p.vz) < 0.05) p.vz = 0;

    this.move(p, p.vx * dt, p.vz * dt);
    const spd = Math.hypot(p.vx, p.vz);
    p.moveAmt = clamp(spd / this.SPEED.run, 0, 1);
    if (spd > 0.2) p.yaw = angLerp(p.yaw, Math.atan2(p.vx, p.vz), 1 - Math.pow(0.0005, dt));

    const gy = this.groundY(p.x, p.z, p);
    const depth = SEA - gy;
    const wasSwimming = p.swimming;
    // double-tap Space toggles a manual swim in the shallows;
    // deep water always swims, no input needed. Helming a ship or wagon: dry work.
    if (Input.consume('jump') && !p.aboard && !p.riding && !p.ferry && !p.dragon) {
      const now = performance.now();
      if (now - (p.lastTap || 0) < 350 && depth > 0.2 && depth < 0.9) {
        p.manualSwim = !p.manualSwim;
        p.vy = 0;
      }
      p.lastTap = now;
      if (p.grounded && !p.swimming) {
        p.vy = 5.6; p.grounded = false;
        Sound.sfx('ui');
      } else if (p.swimming) {
        p.vy = 0;   // a stroke off the surface
        p.y = Math.min(p.y + 0.6, SEA + 0.55);
      }
    }
    // riders never swim: decks and dragonback are dry work, whatever is below
    p.swimming = !p.aboard && !p.riding && !p.ferry && !p.dragon && World.mode === 'overworld' && (depth > 0.9 || (p.manualSwim && depth > 0.2));
    if (p.swimming && !wasSwimming) {
      // splashdown
      this.ring(p.x, SEA, p.z, 0xbfe0ff, 2.5);
      this.burst(p.x, SEA + 0.3, p.z, 0xbfe0ff, 10);
      if (!p.swimTold) { p.swimTold = true; UI.toast('Swimming: hold SPACE to surface, SHIFT to dive.'); }
    }
    if (!p.grounded) {
      p.vy -= 14 * dt;
      p.y += p.vy * dt;
      if (p.y <= gy) {
        p.y = gy; p.vy = 0; p.grounded = true;
        this.ring(p.x, p.y, p.z, 0xe8e4da, 1.2);
      }
      p.moveAmt = Math.max(p.moveAmt, 0.4);
    } else {
      p.y = damp(p.y, gy, 1e-8, dt);
    }
    if (p.swimming) {
      // hold Space to rise, hold Shift to dive, else drift near the top
      if (Input.down('jump')) p.y = Math.min(p.y + 3.2 * dt, SEA + 0.55);
      else if (Input.down('run')) p.y = Math.max(p.y - 3.2 * dt, gy + 0.4);
      else p.y = damp(p.y, SEA + 0.25, 1e-4, dt);
      p.y = clamp(p.y, gy + 0.4, SEA + 0.55);
      p.grounded = false; p.vy = 0;
      p.moveAmt = Math.max(p.moveAmt, 0.45);
    }
    if (!p.swimming) {
      // climbed out: feet back on the ground, swim toggle released
      if (!p.grounded && p.y <= gy + 0.05) { p.grounded = true; p.vy = 0; p.y = gy; }
      if (depth < 0.2) p.manualSwim = false;
    }
    // walked off the sky: the fall ends, the ground takes you back
    if (p.sky != null && p.y <= World.height(p.x, p.z) + 2) p.sky = null;
    p.ch.root.position.set(p.x, p.y, p.z);
    p.ch.root.rotation.y = p.yaw;
    p.ch.update(dt, p.moveAmt, p.action);

    // focus (mana) always breathes back: a 10% trickle mid-fight,
    // full flow once calm. Wounds only close while Rurika travels with you.
    const threat = this.mobs.some(m => !m.dead && m.state === 'chase' && dist2D(m.x, m.z, p.x, p.z) < 40);
    p.calm = threat ? 0 : p.calm + dt;
    p.focus = Math.min(p.maxfocus, p.focus + (p.calm > 3.5 ? 7 : 0.7) * dt);
    if (p.calm > 3.5) {
      const rurika = this.heroineOf && this.heroineOf.rurika;
      if (rurika && rurika.recruited) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.05 * dt);
    }
  },

  updateNpc(n, dt) {
    if (n.trader) return this.updateTrader(n, dt);
    if (n.riding || n.driveFor) return;   // posed by the caravan, not the crowd sim
    n.wait -= dt;
    if (n.state === 'idle') {
      n.moveAmt = damp(n.moveAmt, 0, 1e-6, dt);
      if (n.wait <= 0) {
        const a = Math.random() * TAU, r = 3 + Math.random() * 9;
        const tx = n.homeX + Math.cos(a) * r, tz = n.homeZ + Math.sin(a) * r;
        if (!this.blockedAt(tx, tz, n.radius, false, n)) { n.tx = tx; n.tz = tz; n.state = 'walk'; }
        else n.wait = 0.6;
      }
    } else {
      const d = dist2D(n.x, n.z, n.tx, n.tz);
      if (d < 0.6) { n.state = 'idle'; n.wait = 2 + Math.random() * 5; }
      else {
        const ux = (n.tx - n.x) / d, uz = (n.tz - n.z) / d;
        const ok = this.fanStep(n, ux, uz, n.speed, dt, false);
        n.moveAmt = ok ? clamp(n.speed / this.SPEED.run, 0.2, 1) : 0;
        n.yaw = angLerp(n.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.001, dt));
        if (!ok) { n.state = 'idle'; n.wait = 0.5; }
      }
    }
    n.y = damp(n.y, this.groundY(n.x, n.z, n), 1e-8, dt);
    n.ch.root.position.set(n.x, n.y, n.z);
    n.ch.root.rotation.y = n.yaw;
    n.ch.update(dt, n.moveAmt, n.chore || null);
  },

  /* Companions never die. Taken below zero they kneel, recover, and come back;
     the player is the only one with a fail state. */
  updateHeroine(h, dt) {
    h.atkCd = Math.max(0, h.atkCd - dt);
    // focus (mana) like yours: 10% trickle while engaged, full flow at rest
    const engaged = h.target && !h.target.dead;
    h.focus = Math.min(h.maxfocus, (h.focus == null ? h.maxfocus : h.focus) + (engaged ? 0.6 : 6) * dt);
    // flesh knits at rest too: 2% per second with no live target, so a
    // grazed 99% always walks itself back to a true 100%
    if (h.downT <= 0 && (!h.target || h.target.dead)) {
      h.hp = Math.min(h.maxhp, h.hp + h.maxhp * 0.02 * dt);
    }
    if (h.downT > 0) {
      h.downT -= dt;
      h.moveAmt = 0;
      h.casting = null; h.windup = null;   // kneeling breaks any chant or form
      h.ch.update(dt, 0, 'down');
      h.ch.root.position.set(h.x, this.groundY(h.x, h.z, h), h.z);
      if (h.downT <= 0) { h.hp = h.maxhp * 0.6; UI.toast(`${h.def.name.split(' ')[0]} is back on her feet.`); }
      return;
    }
    // seated aboard ship or wagon: posed by the vehicle, not the crowd sim
    if (this.player.aboard || this.player.riding || this.player.ferry) { h.casting = null; h.windup = null; return; }
    if (!h.recruited) { this.updateNpc(h, dt); return; }
    // dragonborne: no leash reaches the sky — the party holds where they stand
    if (this.player.dragon) {
      h.casting = null; h.windup = null; h.target = null;
      h.moveAmt = damp(h.moveAmt, 0, 1e-6, dt);
      h.y = damp(h.y, this.groundY(h.x, h.z, h), 1e-8, dt);
      h.ch.root.position.set(h.x, h.y, h.z);
      h.ch.root.rotation.y = h.yaw;
      h.ch.update(dt, 0, null);
      return;
    }

    const p = this.player;
    const cmd = h.command;
    // reunion: no companion is ever left behind, whatever their orders were
    if (dist2D(h.x, h.z, p.x, p.z) > 150) {
      h.x = p.x - 2; h.z = p.z - 2;
      h.y = this.groundY(h.x, h.z, h);
      h.target = null; h.wx = null;
      h.ch.root.position.set(h.x, h.y, h.z);
    }
    const HK = heroKind(h);
    // safe streets: no brawling inside settlements, and no target survives
    // being dragged past the leash (30 m of her, 40 m of you)
    const siteD = SITES.reduce((m, s) => Math.min(m, dist2D(h.x, h.z, s.x, s.z) - s.r), 1e9);
    const inTown = siteD < 20;
    if (inTown && h.target) h.target = null;
    // healers mend on their own whenever someone nearby is hurt.
    // research deepens the art: verses, level, then Deep Mending
    if (HK.heal && h.atkCd <= 0) {
      const hhas = s => h.skills && h.skills.includes(s);
      let amt = HK.heal + (h.lvl || 1) * 2 + (hhas('Soothing Verse') ? 4 : 0);
      if (hhas('Deep Mending')) amt = Math.round(amt * 1.5);
      if (this.healAlly(h, amt)) {
        h.atkCd = HK.cd;
        const CS = heroCircle(h);
        this.magicCircle(h.x, h.y, h.z, {
          rings: CS.rings, runes: CS.runes, star: CS.star, spin: CS.spin,
          color: 0x7fd0a0, r: 2.0, life: 1.2
        });
      }
      else h.atkCd = 0.5;
    }
    let tx = p.x, tz = p.z, want = 3.4;

    if (cmd === 'hold') { tx = h.holdX != null ? h.holdX : h.x; tz = h.holdZ != null ? h.holdZ : h.z; want = 0.5; }
    else if (cmd === 'attack' || cmd === 'guard') {
      if (!HK.heal && !inTown && (!h.target || h.target.dead)) {
        const src = cmd === 'guard' ? p : h;
        h.target = this.nearestMob(src.x, src.z, cmd === 'guard' ? 28 : 32);
      }
      if (h.target && !h.target.dead) { tx = h.target.x; tz = h.target.z; want = HK.range || 2.2; }
    } else if (cmd === 'follow' && !h.target) {
      // bodyguard instinct: maul whatever is mauling the player (wilds only)
      if (!HK.heal && !inTown) {
        const threat = this.mobs.find(m => !m.dead && m.state === 'chase' &&
          (dist2D(m.x, m.z, p.x, p.z) < 24 || dist2D(m.x, m.z, h.x, h.z) < 12));
        if (threat) h.target = threat;
      }
      if (!h.target) {
        // free roam on a leash: wander around the player, hurry back if left behind
        const pd = dist2D(h.x, h.z, p.x, p.z);
        if (pd > 16) { tx = p.x; tz = p.z; want = 3.4; h.wx = null; h.roamT = 0; }
        else {
          h.roamT = (h.roamT || 0) - dt;
          const arrived = h.wx == null || dist2D(h.x, h.z, h.wx, h.wz) < 1.4;
          if (arrived && h.roamT <= 0) {
            h.wx = null;
            for (let t = 0; t < 6; t++) {
              const a = Math.random() * TAU, r = 4 + Math.random() * 7;
              const nx = p.x + Math.cos(a) * r, nz = p.z + Math.sin(a) * r;
              if (!this.blockedAt(nx, nz, h.radius, false, h)) { h.wx = nx; h.wz = nz; break; }
            }
            h.roamT = h.wx == null ? 1 : 1.5 + Math.random() * 3.5;
          }
          if (h.wx != null && !arrived) { tx = h.wx; tz = h.wz; want = 0.8; }
          else { tx = h.x; tz = h.z; want = 99; }   // idle: breathe, face the player
        }
      }
    }
    // engaged while following: close to kind range instead of roaming.
    // the leash holds: drop anything dragged too far or into town.
    if (h.target) {
      const td = dist2D(h.x, h.z, h.target.x, h.target.z);
      const pd = dist2D(p.x, p.z, h.target.x, h.target.z);
      if (h.target.dead || td > 30 || pd > 40 || inTown) h.target = null;
      else if (cmd === 'follow') { tx = h.target.x; tz = h.target.z; want = HK.range || 2.2; }
    }
    // sky-watch: when your mark flies, the party aims with you. Steel
    // closes underneath while bolts rain from afar — a real formation.
    // (Hold orders are sacred: holding heroines stay put.)
    const FT = (typeof Game !== 'undefined' && Game.focusTarget) || null;
    if (cmd !== 'hold' && !HK.heal && FT && !FT.dead && FT.def.fly && !inTown &&
        dist2D(p.x, p.z, FT.x, FT.z) < 45) {
      h.target = FT;
      tx = FT.x; tz = FT.z;
      want = HK.bolt ? 26 : (HK.range || 2.2);
    }
    if (cmd === 'follow' && dist2D(h.x, h.z, p.x, p.z) > 90) { h.x = p.x - 2; h.z = p.z - 2; }
    // ambient patrol: slow rounds around you, never far, never into combat
    if (h.act && h.act.patrol && cmd === 'follow' && !h.target) {
      h.act.a = (h.act.a || 0) + dt * 0.45;
      tx = p.x + Math.cos(h.act.a) * 5;
      tz = p.z + Math.sin(h.act.a) * 5;
      want = 0.8;
    }

    const d = dist2D(h.x, h.z, tx, tz);
    if (d > want) {
      h.casting = null; h.windup = null;   // footsteps break chant and form
      const ux = (tx - h.x) / d, uz = (tz - h.z) / d;
      let sp = h.speed * (d > 14 ? 1.5 : 1);
      // run when you run: match a sprinting player's pace to hold formation
      if (d > 8) {
        const pSpd = Math.hypot(p.vx || 0, p.vz || 0);
        if (pSpd > sp) sp = Math.min(12, pSpd + 0.5);
      }
      const ok = this.fanStep(h, ux, uz, sp, dt);
      h.moveAmt = ok ? clamp(sp / this.SPEED.run, 0.25, 1) : 0;
      h.yaw = angLerp(h.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.0008, dt));
      h.stuck = ok ? 0 : (h.stuck || 0) + dt;
      if (h.stuck > 1.6) { h.x = p.x - 2.2; h.z = p.z - 2.2; h.stuck = 0; }
    } else {
      h.moveAmt = damp(h.moveAmt, 0, 1e-6, dt);
      if (h.target && !h.target.dead && h.atkCd <= 0 && d <= want + 0.6) {
        this.heroineStrike(h);
      } else if (cmd === 'follow') {
        h.yaw = angLerp(h.yaw, Math.atan2(p.x - h.x, p.z - h.z), 1 - Math.pow(0.01, dt));
      }
    }

    // spell channel: stand and gather; completes into heroineFire,
    // fizzles if the mark dies, changes, or leaves the leash
    if (h.casting) {
      const c = h.casting;
      const okT = c.target && !c.target.dead && h.target === c.target &&
        dist2D(h.x, h.z, c.target.x, c.target.z) < 34 &&
        dist2D(p.x, p.z, c.target.x, c.target.z) < 44;
      if (!okT) h.casting = null;
      else {
        c.t -= dt;
        h.moveAmt = 0;
        h.yaw = angLerp(h.yaw, Math.atan2(c.target.x - h.x, c.target.z - h.z), 1 - Math.pow(0.0008, dt));
        if (c.t <= 0) { h.casting = null; this.heroineFire(h, c.target); }
      }
    }

    // steel wind-up: planted feet, then the form lands (or fizzles)
    if (h.windup) {
      const w = h.windup;
      const KK = heroKind(h);
      const reach = (KK.range || 2.5) + (w.target.def ? w.target.def.r : 1);
      const okW = w.target && !w.target.dead && h.target === w.target &&
        dist2D(h.x, h.z, w.target.x, w.target.z) < reach + 1.5 &&
        dist2D(p.x, p.z, w.target.x, w.target.z) < 44;
      if (!okW) h.windup = null;
      else {
        w.t -= dt;
        h.moveAmt = 0;
        h.yaw = angLerp(h.yaw, Math.atan2(w.target.x - h.x, w.target.z - h.z), 1 - Math.pow(0.0008, dt));
        if (w.t <= 0) { h.windup = null; this.heroineSlash(h, w.target); }
      }
    }

    h.y = damp(h.y, this.groundY(h.x, h.z, h), 1e-8, dt);
    if (h.sky != null && h.y <= World.height(h.x, h.z) + 2) h.sky = null;
    // recruited companions swim with you, floating at the surface
    h.swimming = World.mode === 'overworld' && (SEA - this.groundY(h.x, h.z, h) > 0.9);
    if (h.swimming) h.y = damp(h.y, Math.max(this.groundY(h.x, h.z, h) + 0.4, SEA + 0.25), 1e-4, dt);
    h.ch.root.position.set(h.x, h.y, h.z);
    h.ch.root.rotation.y = h.yaw;
    this.updateHeroineAmbient(h, dt, d, want);
    const HK2 = heroKind(h);
    h.ch.update(dt, h.moveAmt, (h.casting || h.windup || h.atkCd > 0.4) ? ((HK2.bolt || HK2.heal) ? 'cast' : 'attack') : (h.actAction || null));
  },

  /* Ambient life: when idle near you, each heroine does small things that
     fit her personality — drills, stretches, shy glances, notes, prayers.
     Pure flavor: poses + floating words, never interrupts combat or orders. */
  updateHeroineAmbient(h, dt, distToGoal, want) {
    if (!h.recruited || h.downT > 0 || (h.target && !h.target.dead)) {
      h.act = null; h.actAction = null;
      h.ambientT = 6 + Math.random() * 8;
      return;
    }
    const p = this.player;
    if (!p || p.aboard || p.riding || p.ferry || World.mode !== 'overworld') {
      h.act = null; h.actAction = null;
      return;
    }
    if (h.act) {
      h.act.t -= dt;
      if (h.act.spin) h.yaw += dt * 2.6;
      if (h.act.face) h.yaw = angLerp(h.yaw, Math.atan2(p.x - h.x, p.z - h.z), 1 - Math.pow(0.01, dt));
      if (h.act.t <= 0) { h.act = null; h.actAction = null; h.ambientT = 9 + Math.random() * 14; }
      return;
    }
    h.ambientT = (h.ambientT == null ? 5 + Math.random() * 9 : h.ambientT) - dt;
    if (h.ambientT > 0 || distToGoal > want + 1.5 || h.moveAmt > 0.25) return;
    const id = h.def.id;
    const bond = (typeof Game !== 'undefined' ? Game.bondLevel(h.def.id) : 1) || 1;
    const roll = Math.random();
    const start = (t, action, opt) => {
      h.act = Object.assign({ t }, opt || {});
      h.actAction = action || null;
    };
    // high bond: a held glance, no words needed
    if (bond >= 5 && roll < 0.22) {
      start(2.2, 'shy', { face: true });
      return;
    }
    if (id === 'elvia') {           // tsundere knight: drills, rounds, stretches
      if (roll < 0.30) { start(1.4, 'attack'); }
      else if (roll < 0.50) { start(2.2, 'shy', { face: true }); }
      else if (roll < 0.68) { start(6.0, null, { patrol: true, a: Math.random() * TAU }); }
      else if (roll < 0.84) { start(1.8, null, { spin: true }); }
      else { start(2.0, 'stretch'); }
    } else if (id === 'seraphine') { // regal: strolls, poise, delight
      if (roll < 0.32) { start(6.0, null, { patrol: true, a: Math.random() * TAU }); }
      else if (roll < 0.55) { start(2.0, 'stretch'); }
      else if (roll < 0.78) { start(2.0, 'cheer'); }
      else { start(2.2, 'shy', { face: true }); }
    } else if (id === 'ignia') {     // rival: shadow-boxes, shows off, paces
      if (roll < 0.34) { start(1.6, 'attack'); }
      else if (roll < 0.54) { start(6.0, null, { patrol: true, a: Math.random() * TAU }); }
      else if (roll < 0.78) { start(2.0, 'cheer'); }
      else { start(2.0, 'stretch'); }
    } else if (id === 'yorune') {    // kuudere mage: measures, notes, rests eyes
      if (roll < 0.36) { start(2.2, 'cast'); }
      else if (roll < 0.60) { start(2.4, null, { face: true }); }
      else if (roll < 0.80) { start(2.4, 'sit'); }
      else { start(2.2, 'shy', { face: true }); }
    } else if (id === 'rurika') {    // gentle scholar: reads seated, hides, looks up
      if (roll < 0.40) { start(3.2, 'sit'); }
      else if (roll < 0.62) { start(2.2, 'shy', { face: true }); }
      else if (roll < 0.82) { start(2.0, 'cheer'); }
      else { start(2.2, null, { face: true }); }
    } else if (id === 'morvanna') {  // mourner: stillness, slow rounds, resting hum
      if (roll < 0.34) { start(2.6, null, { face: true }); }
      else if (roll < 0.56) { start(2.2, 'shy', { face: true }); }
      else if (roll < 0.78) { start(6.0, null, { patrol: true, a: Math.random() * TAU }); }
      else { start(3.0, 'sit'); }
    } else {                          // liora: devoted watcher, finally walking free
      if (roll < 0.32) { start(2.4, null, { face: true }); }
      else if (roll < 0.54) { start(2.0, 'cheer'); }
      else if (roll < 0.76) { start(3.0, 'sit'); }
      else { start(2.0, 'stretch'); }
    }
  },

  heroineStrike(h) {
    const K = heroKind(h);
    const t = h.target;
    if (!t || t.dead || h.casting || h.windup) return;
    if (K.heal) return;   // healers mend on their own clock, never strike
    if (K.bolt) {
      // magic gathers before it flies: a 2.2 s channel with a visible tell.
      // Steel stays instant — only the casters chant.
      const cost = 6;
      if ((h.focus || 0) < cost) { h.atkCd = 0.4; return; }
      h.focus -= cost;
      h.casting = { t: 2.2, target: t };
      h.atkCd = 0.2;   // briefly busy; the real cooldown starts when it fires
      const CS = heroCircle(h);
      this.magicCircle(h.x, h.y, h.z, {
        rings: CS.rings, runes: CS.runes, star: CS.star, spin: CS.spin,
        color: K.bolt, r: 1.8, life: 2.4
      });
      return;
    }
    const cost = 0;
    if ((h.focus || 0) < cost) { h.atkCd = 0.4; return; }
    h.focus -= cost;
    // steel answers in half a heartbeat: plant feet, then the form lands
    h.windup = { t: 0.5, target: t };
    h.atkCd = 0.55;
    return;
  },

  /* The steel lands: each researched form cuts differently. */
  heroineSlash(h, t) {
    const K = heroKind(h);
    if (!t || t.dead) return;
    const has = s => h.skills && h.skills.includes(s);
    const first = h.def.name.split(' ')[0];
    const hlvl = h.lvl || 1;
    let dmg = K.dmg + hlvl * K.perLvl + Game.level * 1.5 + Game.bondLevel(h.def.id) * 2 + heroGearBonus(h).dmg;
    if ((has('Oathblade') || has('Night Hunt')) && t.hp > t.maxhp * 0.7) dmg *= 1.5;
    if (has('Calamity Arc')) dmg *= 1.3;
    dmg = Math.round(dmg);
    h.atkCd = K.cd * (has('Flurry') ? 0.8 : 1);
    // Ember Rush: Ignia crosses the gap in a stride of flame
    if (has('Ember Rush')) {
      const dx = t.x - h.x, dz = t.z - h.z, l = Math.hypot(dx, dz) || 1;
      this.move(h, dx / l * Math.min(4, l - 1.5), dz / l * Math.min(4, l - 1.5));
      this.burst(h.x, h.y + 1, h.z, 0xff8a3a, 8);
    }
    // arc radius: Whirlwind / Rose Cross carve wide, Cleave widens the greatsword
    let arc = K.aoe || 0;
    if (has('Whirlwind')) arc = Math.max(arc, 3.0);
    if (has('Rose Cross')) arc = Math.max(arc, 3.5);
    if (has('Cleave')) arc = Math.max(arc, (K.aoe || 0) + 1.5);
    if (has('Calamity Arc')) arc = Math.max(arc, (K.aoe || 0) + 3);
    if (has('Moonfall')) arc = Math.max(arc, 2.0);
    const doHit = (mult) => {
      const r = rollHeroCrit(h, Math.round(dmg * (mult || 1)));
      const dd = r.dmg, crit = r.crit;
      if (arc > 0) {
        this.ring(t.x, t.y, t.z, 0xffd0a0, arc);
        this.burst(t.x, t.y + 1, t.z, 0xffd0a0, 10);
        for (const m of [...this.mobs]) {
          if (!m.dead && dist2D(m.x, m.z, t.x, t.z) < arc + m.def.r) this.damageMob(m, dd, first, crit);
        }
        Sound.sfx('hit');
      } else {
        this.damageMob(t, dd, first, crit);
      }
    };
    doHit(1);
    // follow-ups: Twin Fang doubles, Flurry triples fast and light
    if (has('Twin Fang') && !t.dead) doHit(0.7);
    if (has('Flurry')) {
      if (!t.dead) doHit(0.6);
      if (!t.dead) doHit(0.6);
    }
    if (has('Rose Cross') && !t.dead) doHit(0.8);
    if (K.bolt) {
      this.bolt(h.x, h.y + 1.3, h.z, t.x, t.y + 1, t.z, K.bolt);
      Sound.sfx('magic');
    }
    if (K.ward || (h.skills && h.skills.includes('Battle Ward'))) {
      // Liora shields her love while she fights
      const p = this.player;
      const ward = (K.ward || 4) + hlvl;
      p.hp = Math.min(p.maxhp, p.hp + ward);
      this.popup(p.x, p.y + 2.4, p.z, '+' + ward, 0x7fd0a0);
    }
    // Revive Touch: finish a downed ally faster while fighting
    if (h.skills && h.skills.includes('Revive Touch')) {
      for (const c of this.companions) {
        if (c !== h && c.downT > 0 && dist2D(h.x, h.z, c.x, c.z) < 14) c.downT = Math.max(0, c.downT - 1);
      }
    }
  },

  /* Shaped deliveries, beyond the orb: a light-lance that pierces a line,
     a meteor rain that falls from the sky, a slow spiral for wards. */
  lance(x1, y1, z1, x2, y2, z2, color) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz) || 1;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, len),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false }));
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    m.lookAt(x2, y2, z2);
    const halo = new THREE.PointLight(color, 1.4, 12);
    m.add(halo);
    this.scene.add(m);
    this.effects.push({
      obj: m, t: 0, life: 0.4,
      tick: t => {
        const k = clamp(t / 0.4, 0, 1);
        m.scale.set(1 - k * 0.4, 1 - k * 0.4, 1);
        m.material.opacity = 0.9 * (1 - k);
      }
    });
  },
  shardRain(x, z, r, color, n) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false });
    const bits = [];
    for (let i = 0; i < (n || 8); i++) {
      const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), m);
      const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * r;
      b.position.set(x + Math.cos(a) * rr, 14 + Math.random() * 8, z + Math.sin(a) * rr);
      g.add(b);
      bits.push({ mesh: b, vy: 22 + Math.random() * 10 });
    }
    this.scene.add(g);
    this.effects.push({
      obj: g, t: 0, life: 0.9,
      tick: (t, dt) => {
        for (const b of bits) {
          b.mesh.position.y -= b.vy * dt;
          b.mesh.rotation.y += dt * 7;
          if (b.mesh.position.y < 1) { b.mesh.position.y = 1; b.vy = 0; b.mesh.scale.setScalar(0.01); }
        }
        m.opacity = 0.95 * (1 - t / 0.9);
      }
    });
  },
  spiral(x, y, z, color) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, fog: false });
    const bits = [];
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), m);
      const a = (i / 14) * TAU;
      b.position.set(x + Math.cos(a) * 1.6, y, z + Math.sin(a) * 1.6);
      g.add(b);
      bits.push({ mesh: b, a, h: Math.random() });
    }
    this.scene.add(g);
    this.effects.push({
      obj: g, t: 0, life: 0.9,
      tick: (t, dt) => {
        for (const b of bits) {
          b.a += dt * 5;
          b.h += dt * 2.2;
          b.mesh.position.set(x + Math.cos(b.a) * 1.6 * (1 - b.h * 0.4), y + b.h * 2.4, z + Math.sin(b.a) * 1.6 * (1 - b.h * 0.4));
        }
        m.opacity = 0.85 * (1 - t / 0.9);
      }
    });
  },

  /* The spell lands: each researched form flies and hits differently. */
  heroineFire(h, t) {
    const K = heroKind(h);
    if (!t || t.dead) return;
    const has = s => h.skills && h.skills.includes(s);
    const first = h.def.name.split(' ')[0];
    const hlvl = h.lvl || 1;
    let dmg = K.dmg + hlvl * K.perLvl + Game.level * 1.5 + Game.bondLevel(h.def.id) * 2 + heroGearBonus(h).dmg;
    if (has('Arc Surge')) dmg *= 1.4;   // honored from older loops
    dmg = Math.round(dmg);
    h.atkCd = K.cd * (has('Arc Surge') ? 0.9 : 1);
    const CS = heroCircle(h);
    const slowHit = m => { if (!m.dead && (has('Eventide') || has('Moonhold'))) m.slowT = 4; };
    // Dawn Lance: a piercing shaft through the whole line, not an orb
    if (has('Dawn Lance')) {
      this.lance(h.x, h.y + 1.3, h.z, t.x, t.y + 1, t.z, K.bolt);
      this.magicCircle(t.x, t.y, t.z, { rings: 2, runes: 8, star: 'diamond', spin: 1.4, color: K.bolt, r: 2.4, life: 0.8 });
      const dx = t.x - h.x, dz = t.z - h.z, L = Math.hypot(dx, dz) || 1;
      for (const m of [...this.mobs]) {
        if (m.dead) continue;
        const along = ((m.x - h.x) * dx + (m.z - h.z) * dz) / L;
        if (along < 0 || along > L) continue;
        const side = Math.abs((m.x - h.x) * dz - (m.z - h.z) * dx) / L;
        if (side < 2.5 + m.def.r) { const rL = rollHeroCrit(h, dmg); this.damageMob(m, rL.dmg, first, rL.crit); slowHit(m); }
      }
    } else if (has('Starfall')) {
      // Yorune's meteor: the sky answers in shards
      this.shardRain(t.x, t.z, 4.5, K.bolt, 9);
      this.magicCircle(t.x, t.y, t.z, { rings: 3, runes: 14, star: null, spin: 2.0, color: K.bolt, r: 3.2, life: 0.9 });
      for (const m of [...this.mobs]) {
        if (!m.dead && dist2D(m.x, m.z, t.x, t.z) < 4.5 + m.def.r) { const rS = rollHeroCrit(h, dmg); this.damageMob(m, rS.dmg, first, rS.crit); slowHit(m); }
      }
    } else {
      // classic bolt — single, twinned, coronation fan, or radiant burst
      this.bolt(h.x, h.y + 1.3, h.z, t.x, t.y + 1, t.z, K.bolt);
      this.magicCircle(t.x, t.y, t.z, {
        rings: CS.rings, runes: CS.runes, star: CS.star, spin: CS.spin,
        color: K.bolt, r: 2.4, life: 0.8
      });
      const rB = rollHeroCrit(h, dmg);
      this.damageMob(t, rB.dmg, first, rB.crit);
      slowHit(t);
      if ((has('Prism Ray') || has('Twin Comets') || has('Twin Sigils')) && !t.dead) {
        this.bolt(h.x, h.y + 1.3, h.z, t.x, t.y + 0.6, t.z, K.bolt);
        const rT = rollHeroCrit(h, Math.round(dmg * 0.7));
        this.damageMob(t, rT.dmg, first, rT.crit);
        slowHit(t);
      }
      if (has('Coronation')) {
        let n = 0;
        for (const m of Entities.mobs) {
          if (n >= 2) break;
          if (m === t || m.dead) continue;
          if (dist2D(m.x, m.z, t.x, t.z) < 10) {
            this.bolt(t.x, t.y + 1, t.z, m.x, m.y + 1, m.z, K.bolt);
            const rF = rollHeroCrit(h, Math.round(dmg * 0.6));
            this.damageMob(m, rF.dmg, first, rF.crit);
            slowHit(m);
            n++;
          }
        }
      }
      if (has('Radiance') || has('Singularity')) {
        this.burst(t.x, t.y + 1, t.z, K.bolt, 22);
        this.ring(t.x, t.y, t.z, K.bolt, 5);
        for (const m of [...this.mobs]) {
          if (!m.dead && m !== t && dist2D(m.x, m.z, t.x, t.z) < 5 + m.def.r) { const rR = rollHeroCrit(h, Math.round(dmg * 0.7)); this.damageMob(m, rR.dmg, first, rR.crit); slowHit(m); }
        }
      }
    }
    Sound.sfx('magic');
    // wards: Tideward deepens the shield, Sanctuary covers everyone
    let ward = (K.ward || 0) + (K.ward ? hlvl : 0) + heroGearBonus(h).ward;
    if (K.ward && has('Tideward')) ward = Math.round(ward * 1.6);
    if (K.ward && has('Sanctuary')) {
      ward = Math.round(ward * 2);
      const p0 = this.player;
      for (const c of this.companions) {
        if (c.downT <= 0 && dist2D(h.x, h.z, c.x, c.z) < 20) {
          c.hp = Math.min(c.maxhp, c.hp + 10 + hlvl);
          this.popup(c.x, c.y + 2.4, c.z, '+' + (10 + hlvl), 0x7fd0a0);
        }
      }
      p0.hp = Math.min(p0.maxhp, p0.hp + 10 + hlvl);
      this.spiral(h.x, h.y, h.z, K.bolt);
    } else if (has('Battle Ward')) ward = Math.max(ward, 4 + hlvl);
    if (ward > 0) {
      const p = this.player;
      p.hp = Math.min(p.maxhp, p.hp + ward);
      this.popup(p.x, p.y + 2.4, p.z, '+' + ward, 0x7fd0a0);
    }
    if (has('Revive Touch')) {
      for (const c of this.companions) {
        if (c !== h && c.downT > 0 && dist2D(h.x, h.z, c.x, c.z) < 14) c.downT = Math.max(0, c.downT - 1);
      }
    }
  },

  /* Mob feet: one shared step so nothing moonwalks or spider-climbs.
     Probes ahead for walls and cliffs, fans out to ±33° when blocked,
     and always faces the direction it actually travels. */
  mobStep(m, ux, uz, sp, dt) {
    const l0 = Math.hypot(ux, uz) || 1;
    ux /= l0; uz /= l0;
    const px = -uz, pz = ux;
    const fans = [
      [ux, uz],
      [ux * 0.84 + px * 0.55, uz * 0.84 + pz * 0.55],
      [ux * 0.84 - px * 0.55, uz * 0.84 - pz * 0.55]
    ];
    // sea-born probe as swimmers or open water reads as a wall to them
    const swim = !!(m.def && m.def.swim);
    for (const [dx, dz] of fans) {
      const l = Math.hypot(dx, dz) || 1;
      const vx = dx / l, vz = dz / l;
      const nx = m.x + vx * 2.2, nz = m.z + vz * 2.2;
      if (this.blockedAt(nx, nz, m.radius, swim, m)) continue;
      // sheer cliffs are not stairs: flyers and swimmers exempt, walkers contour
      if (!m.def.fly && !m.def.swim && World.mode === 'overworld') {
        const ahead = World.height(nx, nz), here = World.height(m.x, m.z);
        if (Math.abs(ahead - here) > 4.5) continue;
      }
      if (!this.move(m, vx * sp * dt, vz * sp * dt)) continue;
      m.yaw = angLerp(m.yaw, Math.atan2(vx, vz), 1 - Math.pow(0.0000005, dt));
      return true;
    }
    return false;
  },

  /* Two-deflection pathfinding for walkers: try straight, then ±40°,
     take the first step that is neither wall, water (for the dry) nor
     cliff. Returns true if anything moved. Heroines keep their smooth
     turn and their teleport fallback; this just stops the face-planting. */
  fanStep(e, ux, uz, sp, dt, swim) {
    const l0 = Math.hypot(ux, uz) || 1;
    ux /= l0; uz /= l0;
    const px = -uz, pz = ux;
    const dirs = [[ux, uz], [ux * 0.77 + px * 0.64, uz * 0.77 + pz * 0.64], [ux * 0.77 - px * 0.64, uz * 0.77 - pz * 0.64]];
    const canSwim = swim != null ? swim : (e.type === 'player' || (e.type === 'heroine' && e.recruited));
    for (const [dx, dz] of dirs) {
      const l = Math.hypot(dx, dz) || 1;
      const vx = dx / l, vz = dz / l;
      if (World.mode === 'overworld' && !canSwim) {
        const nx = e.x + vx * 2, nz = e.z + vz * 2;
        if (World.height(nx, nz) < SEA + 0.4) continue;
        const ahead = World.height(nx, nz), here = World.height(e.x, e.z);
        if (Math.abs(ahead - here) > 4.5) continue;
      }
      if (this.move(e, vx * sp * dt, vz * sp * dt)) return true;
    }
    return false;
  },

  /* Body collision for the walking cast: soft separation so townsfolk,
     heroines and mobs stop standing inside each other (and you). The
     player is immovable — crowds part around them instead. Vehicles
     re-pose their riders right after, so they are skipped here. */
  separate() {
    const p = this.player;
    if (!p) return;
    const skipVehicle = p.aboard || p.riding || p.ferry || p.dragon;
    const agents = [p];
    for (const n of this.npcs) {
      if (n.downT > 0) continue;
      if (Math.abs(n.x - p.x) > 70 || Math.abs(n.z - p.z) > 70) continue;
      agents.push(n);
    }
    for (const m of this.mobs) {
      if (m.dead) continue;
      if (Math.abs(m.x - p.x) > 70 || Math.abs(m.z - p.z) > 70) continue;
      agents.push(m);
    }
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const ar = a.radius || 0.55;
      for (let j = i + 1; j < agents.length; j++) {
        const b = agents[j];
        if (skipVehicle && (a === p || b === p)) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const rr = (ar + (b.radius || 0.55)) * 0.9;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (rr - d) / 2;
        const ux = dx / d, uz = dz / d;
        if (a === p) { b.x += ux * push * 2; b.z += uz * push * 2; }
        else if (b === p) { a.x -= ux * push * 2; a.z -= uz * push * 2; }
        else { a.x -= ux * push; a.z -= uz * push; b.x += ux * push; b.z += uz * push; }
      }
    }
    for (let i = 1; i < agents.length; i++) {
      const a = agents[i];
      if (a.ch && a.ch.root) { a.ch.root.position.x = a.x; a.ch.root.position.z = a.z; }
      else if (a.model && a.model.root) { a.model.root.position.x = a.x; a.model.root.position.z = a.z; }
    }
  },

  updateMob(m, dt) {
    if (m.dead) return;
    m.cd = Math.max(0, m.cd - dt);
    m.hurtT = Math.max(0, m.hurtT - dt);
    const p = this.player;
    // lingering spell effects: burn ticks, slow fades
    if (m.burnT > 0) {
      m.burnT -= dt; m.burnAcc = (m.burnAcc || 0) + dt;
      if (m.burnAcc >= 1) { m.burnAcc = 0; this.damageMob(m, m.burnD || 5, 'You'); if (m.dead) return; }
    }
    if (m.slowT > 0) m.slowT -= dt;
    // regenerating horrors knit themselves shut when not pressed
    if (m.def.regen && m.hp < m.maxhp && m.state !== 'chase') {
      m.hp = Math.min(m.maxhp, m.hp + m.def.regen * dt);
    }
    const SPD = m.def.spd * (m.slowT > 0 ? 0.45 : 1);

    // wild animals never fight — they graze, and flee what walks close
    if (m.def.passive) {
      const pd = dist2D(m.x, m.z, p.x, p.z);
      if (pd < 12) {
        const ux = (m.x - p.x) / (pd || 1), uz = (m.z - p.z) / (pd || 1);
        m.moveAmt = this.mobStep(m, ux, uz, m.def.spd * 1.2, dt) ? 1 : 0;
      } else {
        m.wait -= dt;
        if (m.wait <= 0) {
          const a = Math.random() * TAU, r = 3 + Math.random() * 8;
          m.tx = m.homeX + Math.cos(a) * r; m.tz = m.homeZ + Math.sin(a) * r;
          m.state = 'walk'; m.wait = 3 + Math.random() * 3;
        }
        if (m.state === 'walk') {
          const dd = dist2D(m.x, m.z, m.tx, m.tz);
          if (dd < 1) { m.state = 'idle'; m.moveAmt = 0; }
          else {
            const ux = (m.tx - m.x) / dd, uz = (m.tz - m.z) / dd;
            m.moveAmt = this.mobStep(m, ux, uz, m.def.spd * 0.3, dt) ? 0.3 : 0;
            if (!m.moveAmt) m.state = 'idle';
          }
        } else m.moveAmt = damp(m.moveAmt, 0, 1e-6, dt);
      }
    // bosses slam the ground every few seconds — everyone close suffers.
    // pacifists skip the slam: the crab is furniture that breathes.
    if (m.def.boss && (m.atk != null ? m.atk : m.def.atk) > 0) {
      m.aoeT = (m.aoeT == null ? 3 : m.aoeT) - dt;
      if (m.aoeT <= 0) {
        m.aoeT = 4.5;
        this.ring(m.x, m.y, m.z, 0xff5a6a, 8);
        this.burst(m.x, m.y + 1, m.z, m.def.color, 22);
        Sound.sfx('hit');
        Camera3.kick(0.2);
        if (dist2D(m.x, m.z, p.x, p.z) < 9) this.hitTarget(p, (m.atk || m.def.atk) + 3, m);
        for (const h of this.companions) {
          if (h.downT > 0) continue;
          if (dist2D(m.x, m.z, h.x, h.z) < 9) this.hitTarget(h, (m.atk || m.def.atk) + 3, m);
        }
      }
    }

    const gy = this.groundY(m.x, m.z, m);
      m.y = damp(m.y, gy, 1e-8, dt);
      if (m.def.swim && World.mode === 'overworld' && gy < SEA - 0.6) m.y = SEA - 0.5;
      m.model.root.userData.baseY = m.y;
      m.model.root.position.set(m.x, m.y, m.z);
      m.model.root.rotation.y = m.yaw;
      m.model.update(dt, m.moveAmt);
      return;
    }
    const d = dist2D(m.x, m.z, p.x, p.z);

    // aggro: player first, then whichever companion is closest
    let foe = null, fd = 1e9;
    if (d < 34) { foe = p; fd = d; }
    for (const h of this.companions) {
      if (h.downT > 0) continue;
      const hd = dist2D(m.x, m.z, h.x, h.z);
      if (hd < 26 && hd < fd) { foe = h; fd = hd; }
    }
    if (foe) m.state = 'chase';
    else if (m.state === 'chase') m.state = 'return';
    // land teeth can't reach swimmers, sailors or dragonriders — ranged and flyers don't care
    if (m.state === 'chase' && foe && (foe.swimming || foe.aboard || foe.dragon) && !m.def.ranged && !m.def.fly) m.state = 'return';

    // apex hunger: bored terrors detour toward grazing prey and mend on it
    if (m.def.boss && !foe && World.mode === 'overworld' && (m.state === 'idle' || m.state === 'walk')) {
      let prey = null, pd = 34;
      for (const o of this.mobs) {
        if (o === m || o.dead || !o.def.passive) continue;
        const dd = dist2D(m.x, m.z, o.x, o.z);
        if (dd < pd) { pd = dd; prey = o; }
      }
      if (prey) {
        if (pd < 2.2 + prey.def.r) {
          prey.dead = true; prey.eaten = true;
          m.hp = Math.min(m.maxhp, m.hp + m.maxhp * 0.08);
          this.burst(prey.x, prey.y + 1, prey.z, 0x8a6a4a, 10);
          m.wait = 2; m.state = 'idle'; m.moveAmt = 0;
        } else {
          m.tx = prey.x; m.tz = prey.z; m.state = 'walk';
          m.wait = Math.max(m.wait, 1.5);
        }
      }
    }

    if (m.state === 'chase' && foe) {
      const reach = m.def.ranged ? 22 : 2.2 + m.def.r;
      if (fd > reach) {
        const ux = (foe.x - m.x) / fd, uz = (foe.z - m.z) / fd;
        const moved = this.mobStep(m, ux, uz, SPD, dt);
        m.moveAmt = moved ? 1 : 0;
        // walled off: hold ground and face teeth, never strafe-slide
        if (!moved) m.yaw = angLerp(m.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.0000005, dt));
      } else {
        m.moveAmt = 0;
        if (m.cd <= 0) {
          m.cd = m.def.ranged ? 2.2 : 1.35;
          if (m.def.ranged) {
            this.bolt(m.x, m.y + m.def.r * 1.8, m.z, foe.x, foe.y + 1.2, foe.z, 0xff8a4a);
            const _atk = m.atk || m.def.atk;
            setTimeout(() => this.hitTarget(foe, _atk, m), 340);
          } else this.hitTarget(foe, m.atk || m.def.atk, m);
        }
      }
    } else if (m.state === 'return') {
      const hd = dist2D(m.x, m.z, m.homeX, m.homeZ);
      if (hd < 2) { m.state = 'idle'; m.wait = 1; m.moveAmt = 0; }
      else {
        const ux = (m.homeX - m.x) / hd, uz = (m.homeZ - m.z) / hd;
        const moved = this.mobStep(m, ux, uz, SPD * 0.7, dt);
        m.moveAmt = moved ? 0.7 : 0;
        if (!moved) m.state = 'idle';
      }
    } else {
      m.wait -= dt;
      if (m.wait <= 0) {
        const a = Math.random() * TAU, r = 4 + Math.random() * 12;
        m.tx = m.homeX + Math.cos(a) * r; m.tz = m.homeZ + Math.sin(a) * r;
        m.state = 'walk'; m.wait = 4 + Math.random() * 4;
      }
      if (m.state === 'walk') {
        const dd = dist2D(m.x, m.z, m.tx, m.tz);
        if (dd < 1) { m.state = 'idle'; m.wait = 2 + Math.random() * 3; m.moveAmt = 0; }
        else {
          const ux = (m.tx - m.x) / dd, uz = (m.tz - m.z) / dd;
          const moved = this.mobStep(m, ux, uz, SPD * 0.45, dt);
          m.moveAmt = moved ? 0.45 : 0;
          if (!moved) m.state = 'idle';
        }
      }
    }

    const gy = this.groundY(m.x, m.z, m);
    m.y = damp(m.y, gy, 1e-8, dt);
    // sea-born ride near the surface instead of trudging the seabed
    if (m.def.swim && World.mode === 'overworld' && gy < SEA - 0.6) m.y = SEA - 0.5;
    m.model.root.userData.baseY = m.y;
    m.model.root.position.set(m.x, m.def.fly ? m.y : m.y, m.z);
    m.model.root.rotation.y = m.yaw;
    m.model.update(dt, m.moveAmt);
    if (m.hurtT > 0) m.model.root.position.x += Math.sin(m.hurtT * 60) * 0.06;
  },

  hitTarget(t, amount, from) {
    if (!t) return;
    // pacifists (the Trial Crab) hit for NOTHING — no number, no shake
    if (from && from.type === 'mob' && (from.atk != null ? from.atk : (from.def ? from.def.atk : 1)) <= 0) return;
    // wild things hit softer than their numbers suggest — gangs still hurt
    if (from && from.type === 'mob') amount = Math.max(1, Math.round(amount * 0.75));
    if (t.type === 'player') Game.hurtPlayer(amount, from);
    else {
      t.hp -= amount;
      this.popup(t.x, t.y + 2.2, t.z, '-' + amount, 0xff9aa8);
      if (t.hp <= 0) {
        t.hp = 0; t.downT = 12;
        UI.toast(`${t.def.name.split(' ')[0]} is down. She will be back.`, 'warn');
        Sound.sfx('bad');
      }
    }
  },

  /* Dungeon bosses: summoned when you go down, dismissed when you leave. */
  spawnDungeonBoss(d) {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      if (this.mobs[i].dungeonId) {
        this.scene.remove(this.mobs[i].model.root);
        this.disposeModel(this.mobs[i].model.root);
        this.mobs.splice(i, 1);
      }
    }
    if (!d.def.boss || d.bossDead) return null;
    const m = this.spawnMob(d.def.boss, d.chamber.x, d.chamber.z);
    m.dungeonId = d.def.id;
    return m;
  },
  purgeDungeonMobs() {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      if (this.mobs[i].dungeonId) {
        this.scene.remove(this.mobs[i].model.root);
        this.disposeModel(this.mobs[i].model.root);
        this.mobs.splice(i, 1);
      }
    }
  },

  /* Mend the most hurt ally near the healer — including dragging downed
     heroines back to their feet faster. Returns true if anyone needed it. */
  healAlly(h, amount) {
    const p = this.player;
    const near = e => dist2D(h.x, h.z, e.x, e.z) < 26;
    const hhas = s => h.skills && h.skills.includes(s);
    amount = amount + heroGearBonus(h).heal;   // her token mends harder
    // downed heroines first: each mend burns recovery (Lantern Rite: 10 s)
    let worst = null;
    for (const c of this.companions) {
      if (c === h || c.downT <= 0 || !near(c)) continue;
      if (!worst || c.downT > worst.downT) worst = c;
    }
    if (worst) {
      worst.downT = Math.max(0, worst.downT - (hhas('Lantern Rite') ? 10 : 6));
      h.focus = Math.max(0, (h.focus || 0) - 10);
      this.bolt(h.x, h.y + 1.3, h.z, worst.x, worst.y + 1, worst.z, 0x7fd0a0);
      this.popup(worst.x, worst.y + 2.2, worst.z, '+mend', 0x7fd0a0);
      Sound.sfx('good');
      if (worst.downT <= 0) {
        worst.hp = worst.maxhp * 0.6;
        UI.toast(`${worst.def.name.split(' ')[0]} is back on her feet.`);
      }
      return true;
    }
    let best = null, bf = 1;
    const consider = e => {
      const f = e.hp / e.maxhp;
      // near-full counts: nobody gets left at 99% for being polite
      if (f < bf && f < 0.999 && near(e)) { bf = f; best = e; }
    };
    consider(p);
    for (const c of this.companions) { if (c.downT <= 0) consider(c); }
    consider(h);
    if (!best) return false;
    best.hp = Math.min(best.maxhp, best.hp + amount);
    h.focus = Math.max(0, (h.focus || 0) - 10);
    this.bolt(h.x, h.y + 1.3, h.z, best.x, best.y + 1, best.z, 0x7fd0a0);
    this.popup(best.x, best.y + 2.4, best.z, '+' + amount, 0x7fd0a0);
    // Panacea overflows: the second-most-hurt ally drinks half as well
    if (hhas('Panacea')) {
      let second = null, sf = 1;
      const consider2 = e => {
        if (e === best) return;
        const f = e.hp / e.maxhp;
        if (f < sf && f < 0.97 && near(e)) { sf = f; second = e; }
      };
      consider2(p);
      for (const c of this.companions) { if (c.downT <= 0) consider2(c); }
      consider2(h);
      if (second) {
        const half = Math.round(amount / 2);
        second.hp = Math.min(second.maxhp, second.hp + half);
        this.popup(second.x, second.y + 2.4, second.z, '+' + half, 0x7fd0a0);
      }
    }
    Sound.sfx('good');
    return true;
  },

  nearestMob(x, z, r) {
    let best = null, bd = r;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const d = dist2D(x, z, m.x, m.z);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  },
  nearestTalkable(x, z, r) {
    let best = null, bd = r || 3.6;
    for (const n of this.npcs) {
      if (n.downT > 0) continue;
      const d = dist2D(x, z, n.x, n.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  },

  damageMob(m, dmg, source, crit) {
    if (m.dead) return;
    m.hp -= dmg;
    m.hurtT = 0.2;
    m.state = 'chase';
    if (typeof UI !== 'undefined' && UI.dmgHit) UI.dmgHit(source, dmg, !!crit, !!m.def.boss);
    this.popup(m.x, m.y + m.def.r * 2.4, m.z, String(Math.round(dmg)), source === 'You' ? 0xfff0b0 : 0xffd0e0);
    Sound.sfx('hit');
    if (m.hp <= 0) {
      m.dead = true;
      this.burst(m.x, m.y + m.def.r, m.z, m.def.color, 18);
      // a fallen terror's lair restocks in five minutes
      if (m.worldBoss) {
        const L = this.worldBosses.find(w => w.key === m.key);
        if (L) L.timer = L.respawn || 300;
      }
      // commanding credit: the player gets full XP for ordered kills (onKill),
      // and whoever struck the blow grows a little closer for fighting together.
      // Training by doing: the killer also drills 40% of the mark's worth
      // into her own level — steel and spells both sharpen on real work.
      if (source !== 'You') {
        for (const k in (this.heroineOf || {})) {
          const h = this.heroineOf[k];
          if (h.recruited && h.def.name.split(' ')[0] === source) {
            Game.addAff(h.def.id, 1);
            this.heroineGainXp(h, Math.round(m.def.xp * 0.4));
            // Skyshatter: two different heroines marking one flyer inside
            // 4 s shatters its rhythm — bonus, grounding slow, fanfare
            if (m.def.fly && !m.dead) {
              const now = performance.now() / 1000;
              m.skyMarks = m.skyMarks || {};
              m.skyMarks[h.def.id] = now;
              const fresh = Object.keys(m.skyMarks).filter(id => now - m.skyMarks[id] < 4);
              if (fresh.length >= 2 && !m.skyBroke) {
                m.skyBroke = true;
                setTimeout(() => { m.skyBroke = false; }, 12000);
                this.ring(m.x, m.y, m.z, 0xbfe0ff, 6);
                this.burst(m.x, m.y + 1.5, m.z, 0xbfe0ff, 18);
                this.damageMob(m, Math.round(m.maxhp * 0.04 + 30), 'Skyshatter');
                m.slowT = 4;
                UI.toast('Skyshatter formation!', 'good');
                Sound.sfx('seal');
              }
            }
            break;
          }
        }
      }
      Game.onKill(m);
      setTimeout(() => { this.scene.remove(m.model.root); this.disposeModel(m.model.root); }, 30);
    }
  },

  /* Free GPU geometry for a removed model. Materials stay: mat() shares
     them from a cache, so disposing one would blank the whole world. */
  disposeModel(root) {
    if (!root) return;
    root.traverse(o => {
      if (o.isMesh && o.geometry && o.geometry.dispose) o.geometry.dispose();
    });
  },

  /* ---------------- effects ---------------- */
  popup(x, y, z, text, color) {
    // word-wrap so long speech never overflows the canvas half-cut
    const fs = 40, maxW = 430, lineH = 50, pad = 22;
    const words = String(text).split(' ');
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = `700 ${fs}px system-ui, sans-serif`;
    const lines = [];
    let cur = '';
    for (const w of words) {
      // split absurdly long single words so they can't blow the line
      let word = w;
      while (meas.measureText(word).width > maxW) {
        let k = 1;
        while (k < word.length && meas.measureText(word.slice(0, k)).width < maxW) k++;
        lines.push(word.slice(0, k - 1) || word.slice(0, 1));
        word = word.slice(k - 1);
        cur = '';
      }
      const t = cur ? cur + ' ' + word : word;
      if (meas.measureText(t).width > maxW && cur) { lines.push(cur); cur = word; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    if (lines.length > 4) { lines.length = 4; lines[3] += '…'; }
    let wid = 1;
    for (const ln of lines) wid = Math.max(wid, meas.measureText(ln).width);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(wid + pad * 2); cv.height = Math.ceil(lines.length * lineH + pad * 2);
    const g = cv.getContext('2d');
    g.font = `700 ${fs}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)';
    g.fillStyle = '#' + color.toString(16).padStart(6, '0');
    lines.forEach((ln, i) => {
      const ly = pad + fs + i * lineH;
      g.strokeText(ln, cv.width / 2, ly);
      g.fillText(ln, cv.width / 2, ly);
    });
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    // keep text a constant on-screen size: taller bubbles for more lines
    const hWorld = 0.62 + (lines.length - 1) * 0.5;
    const wWorld = Math.min(7, hWorld * (cv.width / cv.height));
    sp.scale.set(wWorld, hWorld, 1);
    sp.position.set(x, y + (hWorld - 0.62) * 0.5, z);
    this.scene.add(sp);
    this.effects.push({
      obj: sp, t: 0, life: lines.length > 1 ? 2.2 : 1.1,
      tick: (t) => { sp.position.y = y + (hWorld - 0.62) * 0.5 + t * 1.1; sp.material.opacity = 1 - t / (lines.length > 1 ? 2.2 : 1.1); }
    });
  },

  burst(x, y, z, color, n) {
    const g = new THREE.Group();
    const m = mat(color, { rough: 0.4, emissive: color, ei: 0.5 });
    const bits = [];
    for (let i = 0; i < (n || 12); i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), m);
      b.position.set(x, y, z);
      g.add(b);
      bits.push({ mesh: b, vx: (Math.random() - 0.5) * 7, vy: Math.random() * 6 + 1.5, vz: (Math.random() - 0.5) * 7 });
    }
    this.scene.add(g);
    this.effects.push({
      obj: g, t: 0, life: 0.9,
      tick: (t, dt) => {
        for (const b of bits) {
          b.vy -= 16 * dt;
          b.mesh.position.x += b.vx * dt; b.mesh.position.y += b.vy * dt; b.mesh.position.z += b.vz * dt;
          b.mesh.rotation.x += dt * 6; b.mesh.rotation.y += dt * 4;
          b.mesh.scale.setScalar(Math.max(0.01, 1 - t / 0.9));
        }
      }
    });
  },

  bolt(x1, y1, z1, x2, y2, z2, color) {
    const s = sph(0.28, mat(color, { rough: 0.1, emissive: color, ei: 2.2 }), 10, 8);
    s.position.set(x1, y1, z1);
    this.scene.add(s);
    const light = new THREE.PointLight(color, 1.6, 14);
    s.add(light);
    this.effects.push({
      obj: s, t: 0, life: 0.34,
      tick: t => {
        const k = clamp(t / 0.34, 0, 1);
        s.position.set(lerp(x1, x2, k), lerp(y1, y2, k), lerp(z1, z2, k));
        s.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.5);
      }
    });
  },

  ring(x, y, z, color, r) {
    const geo = new THREE.RingGeometry(r * 0.2, r, 28);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.12, z);
    this.scene.add(m);
    this.effects.push({
      obj: m, t: 0, life: 0.55,
      tick: t => { const k = t / 0.55; m.scale.setScalar(0.4 + k * 1.6); m.material.opacity = 0.7 * (1 - k); }
    });
  },

  /* Signature magic circles: rotating runic rings, distinct per caster.
     All materials are per-effect (the cleanup pass frees them). */
  magicCircle(x, y, z, style) {
    style = style || {};
    const color = style.color != null ? style.color : 0xbfe0ff;
    const R = style.r || 2.2;
    const life = style.life || 0.9;
    const spin = style.spin || 1.6;
    const g = new THREE.Group();
    const spinners = [];
    const mats = [];
    const mg = op => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, fog: false });
      mats.push({ m, base: op });
      return m;
    };
    const nR = style.rings || 2;
    for (let k = 0; k < nR; k++) {
      const rr = R * (1 - k * 0.22);
      const ring = new THREE.Mesh(new THREE.RingGeometry(rr * 0.92, rr, 40), mg(0.75));
      g.add(ring);
      spinners.push({ o: ring, sp: spin * (k % 2 ? -1.4 : 1), ph: k * 1.3 });
    }
    if (style.runes) {
      const n = style.runes === true ? 12 : style.runes;
      const ticks = new THREE.Group();
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.09, R * 0.16, 0.02), mg(0.85));
        tick.position.set(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78, 0);
        tick.rotation.z = a + Math.PI / 2;
        ticks.add(tick);
      }
      g.add(ticks);
      spinners.push({ o: ticks, sp: -spin * 0.8, ph: 0 });
    }
    if (style.star === 'diamond') {
      const dia = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.9, R * 0.9), mg(0.35));
      dia.rotation.z = Math.PI / 4;
      g.add(dia);
      spinners.push({ o: dia, sp: spin * 0.5, ph: Math.PI / 4 });
    } else if (style.star === 'cross') {
      for (const rz of [0, Math.PI / 2]) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.1, R * 0.22), mg(0.4));
        bar.rotation.z = rz;
        g.add(bar);
        spinners.push({ o: bar, sp: spin * 0.5, ph: rz });
      }
    } else if (style.star === 'tri') {
      const tri = new THREE.Mesh(new THREE.CircleGeometry(R * 0.55, 3), mg(0.3));
      g.add(tri);
      spinners.push({ o: tri, sp: -spin * 0.7, ph: 0 });
    }
    g.position.set(x, y + 0.12, z);
    g.rotation.x = -Math.PI / 2;
    this.scene.add(g);
    this.effects.push({
      obj: g, t: 0, life,
      tick: t => {
        const k = clamp(t / life, 0, 1);
        for (const s2 of spinners) s2.o.rotation.z = s2.ph + t * s2.sp;
        g.scale.setScalar(0.6 + k * 0.7);
        for (const o of mats) o.m.opacity = o.base * (1 - k);
      }
    });
  }
};

/* ---------------- third/first-person camera (P toggles POV) ---------------- */
const Camera3 = {
  cam: null, yaw: 0, pitch: 0.28, dist: 7.4, target: new THREE.Vector3(),
  shake: 0, mode: 'third',

  init(cam) {
    this.cam = cam;
    this.mode = (typeof Settings !== 'undefined' && Settings.view) || 'third';
  },

  togglePov() {
    this.mode = this.mode === 'third' ? 'first' : 'third';
    if (typeof Settings !== 'undefined') {
      Settings.view = this.mode;
      try { if (typeof saveSettings === 'function') saveSettings(); } catch {}
    }
    // hide your own body in first person so it never clips the lens
    try {
      const p = Entities.player;
      if (p && p.ch && p.ch.root) p.ch.root.visible = this.mode !== 'first';
    } catch {}
    if (typeof UI !== 'undefined') UI.toast(this.mode === 'first' ? 'First-person view. (P to go back)' : 'Third-person view.');
    if (typeof Sound !== 'undefined') Sound.sfx('ui');
  },

  update(dt, p) {
    if (Input.context === 'play' && Input.mouse.locked) {
      this.yaw -= Input.mouse.dx * 0.0026 * Settings.sens;
      // third-person orbits the camera; first-person moves the gaze, so the
      // vertical sign flips (mouse up = look up, like every FPS)
      const dy = Input.mouse.dy * 0.0022 * Settings.sens;
      this.pitch = clamp(this.pitch + (this.mode === 'first' ? -dy : dy), -0.35, 1.05);
    }
    if (Input.context === 'play' && this.mode !== 'first') this.dist = clamp(this.dist + Input.mouse.wheel * 0.006, 2.6, 15);
    // indoors the lens stays close or it ends up behind the walls
    if (typeof World !== 'undefined' && World.mode === 'building') this.dist = Math.min(this.dist, 5.0);

    // FIRST PERSON: eyes where the head is, looking along yaw/pitch.
    if (this.mode === 'first') {
      const ex = p.x, ey = p.y + 1.62, ez = p.z;
      this.target.set(ex, ey, ez);
      const cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
      // note: forward on the ground is (sin yaw, cos yaw); pitch lifts the gaze
      const lx = ex + Math.sin(this.yaw) * cp * 10;
      const ly = ey + sp2 * 10;
      const lz = ez + Math.cos(this.yaw) * cp * 10;
      this.shake = Math.max(0, this.shake - dt * 2.6);
      const s = this.shake;
      this.cam.position.set(ex, ey, ez);
      this.cam.lookAt(lx + (Math.random() - 0.5) * s, ly + (Math.random() - 0.5) * s, lz + (Math.random() - 0.5) * s);
      try { if (p.ch && p.ch.root && p.ch.root.visible) p.ch.root.visible = false; } catch {}
      return;
    }
    try { if (p.ch && p.ch.root && !p.ch.root.visible) p.ch.root.visible = true; } catch {}

    const head = p.y + 1.55;
    this.target.set(
      damp(this.target.x, p.x, 1e-6, dt),
      damp(this.target.y, head, 1e-5, dt),
      damp(this.target.z, p.z, 1e-6, dt)
    );

    const cd = Math.cos(this.pitch) * this.dist;
    let cx = this.target.x - Math.sin(this.yaw) * cd;
    let cz = this.target.z - Math.cos(this.yaw) * cd;
    let cy = this.target.y + Math.sin(this.pitch) * this.dist + 0.6;

    // keep the camera above ground so it never buries itself in a hill —
    // and indoors (keep or shop room), pinned between floor and ceiling
    if (World.mode === 'interior') {
      const fy = p.floorY != null ? p.floorY : 0;
      if (cy < fy + 1.4) cy = fy + 1.4;
      if (cy > fy + 7.2) cy = fy + 7.2;
    } else if (World.mode === 'building') {
      const fy = BINT.y;
      if (cy < fy + 1.4) cy = fy + 1.4;
      if (cy > fy + 6.4) cy = fy + 6.4;
    } else if (World.mode === 'overworld') {
      const g = World.height(cx, cz) + 1.4;
      if (cy < g) cy = g;
    } else cy = Math.max(cy, -798.5);

    this.shake = Math.max(0, this.shake - dt * 2.6);
    const s = this.shake;
    this.cam.position.set(
      cx + (Math.random() - 0.5) * s,
      cy + (Math.random() - 0.5) * s,
      cz + (Math.random() - 0.5) * s
    );
    this.cam.lookAt(this.target);
  },

  kick(a) { this.shake = Math.min(0.5, this.shake + a); }
};
