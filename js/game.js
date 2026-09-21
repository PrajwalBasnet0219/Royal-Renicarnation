/* ROYAL REINCARNATION 3D — game.js
   Rules, progression and the flow that ties them together. */
'use strict';

const Game = {
  started: false, playerName: null,
  level: 1, xp: 0, gold: 60, tuning: 8, secretsKnown: 0,
  elem: 'fire', lastCast: null, lastCastT: 0,
  base: { STR: 4, VIT: 4, AGI: 4 },
  equip: { weapon: null, armor: null, charm: null },
  bag: { tonic: 2 },
  aff: {}, met: {}, visited: {}, flags: {}, doneQuests: {},
  questIndex: 0, kills: 0, killMark: 0, talkedTo: {},
  passiveT: 0, dayT: 120,

  /* ---------------- stats ---------------- */
  bonus() {
    const s = { atk: 0, def: 0 };
    for (const k in this.equip) {
      const it = this.equip[k] ? ITEMS[this.equip[k]] : null;
      if (!it) continue;
      s.atk += it.atk || 0; s.def += it.def || 0;
    }
    return s;
  },
  derived() {
    const b = this.bonus();
    return {
      maxhp: 60 + this.base.VIT * 11,
      maxfocus: 30 + this.base.AGI * 4,
      atk: 6 + this.base.STR * 3 + b.atk,
      def: this.base.VIT + b.def,
      // gacha caps: the player's crit has maxima; heroines' does not
      critR: Math.min(60, 5 + this.level * 0.25),
      critD: Math.min(300, 150 + this.level * 1.5)
    };
  },
  applyStats(full) {
    const p = Entities.player, d = this.derived();
    const ratio = p.maxhp ? p.hp / p.maxhp : 1;
    p.maxhp = d.maxhp; p.maxfocus = d.maxfocus;
    p.hp = full ? d.maxhp : clamp(d.maxhp * ratio, 1, d.maxhp);
    p.focus = Math.min(p.focus, d.maxfocus);
  },
  xpNeed() { return 80 * this.level * this.level; },

  quest() { return this.questIndex < QUESTS.length ? QUESTS[this.questIndex] : null; },

  objectiveLine(q) {
    const g = q.goal;
    switch (g.kind) {
      case 'talk': {
        const h = HEROINES.find(x => x.id === g.who);
        const name = h ? (this.met[h.id] ? h.name : h.name) : this.npcTitle(g.who);
        const t = this.targetPoint();
        return t ? `Find ${name} — ${this.bearing(t)}` : `Find ${name}`;
      }
      case 'reach': return g.at === 'gate' ? 'Walk out through the castle gate'
        : g.at === 'castle_hall' ? 'Enter the keep by its south door, then walk to the throne'
        : 'Walk to the end of the ward hall';
      case 'tune': return `Veil tuning ${Math.floor(this.tuning)} of ${g.value} — talk to people, eat, rest`;
      case 'item': return `Obtain: ${ITEMS[g.item].name}`;
      case 'site': {
        const s = SITES.find(x => x.id === g.site);
        return `Travel to ${s.name} — ${this.bearing({ x: s.x, z: s.z })}`;
      }
      case 'kill': return `Defeated ${clamp(this.kills - this.killMark, 0, g.count)} of ${g.count}`;
      case 'flag': return 'Find the clue';
      case 'dungeon': {
        const d = DUNGEONS.find(x => x.id === g.id);
        return `Enter and clear ${d.name} — ${this.bearing({ x: d.x, z: d.z })}`;
      }
      default: return '';
    }
  },

  npcTitle(id) {
    return { physician: 'Physician Wren', vera: 'the guildmaster', guard: 'the gate warden' }[id] || id;
  },

  bearing(t) {
    const p = Entities.player;
    const dx = t.x - p.x, dz = t.z - p.z;
    const m = Math.round(Math.hypot(dx, dz));
    const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
    const a = (Math.atan2(dx, -dz) + TAU) % TAU;
    const d = dirs[Math.round(a / (Math.PI / 4)) % 8];
    return m > 1000 ? `${(m / 1000).toFixed(1)} km ${d}` : `${m} m ${d}`;
  },

  targetPoint() {
    const q = this.quest();
    if (!q) return null;
    const g = q.goal;
    if (g.kind === 'talk') {
      const e = Entities.npcs.find(n => (n.type === 'heroine' && n.id === g.who) || n.job === g.who);
      if (e) return { x: e.x, z: e.z };
    }
    if (g.kind === 'site') { const s = SITES.find(x => x.id === g.site); if (s) return { x: s.x, z: s.z }; }
    if (g.kind === 'dungeon') { const d = DUNGEONS.find(x => x.id === g.id); if (d) return { x: d.x, z: d.z }; }
    if (g.kind === 'reach' && g.at === 'gate') return SITES[0].gate;
    // the ward hall lives inside the keep — point at its door first
    if (g.kind === 'reach' && g.at === 'castle_hall') return { x: SITES[0].x, z: SITES[0].z - 9 };
    if (g.kind === 'kill') { const m = Entities.nearestMob(Entities.player.x, Entities.player.z, 500); if (m) return { x: m.x, z: m.z }; }
    return null;
  },

  /* ---------------- tuning ----------------
     The single number that gates movement speed and the castle ward. */
  addTuning(n, why) {
    const before = this.tuning;
    this.tuning = clamp(this.tuning + n, 0, 100);
    if (Math.floor(this.tuning / 10) > Math.floor(before / 10)) {
      UI.toast(`Veil tuning ${Math.floor(this.tuning)}. ${why || 'Breathing is easier.'}`, 'good');
    }
    this.checkGoal('tune');
  },

  /* ---------------- quests ---------------- */
  checkGoal(kind, arg) {
    const q = this.quest();
    if (!q || q.goal.kind !== kind) return false;
    const g = q.goal;
    if (kind === 'talk' && g.who !== arg) return false;
    if (kind === 'reach' && g.at !== arg) return false;
    if (kind === 'site' && g.site !== arg) return false;
    if (kind === 'item' && !this.bag[g.item] && this.equip.weapon !== g.item) return false;
    if (kind === 'flag' && !this.flags[g.flag]) return false;
    if (kind === 'dungeon' && g.id !== arg) return false;
    if (kind === 'tune' && this.tuning < g.value) return false;
    if (kind === 'kill' && this.kills - this.killMark < g.count) return false;
    this.completeQuest(q);
    return true;
  },

  completeQuest(q) {
    this.doneQuests[q.id] = true;
    this.questIndex++;
    this.killMark = this.kills;
    this.grantXp(60 + q.act * 40);
    this.gold += 25 + q.act * 15;
    // the factions notice finished business
    const patron = [null, 'rose', 'rose', 'archive', 'archive', 'rose', 'archive'][q.act];
    if (patron) this.addRep(patron, q.act === 3 || q.act === 6 ? 2 : 1);
    if (q.act === 0) this.addRep('wardens', 1);
    UI.toast('Chronicle: ' + q.title, 'good');
    Sound.sfx('good');
    const nq = this.quest();
    if (nq && nq.act !== q.act) {
      UI.banner('Act ' + nq.act, ACTS[nq.act].title);
      this.secretsKnown = Math.min(LORE.secrets.length, nq.act);
    }
    UI.refresh();
    // the new quest may already be satisfied (visited early, tuned early...)
    this.catchUpQuest();
  },

  /* If the newly-active quest is already satisfied by earlier play,
     complete it without making the player redo it. */
  catchUpQuest() {
    const q = this.quest();
    if (!q || !Entities.player) return;
    const g = q.goal, p = Entities.player;
    if (g.kind === 'site') {
      const s = SITES.find(x => x.id === g.site);
      if (s && dist2D(p.x, p.z, s.x, s.z) < s.r + 40) this.checkGoal('site', s.id);
      // standing stones count as having been there: fast-travel back instead
      else if (s && this.visited[s.id]) { /* re-enter to complete */ }
    }
    else if (g.kind === 'flag' && this.flags[g.flag]) this.checkGoal('flag');
    else if (g.kind === 'tune' && this.tuning >= g.value) this.checkGoal('tune');
    else if (g.kind === 'item' && (this.bag[g.item] || this.equip.weapon === g.item)) this.checkGoal('item');
    else if (g.kind === 'dungeon' && this.flags['solved_' + g.id]) this.checkGoal('dungeon', g.id);
  },

  grantXp(n) {
    this.xp += n;
    let up = false;
    while (this.xp >= this.xpNeed() && this.level < 999) {
      this.xp -= this.xpNeed();
      this.level++;
      this.base.STR++; this.base.VIT++;
      if (this.level % 2 === 0) this.base.AGI++;
      up = true;
    }
    if (up) {
      this.applyStats(true);
      UI.toast('Level ' + this.level + '.', 'good');
      Entities.ring(Entities.player.x, Entities.player.y, Entities.player.z, 0xe8e4da, 3);
      Sound.sfx('good');
    }
  },

  onKill(m) {
    this.kills++;
    // scale rewards with level so post-story grinding stays worthwhile
    const lvScale = 1 + (this.level - 1) * 0.05;
    this.grantXp(Math.round(m.def.xp * (m.worldBoss ? 10 : 1)));
    this.gold += Math.round((4 + ((Math.random() * 10) | 0)) * lvScale);
    // heroines earn their own xp + levels from every kill (bonded or not, near or far)
    if (Entities.heroineGainXp) {
      const share = Math.round(m.def.xp * 0.6);
      for (const h of Entities.npcs) {
        if (h.type === 'heroine' && (h.recruited || this.met[h.def.id])) Entities.heroineGainXp(h, share);
      }
    }
    if (m.def.boss) {
      // a guardian falls: crowns, closeness, and a mark on the dungeon
      this.gold += m.worldBoss || m.def.worldBoss ? 600 : 150;
      for (const h of Entities.companions) this.addAff(h.def.id, 2);
      if (m.dungeonId && World.builtDungeons[m.dungeonId]) World.builtDungeons[m.dungeonId].bossDead = true;
      if (m.worldBoss || m.def.worldBoss) {
        UI.banner(m.def.name + ' falls', 'an OP terror of the wilds — the roads breathe easier');
        this.addRep('rose', 2);
      } else {
        UI.banner(m.def.name + ' falls', 'the dark here is quieter now');
      }
      Sound.sfx('seal');
    }
    if (m.key === 'phoenix') {
      // rebirth blessing: the killer is mended by the ashes
      const p = Entities.player;
      p.hp = Math.min(p.maxhp, p.hp + 25);
      Entities.popup(p.x, p.y + 2.4, p.z, '+25', 0x7fd0a0);
      UI.toast('Phoenix blessing: mended by the ashes.', 'good');
    }
    // guild writ progress
    if (this.bounty && m.key === this.bounty.key && !m.def.boss) {
      this.bounty.have++;
      if (this.bounty.have >= this.bounty.need) {
        this.gold += this.bounty.reward;
        UI.toast(`Writ fulfilled: +${this.bounty.reward} crowns.`, 'good');
        Sound.sfx('good');
        this.addRep('rose', 1);
        this.bounty = null;
      } else if (this.bounty.have === Math.floor(this.bounty.need / 2)) {
        UI.toast(`Writ: ${this.bounty.have}/${this.bounty.need} ${this.bounty.name}.`);
      }
    }
    this.checkGoal('kill');
    UI.refresh();
  },

  hurtPlayer(amount, from) {
    const p = Entities.player;
    if (p.hurtCd > 0) return;
    const dmg = Math.max(1, Math.round(amount - this.derived().def * 0.35));
    p.hp -= dmg; p.hurtCd = 0.6; p.calm = 0;
    Entities.popup(p.x, p.y + 2.3, p.z, '-' + dmg, 0xff7a8a);
    Camera3.kick(0.28);
    Sound.sfx('hurt');
    if (from) {
      const dx = p.x - from.x, dz = p.z - from.z, l = Math.hypot(dx, dz) || 1;
      Entities.move(p, dx / l * 0.7, dz / l * 0.7);
    }
    if (p.hp <= 0) this.faint();
    UI.refresh();
  },

  faint() {
    const p = Entities.player;
    p.aboard = false;
    p.ferry = null; p.aboardFerry = false; p.dragon = false;
    Entities.endRide(true);
    p.hp = p.maxhp * 0.5;
    if (World.mode === 'dungeon') this.leaveDungeon();
    if (World.mode === 'building') this.leaveBuilding();
    const s = SITES.find(x => this.visited[x.id]) || SITES[0];
    p.x = s.x; p.z = s.z + s.r * 0.3; p.y = World.height(p.x, p.z);
    this.gold = Math.max(0, this.gold - 20);
    UI.say('Someone carried you', 'You wake on a bench in ' + s.name + ' with twenty crowns missing and no explanation offered. Somebody put a blanket on you.');
  },

  /* Standing with the factions, and the archive of the world. */
  repTier(id) {
    const v = this.rep[id] || 0;
    return v <= -3 ? 'hunted' : v < 0 ? 'distrusted' : v <= 2 ? 'known' : v <= 5 ? 'trusted' : 'sworn';
  },
  addRep(id, n) {
    if (!FACTIONS.some(f => f.id === id)) return;
    const before = this.repTier(id);
    this.rep[id] = clamp((this.rep[id] || 0) + n, -5, 10);
    const after = this.repTier(id);
    if (before !== after) {
      const f = FACTIONS.find(x => x.id === id);
      UI.toast(`${f.name}: ${after}.`, after === 'trusted' || after === 'sworn' ? 'good' : 'warn');
    }
  },
  unlockCodex(id) {
    if (this.codex[id]) return;
    const e = (typeof CODEX !== 'undefined' ? CODEX : []).find(x => x.id === id);
    if (!e) return;
    this.codex[id] = true;
    UI.toast('Codex: ' + e.title, 'good');
    Sound.sfx('good');
  },

  /* ---------------- interaction ---------------- */
  interact() {
    const p = Entities.player;

    if (World.mode === 'dungeon') return this.interactDungeon();
    if (World.mode === 'interior') return this.interactInterior();
    if (World.mode === 'building') return this.interactBuilding();
    // at the helm: talk only to someone at your elbow, else step ashore
    if (p.aboard) {
      const mate = Entities.nearestTalkable(p.x, p.z, 2.2);
      if (mate) return this.talk(mate);
      return Entities.disembark();
    }
    // riding pillion: E stops the wagons
    if (p.riding) return Entities.endRide();
    // aboard a ferry: E steps ashore (talk range is the whole deck)
    if (p.ferry) return Entities.leaveFerry();
    // dragonback: E finds a landing
    if (p.dragon) return Entities.leaveDragon();

    const who = Entities.nearestTalkable(p.x, p.z, 3.8);
    const wd = who ? dist2D(p.x, p.z, who.x, who.z) : 1e9;

    // keep door — walk into Auverne's three floors
    const c = SITES[0];
    const kd = dist2D(p.x, p.z, c.x, c.z - 9);

    // castle gate ward
    const gd = (c.gate && !this.flags.leftCastle) ? dist2D(p.x, p.z, c.gate.x, c.gate.z) : 1e9;

    // dungeon mouth — finding one unclued still teaches you its rumour
    let dd = null, ddDist = 1e9;
    for (const d of DUNGEONS) {
      const q = dist2D(p.x, p.z, d.x, d.z);
      if (q < ddDist) { ddDist = q; dd = d; }
    }

    // the party ship (not while she is still answering the horn)
    const sd = Entities.ship ? dist2D(p.x, p.z, Entities.ship.x, Entities.ship.z) : 1e9;
    const shipReady = Entities.ship && !Entities.ship.summon;

    // waystones and signposts
    let st = null, stDist = 1e9;
    for (const s of SITES) {
      if (!s.stone || !this.visited[s.id]) continue;
      const q = dist2D(p.x, p.z, s.stone.x, s.stone.z);
      if (q < stDist) { stDist = q; st = s; }
    }
    let sg = null, sgDist = 1e9;
    for (const s of SITES) {
      if (!s.sign || !this.visited[s.id]) continue;
      const q = dist2D(p.x, p.z, s.sign.x, s.sign.z);
      if (q < sgDist) { sgDist = q; sg = s; }
    }
    // guild board and wagon yard
    let bd = null, bdDist = 1e9, wg = null, wgDist = 1e9;
    for (const s of SITES) {
      if (!this.visited[s.id]) continue;
      if (s.board) {
        const q = dist2D(p.x, p.z, s.board.x, s.board.z);
        if (q < bdDist) { bdDist = q; bd = s; }
      }
      if (s.wagon) {
        const q = dist2D(p.x, p.z, s.wagon.x, s.wagon.z);
        if (q < wgDist) { wgDist = q; wg = s; }
      }
    }
    // sky-gate below, isle pads and chest above
    const upHigh = p.y > 60;
    const gateD = World.skyGate ? dist2D(p.x, p.z, World.skyGate.x, World.skyGate.z) : 1e9;
    let padIdx = -1, padD = 1e9;
    if (upHigh && World.skyIsles) {
      World.skyIsles.forEach((I, i) => {
        const q = dist2D(p.x, p.z, I.x, I.z);
        if (q < padD) { padD = q; padIdx = i; }
      });
    }
    const chestD = (upHigh && World.skyChest) ? dist2D(p.x, p.z, World.skyChest.x, World.skyChest.z) : 1e9;

    // nearest wins, so companions never body-block doors and wards
    if (shipReady && sd < 7 && sd <= wd && sd <= kd && sd <= gd && sd <= ddDist) return Entities.boardShip();
    // ferries: dock bell or the hull itself
    if (Entities.ferries && Entities.ferries.length) {
      let bf = null, bfD = 9;
      for (const F of Entities.ferries) {
        const q = dist2D(p.x, p.z, F.x, F.z);
        if (q < bfD) { bfD = q; bf = F; }
      }
      let dockD = 1e9, dockSite = null;
      for (const s of SITES) {
        if (!s.dock) continue;
        const q = dist2D(p.x, p.z, s.dock.x, s.dock.z);
        if (q < dockD) { dockD = q; dockSite = s; }
      }
      if (bf && bfD <= wd && bfD <= kd) return this.takeFerry(bf);
      if (dockSite && dockD < 6 && dockD <= wd) return this.takeFerry(null, dockSite);
    }
    if (st && stDist < 6 && stDist <= wd) return this.useWaystone(st);
    if (!upHigh && World.skyGate && gateD < 5 && gateD <= wd) return this.ascendSky(0);
    if (upHigh && padIdx >= 0 && padD < 7) {
      const others = World.skyIsles.map((I, i) => i).filter(i => i !== padIdx);
      UI.say('Waypad', 'The stone remembers the other islands, and the ground below.', {
        choices: [
          ...others.map(i => ({ text: `Step to isle ${i + 1}`, go: () => this.ascendSky(i) })),
          { text: 'Float back down', go: () => this.descendSky() }
        ]
      });
      return;
    }
    if (upHigh && chestD < 4) return this.openSkyChest();
    if (bd && bdDist < 5 && bdDist <= wd) return this.bountyBoard(bd);
    if (wg && wgDist < 5 && wgDist <= wd) return this.hireWagon(wg);
    if (sg && sgDist < 5 && sgDist <= wd) return this.readSignpost(sg);
    // walk-in building doors (nearest door within 4.5 m, loses ties to talk)
    let door = null, doorD = 4.5;
    if (World.doors) {
      for (const dr of World.doors) {
        const q = dist2D(p.x, p.z, dr.x, dr.z);
        if (q < doorD) { doorD = q; door = dr; }
      }
    }
    if (door && doorD <= wd) return this.enterBuilding(door);
    if (kd < 10 && kd <= wd && kd <= gd && kd <= ddDist) return this.enterKeep();
    if (gd < 9 && gd <= wd && gd <= ddDist) return this.tryGate();
    if (dd && ddDist < 8 && ddDist <= wd) {
      if (!this.flags[dd.clue]) {
        this.flags[dd.clue] = true;
        UI.toast('Clue found: ' + dd.name + '.', 'good');
        Sound.sfx('good');
      }
      return this.tryDungeon(dd);
    }
    if (who) return this.talk(who);
    // the gold dragon, if she is perched in reach
    if (Entities.dragon && !p.dragon) {
      const drd = dist2D(p.x, p.z, Entities.dragon.x, Entities.dragon.z);
      if (drd < 9 && drd <= wd) return Entities.boardDragon();
    }
    UI.toast('Nothing here answers to you.');
  },

  talk(e) {
    if (e.type === 'heroine') return this.talkHeroine(e);
    const first = !this.talkedTo[e.name];
    this.talkedTo[e.name] = true;
    if (first) this.addTuning(6, 'The veil is learning the shape of you.');
    else this.addTuning(0.6);

    if (e.job === 'keeper') return this.talkKeeper(e, first);

    if (e.job === 'scribe' && !this.playerName) {
      return UI.say(e.name, 'Arrivals get an entry. Arrivals that walk get a name in it.', {
        sub: 'court scribe',
        then: () => UI.askName(n => {
          this.playerName = n;
          Entities.player.name = n;
          UI.say(e.name, `"${n}." Written. You exist now, administratively, which is the only kind that holds up.`, {
            then: () => { this.addTuning(6); UI.refresh(); }
          });
        })
      });
    }
    if (e.job === 'cook') {
      return UI.say(e.name, NPC_LINES.cook[0], {
        sub: 'castle kitchens',
        choices: [
          { text: 'Could I eat something?', go: () => {
              const p = Entities.player; p.hp = p.maxhp; this.addTuning(8, 'Food helps more than anyone admits.');
              UI.say(e.name, 'There. You look less like a rumour.', { sub: 'castle kitchens', choices: this.npcChoices(e) });
          } },
          ...this.npcChoices(e)
        ]
      });
    }
    if (e.job === 'barmaid') {
      return UI.say(e.name, NPC_LINES.barmaid[0], {
        sub: 'tavern keep',
        choices: [
          { text: 'Something warm, please. (8 crowns)', go: () => {
              if (this.gold < 8) {
                return UI.say(e.name, 'Love, your purse is as empty as your promises. The gossip is free, though.', {
                  sub: 'tavern keep', choices: this.npcChoices(e)
                });
              }
              this.gold -= 8;
              const p = Entities.player;
              p.hp = p.maxhp; p.focus = p.maxfocus;
              this.addTuning(3, 'Warmth tunes you.');
              UI.say(e.name, 'There. Color back in the cheeks. On the house? No. Never on the house.', {
                sub: 'tavern keep', choices: this.npcChoices(e)
              });
              UI.refresh();
          } },
          ...this.npcChoices(e)
        ]
      });
    }
    if (e.job === 'physician') {
      if (first) this.unlockCodex('veil');
      return UI.say(e.name, NPC_LINES.physician[0], {
        sub: 'court physician',
        choices: [
          { text: 'What is wrong with me?', go: () => UI.say(e.name, 'Nothing is wrong with you. You are simply out of tune with the air. Natives are born matched to it. You are a note from another instrument, and the room is deciding whether to accept you.', { then: () => { this.addTuning(6); this.checkGoal('talk', 'physician'); } }) },
          { text: 'How long until I can leave?', go: () => UI.say(e.name, 'The gate ward reads tuning at the arch. Forty is survivable. Below that it will not open, and if it did you would not last the road.', { then: () => { this.addTuning(6); this.checkGoal('talk', 'physician'); } }) },
          { text: 'Could I rest here a while?', go: () => { const p = Entities.player; p.hp = p.maxhp; p.focus = p.maxfocus; this.addTuning(9, 'Sleep tunes you faster than anything but company.'); UI.say(e.name, 'Hours pass. You wake with fewer edges.', { then: () => this.checkGoal('talk', 'physician') }); } },
          ...this.npcChoices(e)
        ]
      });
    }
    return this.npcTalk(e);
  },

  /* Ordinary people, talked to properly: greeting, work, rumors, farewell.
     Every choice is a spoken sentence. */
  npcTalk(e, greet) {
    const lore = (typeof NPC_LORE !== 'undefined' && NPC_LORE[e.job]) || null;
    const bank = NPC_LINES[e.job] || ['Good weather for it.'];
    let line = greet || bank[(Math.random() * bank.length) | 0];
    // the cult notices its own
    if (e.job === 'choir' && !this.talkedTo[e.name + ':seen']) {
      this.talkedTo[e.name + ':seen'] = true;
      this.unlockCodex('choir');
      this.addRep('choir', 1);
    }
    if (e.job === 'choir' && this.rep.choir >= 2) {
      line = 'You hum along now. Good. The stones noticed before I did.';
    }
    UI.say(e.name, line, { sub: e.job, choices: this.npcChoices(e) });
  },

  npcChoices(e) {
    const lore = (typeof NPC_LORE !== 'undefined' && NPC_LORE[e.job]) || null;
    const c = [];
    if (lore) {
      c.push({ text: 'What do you do here?', go: () => this.npcAnswer(e, lore.work) });
      c.push({ text: 'Heard any rumors?', go: () => this.npcAnswer(e, lore.rumor) });
    }
    if (e.trader) {
      if (this.escort && this.escort.npc === e) {
        c.push({ text: 'How far to safety?', go: () => {
          const E = this.escort;
          UI.toast(`${e.name} walks on — ${Game.bearing({ x: E.dest.x, z: E.dest.z })} to ${E.site.name}.`);
        } });
      } else if (!this.escort) {
        c.push({ text: 'Heading my way? I can guard you.', go: () => this.offerEscort(e) });
      }
    }
    c.push({ text: 'Goodbye.', go: () => UI.hideDialog() });
    return c;
  },

  npcAnswer(e, line) {
    this.addTuning(1, 'Company tunes you.');
    UI.say(e.name, line, { sub: e.job, choices: this.npcChoices(e) });
  },

  /* Dragonkeeper Sora: lore, work, and the sky itself. */
  talkKeeper(e, first) {
    const D = Entities.dragon;
    const near = D && dist2D(Entities.player.x, Entities.player.z, D.x, D.z) < 30;
    const lore = (typeof NPC_LORE !== 'undefined' && NPC_LORE.keeper) || null;
    const c = [];
    if (near) c.push({ text: 'Aurelia, take me up. (free)', go: () => Entities.boardDragon() });
    else c.push({ text: 'Where is Aurelia?', go: () => UI.say(e.name, 'Out hunting, or courting the thermals. Wait by the roost — a gold shadow comes home to grain.', { sub: 'dragonkeeper', choices: this.keeperChoices(e) }) });
    if (lore) {
      c.push({ text: 'What do you do here?', go: () => UI.say(e.name, lore.work, { sub: 'dragonkeeper', choices: this.keeperChoices(e) }) });
      c.push({ text: 'Heard any rumors?', go: () => UI.say(e.name, lore.rumor, { sub: 'dragonkeeper', choices: this.keeperChoices(e) }) });
    }
    c.push({ text: 'Goodbye.', go: () => UI.hideDialog() });
    const bank = (typeof NPC_LINES !== 'undefined' && NPC_LINES.keeper) || ['The sky is safe to borrow.'];
    UI.say(e.name, first ? 'You walk like someone who has never fallen from a great height. Good. Keep it that way — then climb.' : bank[(Math.random() * bank.length) | 0], {
      sub: 'dragonkeeper', choices: c
    });
  },
  keeperChoices(e) {
    const D = Entities.dragon;
    const near = D && dist2D(Entities.player.x, Entities.player.z, D.x, D.z) < 30;
    const c = [];
    if (near) c.push({ text: 'Aurelia, take me up. (free)', go: () => Entities.boardDragon() });
    c.push({ text: 'Goodbye.', go: () => UI.hideDialog() });
    return c;
  },

  talkHeroine(h) {
    const def = h.def;
    const first = !this.met[def.id];
    this.met[def.id] = true;
    if (first) {
      this.addTuning(8, 'Something in you settles.');
      UI.toast('Bond opened: ' + def.name, 'good');
    }
    const lvl = this.bondLevel(def.id);
    // bonded heroines greet you like someone they actually know
    const warm = lvl >= 5 && def.lines.warm && def.lines.warm.length;
    const greet = first ? def.blurb : this.pickLine(h, warm ? 'warm' : 'greet');
    UI.say(def.name, greet, { sub: def.title, look: def.look, choices: this.heroineChoices(h) });
  },

  /* The topic list, offered again after every topic so a talk flows
     instead of ending after one exchange. Every choice is a sentence
     the player actually says — never a stage direction. */
  heroineChoices(h) {
    const def = h.def;
    const lvl = this.bondLevel(def.id);
    const choices = [
      { text: this.pickLine(h, 'chat', PLAYER_LINES.chat), go: () => this.heroineChat(h, 0) },
      { text: this.pickLine(h, 'kind', PLAYER_LINES.kind), go: () => this.heroineReply(h, 'kind', 2, 0) },
      { text: this.pickLine(h, 'joke', PLAYER_LINES.joke), go: () => this.heroineReply(h, 'joke', 1, 0) },
      { text: this.pickLine(h, 'romance', PLAYER_LINES.romance), go: () => this.heroineRomance(h, 0) },
      { text: PLAYER_LINES.deep, go: () => this.heroineDeep(h) },
      { text: PLAYER_LINES.gift, go: () => this.giveGift(h) }
    ];
    if (def.id === 'seraphine' && this.doneQuests.q0_princess && !this.bag.writ && !this.flags.writ) {
      choices.unshift({ text: 'Would you sign my gate writ?', go: () => this.writScene(h) });
    }
    if (lvl >= 3 && !h.recruited && !def.sealed) {
      choices.unshift({ text: 'Travel with me.', go: () => this.recruit(h) });
    }
    choices.push({ text: PLAYER_LINES.farewell, go: () => this.endTalk(h) });
    return choices;
  },


  /* Draw a line without repeating the last one — people notice when looped.
     Shared banks (the player's own lines) track under a 'you:' key. */
  pickLine(h, cat, bank) {
    const lines = bank || h.def.lines[cat];
    if (!lines || !lines.length) return '…';
    h._seen = h._seen || {};
    const key = bank ? 'you:' + cat : cat;
    let i = (Math.random() * lines.length) | 0;
    if (lines.length > 1 && h._seen[key] === i) i = (i + 1) % lines.length;
    h._seen[key] = i;
    return lines[i];
  },

  endTalk(h) {
    UI.say(h.def.name, this.pickLine(h, 'part'), {
      sub: h.def.title, look: h.def.look,
      then: () => { this.checkGoal('talk', h.def.id); UI.refresh(); }
    });
  },

  heroineSubject(h) {
    UI.say(h.def.name, this.pickLine(h, 'chat'), {
      sub: h.def.title, look: h.def.look, choices: this.heroineChoices(h)
    });
  },

  /* Follow-ups speak too: encouragement, a subject change, a farewell. */
  followChoices(h, more) {
    const choices = [];
    if (more) choices.push(more);
    choices.push({ text: PLAYER_LINES.subject, go: () => this.heroineSubject(h) });
    choices.push({ text: PLAYER_LINES.farewell, go: () => this.endTalk(h) });
    return choices;
  },

  /* Normal everyday talk. Small bond gain on opening, then just company. */
  heroineChat(h, depth) {
    depth = depth || 0;
    if (depth === 0) this.addAff(h.def.id, 1);
    const more = depth < 3
      ? { text: this.pickLine(h, 'chatMore', PLAYER_LINES.chatMore), go: () => this.heroineChat(h, depth + 1) }
      : null;
    UI.say(h.def.name, this.pickLine(h, 'chat'), {
      sub: h.def.title, look: h.def.look, choices: this.followChoices(h, more)
    });
  },

  /* Romance, gated behind bond 4. Too early and she gently deflects. */
  heroineRomance(h, depth) {
    depth = depth || 0;
    if (this.bondLevel(h.def.id) < 4) {
      return UI.say(h.def.name, h.def.cold, {
        sub: h.def.title, look: h.def.look, choices: this.heroineChoices(h)
      });
    }
    this.addAff(h.def.id, depth === 0 ? 3 : 1);
    const more = depth < 2
      ? { text: this.pickLine(h, 'chatMore', PLAYER_LINES.chatMore), go: () => this.heroineRomance(h, depth + 1) }
      : null;
    UI.say(h.def.name, this.pickLine(h, 'romance'), {
      sub: h.def.title, look: h.def.look, choices: this.followChoices(h, more)
    });
  },

  heroineReply(h, kind, gain, depth) {
    depth = depth || 0;
    const line = this.pickLine(h, kind);
    this.addAff(h.def.id, gain);
    const more = depth < 2
      ? { text: this.pickLine(h, 'chatMore', PLAYER_LINES.chatMore), go: () => this.heroineReply(h, kind, 1, depth + 1) }
      : null;
    UI.say(h.def.name, line, {
      sub: h.def.title, look: h.def.look, choices: this.followChoices(h, more)
    });
  },

  heroineDeep(h) {
    const lvl = this.bondLevel(h.def.id);
    if (lvl < 3) {
      return UI.say(h.def.name, 'Not yet. Ask me again when I have decided what you are.', {
        sub: h.def.title, look: h.def.look, choices: this.heroineChoices(h)
      });
    }
    const line = h.def.lines.deep[Math.min(h.def.lines.deep.length - 1, lvl - 3)];
    this.addAff(h.def.id, 2);
    this.secretsKnown = Math.max(this.secretsKnown, 2);
    UI.say(h.def.name, line, { sub: h.def.title, look: h.def.look, then: () => this.checkGoal('talk', h.def.id) });
  },

  giveGift(h) {
    const owned = Object.keys(this.bag).filter(k => this.bag[k] > 0 && ITEMS[k] && ITEMS[k].gift);
    if (!owned.length) {
      return UI.say(h.def.name, 'Empty hands, and you offered anyway. That is almost worse. Almost.', { sub: h.def.title, look: h.def.look });
    }
    UI.say(h.def.name, 'What have you got?', {
      sub: h.def.title, look: h.def.look,
      choices: owned.slice(0, 4).map(k => ({
        text: ITEMS[k].name,
        go: () => {
          this.bag[k]--;
          this.addAff(h.def.id, 3);
          UI.say(h.def.name, 'I am keeping this. That is what keeping means.', { sub: h.def.title, look: h.def.look });
        }
      }))
    });
  },

  recruit(h) {
    h.recruited = true;
    h.command = 'follow';
    UI.say(h.def.name, h.def.lines.combat[0] + ' — fine. I travel with you. Give orders with G and I will pretend to follow them.', {
      sub: h.def.title, look: h.def.look,
      then: () => { UI.toast(h.def.name.split(' ')[0] + ' joins you. Press G for orders.', 'good'); UI.refresh(); }
    });
    Sound.sfx('good');
  },

  writScene(h) {
    UI.say('Seraphine Auverne', 'The writ. Yes.', {
      sub: 'crown princess', look: h.def.look,
      then: () => UI.say('Seraphine Auverne',
        this.tuning >= 40
          ? 'You are at forty and change. The ward will let you through and the road will not finish you. Signed. Go and come back, in that order.'
          : 'You are not tuned enough. I can sign this, and the ward will still refuse you, and then I will have signed a lie. Talk to more of my household first. Eat. Sleep. Come back at forty.',
        {
          sub: 'crown princess', look: h.def.look,
          then: () => {
            if (this.tuning >= 40) {
              this.bag.writ = 1;
              this.flags.writ = true;
              this.addAff('seraphine', 2);
              this.checkGoal('item');
              UI.toast('Gate Writ received.', 'good');
            }
          }
        })
    });
  },

  addAff(id, n) {
    const before = this.bondLevel(id);
    this.aff[id] = clamp((this.aff[id] || 0) + n, 0, 21);
    this.met[id] = true;
    const after = this.bondLevel(id);
    Entities.popup(Entities.player.x, Entities.player.y + 2.6, Entities.player.z, '+' + n + ' ♥', 0xff9ec4);
    if (after > before) {
      const h = HEROINES.find(x => x.id === id);
      UI.toast(`${h.name.split(' ')[0]}: bond ${after} of 7.`, 'good');
    }
  },
  bondLevel(id) {
    const a = this.aff[id] || 0;
    return a >= 20 ? 7 : a >= 16 ? 6 : a >= 12 ? 5 : a >= 8 ? 4 : a >= 5 ? 3 : a >= 2 ? 2 : 1;
  },
  endingOpen(kind) {
    const routes = HEROINES.filter(h => this.bondLevel(h.id) >= 7).length;
    if (kind === 'solo') return this.questIndex >= QUESTS.length - 2;
    if (kind === 'twin') return routes >= 2;
    if (kind === 'harem') return routes >= 7;
    return false;
  },

  /* ---------------- the gate ---------------- */
  tryGate() {
    if (this.tuning < 40) {
      Sound.sfx('bad');
      Entities.ring(Entities.player.x, Entities.player.y, Entities.player.z, 0x6fa8f0, 4);
      return UI.say('The ward',
        `It reads you and closes. Tuning ${Math.floor(this.tuning)} of the forty it wants. It is not refusing you out of malice; on the far side of this wall the air is undiluted, and it would take you apart by nightfall.`,
        { then: () => UI.toast('Talk to the castle household. Eat. Rest. Tuning rises with company.') });
    }
    if (!this.bag.writ) {
      return UI.say('Gate Warden Holt', 'You read forty. Good. Now the paperwork: no writ, no road. The princess signs those personally, which is the only slow part of my day.');
    }
    UI.say('Gate Warden Holt', 'Writ, seal, tuning. All three. Go on then.', {
      then: () => {
        this.flags.leftCastle = true;
        const c = SITES[0];
        if (c.ward) c.ward.visible = false;
        Entities.player.z = c.gate.z + 14;
        UI.banner('The Rose Marches', 'Act 1 — Tuned Enough to Leave');
        UI.toast('Auverne is always open to you — the waystone remembers it.', 'good');
        this.checkGoal('reach', 'gate');
        Sound.sfx('seal');
        Entities.ring(Entities.player.x, Entities.player.y, Entities.player.z, 0xbfe0ff, 6);
      }
    });
  },

  /* Waystones remember every town they have touched. */
  useWaystone(from) {
    const p0 = Entities.player;
    if (p0.aboard || p0.riding || p0.ferry || p0.dragon) { UI.toast('The stones want your feet on the ground first.'); return; }
    const opts = SITES.filter(s => s.stone && this.visited[s.id] && s.id !== from.id);
    if (!opts.length) return UI.toast('The stones hum, but know nowhere else yet.');
    UI.say('Waystone', 'Old light runs between the stones. Name somewhere you have been.', {
      choices: opts.map(s => ({
        text: s.name,
        go: async () => {
          await this.travelTo(s.name, s.kind, () => {
            const p = Entities.player;
            p.x = s.stone.x + 6; p.z = s.stone.z + 6;
            p.y = World.height(p.x, p.z);
            for (const h of Entities.companions) { h.x = p.x - 2; h.z = p.z - 2; h.y = p.y; }
            Camera3.target.set(p.x, p.y + 1.5, p.z);
            World.update(p.x, p.z, true);
          });
          this.unlockCodex('waystones');
          UI.banner(s.name, s.kind);
          Sound.sfx('seal');
          const p = Entities.player;
          Entities.ring(p.x, p.y, p.z, 0x9fd0ff, 4);
        }
      }))
    });
  },

  readSignpost(s) {
    const links = (typeof ROUTES !== 'undefined' ? ROUTES : [])
      .map(([a, b]) => a === s.id ? b : b === s.id ? a : null)
      .filter(Boolean)
      .map(id => SITES.find(x => x.id === id))
      .filter(x => x);
    if (!links.length) return UI.toast('The arms point nowhere you know.');
    UI.say('Signpost', links.map(t => `${t.name} — ${this.bearing({ x: t.x, z: t.z })}`).join('\n'), {
      sub: 'the roads'
    });
  },

  /* Escort: guard a walking trader to the far end of their route. */
  offerEscort(e) {
    if (this.escort) { UI.toast('You already walk guard for someone.'); return; }
    const R = e.trader;
    if (!R) return;
    const dest = R.dir > 0 ? { x: R.bx, z: R.bz } : { x: R.ax, z: R.az };
    const site = SITES.reduce((a, b) => dist2D(dest.x, dest.z, b.x, b.z) < dist2D(dest.x, dest.z, a.x, a.z) ? b : a);
    this.escort = { npc: e, dest, site, waves: 0, timer: 20, warn: 0, warned: false };
    UI.banner('Escort', 'see ' + e.name + ' to ' + site.name);
    Sound.sfx('good');
  },
  tickEscort(dt) {
    const E = this.escort;
    if (!E) return;
    const p = Entities.player;
    if (!E.npc || E.npc.downT > 0) { this.escort = null; return; }
    const d = dist2D(p.x, p.z, E.npc.x, E.npc.z);
    if (d > 70) {
      E.warn += dt;
      if (E.warn > 15) { this.escort = null; UI.toast('You lost the road. The escort walks on without you.', 'warn'); }
      else if (E.warn > 5 && !E.warned) { E.warned = true; UI.toast('The trader is getting away!', 'warn'); }
      return;
    }
    E.warn = 0; E.warned = false;
    // delivered when YOU walk the trader into the destination town
    if (dist2D(p.x, p.z, E.dest.x, E.dest.z) < 60) {
      const reward = 60 + this.level * 15;
      this.gold += reward;
      this.addTuning(5, 'Roads remember kindness.');
      this.addRep('rose', 1);
      UI.banner('Escort complete', `+${reward} crowns`);
      Sound.sfx('good');
      this.escort = null;
      UI.refresh();
      return;
    }
    if (E.waves < 3) {
      E.timer -= dt;
      if (E.timer <= 0) {
        E.timer = 25; E.waves++;
        const b = World.biome(E.npc.x, E.npc.z, World.height(E.npc.x, E.npc.z));
        const pool = Object.keys(MOBS).filter(k => MOBS[k].biome === b && !MOBS[k].boss && !MOBS[k].passive);
        for (let i = 0; i < 2 + (E.waves > 1 ? 1 : 0) && pool.length; i++) {
          const a = Math.random() * TAU;
          Entities.spawnMob(pool[(Math.random() * pool.length) | 0], E.npc.x + Math.cos(a) * 16, E.npc.z + Math.sin(a) * 16);
        }
        UI.toast('Ambush!', 'warn');
        Sound.sfx('bad');
      }
    }
  },

  /* Guild writs: repeating bounties off the board. One at a time. */
  bountyBoard() {
    // sky-biome mounts never take writs — Aurelia is above such things
    const pool = Object.keys(MOBS).filter(k => !MOBS[k].boss && !MOBS[k].passive && MOBS[k].biome !== 'sky');
    const offers = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const key = pool.splice((Math.random() * pool.length) | 0, 1)[0];
      const def = MOBS[key];
      const need = 3 + Math.floor(this.level / 2) + ((Math.random() * 2) | 0);
      offers.push({ key, need, reward: 25 + Math.round(def.xp * need / 2), name: def.name });
    }
    const choices = offers.map(o => ({
      text: `${o.name} ×${o.need} — ${o.reward} crowns`,
      go: () => {
        this.bounty = { ...o, have: 0 };
        UI.toast('Writ taken: ' + o.name + '.', 'good');
        Sound.sfx('ui');
      }
    }));
    if (this.bounty) choices.push({
      text: `Abandon: ${this.bounty.name} (${this.bounty.have}/${this.bounty.need})`,
      go: () => { this.bounty = null; UI.toast('Writ torn up.'); }
    });
    UI.say('Guild writs', this.bounty ? 'One writ at a time, hunter.' : 'Beasts trouble the roads. The guild pays per head.', {
      sub: 'adventurers’ board', choices
    });
  },

  /* Wagon yard: hire wheels to anywhere you have been. */
  hireWagon(s) {
    if (this.escort) { UI.toast('Not while walking guard.'); return; }
    const p0 = Entities.player;
    if (p0.aboard || p0.riding || p0.ferry || p0.dragon) { UI.toast('Step ashore first — then we roll.'); return; }
    const opts = SITES.filter(x => this.visited[x.id] && x.id !== s.id);
    if (!opts.length) return UI.toast('No roads in your head yet.');
    const kind = s.id === 'castle' ? 'war' : s.id === 'crossroads' ? 'merchant' : 'farm';
    UI.say('Wagon yard', 'Four to a wagon, driver makes five. Where to?', {
      sub: s.name,
      choices: opts.slice(0, 8).map(t => ({
        text: `${t.name} — ${this.bearing({ x: t.x, z: t.z })}`,
        go: () => {
          if (Entities.startRide(t.id, kind)) UI.toast('Rolling to ' + t.name + '.', 'good');
        }
      }))
    });
  },

  /* Ferry dock: board the scheduled ship across the water. */
  takeFerry(F, dockSite) {
    const list = (Entities.ferries || []).filter(f => {
      if (F) return f === F;
      if (!dockSite) return true;
      return f.def.from === dockSite.id || f.def.to === dockSite.id;
    });
    if (!list.length) return UI.toast('No ferry calls here yet.');
    if (list.length === 1 && F) return Entities.boardFerry(list[0], dockSite || null);
    UI.say('Ferry dock', 'Scheduled ships across the water. The bell rings and the hull answers.', {
      sub: dockSite ? dockSite.name : 'the crossing',
      choices: list.map(f => {
        const dest = SITES.find(s => s.id === (f.t < 0.5 ? f.def.to : f.def.from));
        return {
          text: `${f.def.name} → ${dest ? dest.name : '?'} — ${f.def.fare} crowns`,
          go: () => {
            if (this.gold < f.def.fare) return UI.toast('Not enough crowns for the fare.');
            this.gold -= f.def.fare;
            Entities.boardFerry(f, dockSite || null);
            UI.refresh();
          }
        };
      })
    });
  },

  onArrive(d) {
    Entities.endRide(true);
    const p = Entities.player;
    const spot = World.findOpenSpot(p.x, p.z, 0.7);
    p.x = spot.x; p.z = spot.z; p.y = World.height(p.x, p.z);
    let i = 0;
    for (const h of Entities.companions) {
      h.x = p.x - 2 - i; h.z = p.z - 2; h.y = World.height(h.x, h.z);
      h.wx = null; i++;
    }
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    UI.banner(d.name, d.kind);
    Sound.sfx('good');
    UI.refresh();
  },

  /* The Drift: up by sky-gate, between isles by pad, down the same way. */
  ascendSky(idx) {
    const I = World.skyIsles[idx || 0];
    if (!I) return;
    const p = Entities.player;
    this.returnPoint = { x: p.x, z: p.z };
    p.x = I.x; p.z = I.z; p.y = I.topY; p.sky = idx || 0;
    p.vy = 0; p.grounded = true;
    for (const h of Entities.companions) {
      h.x = p.x - 2; h.z = p.z - 2; h.y = I.topY; h.sky = idx || 0; h.wx = null;
    }
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    UI.banner('The Drift', 'look down gently');
    Sound.sfx('seal');
    Entities.ring(p.x, p.y, p.z, 0x9fd0ff, 3);
    UI.refresh();
  },
  descendSky() {
    const p = Entities.player;
    const g = World.skyGate || { x: SITES[0].x, z: SITES[0].z };
    p.x = g.x + 4; p.z = g.z + 4; p.y = World.height(p.x, p.z);
    p.sky = null; p.vy = 0; p.grounded = true;
    for (const h of Entities.companions) {
      h.x = p.x - 2; h.z = p.z - 2; h.y = World.height(h.x, h.z);
      h.sky = null; h.wx = null;
    }
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    Sound.sfx('back');
    UI.refresh();
  },
  openSkyChest() {
    if (this.flags.skychest) return UI.toast('Empty. The sky keeps nothing twice.');
    this.flags.skychest = true;
    this.bag.skyshard = (this.bag.skyshard || 0) + 1;
    UI.toast('Found: Skyshard.', 'good');
    Sound.sfx('good');
    UI.say('Sky chest', 'Inside: a stone that falls forever and never lands. It hums against your palm like a held note.');
  },

  /* ---------------- the keep interior ---------------- */
  enterKeep() {
    const p = Entities.player;
    this.returnPoint = { x: p.x, z: p.z };
    World.enterInterior();
    Sound.sfx('ui');
    UI.banner('Auverne Keep', 'hall, solar and study — walk to the dais');
    UI.refresh();
  },

  leaveKeep() {
    World.exitInterior();
    const p = Entities.player;
    const r = this.returnPoint || { x: SITES[0].x, z: SITES[0].z };
    p.x = r.x; p.z = r.z + 4; p.y = World.height(p.x, p.z);
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    for (const h of Entities.companions) {
      h.x = p.x - 2; h.z = p.z - 2;
      h.y = World.height(h.x, h.z);
      delete h.floorY; h.wx = null;
    }
    Sound.sfx('back');
    UI.refresh();
  },

  /* ---------------- walk-in buildings ---------------- */
  enterBuilding(door) {
    if (World.mode !== 'overworld' || !door) return;
    const p = Entities.player;
    this.returnPoint = { x: p.x, z: p.z };
    const B = World.enterBuilding(door);
    if (!B) return;
    Sound.sfx('ui');
    UI.banner(B.title || 'Inside', B.sub || door.site);
    UI.refresh();
  },

  leaveBuilding() {
    World.leaveBuilding();
    const p = Entities.player;
    const r = this.returnPoint || { x: SITES[0].x, z: SITES[0].z };
    // step out of the doorway, clear of the building collider
    const spot = World.findOpenSpot(r.x, r.z, 0.7);
    p.x = spot.x; p.z = spot.z; p.y = World.height(p.x, p.z);
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    for (const h of Entities.companions) {
      h.x = p.x - 2; h.z = p.z - 2;
      h.y = World.height(h.x, h.z);
      delete h.floorY; h.wx = null;
    }
    UI.refresh();
  },

  interactBuilding() {
    const p = Entities.player, B = World.building;
    if (!B) return;
    const who = Entities.nearestTalkable(p.x, p.z, 3.0);
    const wd = who ? dist2D(p.x, p.z, who.x, who.z) : 1e9;
    let near = null, bd = 3.6;
    for (const pr of B.props) {
      if (pr.hidden) continue;
      const dd = dist2D(p.x, p.z, pr.x, pr.z);
      if (dd < bd) { bd = dd; near = pr; }
    }
    if (near && bd <= wd) return this.useBuildingProp(near, B);
    if (who) return this.talk(who);
    if (near) return this.useBuildingProp(near, B);
    return UI.toast('Floorboards, lamplight, quiet.');
  },

  useBuildingProp(near, B) {
    const p = Entities.player;
    if (near.kind === 'exit') return this.leaveBuilding();
    if (near.kind === 'bed') {
      p.hp = p.maxhp; p.focus = p.maxfocus;
      this.addTuning(3, 'Rest tunes you faster than anything but company.');
      return UI.say('Rest', 'A real bed, a wool blanket, no watch rotation. You wake softer.');
    }
    if (near.kind === 'board') return this.bountyBoard();
    if (near.kind === 'shop') {
      const stock = [
        { id: 'tonic', price: 10, text: 'Veil Tonic (10 crowns) — steadies breath, closes wounds' },
        { id: 'draught', price: 8, text: 'Moon Draught (8 crowns) — restores focus' }
      ];
      return UI.say('Shopkeep', B.kind === 'alchemy' ? 'Brewed this morning. Still bubbling, that is normal.' : 'Coin first, gossip free.', {
        sub: B.title,
        choices: [
          ...stock.map(o => ({
            text: o.text,
            go: () => {
              if (this.gold < o.price) return UI.toast('Not enough crowns.');
              this.gold -= o.price;
              this.bag[o.id] = (this.bag[o.id] || 0) + 1;
              Sound.sfx('good');
              UI.toast('Bought: ' + ITEMS[o.id].name + '.', 'good');
              UI.refresh();
            }
          })),
          { text: 'Just looking.', go: () => UI.hideDialog() }
        ]
      });
    }
    if (near.kind === 'altar') {
      p.hp = p.maxhp;
      this.addTuning(5, 'Stillness tunes you.');
      return UI.say(B.title, 'You kneel a moment. The hum holds its note, and something in you holds with it. Wounds closed, breath easy.');
    }
    if (near.kind === 'forge') {
      this.forgeBuffT = 120;
      Sound.sfx('seal');
      Entities.ring(p.x, p.y, p.z, 0xffb054, 3);
      return UI.say('Whetstone', 'Sparks, oil, a true edge. Your strikes bite 25% deeper for two minutes.');
    }
    if (near.kind === 'dummy') {
      if (p.atkCd > 0) return;
      p.atkCd = 0.5; p.action = 'attack'; p.actionT = 0.32;
      Entities.ring(near.x, p.y, near.z, 0xe8e4da, 1.6);
      Sound.sfx('hit');
      this.grantXp(2);
      return UI.say('Practice dummy', 'Straw shudders. Footwork, hips, follow-through — the guildmaster watching the door nods once. (+2 xp)');
    }
    if (near.kind === 'barkeep') {
      return UI.say('Barkeep', 'Stew’s mostly turnip. Mostly is the best kind of stew.', {
        sub: B.title,
        choices: [
          { text: 'A hot meal, please. (8 crowns)', go: () => {
              if (this.gold < 8) return UI.say('Barkeep', 'Empty purse, full appetite. Wash dishes or come back rich.', { sub: B.title });
              this.gold -= 8;
              p.hp = p.maxhp; p.focus = p.maxfocus;
              this.addTuning(3, 'Warmth tunes you.');
              UI.say('Barkeep', 'There. Color back in the cheeks. Second cup loosens the tongue — what’s the road saying?', { sub: B.title });
              UI.refresh();
          } },
          { text: 'Heard any rumors?', go: () => UI.say('Barkeep', 'A hooded one pays gold for unfinished letters down Cinder way. And that knight girl asks after you in every town. Every. Town.', { sub: B.title }) },
          { text: 'Just resting by the fire.', go: () => UI.hideDialog() }
        ]
      });
    }
    if (near.kind === 'study') {
      if (B._studyDone) return UI.say('Shelves', 'You have read the good shelf already. The third shelf is still biting other people.');
      B._studyDone = true;
      this.grantXp(6);
      this.addTuning(2, 'Old words settle in you.');
      Sound.sfx('good');
      return UI.say('Study', 'An hour passes among the shelves. Veil harmonics, requisition ledgers, one love letter used as a bookmark. (+6 xp)');
    }
    if (near.kind === 'herbs') {
      if (B._herbsDone) return UI.say('Herb beds', 'Only stems and good intentions left. They grow back by your next visit.');
      B._herbsDone = true;
      this.bag.tonic = (this.bag.tonic || 0) + 1;
      Sound.sfx('good');
      UI.toast('Picked: Veil Tonic greens.', 'good');
      UI.refresh();
      return UI.say('Herb beds', 'Moonwell mint, ember thyme. You bundle enough for one good tonic.');
    }
    if (near.kind === 'lecture') {
      if (B._lectureDone) return UI.say('Lecture', 'The professor is mid-sentence about the seventh loop. You already took notes on this one.');
      B._lectureDone = true;
      this.grantXp(8);
      this.addTuning(3, 'Learning tunes you.');
      Sound.sfx('good');
      return UI.say('Lecture', '“…and so the eighth loop proves intent.” Ninety minutes, three revelations, one splintered bench. (+8 xp)');
    }
    if (near.kind === 'plaque') {
      return UI.say(near.title || 'Note', near.text || '…');
    }
    return UI.toast('Nothing here answers to you.');
  },

  interactInterior() {
    const p = Entities.player, I = World.interior;
    const who = Entities.nearestTalkable(p.x, p.z, 3.8);
    const wd = who ? dist2D(p.x, p.z, who.x, who.z) : 1e9;
    let near = null, bd = 4.2;
    if (I) {
      for (const pr of I.floors[I.cur].props) {
        const dd = dist2D(p.x, p.z, pr.x, pr.z);
        if (dd < bd) { bd = dd; near = pr; }
      }
    }
    // fixtures win ties: a stair under your nose beats chat beside you
    if (near && bd <= wd) return this.useInteriorProp(near);
    if (who) return this.talk(who);
    if (near) return this.useInteriorProp(near);
    return UI.toast('Stone, tapestries, candlelight.');
  },

  useInteriorProp(near) {
    const p = Entities.player;
    if (near.kind === 'stairsUp' || near.kind === 'stairsDown') {
      World.switchInteriorFloor(near.to, near.tx, near.tz);
      UI.toast(['the great hall', 'the gallery', 'the study'][near.to] || ('floor ' + (near.to + 1)));
      return;
    }
    if (near.kind === 'doorOut') return this.leaveKeep();
    if (near.kind === 'plaque') {
      if (near.codex) this.unlockCodex(near.codex);
      return UI.say(near.title, near.text);
    }
    if (near.kind === 'bed') {
      p.hp = p.maxhp; p.focus = p.maxfocus;
      this.addTuning(3, 'Rest tunes you faster than anything but company.');
      return UI.say('Rest', 'You sleep in a bed meant for nobler blood. No one wakes you. You wake softer.');
    }
  },

  /* ---------------- dungeons ---------------- */
  tryDungeon(def) {
    if (def.needs && !this.bag[def.needs]) {
      return UI.say('Sealed', `The way down is warded. It wants ${ITEMS[def.needs].name}, and it is not interested in argument.`);
    }
    UI.say(def.name, def.intro, {
      choices: [
        { text: 'Go down', go: () => this.enterDungeon(def) },
        { text: 'Not yet', go: () => {} }
      ]
    });
  },

  enterDungeon(def) {
    const d = World.enterDungeon(def);
    this.flags['entered_' + def.id] = true;   // no longer hidden: you have been inside
    const p = Entities.player;
    this.returnPoint = { x: p.x, z: p.z };
    p.x = d.spawn.x; p.z = d.spawn.z; p.y = -800;
    Camera3.target.set(p.x, -798, p.z);
    for (const h of Entities.companions) { h.x = p.x - 2; h.z = p.z - 2; h.y = -800; }
    UI.banner(def.name, 'bring a light and a good reason');
    Sound.mood = 'tense';
    UI.refresh();
  },

  leaveDungeon() {
    World.exitDungeon();
    const p = Entities.player;
    const r = this.returnPoint || { x: SITES[0].x, z: SITES[0].z };
    p.x = r.x; p.z = r.z + 6; p.y = World.height(p.x, p.z);
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    for (const h of Entities.companions) { h.x = p.x - 2; h.z = p.z - 2; h.y = p.y; }
    Sound.mood = 'calm';
  },

  interactDungeon() {
    const p = Entities.player, d = World.dungeon;
    if (!d) return;
    if (dist2D(p.x, p.z, d.exit.x, d.exit.z) < 4) return this.leaveDungeon();
    let near = null, bd = 4.2;
    for (const pr of d.props) {
      if (pr.hidden) continue;
      const dd = dist2D(p.x, p.z, pr.x, pr.z);
      if (dd < bd) { bd = dd; near = pr; }
    }
    if (!near) return UI.toast('Stone, and more stone.');
    if (near.kind === 'stele') return this.readStele(d);
    if (near.kind === 'bell') return this.ringBell(d, near);
    if (near.kind === 'seal') return this.sealScene(d);
  },

  readStele(d) {
    const texts = {
      candles: 'Seven candles were set here and one was snuffed on purpose. Beneath them, cut deep: "count only what still burns."',
      bells: 'Three bells, and a line under them: "ring what still sings." Two of them are split from lip to crown.',
      seals: 'Seven pedestals. Six hold light. The seventh holds a person, and the inscription is one line: "force will only tighten it."'
    };
    const answers = {
      candles: { opts: ['Five', 'Six', 'Seven'], right: 1 },
      bells: null, seals: null
    };
    const t = texts[d.def.puzzle];
    const a = answers[d.def.puzzle];
    if (!a) return UI.say('Stone stele', t);
    UI.say('Stone stele', t, {
      choices: a.opts.map((o, i) => ({
        text: o,
        go: () => {
          if (i === a.right) this.solveDungeon(d);
          else { Sound.sfx('bad'); UI.say('The mechanism', 'Nothing moves. Read it again; the answer is standing in front of you.'); }
        }
      }))
    });
  },

  ringBell(d, prop) {
    if (prop.idx !== 1) {
      Sound.sfx('bad');
      return UI.say('The bell', 'A flat, dead knock. The crack swallows it. Somewhere behind the wall, nothing happens.');
    }
    Sound.sfx('seal');
    this.solveDungeon(d);
  },

  solveDungeon(d) {
    if (d.solved) { this.checkGoal('dungeon', d.def.id); return; }
    d.solved = true;
    this.flags['solved_' + d.def.id] = true;
    Sound.sfx('seal');
    Entities.ring(Entities.player.x, Entities.player.y, Entities.player.z, 0xbfe0ff, 7);
    const r = d.def.reward;
    // rewards land ATOMICALLY — the dialogue below is only the announcement,
    // so skipping it can never eat a key item like the Warden's Sigil
    if (r.item && !this.flags['reward_' + d.def.id]) {
      this.flags['reward_' + d.def.id] = true;
      this.bag[r.item] = (this.bag[r.item] || 0) + 1;
      UI.toast('Found: ' + ITEMS[r.item].name, 'good');
    }
    UI.say('The mechanism', 'Something heavy turns over, deep in the rock, and keeps turning for longer than a door should need.', {
      then: () => {
        UI.say('', r.text, { then: () => this.checkGoal('dungeon', d.def.id) });
      }
    });
  },

  /* The sealed heroine. Force fails on purpose; the seal is a held breath. */
  sealScene(d) {
    if (d.solved) {
      // repair an interrupted breaking (skipped lines, reload mid-chain):
      // the seal stays broken and she still joins — never a dead end
      if (!this.met.liora) { this.completeSeal(d); return; }
      return UI.toast('She is waiting at the surface now.');
    }
    UI.say('???', 'Behind the light, a girl stands with her eyes open and violet blooms still fresh in her black hair. She has been standing here longer than the flowers should have lasted. She sees you and she is not surprised.', {
      look: HEROINES.find(h => h.id === 'liora').look,
      choices: [
        { text: 'Strike the seal', go: () => { Sound.sfx('bad'); UI.say('The seal', 'It drinks the blow and closes another finger\'s width. The inscription said this. You read it and did it anyway.'); } },
        { text: 'Speak to her through it', go: () => UI.say('???', 'Her mouth moves. No sound crosses. She points at her own lips, then at yours, and waits — patiently, the way someone waits who has already waited eleven years.', {
            look: HEROINES.find(h => h.id === 'liora').look,
            then: () => UI.toast('The seal is a held breath. It wants one given back.') }) },
        { text: 'Lean in and give her the breath back', go: () => this.breakSeal(d) }
      ]
    });
  },

  breakSeal(d) {
    d.solved = true;
    this.flags['solved_' + d.def.id] = true;
    const def = HEROINES.find(h => h.id === 'liora');
    Sound.sfx('seal');
    Entities.ring(Entities.player.x, Entities.player.y, Entities.player.z, 0xffffff, 9);
    Entities.burst(Entities.player.x, Entities.player.y + 1.6, Entities.player.z, 0xbfe0ff, 30);
    UI.say('', 'The light goes out of the seventh pedestal all at once, the way a held breath goes out of a person. She is warm. She was always going to be warm.', {
      then: () => UI.say(def.realName, def.lines.greet[0], {
        sub: 'the sealed watcher', look: def.look,
        then: () => UI.say(def.realName, def.lines.deep[0] + ' ' + def.lines.deep[1], {
          sub: 'the sealed watcher', look: def.look,
          then: () => this.completeSeal(d)
        })
      })
    });
  },

  /* Idempotent: safe to call from the cinematic, from the repair path in
     sealScene, or after a reload — she joins exactly once, regardless. */
  completeSeal(d) {
    const def = HEROINES.find(h => h.id === 'liora');
    d.solved = true;
    this.flags['solved_' + d.def.id] = true;
    if (!this.met.liora) {
      this.met.liora = true;
      this.knowLiora();   // she has a name now — everywhere at once
      this.unlockCodex('sealed');
      this.addAff('liora', 8);
      this.secretsKnown = LORE.secrets.length;
      UI.toast('Liora Vaine travels with you.', 'good');
    }
    const has = Entities.heroineOf && Entities.heroineOf.liora;
    if (!has) {
      const e = Entities.addHeroine(def, Entities.player.x - 2, Entities.player.z - 2);
      e.y = World.mode === 'dungeon' ? -800 : e.y;
      e.recruited = true;
      e.command = e.command || 'follow';
    } else if (!has.recruited) {
      has.recruited = true;
      has.command = has.command || 'follow';
    }
    this.checkGoal('dungeon', d.def.id);
  },

  /* The sealed girl earns her name back exactly once — and keeps it. */
  knowLiora() {
    const L = HEROINES.find(h => h.id === 'liora');
    if (L) L.name = L.realName;
    const e = Entities.heroineOf && Entities.heroineOf.liora;
    if (e) e.name = (L && L.realName) || 'Liora Vaine';
  },
  forgetLiora() {
    const L = HEROINES.find(h => h.id === 'liora');
    if (L) L.name = '???';
    const e = Entities.heroineOf && Entities.heroineOf.liora;
    if (e) e.name = '???';
  },

  /* ---------------- party orders ---------------- */
  orderParty(cmd) {
    const roster = Entities.companions;
    if (!roster.length) return;
    for (const h of roster) {
      h.command = cmd;
      if (cmd === 'hold') { h.holdX = h.x; h.holdZ = h.z; }
      h.target = null;
    }
    const said = roster[0].def.lines.combat[(Math.random() * 3) | 0];
    const label = { follow: 'Stay close', attack: 'Engage', guard: 'Guard me', hold: 'Hold here' }[cmd];
    UI.toast(`${label} — "${said}"`);
    UI.refresh();
  },

  /* ---------------- elemental casting ---------------- */
  setElement(e) {
    if (this.elem === e || !SPELLS[e]) return;
    this.elem = e;
    Sound.sfx('ui');
    UI.toast(SPELLS[e].name + ' attuned — cast with V. Fuse: cast another element within 3 s.');
    UI.refresh();
  },

  castSpell() {
    const p = Entities.player;
    if (p.atkCd > 0) return;
    // free cast: with no target, hurl the spell at the ground ahead of you.
    // It still costs focus and still fuses — practice on air is allowed.
    const t = Entities.nearestMob(p.x, p.z, 24);
    const now = performance.now() / 1000;
    let key = this.elem;
    if (this.lastCast && this.lastCast !== this.elem && now - (this.lastCastT || -99) < 3) {
      key = [this.lastCast, this.elem].sort().join('+');
    }
    const S = SPELLS[key];
    if (!S) { this.lastCast = this.elem; this.lastCastT = now; return; }
    const combo = key !== this.elem;
    const cost = combo ? 18 : 8;
    if (p.focus < cost) { Sound.sfx('bad'); UI.toast('Not enough focus.'); return; }
    p.focus -= cost;
    this.lastCast = this.elem; this.lastCastT = now;
    p.atkCd = 0.6; p.action = 'cast'; p.actionT = 0.5;
    const dmg = Math.round(S.dmg + this.level * S.per);
    const D = this.derived();
    const crit = Math.random() * 100 < D.critR;
    const cdmg = crit ? Math.round(dmg * D.critD / 100) : dmg;
    const applyFx = (m, full) => {
      const dd = full ? cdmg : Math.round(cdmg / 2);
      Entities.damageMob(m, dd, 'You', crit);
      if (m.dead) return;
      if (S.fx.includes('burn')) { m.burnT = 3; m.burnD = 4 + this.level; Entities.burst(m.x, m.y + 1, m.z, 0xff6a2a, 8); }
      if (S.fx.includes('slow')) m.slowT = 4;
      if (S.fx.includes('slow2')) m.slowT = 7;
      if (S.fx.includes('knock')) {
        const dx = m.x - p.x, dz = m.z - p.z, l = Math.hypot(dx, dz) || 1;
        Entities.move(m, dx / l * 3, dz / l * 3);
      }
    };
    if (!t) {
      // ground-target: 9 m ahead, small AoE even for single-target spells
      const gx = p.x + Math.sin(p.yaw) * 9, gz = p.z + Math.cos(p.yaw) * 9;
      const gy = (typeof World !== 'undefined' ? World.height(gx, gz) : p.y);
      Entities.bolt(p.x, p.y + 1.4, p.z, gx, gy + 1, gz, S.color);
      const radius = S.aoe || 3;
      Entities.burst(gx, gy + 1, gz, S.color, 16);
      Entities.ring(gx, gy, gz, S.color, radius);
      Entities.magicCircle(gx, gy, gz, { rings: 2, runes: 10, star: null, spin: 1.8, color: S.color, r: radius, life: 0.8 });
      for (const m of [...Entities.mobs]) {
        if (!m.dead && dist2D(m.x, m.z, gx, gz) < radius + m.def.r) applyFx(m, true);
      }
      if (S.fx.includes('mend')) p.hp = Math.min(p.maxhp, p.hp + 6);
      Sound.sfx('magic');
      Camera3.kick(combo ? 0.22 : 0.1);
      if (combo) UI.toast(S.name + '!', 'good');
      UI.refresh();
      return;
    }
    p.yaw = Math.atan2(t.x - p.x, t.z - p.z);
    Entities.bolt(p.x, p.y + 1.4, p.z, t.x, t.y + 1, t.z, S.color);
    // sky-watch mark: tag a flyer and the party aims with you
    if (t.def.fly) Game.focusTarget = t;
    if (S.aoe) {
      Entities.burst(t.x, t.y + 1, t.z, S.color, 24);
      Entities.ring(t.x, t.y, t.z, S.color, S.aoe);
      Entities.magicCircle(t.x, t.y, t.z, { rings: 2, runes: 10, star: null, spin: 1.8, color: S.color, r: S.aoe, life: 0.8 });
      for (const m of [...Entities.mobs]) {
        if (!m.dead && dist2D(m.x, m.z, t.x, t.z) < S.aoe + m.def.r) applyFx(m, true);
      }
    } else applyFx(t, true);
    if (S.fx.includes('chain')) {
      let from = t, n = 0;
      for (const m of Entities.mobs) {
        if (n >= 2) break;
        if (m === t || m.dead) continue;
        if (dist2D(m.x, m.z, from.x, from.z) < 9) {
          Entities.bolt(from.x, from.y + 1, from.z, m.x, m.y + 1, m.z, S.color);
          applyFx(m, false);
          from = m; n++;
        }
      }
    }
    if (S.fx.includes('mend')) p.hp = Math.min(p.maxhp, p.hp + 6);
    Sound.sfx('magic');
    Camera3.kick(combo ? 0.22 : 0.1);
    if (combo) UI.toast(S.name + '!', 'good');
    UI.refresh();
  },

  /* Horn: call the ship to the nearest berth (near water only). */
  summonShip() { Entities.summonShip(); },

  strike() {
    const p = Entities.player;
    if (p.atkCd > 0) return;
    p.atkCd = 0.48;
    p.action = 'attack'; p.actionT = 0.32;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const hx = p.x + fx * 1.7, hz = p.z + fz * 1.7;
    Entities.ring(hx, p.y, hz, 0xe8e4da, 1.6);
    let hit = 0, critHit = false;
    const sharp = this.forgeBuffT > 0 ? 1.25 : 1;
    const D = this.derived();
    for (const m of Entities.mobs) {
      if (m.dead) continue;
      if (dist2D(hx, hz, m.x, m.z) < 2.3 + m.def.r) {
        let sd = Math.round((D.atk + ((Math.random() * 5) | 0)) * sharp);
        let c = false;
        if (Math.random() * 100 < D.critR) { sd = Math.round(sd * D.critD / 100); c = true; critHit = true; }
        Entities.damageMob(m, sd, 'You', c);
        // sky-watch mark: clip a flyer and the party aims with you
        if (m.def.fly && !m.dead) Game.focusTarget = m;
        hit++;
      }
    }
    if (hit) Camera3.kick(critHit ? 0.3 : 0.16);
    else Sound.sfx('ui');
  },

  equipItem(id) {
    const it = ITEMS[id];
    if (!it || !it.slot) return;
    const old = this.equip[it.slot];
    if (old) this.bag[old] = (this.bag[old] || 0) + 1;
    this.equip[it.slot] = id;
    this.bag[id]--;
    this.applyStats(false);
    Sound.sfx('ui');
  },
  unequip(slot) {
    const id = this.equip[slot];
    if (!id) return;
    this.bag[id] = (this.bag[id] || 0) + 1;
    this.equip[slot] = null;
    this.applyStats(false);
  },
  useItem(id) {
    const it = ITEMS[id], p = Entities.player;
    if (!it || !it.use || !this.bag[id]) return;
    if (it.use === 'heal') { p.hp = Math.min(p.maxhp, p.hp + it.power); Entities.popup(p.x, p.y + 2.4, p.z, '+' + it.power, 0x7fd0a0); }
    if (it.use === 'focus') { p.focus = Math.min(p.maxfocus, p.focus + it.power); }
    this.bag[id]--;
    Sound.sfx('good');
  },

  /* Long crossings ride the travel veil: it paints first, the new town
     streams in under it (World.update immediate = the real load), and the
     veil only lifts once the ground exists. */
  async travelTo(label, sub, apply) {
    // one crossing at a time: overlapping veils would teleport twice
    if (this._traveling) return;
    this._traveling = true;
    try {
      TravelVeil.show(label, sub);
      await TravelVeil.frames(3);
      TravelVeil.setProgress(0.35);
      await TravelVeil.frames(2);
      apply();
      TravelVeil.setProgress(0.9);
      await TravelVeil.frames(2);
      TravelVeil.setProgress(1);
      await new Promise(r => setTimeout(r, 380));
      TravelVeil.hide();
    } finally {
      this._traveling = false;
    }
  },

  fastTravel(s) {
    if (!this.visited[s.id]) return;
    const p0 = Entities.player;
    if (p0.aboard || p0.riding || p0.ferry || p0.dragon) { UI.toast('Step ashore first — then the map.'); return; }
    if (World.mode === 'dungeon') this.leaveDungeon();
    if (World.mode === 'interior') this.leaveKeep();
    if (World.mode === 'building') this.leaveBuilding();
    UI.closePanel();
    return this.travelTo(s.name, s.kind, () => {
      const p = Entities.player;
      p.x = s.x; p.z = s.z + s.r * 0.55;
      p.y = World.height(p.x, p.z);
      for (const h of Entities.companions) { h.x = p.x - 2; h.z = p.z - 2; h.y = p.y; }
      Camera3.target.set(p.x, p.y + 1.5, p.z);
      World.update(p.x, p.z, true);
      UI.banner(s.name, s.kind);
    });
  },

  /* ---------------- saves ---------------- */
  slotKey(i) { return 'rr3.slot.' + i; },
  slotMeta(i) {
    const d = Store.get(this.slotKey(i), null);
    if (!d) return null;
    return { name: d.playerName || 'Unnamed', level: d.level, act: d.act, where: d.where, when: d.when };
  },
  save(i) {
    const p = Entities.player;
    // saving inside a dungeon/keep records the door you came through instead
    let qx = (World.mode !== 'overworld' && this.returnPoint) ? this.returnPoint.x : p.x;
    let qz = (World.mode !== 'overworld' && this.returnPoint) ? this.returnPoint.z : p.z;
    // saving mid-voyage beaches the record: reload on the nearest shore,
    // never mid-water staring at a ferry that already sailed on
    if (p.ferry && World.mode === 'overworld') {
      const F = p.ferry;
      for (let r = 4; r <= 60 && qx === p.x; r += 4) {
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU;
          const x = F.x + Math.cos(a) * r, z = F.z + Math.sin(a) * r;
          if (Math.abs(x) > EXTENT || Math.abs(z) > EXTENT) continue;
          if (World.height(x, z) > SEA + 0.4 && !World.blocked(x, z, 0.6)) { qx = x; qz = z; break; }
        }
      }
    }
    const s = SITES.reduce((a, b) => dist2D(qx, qz, b.x, b.z) < dist2D(qx, qz, a.x, a.z) ? b : a);
    const near = dist2D(qx, qz, s.x, s.z) < s.r + 120 ? s.name : 'the open road';
    Store.set(this.slotKey(i), {
      v: 1, when: new Date().toLocaleString(), where: near,
      act: this.quest() ? this.quest().act : 6,
      playerName: this.playerName, level: this.level, xp: this.xp, gold: this.gold,
      tuning: this.tuning, base: this.base, equip: this.equip, bag: this.bag,
      aff: this.aff, met: this.met, visited: this.visited, flags: this.flags,
      doneQuests: this.doneQuests, questIndex: this.questIndex, kills: this.kills,
      killMark: this.killMark, talkedTo: this.talkedTo, secretsKnown: this.secretsKnown,
      rep: this.rep, codex: this.codex,
      bounty: this.bounty, escort: null,
      x: qx, z: qz, hp: p.hp,
      aboard: !!p.aboard,
      ship: Entities.ship ? { x: Entities.ship.x, z: Entities.ship.z, yaw: Entities.ship.yaw } : null,
      party: Entities.companions.map(h => ({ id: h.id, cmd: h.command })),
      heroines: Entities.npcs.filter(n => n.type === 'heroine').map(h => ({ id: h.id, lvl: h.lvl || 1, xp: h.xp || 0, skills: h.skills || [] }))
    });
    Sound.sfx('good');
  },
  load(i) {
    const d = Store.get(this.slotKey(i), null);
    if (!d) return false;
    // a record always wakes in the open world: step out of any room,
    // dungeon or helm first or the world renders the wrong layer
    if (World.mode === 'dungeon') this.leaveDungeon();
    if (World.mode === 'interior') this.leaveKeep();
    if (World.mode === 'building') this.leaveBuilding();
    Object.assign(this, {
      playerName: d.playerName || null, level: d.level || 1, xp: d.xp || 0,
      gold: d.gold || 0, tuning: d.tuning != null ? d.tuning : 8,
      base: d.base || { STR: 4, VIT: 4, AGI: 4 },
      equip: d.equip || { weapon: null, armor: null, charm: null },
      bag: d.bag || {}, aff: d.aff || {}, met: d.met || {},
      visited: d.visited || { castle: true }, flags: d.flags || {},
      doneQuests: d.doneQuests || {}, questIndex: d.questIndex || 0,
      kills: d.kills || 0, killMark: d.killMark || 0,
      talkedTo: d.talkedTo || {}, secretsKnown: d.secretsKnown || 0
    });
    this.rep = Object.assign({ rose: 0, wardens: 0, archive: 0, choir: 0 }, d.rep);
    this.codex = d.codex || {};
    this.bounty = d.bounty || null;
    if (this.met.liora) this.knowLiora();   // a freed name survives reloads
    const p = Entities.player;
    p.x = d.x; p.z = d.z; p.y = World.height(p.x, p.z);
    p.name = d.playerName || 'You';
    this.applyStats(false);
    p.hp = clamp(d.hp, 1, p.maxhp);
    Entities.npcs.forEach(n => { if (n.type === 'heroine') { n.recruited = false; n.casting = null; n.windup = null; } });
    // the freed arrive too: a sealed heroine you met must exist to rejoin
    for (const def of HEROINES) {
      if (!def.sealed || !this.met[def.id]) continue;
      if (!Entities.heroineOf[def.id]) Entities.addHeroine(def, p.x - 2, p.z - 2);
    }
    // anyone freed stays recruited — a lost flag never strands her again
    for (const def of HEROINES) {
      if (def.sealed && this.met[def.id] && this.doneQuests.q6_depths) {
        const h = Entities.heroineOf[def.id];
        if (h && !h.recruited) {
          h.recruited = true;
          h.command = h.command || 'follow';
        }
      }
    }
    (d.party || []).forEach(rec => {
      const h = Entities.heroineOf[rec.id];
      if (h) { h.recruited = true; h.command = rec.cmd || 'follow'; }
    });
    // heroine levels / skills survive reloads
    (d.heroines || []).forEach(rec => {
      const h = Entities.heroineOf[rec.id];
      if (h) {
        h.lvl = rec.lvl || 1; h.xp = rec.xp || 0; h.skills = rec.skills || [];
        h.maxhp = 120 + (h.lvl - 1) * 22; h.hp = Math.min(h.maxhp, h.hp || h.maxhp);
        h.maxfocus = 60 + (h.lvl - 1) * 6;
      }
    });
    if (this.flags.leftCastle && SITES[0].ward) SITES[0].ward.visible = false;
    // restore the ship; wake aboard if saved at the helm
    if (d.ship && Entities.ship) {
      Entities.ship.x = d.ship.x; Entities.ship.z = d.ship.z;
      Entities.ship.yaw = d.ship.yaw || 0; Entities.ship.speed = 0;
      Entities.placeShip();
    }
    Entities.endRide(true);   // wagons never survive a reload
    this.escort = null;
    p.ferry = null; p.aboardFerry = false; p.dragon = false;   // nor do ferry decks
    p.aboard = !!d.aboard && !!d.ship;
    if (p.aboard) {
      const helm = Entities.shipSeat(0);
      p.x = helm.x; p.z = helm.z; p.y = Entities.shipDeckY();
    }
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    World.update(p.x, p.z, true);
    this.started = true;
    UI.refresh();
    this.catchUpQuest();   // a loaded save may already satisfy the current quest
    return true;
  },
  eraseSlot(i) { Store.del(this.slotKey(i)); },

  /* ---------------- opening ---------------- */
  runIntro() {
    this.unlockCodex('avelune');
    const beats = [
      ['', 'A Tuesday. A crossing light. A sound overhead like a choir clearing its throat in a language that has no throat.'],
      ['', 'Seven pillars. A ring of chalk drawn for seven loops, and given eight by a hand that was not on the order.'],
      ['The circle', 'ERROR. The pattern does not recognise what it has caught. It catches you anyway.'],
      ['', 'You wake in a stone room in Auverne Castle. Your own clothes. Somebody else\'s mark, faint, on the inside of your wrist.'],
      ['', 'The air here is thick in a way air should not be. Standing up takes both hands and a decision.']
    ];
    let i = 0;
    const next = () => {
      if (i >= beats.length) {
        UI.banner('Auverne Castle', 'Act 0 — The Eighth Loop');
        UI.toast('The physician is watching you. Press E near someone to speak.', 'good');
        return;
      }
      const [w, t] = beats[i++];
      UI.say(w, t, { then: next });
    };
    next();
  },

  newGame() {
    if (World.mode === 'dungeon') this.leaveDungeon();
    if (World.mode === 'interior') this.leaveKeep();
    if (World.mode === 'building') this.leaveBuilding();
    // fresh loops start on foot: no helm, wagon, ferry or dragon survives
    try {
      const p0 = Entities.player;
      if (p0) { p0.aboard = false; p0.riding = false; p0.ferry = null; p0.aboardFerry = false; p0.dragon = false; }
      Entities.endRide(true);
    } catch {}
    Object.assign(this, {
      level: 1, xp: 0, gold: 60, tuning: 8, secretsKnown: 0,
      lastCast: null, lastCastT: 0,
      rep: { rose: 0, wardens: 0, archive: 0, choir: 0 }, codex: {},
      escort: null, bounty: null,
      base: { STR: 4, VIT: 4, AGI: 4 },
      equip: { weapon: null, armor: null, charm: null },
      bag: { tonic: 2, honeyloaf: 1, lily: 1 },
      aff: {}, met: {}, visited: { castle: true }, flags: {}, doneQuests: {},
      questIndex: 0, kills: 0, killMark: 0, talkedTo: {}, playerName: null
    });
    HEROINES.forEach(h => { this.aff[h.id] = 0; this.met[h.id] = false; });
    this.forgetLiora();   // a new loop seals her name again
    Entities.npcs.forEach(n => { if (n.type === 'heroine') { n.recruited = false; n.casting = null; n.windup = null; } });
    const p = Entities.player;
    const c = SITES[0];
    const sp = World.findOpenSpot(c.x, c.z + c.r * 0.42, 0.7);
    p.x = sp.x; p.z = sp.z; p.y = World.height(p.x, p.z);
    this.applyStats(true);
    Camera3.target.set(p.x, p.y + 1.5, p.z);
    this.started = true;
  },

  tick(dt) {
    // whetstone edge burns down
    if (this.forgeBuffT > 0) this.forgeBuffT = Math.max(0, this.forgeBuffT - dt);
    // safety net: nobody stays in the void — if you are somehow outside
    // the room walls (old leak, shove, reunion teleport), step outside
    if (World.mode === 'building' && typeof BINT !== 'undefined') {
      const p0 = Entities.player;
      const BW = (World.building && World.building.W) || BINT.w;
      const BD = (World.building && World.building.D) || BINT.d;
      if (Math.abs(p0.x - BINT.x) > BW + 2.5 || Math.abs(p0.z - BINT.z) > BD + 2.5) {
        this.leaveBuilding();
        return;
      }
    }    // session repair: a freed Liora with a lost flag rejoins on her own
    if (this.met.liora && !this._lioraFixed) {
      this._lioraFixed = true;
      const h = Entities.heroineOf && Entities.heroineOf.liora;
      if (h && !h.recruited) {
        h.recruited = true;
        h.command = 'follow';
        UI.toast('Liora Vaine rejoins you.', 'good');
      }
    }
    // slow passive tuning once you are out of bed, capped so it never replaces talking
    this.passiveT += dt;
    if (this.passiveT > 6) {
      this.passiveT = 0;
      if (this.tuning < 92) this.tuning = Math.min(92, this.tuning + 0.35);
    }
    // discovery
    const p = Entities.player;
    // escorts wait while you are indoors — ducking into a shop never fails them
    if (Input.context === 'play' && World.mode === 'overworld') this.tickEscort(dt);
    // dungeon seals light up once their clue is known
    for (const d of DUNGEONS) if (d.marker) d.marker.visible = !!this.flags[d.clue];
    // the ward hall: walking to the dais completes q0_walk (it had no trigger)
    if (World.mode === 'interior' && World.interior && World.interior.cur === 0) {
      const H = World.interior.hallPt;
      if (dist2D(p.x, p.z, H.x, H.z) < 7) this.checkGoal('reach', 'castle_hall');
    }
    for (const s of SITES) {
      const inside = dist2D(p.x, p.z, s.x, s.z) < s.r + 40;
      if (!this.visited[s.id] && inside) {
        this.visited[s.id] = true;
        UI.banner(s.name, s.kind);
        UI.toast(s.name + ' discovered. You can travel back here from the realm map.', 'good');
        if (s.id === 'whisper') this.unlockCodex('drift');
        if (s.id === 'prismere') this.unlockCodex('prismere');
      }
      // quest progress must trigger even if visited before the quest started
      if (inside) this.checkGoal('site', s.id);
    }
    // dragonroost rumor: first time under her shadow, Sora's invitation
    if (Entities.roost && !this.flags.roost && World.mode === 'overworld') {
      if (dist2D(p.x, p.z, Entities.roost.x, Entities.roost.z) < 220) {
        this.flags.roost = true;
        UI.toast('Dragonroost below — keeper Sora waves you toward a gold shadow.', 'good');
        Sound.sfx('good');
      }
    }
    // clue pickups at ruins and shrines (quest check runs even if read early)
    if (dist2D(p.x, p.z, -1900, 900) < 60) {
      if (!this.flags.clue_gloam) {
        this.flags.clue_gloam = true;
        this.unlockCodex('gloam');
        UI.say('The chiselled mural', 'Seven figures. The seventh has been cut out while the stone was still soft, and whoever did it left a direction scratched into the base: seven hundred paces east, where the rock splits.', { then: () => this.checkGoal('flag') });
      } else this.checkGoal('flag');
    }
    if (!this.flags.clue_spine && dist2D(p.x, p.z, 2200, -2600) < 200) {
      this.flags.clue_spine = true;
      this.unlockCodex('ember');
      UI.toast('A dockhand mentions a vault in the Gravespine that nobody has opened.', 'good');
    }
    if (!this.flags.clue_tarn && this.visited.tarn) {
      this.flags.clue_tarn = true;
      this.unlockCodex('tarn');
    }
    // side-descent rumors, earned by going places
    if (!this.flags.clue_ember && this.visited.emberfall) {
      this.flags.clue_ember = true;
      this.unlockCodex('ember');
      UI.toast('Forge-talk: a vault breathes heat in the caldera rocks.', 'good');
    }
    if (!this.flags.clue_frost && this.visited.chapel) {
      this.flags.clue_frost = true;
      UI.toast('The chapel watches a white door in the high col.', 'good');
    }
    if (!this.flags.clue_thorn && this.visited.whisper) {
      this.flags.clue_thorn = true;
      UI.toast('A grove east of the ruin grew over something that objected.', 'good');
    }
  }
};

