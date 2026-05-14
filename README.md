# Hanna Runs!

An endless meadow runner. Hanna sprints through a sunlit countryside — dodge haybales, slide under pipes, grab coins, chase combos.

Built with [Three.js](https://threejs.org/) and **zero build step**. Pure HTML, CSS, and ES modules. Deploys to Vercel as a static site.

🌐 Live: https://game-six-silk.vercel.app/

---

## Run locally

You need any local web server (browsers won't load ES modules from `file://`):

```sh
cd hannas-hollow
python -m http.server 8000
```

Open <http://localhost:8000>.

---

## Controls

**Desktop**
- `A` `D` or `←` `→` — change lanes
- `W` `↑` `Space` — jump
- `S` `↓` — slide
- `P` or `Esc` — pause

**Mobile**
- Swipe left / right — change lanes
- Swipe up — jump
- Swipe down — slide
- Corner zones also work as tap buttons

---

## Mechanics

- 3 lanes. Lane changes ease over ~0.18s (with input buffering — tap a second time during a change and it queues).
- Jump arc clears low obstacles (haybales, logs, rocks).
- Slide ducks under high obstacles (overhead pipes).
- Scarecrows block all heights — you must change lane.
- **Coins** build a combo (up to x8). Combo boosts both coin score and distance score.
- **Powerups** (rare):
  - 🧲 Magnet (7s) — pulls coins in
  - 🛡️ Shield (5s) — absorbs one hit
  - ✨ Double points (8s) — doubles all score
- **Near-miss bonus** — pass within 1m of an obstacle to score +25 with sparkle.
- Speed ramps from 9 m/s to 22 m/s over the run.

Top 5 scores save to your browser. No accounts.

---

## Project layout

```
hannas-hollow/   (the directory; project is "Hanna Runs!")
├── index.html        # entry + UI overlays
├── style.css         # arcade styling
├── vercel.json       # static deploy config
├── js/
│   ├── game.js       # main loop, physics, collisions, score
│   ├── hanna.js      # procedural 3D Hanna (teal hair, sage top)
│   ├── world.js      # endless meadow chunks
│   ├── obstacles.js  # spawn manager (obstacles, coins, powerups)
│   ├── input.js      # keyboard + swipe + tap zones
│   ├── audio.js      # synthesized SFX + ambient pad
│   ├── fx.js         # particles + camera shake
│   └── save.js       # localStorage top-5 leaderboard
```

---

## Deploy to Vercel

This is a static site — Vercel needs no build:

1. Push to GitHub.
2. On Vercel, **New Project** → import the repo.
3. Framework: **Other**. Build / Output / Install: **leave blank**.
4. Deploy.

`vercel.json` sets sensible cache headers (CSS/JS cacheable for an hour, HTML revalidates).

---

## Iteration history

- **v1** — Hanna's Hollow village builder (preserved in git history).
- **v2** — Pivoted to endless runner ("Hanna Runs!"). Built in 5 self-review cycles:
  1. Maximum-scope build (multi-obstacle, coins, powerups, particles, audio, mobile).
  2. Game-feel pass — tuned jump arc, slide window, combo decay, powerup rarity, fairness rules.
  3. Visual polish — fog distance, sky color, Hanna hair sway, shield/double auras.
  4. Bug pass — input buffering, dt-correctness, paused-state freeze, retry race.
  5. Final + deploy.

---

## What I'd add next

- A 3-2-1-GO countdown for the satisfying start beat.
- Daily seed (everyone gets the same obstacle layout for the day).
- Outfits for Hanna unlocked by total coins.
- Leaderboard sync via Vercel KV.
- A second biome past 1000m (forest → sky islands).

Have fun. If something feels off, tell me what — that's the loop.
