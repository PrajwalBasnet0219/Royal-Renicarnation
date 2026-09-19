/* ROYAL REINCARNATION 3D — models.js
   Every mesh in the game is generated here. No image files, no loaders.

   Hair is built as four separate pieces — scalp cap, fringe, back mass and side
   locks — and the cap is always added first and always larger than the skull,
   so a model physically cannot render bald regardless of style. */
'use strict';

const M = {};   // shared material cache

function mat(color, opts) {
  opts = opts || {};
  const key = color + '|' + JSON.stringify(opts) + '|' + (opts.map || '');
  if (M[key]) return M[key];
  const m = new THREE.MeshStandardMaterial({
    color, roughness: opts.rough != null ? opts.rough : 0.72,
    metalness: opts.metal != null ? opts.metal : 0.05,
    transparent: !!opts.opacity, opacity: opts.opacity != null ? opts.opacity : 1,
    emissive: opts.emissive != null ? opts.emissive : 0x000000,
    emissiveIntensity: opts.ei != null ? opts.ei : 1,
    side: opts.side || THREE.FrontSide,
    flatShading: !!opts.flat
  });
  if (opts.map) m.map = tex(opts.map);
  M[key] = m;
  return m;
}

/* Light-neutral detail tiles: they multiply with the material colour,
   so one tile dresses every stone, plank and roof in the world. */
const TEXTURES = {};
function tex(name) {
  if (TEXTURES[name]) return TEXTURES[name];
  const R = Math.random;
  const painters = {
    stone(g, S) {
      g.fillStyle = '#ececec'; g.fillRect(0, 0, S, S);
      for (let r = 0; r < 8; r++) {
        const y = r * S / 8;
        g.fillStyle = 'rgba(0,0,0,.20)'; g.fillRect(0, y - 1, S, 2);
        g.fillStyle = 'rgba(255,255,255,.20)'; g.fillRect(0, y + 1, S, 1);
        for (let cix = 0; cix < 4; cix++) {
          const x = ((cix + (r % 2) * 0.5) % 4) * S / 4;
          g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x - 1, 0, 2, S / 8);
        }
      }
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.06})`;
        g.fillRect(R() * S, R() * S, 1.5, 1.5);
      }
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `rgba(90,80,60,${0.04 + R() * 0.05})`;
        g.beginPath(); g.arc(R() * S, R() * S, 8 + R() * 22, 0, TAU); g.fill();
      }
    },
    wood(g, S) {
      g.fillStyle = '#efe6da'; g.fillRect(0, 0, S, S);
      for (let p = 0; p < 6; p++) {
        const y = (p + 0.5) * S / 6;
        g.fillStyle = 'rgba(60,35,15,.30)'; g.fillRect(0, y - 1, S, 2);
        for (let i = 0; i < 22; i++) {
          g.strokeStyle = `rgba(120,85,50,${0.12 + R() * 0.15})`;
          g.lineWidth = 0.8 + R();
          const yy = y - S / 12 + R() * S / 6;
          g.beginPath(); g.moveTo(0, yy);
          g.bezierCurveTo(S * 0.3, yy + (R() - 0.5) * 5, S * 0.7, yy + (R() - 0.5) * 5, S, yy);
          g.stroke();
        }
      }
    },
    roof(g, S) {
      g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, S, S);
      for (let r = 0; r < 10; r++) {
        const y = r * S / 10;
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y - 1, S, 2);
        g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, y + 1, S, 1);
        for (let cix = 0; cix < 8; cix++) {
          const x = ((cix + (r % 2) * 0.5) % 8) * S / 8;
          g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x - 1, y, 2, S / 10);
        }
      }
      for (let i = 0; i < 200; i++) {
        g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.05})`;
        g.fillRect(R() * S, R() * S, 2, 2);
      }
    },
    ground(g, S) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${0.04 + R() * 0.06})` : `rgba(255,255,255,${0.05 + R() * 0.05})`;
        g.fillRect(R() * S, R() * S, 2, 2);
      }
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(60,70,40,${0.04 + R() * 0.05})`;
        g.beginPath(); g.arc(R() * S, R() * S, 6 + R() * 20, 0, TAU); g.fill();
      }
    },
    leaf(g, S) {
      g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = R() < 0.6 ? `rgba(0,70,0,${0.06 + R() * 0.10})` : `rgba(255,255,220,${0.05 + R() * 0.06})`;
        g.beginPath(); g.arc(R() * S, R() * S, 1 + R() * 4, 0, TAU); g.fill();
      }
    }
  };
  const t = canvasTex(256, painters[name] || painters.stone);
  if (name === 'ground') t.repeat.set(48, 48);
  TEXTURES[name] = t;
  return t;
}

const V2 = (x, y) => new THREE.Vector2(x, y);

function lathe(points, mat_, seg, phiStart, phiLen) {
  const g = new THREE.LatheGeometry(points, seg || 24, phiStart || 0, phiLen || TAU);
  const m = new THREE.Mesh(g, mat_);
  m.castShadow = true;
  return m;
}
function box(w, h, d, mat_) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat_); m.castShadow = true; return m; }
function sph(r, mat_, wseg, hseg) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, wseg || 16, hseg || 12), mat_); m.castShadow = true; return m; }
function cyl(rt, rb, h, mat_, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat_); m.castShadow = true; return m; }
function cone(r, h, mat_, seg) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 12), mat_); m.castShadow = true; return m; }

/* A limb segment that pivots from its top end. */
function segment(len, rTop, rBot, m) {
  const g = new THREE.Group();
  const c = cyl(rTop, rBot, len, m, 10);
  c.position.y = -len / 2;
  g.add(c);
  const j = sph(rTop * 1.02, m, 10, 8); g.add(j);
  const e = sph(rBot * 1.02, m, 10, 8); e.position.y = -len; g.add(e);
  return g;
}

/* =====================================================================
   HAIR
   ===================================================================== */
function buildHair(look, headR) {
  const g = new THREE.Group();
  const hm = mat(look.hair, { rough: 0.55 });
  const hm2 = mat(look.hair2 || look.hair, { rough: 0.6 });
  const len = (look.length || 1) * 0.62;

  /* 1. scalp cap — a dome with an open front (90° gap facing +Z), so the
     crown, sides and back are covered but the face stays fully open.
     Never casts shadow: hair must not darken the face. */
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.18, 28, 20, Math.PI * 0.75, Math.PI * 1.5, 0, Math.PI * 0.74), hm);
  cap.position.set(0, headR * 0.08, -headR * 0.05);
  cap.castShadow = false;
  g.add(cap);

  /* 2. fringe shell — hairline volume only, edge well above the brows so it
     never veils the eyes; the bang read comes from the clumps below it */
  const fr = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.15, 24, 16, 0, TAU, 0, Math.PI * 0.30), hm);
  fr.position.set(0, headR * 0.10, headR * 0.06);
  fr.scale.set(1.02, 0.95, 1.05);
  fr.castShadow = false;
  g.add(fr);
  // bang clumps: thin points hanging between/around the eyes, never over them
  for (const x of [-0.64, -0.26, 0.0, 0.30, 0.62]) {
    const tip = cone(headR * 0.15, headR * 0.62, hm, 7);
    tip.position.set(x * headR, headR * 0.52, headR * (x === 0.0 ? 0.98 : 0.90));
    tip.rotation.x = Math.PI * 0.92;
    tip.rotation.z = x * 0.35;
    tip.castShadow = false;
    g.add(tip);
  }

  /* 3. back mass — an open lathe so the face stays clear */
  const pts = [];
  const style = look.style || 'straight';
  const flare = style === 'wave' || style === 'wild' ? 1.22 : style === 'bloom' ? 1.1 : 1.0;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    let r = headR * (1.08 + 0.34 * Math.sin(t * Math.PI * 0.8)) * flare;
    if (style === 'straight') r = headR * (1.08 + 0.12 * t);
    if (style === 'hime') r = headR * (1.08 + 0.26 * Math.sin(t * Math.PI * 0.7));
    if (style === 'wild') r *= 1 + Math.sin(t * 9) * 0.10;
    if (t > 0.86) r *= (1 - (t - 0.86) * 5.5);
    pts.push(V2(Math.max(0.004, r), headR * 0.45 - t * len));
  }
  const back = lathe(pts, hm2, 26, Math.PI * 0.30, Math.PI * 1.40);
  back.name = 'hairBack';
  back.position.z = -headR * 0.08;   // sit behind the face plane, never over the mouth
  g.add(back);

  /* 4. side locks — swept OUT and BACK past the ears, ending above the chin,
     so they frame the jaw instead of curtaining the mouth */
  const lockLen = style === 'hime' ? len * 0.5 : len * 0.32;
  for (const s of [-1, 1]) {
    const lp = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      lp.push(V2(headR * (0.22 - 0.14 * t * t) + 0.004, -t * lockLen));
    }
    const lock = lathe(lp, hm, 10);
    lock.position.set(s * headR * 1.04, headR * 0.30, -headR * 0.06);
    lock.rotation.z = s * 0.18;
    lock.castShadow = false;
    lock.name = 'lock' + (s < 0 ? 'L' : 'R');
    g.add(lock);
  }

  /* style extras */
  if (style === 'braid') {
    for (let i = 0; i < 7; i++) {
      const b = sph(headR * (0.30 - i * 0.016), hm2, 10, 8);
      b.position.set(0, headR * 0.1 - i * len * 0.145, -headR * 1.1);
      b.scale.z = 1.25;
      g.add(b);
    }
  }
  if (style === 'wild') {
    for (let i = 0; i < 5; i++) {
      const sp = cone(headR * 0.20, headR * 1.1, hm, 7);
      const a = (i / 5) * Math.PI + Math.PI * 0.5;
      sp.position.set(Math.cos(a) * headR * 0.9, headR * 0.7, Math.sin(a) * headR * 0.9 - headR * 0.2);
      sp.rotation.set(-0.5 + Math.sin(i) * 0.4, 0, Math.cos(a) * 0.6);
      g.add(sp);
    }
  }
  if (style === 'veil') {
    const v = lathe([V2(headR * 1.16, headR * 0.3), V2(headR * 1.5, -len * 0.5), V2(headR * 1.2, -len * 0.95)],
      mat(look.capeColor || 0x0c0a11, { rough: 0.9, side: THREE.DoubleSide }), 22, Math.PI * 0.18, Math.PI * 1.64);
    g.add(v);
  }
  return g;
}

