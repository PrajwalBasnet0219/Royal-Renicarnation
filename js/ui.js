/* ROYAL REINCARNATION 3D — ui.js
   Gothic chrome: bone white on ink, hairline rules, no rounded boxes.
   Every panel renders real 3D where a portrait or a doll would otherwise
   be a flat image, so nothing in this build is a picture file. */
'use strict';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

/* A tiny second renderer used for portraits and the status doll. */
const Preview = {
  renderer: null, scene: null, cam: null, subject: null, spin: 0, mount: null,
  // portraits rebuild a full character every open — free the geometry or
  // every dialogue leaks GPU memory (materials stay: shared mat() cache)
  _free(root) {
    if (!root) return;
    root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  },
  ensure() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
    const key = new THREE.DirectionalLight(0xfff4e6, 1.5); key.position.set(3, 5, 5);
    const rim = new THREE.DirectionalLight(0x9fb6e0, 0.9); rim.position.set(-4, 3, -4);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xdfe8f6, 0x30303c, 0.7));
  },
  show(mountEl, look, frame) {
    this.ensure();
    if (this.subject) { this.scene.remove(this.subject.root); this._free(this.subject.root); }
    const ch = buildCharacter(look);
    this.subject = ch;
    this.scene.add(ch.root);
    this.mount = mountEl;
    mountEl.innerHTML = '';
    mountEl.appendChild(this.renderer.domElement);
    this.frame = frame || 'bust';
    this.resize();
  },
  resize() {
    if (!this.mount || !this.renderer) return;
    const w = this.mount.clientWidth || 200, h = this.mount.clientHeight || 260;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  },
  /* Render a portrait once into a plain 2D canvas, synchronously, so it can
     never spill out of its box and every card keeps its own picture. */
  snapPortrait(mount, look, frame) {
    this.ensure();
    if (this.subject) { this.scene.remove(this.subject.root); this._free(this.subject.root); }
    const ch = buildCharacter(look);
    this.subject = ch;
    ch.update(0.016, 0, null);
    ch.root.rotation.y = 0.35;
    this.scene.add(ch.root);
    const w = mount.clientWidth || 110, h = mount.clientHeight || 140;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    if (frame === 'bust') { this.cam.position.set(0, 1.62, 1.35); this.cam.lookAt(0, 1.56, 0); }
    else { this.cam.position.set(0, 1.05, 4.0); this.cam.lookAt(0, 0.95, 0); }
    this.renderer.render(this.scene, this.cam);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(this.renderer.domElement, 0, 0, w, h);
    mount.innerHTML = '';
    mount.appendChild(c);
    this.scene.remove(ch.root);
    this._free(ch.root);
    this.subject = null;
  },
  tick(dt) {
    if (!this.subject || !this.mount || !this.mount.isConnected) return;
    this.spin += dt * 0.45;
    const ch = this.subject;
    ch.update(dt, 0, null);
    ch.root.rotation.y = Math.sin(this.spin) * 0.55;
    if (this.frame === 'bust') this.cam.position.set(0, 1.62, 1.35);
    else this.cam.position.set(0, 1.05, 4.0);
    this.cam.lookAt(0, this.frame === 'bust' ? 1.56 : 0.95, 0);
    this.renderer.render(this.scene, this.cam);
  },
  clear() {
    if (this.subject) { this.scene.remove(this.subject.root); this._free(this.subject.root); this.subject = null; }
    this.mount = null;
  }
};

