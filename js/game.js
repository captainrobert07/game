import * as THREE from "three";

import { Hanna } from "./hanna.js";
import { World, LANE, LANES } from "./world.js";
import { ObstacleManager, TYPE } from "./obstacles.js";
import { Input } from "./input.js";
import { Audio } from "./audio.js";
import { ParticleSystem, CameraShaker } from "./fx.js";
import { load, save, recordRun } from "./save.js";

// ---------- Tunables ----------
const PLAYER_START_Z = 0;
const BASE_SPEED = 9; // units / sec at start
const MAX_SPEED = 22;
const SPEED_RAMP_PER_SEC = 0.18;
const LANE_CHANGE_TIME = 0.18; // sec
const JUMP_VELOCITY = 10.5;
const GRAVITY = 26;
const SLIDE_DURATION = 0.85;
const SHIELD_DURATION = 5;
const MAGNET_DURATION = 7;
const DOUBLE_DURATION = 8;
const MAGNET_RADIUS = 4.5;
const COIN_SCORE = 10;
const COMBO_TIMEOUT = 2.5; // sec since last coin to break combo
const NEAR_MISS_RADIUS = 1.2;
const NEAR_MISS_BONUS = 25;

class Game {
  constructor() {
    // ---------- Renderer ----------
    this.canvas = document.getElementById("game-canvas");
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ---------- Scene ----------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa6dde0);
    this.scene.fog = new THREE.Fog(0xa6dde0, 40, 100);