/* =====================================================================
   FACE — big forward-set eyes (proud of the skull, never sunken),
   per-style brows, lash flicks, lip colour per heroine.
   ===================================================================== */
function buildFace(look, headR) {
  const g = new THREE.Group();
  const style = look.style || 'short';
  // face character per hairstyle: eye size, fierce/soft tilt, brow weight
  const FT = {
    hime:     { eye: 1.00, tilt: 0.10, brow: 0.075, browTilt: 0.20 },
    wave:     { eye: 1.12, tilt: 0.02, brow: 0.060, browTilt: 0.10 },
    wild:     { eye: 0.92, tilt: 0.14, brow: 0.085, browTilt: 0.24 },
    straight: { eye: 1.00, tilt: 0.00, brow: 0.050, browTilt: 0.04 },
    braid:    { eye: 1.15, tilt: -0.02, brow: 0.055, browTilt: 0.08 },
    veil:     { eye: 1.05, tilt: 0.06, brow: 0.060, browTilt: 0.18 },
    bloom:    { eye: 1.10, tilt: 0.00, brow: 0.060, browTilt: 0.08 },
    short:    { eye: 1.00, tilt: 0.03, brow: 0.060, browTilt: 0.10 }
  }[style] || { eye: 1.00, tilt: 0.03, brow: 0.060, browTilt: 0.10 };
  const white = mat(0xfdfbfa, { rough: 0.3 });
  const iris = mat(look.eye, { rough: 0.2, emissive: look.eye, ei: 0.35 });
  const dark = mat(0x140f16, { rough: 0.4 });
  const lash = mat(0x17121b, { rough: 0.5 });

  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * headR * 0.37, headR * 0.02, headR * 0.95);
    eye.rotation.z = -s * FT.tilt;
    const es = FT.eye;

    const ball = sph(headR * 0.30 * es, white, 14, 10);
    ball.scale.set(1, 1.15, 0.5);
    ball.castShadow = false;
    eye.add(ball);

    const ir = sph(headR * 0.185 * es, iris, 14, 10);
    ir.scale.set(1, 1.12, 0.4);
    ir.position.z = headR * 0.13;
    ir.castShadow = false;
    eye.add(ir);

    const pu = sph(headR * 0.085 * es, dark, 10, 8);
    pu.scale.set(1, 1.15, 0.4);
    pu.position.z = headR * 0.175;
    pu.castShadow = false;
    eye.add(pu);

    const glint = sph(headR * 0.05, mat(0xffffff, { rough: 0.1, emissive: 0xffffff, ei: 0.5 }), 8, 6);
    glint.position.set(-s * headR * 0.07, headR * 0.10, headR * 0.20);
    glint.castShadow = false;
    eye.add(glint);

    const lid = box(headR * 0.56 * es, headR * 0.10, headR * 0.10, lash);
    lid.position.set(0, headR * 0.30, headR * 0.08);
    lid.rotation.z = -s * 0.12;
    lid.castShadow = false;
    eye.add(lid);

    // outer-corner lash flick, hugging the ball (feminine faces only)
    if (look.feminine !== false) {
      const flick = box(headR * 0.16, headR * 0.05, headR * 0.06, lash);
      flick.position.set(s * headR * 0.27, headR * 0.18, headR * 0.09);
      flick.rotation.z = s * 0.5;
      flick.castShadow = false;
      eye.add(flick);
    }

    // brow rides the skin below the fringe edge — always visible, never veiled
    const brow = box(headR * 0.42, headR * FT.brow, headR * 0.06, mat(look.hair2 || look.hair, { rough: 0.6 }));
    brow.position.set(s * headR * 0.37, headR * 0.60, headR * 0.75);
    brow.rotation.z = -s * FT.browTilt;
    brow.castShadow = false;
    g.add(brow);

    g.add(eye);
  }

  const nose = sph(headR * 0.05, mat(look.skin, { rough: 0.9 }), 8, 6);
  nose.position.set(0, -headR * 0.20, headR * 0.98);
  nose.castShadow = false;
  g.add(nose);

  const lipColor = look.feminine === false ? 0xa87878 : (look.lip || 0xb9686f);
  const mouth = box(headR * 0.26, headR * 0.06, headR * 0.05, mat(lipColor, { rough: 0.5 }));
  mouth.position.set(0, -headR * 0.48, headR * 0.90);
  mouth.castShadow = false;
  g.add(mouth);

  // a soft blush so the faces do not read as mannequins
  for (const s of [-1, 1]) {
    const bl = sph(headR * 0.19, mat(0xe8a4a8, { rough: 0.9, opacity: 0.45 }), 10, 8);
    bl.scale.set(1, 0.6, 0.2);
    bl.position.set(s * headR * 0.60, -headR * 0.26, headR * 0.72);
    bl.castShadow = false;
    g.add(bl);
  }
  return g;
}

/* =====================================================================
   CHARACTER
   ===================================================================== */