const UI = {
  ring: null, panel: null, activeTab: null, typing: null, dlgAfter: null, dlgLocked: false,
  cmdOpen: false,

  init() {
    this.buildRing();
    $('panel-close').onclick = () => this.closePanel();
    $('dlg-next').onclick = () => this.advance();
    $('dlg').addEventListener('click', e => {
      if (e.target.closest('button') || e.target.tagName === 'INPUT') return;
      this.advance();
    });
    addEventListener('resize', () => Preview.resize());
  },

  /* ---------------- radial pause ring ---------------- */
  TABS: [
    { id: 'quests',  glyph: '❧', label: 'Chronicle' },
    { id: 'bonds',   glyph: '♥', label: 'Bonds' },
    { id: 'status',  glyph: '✥', label: 'Status' },
    { id: 'bag',     glyph: '❖', label: 'Effects' },
    { id: 'map',     glyph: '✦', label: 'Realm' },
    { id: 'fate',    glyph: '⛓', label: 'Fatechain' },
    { id: 'save',    glyph: '✒', label: 'Records' },
    { id: 'options', glyph: '⚙', label: 'Settings' }
  ],

  buildRing() {
    const r = $('ring');
    this.ring = r;
    const n = this.TABS.length;
    this.TABS.forEach((t, i) => {
      const a = (i / n) * TAU - Math.PI / 2;
      const orb = el('button', 'orb', `<span class="g">${t.glyph}</span><span class="l">${t.label}</span>`);
      orb.style.setProperty('--x', (Math.cos(a) * 190).toFixed(1) + 'px');
      orb.style.setProperty('--y', (Math.sin(a) * 190).toFixed(1) + 'px');
      orb.style.setProperty('--d', (i * 34) + 'ms');
      orb.onclick = () => { Sound.sfx('ui'); this.openPanel(t.id); };
      r.appendChild(orb);
    });
    const core = el('div', 'ring-core', '<b>Royal<br>Reincarnation</b><span>Esc to return</span>');
    r.appendChild(core);
  },

  toggleRing(force) {
    const open = force != null ? force : !this.ring.classList.contains('open');
    this.ring.classList.toggle('open', open);
    $('ring-veil').classList.toggle('open', open);
    Input.context = open ? 'menu' : (Game.started ? 'play' : 'ui');
    if (open) { Input.release(); Sound.sfx('ui'); } else Sound.sfx('back');
  },

  /* ---------------- HUD ---------------- */
  refresh() {
    const p = Entities.player;
    if (!p) return;
    $('hp-fill').style.width = clamp(p.hp / p.maxhp * 100, 0, 100) + '%';
    $('hp-num').textContent = Math.ceil(p.hp) + ' / ' + p.maxhp;
    $('fo-fill').style.width = clamp(p.focus / p.maxfocus * 100, 0, 100) + '%';
    $('tune-fill').style.width = clamp(Game.tuning, 0, 100) + '%';
    $('tune-num').textContent = Math.floor(Game.tuning);
    $('lvl-num').textContent = Game.level;
    const dp = World.dayPhase ? World.dayPhase() : ['☀', 'Day'];
    const wg = World.weather && World.weather.kind !== 'clear'
      ? ' ' + ({ rain: '☂', storm: '⚡', snow: '❄', leaves: '🍂', petals: '🌸', ash: '♨', fog: '≋', tornado: '◉' }[World.weather.kind] || '')
      : '';
    const dps = dp[0] + ' ' + dp[1] + wg;
    if (this._dayphase !== dps) { this._dayphase = dps; $('dayphase').textContent = dps; }
    if (typeof SPELLS !== 'undefined' && SPELLS[Game.elem]) {
      const S = SPELLS[Game.elem];
      $('elem-num').textContent = S.name.toUpperCase();
      $('elem-num').style.color = '#' + S.color.toString(16).padStart(6, '0');
    }

    // boss bar: nearest living guardian within earshot
    const boss = Entities.mobs.find(m => !m.dead && m.def.boss &&
      dist2D(Entities.player.x, Entities.player.z, m.x, m.z) < 70);
    const bb = $('bossbar');
    if (bb) {
      if (boss) {
        bb.classList.remove('off');
        $('boss-name').textContent = '☠ ' + boss.def.name;
        $('boss-fill').style.width = clamp(boss.hp / boss.maxhp * 100, 0, 100) + '%';
      } else bb.classList.add('off');
    }

    const q = Game.quest();
    $('q-title').textContent = q ? q.title : 'Arc One complete';
    $('q-line').textContent = q ? Game.objectiveLine(q) : 'Avelune is yours to wander.';
    $('q-act').textContent = q ? 'Act ' + q.act + ' — ' + ACTS[q.act].title : '';

    const party = $('party');
    const roster = Entities.companions;
    if (party.childElementCount !== roster.length) {
      party.innerHTML = '';
      roster.forEach(h => {
        const c = el('div', 'mate');
        c.innerHTML = `<div class="mhead"><b>${h.def.name.split(' ')[0]}</b><span class="pct"></span></div>
          <div class="mbar"><i></i></div><div class="mbar f"><i></i></div>`;
        party.appendChild(c);
      });
    }
    roster.forEach((h, i) => {
      const c = party.children[i];
      if (!c) return;
      const hpP = Math.round(clamp(h.hp / h.maxhp * 100, 0, 100));
      const mpP = Math.round(clamp((h.focus || 0) / (h.maxfocus || 1) * 100, 0, 100));
      const bars = c.querySelectorAll('i');
      bars[0].style.width = hpP + '%';
      bars[1].style.width = mpP + '%';
      c.querySelector('.pct').textContent = hpP + '% · ' + mpP + '%';
      c.title = h.downT > 0 ? 'recovering' : h.command;
      c.classList.toggle('down', h.downT > 0);
    });
    this._compT = (this._compT || 0) + 1;
    if ((this._compT & 7) === 0) this.refreshCompass();
    if ((this._compT & 15) === 0) this.drawMini();
  },

  /* A slim heading strip: cardinals, main-quest star, known dungeon
     mouths, and every unrecruited heroine — one glance tells you
     where everyone and everything is. */
  refreshCompass() {
    const box = $('cmarks');
    if (!box) return;
    if (World.mode !== 'overworld' || !Game.started) { box.innerHTML = ''; return; }
    const p = Entities.player;
    const heading = Math.atan2(Math.sin(Camera3.yaw), -Math.cos(Camera3.yaw));
    const rel = a => ((a - heading + Math.PI * 3) % TAU) - Math.PI;
    const RANGE = 1.35, pos = r => (50 + r / RANGE * 50).toFixed(1);
    const mark = (x, z, cls, glyph, title, extra) => {
      const r = rel(Math.atan2(x - p.x, -(z - p.z)));
      if (Math.abs(r) > RANGE) return '';
      return `<span class="${cls}" title="${title}" style="left:${pos(r)}%${extra || ''}">${glyph}</span>`;
    };
    let html = '';
    [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]].forEach(([L, a]) => {
      const r = rel(a);
      if (Math.abs(r) < RANGE) html += `<span class="cdir" style="left:${pos(r)}%">${L}</span>`;
    });
    const q = Game.quest();
    const qHero = q && q.goal.kind === 'talk' ? q.goal.who : null;
    // ★ main quest: whoever or wherever it points at
    const t = Game.targetPoint();
    if (t && q) {
      const isHeroineSpot = q.goal.kind === 'talk' &&
        Entities.npcs.some(n => n.type === 'heroine' && n.id === qHero &&
          Math.hypot(n.x - t.x, n.z - t.z) < 1);
      if (!isHeroineSpot) html += mark(t.x, t.z, 'cdot q', '★', q.title);
    }
    // ▲ entered dungeon mouths (quests point at theirs with ★ regardless)
    for (const d of DUNGEONS) {
      if (!Game.flags['entered_' + d.id]) continue;
      if (dist2D(p.x, p.z, d.x, d.z) < 12) continue;
      html += mark(d.x, d.z, 'cdot d', '▲', d.name);
    }
    // ♥ the sealed girl: sensed once the Tarn is known, until she is freed
    if (!Game.met.liora) {
      const deep = DUNGEONS.find(d => d.id === 'tarn-depths');
      if (deep && (Game.flags.clue_tarn || Game.visited.tarn) && dist2D(p.x, p.z, deep.x, deep.z) >= 12)
        html += mark(deep.x, deep.z, 'cdot q', '♥', 'A sealed girl waits');
    }
    // answering ship: gold S so you can watch her come in
    const sh = Entities.ship;
    if (sh && sh.summon) html += mark(sh.x, sh.z, 'cdot d', 'S', 'Your ship (answering)');
    // escort client: never lose your trader
    if (Game.escort && Game.escort.npc) {
      const E = Game.escort;
      html += mark(E.npc.x, E.npc.z, 'cdot e', '!', 'Escort: ' + E.npc.name);
    }
    // heroine initials in their hair color (? if unmet, ★ if quest target)
    for (const n of Entities.npcs) {
      if (n.type !== 'heroine' || n.recruited) continue;
      const d = dist2D(p.x, p.z, n.x, n.z);
      if (d < 12) continue;   // beside you — no arrow needed
      const met = Game.met[n.id];
      if (n.id === qHero) html += mark(n.x, n.z, 'cdot q', '★', n.def.name);
      else {
        const col = '#' + n.def.look.hair.toString(16).padStart(6, '0');
        html += mark(n.x, n.z, 'cdot', met ? n.def.name[0] : '?', met ? n.def.name : 'someone', `;color:${col}`);
      }
    }
    box.innerHTML = html;
  },

  /* North-up minimap for the top-right corner: cached terrain blitted
     around the player plus sites, quest star, terrors, ship and party.
     Throttled by the caller — a few Hz is plenty for a 420 m window. */
  drawMini() {
    const cv = $('minimap');
    if (!cv || !Game.started || !Entities.player) return;
    const S = cv.width;
    const g = cv.getContext('2d');
    g.fillStyle = '#0c0a10';
    g.fillRect(0, 0, S, S);
    // circular dial: everything below is clipped to the lens
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 1, 0, TAU);
    g.clip();
    if (World.mode !== 'overworld') {
      g.fillStyle = 'rgba(232,228,218,.5)';
      g.font = '400 12px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(World.mode === 'dungeon' ? '— below —' : '— indoors —', S / 2, S / 2);
      g.restore();
      return;
    }
    if (!this._mapCache) this.renderMapCache();
    const p = Entities.player;
    const R = 420;
    const N = this._mapCache.width;
    const sx = (p.x - R + EXTENT) / (EXTENT * 2) * N;
    const sy = (p.z - R + EXTENT) / (EXTENT * 2) * N;
    const sw = (R * 2) / (EXTENT * 2) * N;
    g.imageSmoothingEnabled = true;
    g.drawImage(this._mapCache, sx, sy, sw, sw, 0, 0, S, S);
    const proj = (x, z) => ({ x: (x - (p.x - R)) / (R * 2) * S, y: (z - (p.z - R)) / (R * 2) * S });
    const on = q => q.x > -12 && q.y > -12 && q.x < S + 12 && q.y < S + 12;
    g.textAlign = 'center';
    // compass rose corner
    g.fillStyle = 'rgba(232,228,218,.75)';
    g.font = '700 10px system-ui, sans-serif';
    g.fillText('N', S / 2, 12);
    // towns: hollow for rumors, solid for footprints
    for (const s of SITES) {
      const q = proj(s.x, s.z);
      if (!on(q)) continue;
      if (Game.visited[s.id]) {
        g.fillStyle = '#e8e4da';
        g.beginPath(); g.arc(q.x, q.y, 3, 0, TAU); g.fill();
      } else {
        g.strokeStyle = 'rgba(232,228,218,.4)';
        g.lineWidth = 1;
        g.beginPath(); g.arc(q.x, q.y, 2.5, 0, TAU); g.stroke();
      }
    }
    // quest star
    const t = Game.targetPoint();
    if (t && Game.quest()) {
      const q = proj(t.x, t.z);
      if (on(q)) {
        g.fillStyle = '#ffd27a';
        g.font = '700 13px system-ui, sans-serif';
        g.fillText('★', q.x, q.y - 4);
      }
    }
    // terror lairs
    if (Game.flags.leftCastle && Entities.worldBosses) {
      g.font = '700 11px system-ui, sans-serif';
      for (const L of Entities.worldBosses) {
        if (!MOBS[L.key]) continue;
        const q = proj(L.x, L.z);
        if (!on(q)) continue;
        const alive = Entities.mobs.some(m => !m.dead && m.key === L.key);
        g.fillStyle = alive ? '#e04860' : 'rgba(224,72,96,.4)';
        g.fillText('☠', q.x, q.y);
      }
    }
    // your ship + ferries in gold
    g.strokeStyle = '#d8c188'; g.lineWidth = 1.5;
    const dia = q => {
      g.beginPath();
      g.moveTo(q.x, q.y - 4); g.lineTo(q.x + 4, q.y);
      g.lineTo(q.x, q.y + 4); g.lineTo(q.x - 4, q.y);
      g.closePath(); g.stroke();
    };
    if (Entities.ship) { const q = proj(Entities.ship.x, Entities.ship.z); if (on(q)) dia(q); }
    if (Entities.ferries) for (const F of Entities.ferries) {
      const q = proj(F.x, F.z); if (on(q)) dia(q);
    }
    // party in rose
    g.fillStyle = '#ff9ec4';
    for (const h of Entities.companions) {
      const q = proj(h.x, h.z);
      if (!on(q)) continue;
      g.beginPath(); g.arc(q.x, q.y, 2, 0, TAU); g.fill();
    }
    // you: white arrowhead on your camera heading
    const fx = Math.sin(Camera3.yaw), fz = Math.cos(Camera3.yaw);
    const ang = Math.atan2(fx, -fz);
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(ang);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
    // bright rim so the lens reads against any sky
    g.restore();
    g.strokeStyle = 'rgba(216,193,138,.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 2, 0, TAU);
    g.stroke();
  },

  toast(msg, kind) {
    const t = el('div', 'toast' + (kind ? ' ' + kind : ''), msg);
    $('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 3200);
  },

  prompt(text) {
    const e = $('prompt');
    if (!text) { e.classList.add('off'); return; }
    e.classList.remove('off');
    e.innerHTML = text;
  },

  banner(title, sub) {
    const b = $('banner');
    b.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  },

  /* Battle meter: every landed hit lands here too — who, how much,
     crits called out, bosses marked. A fresh 5 s of silence starts a
     new encounter; the last total lingers, then the plate fades. */
  dmgHit(src, amt, crit, boss) {
    const now = performance.now();
    const D = this._dmg || (this._dmg = { rows: [], total: 0, bySrc: {}, lastT: 0 });
    if (now - (D.lastT || 0) > 5000) { D.rows = []; D.total = 0; D.bySrc = {}; }
    D.lastT = now;
    const n = Math.round(amt);
    D.total += n;
    const who = src === 'You' ? 'You' : String(src).split(' ')[0];
    D.bySrc[who] = (D.bySrc[who] || 0) + n;
    D.rows.push({ who, n, crit: !!crit, boss: !!boss });
    if (D.rows.length > 6) D.rows.shift();
    clearTimeout(D.sumT); clearTimeout(D.hideT);
    const plate = $('dmglog-plate'), log = $('dmglog'), tot = $('dmgtotal');
    if (!plate || !log) return;
    plate.classList.remove('off');
    plate.style.opacity = 1;
    const fmt = v => v >= 10000 ? (v / 1000).toFixed(1) + 'k' : String(v);
    log.innerHTML = D.rows.map(r =>
      `<div class="drow${r.crit ? ' crit' : ''}"><span>${r.boss ? '☠' : ''}${r.who}</span><b>${r.crit ? 'CRIT ' : ''}${fmt(r.n)}</b></div>`
    ).join('');
    const parts = Object.keys(D.bySrc).map(k => `${k} ${fmt(D.bySrc[k])}`);
    tot.innerHTML = `<span>Total ${fmt(D.total)}</span><em>${parts.join(' · ')}</em>`;
    // 5 s of silence: freeze the total as the summary, then fade away
    D.sumT = setTimeout(() => {
      const l2 = $('dmglog'), t2 = $('dmgtotal'), p2 = $('dmglog-plate');
      if (!l2 || !this._dmg) return;
      l2.innerHTML = '';
      t2.innerHTML = `<span>Total ${fmt(this._dmg.total)}</span><em>${Object.keys(this._dmg.bySrc).map(k => `${k} ${fmt(this._dmg.bySrc[k])}`).join(' · ')}</em>`;
      p2.style.opacity = 0;
      this._dmg.hideT = setTimeout(() => {
        const p3 = $('dmglog-plate');
        if (p3) p3.classList.add('off');
        this._dmg.rows = []; this._dmg.total = 0; this._dmg.bySrc = {};
      }, 1000);
    }, 5000);
  },

  /* ---------------- dialogue ---------------- */
  say(who, text, opts) {
    opts = opts || {};
    const d = $('dlg');
    d.classList.remove('off');
    Input.context = 'dialogue';
    Input.release();
    $('dlg-who').textContent = who || '';
    $('dlg-sub').textContent = opts.sub || '';
    $('dlg-choices').innerHTML = '';
    this.dlgLocked = false;
    this.dlgAfter = opts.then || null;

    const port = $('dlg-port');
    if (opts.look) { port.classList.remove('off'); Preview.show(port, opts.look, 'bust'); }
    else { port.classList.add('off'); Preview.clear(); }

    const cps = [0, 20, 40, 85, 9999][Settings.textSpeed] || 40;
    const target = $('dlg-text');
    if (this.typing) clearInterval(this.typing.timer);

    const finish = () => {
      $('dlg-next').textContent = this.dlgAfter ? 'Continue  ·  E' : 'Close  ·  E';
      if (opts.choices) this.showChoices(opts.choices);
    };
    if (cps > 900) { target.textContent = text; this.typing = null; finish(); }
    else {
      target.textContent = '';
      let i = 0;
      $('dlg-next').textContent = 'Skip  ·  E';
      const timer = setInterval(() => {
        i += Math.max(1, Math.round(cps / 30));
        target.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(timer); this.typing = null; finish(); }
      }, 1000 / 30);
      this.typing = { timer, text, target, finish };
    }
  },

  showChoices(list) {
    this.dlgLocked = true;
    const c = $('dlg-choices');
    c.innerHTML = '';
    list.forEach((o, i) => {
      const b = el('button', 'choice', `<em>${i + 1}</em>${o.text}`);
      b.onclick = ev => { ev.stopPropagation(); Sound.sfx('ui'); this.dlgLocked = false; this.hideDialog(); o.go(); };
      c.appendChild(b);
    });
    $('dlg-next').style.visibility = 'hidden';
  },

  advance() {
    if (this.typing) {
      clearInterval(this.typing.timer);
      this.typing.target.textContent = this.typing.text;
      const f = this.typing.finish; this.typing = null; f();
      return;
    }
    if (this.dlgLocked) return;
    const then = this.dlgAfter;
    this.dlgAfter = null;
    this.hideDialog();
    if (then) then();
  },

  hideDialog() {
    $('dlg').classList.add('off');
    $('dlg-next').style.visibility = 'visible';
    if (this.typing) { clearInterval(this.typing.timer); this.typing = null; }
    Preview.clear();
    if (!this.activeTab && !this.ring.classList.contains('open')) {
      Input.context = Game.started ? 'play' : 'ui';
    }
  },

  askName(cb) {
    $('dlg').classList.remove('off');
    $('dlg-who').textContent = 'Scribe Aldo';
    $('dlg-sub').textContent = 'the ledger of arrivals';
    $('dlg-text').textContent = 'The book wants a name. Whatever you say now is what Avelune will call you.';
    $('dlg-next').style.visibility = 'hidden';
    const c = $('dlg-choices');
    c.innerHTML = '';
    const row = el('div', 'namerow');
    row.innerHTML = '<input id="nm" maxlength="14" autocomplete="off" placeholder="write your name"><button class="choice" id="nmok">Set it down</button>';
    c.appendChild(row);
    this.dlgLocked = true;
    Input.context = 'typing';
    const inp = $('nm');
    setTimeout(() => inp.focus(), 60);
    const done = () => {
      const v = (inp.value || '').trim().slice(0, 14) || 'Ashen';
      this.dlgLocked = false;
      Input.context = 'dialogue';
      this.hideDialog();
      cb(v);
    };
    $('nmok').onclick = e => { e.stopPropagation(); done(); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(); };
  },

  /* ---------------- command wheel ---------------- */
  COMMANDS: [
    { id: 'follow', glyph: '⇢', label: 'Stay close' },
    { id: 'attack', glyph: '⚔', label: 'Engage' },
    { id: 'guard',  glyph: '⛨', label: 'Guard me' },
    { id: 'hold',   glyph: '✖', label: 'Hold here' }
  ],

  toggleCommand(force) {
    const roster = Entities.companions;
    if (!roster.length) { this.toast('Nobody is travelling with you yet.'); return; }
    const open = force != null ? force : !this.cmdOpen;
    this.cmdOpen = open;
    const w = $('cmd-wheel');
    w.classList.toggle('open', open);
    if (open) {
      w.innerHTML = '';
      this.COMMANDS.forEach((c, i) => {
        const a = (i / this.COMMANDS.length) * TAU - Math.PI / 2;
        const b = el('button', 'corb', `<span class="g">${c.glyph}</span><span class="l">${c.label}</span>`);
        b.style.setProperty('--x', (Math.cos(a) * 118).toFixed(1) + 'px');
        b.style.setProperty('--y', (Math.sin(a) * 118).toFixed(1) + 'px');
        b.style.setProperty('--d', (i * 30) + 'ms');
        b.onclick = () => { Game.orderParty(c.id); this.toggleCommand(false); };
        w.appendChild(b);
      });
      w.appendChild(el('div', 'cmd-core', '<b>Orders</b>'));
      Input.context = 'menu';
      Input.release();
    } else {
      Input.context = Game.started ? 'play' : 'ui';
    }
    Sound.sfx(open ? 'ui' : 'back');
  },

  /* ---------------- panels ---------------- */
  openPanel(tab) {
    this.activeTab = tab;
    this.toggleRing(false);
    // on the title screen the big title sits above everything — fade it out
    // while a panel (e.g. Settings) is open so the texts never overlap
    if (!Game.started) $('title').classList.add('off');
    const p = $('panel');
    p.classList.add('open');
    Input.context = 'menu';
    Input.release();
    const t = this.TABS.find(x => x.id === tab);
    $('panel-title').innerHTML = `<span class="pg">${t.glyph}</span>${t.label}`;
    const body = $('panel-body');
    body.innerHTML = '';
    this['tab_' + tab](body);
    Sound.sfx('ui');
  },

  closePanel() {
    $('panel').classList.remove('open');
    this.activeTab = null;
    Preview.clear();
    // restore the title if we are still on the main menu
    if (!Game.started) $('title').classList.remove('off');
    Input.context = Game.started ? 'play' : 'ui';
    Sound.sfx('back');
  },

  tab_status(b) {
    const p = Entities.player, d = Game.derived();
    b.innerHTML = `
      <div class="statwrap">
        <div class="doll"><div id="doll-mount"></div><div class="doll-base"></div></div>
        <div class="statcols">
          <section class="frame">
            <h3>${Game.playerName || 'Unnamed outsider'}</h3>
            <p class="sub">Level ${Game.level} · ${Game.xp} / ${Game.xpNeed()} experience</p>
            <div class="rows">
              <div><span>Vitality</span><b>${Math.ceil(p.hp)} / ${p.maxhp}</b></div>
              <div><span>Focus</span><b>${Math.floor(p.focus)} / ${p.maxfocus}</b></div>
              <div><span>Strike</span><b>${d.atk}</b></div>
              <div><span>Guard</span><b>${d.def}</b></div>
              <div><span>Crit rate</span><b>${d.critR.toFixed(1)}% (max 60)</b></div>
              <div><span>Crit dmg</span><b>${Math.round(d.critD)}% (max 300)</b></div>
              <div><span>Veil tuning</span><b>${Math.floor(Game.tuning)} / 100</b></div>
              <div><span>Crowns</span><b>${Game.gold}</b></div>
            </div>
          </section>
          <section class="frame">
            <h3>Worn</h3>
            <div class="wearrow" id="wear"></div>
            <p class="sub">${Game.tuning < 12
              ? 'Low tuning dulls your stride. Company, food and rest tune you.'
              : Game.tuning < 40 ? 'Moving freely. The castle ward still wants forty.'
              : Game.tuning < 70 ? 'Tuned enough to travel. Long distances still cost you.'
              : 'Fully tuned. The air stopped arguing with you some time ago.'}</p>
          </section>
          <section class="frame">
            <h3>Standing</h3>
            <div class="rows" id="rep"></div>
            <p class="sub">Earned, never bought. The cult notices kindness; the rest notice deeds.</p>
          </section>
        </div>
      </div>`;
    Preview.show($('doll-mount'), p.look, 'full');
    const rep = $('rep');
    if (rep && typeof FACTIONS !== 'undefined') {
      FACTIONS.forEach(f => {
        const r = el('div');
        r.title = `${f.symbol}. ${f.about}`;
        r.innerHTML = `<span>${f.name}</span><b>${Game.repTier(f.id)}</b>`;
        rep.appendChild(r);
      });
    }
    const wear = $('wear');
    ['weapon', 'armor', 'charm'].forEach(slot => {
      const id = Game.equip[slot];
      const it = id ? ITEMS[id] : null;
      const s = el('div', 'wearslot' + (it ? ' on' : ''));
      s.innerHTML = `<span class="sl">${slot}</span><b>${it ? it.name : '—'}</b>`;
      if (it) {
        const rm = el('button', 'mini', 'Remove');
        rm.onclick = () => { Game.unequip(slot); this.openPanel('status'); };
        s.appendChild(rm);
      }
      wear.appendChild(s);
    });
  },

  tab_bag(b) {
    const keys = Object.keys(Game.bag).filter(k => Game.bag[k] > 0);
    b.innerHTML = '<div class="grid" id="bagrid"></div>';
    const g = $('bagrid');
    if (!keys.length) { g.innerHTML = '<p class="sub">Nothing on you. Chests and shopkeepers both exist.</p>'; return; }
    keys.forEach(k => {
      const it = ITEMS[k];
      if (!it) return;
      const c = el('section', 'frame item');
      c.innerHTML = `<h4>${it.name}<em>×${Game.bag[k]}</em></h4><p class="sub">${it.desc}</p>`;
      if (it.slot || it.use) {
        const btn = el('button', 'mini', it.slot ? 'Equip' : 'Use');
        btn.onclick = () => { it.slot ? Game.equipItem(k) : Game.useItem(k); this.openPanel('bag'); };
        c.appendChild(btn);
      }
      g.appendChild(c);
    });
  },

  tab_bonds(b) {
    b.innerHTML = '<div class="grid bonds" id="bg"></div>';
    const g = $('bg');
    HEROINES.forEach(h => {
      const met = Game.met[h.id];
      const aff = Game.aff[h.id] || 0;
      const lvl = Game.bondLevel(h.id);
      // research card: battle level, known arts, and the next art to grow into
      const live = Entities.heroineOf && Entities.heroineOf[h.id];
      const blvl = live ? (live.lvl || 1) : 1;
      const arts = live && live.skills && live.skills.length ? live.skills.join(' · ') : 'still finding her art';
      let nextArt = '';
      if (typeof heroSpells === 'function') {
        const table = heroSpells({ def: h });
        const upcoming = Object.keys(table).map(Number).sort((a, b) => a - b)
          .find(L => L > blvl && !(live && live.skills && live.skills.includes(table[L])));
        nextArt = upcoming ? ` · next: ${table[upcoming]} at Lv ${upcoming}` : (met ? ' · art complete' : '');
      }
      // personal gear + uncapped gacha crit, read straight off her level
      let gearTxt = '';
      if (met && live && typeof heroGearBonus === 'function' && typeof heroGearName === 'function') {
        const gb = heroGearBonus(live);
        gearTxt = ` · ${heroGearName(live)} · crit ${(5 + blvl * 0.3 + gb.tier * 0.5).toFixed(1)}% (no max)`;
      }
      const c = el('section', 'frame bond');
      c.innerHTML = `
        <div class="bportrait" data-id="${h.id}"></div>
        <div class="binfo">
          <h4>${met ? h.name : '— unmet —'}</h4>
          <p class="tags"><em>${h.arche}</em><em>${h.race}</em><em>${h.combat}</em></p>
          <p class="sub">${met ? h.blurb : 'Your paths have not crossed.'}</p>
          <div class="hbar"><i style="width:${clamp(aff / 21 * 100, 0, 100)}%"></i></div>
          <p class="sub">Bond ${lvl} of 7${met ? ' · likes ' + h.likes : ''}</p>
          <p class="sub">Battle Lv ${blvl} · ${met ? arts + nextArt + gearTxt : 'her art is still sealed to you'}</p>
        </div>`;
      g.appendChild(c);
    });
    // snapshot every met heroine once — each card keeps its own still portrait
    g.querySelectorAll('.bportrait').forEach(m => {
      const h = HEROINES.find(x => x.id === m.dataset.id);
      if (Game.met[h.id]) Preview.snapPortrait(m, h.look, 'bust');
    });
  },

  tab_quests(b) {
    const q = Game.quest();
    let html = q
      ? `<section class="frame now">
           <p class="eyebrow">Act ${q.act} — ${ACTS[q.act].title}</p>
           <h3>${q.title}</h3><p>${q.text}</p>
           <p class="obj">${Game.objectiveLine(q)}</p></section>`
      : '<section class="frame now"><h3>Arc One closed</h3><p>What you do now is between you and the seven.</p></section>';
    html += '<div class="grid">';
    ACTS.forEach(a => {
      const total = QUESTS.filter(x => x.act === a.n).length;
      const done = QUESTS.filter(x => x.act === a.n && Game.doneQuests[x.id]).length;
      const cur = q && q.act === a.n;
      html += `<section class="frame act ${done === total ? 'done' : cur ? 'cur' : ''}">
        <h4>Act ${a.n} — ${a.title}</h4>
        <p class="sub">${a.where}</p>
        <p>${a.summary}</p>
        <p class="sub">${done} of ${total}</p></section>`;
    });
    html += '</div>';
    html += '<section class="frame"><h3>What you have not been told</h3><ul class="secrets">' +
      LORE.secrets.map((s, i) => `<li class="${Game.secretsKnown > i ? 'lit' : ''}">${Game.secretsKnown > i ? s : '— sealed —'}</li>`).join('') +
      '</ul></section>';
    // the codex: what the world has taught you, kept
    const known = (typeof CODEX !== 'undefined' ? CODEX : []).filter(e => Game.codex[e.id]);
    const locked = (typeof CODEX !== 'undefined' ? CODEX.length : 0) - known.length;
    html += '<section class="frame"><h3>Codex</h3><ul class="secrets">' +
      known.map(e => `<li class="lit"><b>${e.title}.</b> ${e.text}</li>`).join('') +
      (locked > 0 ? `<li>${locked} page${locked > 1 ? 's' : ''} still unwritten — plaques, rumors and ruins teach.</li>` : '') +
      '</ul></section>';
    // active guild writ + escort, so side work is never forgotten
    if (Game.bounty) {
      html += `<section class="frame now"><h3>Writ: ${Game.bounty.name}</h3>` +
        `<p class="obj">${Game.bounty.have} of ${Game.bounty.need} — ${Game.bounty.reward} crowns on completion</p></section>`;
    }
    if (Game.escort && Game.escort.npc) {
      html += `<section class="frame now"><h3>Escort: ${Game.escort.npc.name}</h3>` +
        `<p class="obj">See them to ${Game.escort.site.name}. Do not lose the road.</p></section>`;
    }
    b.innerHTML = html;
  },

  /* Realm map view: centre + zoom. zoom=1 fits the whole 12 km chart. */
  mapView: { cx: 0, cz: 0, zoom: 1 },
  _mapCache: null,

  tab_map(b) {
    // reset the view each time the panel opens, centred on the player
    this.mapView = { cx: clamp(Entities.player.x, -EXTENT, EXTENT), cz: clamp(Entities.player.z, -EXTENT, EXTENT), zoom: 1 };
    b.innerHTML = `<div class="maphead">
        <span class="sub">Drag to pan · wheel or +/− to zoom · click a discovered site to travel. Ochre lines are roads, pale rings are waystones, ☠ marks terror lairs.</span>
        <span class="mapctl"><button id="map-zin">+</button><button id="map-zout">−</button><button id="map-zreset">Reset</button></span>
      </div><div class="mapframe"><canvas id="worldmap"></canvas></div>
      <div class="sitelist" id="sitelist"></div>`;
    const cv = $('worldmap');
    const draw = () => {
      const f = cv.parentElement;
      cv.width = f.clientWidth; cv.height = f.clientHeight;
      this.drawMap(cv);
    };
    // drag-pan; a press without drag still counts as a click-to-travel
    let drag = null;
    cv.onmousedown = e => { drag = { x: e.clientX, y: e.clientY, cx: this.mapView.cx, cz: this.mapView.cz, moved: 0 }; };
    addEventListener('mousemove', e => {
      if (!drag || !$('worldmap')) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
      const R = EXTENT / this.mapView.zoom;
      this.mapView.cx = clamp(drag.cx - dx / cv.width * R * 2, -EXTENT, EXTENT);
      this.mapView.cz = clamp(drag.cz - dy / cv.height * R * 2, -EXTENT, EXTENT);
      this.drawMap(cv);
    });
    addEventListener('mouseup', e => {
      if (!drag || !$('worldmap')) { drag = null; return; }
      const wasClick = drag.moved < 6;
      drag = null;
      if (!wasClick) return;
      const rect = cv.getBoundingClientRect();
      const s = this.mapHit(cv, e.clientX - rect.left, e.clientY - rect.top);
      if (s && Game.visited[s.id]) Game.fastTravel(s);
    });
    cv.onwheel = e => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const before = this.mapUnproject(cv, mx, my);
      this.mapView.zoom = clamp(this.mapView.zoom * (e.deltaY < 0 ? 1.25 : 0.8), 1, 8);
      // keep the point under the cursor anchored while zooming
      const R = EXTENT / this.mapView.zoom;
      this.mapView.cx = clamp(before.x - (mx / cv.width * R * 2 - R), -EXTENT, EXTENT);
      this.mapView.cz = clamp(before.z - (my / cv.height * R * 2 - R), -EXTENT, EXTENT);
      this.drawMap(cv);
    };
    $('map-zin').onclick = () => { this.mapView.zoom = clamp(this.mapView.zoom * 1.4, 1, 8); this.drawMap(cv); };
    $('map-zout').onclick = () => { this.mapView.zoom = clamp(this.mapView.zoom / 1.4, 1, 8); this.drawMap(cv); };
    $('map-zreset').onclick = () => {
      this.mapView = { cx: clamp(Entities.player.x, -EXTENT, EXTENT), cz: clamp(Entities.player.z, -EXTENT, EXTENT), zoom: 1 };
      this.drawMap(cv);
    };
    requestAnimationFrame(draw);
    const list = $('sitelist');
    SITES.forEach(s => {
      const seen = Game.visited[s.id];
      const c = el('button', 'siteb' + (seen ? ' seen' : ''), `<b>${seen ? s.name : '???'}</b><span>${seen ? s.kind : 'undiscovered'}</span>`);
      c.onclick = () => { if (seen) Game.fastTravel(s); };
      list.appendChild(c);
    });
    // terror index: every lair by name, what it is doing, and what it is near.
    // Clicking one pans the chart to its hunting grounds (no free travel —
    // terrors live off the roads, so the last stretch is always on foot).
    list.appendChild(el('div', 'terrorhead', '<b>☠ Roaming terrors</b><span>eight lairs — go fed, rested, and with friends</span>'));
    if (Entities.worldBosses && Game.flags.leftCastle) {
      for (const L of Entities.worldBosses) {
        const def = (typeof MOBS !== 'undefined' && MOBS[L.key]) || null;
        if (!def) continue;
        let near = SITES[0], bd = Infinity;
        for (const s of SITES) {
          const dd = (s.x - L.x) * (s.x - L.x) + (s.z - L.z) * (s.z - L.z);
          if (dd < bd) { bd = dd; near = s; }
        }
        const alive = Entities.mobs.some(m => !m.dead && m.key === L.key);
        const c = el('button', 'siteb' + (alive ? ' seen' : ''),
          `<b>☠ ${def.name}</b><span>${alive ? 'stirs' : 'resting'} · near ${near.name}</span>`);
        c.onclick = () => {
          const cv2 = $('worldmap');
          this.mapView.cx = clamp(L.x, -EXTENT, EXTENT);
          this.mapView.cz = clamp(L.z, -EXTENT, EXTENT);
          this.mapView.zoom = 4;
          if (cv2) { cv2.width = cv2.parentElement.clientWidth; cv2.height = cv2.parentElement.clientHeight; this.drawMap(cv2); }
        };
        list.appendChild(c);
      }
    } else {
      list.appendChild(el('div', 'siteb', '<b>???</b><span>leave the castle to sense them</span>'));
    }
  },

  mapHalfRange() { return EXTENT / this.mapView.zoom; },
  mapProject(cv, x, z) {
    const R = this.mapHalfRange();
    return {
      x: (x - (this.mapView.cx - R)) / (R * 2) * cv.width,
      y: (z - (this.mapView.cz - R)) / (R * 2) * cv.height
    };
  },
  mapUnproject(cv, mx, my) {
    const R = this.mapHalfRange();
    return { x: this.mapView.cx - R + mx / cv.width * R * 2, z: this.mapView.cz - R + my / cv.height * R * 2 };
  },
  mapHit(cv, mx, my) {
    for (const s of SITES) {
      const p = this.mapProject(cv, s.x, s.z);
      if (Math.hypot(p.x - mx, p.y - my) < 16) return s;
    }
    return null;
  },

  /* Full-extent heightfield, rendered once and reused as a pan/zoom layer. */
  renderMapCache() {
    const N = 300, cv = document.createElement('canvas');
    cv.width = N; cv.height = N;
    const g = cv.getContext('2d');
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const wx = x / N * EXTENT * 2 - EXTENT;
        const wz = y / N * EXTENT * 2 - EXTENT;
        const h = World.height(wx, wz);
        let c;
        if (h < 0) c = '#141c28';
        else if (h < 3) c = '#2b2a26';
        else {
          const bb = World.biome(wx, wz, h);
          c = { meadow: '#5b5b52', forest: '#3d4a3d', mountain: '#8b8b92', snow: '#d5dae2',
                volcano: '#5a3228', marsh: '#43473a', shore: '#7a7460' }[bb] || '#4a4a46';
        }
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    }
    this._mapCache = cv;
  },

  drawMap(cv) {
    if (!this._mapCache) this.renderMapCache();
    const g = cv.getContext('2d');
    const R = this.mapHalfRange();
    // blit the cached chart for the current view — cheap, so drag stays smooth
    const sx = (this.mapView.cx - R + EXTENT) / (EXTENT * 2) * this._mapCache.width;
    const sy = (this.mapView.cz - R + EXTENT) / (EXTENT * 2) * this._mapCache.height;
    const sw = (R * 2) / (EXTENT * 2) * this._mapCache.width;
    g.imageSmoothingEnabled = true;
    g.fillStyle = '#0c0a10';
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(this._mapCache, sx, sy, sw, sw, 0, 0, cv.width, cv.height);
    // kilometre grid, aligned to the world so it slides correctly while panning
    g.strokeStyle = 'rgba(232,228,218,.12)'; g.lineWidth = 1;
    const x0 = Math.floor((this.mapView.cx - R) / 1000) * 1000;
    const z0 = Math.floor((this.mapView.cz - R) / 1000) * 1000;
    for (let gx = x0; gx <= this.mapView.cx + R; gx += 1000) {
      const p = this.mapProject(cv, gx, 0);
      g.beginPath(); g.moveTo(p.x, 0); g.lineTo(p.x, cv.height); g.stroke();
    }
    for (let gz = z0; gz <= this.mapView.cz + R; gz += 1000) {
      const p = this.mapProject(cv, 0, gz);
      g.beginPath(); g.moveTo(0, p.y); g.lineTo(cv.width, p.y); g.stroke();
    }
    // trade roads in packed-dirt ochre, waystones as pale rings
    if (typeof ROUTES !== 'undefined') {
      g.strokeStyle = 'rgba(160,130,90,.55)'; g.lineWidth = 2;
      for (const [a, b] of ROUTES) {
        const A = SITES.find(s => s.id === a), B = SITES.find(s => s.id === b);
        if (!A || !B) continue;
        const pa = this.mapProject(cv, A.x, A.z), pb = this.mapProject(cv, B.x, B.z);
        g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.stroke();
      }
    }
    for (const s of SITES) {
      if (!s.stone || !Game.visited[s.id]) continue;
      const p = this.mapProject(cv, s.stone.x, s.stone.z);
      if (p.x < -20 || p.y < -20 || p.x > cv.width + 20 || p.y > cv.height + 20) continue;
      g.strokeStyle = 'rgba(159,208,255,.8)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(p.x, p.y, 6, 0, TAU); g.stroke();
    }
    g.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    g.textAlign = 'center';
    SITES.forEach(s => {
      const p = this.mapProject(cv, s.x, s.z);
      if (p.x < -20 || p.y < -20 || p.x > cv.width + 20 || p.y > cv.height + 20) return;
      const seen = Game.visited[s.id];
      g.fillStyle = seen ? '#e8e4da' : 'rgba(232,228,218,.30)';
      g.beginPath(); g.arc(p.x, p.y, seen ? 5 : 3, 0, TAU); g.fill();
      if (seen) {
        g.fillStyle = 'rgba(12,10,16,.78)';
        const w = g.measureText(s.name).width + 10;
        g.fillRect(p.x - w / 2, p.y + 8, w, 15);
        g.fillStyle = '#e8e4da';
        g.fillText(s.name, p.x, p.y + 19);
      }
    });
    DUNGEONS.forEach(d => {
      // hidden caves stay off the chart until entered — unless quests send you
      const qd = Game.quest();
      const quested = qd && qd.goal.kind === 'dungeon' && qd.goal.id === d.id;
      if (!Game.flags['entered_' + d.id] && !quested) return;
      const p = this.mapProject(cv, d.x, d.z);
      if (p.x < -20 || p.y < -20 || p.x > cv.width + 20 || p.y > cv.height + 20) return;
      g.strokeStyle = '#c0b088'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(p.x - 5, p.y - 5); g.lineTo(p.x + 5, p.y + 5);
      g.moveTo(p.x + 5, p.y - 5); g.lineTo(p.x - 5, p.y + 5); g.stroke();
    });
    // ☠ side-boss index: the eight roaming terror lairs, charted once you
    // can survive outside the castle walls. Crimson stirs, grey rests.
    if (Game.flags.leftCastle && Entities.worldBosses) {
      for (const L of Entities.worldBosses) {
        const def = (typeof MOBS !== 'undefined' && MOBS[L.key]) || null;
        if (!def) continue;
        const p = this.mapProject(cv, L.x, L.z);
        if (p.x < -20 || p.y < -20 || p.x > cv.width + 20 || p.y > cv.height + 20) continue;
        const alive = Entities.mobs.some(m => !m.dead && m.key === L.key);
        g.font = '600 14px ui-sans-serif, system-ui, sans-serif';
        g.fillStyle = alive ? '#e04860' : 'rgba(224,72,96,.40)';
        g.fillText('☠', p.x, p.y - 8);
        g.font = '600 10px ui-sans-serif, system-ui, sans-serif';
        g.fillStyle = alive ? 'rgba(232,228,218,.92)' : 'rgba(232,228,218,.45)';
        g.fillText(def.name, p.x, p.y + 22);
      }
      g.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    }
    const pp = this.mapProject(cv, Entities.player.x, Entities.player.z);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(pp.x, pp.y, 4.5, 0, TAU); g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
    // the party ship: gold diamond outline
    if (Entities.ship) {
      const sp = this.mapProject(cv, Entities.ship.x, Entities.ship.z);
      if (sp.x > -20 && sp.y > -20 && sp.x < cv.width + 20 && sp.y < cv.height + 20) {
        g.strokeStyle = '#d8c188'; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(sp.x, sp.y - 7); g.lineTo(sp.x + 7, sp.y);
        g.lineTo(sp.x, sp.y + 7); g.lineTo(sp.x - 7, sp.y);
        g.closePath(); g.stroke();
      }
    }
    // dragonroost: gold D where Aurelia perches
    if (Entities.roost) {
      const rp = this.mapProject(cv, Entities.roost.x, Entities.roost.z);
      if (rp.x > -20 && rp.y > -20 && rp.x < cv.width + 20 && rp.y < cv.height + 20) {
        g.fillStyle = '#d8b46e';
        g.font = '700 13px ui-sans-serif, system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('D', rp.x, rp.y);
      }
    }
    g.textAlign = 'left';
  },

  tab_fate(b) {
    const W = 760, H = 420, NS = 'http://www.w3.org/2000/svg';
    b.innerHTML = '<p class="sub">Solid links are earned. Open links are still available to you.</p>';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'fate');
    const chain = (x1, y1, x2, y2, lit) => {
      for (let t = 0; t <= 1.0001; t += 0.05) {
        const x = lerp(x1, x2, t);
        const y = lerp(y1, y2, t) + Math.sin(t * Math.PI) * 18;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 3.2);
        c.setAttribute('class', 'lnk' + (lit ? ' lit' : ''));
        svg.appendChild(c);
      }
    };
    const node = (x, y, label, sub, lit) => {
      const gp = document.createElementNS(NS, 'g');
      gp.setAttribute('class', 'nd' + (lit ? ' lit' : ''));
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 19);
      gp.appendChild(c);
      const t1 = document.createElementNS(NS, 'text');
      t1.setAttribute('x', x); t1.setAttribute('y', y + 36); t1.textContent = label;
      gp.appendChild(t1);
      if (sub) {
        const t2 = document.createElementNS(NS, 'text');
        t2.setAttribute('x', x); t2.setAttribute('y', y + 50);
        t2.setAttribute('class', 'sb'); t2.textContent = sub;
        gp.appendChild(t2);
      }
      svg.appendChild(gp);
    };
    const rootX = W / 2, rootY = 42;
    HEROINES.forEach((h, i) => {
      const x = 54 + i * ((W - 108) / 6), y = 225;
      chain(rootX, rootY, x, y, Game.bondLevel(h.id) >= 4);
    });
    const ends = [
      { x: W / 2 - 240, y: 380, label: 'Twin Star', ok: Game.endingOpen('twin') },
      { x: W / 2, y: 380, label: 'The Long Road', ok: Game.endingOpen('solo') },
      { x: W / 2 + 240, y: 380, label: 'All Seven', ok: Game.endingOpen('harem') }
    ];
    ends.forEach(e => chain(W / 2, 250, e.x, e.y, e.ok));
    node(rootX, rootY, 'Bearer of the Mark', '', true);
    HEROINES.forEach((h, i) => {
      const x = 54 + i * ((W - 108) / 6);
      node(x, 225, Game.met[h.id] ? h.name.split(' ')[0] : '???', 'bond ' + Game.bondLevel(h.id), Game.bondLevel(h.id) >= 4);
    });
    ends.forEach(e => node(e.x, e.y, e.label, '', e.ok));
    b.appendChild(svg);
  },

  tab_options(b) {
    b.innerHTML = `
      <section class="frame opts">
        <label>Music<input type="range" id="o-mus" min="0" max="100" value="${Math.round(Settings.music * 100)}"></label>
        <label>Sound<input type="range" id="o-sfx" min="0" max="100" value="${Math.round(Settings.sfx * 100)}"></label>
        <label>Look sensitivity<input type="range" id="o-sen" min="30" max="220" value="${Math.round(Settings.sens * 100)}"></label>
        <label>Text speed<select id="o-txt">
          <option value="1">Slow</option><option value="2">Steady</option>
          <option value="3">Quick</option><option value="4">Instant</option></select></label>
        <label>Shadows<input type="checkbox" id="o-sha" ${Settings.shadows ? 'checked' : ''}></label>
      </section>
      <section class="frame">
        <h3>Controls</h3>
        <div class="keys">
          <div><kbd>W A S D</kbd> move</div><div><kbd>Shift</kbd> run · dive while swimming</div><div><kbd>Space</kbd> jump · hold to surface</div>
          <div><kbd>2×Space</kbd> swim in the shallows</div>
          <div><kbd>Mouse</kbd> look</div><div><kbd>Wheel</kbd> camera distance</div>
          <div><kbd>E</kbd> talk, read, enter, board ship</div><div><kbd>F</kbd> strike</div>
          <div><kbd>W A S D</kbd> sail while aboard</div>
          <div><kbd>H</kbd> sound the horn — summon the ship (near water)</div>
          <div><kbd>1–5</kbd> attune fire · water · wind · earth · lightning</div>
          <div><kbd>V</kbd> cast — a different element within 3 s fuses</div>
          <div><kbd>G</kbd> orders to your party</div><div><kbd>Esc</kbd> the ring</div>
          <div><kbd>C</kbd> status</div><div><kbd>M</kbd> realm map</div>
          <div><kbd>J</kbd> chronicle</div><div><kbd>R</kbd> bonds</div>
        </div>
      </section>`;
    $('o-txt').value = String(Settings.textSpeed);
    const sync = () => {
      Settings.music = $('o-mus').value / 100;
      Settings.sfx = $('o-sfx').value / 100;
      Settings.sens = $('o-sen').value / 100;
      Settings.textSpeed = +$('o-txt').value;
      Settings.shadows = $('o-sha').checked;
      World.sun.castShadow = Settings.shadows;
      saveSettings(); Sound.apply();
    };
    ['o-mus', 'o-sfx', 'o-sen', 'o-txt', 'o-sha'].forEach(id => { $(id).oninput = sync; $(id).onchange = sync; });
  },

  tab_save(b) {
    b.innerHTML = '<div class="grid slots" id="sl"></div>';
    const g = $('sl');
    for (let i = 1; i <= 9; i++) {
      const m = Game.slotMeta(i);
      const c = el('section', 'frame slot' + (m ? ' used' : ''));
      c.innerHTML = m
        ? `<h4>Record ${i}</h4><p class="sub">${m.name} · level ${m.level}</p>
           <p class="sub">${m.where} · act ${m.act}</p><p class="sub">${m.when}</p>`
        : `<h4>Record ${i}</h4><p class="sub">Empty</p>`;
      const row = el('div', 'slotrow');
      const s = el('button', 'mini', 'Write');
      s.onclick = () => { Game.save(i); this.openPanel('save'); this.toast('Record ' + i + ' written.'); };
      row.appendChild(s);
      if (m) {
        const l = el('button', 'mini', 'Read');
        l.onclick = () => {
          if (Game.load(i)) {
            this.closePanel();
            if (typeof App !== 'undefined' && App.state !== 'play') App.begin(false);
            this.toast('Record read.');
          }
        };
        row.appendChild(l);
        const x = el('button', 'mini danger', 'Burn');
        x.onclick = () => { Game.eraseSlot(i); this.openPanel('save'); };
        row.appendChild(x);
      }
      c.appendChild(row);
      g.appendChild(c);
    }
  }
};