    // Sun
    this.sun = new THREE.DirectionalLight(0xffffff, 1.05);
    this.sun.position.set(8, 14, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -10;
    this.sun.shadow.camera.right = 10;
    this.sun.shadow.camera.top = 10;
    this.sun.shadow.camera.bottom = -10;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 60;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    this.scene.add(new THREE.HemisphereLight(0xb6e3df, 0x6a8a78, 0.6));

    // Camera — 3rd-person follow behind Hanna
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    this._onResize();
    this.cameraTarget = new THREE.Vector3();
    this.cameraOffset = new THREE.Vector3(0, 4.0, -6.5); // behind & above
    this.cameraLook = new THREE.Vector3(0, 1.0, 6); // look ahead

    // World + obstacles
    this.world = new World(this.scene);
    this.obstacles = new ObstacleManager(this.scene);

    // Hanna
    this.hanna = new Hanna();
    this.hanna.setPosition(0, 0, PLAYER_START_Z);
    this.scene.add(this.hanna.group);

    // FX
    this.particles = new ParticleSystem(this.scene);
    this.shaker = new CameraShaker();

    // Audio
    this.audio = new Audio();

    // Save state
    this.persist = load();
    this.audio.setMuted(this.persist.muted);
    this._updateMuteIcon();

    // ---------- Run state ----------
    this.running = false;
    this.paused = false;
    this.over = false;

    this.player = {
      laneIdx: 1, // start middle
      laneFromIdx: 1,
      laneT: 1, // 0..1 along lane change (1 = settled)
      y: 0,
      vy: 0,
      sliding: false,
      slideUntil: 0,
      shieldUntil: 0,
      magnetUntil: 0,
      doubleUntil: 0,
    };
    this.run = {
      speed: BASE_SPEED,
      score: 0,
      coins: 0,
      distance: 0,
      combo: 1,
      lastCoinAt: -10,
      time: 0,
    };

    // Input
    this.input = new Input();
    this.input.on("left", () => this._tryLane(-1));
    this.input.on("right", () => this._tryLane(1));
    this.input.on("jump", () => this._tryJump());
    this.input.on("slide", () => this._trySlide());
    this.input.on("pause", () => this._togglePause());

    // UI
    this._wireUI();
    this._refreshLeaderboardPreview();

    // Resize
    window.addEventListener("resize", () => this._onResize());

    // Visibility — auto-pause when tab hidden
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.running && !this.over) {
        this._setPaused(true);
      }
    });

    // Loop
    this.lastT = performance.now();
    this._loop = this._loop.bind(this);

    // Hide loading
    requestAnimationFrame(() => {
      const el = document.getElementById("loading");
      if (el) el.classList.add("hidden");
    });

    requestAnimationFrame(this._loop);
  }

  // ---------- UI wiring ----------
  _wireUI() {
    document.getElementById("btn-start").addEventListener("click", () => {
      this.audio.resume();
      this.audio.startMusic();
      this._startRun();
    });
    document.getElementById("btn-retry").addEventListener("click", () => {
      this._startRun();
    });
    document.getElementById("btn-pause").addEventListener("click", () => this._togglePause());
    document.getElementById("btn-resume").addEventListener("click", () => this._setPaused(false));
    document.getElementById("btn-mute").addEventListener("click", () => {
      const m = this.audio.toggleMute();
      this.persist.muted = m;
      save(this.persist);
      this._updateMuteIcon();
    });
    document.getElementById("btn-help").addEventListener("click", () => {
      document.getElementById("help-modal").classList.remove("hidden");
    });
    document.getElementById("btn-help-close").addEventListener("click", () => {
      document.getElementById("help-modal").classList.add("hidden");
    });

    // Initial best
    document.getElementById("best").textContent = this.persist.topScores[0]?.score ?? 0;
  }

  _updateMuteIcon() {
    document.getElementById("btn-mute").textContent = this.audio.muted ? "🔇" : "🔊";
  }

  // ---------- Run lifecycle ----------
  _startRun() {
    this.over = false;
    this.paused = false;
    this.running = true;

    document.getElementById("title-screen").classList.add("hidden");
    document.getElementById("game-over").classList.add("hidden");
    document.getElementById("pause-screen").classList.add("hidden");

    // Reset world
    this.obstacles.reset();
    this.hanna.setPosition(0, 0, PLAYER_START_Z);
    this.hanna.setState("run");

    // Reset player + run
    this.player = {
      laneIdx: 1,
      laneFromIdx: 1,
      laneT: 1,
      y: 0,
      vy: 0,
      sliding: false,
      slideUntil: 0,
      shieldUntil: 0,
      magnetUntil: 0,
      doubleUntil: 0,
    };
    this.run = {
      speed: BASE_SPEED,
      score: 0,
      coins: 0,
      distance: 0,
      combo: 1,
      lastCoinAt: -10,
      time: 0,
    };

    this._refreshHud();
  }

  _endRun() {
    if (this.over) return;
    this.over = true;
    this.running = false;
    this.audio.hit();
    this.audio.gameOver();
    this.shaker.shake(0.4);
    this._flash();
    this.hanna.setState("hit");

    const isBest = recordRun(this.persist, {
      score: Math.floor(this.run.score),
      coins: this.run.coins,
      distance: Math.floor(this.run.distance),
    });

    if (this._gameOverTimer) clearTimeout(this._gameOverTimer);
    this._gameOverTimer = setTimeout(() => {
      this._gameOverTimer = null;
      if (!this.over) return; // user already retried
      document.getElementById("final-score").textContent = Math.floor(this.run.score);
      document.getElementById("final-coins").textContent = this.run.coins;
      document.getElementById("final-distance").textContent = Math.floor(this.run.distance) + "m";
      document.getElementById("new-best-banner").classList.toggle("hidden", !isBest);
      this._refreshLeaderboardPreview();
      document.getElementById("game-over").classList.remove("hidden");
    }, 800);
  }

  _refreshLeaderboardPreview() {
    const list = document.getElementById("lb-list");
    list.innerHTML = "";
    if (this.persist.topScores.length === 0) {
      list.innerHTML = "<li>No runs yet — go!</li>";
      return;
    }
    for (const e of this.persist.topScores) {
      const li = document.createElement("li");
      li.textContent = `${e.score.toLocaleString()} · ${e.coins} 🪙 · ${e.distance}m`;
      list.appendChild(li);
    }
    document.getElementById("best").textContent = this.persist.topScores[0]?.score ?? 0;
  }

  _setPaused(p) {
    if (this.over) return;
    this.paused = p;
    document.getElementById("pause-screen").classList.toggle("hidden", !p);
  }

  _togglePause() {
    if (!this.running || this.over) return;
    this._setPaused(!this.paused);
  }

  // ---------- Player actions ----------
  _tryLane(dir) {
    if (!this.running || this.paused || this.over) return;
    if (this.player.laneT < 1) {
      // Buffer the input — applies the moment the current change settles
      this._bufferedLaneDir = dir;
      return;
    }
    const next = this.player.laneIdx + dir;
    if (next < 0 || next > 2) return;
    this.player.laneFromIdx = this.player.laneIdx;
    this.player.laneIdx = next;
    this.player.laneT = 0;
    this.audio.laneChange();
  }

  _tryJump() {
    if (!this.running || this.paused || this.over) return;
    if (this.player.y > 0.05) return; // already airborne
    if (this.player.sliding) return;
    this.player.vy = JUMP_VELOCITY;
    this.audio.jump();
    this.hanna.setState("jump");
  }

  _trySlide() {
    if (!this.running || this.paused || this.over) return;
    if (this.player.y > 0.05) return; // can't slide mid-air (clean rule)
    if (this.player.sliding) return;
    this.player.sliding = true;
    this.player.slideUntil = this.run.time + SLIDE_DURATION;
    this.audio.slide();
    this.hanna.setState("slide");
  }

  // ---------- Loop ----------
  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _flash() {
    const el = document.getElementById("screen-flash");
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 120);
  }

  _toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove("show"), 1200);
  }

  _refreshHud() {
    document.getElementById("score").textContent = Math.floor(this.run.score);
    document.getElementById("coins").textContent = this.run.coins;

    // Combo
    const comboEl = document.getElementById("combo");
    if (this.run.combo > 1) {
      comboEl.classList.remove("hidden");
      document.getElementById("combo-x").textContent = `x${this.run.combo}`;
      const remain = Math.max(0, 1 - (this.run.time - this.run.lastCoinAt) / COMBO_TIMEOUT);
      document.getElementById("combo-bar-fill").style.width = `${remain * 100}%`;
    } else {
      comboEl.classList.add("hidden");
    }

    // Powerups
    this._setPowerupHud("pu-magnet", this.player.magnetUntil);
    this._setPowerupHud("pu-shield", this.player.shieldUntil);
    this._setPowerupHud("pu-double", this.player.doubleUntil);
  }

  _setPowerupHud(id, until) {
    const el = document.getElementById(id);
    const remain = until - this.run.time;
    if (remain > 0) {
      el.classList.remove("hidden");
      document.getElementById(id + "-t").textContent = remain.toFixed(1);
    } else {
      el.classList.add("hidden");
    }
  }

  _loop(now) {
    const rawDt = (now - this.lastT) / 1000;
    this.lastT = now;
    // Cap dt so a tab-switch pause doesn't teleport Hanna into a tree
    const dt = Math.min(rawDt, 1 / 30);

    if (this.running && !this.paused && !this.over) {
      this._tickGame(dt);
      this.particles.update(dt);
    } else if (!this.paused) {
      // Title or game-over: keep Hanna animating (idle / hit pose)
      this.hanna.update(dt);
      this.particles.update(dt);
    }
    // Paused: freeze everything visually except the camera (handled below)

    // Camera follow (always)
    this._updateCamera(dt);

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }

  _tickGame(dt) {
    // Speed ramp
    this.run.time += dt;
    this.run.speed = Math.min(MAX_SPEED, BASE_SPEED + this.run.time * SPEED_RAMP_PER_SEC);

    // Move forward
    const dz = this.run.speed * dt;
    this.run.distance += dz;

    // Lane interpolation
    if (this.player.laneT < 1) {
      this.player.laneT = Math.min(1, this.player.laneT + dt / LANE_CHANGE_TIME);
      if (this.player.laneT >= 1 && this._bufferedLaneDir) {
        const dir = this._bufferedLaneDir;
        this._bufferedLaneDir = null;
        this._tryLane(dir);
      }
    }

    // Vertical physics
    this.player.vy -= GRAVITY * dt;
    this.player.y += this.player.vy * dt;
    if (this.player.y <= 0) {
      this.player.y = 0;
      this.player.vy = 0;
      if (this.hanna.state === "jump") this.hanna.setState("run");
    }

    // Slide expiry
    if (this.player.sliding && this.run.time > this.player.slideUntil) {
      this.player.sliding = false;
      if (this.hanna.state === "slide") this.hanna.setState("run");
    }

    // Apply Hanna position
    const fromX = LANES[this.player.laneFromIdx];
    const toX = LANES[this.player.laneIdx];
    const ease = this._easeOutCubic(this.player.laneT);
    const px = fromX + (toX - fromX) * ease;
    const pz = this.hanna.group.position.z + dz;
    this.hanna.group.position.set(px, this.player.y, pz);
    this.hanna.setShield(this.run.time < this.player.shieldUntil);
    this.hanna.setDouble(this.run.time < this.player.doubleUntil);
    this.hanna.update(dt);

    // World + obstacles
    this.world.update(pz, dt);
    this.obstacles.update(dt, pz);

    // Magnet pickup
    if (this.run.time < this.player.magnetUntil) {
      this._magnetCoins(pz, dt);
    }

    // Collisions
    this._checkCollisions(pz);

    // Score: distance + active multiplier
    const distScore = dz * 1.0;
    const mult = (this.run.combo) * (this.run.time < this.player.doubleUntil ? 2 : 1);
    this.run.score += distScore * mult;

    // Combo decay — drop one notch per timeout, not all the way
    if (this.run.combo > 1 && this.run.time - this.run.lastCoinAt > COMBO_TIMEOUT) {
      this.run.combo = Math.max(1, this.run.combo - 1);
      this.run.lastCoinAt = this.run.time;
    }

    this._refreshHud();
  }

  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // ---------- Magnet ----------
  _magnetCoins(playerZ, dt) {
    const px = this.hanna.group.position.x;
    const py = this.hanna.group.position.y + 1.0;
    for (const s of this.obstacles.spawns) {
      if (s.collected) continue;
      if (s.type !== TYPE.COIN) continue;
      const dz = s.z - playerZ;
      if (dz < -1 || dz > MAGNET_RADIUS) continue;
      const dx = s.mesh.position.x - px;
      const dy = s.mesh.position.y - py;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < MAGNET_RADIUS && dist > 0.001) {
        const pull = 14 / Math.max(0.5, dist);
        const step = pull * dt;
        s.mesh.position.x -= (dx / dist) * step;
        s.mesh.position.y -= (dy / dist) * step;
        s.mesh.position.z -= (dz / dist) * step;
        s.z = s.mesh.position.z;
      }
    }
  }

  // ---------- Collisions ----------
  _playerHitbox() {
    // Halves
    const halfX = 0.32;
    const halfZ = 0.32;
    const halfY = this.player.sliding ? 0.45 : 0.95;
    const cy = this.player.y + (this.player.sliding ? 0.45 : 0.95);
    return {
      cx: this.hanna.group.position.x,
      cy,
      cz: this.hanna.group.position.z,
      halfX,
      halfY,
      halfZ,
    };
  }

  _checkCollisions(playerZ) {
    const ph = this._playerHitbox();
    for (const s of this.obstacles.spawns) {
      if (s.collected) continue;
      const dz = s.z - playerZ;
      if (dz > 1.5 || dz < -1.5) continue; // skip far-away

      // AABB overlap
      const sx = s.mesh.position.x;
      const sy = s.hitbox.cy;
      const sz = s.z;
      const overlap =
        Math.abs(ph.cx - sx) < ph.halfX + s.hitbox.halfX &&
        Math.abs(ph.cy - sy) < ph.halfY + s.hitbox.halfY &&
        Math.abs(ph.cz - sz) < ph.halfZ + s.hitbox.halfZ;

      if (!overlap) {
        // Near-miss bonus for obstacles only
        if (s.blocks && Math.abs(dz) < NEAR_MISS_RADIUS && Math.abs(ph.cx - sx) < 1.0 && !s._missed) {
          // Only count once when player passes
          if (dz < 0) {
            s._missed = true;
            this.run.score += NEAR_MISS_BONUS;
            this._toast("Near miss! +25");
            this.particles.burst(
              new THREE.Vector3(ph.cx, ph.cy, ph.cz),
              { count: 8, color: 0xffd54a, speed: 2, life: 0.3, size: 0.08 }
            );
          }
        }
        continue;
      }

      // Pickups
      if (s.type === TYPE.COIN) {
        s.collected = true;
        this.scene.remove(s.mesh);
        this.run.coins += 1;
        // Combo bumps every coin
        this.run.combo = Math.min(8, this.run.combo + 1);
        this.run.lastCoinAt = this.run.time;
        const mult = this.run.combo * (this.run.time < this.player.doubleUntil ? 2 : 1);
        this.run.score += COIN_SCORE * mult;
        this.audio.coin();
        this.particles.burst(s.mesh.position, { count: 8, color: 0xffd54a, speed: 3, life: 0.4, size: 0.1 });
        continue;
      }
      if (s.type === TYPE.PU_MAGNET) {
        s.collected = true;
        this.scene.remove(s.mesh);
        this.player.magnetUntil = this.run.time + MAGNET_DURATION;
        this.audio.powerup();
        this._toast("🧲 Magnet!");
        continue;
      }
      if (s.type === TYPE.PU_SHIELD) {
        s.collected = true;
        this.scene.remove(s.mesh);
        this.player.shieldUntil = this.run.time + SHIELD_DURATION;
        this.audio.powerup();
        this._toast("🛡️ Shield!");
        continue;
      }
      if (s.type === TYPE.PU_DOUBLE) {
        s.collected = true;
        this.scene.remove(s.mesh);
        this.player.doubleUntil = this.run.time + DOUBLE_DURATION;
        this.audio.powerup();
        this._toast("✨ Double points!");
        continue;
      }

      // Obstacles — apply blocks rules
      const blocks = s.blocks;
      // "low" blocks unless jumping above its top.
      // "high" blocks unless sliding under it.
      // "all" blocks always.
      const playerBottom = this.player.y;
      const playerTop = this.player.y + (this.player.sliding ? 0.9 : 1.9);
      const obsBottom = sy - s.hitbox.halfY;
      const obsTop = sy + s.hitbox.halfY;

      let avoided = false;
      if (blocks === "low" && playerBottom > obsTop - 0.05) avoided = true;
      else if (blocks === "high" && playerTop < obsBottom + 0.05) avoided = true;

      if (avoided) continue;

      // Hit. Shield blocks one.
      if (this.run.time < this.player.shieldUntil) {
        this.player.shieldUntil = 0;
        s._missed = true;
        this.audio.shieldBlock();
        this.shaker.shake(0.15);
        this.particles.burst(
          new THREE.Vector3(s.mesh.position.x, s.hitbox.cy, s.z),
          { count: 18, color: 0x55aaff, speed: 4, life: 0.5, size: 0.15 }
        );
        this._toast("🛡️ Shielded!");
        // Knock obstacle out of the way visually
        s.collected = true;
        this.scene.remove(s.mesh);
        continue;
      }

      // Game over
      this._endRun();
      return;
    }
  }

  // ---------- Camera ----------
  _updateCamera(dt) {
    const tx = this.hanna.group.position.x * 0.6;
    const ty = this.hanna.group.position.y;
    const tz = this.hanna.group.position.z;

    const desiredX = tx + this.cameraOffset.x;
    const desiredY = ty + this.cameraOffset.y;
    const desiredZ = tz + this.cameraOffset.z;

    const k = Math.min(1, dt * 6);
    this.camera.position.x += (desiredX - this.camera.position.x) * k;
    this.camera.position.y += (desiredY - this.camera.position.y) * k;
    this.camera.position.z += (desiredZ - this.camera.position.z) * k;

    // Apply shake
    const shake = this.shaker.apply(this.camera, dt);
    this.camera.position.x += shake.x;
    this.camera.position.y += shake.y;

    // Look ahead of Hanna
    this.cameraTarget.set(tx * 0.4, ty + this.cameraLook.y, tz + this.cameraLook.z);
    this.camera.lookAt(this.cameraTarget);

    // Sun follows Hanna so shadows stay nice
    this.sun.position.set(tx + 8, 14, tz + 6);
    this.sun.target.position.set(tx, 0, tz);
    this.sun.target.updateMatrixWorld();
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
        <div class="loading-sub" style="color: #5a3a00; font-size: 14px; margin-top: 12px;">
          ${err.message || "Hanna got lost. Check the console."}
        </div>
      </div>`;
    }
  }
});