/* =====================================================================
   ELEMENTAL MAGIC — five attunements (keys 1–5), one cast (V).
   Cast a different element within 3 s of the last and they fuse into
   a combination spell, in the old Magicka manner:
   steam, inferno, magma, blaze, rime, mire, storm, dust, tempest, ruin.
   ===================================================================== */
const SPELLS = {
  fire:      { name: 'Ember',  color: 0xff6a2a, dmg: 10, per: 3, fx: ['burn'] },
  water:     { name: 'Tide',   color: 0x4aa8e8, dmg: 8,  per: 2, fx: ['slow', 'mend'] },
  wind:      { name: 'Gale',   color: 0x9ae8c8, dmg: 8,  per: 2, aoe: 3, fx: ['knock'] },
  earth:     { name: 'Stone',  color: 0xc89858, dmg: 14, per: 4, fx: [] },
  lightning: { name: 'Spark',  color: 0xcfa8ff, dmg: 9,  per: 3, fx: ['chain'] },
  'fire+water':      { name: 'Steam',    color: 0xcfd8e8, dmg: 14, per: 3, aoe: 5, fx: ['slow'] },
  'fire+wind':       { name: 'Inferno',  color: 0xff3a1a, dmg: 20, per: 4, aoe: 6, fx: ['burn'] },
  'earth+fire':      { name: 'Magma',    color: 0xd84818, dmg: 22, per: 5, aoe: 5, fx: ['burn'] },
  'fire+lightning':  { name: 'Blaze',    color: 0xff8a5a, dmg: 24, per: 5, fx: ['burn', 'chain'] },
  'water+wind':      { name: 'Rime',     color: 0xa8e8ff, dmg: 12, per: 3, aoe: 4, fx: ['slow'] },
  'earth+water':     { name: 'Mire',     color: 0x8a6a4a, dmg: 12, per: 3, aoe: 5, fx: ['slow2'] },
  'lightning+water': { name: 'Storm',    color: 0x8ab8ff, dmg: 13, per: 3, aoe: 4, fx: ['chain'] },
  'earth+wind':      { name: 'Dust',     color: 0xd8c088, dmg: 13, per: 3, aoe: 5, fx: ['knock', 'slow'] },
  'lightning+wind':  { name: 'Tempest',  color: 0x9ae8ff, dmg: 15, per: 3, aoe: 4, fx: ['chain', 'knock'] },
  'earth+lightning': { name: 'Cataclysm',color: 0xe8a84a, dmg: 24, per: 5, aoe: 6, fx: ['slow'] }
};