function buildCharacter(look) {
  look = Object.assign({
    hair: 0x3b2d2a, hair2: 0x2a1f1d, eye: 0x3a4a66, skin: 0xf3d8c2,
    style: 'short', length: 0.5, dressA: 0x2b2f42, dressB: 0x1d2030,
    trim: 0xc9a44e, metal: 0xd6b46e, silhouette: 'outsider', cape: 'none',
    capeColor: 0x2a2030, height: 1,
    bust: 1.0, waist: 0.92, hip: 1.05   // feminine baseline; men override
  }, look || {});

  const H = look.height || 1;
  const skin = mat(look.skin, { rough: 0.9 });
  const cloth = mat(look.dressA, { rough: 0.78 });
  const cloth2 = mat(look.dressB, { rough: 0.7 });
  const trim = mat(look.trim, { rough: 0.45, metal: 0.25 });
  const metal = mat(look.metal, { rough: 0.3, metal: 0.75 });
  const leg = mat(look.silhouette === 'outsider' ? 0x2a2c38 : 0x241d2c, { rough: 0.8 });

  const root = new THREE.Group();
  const P = {};

  /* --- legs --- */
  const hipsY = 0.86 * H;
  P.hips = new THREE.Group();
  P.hips.position.y = hipsY;
  root.add(P.hips);

  for (const s of [-1, 1]) {
    const thigh = segment(0.43 * H, 0.085 * H, 0.068 * H, leg);
    thigh.position.set(s * 0.10 * H * (0.9 + 0.1 * (look.hip || 1.05)), -0.02 * H, 0);
    const shin = segment(0.41 * H, 0.066 * H, 0.05 * H, leg);
    shin.position.y = -0.43 * H;
    thigh.add(shin);
    const boot = box(0.115 * H, 0.09 * H, 0.24 * H, mat(0x181320, { rough: 0.6 }));
    boot.position.set(0, -0.41 * H - 0.03 * H, 0.04 * H);
    shin.add(boot);
    // boot cuff
    const cuff = cyl(0.078 * H, 0.09 * H, 0.14 * H, trim, 10);
    cuff.position.y = -0.34 * H;
    shin.add(cuff);
    P.hips.add(thigh);
    P[s < 0 ? 'thighL' : 'thighR'] = thigh;
    P[s < 0 ? 'shinL' : 'shinR'] = shin;
  }
  // seat: two soft forms at the back of the hips, everyone gets them.
  // Scale follows hip width; skirts and coats drape over the top.
  const seatR = 0.075 * H * (look.hip || 1.05);
  for (const s of [-1, 1]) {
    const ch = sph(seatR, leg, 12, 10);
    ch.scale.set(1, 1.05, 0.9);
    ch.position.set(s * 0.07 * H, -0.05 * H, -0.08 * H);
    P.hips.add(ch);
  }

  /* --- torso --- */
  P.torso = new THREE.Group();
  P.hips.add(P.torso);

  const torsoLen = 0.50 * H;
  // feminine torso: hip -> waist in -> bust apex -> shoulder.
  // skirts overlap either way, so no skirt edits are needed.
  const B = look.bust || 1, W = look.waist || 0.92, Hp = look.hip || 1.05;
  const bodice = lathe([
    V2(0.150 * H * Hp, 0), V2(0.158 * H * Hp, 0.10 * H), V2(0.132 * H * W, 0.22 * H),
    V2(0.142 * H * B, 0.30 * H), V2(0.168 * H * B, 0.38 * H),
    V2(0.150 * H, 0.46 * H), V2(0.10 * H, torsoLen + 0.03 * H)
  ], cloth, 22);
  P.torso.add(bodice);

  // chest panel in the secondary colour, riding the bust curve
  const panel = lathe([
    V2(0.152 * H * B, 0.16 * H), V2(0.172 * H * B, 0.30 * H), V2(0.152 * H * B, 0.44 * H)
  ], cloth2, 20, -Math.PI * 0.42, Math.PI * 0.84);
  P.torso.add(panel);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.152 * H * Hp, 0.020 * H, 8, 24), trim);
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.06 * H;
  P.torso.add(belt);
  // bust: two soft forms under the bodice cloth — feminine figures only
  if (look.feminine !== false) {
    const bustR = 0.068 * H * B;
    for (const s of [-1, 1]) {
      const br = sph(bustR, cloth, 12, 10);
      br.scale.set(1, 1.2, 0.85);
      br.position.set(s * 0.078 * H, 0.36 * H, 0.125 * H);
      P.torso.add(br);
    }
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.098 * H, 0.016 * H, 8, 20), metal);
  collar.rotation.x = Math.PI / 2; collar.position.y = torsoLen + 0.01 * H;
  P.torso.add(collar);

  /* --- silhouette-specific clothing --- */
  const sil = look.silhouette;
  if (sil === 'court-gown' || sil === 'scholar-gown' || sil === 'ritual-gown' || sil === 'mage-robe') {
    const long = sil === 'mage-robe' ? 0.84 : 0.80;
    const skirt = lathe([
      V2(0.152 * H, 0), V2(0.26 * H, -0.30 * H), V2(0.36 * H, -0.58 * H), V2(0.40 * H, -long * H)
    ], cloth2, 30);
    skirt.material = mat(look.dressB, { rough: 0.74, side: THREE.DoubleSide });
    P.torso.add(skirt);
    const over = lathe([
      V2(0.158 * H, 0.02 * H), V2(0.27 * H, -0.32 * H), V2(0.34 * H, -0.62 * H)
    ], mat(look.dressA, { rough: 0.7, side: THREE.DoubleSide }), 26, Math.PI * 0.20, Math.PI * 1.6);
    P.torso.add(over);
    for (let i = 0; i < 3; i++) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry((0.20 + i * 0.07) * H, 0.010 * H, 6, 30), trim);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = (-0.18 - i * 0.20) * H;
      P.torso.add(hoop);
    }
  } else if (sil === 'armoured-gown') {
    const skirt = lathe([V2(0.152 * H, 0), V2(0.27 * H, -0.26 * H), V2(0.31 * H, -0.52 * H)],
      mat(look.dressB, { rough: 0.72, side: THREE.DoubleSide }), 26);
    P.torso.add(skirt);
    // pauldrons + breastplate edge
    for (const s of [-1, 1]) {
      const pa = sph(0.115 * H, metal, 14, 10);
      pa.scale.set(1, 0.68, 1);
      pa.position.set(s * 0.18 * H, torsoLen - 0.05 * H, 0);
      P.torso.add(pa);
    }
    const plate = lathe([V2(0.156 * H, 0.18 * H), V2(0.176 * H, 0.32 * H), V2(0.154 * H, 0.46 * H)],
      metal, 20, -Math.PI * 0.5, Math.PI);
    P.torso.add(plate);
  } else if (sil === 'duelist') {
    const skirt = lathe([V2(0.150 * H, 0), V2(0.24 * H, -0.18 * H), V2(0.26 * H, -0.40 * H)],
      mat(look.dressB, { rough: 0.7, side: THREE.DoubleSide }), 24, Math.PI * 0.14, Math.PI * 1.72);
    P.torso.add(skirt);
    for (const s of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.095 * H, 0.012 * H, 6, 18), trim);
      strap.rotation.x = Math.PI / 2;
      strap.position.set(s * 0.10 * H, -0.36 * H, 0);
      P.torso.add(strap);
    }
  } else if (sil === 'shroud') {
    const robe = lathe([
      V2(0.150 * H, 0.05 * H), V2(0.24 * H, -0.28 * H), V2(0.33 * H, -0.62 * H), V2(0.37 * H, -0.86 * H)
    ], mat(look.dressA, { rough: 0.86, side: THREE.DoubleSide }), 28);
    P.torso.add(robe);
    for (let i = 0; i < 4; i++) {
      const th = new THREE.Mesh(new THREE.TorusGeometry((0.17 + i * 0.055) * H, 0.008 * H, 6, 28), metal);
      th.rotation.x = Math.PI / 2; th.position.y = (-0.14 - i * 0.19) * H;
      P.torso.add(th);
    }
  } else if (sil === 'a-line') {
    // A-line: fitted waist flaring to the knee, one clean sweep, waist ribbon
    const skirt = lathe([V2(0.152 * H, 0), V2(0.24 * H, -0.30 * H), V2(0.32 * H, -0.58 * H)],
      mat(look.dressB, { rough: 0.74, side: THREE.DoubleSide }), 28);
    P.torso.add(skirt);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.150 * H, 0.018 * H, 8, 24), trim);
    rib.rotation.x = Math.PI / 2; rib.position.y = 0.02 * H;
    P.torso.add(rib);
  } else if (sil === 'ballgown') {
    // ball gown: towering layered skirts, overskirt panels, puff sleeves
    const under = lathe([
      V2(0.152 * H, 0), V2(0.30 * H, -0.35 * H), V2(0.46 * H, -0.80 * H)
    ], mat(look.dressB, { rough: 0.72, side: THREE.DoubleSide }), 32);
    P.torso.add(under);
    const over = lathe([
      V2(0.158 * H, 0.02 * H), V2(0.31 * H, -0.33 * H), V2(0.40 * H, -0.66 * H)
    ], mat(look.dressA, { rough: 0.7, side: THREE.DoubleSide }), 26, Math.PI * 0.35, Math.PI * 1.3);
    P.torso.add(over);
    for (let i = 0; i < 2; i++) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry((0.24 + i * 0.10) * H, 0.010 * H, 6, 32), trim);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = (-0.24 - i * 0.24) * H;
      P.torso.add(hoop);
    }
    for (const s of [-1, 1]) {
      const puff = sph(0.085 * H, cloth2, 12, 10);
      puff.scale.set(1, 0.75, 1);
      puff.position.set(s * 0.20 * H, torsoLen - 0.04 * H, 0);
      P.torso.add(puff);
    }
  } else if (sil === 'mermaid') {
    // mermaid: poured to the knee, then the sea lets go
    const sheath = lathe([
      V2(0.150 * H, 0), V2(0.165 * H, -0.28 * H), V2(0.155 * H, -0.52 * H),
      V2(0.28 * H, -0.72 * H), V2(0.33 * H, -0.84 * H)
    ], mat(look.dressB, { rough: 0.68, side: THREE.DoubleSide }), 28);
    P.torso.add(sheath);
    const fin = lathe([
      V2(0.160 * H, -0.40 * H), V2(0.20 * H, -0.58 * H), V2(0.30 * H, -0.80 * H)
    ], mat(look.dressA, { rough: 0.7, side: THREE.DoubleSide }), 24, Math.PI * 0.5, Math.PI);
    P.torso.add(fin);
  } else if (sil === 'battledress') {
    // battle dress: armoured bodice and pauldrons over a short pleated skirt
    for (const s of [-1, 1]) {
      const pa = sph(0.105 * H, metal, 14, 10);
      pa.scale.set(1, 0.68, 1);
      pa.position.set(s * 0.19 * H, torsoLen - 0.05 * H, 0);
      P.torso.add(pa);
    }
    const plate = lathe([V2(0.156 * H, 0.18 * H), V2(0.176 * H, 0.32 * H), V2(0.154 * H, 0.46 * H)],
      metal, 20, -Math.PI * 0.5, Math.PI);
    P.torso.add(plate);
    const skirt = lathe([V2(0.150 * H, 0), V2(0.25 * H, -0.20 * H), V2(0.27 * H, -0.34 * H)],
      mat(look.dressB, { rough: 0.7, side: THREE.DoubleSide }), 26);
    P.torso.add(skirt);
    for (let i = 0; i < 8; i++) {   // pleat seams
      const a = (i / 8) * TAU;
      const seam = box(0.03 * H, 0.3 * H, 0.03 * H, trim);
      seam.position.set(Math.cos(a) * 0.255 * H, -0.17 * H, Math.sin(a) * 0.255 * H);
      P.torso.add(seam);
    }
  } else if (sil === 'shrine') {
    // shrine maiden: white top, scarlet divided hakama, cords
    const hakL = box(0.17 * H, 0.78 * H, 0.24 * H, mat(look.dressB, { rough: 0.8 }));
    hakL.position.set(-0.095 * H, -0.41 * H, 0);
    P.torso.add(hakL);
    const hakR = box(0.17 * H, 0.78 * H, 0.24 * H, mat(look.dressB, { rough: 0.8 }));
    hakR.position.set(0.095 * H, -0.41 * H, 0);
    P.torso.add(hakR);
    for (const s of [-1, 1]) {
      const cord = new THREE.Mesh(new THREE.TorusGeometry(0.10 * H, 0.012 * H, 6, 18), trim);
      cord.rotation.x = Math.PI / 2;
      cord.position.set(s * 0.095 * H, -0.06 * H, 0);
      P.torso.add(cord);
    }
  } else if (sil === 'maid') {
    // French maid: black knee dress, frilled white apron, collar and cuffs
    const skirt = lathe([V2(0.150 * H, 0), V2(0.23 * H, -0.24 * H), V2(0.27 * H, -0.45 * H)],
      mat(look.dressA, { rough: 0.78, side: THREE.DoubleSide }), 26);
    P.torso.add(skirt);
    const apron = lathe([V2(0.10 * H, 0.0), V2(0.17 * H, -0.22 * H), V2(0.20 * H, -0.42 * H)],
      mat(0xf6f2e8, { rough: 0.85, side: THREE.DoubleSide }), 18, -Math.PI * 0.32, Math.PI * 0.64);
    apron.position.z = 0.02 * H;
    P.torso.add(apron);
    const frill = lathe([V2(0.19 * H, -0.40 * H), V2(0.225 * H, -0.44 * H)],
      mat(0xf6f2e8, { rough: 0.85, side: THREE.DoubleSide }), 18, -Math.PI * 0.32, Math.PI * 0.64);
    frill.position.z = 0.02 * H;
    P.torso.add(frill);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085 * H, 0.022 * H, 8, 20),
      mat(0xf6f2e8, { rough: 0.85 }));
    collar.rotation.x = Math.PI / 2; collar.position.y = torsoLen + 0.02 * H;
    P.torso.add(collar);
    for (const s of [-1, 1]) {
      const puff = sph(0.075 * H, mat(0xf6f2e8, { rough: 0.85 }), 12, 10);
      puff.scale.set(1, 0.7, 1);
      puff.position.set(s * 0.20 * H, torsoLen - 0.03 * H, 0);
      P.torso.add(puff);
    }
  } else if (sil === 'barmaid') {
    // barmaid: laced bodice, fulltz knee skirt, apron, puff sleeves
    const skirt = lathe([V2(0.150 * H, 0), V2(0.26 * H, -0.26 * H), V2(0.31 * H, -0.50 * H)],
      mat(look.dressA, { rough: 0.8, side: THREE.DoubleSide }), 28);
    P.torso.add(skirt);
    const apron = lathe([V2(0.11 * H, -0.02 * H), V2(0.19 * H, -0.24 * H), V2(0.22 * H, -0.46 * H)],
      mat(0xf2ede2, { rough: 0.85, side: THREE.DoubleSide }), 18, -Math.PI * 0.36, Math.PI * 0.72);
    apron.position.z = 0.02 * H;
    P.torso.add(apron);
    const lace = new THREE.Mesh(new THREE.TorusGeometry(0.145 * H, 0.012 * H, 6, 22), trim);
    lace.rotation.x = Math.PI / 2 - 0.25; lace.position.y = 0.30 * H;
    P.torso.add(lace);
    for (const s of [-1, 1]) {
      const puff = sph(0.09 * H, cloth2, 12, 10);
      puff.scale.set(1, 0.7, 1);
      puff.position.set(s * 0.21 * H, torsoLen - 0.03 * H, 0);
      P.torso.add(puff);
    }
  } else {
    const coat = lathe([V2(0.152 * H, 0.05 * H), V2(0.175 * H, -0.16 * H), V2(0.165 * H, -0.42 * H)],
      mat(look.dressA, { rough: 0.82, side: THREE.DoubleSide }), 22, Math.PI * 0.16, Math.PI * 1.68);
    P.torso.add(coat);
  }

  /* --- arms: rooted IN the shoulders (deltoid caps bridge the joint),
     angled out like a relaxed human stance --- */
  for (const s of [-1, 1]) {
    const arm = segment(0.30 * H, 0.055 * H, 0.045 * H, cloth);
    arm.position.set(s * 0.18 * H, torsoLen - 0.055 * H, 0);
    arm.rotation.z = s * 0.24;
    const delt = sph(0.075 * H, cloth, 12, 10);
    delt.position.set(s * 0.175 * H, torsoLen - 0.045 * H, 0);
    P.torso.add(delt);
    const fore = segment(0.28 * H, 0.044 * H, 0.038 * H, skin);
    fore.position.y = -0.30 * H;
    fore.rotation.z = s * 0.12;
    arm.add(fore);
    const hand = sph(0.048 * H, skin, 10, 8);
    hand.scale.set(1, 1.2, 0.7);
    hand.position.set(s * 0.02 * H, -0.29 * H, 0.02 * H);
    fore.add(hand);
    // flared cuff
    const cuff = lathe([V2(0.048 * H, 0), V2(0.11 * H, -0.16 * H)],
      mat(look.dressB, { rough: 0.7, side: THREE.DoubleSide }), 14);
    cuff.position.y = -0.10 * H;
    fore.add(cuff);
    P.torso.add(arm);
    P[s < 0 ? 'armL' : 'armR'] = arm;
    P[s < 0 ? 'foreL' : 'foreR'] = fore;
    P[s < 0 ? 'handL' : 'handR'] = hand;
  }

  /* --- neck + head --- */
  const neck = cyl(0.045 * H, 0.05 * H, 0.09 * H, skin, 10);
  neck.position.y = torsoLen + 0.04 * H;
  P.torso.add(neck);

  P.head = new THREE.Group();
  P.head.position.y = torsoLen + 0.10 * H;
  P.torso.add(P.head);

  const headR = 0.125 * H;
  const skull = sph(headR, skin, 26, 20);
  skull.scale.set(0.95, 1.06, 0.98);
  skull.position.y = headR * 0.55;
  P.head.add(skull);
  const jaw = sph(headR * 0.82, skin, 18, 14);
  jaw.scale.set(0.92, 0.78, 0.95);
  jaw.position.set(0, headR * 0.10, headR * 0.06);
  P.head.add(jaw);

  const face = buildFace(look, headR);
  face.position.y = headR * 0.55;
  P.head.add(face);

  const hair = buildHair(look, headR);
  hair.position.y = headR * 0.55;
  P.head.add(hair);
  P.hair = hair;

  if (look.ears === 'elf') {
    for (const s of [-1, 1]) {
      const ear = cone(headR * 0.16, headR * 0.72, skin, 8);
      ear.position.set(s * headR * 0.95, headR * 0.62, -headR * 0.05);
      ear.rotation.set(0.2, 0, -s * 0.9);
      P.head.add(ear);
    }
  }
  if (look.silhouette === 'maid') {
    // French headpiece: ruffled band with a bow
    const ruffle = cyl(0.95 * headR, 1.05 * headR, 0.12 * headR, mat(0xf6f2e8, { rough: 0.85 }), 18);
    ruffle.position.y = headR * 1.02;
    P.head.add(ruffle);
    const band = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.9, headR * 0.08, 8, 22),
      mat(0x1d1d26, { rough: 0.85 }));
    band.rotation.x = Math.PI / 2 - 0.25;
    band.position.y = headR * 1.08;
    P.head.add(band);
    for (const s of [-1, 1]) {
      const loop = box(headR * 0.36, headR * 0.24, headR * 0.08, mat(0xf6f2e8, { rough: 0.85 }));
      loop.position.set(s * headR * 0.44, headR * 1.30, -headR * 0.15);
      loop.rotation.z = s * 0.5;
      P.head.add(loop);
    }
  }
  if (look.horns) {
    for (const s of [-1, 1]) {
      const h1 = cone(headR * 0.16, headR * 0.86, mat(0xe8dcc4, { rough: 0.45 }), 8);
      h1.position.set(s * headR * 0.52, headR * 1.30, -headR * 0.06);
      h1.rotation.set(-0.36, 0, -s * 0.44);
      P.head.add(h1);
      const h2 = cone(headR * 0.10, headR * 0.52, mat(0xe8dcc4, { rough: 0.45 }), 8);
      h2.position.set(s * headR * 0.80, headR * 1.72, -headR * 0.22);
      h2.rotation.set(-0.8, 0, -s * 0.9);
      P.head.add(h2);
    }
  }
  if (look.hood) {
    const hood = lathe([
      V2(headR * 1.28, headR * 1.05), V2(headR * 1.42, headR * 0.35), V2(headR * 1.38, -headR * 0.55)
    ], mat(look.capeColor, { rough: 0.9, side: THREE.DoubleSide }), 22, Math.PI * 0.16, Math.PI * 1.68);
    hood.position.y = headR * 0.55;
    P.head.add(hood);
  }

  /* --- accent: crown, flowers, pins --- */
  const acc = look.accent || '';
  if (acc.startsWith('crown')) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(headR * 1.02, headR * 0.055, 8, 26), metal);
    band.rotation.x = Math.PI / 2;
    band.position.y = headR * 1.32;
    P.head.add(band);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI - Math.PI * 0.5;
      const sp = cone(headR * 0.07, headR * 0.34, metal, 6);
      sp.position.set(Math.sin(a) * headR * 1.0, headR * 1.48, Math.cos(a) * headR * 1.0);
      P.head.add(sp);
    }
    const gem = sph(headR * 0.10, mat(0x3f7fe0, { rough: 0.1, metal: 0.4, emissive: 0x2a5fb0, ei: 0.6 }), 10, 8);
    gem.position.set(0, headR * 1.40, headR * 1.0);
    P.head.add(gem);
  } else if (acc.includes('bloom') || acc.includes('lily') || acc.includes('rose') || acc.includes('moth')) {
    const petalColor = acc.includes('rose') ? 0xb81c34 : acc.includes('blue') || acc.includes('frost') ? 0x6f9fe8
                     : acc.includes('moth') ? 0x9a5fe0 : 0xe8e4f0;
    const side = acc.includes('rose') ? 1 : -1;
    const centre = new THREE.Group();
    centre.position.set(side * headR * 0.92, headR * 1.12, headR * 0.28);
    for (let i = 0; i < 6; i++) {
      const p = sph(headR * 0.13, mat(petalColor, { rough: 0.5 }), 8, 6);
      p.scale.set(1, 0.34, 1.5);
      const a = (i / 6) * TAU;
      p.position.set(Math.cos(a) * headR * 0.14, 0, Math.sin(a) * headR * 0.14);
      p.rotation.y = a;
      centre.add(p);
    }
    const core = sph(headR * 0.07, mat(0xf0d98a, { rough: 0.3 }), 8, 6);
    centre.add(core);
    P.head.add(centre);
    if (acc.includes('bloom')) {   // Liora wears several
      const c2 = centre.clone();
      c2.position.set(-side * headR * 0.86, headR * 1.24, -headR * 0.1);
      c2.scale.setScalar(0.8);
      P.head.add(c2);
    }
  } else if (acc.includes('horn')) {
    for (const s of [-1, 1]) {
      const h = cone(headR * 0.12, headR * 0.6, mat(look.trim, { rough: 0.4, metal: 0.3 }), 7);
      h.position.set(s * headR * 0.70, headR * 1.24, -headR * 0.1);
      h.rotation.set(-0.3, 0, -s * 0.7);
      P.head.add(h);
    }
  } else if (acc.includes('thorn')) {
    const circlet = new THREE.Mesh(new THREE.TorusGeometry(headR * 1.04, headR * 0.035, 6, 24), metal);
    circlet.rotation.x = Math.PI / 2; circlet.position.y = headR * 1.26;
    P.head.add(circlet);
  }

  /* --- cape --- */
  if (look.cape && look.cape !== 'none') {
    const drop = look.cape === 'full' ? 1.28 : 0.80;
    const cm = mat(look.capeColor, { rough: 0.82, side: THREE.DoubleSide });
    const cape = lathe([
      V2(0.14 * H, 0), V2(0.24 * H, -0.30 * H), V2(0.34 * H, -0.70 * H), V2(0.40 * H, -drop * H)
    ], cm, 26, Math.PI * 0.30, Math.PI * 1.40);
    cape.position.y = torsoLen - 0.02 * H;
    P.torso.add(cape);
    P.cape = cape;
    const clasp = new THREE.Mesh(new THREE.TorusGeometry(0.06 * H, 0.014 * H, 6, 16), metal);
    clasp.rotation.x = Math.PI / 2;
    clasp.position.y = torsoLen + 0.02 * H;
    P.torso.add(clasp);
  }

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  /* --- animation --- */
  const ch = {
    root, parts: P, look, phase: Math.random() * TAU, blink: 2 + Math.random() * 3, headR,
    update(dt, moveAmt, action) {
      this.phase += dt * (2.2 + moveAmt * 7.5);
      const s = Math.sin(this.phase), c = Math.cos(this.phase);
      const m = clamp(moveAmt, 0, 1);

      if (P.thighL) {
        P.thighL.rotation.x = s * 0.70 * m;
        P.thighR.rotation.x = -s * 0.70 * m;
        // knees fold BACKWARD only (heel to butt): deep fold as the leg
        // trails behind, near-straight as it reaches forward — never jutting
        P.shinL.rotation.x = (0.3 + 0.9 * clamp(-s, 0, 1)) * m;
        P.shinR.rotation.x = (0.3 + 0.9 * clamp(s, 0, 1)) * m;
      }
      if (P.armL) {
        const swing = action === 'attack' ? 0 : 1;
        P.armL.rotation.x = -s * 0.55 * m * swing;
        P.armR.rotation.x = s * 0.55 * m * swing;
        P.armL.rotation.z = -0.24 - Math.sin(this.phase * 0.5) * 0.02;
        P.armR.rotation.z = 0.24 + Math.sin(this.phase * 0.5) * 0.02;
        P.foreL.rotation.x = -0.25 - Math.abs(s) * 0.3 * m;
        P.foreR.rotation.x = -0.25 - Math.abs(s) * 0.3 * m;
      }
      // breathing + bob
      P.hips.position.y = hipsY + Math.abs(s) * 0.045 * m + Math.sin(this.phase * 0.5) * 0.008;
      P.torso.rotation.y = -c * 0.09 * m;
      P.torso.rotation.x = m * 0.07;
      if (P.head) {
        P.head.rotation.y = c * 0.05 * m;
        P.head.rotation.z = s * 0.03 * m;
      }
      // hair and cape trail behind the motion
      if (P.hair) {
        const back = P.hair.getObjectByName('hairBack');
        if (back) { back.rotation.x = -m * 0.30 - Math.sin(this.phase * 0.7) * 0.03; }
        const lL = P.hair.getObjectByName('lockL'), lR = P.hair.getObjectByName('lockR');
        if (lL) { lL.rotation.x = -m * 0.22; lR.rotation.x = -m * 0.22; }
      }
      if (P.cape) P.cape.rotation.x = -m * 0.34 - Math.sin(this.phase * 0.8) * 0.04;

      // action poses blend in/out instead of snapping (healers gesture
      // constantly, so snapping reads as a glitch on them first)
      this._atk = damp(this._atk || 0, action === 'attack' ? 1 : 0, 8, dt);
      this._cst = damp(this._cst || 0, action === 'cast' ? 1 : 0, 8, dt);
      this._sit = damp(this._sit || 0, action === 'sit' ? 1 : 0, 6, dt);
      if (this._atk > 0.01) {
        P.armR.rotation.x = lerp(P.armR.rotation.x, -2.1, this._atk);
        P.armR.rotation.z = lerp(P.armR.rotation.z, -0.5, this._atk);
        P.torso.rotation.y = lerp(P.torso.rotation.y, -0.5, this._atk);
      }
      if (this._cst > 0.01) {
        P.armR.rotation.x = lerp(P.armR.rotation.x, -2.5, this._cst);
        P.armL.rotation.x = lerp(P.armL.rotation.x, -1.2, this._cst);
      }
      if (this._sit > 0.01) {
        // bench pose: thighs forward, shins down, hands in lap
        const k = this._sit;
        P.thighL.rotation.x = lerp(P.thighL.rotation.x, -1.55, k);
        P.thighR.rotation.x = lerp(P.thighR.rotation.x, -1.55, k);
        P.shinL.rotation.x = lerp(P.shinL.rotation.x, 1.35, k);
        P.shinR.rotation.x = lerp(P.shinR.rotation.x, 1.35, k);
        P.armL.rotation.x = lerp(P.armL.rotation.x, -0.55, k);
        P.armR.rotation.x = lerp(P.armR.rotation.x, -0.55, k);
        P.foreL.rotation.x = lerp(P.foreL.rotation.x, -0.45, k);
        P.foreR.rotation.x = lerp(P.foreR.rotation.x, -0.45, k);
        P.torso.rotation.x = lerp(P.torso.rotation.x, -0.06, k);
        P.hips.position.y = lerp(P.hips.position.y, hipsY - 0.34 * H, k);
      }
      // work: hawking, hammering, sweeping — a steady looping gesture
      if (action === 'work') {
        const w = Math.sin(this.phase * 1.6);
        P.armR.rotation.x = -0.9 + w * 0.45;
        P.foreR.rotation.x = -0.5 + w * 0.3;
        P.armL.rotation.x = -0.15;
        P.torso.rotation.y = w * 0.06;
      }
      // blink
      this.blink -= dt;
      if (this.blink < 0) this.blink = 2.4 + Math.random() * 3.6;
    }
  };
  return ch;
}

