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
  },

  groundY(x, z, e) {
    if (World.mode === 'dungeon') return -800;
    // inside the keep everyone stands on their own floor
    if (World.mode === 'interior') {
      if (e && e.floorY != null) return e.floorY;
      const I = World.interior;
      return I ? I.floors[I.cur].y : 0;
    }
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
    if (Math.abs(x) > EXTENT || Math.abs(z) > EXTENT) return true;
    // open water is swimmable for the player and recruited companions;
    // everyone and everything else stays dry
    if (World.height(x, z) < SEA + 0.4 && !swim) return true;         // no swimming in Arc One
    return !!World.blocked(x, z, r);
  },

  /* Axis-separated slide, same idea as the 2D build but in XZ. */
  move(e, dx, dz) {
    const r = e.radius || 0.6;
    const swim = e.type === 'player' || (e.type === 'heroine' && e.recruited);
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
      ['greyhollow', 'lullwater'], ['chapel', 'greyhollow']
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
        const ok = this.move(n, ux * 2.4 * dt, uz * 2.4 * dt);
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
      const ok = this.move(n, ux * 5.2 * dt, uz * 5.2 * dt);
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
      hp: 120, maxhp: 120, focus: 60, maxfocus: 60, downT: 0, atkCd: 0, target: null, mark: null
    };
    this.heroineOf = this.heroineOf || {};
    this.heroineOf[def.id] = e;
    this.npcs.push(e);
    return e;
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
    if (!spot) { UI.toast('Open water — sail closer to shore to land.'); Sound.sfx('bad'); return; }
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
      const target = a.z < -0.01 ? 14 : a.z > 0.01 ? -3 : 0;
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
    if (!dest || World.mode !== 'overworld' || p.aboard || p.riding || this.caravan) return false;
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
      for (const h of u.horses) this.scene.remove(h.root);
      this.scene.remove(u.driver.root);
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
    const model = buildMob(def);
    this.scene.add(model.root);
    const y = this.groundY(x, z);
    model.root.position.set(x, y, z);
    model.root.userData.baseY = y;
    const m = {
      type: 'mob', key, def, model, name: def.name,
      x, z, y, yaw: 0, radius: def.r * 0.8,
      hp: def.hp, maxhp: def.hp, homeX: x, homeZ: z,
      state: 'idle', wait: Math.random() * 3, tx: x, tz: z,
      moveAmt: 0, cd: 0, target: null, dead: false, hurtT: 0
    };
    this.mobs.push(m);
    return m;
  },

  /* Roaming terrors: fixed lairs in the deep wilds, announced, respawning. */
  worldBosses: [
    { key: 'magmawyrm', x: 2358, z: 2173, timer: 5 },
    { key: 'frostmaw', x: -100, z: 2200, timer: 10 },
    { key: 'briarancient', x: -4000, z: -2500, timer: 15 },
    { key: 'drownedchoir', x: -400, z: -3600, timer: 20 }
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
        L.timer = 300;
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
    // despawn stragglers
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const d = dist2D(m.x, m.z, p.x, p.z);
      if (m.dead || d > 420) {
        this.scene.remove(m.model.root);
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
    if (h < 2) return;
    const site = SITES.find(s => dist2D(x, z, s.x, s.z) < s.r + 70);
    if (site) return;
    const b = World.biome(x, z, h);
    const pool = Object.keys(MOBS).filter(k => MOBS[k].biome === b && !MOBS[k].boss && !MOBS[k].passive);
    if (!pool.length) return;
    this.spawnMob(pool[(Math.random() * pool.length) | 0], x, z);
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
    const p = this.player;
    for (const n of this.npcs) {
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
      if (fx.t >= fx.life) { this.scene.remove(fx.obj); this.effects.splice(i, 1); }
    }
    this.updateShip(dt);
    this.updateCaravan(dt);
  },

  updatePlayer(dt) {
    const p = this.player;
    p.atkCd = Math.max(0, p.atkCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    if (p.actionT > 0) { p.actionT -= dt; if (p.actionT <= 0) p.action = null; }

    let ax = 0, az = 0, wantRun = false;
    if (Input.context === 'play' && !p.aboard && !p.riding) {
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
    if (Input.consume('jump') && !p.aboard && !p.riding) {
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
    p.swimming = !p.aboard && !p.riding && World.mode === 'overworld' && (depth > 0.9 || (p.manualSwim && depth > 0.2));
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

    // out-of-combat recovery — wounds only close while Rurika travels with you
    const threat = this.mobs.some(m => !m.dead && m.state === 'chase' && dist2D(m.x, m.z, p.x, p.z) < 40);
    p.calm = threat ? 0 : p.calm + dt;
    if (p.calm > 3.5) {
      const rurika = this.heroineOf && this.heroineOf.rurika;
      if (rurika && rurika.recruited) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.05 * dt);
      p.focus = Math.min(p.maxfocus, p.focus + 7 * dt);
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
        const ok = this.move(n, ux * n.speed * dt, uz * n.speed * dt);
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
    h.focus = Math.min(h.maxfocus, (h.focus == null ? h.maxfocus : h.focus) + 6 * dt);
    if (h.downT > 0) {
      h.downT -= dt;
      h.moveAmt = 0;
      h.ch.update(dt, 0, 'down');
      h.ch.root.position.set(h.x, this.groundY(h.x, h.z, h), h.z);
      if (h.downT <= 0) { h.hp = h.maxhp * 0.6; UI.toast(`${h.def.name.split(' ')[0]} is back on her feet.`); }
      return;
    }
    // seated aboard ship or wagon: posed by the vehicle, not the crowd sim
    if (this.player.aboard || this.player.riding) return;
    if (!h.recruited) { this.updateNpc(h, dt); return; }

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
    // healers mend on their own whenever someone nearby is hurt
    if (HK.heal && h.atkCd <= 0) {
      if (this.healAlly(h, HK.heal)) h.atkCd = HK.cd;
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
    if (cmd === 'follow' && dist2D(h.x, h.z, p.x, p.z) > 90) { h.x = p.x - 2; h.z = p.z - 2; }

    const d = dist2D(h.x, h.z, tx, tz);
    if (d > want) {
      const ux = (tx - h.x) / d, uz = (tz - h.z) / d;
      const sp = h.speed * (d > 14 ? 1.5 : 1);
      const ok = this.move(h, ux * sp * dt, uz * sp * dt);
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

    h.y = damp(h.y, this.groundY(h.x, h.z, h), 1e-8, dt);
    if (h.sky != null && h.y <= World.height(h.x, h.z) + 2) h.sky = null;
    // recruited companions swim with you, floating at the surface
    h.swimming = World.mode === 'overworld' && (SEA - this.groundY(h.x, h.z, h) > 0.9);
    if (h.swimming) h.y = damp(h.y, Math.max(this.groundY(h.x, h.z, h) + 0.4, SEA + 0.25), 1e-4, dt);
    h.ch.root.position.set(h.x, h.y, h.z);
    h.ch.root.rotation.y = h.yaw;
    const HK2 = heroKind(h);
    h.ch.update(dt, h.moveAmt, h.atkCd > 0.4 ? ((HK2.bolt || HK2.heal) ? 'cast' : 'attack') : null);
  },

  heroineStrike(h) {
    const K = heroKind(h);
    const t = h.target;
    if (!t || t.dead) return;
    if (K.heal) return;   // healers mend on their own clock, never strike
    const cost = K.bolt ? 6 : 0;
    if ((h.focus || 0) < cost) { h.atkCd = 0.4; return; }
    h.focus -= cost;
    const first = h.def.name.split(' ')[0];
    const dmg = K.dmg + Game.level * K.perLvl + Game.bondLevel(h.def.id) * 2;
    h.atkCd = K.cd;
    if (K.aoe) {
      // greatsword: everything around the impact eats it
      this.ring(t.x, t.y, t.z, 0xffd0a0, K.aoe);
      this.burst(t.x, t.y + 1, t.z, 0xffd0a0, 10);
      for (const m of [...this.mobs]) {
        if (!m.dead && dist2D(m.x, m.z, t.x, t.z) < K.aoe + m.def.r) this.damageMob(m, dmg, first);
      }
      Sound.sfx('hit');
    } else {
      this.damageMob(t, dmg, first);
    }
    if (K.bolt) {
      this.bolt(h.x, h.y + 1.3, h.z, t.x, t.y + 1, t.z, K.bolt);
      Sound.sfx('magic');
    }
    if (K.ward) {
      // Liora shields her love while she fights
      const p = this.player;
      p.hp = Math.min(p.maxhp, p.hp + K.ward);
      this.popup(p.x, p.y + 2.4, p.z, '+' + K.ward, 0x7fd0a0);
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
    const SPD = m.def.spd * (m.slowT > 0 ? 0.45 : 1);

    // wild animals never fight — they graze, and flee what walks close
    if (m.def.passive) {
      const pd = dist2D(m.x, m.z, p.x, p.z);
      if (pd < 12) {
        const ux = (m.x - p.x) / (pd || 1), uz = (m.z - p.z) / (pd || 1);
        this.move(m, ux * m.def.spd * 1.2 * dt, uz * m.def.spd * 1.2 * dt);
        m.moveAmt = 1;
        m.yaw = angLerp(m.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.002, dt));
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
            this.move(m, ux * m.def.spd * 0.3 * dt, uz * m.def.spd * 0.3 * dt);
            m.moveAmt = 0.3;
            m.yaw = angLerp(m.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.01, dt));
          }
        } else m.moveAmt = damp(m.moveAmt, 0, 1e-6, dt);
      }
    // bosses slam the ground every few seconds — everyone close suffers
    if (m.def.boss) {
      m.aoeT = (m.aoeT == null ? 3 : m.aoeT) - dt;
      if (m.aoeT <= 0) {
        m.aoeT = 4.5;
        this.ring(m.x, m.y, m.z, 0xff5a6a, 8);
        this.burst(m.x, m.y + 1, m.z, m.def.color, 22);
        Sound.sfx('hit');
        Camera3.kick(0.2);
        if (dist2D(m.x, m.z, p.x, p.z) < 9) this.hitTarget(p, m.def.atk + 3, m);
        for (const h of this.companions) {
          if (h.downT > 0) continue;
          if (dist2D(m.x, m.z, h.x, h.z) < 9) this.hitTarget(h, m.def.atk + 3, m);
        }
      }
    }

    const gy = this.groundY(m.x, m.z, m);
      m.y = damp(m.y, gy, 1e-8, dt);
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
    // land teeth can't reach swimmers or sailors — ranged and flyers don't care
    if (m.state === 'chase' && foe && (foe.swimming || foe.aboard) && !m.def.ranged && !m.def.fly) m.state = 'return';

    if (m.state === 'chase' && foe) {
      const reach = m.def.ranged ? 22 : 2.2 + m.def.r;
      if (fd > reach) {
        const ux = (foe.x - m.x) / fd, uz = (foe.z - m.z) / fd;
        const ok = this.move(m, ux * SPD * dt, uz * SPD * dt);
        m.moveAmt = ok ? 1 : 0;
        m.yaw = angLerp(m.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.002, dt));
        m.stuck = ok ? 0 : (m.stuck || 0) + dt;
        if (m.stuck > 1.2) { this.move(m, -uz * SPD * dt * 1.6, ux * SPD * dt * 1.6); }
      } else {
        m.moveAmt = 0;
        if (m.cd <= 0) {
          m.cd = m.def.ranged ? 2.2 : 1.35;
          if (m.def.ranged) {
            this.bolt(m.x, m.y + m.def.r * 1.8, m.z, foe.x, foe.y + 1.2, foe.z, 0xff8a4a);
            setTimeout(() => this.hitTarget(foe, m.def.atk, m), 340);
          } else this.hitTarget(foe, m.def.atk, m);
        }
      }
    } else if (m.state === 'return') {
      const hd = dist2D(m.x, m.z, m.homeX, m.homeZ);
      if (hd < 2) { m.state = 'idle'; m.wait = 1; m.moveAmt = 0; }
      else {
        const ux = (m.homeX - m.x) / hd, uz = (m.homeZ - m.z) / hd;
        const ok = this.move(m, ux * SPD * 0.7 * dt, uz * SPD * 0.7 * dt);
        m.moveAmt = ok ? 0.7 : 0;
        m.yaw = angLerp(m.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.004, dt));
        if (!ok) m.state = 'idle';
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
          const ok = this.move(m, ux * SPD * 0.45 * dt, uz * SPD * 0.45 * dt);
          m.moveAmt = ok ? 0.45 : 0;
          m.yaw = angLerp(m.yaw, Math.atan2(ux, uz), 1 - Math.pow(0.01, dt));
          if (!ok) m.state = 'idle';
        }
      }
    }

    const gy = this.groundY(m.x, m.z, m);
    m.y = damp(m.y, gy, 1e-8, dt);
    m.model.root.userData.baseY = m.y;
    m.model.root.position.set(m.x, m.def.fly ? m.y : m.y, m.z);
    m.model.root.rotation.y = m.yaw;
    m.model.update(dt, m.moveAmt);
    if (m.hurtT > 0) m.model.root.position.x += Math.sin(m.hurtT * 60) * 0.06;
  },

  hitTarget(t, amount, from) {
    if (!t) return;
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
      if (this.mobs[i].dungeonId) { this.scene.remove(this.mobs[i].model.root); this.mobs.splice(i, 1); }
    }
    if (!d.def.boss || d.bossDead) return null;
    const m = this.spawnMob(d.def.boss, d.chamber.x, d.chamber.z);
    m.dungeonId = d.def.id;
    return m;
  },
  purgeDungeonMobs() {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      if (this.mobs[i].dungeonId) { this.scene.remove(this.mobs[i].model.root); this.mobs.splice(i, 1); }
    }
  },

  /* Mend the most hurt ally near the healer — including dragging downed
     heroines back to their feet faster. Returns true if anyone needed it. */
  healAlly(h, amount) {
    const p = this.player;
    const near = e => dist2D(h.x, h.z, e.x, e.z) < 26;
    // downed heroines first: each mend burns 6 s off their recovery
    let worst = null;
    for (const c of this.companions) {
      if (c === h || c.downT <= 0 || !near(c)) continue;
      if (!worst || c.downT > worst.downT) worst = c;
    }
    if (worst) {
      worst.downT = Math.max(0, worst.downT - 6);
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
      if (f < bf && f < 0.97 && near(e)) { bf = f; best = e; }
    };
    consider(p);
    for (const c of this.companions) { if (c.downT <= 0) consider(c); }
    consider(h);
    if (!best) return false;
    best.hp = Math.min(best.maxhp, best.hp + amount);
    h.focus = Math.max(0, (h.focus || 0) - 10);
    this.bolt(h.x, h.y + 1.3, h.z, best.x, best.y + 1, best.z, 0x7fd0a0);
    this.popup(best.x, best.y + 2.4, best.z, '+' + amount, 0x7fd0a0);
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

  damageMob(m, dmg, source) {
    if (m.dead) return;
    m.hp -= dmg;
    m.hurtT = 0.2;
    m.state = 'chase';
    this.popup(m.x, m.y + m.def.r * 2.4, m.z, String(Math.round(dmg)), source === 'You' ? 0xfff0b0 : 0xffd0e0);
    Sound.sfx('hit');
    if (m.hp <= 0) {
      m.dead = true;
      this.burst(m.x, m.y + m.def.r, m.z, m.def.color, 18);
      // a fallen terror's lair restocks in five minutes
      if (m.worldBoss) {
        const L = this.worldBosses.find(w => w.key === m.key);
        if (L) L.timer = 300;
      }
      // commanding credit: the player gets full XP for ordered kills (onKill),
      // and whoever struck the blow grows a little closer for fighting together
      if (source !== 'You') {
        for (const k in (this.heroineOf || {})) {
          const h = this.heroineOf[k];
          if (h.recruited && h.def.name.split(' ')[0] === source) {
            Game.addAff(h.def.id, 1);
            break;
          }
        }
      }
      Game.onKill(m);
      setTimeout(() => { this.scene.remove(m.model.root); }, 30);
    }
  },

  /* ---------------- effects ---------------- */
  popup(x, y, z, text, color) {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    const g = cv.getContext('2d');
    g.font = '700 42px system-ui, sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)';
    g.strokeText(text, 64, 46);
    g.fillStyle = '#' + color.toString(16).padStart(6, '0');
    g.fillText(text, 64, 46);
    const tex = new THREE.CanvasTexture(cv);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.scale.set(1.6, 0.8, 1);
    sp.position.set(x, y, z);
    this.scene.add(sp);
    this.effects.push({
      obj: sp, t: 0, life: 1.1,
      tick: (t) => { sp.position.y = y + t * 1.4; sp.material.opacity = 1 - t / 1.1; }
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
  }
};

/* ---------------- third-person camera ---------------- */
const Camera3 = {
  cam: null, yaw: 0, pitch: 0.28, dist: 7.4, target: new THREE.Vector3(),
  shake: 0, mode: 'third',

  init(cam) { this.cam = cam; },

  update(dt, p) {
    if (Input.context === 'play' && Input.mouse.locked) {
      this.yaw -= Input.mouse.dx * 0.0026 * Settings.sens;
      this.pitch = clamp(this.pitch + Input.mouse.dy * 0.0022 * Settings.sens, -0.35, 1.05);
    }
    if (Input.context === 'play') this.dist = clamp(this.dist + Input.mouse.wheel * 0.006, 2.6, 15);

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
    // and inside the keep, pinned between floor and ceiling
    if (World.mode === 'interior') {
      const fy = p.floorY != null ? p.floorY : 0;
      if (cy < fy + 1.4) cy = fy + 1.4;
      if (cy > fy + 7.2) cy = fy + 7.2;
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