/* What the player says out loud. Shared across heroines so every
   choice reads as speech; her answers stay hers alone. */
const PLAYER_LINES = {
  chat: [
    'How is your day going?',
    'What are you thinking about?',
    'Walk with me a while?'
  ],
  chatMore: [
    'Tell me more.',
    'And then?',
    'I like hearing you talk.'
  ],
  kind: [
    'Thank you — for everything you do.',
    'You have a good heart, you know.',
    'I am glad you are here.'
  ],
  joke: [
    'Why did the wraith cross the road? …He didn\'t. He is still deciding.',
    'A tonic, a charm and dry socks walk into a bar. The merchant retires.',
    'I told the third shelf a joke. It bit me. Legally.',
    'What do you call a duelist with a pie? Ignia, before training.'
  ],
  romance: [
    'I think about you more than I should.',
    'Stay with me. Not for duty — for me.',
    'Whatever the loops took, they gave me you.',
    'I choose you. In every loop, I choose you.'
  ],
  deep: 'What aren\'t you telling me?',
  gift: 'I brought you something.',
  farewell: 'I should go. Later.',
  subject: 'Let us talk of other things.'
};


/* =====================================================================
   LOADFX — quiet embers rising over black. Half-res canvas, additive
   dots; overload warms them red-gold just before the veil lifts.
   ===================================================================== */