/* =====================================================================
   MOBS
   ===================================================================== */
function buildMob(def) {
  const g = new THREE.Group();
  const body = mat(def.color, { rough: 0.85, flat: def.shape === 'blob' });
  const dark = mat(0x140f16, { rough: 0.6 });
  const glow = mat(0xffd27a, { rough: 0.2, emissive: 0xff9a3c, ei: 1.4 });
  const R = def.r;
  const parts = {};

  if (def.shape === 'quad') {
    const torso = sph(R * 0.8, body, 14, 10);
    torso.scale.set(0.8, 0.72, 1.5); torso.position.y = R * 0.9;
    g.add(torso);
    const head = sph(R * 0.46, body, 12, 10);
    head.position.set(0, R * 1.05, R * 1.05); g.add(head);
    const snout = cone(R * 0.22, R * 0.5, body, 8);
    snout.rotation.x = Math.PI / 2; snout.position.set(0, R * 0.98, R * 1.45); g.add(snout);
    for (const s of [-1, 1]) {
      const ear = cone(def.critter ? R * 0.20 : R * 0.14, def.critter ? R * 0.62 : R * 0.36, dark, 6);
      ear.position.set(s * R * 0.26, R * (def.critter ? 1.52 : 1.36), R * 0.98); g.add(ear);
      const eye = sph(R * 0.08, glow, 8, 6);
      eye.position.set(s * R * 0.22, R * 1.12, R * 1.32); g.add(eye);
      for (const f of [-1, 1]) {
        const lg = cyl(R * 0.11, R * 0.09, R * 0.85, dark, 7);
        lg.position.set(s * R * 0.35, R * 0.42, f * R * 0.75);
        g.add(lg);
        parts['leg' + s + f] = lg;
      }
    }
    const tail = cone(R * 0.14, R * 0.9, body, 7);
    tail.rotation.x = -0.9; tail.position.set(0, R * 1.1, -R * 1.2);
    g.add(tail); parts.tail = tail;
  } else if (def.shape === 'blob') {
    const b = sph(R, body, 16, 12);
    b.scale.set(1.05, 0.82, 1.05); b.position.y = R * 0.8;
    g.add(b); parts.body = b;
    for (let i = 0; i < 5; i++) {
      const spike = cone(R * 0.16, R * 0.5, dark, 6);
      const a = (i / 5) * TAU;
      spike.position.set(Math.cos(a) * R * 0.6, R * 1.35, Math.sin(a) * R * 0.6);
      spike.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      g.add(spike);
    }
    for (const s of [-1, 1]) {
      const eye = sph(R * 0.11, glow, 8, 6);
      eye.position.set(s * R * 0.26, R * 0.92, R * 0.86);
      g.add(eye);
    }
  } else if (def.shape === 'tall') {
    const legs = cyl(R * 0.3, R * 0.22, R * 1.1, dark, 8);
    legs.position.y = R * 0.55; g.add(legs);
    const torso = sph(R * 0.55, body, 14, 10);
    torso.scale.set(1, 1.3, 0.8); torso.position.y = R * 1.55;
    g.add(torso); parts.body = torso;
    const head = sph(R * 0.34, body, 12, 10);
    head.position.y = R * 2.2; g.add(head);
    for (const s of [-1, 1]) {
      const arm = cyl(R * 0.1, R * 0.07, R * 1.2, body, 7);
      arm.position.set(s * R * 0.55, R * 1.5, 0);
      arm.rotation.z = s * 0.35;
      g.add(arm); parts['arm' + s] = arm;
      const eye = sph(R * 0.08, glow, 8, 6);
      eye.position.set(s * R * 0.14, R * 2.24, R * 0.30); g.add(eye);
    }
  } else if (def.shape === 'wraith') {
    const veil = lathe([V2(R * 0.1, R * 1.6), V2(R * 0.62, R * 0.9), V2(R * 0.5, R * 0.1), V2(R * 0.18, -R * 0.2)],
      mat(def.color, { rough: 0.95, opacity: 0.82, side: THREE.DoubleSide }), 18);
    g.add(veil); parts.body = veil;
    const head = sph(R * 0.3, mat(0x0d0a12, { rough: 0.7 }), 12, 10);
    head.position.y = R * 1.5; g.add(head);
    for (const s of [-1, 1]) {
      const eye = sph(R * 0.07, glow, 8, 6);
      eye.position.set(s * R * 0.13, R * 1.55, R * 0.24); g.add(eye);
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.3, R * 0.9),
        mat(def.color, { rough: 0.9, opacity: 0.5, side: THREE.DoubleSide }));
      wing.position.set(s * R * 0.7, R * 1.2, -R * 0.2);
      wing.rotation.y = s * 0.7;
      g.add(wing); parts['wing' + s] = wing;
    }
  } else if (def.shape === 'bird') {
    const torso = sph(R * 0.5, body, 12, 10);
    torso.scale.set(0.8, 0.7, 1.4); torso.position.y = R * 1.2;
    g.add(torso); parts.body = torso;
    const head = sph(R * 0.32, body, 10, 8);
    head.position.set(0, R * 1.45, R * 0.6); g.add(head);
    const beak = cone(R * 0.12, R * 0.4, dark, 6);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, R * 1.42, R * 0.98); g.add(beak);
    for (const s of [-1, 1]) {
      const eye = sph(R * 0.07, glow, 8, 6);
      eye.position.set(s * R * 0.16, R * 1.5, R * 0.78); g.add(eye);
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.7, R * 0.85),
        mat(def.color, { rough: 0.9, side: THREE.DoubleSide }));
      wing.position.set(s * R * 0.85, R * 1.3, -R * 0.1);
      wing.rotation.y = s * 0.4;
      g.add(wing); parts['wing' + s] = wing;
    }
    for (let i = -1; i <= 1; i++) {
      const feather = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.3, R * 0.9),
        mat(def.color, { rough: 0.9, side: THREE.DoubleSide }));
      feather.position.set(i * R * 0.25, R * 1.2, -R * 1.0);
      feather.rotation.x = -0.5; feather.rotation.y = i * 0.3;
      g.add(feather);
      if (i === 0) parts.tail = feather;
    }
    if (def.crest) {
      // phoenix crown: three living embers
      for (const s of [-0.5, 0, 0.5]) {
        const c = sph(R * 0.09, glow, 8, 6);
        c.position.set(s * R * 0.4, R * 1.75, R * 0.5);
        g.add(c);
      }
    }
  } else { // drake
    const torso = sph(R * 0.8, body, 16, 12);
    torso.scale.set(0.85, 0.8, 1.5); torso.position.y = R * 1.1;
    g.add(torso);
    const neck = cyl(R * 0.22, R * 0.34, R * 0.9, body, 8);
    neck.position.set(0, R * 1.6, R * 0.8); neck.rotation.x = 0.7;
    g.add(neck);
    const head = sph(R * 0.36, body, 12, 10);
    head.scale.set(0.9, 0.8, 1.3); head.position.set(0, R * 1.95, R * 1.25);
    g.add(head);
    for (const s of [-1, 1]) {
      const horn = cone(R * 0.1, R * 0.5, dark, 6);
      horn.position.set(s * R * 0.18, R * 2.2, R * 1.05); horn.rotation.set(-0.5, 0, -s * 0.4);
      g.add(horn);
      const eye = sph(R * 0.08, glow, 8, 6);
      eye.position.set(s * R * 0.2, R * 2.0, R * 1.5); g.add(eye);
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.2, R * 1.4),
        mat(0x6a1c14, { rough: 0.9, side: THREE.DoubleSide }));
      wing.position.set(s * R * 1.1, R * 1.5, -R * 0.2);
      wing.rotation.set(0, s * 0.5, s * 0.3);
      g.add(wing); parts['wing' + s] = wing;
      for (const f of [-1, 1]) {
        const lg = cyl(R * 0.14, R * 0.1, R * 0.9, dark, 7);
        lg.position.set(s * R * 0.45, R * 0.5, f * R * 0.7);
        g.add(lg);
      }
    }
    const tail = cone(R * 0.2, R * 1.8, body, 8);
    tail.rotation.x = -1.35; tail.position.set(0, R * 1.1, -R * 1.6);
    g.add(tail); parts.tail = tail;
  }

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return {
    root: g, parts, phase: Math.random() * TAU,
    update(dt, moveAmt) {
      this.phase += dt * (3 + moveAmt * 8);
      const s = Math.sin(this.phase);
      if (def.fly) g.position.y = (g.userData.baseY || 0) + 1.2 + s * 0.3;
      if (parts.tail) parts.tail.rotation.y = s * 0.3;
      if (parts.body) parts.body.scale.y = (parts.body.userData.sy || parts.body.scale.y) * (1 + s * 0.05);
      for (const k in parts) {
        if (k.startsWith('leg')) parts[k].rotation.x = s * 0.5 * moveAmt * (k.endsWith('1') ? 1 : -1);
        if (k.startsWith('wing')) parts[k].rotation.z = (k.includes('-1') ? 1 : -1) * (0.3 + s * 0.5);
      }
    }
  };
}

