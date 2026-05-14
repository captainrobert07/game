# Hanna's Hollow

A cozy 3D village builder you can play in your browser. Hanna is the founder of a forgotten valley — chop trees, plant farms, attract villagers, and watch the hollow grow through day and night.

Built with [Three.js](https://threejs.org/) and zero build steps. Pure HTML, CSS, and ES modules. Deploys to Vercel as a static site.

---

## Run it locally

You need any local web server (browsers won't load ES modules from `file://`). If you have Python:

```sh
cd hannas-hollow
python -m http.server 8000
```

Then open <http://localhost:8000>.

Other options if you don't want Python:

- VS Code "Live Server" extension
- `npx serve` if you have Node
- Any static file server

---

## Play

- **Drag** to rotate the camera, **scroll** to zoom.
- **Click a tree** to send Hanna over to chop it (+3 🪵).
- **Click a build button** at the bottom, then click a free grass tile to place it.
  - 🌾 Farm — produces 1 food per day.
  - 🏠 House — attracts a new villager (1 per house).
  - ⛲ Well — generates a small coin trickle.
  - 🌳 Tree — plant your own for later.
- **Click a farm** for an instant harvest.
- 💾 saves to your browser. No accounts.

A real-time day is 2 minutes. Watch the sky.

---

## Deploy to Vercel

This is a static site — Vercel needs nothing custom.

1. Create a GitHub repo and push the project (see below).
2. Sign in to [Vercel](https://vercel.com), click **New Project**, import the repo.
3. Framework Preset: **Other**. Build Command: **(leave empty)**. Output Directory: **(leave empty — root)**.
4. Deploy.

`vercel.json` is included for clean caching defaults.

---

## Push to GitHub

```sh
cd hannas-hollow
git init -b main
git add .
git commit -m "Hanna's Hollow v1"
# Create an empty repo on GitHub first, then:
git remote add origin https://github.com/<your-username>/hannas-hollow.git
git push -u origin main
```

---

## Project layout

```
hannas-hollow/
├── index.html        # entry point + UI
├── style.css         # Clash-of-Clans-flavored UI styles
├── js/
│   ├── game.js       # main loop, scene setup, picking, save wiring
│   ├── hanna.js      # procedural 3D Hanna (chunky stylized)
│   ├── village.js    # ground, decor, building placement
│   ├── villagers.js  # wandering NPCs
│   ├── daynight.js   # sun position, sky color, ambient light
│   └── save.js       # localStorage save/load
├── vercel.json
└── README.md
```

## What you can do next

- Swap procedural Hanna for a real `.glb` model (Mixamo, Sketchfab, Meshy.ai). The game logic doesn't care — point `hanna.js` at a loader.
- Add more buildings (mill, market, dock).
- Add seasons.
- Add a real day/night ambient sound layer.
- Vercel KV for cross-device save sync via magic link.

Have fun.