const LoadFX = {
  cv: null, ctx: null, raf: 0, last: 0, hot: 0, motes: [],
  start() {
    this.cv = document.getElementById('loadfx');
    if (!this.cv) return;
    this.ctx = this.cv.getContext('2d');
    const fit = () => {
      this.w = Math.max(2, (innerWidth / 2) | 0);
      this.h = Math.max(2, (innerHeight / 2) | 0);
      this.cv.width = this.w; this.cv.height = this.h;
    };
    fit();
    this._fit = fit;
    addEventListener('resize', fit);
    this.motes = [];
    for (let i = 0; i < 60; i++) this.seed(true);
    this.last = performance.now();
    this.hot = 0;
    const frame = now => {
      if (!this.ctx) return;
      this.raf = requestAnimationFrame(frame);
      let dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0.1) dt = 0.1;
      this.draw(dt);
    };
    this.raf = requestAnimationFrame(frame);
  },
  seed(anywhere) {
    this.motes.push({
      x: Math.random() * this.w,
      y: anywhere ? Math.random() * this.h : this.h + 6,
      v: 12 + Math.random() * 30,
      r: 0.8 + Math.random() * 2.2,
      sway: Math.random() * 6.28,
      gold: Math.random() < 0.3
    });
  },
  draw(dt) {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      m.y -= m.v * dt;
      m.sway += dt * 1.5;
      m.x += Math.sin(m.sway) * 8 * dt;
      if (m.y < -8) { Object.assign(m, { x: Math.random() * this.w, y: this.h + 6 }); }
      const heat = this.hot;
      const col = m.gold
        ? `rgba(232,200,130,${0.25 + heat * 0.4})`
        : heat > 0.3 && (m.y % 7) < 1
          ? `rgba(255,70,80,${0.3 + heat * 0.4})`
          : `rgba(235,230,220,${0.16 + heat * 0.25})`;
      g.fillStyle = col;
      g.beginPath();
      g.arc(m.x, m.y, m.r * (1 + heat * 0.6), 0, 6.283);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  },
  overload() { this.hot = Math.min(1, this.hot + 0.25); },
  stop() {
    cancelAnimationFrame(this.raf);
    if (this._fit) removeEventListener('resize', this._fit);
    this.ctx = null;
  }
};

