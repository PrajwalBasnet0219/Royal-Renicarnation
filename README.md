# Royal Reincarnation — The Eighth Loop

A 3D browser JRPG: love ✦ chaos ✦ reincarnation. Procedural Three.js world (12km overworld, castle keep interior, dungeons + bosses), heroine companions, fusion magic, synth SFX + MP3 BGM.

![menu](game_menu.png)

## Play

No build step — static files only.

Option A (recommended, avoids browser autoplay/file quirks):
```bash
cd files
python3 -m http.server 8000
# open http://localhost:8000
```

Option B: double-click `index.html` (Three.js is vendored in `js/three.min.js`, works offline).

Click anywhere on the "Click anywhere to begin" screen to unlock audio.

## Controls

| Key | Action |
|-----|--------|
| WASD / arrows | move |
| E | speak / interact / advance dialogue |
| F | strike |
| V | cast attuned element |
| 1–5 | attune fire / water / wind / earth / lightning (cast twice <3s = fusion) |
| G | party orders |
| Space | swim |
| Esc | command ring / close panel |

Quest target: follow the compass ◆ + rose beacon pillar.

## Structure

```
files/
  index.html        canvas, HUD, title, script boot order
  css/style.css     gothic bone-on-ink theme
  js/
    three.min.js    Three.js r128, vendored (offline + CDN fallback in index.html)
    core.js         math/RNG/noise, Input, Settings/Store, Sound, fixed-step Loop
    story.js        all content: heroines, biomes, mobs, sites, dungeons, quests
    models.js       procedural characters/mobs/buildings (no image models)
    world.js        terrain chunks, towns, castle, dungeons, keep interior
    entities.js     player/NPC/heroine/mob sim, camera, effects
    ui.js           HUD, dialogue, ring menu, panels, compass, map
    game.js         game state, quests, interaction, magic, App.boot
  bgm/              10 MP3 tracks, picked by context (menu/town/field/night/dungeon/…)
  game_menu.png     title backdrop
  game_logo.png     logo art
  Dungeon_Guide.pdf dungeon guide
```

Load order matters: `three → core → story → models → world → entities → ui → game`.

## Third-party

- Three.js r128 (`js/three.min.js`, MIT). CDN fallbacks: cdnjs + jsdelivr.
- Fonts: Google Fonts `Cormorant Garamond` (degrades gracefully offline).

## License

Public domain (Unlicense) — see [LICENSE](LICENSE). No copyright claimed, do anything you want.