/* =====================================================================
   ARCHITECTURE — gothic: pale stone, steep dark roofs, arched windows
   ===================================================================== */
const STONE = () => mat(0xd8d4cc, { rough: 0.92, map: 'stone' });
const STONE_D = () => mat(0x9d9890, { rough: 0.95, map: 'stone' });
const ROOF = () => mat(0x1d1a22, { rough: 0.85, map: 'roof' });
const WOOD = () => mat(0x4a3b30, { rough: 0.9, map: 'wood' });
const GLASS = () => mat(0x2a3448, { rough: 0.25, metal: 0.2, emissive: 0x1a2436, ei: 0.4 });

function buildHouse(rng, kind) {
  const g = new THREE.Group();
  const w = 6 + rng() * 4, d = 6 + rng() * 4, h = 5 + rng() * 2.5;
  const walls = box(w, h, d, STONE());
  walls.position.y = h / 2;
  walls.receiveShadow = true;
  g.add(walls);

  // steep gable roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.80, h * 0.95, 4), ROOF());
  roof.rotation.y = Math.PI / 4;
  roof.position.y = h + h * 0.47;
  g.add(roof);

  // corner pilasters
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = box(0.55, h * 1.02, 0.55, STONE_D());
    p.position.set(sx * (w / 2 - 0.2), h / 2, sz * (d / 2 - 0.2));
    g.add(p);
  }
  // arched windows
  const cols = Math.max(2, Math.floor(w / 2.6));
  for (let i = 0; i < cols; i++) {
    for (const sz of [-1, 1]) {
      const x = -w / 2 + (i + 0.5) * (w / cols);
      const win = box(0.9, 1.5, 0.2, GLASS());
      win.position.set(x, h * 0.62, sz * (d / 2 + 0.02));
      g.add(win);
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 10, 1, false, 0, Math.PI), GLASS());
      arch.rotation.set(Math.PI / 2, 0, 0);
      arch.position.set(x, h * 0.62 + 0.75, sz * (d / 2 + 0.02));
      g.add(arch);
      const frame = box(1.05, 0.12, 0.26, STONE_D());
      frame.position.set(x, h * 0.62 - 0.80, sz * (d / 2 + 0.03));
      g.add(frame);
    }
  }
  // door on +z
  const door = box(1.5, 2.6, 0.25, WOOD());
  door.position.set(0, 1.3, d / 2 + 0.05);
  g.add(door);
  const lintel = box(2.1, 0.3, 0.4, STONE_D());
  lintel.position.set(0, 2.72, d / 2 + 0.1);
  g.add(lintel);

  // trade sign, or a foaming mug for taverns
  if (kind && kind !== 'house') {
    const post = box(0.14, 1.0, 0.14, WOOD());
    post.position.set(1.6, 3.4, d / 2 + 0.2);
    g.add(post);
    const plate = box(1.6, 0.8, 0.1, mat(0x141018, { rough: 0.8 }));
    plate.position.set(1.6, 3.0, d / 2 + 0.2);
    g.add(plate);
    if (kind === 'tavern') {
      const mug = box(0.42, 0.5, 0.1, mat(0xc9a44e, { rough: 0.4, metal: 0.4 }));
      mug.position.set(1.45, 2.95, d / 2 + 0.28);
      g.add(mug);
      const foam = box(0.46, 0.12, 0.12, mat(0xf2ede2, { rough: 0.9 }));
      foam.position.set(1.45, 3.22, d / 2 + 0.28);
      g.add(foam);
    } else {
      const glyph = box(0.5, 0.5, 0.06, mat(0xd8d0bc, { rough: 0.5 }));
      glyph.position.set(1.6, 3.0, d / 2 + 0.28);
      glyph.rotation.z = Math.PI / 4;
      g.add(glyph);
    }
  }
  g.userData.radius = Math.max(w, d) * 0.6;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildTower(h, r) {
  const g = new THREE.Group();
  const shaft = cyl(r, r * 1.12, h, STONE(), 14);
  shaft.position.y = h / 2;
  g.add(shaft);
  const crown = cyl(r * 1.25, r * 1.25, 1.2, STONE_D(), 14);
  crown.position.y = h + 0.6;
  g.add(crown);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const merlon = box(0.6, 1.0, 0.6, STONE_D());
    merlon.position.set(Math.cos(a) * r * 1.15, h + 1.6, Math.sin(a) * r * 1.15);
    merlon.rotation.y = a;
    g.add(merlon);
  }
  const spire = cone(r * 1.15, h * 0.65, ROOF(), 14);
  spire.position.y = h + h * 0.33 + 1.2;
  g.add(spire);
  const finial = sph(r * 0.2, mat(0xd6b46e, { rough: 0.25, metal: 0.8 }), 10, 8);
  finial.position.y = h + h * 0.65 + 1.5;
  g.add(finial);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* Canvas-painted textures: wood grain, deck planks, sailcloth. */