/* =====================================================================
   TRAVEL VEIL — the town-to-town loading screen.
   The Eighth Loop sigil (seven gold loops + one crimson) turns while the
   destination streams in; the bar eases toward staged progress and the
   veil only lifts once the new ground is actually built.
   ===================================================================== */
const TravelVeil = {
  el: null, cv: null, ctx: null, raf: 0, last: 0, t: 0,
  target: 0, shown: 0, motes: [], _gen: 0,
  TIPS: [
    'The veil parts for those it has learned.',
    'Hold your breath out. The stones do the rest.',
    'Every road in Avelune remembers your feet.',
    'Say “later” to the town behind you.',
    'The eighth loop was drawn for exactly this.',
    'Count the loops as you cross. There are eight.'
  ],
  show(dest, sub) {
    this.el = this.el || $('veil');
    if (!this.el) return;
    this._gen++;
    cancelAnimationFrame(this.raf);
    $('veil-dest').textContent = dest || 'Crossing the Veil';
    $('veil-sub').textContent = sub || '';
    $('veil-tip').textContent = this.TIPS[(Math.random() * this.TIPS.length) | 0];
    this.el.classList.remove('off');
    this.cv = this.cv || $('veil-sigil');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = 240 * dpr; this.cv.height = 240 * dpr;
    this.ctx = this.cv.getContext('2d');
    this._dpr = dpr;
    this.target = 0.05; this.shown = 0; this.t = 0;
    this.motes = [];
    for (let i = 0; i < 34; i++) {
      this.motes.push({
        x: Math.random(), y: Math.random(),
        v: 0.02 + Math.random() * 0.06,
        r: (0.8 + Math.random() * 1.8) * dpr,
        tw: Math.random() * TAU
      });
    }
    this.last = performance.now();
    const frame = now => {
      this.raf = requestAnimationFrame(frame);
      let dt = (now - this.last) / 1000; this.last = now;
      if (dt > 0.1) dt = 0.1;
      this.draw(dt);
    };
    this.raf = requestAnimationFrame(frame);
  },
  setProgress(f) { this.target = clamp(f, 0, 1); },
  frames(n) {
    return new Promise(res => {
      const step = () => { if (n-- <= 0) res(); else requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  },
  hide() {
    if (!this.el) return;
    const gen = this._gen;
    this.target = 1;
    this.el.classList.add('off');
    setTimeout(() => { if (gen === this._gen) cancelAnimationFrame(this.raf); }, 650);
  },
  draw(dt) {
    const g = this.ctx;
    if (!g) return;
    this.t += dt;
    this.shown += (this.target - this.shown) * Math.min(1, dt * 3.2);
    const S = this.cv.width, r = S / 2, dpr = this._dpr || 1;
    const R = S * 0.36;
    g.clearRect(0, 0, S, S);
    // rising motes
    for (const m of this.motes) {
      m.y -= m.v * dt; m.tw += dt * 2;
      if (m.y < -0.03) { m.y = 1.03; m.x = Math.random(); }
      g.fillStyle = `rgba(232,220,190,${0.25 + Math.sin(m.tw) * 0.2})`;
      g.beginPath(); g.arc(m.x * S, m.y * S, m.r, 0, TAU); g.fill();
    }
    // the eight loops: seven gold, the last one crimson
    for (let k = 0; k < 8; k++) {
      const a0 = this.t * 0.5 + k * TAU / 8;
      const eighth = k === 7;
      g.strokeStyle = eighth
        ? `rgba(220,40,80,${0.75 + Math.sin(this.t * 3) * 0.2})`
        : 'rgba(216,193,138,.55)';
      g.lineWidth = (eighth ? 3 : 1.5) * dpr;
      g.beginPath();
      g.arc(r, r, R, a0, a0 + TAU / 8 * 0.62);
      g.stroke();
    }
    // progress sweep + heart diamond
    g.strokeStyle = 'rgba(190,220,255,.9)';
    g.lineWidth = 2 * dpr;
    g.beginPath();
    g.arc(r, r, R - 14 * dpr, -Math.PI / 2, -Math.PI / 2 + this.shown * TAU);
    g.stroke();
    g.save();
    g.translate(r, r); g.rotate(Math.PI / 4);
    g.fillStyle = '#d8c18a';
    const d = 5 * dpr + this.shown * 2 * dpr;
    g.fillRect(-d / 2, -d / 2, d, d);
    g.restore();
    const fill = $('veil-fill');
    if (fill) fill.style.width = Math.round(this.shown * 100) + '%';
  }
};

/* =====================================================================
   BOOT
   ===================================================================== */
const App = {
  state: 'title', renderer: null, scene: null, cam: null, clock: 0,

  async boot() {
    // title stays veiled until the player chooses to begin (first click
    // also unlocks audio, which is why the menu has music from then on)
    $('title').classList.add('off');
    LoadFX.start();   // black water first — it animates while we build
    const note = t => { const el = $('boot-note'); if (el) el.textContent = t; };
    const fill = f => {
      const bar = $('loadbar-fill'), pct = $('loadbar-pct');
      if (bar) bar.style.width = Math.round(f * 100) + '%';
      if (pct) pct.textContent = Math.round(f * 100) + '%';
    };
    const pause = ms => new Promise(r => setTimeout(r, ms));

    note('chalking the first loop…'); fill(0.15);
    const canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(1.75, devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(58, 1, 0.35, 1600);
    Camera3.init(this.cam);
    Input.init(canvas);
    UI.init();
    await pause(250);

    note('lighting the seven…'); fill(0.45);
    await pause(50);
    World.init(this.scene);
    Entities.init(this.scene);
    // queue the home chunks instead of building them all at once — the big
    // synchronous build is what froze the loading animation dead
    World.update(Entities.player.x, Entities.player.z);
    // chart the realm once, up front: the minimap blits from this cache,
    // so building it here means no hitch on its first frame in play
    try { UI.renderMapCache(); } catch {}
    fill(0.6);

    // quest beacon: a soft pillar of light over the current objective
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.8, 80, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xe4a0b8, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.beacon.visible = false;
    this.scene.add(this.beacon);

    note('one more line, in red…'); fill(0.75);
    this.resize();
    addEventListener('resize', () => this.resize());
    // park the boot camera on the castle so the veil never frames a void
    {
      const p = Entities.player;
      const cx = p.x + 70, cz = p.z + 130;
      this.cam.position.set(cx, World.height(cx, cz) + 26, cz);
      this.cam.lookAt(p.x, p.y + 12, p.z);
    }

    $('start-new').onclick = () => { Sound.unlock(); this.begin(true); };
    $('start-cont').onclick = () => {
      Sound.unlock();
      let found = 0;
      for (let i = 1; i <= 9; i++) if (Game.slotMeta(i)) found = i;
      if (!found) { UI.toast('No records written yet.'); return; }
      this.begin(false);
      Game.load(found);
    };
    $('start-load').onclick = () => { Sound.unlock(); UI.openPanel('save'); };
    $('start-opts').onclick = () => { Sound.unlock(); UI.openPanel('options'); };
    this.refreshTitle();
    fill(1);

    Loop.start(dt => this.update(dt), dt => this.render(dt));
    await pause(900);
    LoadFX.overload();   // the current runs hot as the veil prepares
    await pause(700);
    $('loading').classList.add('done');
    setTimeout(() => { const l = $('loading'); if (l) l.remove(); }, 900);

    // click-anywhere veil over the blurred world
    const bv = $('begin');
    bv.classList.remove('off');
    const TIPS = [
      'Talk to people — language is how the veil learns you.',
      'Shift runs. Space jumps — double-tap it to swim.',
      'Attune 1–5, cast with V. Mix elements within 3 seconds.',
      'Heroines fight beside you, and never truly fall.',
      'The gold star on your compass is always the objective.',
      'Beds rest you to full. Rurika does the rest.'
    ];
    let tipI = 0;
    const tipTimer = setInterval(() => {
      const el = $('load-tip');
      if (!el) { clearInterval(tipTimer); return; }
      tipI = (tipI + 1) % TIPS.length;
      el.style.opacity = 0;
      setTimeout(() => { const e2 = $('load-tip'); if (e2) { e2.textContent = TIPS[tipI]; e2.style.opacity = 0.75; } }, 400);
    }, 2800);
    let begun = false;
    const begin = () => {
      if (begun) return; begun = true;
      clearInterval(tipTimer);
      LoadFX.stop();
      Sound.unlock();   // menu BGM starts here, on your gesture
      document.body.classList.remove('veiled');
      bv.classList.add('off');
      $('title').classList.remove('off');
      setTimeout(() => bv.remove(), 900);
    };
    bv.onclick = begin;
    addEventListener('keydown', function k(e) {
      if (e.key === 'Enter' || e.key === ' ') { removeEventListener('keydown', k); begin(); }
    });
  },

  // Load appears only when at least one record exists
  refreshTitle() {
    let found = false;
    for (let i = 1; i <= 9; i++) if (Game.slotMeta(i)) { found = true; break; }
    $('start-load').style.display = found ? '' : 'none';
  },

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    Preview.resize();
  },

  begin(fresh) {
    $('title').classList.add('off');
    $('hud').classList.remove('off');
    if (fresh) Game.newGame();
    else Game.started = true;
    this.state = 'play';
    Input.context = 'play';
    Sound.mood = 'town';
    UI.refresh();
    if (fresh) Game.runIntro();
  },

  update(dt) {
    const p0 = Entities.player;
    // stream terrain even on menus so play starts on solid ground
    if (p0 && World.mode === 'overworld') World.update(p0.x, p0.z);
    if (this.state !== 'play') return;
    this.clock += dt;
    this.keys();
    if (Input.context === 'play') {
      Entities.update(dt);
      Game.tick(dt);
    } else {
      // keep the world alive but stop the player while menus are open
      Entities.player.moveAmt = damp(Entities.player.moveAmt, 0, 1e-6, dt);
      Entities.player.ch.update(dt, Entities.player.moveAmt, null);
      for (const h of Entities.companions) h.ch.update(dt, 0, null);
    }
    const p = Entities.player;
    World.tick(dt, this.clock, p.x, p.z);
    Camera3.update(dt, p);
    // steer the quest beacon (outdoors only — it would stab through the keep roof)
    const tp = World.mode === 'overworld' ? Game.targetPoint() : null;
    if (tp && this.beacon) {
      this.beacon.visible = true;
      this.beacon.position.set(tp.x, Entities.groundY(tp.x, tp.z) + 38, tp.z);
      this.beacon.rotation.y += dt * 0.4;
    } else if (this.beacon) this.beacon.visible = false;
    this.updatePrompt();
    UI.refresh();
  },

  updatePrompt() {
    if (Input.context !== 'play') return UI.prompt(null);
    const p = Entities.player;
    if (p.ferry) return UI.prompt('<kbd>E</kbd> step ashore');
    if (p.dragon) return UI.prompt('<kbd>E</kbd> land the dragon');
    if (p.aboard) {
      const mate = Entities.nearestTalkable(p.x, p.z, 2.2);
      if (mate) return UI.prompt(`<kbd>E</kbd> speak with <b>${mate.type === 'heroine' ? mate.def.name : mate.name}</b>`);
      return UI.prompt('<kbd>E</kbd> step ashore');
    }
    if (p.riding) return UI.prompt('<kbd>E</kbd> stop the wagons');
    if (World.mode === 'interior') {
      const who = Entities.nearestTalkable(p.x, p.z, 3.8);
      const wd = who ? dist2D(p.x, p.z, who.x, who.z) : 1e9;
      const I = World.interior;
      let near = null, bd = 4.2;
      if (I) {
        for (const pr of I.floors[I.cur].props) {
          const dd = dist2D(p.x, p.z, pr.x, pr.z);
          if (dd < bd) { bd = dd; near = pr; }
        }
      }
      if (near && bd <= wd) return UI.prompt(`<kbd>E</kbd> ${near.label}`);
      if (who) return UI.prompt(`<kbd>E</kbd> speak with <b>${who.type === 'heroine' ? who.def.name : who.name}</b>`);
      if (near) return UI.prompt(`<kbd>E</kbd> ${near.label}`);
      return UI.prompt(null);
    }
    if (World.mode === 'dungeon') {
      const d = World.dungeon;
      if (d && dist2D(p.x, p.z, d.exit.x, d.exit.z) < 4) return UI.prompt('<kbd>E</kbd> climb back out');
      for (const pr of (d ? d.props : [])) {
        if (pr.hidden) continue;
        if (dist2D(p.x, p.z, pr.x, pr.z) < 4.2) return UI.prompt(`<kbd>E</kbd> ${pr.label}`);
      }
      return UI.prompt(null);
    }
    if (World.mode === 'building') {
      const B = World.building;
      const who2 = Entities.nearestTalkable(p.x, p.z, 3.0);
      const wd2 = who2 ? dist2D(p.x, p.z, who2.x, who2.z) : 1e9;
      let near2 = null, bd2 = 3.6;
      if (B) {
        for (const pr of B.props) {
          if (pr.hidden) continue;
          const dd2 = dist2D(p.x, p.z, pr.x, pr.z);
          if (dd2 < bd2) { bd2 = dd2; near2 = pr; }
        }
      }
      if (near2 && bd2 <= wd2) return UI.prompt(`<kbd>E</kbd> ${near2.label}`);
      if (who2) return UI.prompt(`<kbd>E</kbd> speak with <b>${who2.type === 'heroine' ? who2.def.name : who2.name}</b>`);
      if (near2) return UI.prompt(`<kbd>E</kbd> ${near2.label}`);
      return UI.prompt(null);
    }
    const who = Entities.nearestTalkable(p.x, p.z, 3.8);
    const wd = who ? dist2D(p.x, p.z, who.x, who.z) : 1e9;
    const c = SITES[0];
    const kd = dist2D(p.x, p.z, c.x, c.z - 9);
    const gd = (c.gate && !Game.flags.leftCastle) ? dist2D(p.x, p.z, c.gate.x, c.gate.z) : 1e9;
    let dd = null, ddDist = 1e9;
    for (const d of DUNGEONS) {
      const q = dist2D(p.x, p.z, d.x, d.z);
      if (q < ddDist) { ddDist = q; dd = d; }
    }
    const sd = Entities.ship ? dist2D(p.x, p.z, Entities.ship.x, Entities.ship.z) : 1e9;
    const shipReady = Entities.ship && !Entities.ship.summon;
    let st = null, stDist = 1e9;
    for (const s of SITES) {
      if (!s.stone || !Game.visited[s.id]) continue;
      const q = dist2D(p.x, p.z, s.stone.x, s.stone.z);
      if (q < stDist) { stDist = q; st = s; }
    }
    const upHigh = p.y > 60;
    const gateD = World.skyGate ? dist2D(p.x, p.z, World.skyGate.x, World.skyGate.z) : 1e9;
    let padIdx = -1, padD = 1e9;
    if (upHigh && World.skyIsles) {
      World.skyIsles.forEach((I, i) => {
        const q = dist2D(p.x, p.z, I.x, I.z);
        if (q < padD) { padD = q; padIdx = i; }
      });
    }
    const chestD = (upHigh && World.skyChest) ? dist2D(p.x, p.z, World.skyChest.x, World.skyChest.z) : 1e9;
    let sg = null, sgDist = 1e9;
    for (const s of SITES) {
      if (!s.sign || !Game.visited[s.id]) continue;
      const q = dist2D(p.x, p.z, s.sign.x, s.sign.z);
      if (q < sgDist) { sgDist = q; sg = s; }
    }
    if (shipReady && sd < 7 && sd <= wd && sd <= kd && sd <= gd && sd <= ddDist) return UI.prompt('<kbd>E</kbd> board <b>the ship</b>');
    if (Entities.ferries && Entities.ferries.length) {
      for (const F of Entities.ferries) {
        if (dist2D(p.x, p.z, F.x, F.z) < 10) return UI.prompt(`<kbd>E</kbd> board <b>${F.def.name}</b>`);
      }
      for (const s of SITES) {
        if (s.dock && dist2D(p.x, p.z, s.dock.x, s.dock.z) < 6) return UI.prompt('<kbd>E</kbd> ring the <b>ferry bell</b>');
      }
    }
    if (st && stDist < 6 && stDist <= wd) return UI.prompt('<kbd>E</kbd> touch the <b>waystone</b>');
    if (!upHigh && World.skyGate && gateD < 5 && gateD <= wd) return UI.prompt('<kbd>E</kbd> step into the <b>sky-gate</b>');
    if (upHigh && padIdx >= 0 && padD < 7) return UI.prompt('<kbd>E</kbd> use the <b>waypad</b>');
    if (upHigh && chestD < 4) return UI.prompt('<kbd>E</kbd> open the <b>sky chest</b>');
    if (sg && sgDist < 5 && sgDist <= wd) return UI.prompt('<kbd>E</kbd> read the <b>signpost</b>');
    let bd = null, bdDist = 1e9, wg = null, wgDist = 1e9;
    for (const s of SITES) {
      if (!Game.visited[s.id]) continue;
      if (s.board) {
        const q = dist2D(p.x, p.z, s.board.x, s.board.z);
        if (q < bdDist) { bdDist = q; bd = s; }
      }
      if (s.wagon) {
        const q = dist2D(p.x, p.z, s.wagon.x, s.wagon.z);
        if (q < wgDist) { wgDist = q; wg = s; }
      }
    }
    if (bd && bdDist < 5 && bdDist <= wd) return UI.prompt('<kbd>E</kbd> read the <b>guild writs</b>');
    if (wg && wgDist < 5 && wgDist <= wd) return UI.prompt('<kbd>E</kbd> hire a <b>wagon</b>');
    if (p.riding) return UI.prompt('<kbd>E</kbd> stop the wagons');
    if (World.doors) {
      let door = null, doorD = 4.5;
      for (const dr of World.doors) {
        const q = dist2D(p.x, p.z, dr.x, dr.z);
        if (q < doorD) { doorD = q; door = dr; }
      }
      if (door && doorD <= wd) {
        const nm = (typeof BUILDING_INFO !== 'undefined' && BUILDING_INFO[door.kind]) ? BUILDING_INFO[door.kind].title : door.kind;
        return UI.prompt(`<kbd>E</kbd> enter the <b>${nm}</b>`);
      }
    }
    if (kd < 10 && kd <= wd && kd <= gd && kd <= ddDist) return UI.prompt('<kbd>E</kbd> enter <b>the keep</b>');
    if (gd < 9 && gd <= wd && gd <= ddDist) return UI.prompt('<kbd>E</kbd> approach the ward');
    if (dd && ddDist < 8 && ddDist <= wd) return UI.prompt(`<kbd>E</kbd> ${Game.flags[dd.clue] ? `descend into <b>${dd.name}</b>` : `inspect the sealed stones`}`);
    if (Entities.dragon && !p.dragon) {
      const drd = dist2D(p.x, p.z, Entities.dragon.x, Entities.dragon.z);
      if (drd < 9 && drd <= wd) return UI.prompt('<kbd>E</kbd> board <b>Aurelia</b>');
    }
    if (who) return UI.prompt(`<kbd>E</kbd> speak with <b>${who.type === 'heroine' ? (Game.met[who.id] ? who.def.name : 'someone') : who.name}</b>`);
    UI.prompt(null);
  },

  keys() {
    if (Input.consume('menu')) {
      // Esc on story text runs it forward (advance fires the chained quest
      // triggers); Esc on a choice menu cancels the menu. Never silently
      // drop a dialogue chain — that soft-locked quests.
      if (!$('dlg').classList.contains('off')) {
        if (UI.dlgLocked) UI.hideDialog();
        else UI.advance();
      }
      else if (UI.cmdOpen) UI.toggleCommand(false);
      else if (UI.activeTab) UI.closePanel();
      else UI.toggleRing();
      return;
    }
    if (Input.context === 'dialogue') {
      if (Input.consume('interact')) UI.advance();
      return;
    }
    if (Input.context !== 'play') return;
    if (Input.consume('interact')) Game.interact();
    if (Input.consume('attack')) Game.strike();
    if (Input.consume('cast')) Game.castSpell();
    if (Input.consume('fire')) Game.setElement('fire');
    if (Input.consume('water')) Game.setElement('water');
    if (Input.consume('wind')) Game.setElement('wind');
    if (Input.consume('earth')) Game.setElement('earth');
    if (Input.consume('lightning')) Game.setElement('lightning');
    if (Input.consume('horn')) Game.summonShip();
    if (Input.consume('pov') && typeof Camera3 !== 'undefined' && Camera3.togglePov) Camera3.togglePov();
    if (Input.consume('command')) UI.toggleCommand();
    if (Input.consume('map')) UI.openPanel('map');
    if (Input.consume('quests')) UI.openPanel('quests');
    if (Input.consume('bonds')) UI.openPanel('bonds');
    if (Input.consume('bag')) UI.openPanel('bag');
    if (Input.consume('status')) UI.openPanel('status');
  },

  render(dt) {
    if (World.mode === 'overworld') {
      const foggy = World.weather && World.weather.kind === 'fog';
      // duck under the surface: water closes over the camera
      if (this.cam.position.y < 0.5) {
        this.scene.fog.near = 2; this.scene.fog.far = 70;
        this.scene.background.setHex(0x0a2e4a);
      } else if (!foggy) { this.scene.fog.near = 260; this.scene.fog.far = 900; }
    }
    // adaptive resolution: weak hardware sheds pixels before it sheds frames
    this._qT = (this._qT || 0) + dt;
    if (this._qT > 2) {
      this._qT = 0;
      const cap = Math.min(1.75, window.devicePixelRatio || 1);
      const pr = this.renderer.getPixelRatio();
      if (Loop.fps < 24 && pr > 1) this.renderer.setPixelRatio(Math.max(1, pr - 0.25));
      else if (Loop.fps > 55 && pr < cap) this.renderer.setPixelRatio(Math.min(cap, pr + 0.25));
    }
    this.renderer.render(this.scene, this.cam);
    Preview.tick(dt);
    Sound.update(dt);
    const p = Entities.player;
    $('fps').textContent = Loop.fps + ' fps';
    $('coords').textContent = p ? Math.round(p.x) + ', ' + Math.round(p.z) : '';
  }
};

/* companions is derived, kept as a live array for the HUD */
Object.defineProperty(Entities, 'companions', {
  get() {
    if (!this._comp) this._comp = [];
    this._comp.length = 0;
    for (const n of this.npcs) if (n.type === 'heroine' && n.recruited) this._comp.push(n);
    return this._comp;
  }
});

addEventListener('DOMContentLoaded', () => {
  if (typeof THREE === 'undefined') {
    document.getElementById('boot-note').textContent = 'Three.js failed to load — check the network and reload.';
    return;
  }
  App.boot();
});
