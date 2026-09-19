/* ROYAL REINCARNATION 3D — world.js
   A 12 km x 12 km heightfield streamed as 200-unit chunks.

   Crossing it corner to corner on foot is roughly thirty minutes at walking
   pace, about seventeen at a run — the numbers are in Entities.SPEED and the
   extent constant below, so they stay honest if either is changed. */
'use strict';

const EXTENT = 6000;          // half-width of the playable world, in metres
const CHUNK = 200, CHUNK_SEG = 20, VIEW_CHUNKS = 4;
const SEA = 0;

/* Keep interior: local half-extents, wall height, floor spacing. */
const INT = { x: 20000, z: 20000, dh: 12, hw: 32, hd: 23, wallH: 8 };

const World = {
  scene: null, group: null, dungeonGroup: null,
  noise: null, rng: null, seed: 424242,
  chunks: new Map(), colliders: new Map(), interactables: [],
  mode: 'overworld', dungeon: null, builtDungeons: {},
  water: null, sky: null, sun: null, hemi: null,
  _volc: { x: 3100, z: 2400, r: 1500 },

  /* ---------------- height and biome ---------------- */
  height(x, z) {
    const n = this.noise;
    const c = n.fbm(x * 0.000165, z * 0.000165, 4);
    const hills = n.fbm(x * 0.0016, z * 0.0016, 4);
    const detail = n.fbm(x * 0.0085, z * 0.0085, 3);

    let h = (c - 0.44) * 420 + (hills - 0.5) * 46 + (detail - 0.5) * 9;

    // mountain spine: ridged noise, only where the continent is already high
    const mask = clamp((c - 0.52) / 0.24, 0, 1);
    const ridge = n.ridge(x * 0.00052, z * 0.00052, 4);
    h += Math.pow(ridge, 2.2) * 330 * mask;

    // Emberfall caldera: a cone with a bitten-out crater
    const v = this._volc;
    const dv = Math.hypot(x - v.x, z - v.z);
    if (dv < v.r) {
      const t = 1 - dv / v.r;
      h += Math.pow(t, 1.7) * 380;
      if (dv < 240) h -= (1 - dv / 240) * 300;    // crater
    }

    // settlements sit on level ground
    for (let i = 0; i < SITES.length; i++) {
      const s = SITES[i];
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < s.r * 2.1) {
        if (s.base == null) s.base = null;         // resolved lazily below
        const target = this._siteBase(s);
        const t = 1 - clamp((d - s.r * 0.75) / (s.r * 1.35), 0, 1);
        h = lerp(h, target, t * t * (3 - 2 * t));
      }
    }
    return h;
  },

  _siteBase(s) {
    if (s._base != null) return s._base;
    // sample the raw field around the site, ignoring flattening, and pick a floor
    const n = this.noise;
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const x = s.x + Math.cos(a) * s.r * 2.4, z = s.z + Math.sin(a) * s.r * 2.4;
      const c = n.fbm(x * 0.000165, z * 0.000165, 4);
      sum += (c - 0.44) * 420;
    }
    s._base = Math.max(6, sum / 8 + 4);
    return s._base;
  },

  biome(x, z, h) {
    const v = this._volc;
    if (Math.hypot(x - v.x, z - v.z) < v.r * 0.72) return 'volcano';
    if (h < 2.5) return 'shore';
    if (h > 210) return 'snow';
    if (h > 118) return 'mountain';
    const moist = this.noise.fbm(x * 0.00042 + 90, z * 0.00042 + 90, 4);
    if (moist > 0.545) return 'forest';
    if (moist < 0.36 && h < 40) return 'marsh';
    return 'meadow';
  },

  /* ---------------- scene setup ---------------- */
  init(scene) {
    this.scene = scene;
    this.noise = makeNoise(this.seed);
    this.rng = makeRng(this.seed);
    this.group = new THREE.Group(); scene.add(this.group);
    this.dungeonGroup = new THREE.Group(); this.dungeonGroup.visible = false; scene.add(this.dungeonGroup);
    this.interiorGroup = new THREE.Group(); this.interiorGroup.visible = false; scene.add(this.interiorGroup);

    scene.background = new THREE.Color(0x9fb0c4);
    scene.fog = new THREE.Fog(0x9fb0c4, 260, 900);

    this.hemi = new THREE.HemisphereLight(0xcfe0f2, 0x3c4030, 0.72);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0dc, 1.15);
    this.sun.position.set(180, 320, 120);
    this.sun.castShadow = Settings.shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    const c = this.sun.shadow.camera;
    c.left = -90; c.right = 90; c.top = 90; c.bottom = -90; c.near = 1; c.far = 700;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // sky dome
    const skyGeo = new THREE.SphereGeometry(1400, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x8fa6c0, side: THREE.BackSide, fog: false });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(this.sky);

    // stars, one sun, two moons (procedural canvas textures — no files)
    this.dayT = 0.32;   // morning; full cycle is 600 s (see tick)
    this._dayF = 1;
    this._buildSkyBodies(scene);

    // ocean
    const wg = new THREE.PlaneGeometry(EXTENT * 3, EXTENT * 3, 1, 1);
    const wm = new THREE.MeshStandardMaterial({ color: 0x2c5875, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.92 });
    this.water = new THREE.Mesh(wg, wm);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = SEA;
    this.water.receiveShadow = false;
    scene.add(this.water);

    this._shared();
    this.buildSites();
    this.buildDungeonMouths();
    this.buildWaystones();
    this.buildDrift();
    this.buildTownFurniture();
    this.buildWeather();
  },

  _shared() {
    this._dirtCol = new THREE.Color(0x8a7355);
    // resolve trade routes to endpoints once — queried per terrain vertex
    this._routes = (typeof ROUTES !== 'undefined' ? ROUTES : [])
      .map(([a, b]) => [SITES.find(s => s.id === a), SITES.find(s => s.id === b)])
      .filter(([A, B]) => A && B);
    this.geo = {
      trunk: new THREE.CylinderGeometry(0.22, 0.42, 1, 6),
      cone: new THREE.ConeGeometry(1, 1, 7),
      blob: new THREE.SphereGeometry(1, 7, 6),
      rock: new THREE.DodecahedronGeometry(1, 0),
      grass: new THREE.ConeGeometry(0.16, 1.1, 4)
    };
    this.matx = {
      trunk: mat(0x3f3228, { rough: 0.96, map: 'wood' }),
      leafForest: mat(0x2a4a2e, { rough: 0.92, flat: true, map: 'leaf' }),
      leafMeadow: mat(0x3b6032, { rough: 0.92, flat: true, map: 'leaf' }),
      leafSnow: mat(0xd6e0ec, { rough: 0.9, flat: true, map: 'leaf' }),
      leafVolc: mat(0x38261c, { rough: 0.95, flat: true, map: 'leaf' }),
      leafMarsh: mat(0x3d4832, { rough: 0.93, flat: true, map: 'leaf' }),
      rock: mat(0x7a767e, { rough: 0.98, flat: true, map: 'stone' }),
      grass: mat(0x54783f, { rough: 0.95, flat: true })
    };
  },

  routeDist(x, z) {
    let best = 1e9;
    for (const [A, B] of this._routes) {
      const dx = B.x - A.x, dz = B.z - A.z;
      const t = clamp(((x - A.x) * dx + (z - A.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const d = Math.hypot(x - (A.x + dx * t), z - (A.z + dz * t));
      if (d < best) best = d;
    }
    return best;
  },
  leafMat(b) {
    return b === 'forest' ? this.matx.leafForest : b === 'snow' || b === 'mountain' ? this.matx.leafSnow
         : b === 'volcano' ? this.matx.leafVolc : b === 'marsh' ? this.matx.leafMarsh : this.matx.leafMeadow;
  },

  /* ---------------- collision grid ---------------- */
  addCollider(x, z, r, tag) {
    const key = ((x / 50) | 0) + ':' + ((z / 50) | 0);
    let b = this.colliders.get(key);
    if (!b) { b = []; this.colliders.set(key, b); }
    b.push({ x, z, r, tag });
  },
  blocked(x, z, selfR) {
    const cx = (x / 50) | 0, cz = (z / 50) | 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const b = this.colliders.get((cx + i) + ':' + (cz + j));
      if (!b) continue;
      for (let k = 0; k < b.length; k++) {
        const c = b[k];
        const rr = c.r + selfR;
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz < rr * rr) return c;
      }
    }
    return null;
  },

  /* ---------------- chunk streaming ---------------- */
  chunkKey(cx, cz) { return cx + ',' + cz; },

  queue: [],
  BUDGET: 2,          // chunks built per frame — keeps the walk hitch-free

  update(px, pz, immediate) {
    if (this.mode !== 'overworld') return;
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    for (let dz = -VIEW_CHUNKS; dz <= VIEW_CHUNKS; dz++) {
      for (let dx = -VIEW_CHUNKS; dx <= VIEW_CHUNKS; dx++) {
        if (dx * dx + dz * dz > (VIEW_CHUNKS + 0.5) * (VIEW_CHUNKS + 0.5)) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const k = this.chunkKey(cx, cz);
        if (this.chunks.has(k) || this.queue.some(q => q.k === k)) continue;
        this.queue.push({ k, cx, cz, d: dx * dx + dz * dz });
      }
    }
    // nearest first, so the ground under your feet always exists
    this.queue.sort((a, b) => a.d - b.d);
    const budget = immediate ? this.queue.length : this.BUDGET;
    for (let i = 0; i < budget && this.queue.length; i++) {
      const q = this.queue.shift();
      if (!this.chunks.has(q.k)) this.chunks.set(q.k, this.buildChunk(q.cx, q.cz));
    }
    // retire distant chunks so memory stays flat on a 12 km walk
    for (const [k, ch] of this.chunks) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx - pcx) > VIEW_CHUNKS + 1 || Math.abs(cz - pcz) > VIEW_CHUNKS + 1) {
        this.group.remove(ch.root);
        this.queue = this.queue.filter(q => q.k !== k);
        ch.root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.dispose && o.userData.own) o.geometry.dispose(); });
        this.chunks.delete(k);
      }
    }
  },

  buildChunk(cx, cz) {
    const root = new THREE.Group();
    const ox = cx * CHUNK, oz = cz * CHUNK;
    const g = new THREE.PlaneGeometry(CHUNK, CHUNK, CHUNK_SEG, CHUNK_SEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + ox + CHUNK / 2, z = pos.getZ(i) + oz + CHUNK / 2;
      const h = this.height(x, z);
      pos.setY(i, h);
      const b = this.biome(x, z, h);
      const B = BIOMES[b];
      const t = this.noise.n2(x * 0.06, z * 0.06);
      col.setHex(t > 0.5 ? B.ground2 : B.ground);
      // trade roads: packed dirt where the routes run (dry land only)
      if (h > 2) {
        const rd = this.routeDist(x, z);
        if (rd < 7) col.lerp(this._dirtCol, (1 - rd / 7) * 0.65);
      }
      // snow line and shoreline blends keep biome borders from looking cut
      if (h > 190 && b !== 'snow') col.lerp(new THREE.Color(0xdde6f0), clamp((h - 190) / 40, 0, 1) * 0.7);
      if (h < 4 && h > -2) col.lerp(new THREE.Color(0xc6b68c), clamp((4 - h) / 6, 0, 1));
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: tex('ground') }));
    m.position.set(ox + CHUNK / 2, 0, oz + CHUNK / 2);
    m.receiveShadow = true;
    m.userData.own = true;
    root.add(m);

    this._scatter(root, ox, oz, cx, cz);
    this.group.add(root);
    return { root };
  },

  _scatter(root, ox, oz, cx, cz) {
    const rng = makeRng((cx * 73856093 ^ cz * 19349663 ^ this.seed) >>> 0);
    const cxm = ox + CHUNK / 2, czm = oz + CHUNK / 2;
    const biome = this.biome(cxm, czm, this.height(cxm, czm));
    const density = { forest: 30, meadow: 7, snow: 12, mountain: 6, volcano: 5, marsh: 9, shore: 2 }[biome] || 6;

    // near a settlement, leave room for streets
    const nearSite = SITES.find(s => Math.hypot(cxm - s.x, czm - s.z) < s.r + 90);

    const trunks = [], cones = [], rocks = [], grasses = [];
    for (let i = 0; i < density; i++) {
      const x = ox + rng() * CHUNK, z = oz + rng() * CHUNK;
      if (nearSite && Math.hypot(x - nearSite.x, z - nearSite.z) < nearSite.r + 16) continue;
      const h = this.height(x, z);
      if (h < 1.5) continue;
      if (h > 2 && this.routeDist(x, z) < 9) continue;   // roads stay clear
      const slope = Math.abs(this.height(x + 4, z) - h) + Math.abs(this.height(x, z + 4) - h);
      if (slope > 7) continue;
      const th = 6 + rng() * 7;
      trunks.push({ x, y: h, z, th });
      const cn = biome === 'forest' || biome === 'snow' || biome === 'mountain' ? 4 : 3;
      for (let k = 0; k < cn; k++) {
        cones.push({
          x, z, y: h + th * (0.5 + k * 0.17),
          r: (biome === 'meadow' || biome === 'marsh' ? 2.4 : 3.2) - k * 0.6,
          hgt: biome === 'meadow' ? 3.0 : 3.6, ry: rng() * TAU
        });
      }
      this.addCollider(x, z, 1.1, 'tree');
    }
    const rockN = { mountain: 9, volcano: 8, snow: 5, shore: 3 }[biome] || 2;
    for (let i = 0; i < rockN; i++) {
      const x = ox + rng() * CHUNK, z = oz + rng() * CHUNK;
      if (nearSite && Math.hypot(x - nearSite.x, z - nearSite.z) < nearSite.r + 16) continue;
      const h = this.height(x, z);
      if (h < 1) continue;
      const r = 0.9 + rng() * 2.4;
      rocks.push({ x, y: h + r * 0.4, z, r, rx: rng() * 3, ry: rng() * 3 });
      if (r > 1.6) this.addCollider(x, z, r * 0.8, 'rock');
    }
    if (biome === 'meadow' || biome === 'forest' || biome === 'marsh') {
      for (let i = 0; i < 46; i++) {
        const x = ox + rng() * CHUNK, z = oz + rng() * CHUNK;
        const h = this.height(x, z);
        if (h < 1.5) continue;
        grasses.push({ x, y: h, z, s: 0.7 + rng() * 0.9, ry: rng() * TAU });
      }
    }

    const dummy = new THREE.Object3D();
    const inst = (geo, material, list, apply) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, material, list.length);
      im.castShadow = true;
      for (let i = 0; i < list.length; i++) { apply(dummy, list[i]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }
      im.instanceMatrix.needsUpdate = true;
      // instances spread across the whole chunk, so the base geometry bounds
      // are meaningless — culling by them pops trees when looked at directly
      im.frustumCulled = false;
      root.add(im);
    };
    inst(this.geo.trunk, this.matx.trunk, trunks, (d, t) => {
      d.position.set(t.x, t.y + t.th / 2, t.z); d.scale.set(1, t.th, 1); d.rotation.set(0, 0, 0);
    });
    inst(this.geo.cone, this.leafMat(biome), cones, (d, c) => {
      d.position.set(c.x, c.y, c.z); d.scale.set(c.r, c.hgt, c.r); d.rotation.set(0, c.ry, 0);
    });
    inst(this.geo.rock, this.matx.rock, rocks, (d, r) => {
      d.position.set(r.x, r.y, r.z); d.scale.setScalar(r.r); d.rotation.set(r.rx, r.ry, 0);
    });
    inst(this.geo.grass, this.matx.grass, grasses, (d, g2) => {
      d.position.set(g2.x, g2.y + 0.5, g2.z); d.scale.set(g2.s, g2.s, g2.s); d.rotation.set(0, g2.ry, 0);
    });
  },

  /* ---------------- settlements ---------------- */
  buildSites() {
    for (const s of SITES) {
      const g = new THREE.Group();
      const base = this._siteBase(s);
      g.position.set(s.x, 0, s.z);
      const rng = makeRng((s.x * 7919 + s.z * 104729) >>> 0);

      // plaza — kept small so the courtyard reads as stone, not a white void
      const plaza = new THREE.Mesh(new THREE.CircleGeometry(s.r * 0.30, 34),
        mat(0x8d8880, { rough: 0.95 }));
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.y = base + 0.06;
      plaza.receiveShadow = true;
      g.add(plaza);
      // darker trim ring so the plaza edge blends into grass instead of glowing
      const trim = new THREE.Mesh(new THREE.RingGeometry(s.r * 0.30, s.r * 0.335, 40),
        mat(0x6f6a62, { rough: 0.95 }));
      trim.rotation.x = -Math.PI / 2;
      trim.position.y = base + 0.07;
      trim.receiveShadow = true;
      g.add(trim);

      if (s.kind === 'castle') this._castle(g, s, base, rng);
      else this._town(g, s, base, rng);
      if (s.id === 'chapel') this._dressChapel(g, s, base);
      if (s.id === 'crossroads') this._dressMarket(g, s, base, rng);
      this._signpost(g, s, base);

      this.group.add(g);
      s.group = g;
      s.baseY = base;
    }
  },

  /* Cult chapel dressing: obsidian altar, braziers, violet banners. */
  _dressChapel(g, s, base) {
    const obs = mat(0x17121f, { rough: 0.6 });
    const altar = box(3.2, 1.4, 1.6, obs);
    altar.position.set(0, base + 0.7, 0);
    g.add(altar);
    for (const [bx, bz] of [[-6, -4], [6, -4], [-6, 5], [6, 5], [0, -9]]) {
      const post = cyl(0.3, 0.4, 2.6, obs, 8);
      post.position.set(bx, base + 1.3, bz);
      g.add(post);
      const fl = sph(0.5, mat(0xb46ae8, { rough: 0.2, emissive: 0x7a2fd0, ei: 2.2 }), 10, 8);
      fl.position.set(bx, base + 2.9, bz);
      g.add(fl);
      this.addCollider(s.x + bx, s.z + bz, 1.0, 'brazier');
    }
    const l = new THREE.PointLight(0x9a5fe8, 1.4, 30, 2);
    l.position.set(0, base + 4, 0);
    g.add(l);
    for (const sx of [-1, 1]) {
      const ban = box(1.8, 4.2, 0.12, mat(0x2a1542, { rough: 0.9 }));
      ban.position.set(sx * 5, base + 4.4, -8);
      g.add(ban);
    }
    this.addCollider(s.x, s.z, 2.2, 'altar');
  },

  /* Market dressing: stalls with awnings, crates, faction banners. */
  _dressMarket(g, s, base, rng) {
    const cols = [0x8e0f22, 0x2f6bc0, 0xc9a44e, 0x3b6032, 0x8e0f22];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.4;
      const x = Math.cos(a) * s.r * 0.30, z = Math.sin(a) * s.r * 0.30;
      const table = box(2.6, 1.0, 1.4, WOOD());
      table.position.set(x, base + 0.5, z);
      table.rotation.y = -a;
      g.add(table);
      const awn = box(3.2, 0.12, 2.2, mat(cols[i], { rough: 0.85, side: THREE.DoubleSide }));
      awn.position.set(x, base + 2.6, z);
      awn.rotation.y = -a; awn.rotation.z = 0.12;
      g.add(awn);
      for (const px of [-1.3, 1.3]) {
        const pole = cyl(0.07, 0.07, 2.6, WOOD(), 6);
        pole.position.set(x + Math.cos(-a) * px, base + 1.4, z - Math.sin(-a) * px);
        g.add(pole);
      }
      for (let k = 0; k < 3; k++) {
        const crate = box(0.7, 0.7, 0.7, WOOD());
        crate.position.set(x + (rng() - 0.5) * 4, base + 0.35, z + (rng() - 0.5) * 4);
        crate.rotation.y = rng() * 3;
        g.add(crate);
      }
      this.addCollider(s.x + x, s.z + z, 2.2, 'stall');
    }
  },

  /* Signpost at the plaza edge; reading it lists the roads (see Game). */
  _signpost(g, s, base) {
    const post = box(0.3, 3.4, 0.3, WOOD());
    post.position.set(10, base + 1.7, s.r * 0.34);
    g.add(post);
    for (const [dy, ry] of [[2.8, 0.5], [2.1, -0.4]]) {
      const arm = box(2.4, 0.35, 0.12, WOOD());
      arm.position.set(10, base + dy, s.r * 0.34);
      arm.rotation.y = ry;
      g.add(arm);
    }
    s.sign = { x: s.x + 10, z: s.z + s.r * 0.34 };
  },

  /* Town furniture for the working world: guild writ boards, wagon posts,
     parked wagons. Called for castle, rosegate, greyhollow, crossroads. */
  buildTownFurniture() {
    for (const id of ['castle', 'rosegate', 'greyhollow', 'crossroads']) {
      const s = SITES.find(x => x.id === id);
      if (!s) continue;
      const base = s.baseY != null ? s.baseY : this._siteBase(s);
      // guild writ board
      const bx = s.x - s.r * 0.22, bz = s.z - s.r * 0.18;
      const b1 = box(0.25, 3.0, 0.25, WOOD()); b1.position.set(bx - 1.4, base + 1.5, bz); this.group.add(b1);
      const b2 = box(0.25, 3.0, 0.25, WOOD()); b2.position.set(bx + 1.4, base + 1.5, bz); this.group.add(b2);
      const panel = box(3.4, 2.0, 0.15, mat(0x4a3b28, { rough: 0.9 }));
      panel.position.set(bx, base + 2.2, bz); panel.rotation.y = 0.3;
      this.group.add(panel);
      for (let i = 0; i < 3; i++) {
        const writ = box(0.5, 0.7, 0.05, mat(0xd8d0bc, { rough: 0.9 }));
        writ.position.set(bx - 0.9 + i * 0.9, base + 2.2, bz + 0.12);
        writ.rotation.y = 0.3;
        this.group.add(writ);
      }
      s.board = { x: bx, z: bz };
      // wagon hire post with a wheel leaning on it
      const wx = s.x + s.r * 0.24, wz = s.z - s.r * 0.2;
      const post = box(0.3, 3.0, 0.3, WOOD());
      post.position.set(wx, base + 1.5, wz);
      this.group.add(post);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 8, 18), WOOD());
      wheel.position.set(wx + 0.9, base + 0.8, wz);
      this.group.add(wheel);
      s.wagon = { x: wx, z: wz };
      this.addCollider(bx, bz, 1.6, 'board');
      this.addCollider(wx, wz, 1.2, 'wagonpost');
    }
    // parked wagons: the yard at Crossroads, one at the castle, one at Rosegate
    const parked = [
      ['crossroads', -20, 18, 'merchant'], ['crossroads', -26, 10, 'farm'],
      ['castle', 40, 60, 'war'], ['rosegate', 30, -30, 'farm']
    ];
    for (const [id, ox, oz, kind] of parked) {
      const s = SITES.find(x => x.id === id);
      if (!s) continue;
      const sp = this.findOpenSpot(s.x + ox, s.z + oz, 2.2);
      const w = buildWagon(kind);
      w.root.position.set(sp.x, World.height(sp.x, sp.z) + 0.2, sp.z);
      w.root.rotation.y = (sp.x * 3 + sp.z) % 3;
      this.group.add(w.root);
      const hm = buildHorse(0x4a3626);
      hm.root.position.set(sp.x + 4, World.height(sp.x + 4, sp.z) + 0, sp.z);
      this.group.add(hm.root);
      this.addCollider(sp.x, sp.z, 3.0, 'wagon');
    }
  },

  /* Waystones: older than the wards, kinder. Touch to travel. */
  buildWaystones() {
    for (const id of ['castle', 'rosegate', 'greyhollow', 'lullwater']) {
      const s = SITES.find(x => x.id === id);
      if (!s) continue;
      const a = Math.atan2(-s.z, -s.x);
      const x = s.x + Math.cos(a) * s.r * 0.72, z = s.z + Math.sin(a) * s.r * 0.72;
      const base = this._siteBase(s);
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const sa = (i / 5) * TAU;
        const st = box(1.0, 3.0 + (i % 2), 0.8, STONE_D());
        st.position.set(x + Math.cos(sa) * 4 - s.x, 0, z + Math.sin(sa) * 4 - s.z);
        st.position.y = base + 1.4;
        st.rotation.y = sa;
        st.rotation.z = (i % 2 ? -1 : 1) * 0.06;
        // group is at site origin; children local
        g.add(st);
      }
      const glow = new THREE.Mesh(new THREE.CircleGeometry(3.2, 26),
        new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x - s.x, base + 0.12, z - s.z);
      g.add(glow);
      g.position.set(s.x, 0, s.z);
      this.group.add(g);
      s.stone = { x, z };
    }
  },

  /* The Drift: broken islands hung over Whisperwood. Look, don't touch. */
  buildDrift() {
    this.drift = [];
    this.skyIsles = [];
    const rng = makeRng(777);
    const spots = [[-1980, 760, 175], [-1720, 1050, 215], [-1860, 480, 250]];
    for (const [x, z, y] of spots) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const R = 16 + rng() * 10;
      const rock = cone(R, R * 1.6, mat(0x5a5460, { rough: 0.95, flat: true }), 9);
      rock.rotation.x = Math.PI;
      rock.position.y = -R * 0.8;
      g.add(rock);
      const cap = cyl(R, R * 0.96, 3, mat(0x3b6032, { rough: 0.95, flat: true }), 12);
      cap.position.y = 1.2;
      g.add(cap);
      for (let i = 0; i < 3; i++) {
        const t = buildTree(rng, 'forest');
        t.position.set((rng() - 0.5) * R, 2.5, (rng() - 0.5) * R);
        t.scale.setScalar(0.8);
        g.add(t);
      }
      for (const sx of [-1, 1]) {
        const post = box(1.2, 7, 1.2, STONE_D());
        post.position.set(sx * 5, 6, -4);
        g.add(post);
      }
      const lintel = box(12, 1.4, 1.6, STONE_D());
      lintel.position.set(0, 10, -4);
      g.add(lintel);
      for (let i = 0; i < 3; i++) {   // hanging chains
        const ch = cyl(0.12, 0.12, 55, mat(0x2a2630, { rough: 0.6 }), 6);
        ch.position.set((rng() - 0.5) * R * 1.2, -R - 20, (rng() - 0.5) * R * 1.2);
        g.add(ch);
      }
      g.traverse(o => { if (o.isMesh) o.castShadow = false; });
      this.group.add(g);
      this.drift.push({ g, baseY: y, phase: rng() * TAU });
      this.skyIsles.push({ x, z, r: R * 0.92, topY: y + 2.7 });
    }
    // base sky-gate at Whisperwood + return pads (riding their isles) + sky chest
    const w = SITES.find(s => s.id === 'whisper');
    if (w) {
      const gx = w.x + 40, gz = w.z + 20;
      const gy = this.height(gx, gz);
      const gate = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.6, 26),
        new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      gate.rotation.x = -Math.PI / 2;
      gate.position.set(gx, gy + 0.3, gz);
      this.group.add(gate);
      for (const s of [-1, 1]) {
        const post = box(0.8, 4.5, 0.8, STONE_D());
        post.position.set(gx + s * 3.4, gy + 2.2, gz);
        this.group.add(post);
      }
      this.skyGate = { x: gx, z: gz };
      this.drift.forEach(D => {
        const pad = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.6, 22),
          new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(0, 2.85, 0);
        D.g.add(pad);
      });
      const chest = box(1.4, 0.9, 0.9, mat(0xc9a44e, { rough: 0.4, metal: 0.6 }));
      chest.position.set(5, 3.15, 0);
      this.drift[2].g.add(chest);
      const CI = this.skyIsles[2];
      this.skyChest = { x: CI.x + 5, z: CI.z };
    }
  },

  /* Tavern terrace: tables, benches and lanterns before the door. */
  _terrace(g, s, base, hx, hz, radius) {
    const l = Math.hypot(hx, hz) || 1;
    const dx = -hx / l, dz = -hz / l;   // toward the plaza
    const cx = hx + dx * (radius + 7), cz = hz + dz * (radius + 7);
    for (const [ox, oz] of [[-2.5, 0], [2.5, 1.5]]) {
      const tx = cx + ox, tz = cz + oz;
      const top = box(2.4, 0.22, 1.4, WOOD());
      top.position.set(tx, base + 1.0, tz);
      g.add(top);
      for (const [lx, lz] of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]]) {
        const leg = box(0.18, 1.0, 0.18, WOOD());
        leg.position.set(tx + lx, base + 0.5, tz + lz);
        g.add(leg);
      }
      const bench = box(2.4, 0.4, 0.5, WOOD());
      bench.position.set(tx, base + 0.2, tz + 1.3);
      g.add(bench);
      this.addCollider(s.x + tx, s.z + tz, 1.8, 'table');
    }
    for (const [ox, oz] of [[-4.5, -2.5], [4.5, -2.5]]) {
      const pole = box(0.16, 3.6, 0.16, WOOD());
      pole.position.set(cx + ox, base + 1.8, cz + oz);
      g.add(pole);
      const lamp = sph(0.4, mat(0xffe6b0, { rough: 0.2, emissive: 0xffc870, ei: 1.5 }), 10, 8);
      lamp.position.set(cx + ox, base + 3.8, cz + oz);
      g.add(lamp);
    }
  },

  _town(g, s, base, rng) {
    const kinds = ['house', 'house', 'shop', 'inn', 'guild', 'house', 'smith', 'house'];
    const count = s.kind === 'village' ? 9 : s.kind === 'ruin' ? 3
      : s.kind === 'chapel' ? 6 : s.kind === 'market' ? 12 : 14;
    const placed = [];
    let guard = 0;
    while (placed.length < count && guard++ < 400) {
      const a = rng() * TAU, rr = s.r * (0.52 + rng() * 0.44);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (placed.some(p => Math.hypot(p.x - x, p.z - z) < 14)) continue;
      const kind = placed.length === 0 ? 'guild' : placed.length === 1 ? 'inn'
        : (placed.length === 2 && count > 6) ? 'tavern' : kinds[(rng() * kinds.length) | 0];
      const h = buildHouse(rng, kind);
      h.position.set(x, base, z);
      h.rotation.y = Math.atan2(-x, -z);     // door faces the plaza
      g.add(h);
      placed.push({ x, z });
      this.addCollider(s.x + x, s.z + z, h.userData.radius, 'building');
      if (kind === 'tavern') this._terrace(g, s, base, x, z, h.userData.radius);
    }
    // monument
    const plinth = cyl(3.2, 3.8, 1.6, STONE_D(), 16);
    plinth.position.y = base + 0.8; g.add(plinth);
    const obelisk = cone(1.5, 11, STONE(), 4);
    obelisk.position.y = base + 6.8; obelisk.rotation.y = Math.PI / 4;
    g.add(obelisk);
    this.addCollider(s.x, s.z, 3.6, 'monument');
    // lamps
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const p = cyl(0.12, 0.16, 4.2, mat(0x2a2630, { rough: 0.7 }), 6);
      p.position.set(Math.cos(a) * s.r * 0.42, base + 2.1, Math.sin(a) * s.r * 0.42);
      g.add(p);
      const lantern = sph(0.42, mat(0xffe6b0, { rough: 0.2, emissive: 0xffc870, ei: 1.3 }), 8, 6);
      lantern.position.set(Math.cos(a) * s.r * 0.42, base + 4.5, Math.sin(a) * s.r * 0.42);
      g.add(lantern);
    }
    // wall with a gap facing the world centre
    if (s.kind !== 'ruin' && s.kind !== 'shrine') {
      const facing = Math.atan2(-s.z, -s.x);
      for (let i = 0; i < 56; i++) {
        const a = (i / 56) * TAU;
        let diff = Math.abs(((a - facing + Math.PI) % TAU + TAU) % TAU - Math.PI);
        if (diff < 0.28) continue;
        const seg = box(6.2, 5.2, 1.6, STONE_D());
        seg.position.set(Math.cos(a) * s.r, base + 2.6, Math.sin(a) * s.r);
        seg.rotation.y = -a;
        g.add(seg);
        this.addCollider(s.x + Math.cos(a) * s.r, s.z + Math.sin(a) * s.r, 2.6, 'wall');
      }
    }
  },

  _castle(g, s, base, rng) {
    // keep
    const keep = box(46, 34, 38, STONE());
    keep.position.set(0, base + 17, -30);
    keep.receiveShadow = true;
    g.add(keep);
    this.addCollider(s.x, s.z - 30, 26, 'keep');
    const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(34, 22, 4), ROOF());
    keepRoof.rotation.y = Math.PI / 4;
    keepRoof.position.set(0, base + 45, -30);
    g.add(keepRoof);
    // arched windows on the keep face
    for (let i = 0; i < 5; i++) {
      for (let r2 = 0; r2 < 2; r2++) {
        const w = box(2.4, 5, 0.6, GLASS());
        w.position.set(-16 + i * 8, base + 12 + r2 * 11, -30 + 19.2);
        g.add(w);
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const t = buildTower(46, 6.5);
      t.position.set(sx * 27, base, -30 + sz * 22);
      g.add(t);
      this.addCollider(s.x + sx * 27, s.z - 30 + sz * 22, 7.5, 'tower');
    }
    // curtain wall with a single gate to the south — the story's gate
    const R = s.r;
    for (let i = 0; i < 80; i++) {
      const a = (i / 80) * TAU;
      const inGate = Math.abs(a - Math.PI / 2) < 0.12;
      // hunters' postern, north side: Auverne is always open to you
      const inPostern = Math.abs(a - Math.PI * 1.5) < 0.09;
      if (inGate || inPostern) continue;
      const seg = box(8.5, 9, 2.4, STONE_D());
      seg.position.set(Math.cos(a) * R, base + 4.5, Math.sin(a) * R);
      seg.rotation.y = -a;
      g.add(seg);
      this.addCollider(s.x + Math.cos(a) * R, s.z + Math.sin(a) * R, 3.6, 'wall');
      if (i % 8 === 0) {
        const merl = box(2, 2, 2, STONE_D());
        merl.position.set(Math.cos(a) * R, base + 10, Math.sin(a) * R);
        g.add(merl);
      }
    }
    // gatehouse
    for (const s2 of [-1, 1]) {
      const t = buildTower(20, 4.2);
      t.position.set(s2 * 8, base, R);
      g.add(t);
      this.addCollider(s.x + s2 * 8, s.z + R, 5, 'gatetower');
    }
    const arch = box(20, 3, 4, STONE_D());
    arch.position.set(0, base + 12, R);
    g.add(arch);
    // hunters' postern, north wall: two torches, no ward, always open
    for (const s2 of [-1, 1]) {
      const post = box(1.2, 6.5, 1.2, STONE());
      post.position.set(s2 * 7, base + 3.2, -R);
      g.add(post);
      const torch = sph(0.35, mat(0xffc870, { rough: 0.2, emissive: 0xff9a3c, ei: 1.8 }), 8, 6);
      torch.position.set(s2 * 7, base + 6.8, -R);
      g.add(torch);
      this.addCollider(s.x + s2 * 7, s.z - R, 1.4, 'postern');
    }
    // the ward itself: a shimmering plane that reads your tuning
    const ward = new THREE.Mesh(new THREE.PlaneGeometry(14, 11),
      new THREE.MeshStandardMaterial({
        color: 0x8fc4ff, transparent: true, opacity: 0.30,
        emissive: 0x4a86d8, emissiveIntensity: 0.9, side: THREE.DoubleSide
      }));
    ward.position.set(0, base + 5.5, R);
    g.add(ward);
    s.ward = ward;
    s.gate = { x: s.x, z: s.z + R };

    // inner courtyard buildings
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.15 + rng() * 0.7);
      const rr = R * 0.6;
      const h = buildHouse(rng, i === 0 ? 'guild' : 'house');
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      h.position.set(x, base, z);
      h.rotation.y = Math.atan2(-x, -z);
      g.add(h);
      this.addCollider(s.x + x, s.z + z, h.userData.radius, 'building');
    }
  },

  /* Dungeon mouths: a visible sealed stair for every hidden dungeon.
     The seal-glow only lights once its clue is known. */
  buildDungeonMouths() {
    for (const d of DUNGEONS) {
      const base = this.height(d.x, d.z);
      const g = new THREE.Group();
      g.position.set(d.x, base, d.z);
      for (const s of [-1, 1]) {
        const post = box(1.6, 7, 1.6, STONE_D());
        post.position.set(s * 3.4, 3.5, 0);
        g.add(post);
        this.addCollider(d.x + s * 3.4, d.z, 1.4, 'mouth');
      }
      const lintel = box(8.6, 1.4, 2.0, STONE_D());
      lintel.position.set(0, 7.4, 0);
      g.add(lintel);
      const pit = box(5.2, 0.4, 5.2, mat(0x060408, { rough: 1 }));
      pit.position.set(0, 0.15, 0);
      g.add(pit);
      for (let i = 0; i < 3; i++) {
        const step = box(4.2 - i * 0.9, 0.3, 1.1, STONE_D());
        step.position.set(0, -0.4 - i * 0.55, 1.2 - i * 0.9);
        g.add(step);
      }
      const glow = new THREE.Mesh(new THREE.RingGeometry(4.4, 5.4, 26),
        new THREE.MeshBasicMaterial({ color: 0x8fc4ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.25;
      glow.visible = false;
      g.add(glow);
      this.group.add(g);
      d.marker = glow;
    }
  },

  /* Sun, twin moons, stars — canvas-painted fantasy bodies. */
  _buildSkyBodies(scene) {
    const tex = (size, paint) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      paint(cv.getContext('2d'), size);
      const t = new THREE.CanvasTexture(cv);
      return t;
    };
    const rnd = makeRng(987654);
    // the one sun: white heart, amber flesh, breathing glow
    const sunTex = tex(256, (g, S) => {
      const r = S / 2;
      let gr = g.createRadialGradient(r, r, r * 0.05, r, r, r);
      gr.addColorStop(0, '#fffdf4'); gr.addColorStop(0.25, '#ffe9a8');
      gr.addColorStop(0.55, '#ffb84a'); gr.addColorStop(0.8, 'rgba(255,110,40,.55)');
      gr.addColorStop(1, 'rgba(255,90,30,0)');
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 380; i++) {   // granulation
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.42;
        g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.10)' : 'rgba(200,90,20,.10)';
        g.beginPath(); g.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, 1 + rnd() * 3, 0, TAU); g.fill();
      }
    });
    // Veilmoon: great pale-violet moon, maria seas, craters, glowing cracks
    const moonTex = tex(256, (g, S) => {
      const r = S / 2;
      let gr = g.createRadialGradient(r, r, r * 0.7, r, r, r);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.78, 'rgba(0,0,0,0)');
      gr.addColorStop(0.92, 'rgba(170,160,230,.45)'); gr.addColorStop(1, 'rgba(170,160,230,0)');
      g.fillStyle = '#e6eaf6';
      g.beginPath(); g.arc(r, r, r * 0.78, 0, TAU); g.fill();
      g.save();
      g.beginPath(); g.arc(r, r, r * 0.78, 0, TAU); g.clip();
      for (let i = 0; i < 8; i++) {   // maria — the dark seas
        g.fillStyle = 'rgba(140,148,190,.45)';
        g.beginPath();
        g.ellipse(r + (rnd() - 0.5) * r, r + (rnd() - 0.5) * r,
          r * (0.12 + rnd() * 0.2), r * (0.1 + rnd() * 0.16), rnd() * 3, 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 46; i++) {  // craters with lit rims
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.72;
        const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d, cr = 2 + rnd() * 8;
        g.fillStyle = 'rgba(150,156,190,.6)';
        g.beginPath(); g.arc(x, y, cr, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1;
        g.beginPath(); g.arc(x, y, cr, -2.4, -0.6); g.stroke();
      }
      g.shadowColor = '#7fe8ff'; g.shadowBlur = 7;   // fantasy fissures
      g.strokeStyle = 'rgba(150,240,255,.85)'; g.lineWidth = 1.6;
      for (let f = 0; f < 3; f++) {
        let x = r + (rnd() - 0.5) * r, y = r - r * 0.6;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 5; s++) { x += (rnd() - 0.5) * 26; y += 14 + rnd() * 16; g.lineTo(x, y); }
        g.stroke();
      }
      g.restore();
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    });
    // the Tear: small teal companion moon riding beside Veilmoon
    const tearTex = tex(128, (g, S) => {
      const r = S / 2;
      let gr = g.createRadialGradient(r, r, r * 0.6, r, r, r);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0)');
      gr.addColorStop(0.9, 'rgba(140,230,215,.5)'); gr.addColorStop(1, 'rgba(140,230,215,0)');
      g.fillStyle = '#c9ece4';
      g.beginPath(); g.arc(r, r, r * 0.72, 0, TAU); g.fill();
      g.save();
      g.beginPath(); g.arc(r, r, r * 0.72, 0, TAU); g.clip();
      for (let i = 0; i < 26; i++) {
        g.fillStyle = 'rgba(110,160,155,.5)';
        g.beginPath(); g.arc(r + (rnd() - 0.5) * r * 1.2, r + (rnd() - 0.5) * r * 1.2, 1 + rnd() * 4, 0, TAU); g.fill();
      }
      g.restore();
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    });
    const spr = (t, s) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, fog: false, depthWrite: false }));
      sp.scale.set(s, s, 1);
      scene.add(sp);
      return sp;
    };
    this.sunSpr = spr(sunTex, 230);
    this.moonSpr = spr(moonTex, 135);
    this.tearSpr = spr(tearTex, 68);
    // stars
    const N = 550, arr = new Float32Array(N * 3);
    const srng = makeRng(1234567);
    for (let i = 0; i < N; i++) {
      const a = srng() * TAU, y = srng() * 2 - 0.08, rr = Math.sqrt(Math.max(0, 1 - y * y));
      arr[i * 3] = Math.cos(a) * rr * 1300;
      arr[i * 3 + 1] = y * 1300;
      arr[i * 3 + 2] = Math.sin(a) * rr * 1300;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xcdd8ff, size: 1.8, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false
    }));
    scene.add(this.stars);
    this._cA = new THREE.Color(); this._cB = new THREE.Color();
  },

  dayNightF() { return this._dayF != null ? this._dayF : 1; },
  dayPhase() {
    const t = this.dayT || 0;
    if (t > 0.21 && t < 0.31) return ['☀', 'Dawn'];
    if (t >= 0.31 && t < 0.69) return ['☀', 'Day'];
    if (t >= 0.69 && t < 0.79) return ['☀', 'Dusk'];
    return ['☾', 'Night'];
  },

  /* ---------------- weather ----------------
     Nine skies: clear rain storm snow leaves petals ash fog tornado.
     Particles ride a box around the camera; sound follows suit. */
  buildWeather() {
    const scene = this.scene;
    // soft motes: snow, leaves, petals, ash
    const N = 700;
    this.wxPos = new Float32Array(N * 3);
    this.wxVel = new Float32Array(N * 3);
    this.wxSeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.wxPos[i * 3] = (Math.random() - 0.5) * 70;
      this.wxPos[i * 3 + 1] = Math.random() * 35;
      this.wxPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
      this.wxSeed[i] = Math.random() * TAU;
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(this.wxPos, 3));
    this.motes = new THREE.Points(wg, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.4, transparent: true, opacity: 0,
      fog: false, depthWrite: false
    }));
    this.motes.frustumCulled = false;
    scene.add(this.motes);
    // rain streaks: line segments falling fast
    const M = 500;
    this.rnPos = new Float32Array(M * 6);
    this.rnVel = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      this.rnPos[i * 6] = (Math.random() - 0.5) * 60;
      this.rnPos[i * 6 + 1] = Math.random() * 30;
      this.rnPos[i * 6 + 2] = (Math.random() - 0.5) * 60;
      this.rnVel[i] = 26 + Math.random() * 10;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rnPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({
      color: 0xaac4e0, transparent: true, opacity: 0, fog: false
    }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);
    // the tornado itself: two nested funnels, counter-spun
    const funM = new THREE.MeshStandardMaterial({
      color: 0x6a7078, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, roughness: 1, fog: false, depthWrite: false
    });
    this.twister = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(11, 2.2, 60, 14, 6, true), funM);
    outer.position.y = 30;
    this.twister.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(6, 1.2, 60, 10, 4, true),
      funM.clone());
    inner.material.opacity = 0.7;
    inner.position.y = 30;
    this.twister.add(inner);
    this.twister.visible = false;
    scene.add(this.twister);
    this.weather = { kind: 'clear', t: 70 + Math.random() * 60, flash: 0, boltT: 5 };
    this.twisterState = null;
  },

  pickWeather(px, pz) {
    const h = this.height(px, pz);
    const b = this.biome(px, pz, h);
    const bag = [['clear', 30], ['rain', 22], ['storm', 8], ['snow', 10],
      ['leaves', 12], ['petals', 10], ['ash', 6], ['fog', 10], ['tornado', 4]];
    if (b === 'snow') bag.push(['snow', 40]);
    if (b === 'volcano') bag.push(['ash', 40]);
    if (b === 'forest') bag.push(['leaves', 15]);
    if (h < 1) bag.push(['rain', 10], ['storm', 6]);   // sea squalls
    let total = 0;
    for (const [, w] of bag) total += w;
    let r = Math.random() * total, pick = 'clear';
    for (const [k, w] of bag) { r -= w; if (r <= 0) { pick = k; break; } }
    if (pick === this.weather.kind) pick = 'clear';   // variety first
    this.weather.kind = pick;
    this.weather.t = 90 + Math.random() * 90;
    const Q = {
      clear: null, rain: 'Rain hisses down.', storm: 'The sky goes iron-grey.',
      snow: 'Snow begins to fall.', leaves: 'Dead leaves ride the wind.',
      petals: 'Petals drift on the air.', ash: 'Ash sifts from a grey sky.',
      fog: 'Mist closes in.', tornado: 'A black funnel touches the earth!'
    }[pick];
    if (Q) UI.toast(Q, pick === 'storm' || pick === 'tornado' ? 'warn' : undefined);
    Sound.weather(pick);
    if (pick === 'tornado') this.spawnTwister(px, pz);
    else this.twister.visible = false;
  },

  spawnTwister(px, pz) {
    const a = Math.random() * TAU;
    this.twisterState = {
      x: px + Math.cos(a) * 90, z: pz + Math.sin(a) * 90,
      dx: Math.cos(a + 2.2), dz: Math.sin(a + 2.2), spin: 0
    };
    this.twister.visible = true;
  },

  weatherTick(dt, px, pz, py) {
    const W = this.weather;
    if (!W) return;
    W.t -= dt;
    if (W.t <= 0) this.pickWeather(px, pz);
    const k = W.kind;
    const wet = k === 'rain' || k === 'storm' || k === 'tornado';
    // --- motes ---
    const moteOn = k === 'snow' || k === 'leaves' || k === 'petals' || k === 'ash';
    this.motes.visible = moteOn;
    if (moteOn) {
      const conf = {
        snow:   { c: 0xe8eefc, s: 0.42, fall: 2.2, sway: 1.4, op: 0.9 },
        leaves: { c: 0xc87828, s: 0.5, fall: 3.2, sway: 4.2, op: 0.85 },
        petals: { c: 0xf0b8d0, s: 0.42, fall: 1.8, sway: 2.2, op: 0.85 },
        ash:    { c: 0x8a8078, s: 0.34, fall: 2.6, sway: 1.0, op: 0.8 }
      }[k];
      this.motes.material.color.setHex(conf.c);
      this.motes.material.size = conf.s;
      this.motes.material.opacity = conf.op;
      for (let i = 0; i < this.wxSeed.length; i++) {
        const j = i * 3;
        this.wxPos[j + 1] -= conf.fall * dt;
        this.wxPos[j] += Math.sin(this.wxSeed[i] + performance.now() * 0.001) * conf.sway * dt;
        if (this.wxPos[j + 1] < -4) {
          this.wxPos[j] = px + (Math.random() - 0.5) * 70;
          this.wxPos[j + 1] = py + 22 + Math.random() * 12;
          this.wxPos[j + 2] = pz + (Math.random() - 0.5) * 70;
        }
      }
      this.motes.geometry.attributes.position.needsUpdate = true;
      this.motes.position.set(0, 0, 0);
    }
    // --- rain streaks ---
    this.rain.visible = wet;
    if (wet) {
      const hard = k === 'storm' ? 1.35 : 1;
      for (let i = 0; i < this.rnVel.length; i++) {
        const j = i * 6;
        this.rnPos[j + 1] -= this.rnVel[i] * hard * dt;
        this.rnPos[j + 3] = this.rnPos[j];
        this.rnPos[j + 4] = this.rnPos[j + 1] + 0.9;
        this.rnPos[j + 5] = this.rnPos[j + 2];
        if (this.rnPos[j + 1] < -4) {
          this.rnPos[j] = px + (Math.random() - 0.5) * 60;
          this.rnPos[j + 1] = py + 20 + Math.random() * 10;
          this.rnPos[j + 2] = pz + (Math.random() - 0.5) * 60;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.material.opacity = k === 'storm' ? 0.55 : 0.4;
    }
    // --- storm lightning ---
    if (k === 'storm' || k === 'tornado') {
      W.boltT -= dt;
      if (W.boltT <= 0) {
        W.boltT = 3 + Math.random() * 8;
        W.flash = 1;
        const dist = 0.4 + Math.random();
        Sound.thunder(dist);
      }
    }
    if (W.flash > 0) {
      W.flash = Math.max(0, W.flash - dt * 1.8);
      this.hemi.intensity += W.flash * 2.2;
      this.sun.intensity += W.flash * 1.2;
    }
    // --- tornado body ---
    if (k === 'tornado' && this.twisterState) {
      const T = this.twisterState;
      T.spin += dt * 3;
      T.x += T.dx * 7 * dt; T.z += T.dz * 7 * dt;
      const gy = Math.max(this.height(T.x, T.z), SEA);
      this.twister.position.set(T.x, gy - 2, T.z);
      this.twister.children[0].rotation.y = T.spin;
      this.twister.children[1].rotation.y = -T.spin * 1.6;
      const pd = Math.hypot(T.x - px, T.z - pz);
      if (pd > 170) this.spawnTwister(px, pz);
      else {
        if (pd < 26) {   // the rim shoves and batters
          const p = Entities.player;
          const dx = p.x - T.x, dz = p.z - T.z, l = Math.hypot(dx, dz) || 1;
          Entities.move(p, dx / l * 9 * dt, dz / l * 9 * dt);
          Camera3.kick(0.12);
          if (pd < 9) Game.hurtPlayer(5, null);
        }
        Sound.wind(true);
      }
    } else Sound.wind(false);
    // --- fog banks ---
    if (k === 'fog') { this.scene.fog.near = 30; this.scene.fog.far = 220; }
  },

  /* Nudge a point outward until it is clear of buildings and walls. */
  findOpenSpot(x, z, r) {
    r = r || 0.7;
    if (!this.blocked(x, z, r)) return { x, z };
    for (let step = 2; step <= 60; step += 2) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const nx = x + Math.cos(a) * step, nz = z + Math.sin(a) * step;
        if (!this.blocked(nx, nz, r) && this.height(nx, nz) > 2) return { x: nx, z: nz };
      }
    }
    return { x, z };
  },

  /* ---------------- dungeons ---------------- */
  enterDungeon(def) {
    if (!this.builtDungeons[def.id]) this.builtDungeons[def.id] = this.buildDungeon(def);
    const d = this.builtDungeons[def.id];
    this.group.visible = false;
    this.water.visible = false;
    this.sky.visible = false;
    for (const k in this.builtDungeons) this.builtDungeons[k].root.visible = false;
    d.root.visible = true;
    this.dungeonGroup.visible = true;
    this.mode = 'dungeon';
    this.dungeon = d;
    this.scene.fog = new THREE.Fog(0x0b0910, 8, 95);
    this.scene.background = new THREE.Color(0x0b0910);
    this.hemi.intensity = 0.16;
    this.sun.intensity = 0.12;
    Entities.spawnDungeonBoss(d);
    return d;
  },

  exitDungeon() {
    Entities.purgeDungeonMobs();
    this.group.visible = true;
    this.water.visible = true;
    this.sky.visible = true;
    this.dungeonGroup.visible = false;
    this.mode = 'overworld';
    this.dungeon = null;
    this.scene.fog = new THREE.Fog(0x9fb0c4, 260, 900);
    this.scene.background = new THREE.Color(0x9fb0c4);
    this.hemi.intensity = 0.72;
    this.sun.intensity = 1.15;
  },

  buildDungeon(def) {
    const root = new THREE.Group();
    root.position.set(0, -800, 0);
    this.dungeonGroup.add(root);
    const rng = makeRng((def.x * 31 + def.z * 17) >>> 0);
    const wallM = mat(0x2b2733, { rough: 0.96 });
    const floorM = mat(0x38333f, { rough: 0.98 });
    const trimM = mat(0x8a7d5e, { rough: 0.5, metal: 0.4 });

    /* Layout: entry hall -> corridor -> puzzle chamber -> reward alcove.
       Rooms are axis-aligned boxes; colliders are added for the walls only. */
    const rooms = [
      { x: 0, z: 0, w: 26, d: 22 },
      { x: 0, z: -34, w: 10, d: 46 },
      { x: 0, z: -78, w: 40, d: 40 },
      { x: 0, z: -112, w: 16, d: 26 }
    ];
    const cols = [];
    // door junctions between the rooms — colliders and meshes leave these open
    const junctionZ = [-11, -57, -99];
    for (const r of rooms) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), floorM);
      f.rotation.x = -Math.PI / 2;
      f.position.set(r.x, 0, r.z);
      f.receiveShadow = true;
      root.add(f);
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), wallM);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(r.x, 9, r.z);
      root.add(ceil);
      // four walls with door gaps where rooms meet.
      // colliders are small posts along each wall, NOT one giant circle
      // (a 26 m wall as r13 would swallow the whole room and trap you).
      // junction walls are built as two runs leaving a doorway at x=0.
      const mk = (w, h, d2, px, py, pz) => {
        const horiz = w >= d2;
        const runs = [];
        if (horiz && junctionZ.some(j => Math.abs(pz - j) < 1.6)) {
          runs.push([px - w / 2, -3.5], [3.5, px + w / 2]);
        } else if (horiz) {
          runs.push([px - w / 2, px + w / 2]);
        } else {
          runs.push(null);   // vertical wall: single run along z
        }
        for (const run of runs) {
          let cx = px, cz = pz, len = horiz ? w : d2;
          if (run) {
            len = run[1] - run[0];
            if (len < 0.5) continue;
            cx = (run[0] + run[1]) / 2;
          }
          const m2 = box(horiz ? len : w, h, horiz ? d2 : len, wallM);
          m2.position.set(cx, py, cz);
          m2.receiveShadow = true;
          root.add(m2);
          const n = Math.max(1, Math.ceil(len / 2));
          for (let i = 0; i <= n; i++) {
            const off = -len / 2 + (i / n) * len;
            cols.push({ x: horiz ? cx + off : cx, z: horiz ? cz : cz + off, r: 1.2 });
          }
        }
      };
      mk(r.w, 9, 1, r.x, 4.5, r.z - r.d / 2);
      mk(r.w, 9, 1, r.x, 4.5, r.z + r.d / 2);
      mk(1, 9, r.d, r.x - r.w / 2, 4.5, r.z);
      mk(1, 9, r.d, r.x + r.w / 2, 4.5, r.z);
    }

    // braziers and room lights
    const lights = [];
    for (const r of rooms) {
      for (const s2 of [-1, 1]) {
        const bx = r.x + s2 * (r.w / 2 - 2.4), bz = r.z;
        const post = cyl(0.3, 0.42, 2.6, trimM, 8);
        post.position.set(bx, 1.3, bz);
        root.add(post);
        const bowl = sph(0.7, mat(0xffb056, { rough: 0.3, emissive: 0xff7a1e, ei: 2.2 }), 10, 8);
        bowl.position.set(bx, 2.8, bz);
        root.add(bowl);
      }
      const l = new THREE.PointLight(0xffa64a, 1.7, Math.max(r.w, r.d) * 1.7, 2);
      l.position.set(r.x, 5.6, r.z);
      root.add(l);
      lights.push(l);
    }

    const chamber = rooms[2];
    const props = this._dungeonPuzzle(root, def, chamber, trimM);
    const exitPad = { x: 0, z: 9 };
    const alcove = rooms[3];

    root.visible = false;
    return {
      def, root, colliders: cols, props, lights,
      spawn: { x: 0, z: 8 }, exit: exitPad, chamber, alcove,
      solved: false
    };
  },

  _dungeonPuzzle(root, def, room, trimM) {
    const props = [];
    const stele = box(1.6, 3.2, 0.5, mat(0x6e6a5e, { rough: 0.9 }));
    stele.position.set(0, 1.6, room.z + room.d / 2 - 4);
    root.add(stele);
    props.push({ kind: 'stele', x: stele.position.x, z: stele.position.z, mesh: stele, label: 'Read the stele' });

    if (def.puzzle === 'candles') {
      for (let i = 0; i < 7; i++) {
        const lit = i < 6;
        const x = -9 + i * 3;
        const c = cyl(0.22, 0.26, 1.6, mat(0xe8e0cc, { rough: 0.8 }), 8);
        c.position.set(x, 0.8, room.z - 6);
        root.add(c);
        if (lit) {
          const fl = sph(0.22, mat(0xffd08a, { rough: 0.1, emissive: 0xffb454, ei: 2.6 }), 8, 6);
          fl.position.set(x, 1.8, room.z - 6);
          root.add(fl);
        }
      }
    } else if (def.puzzle === 'bells') {
      for (let i = 0; i < 3; i++) {
        const cracked = i !== 1;
        const b = cone(1.0, 1.8, mat(cracked ? 0x6b6258 : 0xc9a85c, { rough: 0.5, metal: 0.6 }), 12);
        b.rotation.x = Math.PI;
        b.position.set(-4 + i * 4, 5.4, room.z - 6);
        root.add(b);
        props.push({ kind: 'bell', idx: i, x: b.position.x, z: b.position.z + 1.6, mesh: b, label: `Ring bell ${i + 1}` });
        if (cracked) {
          const crack = box(0.14, 1.5, 0.14, mat(0x1a1620, { rough: 1 }));
          crack.position.set(-4 + i * 4 + 0.5, 5.4, room.z - 5.1);
          root.add(crack);
        }
      }
    } else if (def.puzzle === 'seals') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU - Math.PI / 2;
        const px = Math.cos(a) * 12, pz = room.z + Math.sin(a) * 12;
        const ped = cyl(1.0, 1.3, 2.2, mat(0x6e6a5e, { rough: 0.9 }), 10);
        ped.position.set(px, 1.1, pz);
        root.add(ped);
        if (i < 6) {
          const orb = sph(0.6, mat(0xbfe0ff, { rough: 0.1, emissive: 0x6fa8f0, ei: 2.2 }), 12, 10);
          orb.position.set(px, 2.9, pz);
          root.add(orb);
        } else {
          props.push({ kind: 'seal', x: px, z: pz + 2, mesh: ped, label: 'Approach the seventh seal' });
          const cage = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12),
            new THREE.MeshStandardMaterial({
              color: 0x9fd0ff, transparent: true, opacity: 0.22,
              emissive: 0x5f9fe8, emissiveIntensity: 1.1, side: THREE.DoubleSide
            }));
          cage.position.set(px, 3.2, pz);
          root.add(cage);
          props.push({ kind: 'cageMesh', mesh: cage, hidden: true });
        }
      }
    }
    return props;
  },

  /* ---------------- castle keep interior ----------------
     Auverne keep, three floors, built far from the overworld so the outside
     world can sleep while you are inside. Layout follows the medieval pattern:
       ground — entrance vestibule, great hall with dais and throne,
                kitchen (east), stores (west)
       first  — family solar (south), guest beds (west), chapel (east),
                library (north)
       second — mage study (north), observatory (centre), archive (west),
                crown bedchamber (east), sealed balcony door            */
  enterInterior() {
    if (!this.interior) {
      this.interior = this.buildCastleInterior();
      Entities.placeInteriorCast();
    }
    const I = this.interior;
    this.group.visible = false;
    this.water.visible = false;
    this.sky.visible = false;
    for (const k in this.builtDungeons) this.builtDungeons[k].root.visible = false;
    this.interiorGroup.visible = true;
    this.mode = 'interior';
    this.scene.fog = new THREE.Fog(0x0d0a12, 10, 120);
    this.scene.background = new THREE.Color(0x0d0a12);
    this.hemi.intensity = 0.5;
    this.sun.intensity = 0.15;
    this.switchInteriorFloor(0, 0, 17, true);
    return I;
  },

  exitInterior() {
    this.group.visible = true;
    this.water.visible = true;
    this.sky.visible = true;
    this.interiorGroup.visible = false;
    this.mode = 'overworld';
    this.scene.fog = new THREE.Fog(0x9fb0c4, 260, 900);
    this.scene.background = new THREE.Color(0x9fb0c4);
    this.hemi.intensity = 0.72;
    this.sun.intensity = 1.15;
    const p = Entities.player;
    delete p.floorY;
    for (const h of Entities.companions) delete h.floorY;
  },

  /* Move everyone standing inside to floor f at local (lx, lz). */
  switchInteriorFloor(f, lx, lz, first) {
    const I = this.interior;
    I.cur = f;
    I.floors.forEach((fl, i) => { fl.root.visible = (i === f); });
    const p = Entities.player;
    p.x = INT.x + lx; p.z = INT.z + lz;
    p.y = p.floorY = f * INT.dh;
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    for (const h of Entities.companions) {
      h.x = p.x - 2; h.z = p.z - 2;
      h.y = h.floorY = f * INT.dh;
      h.wx = null;
    }
    if (!first) Sound.sfx('ui');
  },

  interiorCols() {
    if (!this.interior) return [];
    return this.interior.floors[this.interior.cur].cols;
  },

  IX(lx) { return INT.x + lx; },
  IZ(lz) { return INT.z + lz; },

  _icol(F, lx, lz, r) { F.cols.push({ x: this.IX(lx), z: this.IZ(lz), r }); },
  _iprop(F, kind, lx, lz, extra) {
    F.props.push(Object.assign({ kind, x: this.IX(lx), z: this.IZ(lz) }, extra || {}));
  },

  buildCastleInterior() {
    const exterior = this.interiorGroup;
    const mkFloor = f => {
      const root = new THREE.Group();
      root.position.set(INT.x, f * INT.dh, INT.z);
      root.visible = false;
      exterior.add(root);
      return { root, cols: [], props: [], y: f * INT.dh };
    };
    const F0 = mkFloor(0), F1 = mkFloor(1), F2 = mkFloor(2);
    this._intFloor0(F0);
    this._intFloor1(F1);
    this._intFloor2(F2);
    F0.root.visible = true;
    return {
      floors: [F0, F1, F2], cur: 0,
      hallPt: { x: INT.x, z: INT.z - 14 },   // before the dais: completes q0_walk
      entryPt: { x: INT.x, z: INT.z + 20 }
    };
  },

  _intOuter(F, root, doorSouth) {
    const W = INT.hw, D = INT.hd;
    this._iwall(F, root, -W, -D, W, -D);
    this._iwall(F, root, W, -D, W, D);
    if (doorSouth) this._iwall(F, root, W, D, -W, D, [{ at: W, w: 5 }]);
    else this._iwall(F, root, W, D, -W, D);
    this._iwall(F, root, -W, D, -W, -D);
  },

  /* GROUND FLOOR — vestibule, great hall, kitchen (east), stores (west). */
  _intFloor0(F) {
    const root = F.root, fy = 0;
    void fy;
    this._islab(F, root);
    this._intOuter(F, root, true);
    this._iwall(F, root, 16, -INT.hd, 16, INT.hd, [{ at: INT.hd + 7, w: 4 }]);
    this._iwall(F, root, -16, -INT.hd, -16, INT.hd, [{ at: INT.hd - 1, w: 4 }]);
    this._iDoorArch(root, 0, INT.hd - 0.5, 0);

    // great hall: carpet, long tables, pillars, dais + throne
    this._iCarpet(root, 0, 2.5, 6, 31);
    this._iCarpet(root, 0, -14, 4, 6);
    this._iTable(root, F, 7.5, -1, 2.2, 12);
    this._iTable(root, F, -7.5, -1, 2.2, 12);
    for (const px of [-11, 11]) for (const pz of [-14, -7, 0, 7, 14]) this._iPillar(root, F, px, pz);
    const dais = box(12, 1, 7, STONE());
    dais.position.set(0, 0.5, -18.5); dais.receiveShadow = true; root.add(dais);
    this._iThrone(root, F, 0, -19.5);
    this._icol(F, 0, -17, 5);   // dais base ring (throne has its own)
    this._iBannerWall(root, -8, -INT.hd + 0.8, 0, 0x8e0f22);
    this._iBannerWall(root, 8, -INT.hd + 0.8, 0, 0x3f6fc4);
    this._iChandelier(root, 0, 4);
    this._iChandelier(root, 0, -10);

    // kitchen (east): hearth, work tables, crates
    this._iHearth(root, F, 30, 2, -Math.PI / 2);
    this._iTable(root, F, 23, -2, 2.0, 6);
    this._iTable(root, F, 23, 10, 2.0, 5);
    this._iCrate(root, F, 28, -12, 1.2);
    this._iCrate(root, F, 28, -12, 1.0);
    this._iCrate(root, F, 28.5, 14, 1.2);
    this._iBarrel(root, F, 20, -18);

    // stores (west): crates and barrels
    this._iCrate(root, F, -24, 10, 1.3);
    this._iCrate(root, F, -24, 8.4, 1.0);
    this._iCrate(root, F, -28, -6, 1.2);
    this._iCrate(root, F, -20, -12, 1.4);
    this._iBarrel(root, F, -26, 14);
    this._iBarrel(root, F, -24.2, 15);

    // servants' stair to the gallery (rises northward into the NE corner)
    this._iStairs(root, F, 24, -12, 0, -1);

    // dressing
    this._iPlaqueMesh(root, 5, 18, 0);
    this._iCarpet(root, 0, 19, 5, 4);

    this._iprop(F, 'doorOut', 0, 20, { label: 'Leave the keep' });
    this._iprop(F, 'stairsUp', 22, -11, { to: 1, tx: 28, tz: -12, label: 'Climb to the gallery' });
    this._iprop(F, 'plaque', 5, 18, {
      label: 'Read: keep history',
      codex: 'auverne',
      title: 'Auverne Keep',
      text: 'Raised in the second reign, burned in the fourth, rebuilt stone by stone by hands that signed nothing. Eight loops are cut above the door. Count them. One was added later, in bluer ink.'
    });
    this._iprop(F, 'plaque', 6, -13, {
      label: 'Read: the ward hall',
      codex: 'rose',
      title: 'The Ward Hall',
      text: 'No ward was ever raised in this hall. The name is older than the magic: trials were walked here, end to end, before the throne, and the court watched to see who kept walking.'
    });
  },

  /* FIRST FLOOR — solar (south), guests (west), chapel (east), library (north). */
  _intFloor1(F) {
    const root = F.root;
    this._islab(F, root);
    this._intOuter(F, root, false);
    this._iwall(F, root, -14, -INT.hd, -14, INT.hd, [{ at: INT.hd + 1, w: 4 }]);
    this._iwall(F, root, 14, -INT.hd, 14, INT.hd, [{ at: INT.hd + 1, w: 4 }]);
    this._iwall(F, root, -14, 8, 14, 8, [{ at: 14, w: 4 }]);

    // solar: bed, hearth, tapestry rug
    this._iBed(root, F, -6, 16, 0, 0x3f6fc4);
    this._iHearth(root, F, 6, 22, Math.PI);
    this._iCarpet(root, 0, 15, 8, 6);
    this._iBannerWall(root, -4, INT.hd - 0.8, Math.PI, 0xcfe0f6);
    this._iCrate(root, F, -11, 20, 1.1);

    // guest beds (west)
    this._iBed(root, F, -24, 10, 0, 0x6e5a34);
    this._iBed(root, F, -24, -4, 0, 0x4a5a44);
    this._iCrate(root, F, -28, -14, 1.2);

    // chapel (east): altar, benches, candles
    this._iAltar(root, F, 24, -18, 0);
    for (const bz of [-13, -10]) {
      const bench = box(5, 0.5, 0.9, WOOD());
      bench.position.set(24, 0.25, bz); root.add(bench);
    }
    this._icol(F, 24, -11.5, 2.6);
    this._iBannerWall(root, 24, -INT.hd + 0.8, 0, 0xd8d0bc);
    this._iPlaqueMesh(root, 19, -6, 0);

    // library (north): shelves, desk, chronicler
    for (const sx of [-10, -5, 0, 5, 10]) this._iShelf(root, F, sx, -21, 0);
    this._iTable(root, F, 0, -16, 2.4, 4);
    const lamp = new THREE.PointLight(0xffc870, 0.9, 11, 2);
    lamp.position.set(0, 2.6, -16); root.add(lamp);

    // stairs: down east (from kitchen flight), up north-west
    this._iStairs(root, F, -27, -10, 0, -1);
    this._iChandelier(root, 0, 0);
    this._iCarpet(root, 0, -2, 5, 10);

    this._iprop(F, 'stairsDown', 28, -14, { to: 0, tx: 22, tz: -9, label: 'Descend to the hall' });
    this._iprop(F, 'stairsUp', -25, -8, { to: 2, tx: -22, tz: -12, label: 'Climb to the study' });
    this._iprop(F, 'bed', -6, 14, { label: 'Rest in the solar bed' });
    this._iprop(F, 'plaque', 19, -6, {
      label: 'Read: chapel inscription',
      codex: 'choir',
      title: 'The Quiet Choir',
      text: 'The Choir only sings where a farewell was never finished. Say “later” here, the sisters wrote, and mean it, and the stones will keep the rest.'
    });
  },

  /* SECOND FLOOR — mage study (north), observatory (centre), archive (west),
     crown bedchamber (east), sealed balcony door. */
  _intFloor2(F) {
    const root = F.root;
    this._islab(F, root);
    this._intOuter(F, root, false);

    // mage study: desk, shelves, candles
    this._iTable(root, F, 0, -18, 2.4, 4);
    this._iShelf(root, F, -8, -21, 0);
    this._iShelf(root, F, 8, -21, 0);
    const lamp = new THREE.PointLight(0x9a7fe8, 0.9, 12, 2);
    lamp.position.set(0, 2.8, -18); root.add(lamp);
    this._iBannerWall(root, 0, -INT.hd + 0.8, 0, 0x4b2a75);

    // observatory: telescope, star rug, chart plaque
    this._iTelescope(root, F, 4, -2);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(4, 26), mat(0x2a3a5a, { rough: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.06, 0); rug.receiveShadow = true;
    root.add(rug);
    this._iPlaqueMesh(root, -3, 4, 0);

    // archive (west): shelves + record plaque
    for (const sz of [-4, 0, 4]) this._iShelf(root, F, -30, sz, Math.PI / 2);
    this._iPlaqueMesh(root, -25, 8, 0);
    this._iCrate(root, F, -27, -12, 1.2);

    // crown bedchamber (east)
    this._iBed(root, F, 22, 12, 0, 0x8e0f22);
    this._iCarpet(root, 22, 6, 5, 5);
    this._iBannerWall(root, 22, INT.hd - 0.8, Math.PI, 0x8e0f22);
    this._iTable(root, F, 26, 2, 1.8, 3);

    // sealed balcony door on the east wall
    this._iDoorArch(root, INT.hw - 0.5, 2, -Math.PI / 2);
    this._iPlaqueMesh(root, 28, 5, -Math.PI / 2);
    this._icol(F, 30, 2, 2.0);

    // stair landing from below (north-west)
    this._iStairs(root, F, -27, -4, 0, 1);
    this._iChandelier(root, 0, -4);

    this._iprop(F, 'stairsDown', -24, -16, { to: 1, tx: -23, tz: -12, label: 'Descend to the gallery' });
    this._iprop(F, 'bed', 22, 10, { label: 'Rest in the crown bed' });
    this._iprop(F, 'plaque', -3, 4, {
      label: 'Read: star chart',
      codex: 'eighth',
      title: 'The Eighth Mark',
      text: 'Seven lights are charted here. An eighth is pricked beside them in bluer ink, in a steadier hand, with one word beneath: “coming”.'
    });
    this._iprop(F, 'plaque', -25, 8, {
      label: 'Read: requisition',
      codex: 'sealed',
      title: 'Burned Requisition',
      text: 'A requisition for an outsider, dated eleven years ago. The signature is burned out of the page. The burn is old. The want is older.'
    });
    this._iprop(F, 'plaque', 28, 5, {
      label: 'Read: sealed door',
      codex: 'wardens',
      title: 'The Balcony Door',
      text: 'Sealed by order of the crown. Beyond it, the whole Rose Marches. It will open for a tuned heir, and no one sooner.'
    });
  },

  /* A wall segment with optional door gaps. gaps = [{at, w}] measured along. */
  _iwall(F, root, ax, az, bx, bz, gaps) {
    const dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz);
    const ux = dx / L, uz = dz / L;
    // solid runs between gaps
    const cuts = [0];
    (gaps || []).forEach(gp => { cuts.push(gp.at - gp.w / 2, gp.at + gp.w / 2); });
    cuts.push(L);
    cuts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i += 2) {
      const a = Math.max(0, cuts[i]), b2 = Math.min(L, cuts[i + 1]);
      if (b2 - a < 0.4) continue;
      const seg = box(b2 - a + 1.2, INT.wallH, 1.2, STONE_D());
      const mx = ax + ux * (a + b2) / 2, mz = az + uz * (a + b2) / 2;
      seg.position.set(mx, INT.wallH / 2, mz);
      seg.rotation.y = Math.atan2(-(dz), dx);
      seg.receiveShadow = true;
      root.add(seg);
    }
    for (let d = 0; d <= L; d += 2) {
      if ((gaps || []).some(gp => Math.abs(d - gp.at) < gp.w / 2 + 1.2)) continue;
      this._icol(F, ax + ux * d, az + uz * d, 1.4);
    }
  },

  _islab(F, root, fy) {
    const fl = box(INT.w * 2, 1, INT.hd * 2, mat(0x6e675e, { rough: 0.95 }));
    fl.position.set(0, -0.5, 0);
    fl.receiveShadow = true;
    root.add(fl);
    const ce = box(INT.w * 2, 1, INT.hd * 2, mat(0x4a453e, { rough: 0.95 }));
    ce.position.set(0, INT.wallH + 0.5, 0);
    root.add(ce);
  },

  /* ---------------- interior furniture ---------------- */
  _iTable(root, F, lx, lz, w, len) {
    const top = box(w, 0.25, len, WOOD());
    top.position.set(lx, 1.05, lz);
    root.add(top);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = box(0.22, 1.0, 0.22, WOOD());
      leg.position.set(lx + sx * (w / 2 - 0.2), 0.5, lz + sz * (len / 2 - 0.2));
      root.add(leg);
    }
    for (const sx of [-1, 1]) {
      const b = box(0.5, 0.5, len, WOOD());
      b.position.set(lx + sx * (w / 2 + 0.7), 0.25, lz);
      root.add(b);
    }
    for (const f of [-0.25, 0.25]) this._icol(F, lx, lz + f * len, Math.max(1.4, w * 0.45));
  },

  _iBed(root, F, lx, lz, rot, blanket) {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    g.rotation.y = rot || 0;
    const frame = box(2.2, 0.7, 3.4, WOOD()); frame.position.y = 0.35; g.add(frame);
    const matt = box(2.0, 0.4, 3.2, mat(0xd8d0bc, { rough: 0.9 })); matt.position.y = 0.9; g.add(matt);
    const bl = box(2.0, 0.18, 1.8, mat(blanket || 0x6e1420, { rough: 0.9 })); bl.position.set(0, 1.05, 0.5); g.add(bl);
    const pil = box(1.2, 0.3, 0.6, mat(0xe8e2d2, { rough: 0.9 })); pil.position.set(0, 1.1, -1.2); g.add(pil);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = box(0.18, 1.9, 0.18, WOOD());
      post.position.set(sx * 1.0, 0.95, sz * 1.6); g.add(post);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.add(g);
    this._icol(F, lx, lz, 2.2);
  },

  _iThrone(root, F, lx, lz) {
    const g = new THREE.Group();
    g.position.set(lx, 1.0, lz);
    const seat = box(1.5, 0.9, 1.2, WOOD()); seat.position.y = 0.45; g.add(seat);
    const back = box(1.5, 2.6, 0.35, WOOD()); back.position.set(0, 1.9, -0.55); g.add(back);
    const trimM = mat(0xc9a44e, { rough: 0.35, metal: 0.7 });
    for (const sx of [-1, 1]) {
      const arm = box(0.25, 0.7, 1.1, WOOD()); arm.position.set(sx * 0.85, 1.1, 0); g.add(arm);
      const orb = sph(0.16, trimM, 10, 8); orb.position.set(sx * 0.85, 3.3, -0.55); g.add(orb);
    }
    const crest = box(0.7, 0.7, 0.1, trimM); crest.position.set(0, 2.9, -0.35); crest.rotation.z = Math.PI / 4; g.add(crest);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.add(g);
    this._icol(F, lx, lz, 1.6);
  },

  _iShelf(root, F, lx, lz, rot) {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    g.rotation.y = rot || 0;
    const pal = [0x7a2a2a, 0x2a4a7a, 0x3a6a3a, 0x6a5a2a, 0x5a2a6a];
    for (const sx of [-1, 1]) {
      const post = box(0.25, 3.4, 0.5, WOOD());
      post.position.set(sx * 1.6, 1.7, 0); g.add(post);
    }
    for (let s = 0; s < 4; s++) {
      const board = box(3.4, 0.12, 0.55, WOOD());
      board.position.set(0, 0.4 + s * 0.95, 0); g.add(board);
      for (let b = 0; b < 7; b++) {
        const bk = box(0.32, 0.62, 0.4, mat(pal[(s * 7 + b) % pal.length], { rough: 0.85 }));
        bk.position.set(-1.3 + b * 0.42, 0.75 + s * 0.95, 0);
        g.add(bk);
      }
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.add(g);
    this._icol(F, lx, lz, 1.8);
  },

  _iHearth(root, F, lx, lz, rot) {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    g.rotation.y = rot || 0;
    const body = box(3.4, 3.0, 1.4, STONE_D()); body.position.y = 1.5; g.add(body);
    const mouth = box(2.0, 1.4, 0.3, mat(0x0d0a10, { rough: 1 })); mouth.position.set(0, 0.9, 0.65); g.add(mouth);
    const fire = sph(0.55, mat(0xff9a3c, { rough: 0.3, emissive: 0xff6a1e, ei: 2.4 }), 10, 8);
    fire.position.set(0, 0.8, 0.5); g.add(fire);
    const fire2 = sph(0.3, mat(0xffd08a, { rough: 0.3, emissive: 0xffb454, ei: 2.6 }), 8, 6);
    fire2.position.set(0.3, 1.1, 0.55); g.add(fire2);
    const l = new THREE.PointLight(0xff8a3c, 1.7, 22, 2);
    l.position.set(0, 1.8, 1.6); g.add(l);
    const mantel = box(3.8, 0.3, 1.7, WOOD()); mantel.position.y = 3.0; g.add(mantel);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.add(g);
    this._icol(F, lx, lz, 2.2);
  },

  _iPillar(root, F, lx, lz) {
    const base = box(1.9, 0.6, 1.9, STONE_D()); base.position.set(lx, 0.3, lz); root.add(base);
    const shaft = cyl(0.7, 0.8, INT.wallH - 1.2, STONE(), 12);
    shaft.position.set(lx, INT.wallH / 2, lz); root.add(shaft);
    const cap = box(1.9, 0.6, 1.9, STONE_D()); cap.position.set(lx, INT.wallH - 0.6, lz); root.add(cap);
    this._icol(F, lx, lz, 1.2);
  },

  _iAltar(root, F, lx, lz, rot) {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    g.rotation.y = rot || 0;
    const stone = box(2.6, 1.2, 1.3, STONE()); stone.position.y = 0.6; g.add(stone);
    const cloth = box(2.7, 0.15, 1.4, mat(0xe8e2d2, { rough: 0.9 })); cloth.position.y = 1.25; g.add(cloth);
    for (const cx of [-0.9, 0, 0.9]) {
      const cd = cyl(0.09, 0.09, 0.7, mat(0xe8e0cc, { rough: 0.8 }), 8);
      cd.position.set(cx, 1.6, 0); g.add(cd);
      const fl = sph(0.09, mat(0xffd08a, { rough: 0.2, emissive: 0xffb454, ei: 2.6 }), 8, 6);
      fl.position.set(cx, 2.0, 0); g.add(fl);
    }
    const l = new THREE.PointLight(0xffc870, 1.0, 13, 2);
    l.position.set(0, 2.4, 0.6); g.add(l);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.add(g);
    this._icol(F, lx, lz, 1.8);
  },

  _iChandelier(root, lx, lz) {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    const chain = cyl(0.06, 0.06, 2.2, mat(0x2a2630, { rough: 0.6 }), 6);
    chain.position.y = INT.wallH - 1.1; g.add(chain);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.12, 8, 20), mat(0x6a5a34, { rough: 0.5, metal: 0.5 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = INT.wallH - 2.2;
    g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const cd = cyl(0.08, 0.08, 0.6, mat(0xe8e0cc, { rough: 0.8 }), 6);
      cd.position.set(Math.cos(a) * 1.5, INT.wallH - 1.9, Math.sin(a) * 1.5); g.add(cd);
      const fl = sph(0.08, mat(0xffd08a, { rough: 0.2, emissive: 0xffb454, ei: 2.6 }), 6, 5);
      fl.position.set(Math.cos(a) * 1.5, INT.wallH - 1.55, Math.sin(a) * 1.5); g.add(fl);
    }
    const l = new THREE.PointLight(0xffd9a0, 1.25, 24, 2);
    l.position.y = INT.wallH - 2.6; g.add(l);
    root.add(g);
  },

  _iBannerWall(root, lx, lz, rot, color) {
    const b = box(1.8, 3.2, 0.12, mat(color, { rough: 0.9 }));
    b.position.set(lx, 4.6, lz);
    b.rotation.y = rot || 0;
    root.add(b);
    const emb = box(0.6, 0.6, 0.06, mat(0xd8c188, { rough: 0.5 }));
    emb.position.set(lx, 5.2, lz);
    emb.rotation.y = rot || 0;
    emb.rotation.z = Math.PI / 4;
    // nudge off the wall surface along its facing
    const nx = Math.sin(rot || 0), nz = Math.cos(rot || 0);
    b.position.x += nx * 0.1; b.position.z += nz * 0.1;
    emb.position.x += nx * 0.18; emb.position.z += nz * 0.18;
    root.add(emb);
  },

  _iCrate(root, F, lx, lz, s) {
    const c = box(s || 1.2, s || 1.2, s || 1.2, WOOD());
    c.position.set(lx, (s || 1.2) / 2, lz);
    c.rotation.y = (lx * 3 + lz) % 1;
    root.add(c);
    this._icol(F, lx, lz, (s || 1.2) * 0.8);
  },

  _iBarrel(root, F, lx, lz) {
    const b = cyl(0.65, 0.65, 1.5, WOOD(), 12);
    b.position.set(lx, 0.75, lz);
    root.add(b);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.05, 6, 16), mat(0x2a2630, { rough: 0.6 }));
    hoop.rotation.x = Math.PI / 2; hoop.position.set(lx, 1.0, lz);
    root.add(hoop);
    this._icol(F, lx, lz, 0.9);
  },

  _iTelescope(root, F, lx, lz) {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const leg = cyl(0.07, 0.07, 1.6, WOOD(), 6);
      leg.position.set(Math.cos(a) * 0.5, 0.7, Math.sin(a) * 0.5);
      leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      g.add(leg);
    }
    const tube = cyl(0.32, 0.38, 2.6, mat(0x8a6a34, { rough: 0.35, metal: 0.6 }), 12);
    tube.position.set(0, 1.9, 0);
    tube.rotation.x = -0.6;
    g.add(tube);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.add(g);
    this._icol(F, lx, lz, 1.0);
  },

  /* A visual stair flight; floor changes happen through its prop, not walking. */
  _iStairs(root, F, lx, lz, dx, dz) {
    for (let i = 0; i < 9; i++) {
      const st = box(3.2, 0.55, 1.2, STONE_D());
      st.position.set(lx + dx * i * 1.05, 0.3 + i * 0.55, lz + dz * i * 1.05);
      st.rotation.y = dx !== 0 ? Math.PI / 2 : 0;
      root.add(st);
    }
    const land = box(3.4, 0.5, 3.4, STONE_D());
    land.position.set(lx + dx * 10, 5.2, lz + dz * 10);
    root.add(land);
    for (const s of [-1, 1]) {
      const rail = box(0.15, 1.0, 10.5, WOOD());
      const px = dx !== 0 ? lx + dx * 5 : lx + s * 1.7;
      const pz = dz !== 0 ? lz + dz * 5 : lz + s * 1.7;
      rail.position.set(px, 3.2, pz);
      if (dx !== 0) rail.rotation.y = Math.PI / 2;
      root.add(rail);
    }
    this._icol(F, lx + dx * 5, lz + dz * 5, 1.6);
  },

  _iCarpet(root, lx, lz, w, len, color) {
    const c = box(w, 0.1, len, mat(color || 0x6e1420, { rough: 0.95 }));
    c.position.set(lx, 0.06, lz);
    c.receiveShadow = true;
    root.add(c);
  },

  _iPlaqueMesh(root, lx, lz, rot) {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    g.rotation.y = rot || 0;
    const stand = cyl(0.12, 0.16, 1.1, STONE_D(), 8);
    stand.position.y = 0.55; g.add(stand);
    const slab = box(1.2, 1.4, 0.15, STONE());
    slab.position.y = 1.5; slab.rotation.x = -0.25; g.add(slab);
    root.add(g);
  },

  _iDoorArch(root, lx, lz, rot) {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);
    g.rotation.y = rot || 0;
    for (const s of [-1, 1]) {
      const post = box(1.0, 6.5, 1.0, STONE());
      post.position.set(s * 2.2, 3.25, 0); g.add(post);
    }
    const lintel = box(5.4, 1.2, 1.2, STONE_D());
    lintel.position.y = 7.0; g.add(lintel);
    root.add(g);
  },

  /* ---------------- ambience ---------------- */
  tick(dt, t, px, pz) {
    if (this.sky) this.sky.position.set(px, 0, pz);
    if (this.water) { this.water.position.x = px; this.water.position.z = pz; }
    if (this.stars) this.stars.position.set(px, 0, pz);
    // the Drift hangs and breathes above Whisperwood
    if (this.drift) {
      for (let di = 0; di < this.drift.length; di++) {
        const d = this.drift[di];
        d.g.position.y = d.baseY + Math.sin(t * 0.3 + d.phase) * 3;
        if (this.skyIsles[di]) this.skyIsles[di].topY = d.g.position.y + 2.7;
      }
    }
    if (this.mode === 'overworld') {
      this.cycle(dt, px, pz);
      // low skies drink the light a little
      const wk = this.weather ? this.weather.kind : 'clear';
      if (wk === 'rain' || wk === 'fog') { this.hemi.intensity *= 0.78; this.sun.intensity *= 0.72; }
      if (wk === 'storm' || wk === 'tornado') { this.hemi.intensity *= 0.62; this.sun.intensity *= 0.55; }
      const py = Entities.player ? Entities.player.y : 0;
      this.weatherTick(dt, px, pz, py);
    }
    else if (this.sun) {
      this.sun.position.set(px + 180, 320, pz + 120);
      this.sun.target.position.set(px, 0, pz);
      this.sun.target.updateMatrixWorld();
    }
    void t;
  },

  /* One full day + night every 600 s. Drives sun, twin moons, stars,
     sky, fog and light — overworld only, dungeons keep their own dark. */
  cycle(dt, px, pz) {
    this.dayT = ((this.dayT || 0) + dt / 600) % 1;
    const a = (this.dayT - 0.25) * TAU;
    const elev = Math.sin(a), az = Math.cos(a);
    const il = Math.hypot(az, elev, 0.35);
    const sx = az / il, sy = elev / il, sz = 0.35 / il;
    const dayF = clamp((elev + 0.08) / 0.33, 0, 1);
    const nightF = 1 - dayF;
    this._dayF = dayF;
    const duskF = clamp(1 - Math.abs(elev - 0.08) * 4, 0, 1);

    // key light: sun by day, moonlight by night
    if (elev > -0.02) {
      this.sun.position.set(px + sx * 300, Math.max(60, sy * 300), pz + sz * 300);
      this.sun.intensity = 0.25 + 0.95 * dayF;
      this.sun.color.setHex(0xfff0dc).lerp(this._cA.setHex(0xff9a5a), clamp(1 - elev * 3, 0, 1) * dayF);
    } else {
      const my = Math.abs(sy) + 0.35;
      const ml = Math.hypot(sx, my, sz);
      this.sun.position.set(px + sx / ml * 300, my / ml * 300, pz + sz / ml * 300);
      this.sun.intensity = 0.22;
      this.sun.color.setHex(0x8fa8e8);
    }
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
    this.hemi.intensity = 0.14 + 0.58 * dayF;
    // water loses its sun-glitter after set: matte, dark, faint moon sheen
    this.water.material.roughness = 0.15 + nightF * 0.4;
    this.water.material.metalness = 0.05 + 0.35 * dayF;
    this.water.material.color.setHex(0x2c5875).lerp(this._cA.setHex(0x060a14), nightF);

    // sky, background, fog
    this.sky.material.color.setHex(0x8fa6c0).lerp(this._cA.setHex(0x060814), nightF);
    this.scene.background.setHex(0x9fb0c4).lerp(this._cA.setHex(0x05060f), nightF);
    if (duskF > 0) {
      this.scene.background.lerp(this._cA.setHex(0xd88a68), duskF * 0.45);
      this.sky.material.color.lerp(this._cA.setHex(0xc07858), duskF * 0.4);
    }
    this.scene.fog.color.copy(this.scene.background);
    this.stars.material.opacity = clamp(nightF * 1.1, 0, 0.9);

    // sun disc
    this.sunSpr.position.set(px + sx * 1250, sy * 1250, pz + sz * 1250);
    this.sunSpr.material.opacity = clamp((elev + 0.12) / 0.2, 0, 1);
    this.sunSpr.visible = this.sunSpr.material.opacity > 0.01;
    // twin moons ride opposite the sun, side by side
    let mx = -sx, my = -sy + 0.12, mz = -sz;
    const mll = Math.hypot(mx, my, mz); mx /= mll; my /= mll; mz /= mll;
    this.moonSpr.position.set(px + mx * 1250, my * 1250, pz + mz * 1250);
    this.moonSpr.material.opacity = clamp(nightF * 1.2, 0, 1);
    this.moonSpr.visible = nightF > 0.03;
    const ca = 0.14;   // the Tear hangs ~8° off Veilmoon
    const tx = mx * Math.cos(ca) - mz * Math.sin(ca), tz = mx * Math.sin(ca) + mz * Math.cos(ca);
    this.tearSpr.position.set(px + tx * 1250, (my - 0.03) * 1250, pz + tz * 1250);
    this.tearSpr.material.opacity = this.moonSpr.material.opacity;
    this.tearSpr.visible = this.moonSpr.visible;
  }
};