function canvasTex(size, paint) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  paint(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* A roomy coastal ship: helm + 9 bench seats for the whole party. */
function buildShip() {
  const g = new THREE.Group();
  const wrng = makeRng(4451);
  // dark hull wood: strakes, grain, knots
  const woodTex = canvasTex(256, (ctx, S) => {
    ctx.fillStyle = '#4a3428'; ctx.fillRect(0, 0, S, S);
    for (let p = 0; p < 6; p++) {
      const y = (p + 0.5) * S / 6;
      ctx.fillStyle = `rgba(0,0,0,.35)`; ctx.fillRect(0, y - 1, S, 2);
      ctx.fillStyle = `rgba(255,220,170,.08)`; ctx.fillRect(0, y + 1, S, 1);
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(${20 + wrng() * 40},${12 + wrng() * 22},8,${0.12 + wrng() * 0.15})`;
        ctx.lineWidth = 0.8 + wrng();
        const yy = y - S / 12 + wrng() * S / 6;
        ctx.beginPath(); ctx.moveTo(0, yy);
        ctx.bezierCurveTo(S * 0.3, yy + (wrng() - 0.5) * 6, S * 0.7, yy + (wrng() - 0.5) * 6, S, yy);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 7; i++) {   // knots
      const x = wrng() * S, y = wrng() * S;
      ctx.fillStyle = 'rgba(25,12,6,.55)';
      ctx.beginPath(); ctx.ellipse(x, y, 2 + wrng() * 3, 1.5 + wrng() * 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,170,.15)';
      ctx.beginPath(); ctx.ellipse(x, y, 4 + wrng() * 3, 3 + wrng() * 2, 0, 0, TAU); ctx.stroke();
    }
  });
  // sun-bleached deck planks with caulk seams and butt joints
  const deckTex = canvasTex(256, (ctx, S) => {
    ctx.fillStyle = '#8a6f4e'; ctx.fillRect(0, 0, S, S);
    for (let p = 0; p < 8; p++) {
      const x = (p + 0.5) * S / 8;
      ctx.fillStyle = 'rgba(30,18,8,.5)'; ctx.fillRect(x - 1, 0, 2, S);
      ctx.fillStyle = 'rgba(255,240,210,.10)'; ctx.fillRect(x + 1, 0, 1, S);
      const jy = wrng() * S;   // butt joint
      ctx.fillStyle = 'rgba(30,18,8,.5)'; ctx.fillRect(x - S / 16, jy, S / 8, 2);
      for (let i = 0; i < 12; i++) {
        ctx.strokeStyle = `rgba(60,38,18,${0.1 + wrng() * 0.12})`;
        ctx.lineWidth = 0.8;
        const xx = x - S / 16 + wrng() * S / 8;
        ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx + (wrng() - 0.5) * 4, S); ctx.stroke();
      }
    }
  });
  // sailcloth: horizontal seams, weather stains, rose-diamond emblem
  const sailTex = canvasTex(256, (ctx, S) => {
    ctx.fillStyle = '#e8ddc4'; ctx.fillRect(0, 0, S, S);
    for (let p = 0; p <= 6; p++) {
      const y = p * S / 6;
      ctx.fillStyle = 'rgba(120,95,60,.4)'; ctx.fillRect(0, y - 1, S, 2);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, y + 1, S, 1);
    }
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = `rgba(150,120,80,${0.04 + wrng() * 0.05})`;
      ctx.beginPath(); ctx.arc(wrng() * S, wrng() * S, 6 + wrng() * 18, 0, TAU); ctx.fill();
    }
    const r = S / 2;   // emblem
    ctx.strokeStyle = '#c9a44e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(r, r, S * 0.17, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#8e0f22';
    ctx.save(); ctx.translate(r, r); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-S * 0.075, -S * 0.075, S * 0.15, S * 0.15);
    ctx.restore();
    ctx.fillStyle = '#d8b46e';
    ctx.save(); ctx.translate(r, r); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-S * 0.03, -S * 0.03, S * 0.06, S * 0.06);
    ctx.restore();
  });
  const hullM = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85, metalness: 0.05 });
  const deckM = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.9, metalness: 0.02 });
  const sparM = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xbb9a72, roughness: 0.85 });
  const trimM = mat(0xc9a44e, { rough: 0.4, metal: 0.5 });
  const sailM = new THREE.MeshStandardMaterial({ map: sailTex, roughness: 0.9, side: THREE.DoubleSide });

  const hull = box(7, 2.6, 18, hullM);
  hull.position.y = 0.4; hull.receiveShadow = true;
  g.add(hull);
  const waterline = box(7.15, 0.5, 18.15, mat(0x1d2a24, { rough: 0.9 }));
  waterline.position.y = -0.7;
  g.add(waterline);
  const bow = cone(3.5, 6, trimM, 4);
  bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  bow.scale.set(1, 1, 0.75);
  bow.position.set(0, 0.4, 11.4);
  g.add(bow);
  const stern = box(6.2, 2.2, 4.5, hullM);
  stern.position.set(0, 2.2, -8.5);
  g.add(stern);
  const deck = box(6.2, 0.3, 17, deckM);
  deck.position.y = 1.8; deck.receiveShadow = true;
  g.add(deck);
  // rails
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const post = box(0.18, 1.2, 0.18, sparM);
      post.position.set(s * 3.1, 2.5, -8 + i * 2.7);
      g.add(post);
    }
    const rail = box(0.16, 0.16, 17, sparM);
    rail.position.set(s * 3.1, 3.1, 0.5);
    g.add(rail);
  }
  // masts + sails
  for (const mz of [-2, 4.5]) {
    const mast = cyl(0.22, 0.3, 13, sparM, 10);
    mast.position.set(0, 8, mz);
    g.add(mast);
    const yard = cyl(0.12, 0.12, 7.5, sparM, 8);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 12.4, mz);
    g.add(yard);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.2, 6, 4), sailM);
    const sp = sail.geometry.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i);
      sp.setZ(i, Math.cos(x / 6.6 * Math.PI) * 0.9);   // belly of canvas
    }
    sail.geometry.computeVertexNormals();
    sail.position.set(0, 9.0, mz + 0.15);
    sail.castShadow = true;
    g.add(sail);
  }
  const bowsprit = cyl(0.14, 0.18, 7, sparM, 8);
  bowsprit.rotation.x = Math.PI / 2 - 0.25;
  bowsprit.position.set(0, 2.6, 12.5);
  g.add(bowsprit);
  // helm wheel
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.09, 8, 18), sparM);
  wheel.position.set(0, 3.2, -6.5);
  g.add(wheel);
  for (let i = 0; i < 4; i++) {
    const spoke = cyl(0.05, 0.05, 1.9, sparM, 6);
    spoke.position.copy(wheel.position);
    spoke.rotation.z = i * Math.PI / 4;
    g.add(spoke);
  }
  // 9 bench seats in two columns (helm makes 10)
  for (const [bx, bz] of [[-2.2, -3], [2.2, -3], [-2.2, 0], [2.2, 0], [-2.2, 3], [2.2, 3], [-2.2, 6], [2.2, 6], [0, 8]]) {
    const bench = box(1.8, 0.5, 0.7, deckM);
    bench.position.set(bx, 2.2, bz);
    g.add(bench);
  }
  // stern lantern + rose pennant
  const lampM = mat(0xffe6b0, { rough: 0.2, emissive: 0xffc870, ei: 1.6 });
  const lamp = sph(0.4, lampM, 10, 8);
  lamp.position.set(0, 4.6, -10.4);
  g.add(lamp);
  const lampLight = new THREE.PointLight(0xffc870, 1.2, 20, 2);
  lampLight.position.set(0, 4.6, -10.4);
  g.add(lampLight);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0),
    mat(0x8e0f22, { rough: 0.85, side: THREE.DoubleSide }));
  flag.position.set(0, 14.6, -2);
  g.add(flag);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/* A sturdy road horse with ambling legs. */
function buildHorse(coat) {
  const g = new THREE.Group();
  const bodyM = mat(coat || 0x5a4030, { rough: 0.85 });
  const darkM = mat(0x241a12, { rough: 0.9 });
  const torso = sph(0.75, bodyM, 14, 10);
  torso.scale.set(0.75, 0.85, 1.6); torso.position.y = 1.5;
  g.add(torso);
  const neck = cyl(0.28, 0.42, 1.1, bodyM, 10);
  neck.position.set(0, 2.1, 1.0); neck.rotation.x = 0.5;
  g.add(neck);
  const head = box(0.42, 0.5, 1.0, bodyM);
  head.position.set(0, 2.55, 1.55); head.rotation.x = 0.25;
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = cone(0.09, 0.28, darkM, 6);
    ear.position.set(s * 0.14, 2.85, 1.35);
    g.add(ear);
    const eye = sph(0.06, darkM, 8, 6);
    eye.position.set(s * 0.22, 2.6, 1.75);
    g.add(eye);
  }
  for (let i = 0; i < 4; i++) {   // mane ridge
    const m = box(0.1, 0.28, 0.3, darkM);
    m.position.set(0, 2.45 - i * 0.22, 0.75 - i * 0.18);
    m.rotation.x = 0.5;
    g.add(m);
  }
  const tail = cone(0.14, 1.1, darkM, 7);
  tail.position.set(0, 1.5, -1.25); tail.rotation.x = -0.5;
  g.add(tail);
  const legs = {};
  for (const [k, sx, sz] of [['FL', -0.3, 0.7], ['FR', 0.3, 0.7], ['BL', -0.3, -0.7], ['BR', 0.3, -0.7]]) {
    const leg = cyl(0.13, 0.1, 1.5, bodyM, 8);
    leg.position.set(sx, 0.75, sz);
    g.add(leg);
    legs[k] = leg;
  }
  // saddle packs for trader horses
  for (const s of [-1, 1]) {
    const pack = box(0.35, 0.5, 0.7, mat(0x6a5c48, { rough: 0.9 }));
    pack.position.set(s * 0.65, 1.65, -0.1);
    g.add(pack);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return {
    root: g, parts: legs, phase: Math.random() * TAU,
    update(dt, moveAmt) {
      this.phase += dt * (3 + moveAmt * 7);
      const s = Math.sin(this.phase);
      legs.FL.rotation.x = s * 0.55 * moveAmt;
      legs.BR.rotation.x = s * 0.55 * moveAmt;
      legs.FR.rotation.x = -s * 0.55 * moveAmt;
      legs.BL.rotation.x = -s * 0.55 * moveAmt;
      tail.rotation.z = s * 0.2;
    }
  };
}

/* Road wagons in three builds: farm cart, merchant covered wagon, war wagon. */
function buildWagon(kind) {
  const g = new THREE.Group();
  const bedM = mat(kind === 'war' ? 0x3a3f4a : 0x6a4a30, { rough: 0.85 });
  const bed = box(2.6, 0.4, 4.6, bedM);
  bed.position.y = 1.15; bed.receiveShadow = true;
  g.add(bed);
  const wheels = [];
  for (const [sx, sz] of [[-1.4, 1.5], [1.4, 1.5], [-1.4, -1.5], [1.4, -1.5]]) {
    const w = cyl(0.7, 0.7, 0.25, mat(0x2e2118, { rough: 0.9 }), 12);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx, 0.7, sz);
    g.add(w);
    wheels.push(w);
  }
  for (const s of [-1, 1]) {   // side rails
    const rail = box(0.14, 0.7, 4.6, bedM);
    rail.position.set(s * 1.3, 1.7, 0);
    g.add(rail);
  }
  for (const bz of [-1.2, 1.2]) {   // passenger benches (2 + 2)
    const bench = box(2.2, 0.45, 0.7, mat(0x54402c, { rough: 0.9 }));
    bench.position.set(0, 1.55, bz);
    g.add(bench);
  }
  const driverBench = box(2.2, 0.45, 0.6, mat(0x54402c, { rough: 0.9 }));
  driverBench.position.set(0, 1.55, 2.3);
  g.add(driverBench);
  for (const s of [-1, 1]) {   // draught shafts
    const shaft = cyl(0.08, 0.08, 3.4, bedM, 6);
    shaft.rotation.x = Math.PI / 2 - 0.08;
    shaft.position.set(s * 0.9, 1.0, 3.9);
    g.add(shaft);
  }
  if (kind === 'merchant') {   // canvas hoops + cover
    for (const hz of [-1.5, 0, 1.5]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.09, 6, 14, Math.PI), bedM);
      hoop.position.set(0, 1.6, hz);
      g.add(hoop);
    }
    const cover = box(2.5, 1.4, 3.6, mat(0xd8cdb2, { rough: 0.9 }));
    cover.position.set(0, 2.6, 0);
    cover.castShadow = true;
    g.add(cover);
    const roof = box(2.7, 0.14, 3.8, mat(0xb8ab8c, { rough: 0.9 }));
    roof.position.set(0, 3.35, 0);
    g.add(roof);
  }
  if (kind === 'war') {   // ironclad sides + front blade
    const iron = mat(0x4a4f58, { rough: 0.5, metal: 0.6 });
    for (const s of [-1, 1]) {
      const plate = box(0.12, 1.1, 4.6, iron);
      plate.position.set(s * 1.42, 1.8, 0);
      g.add(plate);
    }
    const blade = cone(0.3, 1.4, iron, 4);
    blade.rotation.x = Math.PI / 2;
    blade.position.set(0, 1.0, 2.9);
    g.add(blade);
  }
  const lampM = mat(0xffe6b0, { rough: 0.2, emissive: 0xffc870, ei: 1.4 });
  const lamp = sph(0.22, lampM, 8, 6);
  lamp.position.set(-1.1, 2.4, 2.3);
  g.add(lamp);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root: g, wheels };
}

function buildTree(rng, biome) {
  const g = new THREE.Group();
  const h = 6 + rng() * 7;
  const trunk = cyl(0.22, 0.42, h, mat(biome === 'snow' ? 0x4a4038 : 0x3f3228, { rough: 0.95, map: 'wood' }), 7);
  trunk.position.y = h / 2;
  g.add(trunk);
  const leafColor = biome === 'forest' ? 0x2a4a2e : biome === 'snow' ? 0xd8e2ee
                  : biome === 'volcano' ? 0x3a2a20 : biome === 'marsh' ? 0x3c4630 : 0x35582f;
  const lm = mat(leafColor, { rough: 0.9, flat: true, map: 'leaf' });
  if (biome === 'forest' || biome === 'snow' || biome === 'mountain') {
    for (let i = 0; i < 4; i++) {
      const c = cone(3.2 - i * 0.62, 3.6, lm, 8);
      c.position.y = h * 0.52 + i * h * 0.16;
      c.rotation.y = rng() * TAU;
      g.add(c);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const b = sph(2.4 - i * 0.35, lm, 9, 7);
      b.position.set((rng() - 0.5) * 1.8, h * 0.85 + i * 1.1, (rng() - 0.5) * 1.8);
      b.scale.y = 0.8;
      g.add(b);
    }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function buildRock(rng) {
  const g = new THREE.Group();
  const n = 2 + ((rng() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const r = 0.8 + rng() * 1.8;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat(0x7a767e, { rough: 0.98, flat: true, map: 'stone' }));
    s.position.set((rng() - 0.5) * 2.4, r * 0.55, (rng() - 0.5) * 2.4);
    s.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    s.castShadow = true;
    g.add(s);
  }
  return g;
}
