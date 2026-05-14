import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { Hanna } from "./hanna.js";
import { Village } from "./village.js";
import { VillagerManager } from "./villagers.js";
import { DayNight } from "./daynight.js";
import { saveGame, loadGame, clearGame } from "./save.js";

const COSTS = {
  farm: { wood: 5 },
  house: { wood: 8 },
  well: { wood: 6 },
  tree: { coin: 2 },
};

const HANNA_QUIPS = [
  "What a fine morning.",
  "I should plant another farm.",
  "These villagers are growing on me.",
  "The hollow is starting to feel like home.",
  "I wonder what's beyond those hills.",
  "Wood doesn't chop itself.",
  "Maybe one more house…",
  "I love this place.",
];

class Game {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x9fd6ff, 25, 70);

    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(14, 14, 14);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.set(0, 0.5, 0);

    // World
    this.village = new Village();
    this.scene.add(this.village.group);

    this.dayNight = new DayNight(this.scene, { dayLengthSec: 120 });

    // Hanna
    this.hanna = new Hanna();
    this.hanna.setPosition(0, 0);
    this.scene.add(this.hanna.group);

    // Villagers
    this.villagers = new VillagerManager(this.scene, this.village.half);

    // State
    this.state = {
      wood: 0,
      food: 0,
      coin: 10,
      pop: 1, // Hanna counts as 1
    };

    // Build mode
    this.buildMode = null; // null | "farm" | "house" | "well" | "tree"

    // Picking
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.lastPointerEvent = null;

    this._wireDOM();
    this._wireInput();
    this._loadIfPresent();
    this._updateHud();

    // Hanna says hi
    this._setStatus("Welcome to the Hollow.");
    setInterval(() => {
      this._setStatus(HANNA_QUIPS[Math.floor(Math.random() * HANNA_QUIPS.length)]);
    }, 12000);

    window.addEventListener("resize", () => this._onResize());

    // Hide loading screen once first frame is composed
    requestAnimationFrame(() => {
      const el = document.getElementById("loading");
      if (el) el.classList.add("hidden");
    });

    this.lastT = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---------- DOM ----------
  _wireDOM() {
    document.querySelectorAll(".build-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.dataset.build;
        if (k === "cancel") {
          this._setBuildMode(null);
        } else {
          this._setBuildMode(this.buildMode === k ? null : k);
        }
      });
    });

    document.getElementById("btn-save").addEventListener("click", () => {
      this._save();
      this._toast("Saved 💾");
    });
    document.getElementById("btn-load").addEventListener("click", () => {
      if (this._loadIfPresent(true)) this._toast("Loaded 📂");
      else this._toast("No save found");
    });
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (!confirm("Start a new village? Your current Hollow will be lost.")) return;
      clearGame();
      location.reload();
    });
    const help = document.getElementById("help-modal");
    document.getElementById("btn-help").addEventListener("click", () => {
      help.classList.remove("hidden");
    });
    document.getElementById("btn-help-close").addEventListener("click", () => {
      help.classList.add("hidden");
    });
    help.addEventListener("click", (e) => {
      if (e.target === help) help.classList.add("hidden");
    });
  }

  _setBuildMode(k) {
    this.buildMode = k;
    document.querySelectorAll(".build-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.build === k);
    });
    if (k) this._toast(`Place a ${k} on a free tile`);
    else this.village.hideHover();
  }

  _toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
  }

  _setStatus(msg) {
    const el = document.getElementById("hanna-status");
    if (el) el.textContent = msg;
  }

  _updateHud() {
    document.getElementById("res-wood").textContent = this.state.wood;
    document.getElementById("res-food").textContent = this.state.food;
    document.getElementById("res-coin").textContent = this.state.coin;
    document.getElementById("res-day").textContent = this.dayNight.dayCount;
    document.getElementById("res-pop").textContent = this.state.pop;
  }

  // ---------- Input ----------
  _wireInput() {
    this.canvas.addEventListener("pointermove", (e) => {
      this.lastPointerEvent = e;
      this._updatePointer(e);
    });
    this.canvas.addEventListener("pointerdown", (e) => {
      // Only respond to left click; right/middle are camera
      if (e.button !== 0) return;
      this._onClick(e);
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.village.hideHover();
    });
  }

  _updatePointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _pickTile() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.village.getPickables(), true);
    for (const h of hits) {
      // Walk up to find the userData with grid coords
      let o = h.object;
      while (o && !(o.userData && (o.userData.isTile || o.userData.kind))) {
        o = o.parent;
      }
      if (!o) continue;
      return { obj: o, point: h.point };
    }
    return null;
  }

  _onClick() {
    const pick = this._pickTile();
    if (!pick) return;
    const { obj, point } = pick;
    const ud = obj.userData;

    if (this.buildMode) {
      // Place at picked tile coords
      const target = ud.isTile
        ? { gx: ud.gx, gz: ud.gz }
        : this.village.worldToGrid(point.x, point.z);
      this._tryPlace(this.buildMode, target.gx, target.gz);
      return;
    }

    // No build mode — interactions
    if (ud.kind === "tree") {
      // Walk Hanna over and chop
      const wp = obj.position.clone();
      this.hanna.walkTo(wp);
      // After arrival: chop. We approximate by waiting until close.
      this._pendingAction = {
        kind: "chop",
        target: wp,
        gx: ud.gx,
        gz: ud.gz,
      };
      this._setStatus("Chopping a tree…");
    } else if (ud.kind === "farm") {
      this.state.food += 1;
      this._toast("+1 🌾 from farm");
      this._updateHud();
    } else if (ud.isTile) {
      // Just walk there
      this.hanna.walkTo(new THREE.Vector3(point.x, 0, point.z));
    }
  }

  _tryPlace(kind, gx, gz) {
    const cost = COSTS[kind] || {};
    for (const k in cost) {
      if (this.state[k] < cost[k]) {
        this._toast(`Need ${cost[k]} ${k}`);
        return;
      }
    }
    if (this.village.cells[gx]?.[gz]) {
      this._toast("Tile is occupied");
      return;
    }
    const mesh = this.village.place(kind, gx, gz);
    if (!mesh) {
      this._toast("Can't build there");
      return;
    }
    for (const k in cost) this.state[k] -= cost[k];
    if (kind === "house") this._maybeAttractVillager();
    this._toast(`+1 ${kind}`);
    this._updateHud();
    this._save();
  }

  _maybeAttractVillager() {
    // Cap = number of houses
    const houseCount = [...this.village.buildings.values()].filter(
      (b) => b.kind === "house"
    ).length;
    if (this.villagers.count() < houseCount) {
      const v = this.villagers.spawn();
      this.state.pop += 1;
      this._setStatus(`${v.name} just moved in!`);
      this._toast(`👋 ${v.name} joined the Hollow`);
    }
  }

  // ---------- Save / Load ----------
  _save() {
    saveGame({
      state: this.state,
      buildings: this.village.serialize(),
      day: this.dayNight.serialize(),
      villagers: this.villagers.list.map((v) => ({
        name: v.name,
        x: v.group.position.x,
        z: v.group.position.z,
      })),
      hannaPos: { x: this.hanna.group.position.x, z: this.hanna.group.position.z },
    });
  }

  _loadIfPresent(showToast = false) {
    const s = loadGame();
    if (!s) return false;
    Object.assign(this.state, s.state || {});
    if (s.buildings) this.village.rebuild(s.buildings);
    if (s.day) this.dayNight.deserialize(s.day);
    this.villagers.removeAll();
    if (s.villagers) {
      for (const vd of s.villagers) {
        const v = this.villagers.spawn(vd.name);
        v.group.position.set(vd.x, 0, vd.z);
      }
    }
    if (s.hannaPos) this.hanna.setPosition(s.hannaPos.x, s.hannaPos.z);
    this._updateHud();
    return true;
  }

  // ---------- Loop ----------
  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _loop(now) {
    const dt = Math.min((now - this.lastT) / 1000, 0.05);
    this.lastT = now;

    // Day/night tick
    const newDay = this.dayNight.step(dt);
    if (newDay) this._onNewDay();

    // Hover tile
    if (this.lastPointerEvent && this.buildMode) {
      const pick = this._pickTile();
      if (pick) {
        const ud = pick.obj.userData;
        const g = ud.isTile
          ? { gx: ud.gx, gz: ud.gz }
          : this.village.worldToGrid(pick.point.x, pick.point.z);
        this.village.showHover(g.gx, g.gz);
      }
    } else {
      this.village.hideHover();
    }

    // Pending chop
    if (this._pendingAction && this._pendingAction.kind === "chop") {
      const t = this._pendingAction.target;
      const dx = t.x - this.hanna.group.position.x;
      const dz = t.z - this.hanna.group.position.z;
      if (Math.hypot(dx, dz) < 1.5 && !this.hanna.targetPos) {
        // Arrived
        const removed = this.village.remove(this._pendingAction.gx, this._pendingAction.gz);
        if (removed === "tree") {
          this.state.wood += 3;
          this._toast("+3 🪵");
          this._setStatus("Chop chop chop.");
          this._updateHud();
          this._save();
        }
        this._pendingAction = null;
      }
    }

    // Sun camera follows Hanna so shadows look good
    this.dayNight.sun.target.position.copy(this.hanna.group.position);
    this.dayNight.sun.target.updateMatrixWorld();

    this.hanna.update(dt);
    this.villagers.update(dt);
    this.controls.update();

    this._updateHud();
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this._loop);
  }

  _onNewDay() {
    // Each farm produces 1 food per day
    let farmCount = 0;
    for (const b of this.village.buildings.values()) {
      if (b.kind === "farm") farmCount++;
    }
    if (farmCount > 0) {
      this.state.food += farmCount;
      this._toast(`+${farmCount} 🌾 (harvest)`);
    }
    // Each well + 1 coin (tourist economy lol)
    let wellCount = 0;
    for (const b of this.village.buildings.values()) {
      if (b.kind === "well") wellCount++;
    }
    if (wellCount > 0) this.state.coin += wellCount;

    this._setStatus(`Day ${this.dayNight.dayCount} dawns over the Hollow.`);
    this._updateHud();
    this._save();
  }
}

// Boot
window.addEventListener("DOMContentLoaded", () => {
  try {
    new Game();
  } catch (err) {
    console.error(err);
    const el = document.getElementById("loading");
    if (el) {
      el.innerHTML = `<div class="loading-card">
        <div class="loading-title">Oh no</div>
        <div class="loading-sub">Hanna got lost. Check the console.</div>
      </div>`;
    }
  }
});
